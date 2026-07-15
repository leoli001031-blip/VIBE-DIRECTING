import {
  executeExportWorkerPlan,
  type ExportWorkerAdapter,
  type ExportWorkerExecutionResult,
  type ExportWorkerState,
} from "./exportWorker";
import type { DirectorAgentToolTrace } from "./directorAgentToolTrace";
import {
  authorizeExportDeliveryGate,
  createExportDeliveryReceipt,
  exportDeliveryBlockerMessages,
  type ExportDeliveryConfirmation,
  type ExportDeliveryGateState,
  type ExportDeliveryReceipt,
  type ExportDeliveryReceiptOutput,
} from "./exportDeliveryGate";

export type ExportActionStatus = "idle" | "running" | "ready" | "blocked" | "failed";

export interface ExportActionWrite {
  path: string;
  content: string;
}

export interface ExportActionState {
  status: ExportActionStatus;
  label: string;
  detail?: string;
  exportRoot?: string;
  manifestPath?: string;
  executedCount?: number;
  plannedWriteCount?: number;
  writes?: ExportActionWrite[];
  errors?: string[];
  agentToolTrace?: ExportActionToolTrace;
  deliveryGate?: ExportDeliveryGateState;
  deliveryReceipt?: ExportDeliveryReceipt;
  outputAssets?: string[];
}

export type ExportActionToolTrace = DirectorAgentToolTrace;

export interface ExportActionBridge {
  sandboxHashFile?(filePath: string): Promise<{ path: string; hash: string; size: number }>;
  sandboxWriteFile(filePath: string, data: string): Promise<{ written: boolean; path: string; hash: string }>;
  sandboxCopyFile?(sourcePath: string, destinationPath: string): Promise<{ copied: boolean; sourcePath: string; path: string; hash: string; size: number }>;
}

export interface RunExportActionInput {
  worker: ExportWorkerState;
  projectRoot?: string;
  bridge?: ExportActionBridge;
  signal?: AbortSignal;
  onProgress?: (progress: { current: number; total: number; label: string }) => void;
  agentToolTrace?: ExportActionToolTrace;
  deliveryConfirmation?: ExportDeliveryConfirmation;
  completedDeliveryReceipts?: unknown[];
}

class MemoryExportAdapter implements ExportWorkerAdapter {
  readonly writes: ExportActionWrite[] = [];
  readonly copies: ExportActionWrite[] = [];

  mkdir() {
    return undefined;
  }

  writeFile(path: string, content: string) {
    this.writes.push({ path, content });
  }

  copyFile(sourcePath: string, destinationPath: string) {
    this.copies.push({ path: destinationPath, content: sourcePath });
  }
}

class BridgeExportAdapter implements ExportWorkerAdapter {
  readonly outputs: ExportDeliveryReceiptOutput[] = [];

  constructor(private readonly projectRoot: string, private readonly bridge: ExportActionBridge) {}

  mkdir() {
    return undefined;
  }

  private projectPath(path: string) {
    const root = this.projectRoot.replace(/\\/g, "/").replace(/\/+$/, "");
    return `${root}/${path}`;
  }

  async writeFile(path: string, content: string) {
    const result = await this.bridge.sandboxWriteFile(this.projectPath(path), content);
    this.outputs.push({ operation: "write_file", path, outputHash: result.hash });
  }

  async copyFile(sourcePath: string, destinationPath: string) {
    if (!this.bridge.sandboxCopyFile) {
      throw new Error("Electron export bridge does not implement copyFile.");
    }
    const result = await this.bridge.sandboxCopyFile(this.projectPath(sourcePath), this.projectPath(destinationPath));
    this.outputs.push({
      operation: "copy_file",
      path: destinationPath,
      sourcePath,
      sourceHash: normalizeSha256(result.hash),
      outputHash: normalizeSha256(result.hash),
      size: result.size,
    });
  }
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",")}}`;
}

function stableHash(value: unknown): string {
  const input = stableStringify(value);
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `vck_${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function serialize(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function executableWorker(worker: ExportWorkerState, deliveryGate: ExportDeliveryGateState, agentToolTrace?: ExportActionToolTrace): ExportWorkerState {
  const retainedBlockers = worker.blockers.filter((item) => !/^\[delivery_/.test(item));
  const blockers = Array.from(new Set([...retainedBlockers, ...exportDeliveryBlockerMessages(deliveryGate)])).sort();
  const canExecute = blockers.length === 0 && deliveryGate.status === "authorized" && deliveryGate.canExecute;
  const readiness: ExportWorkerState["readiness"] = canExecute ? "ready" : "blocked";
  const manifest = {
    ...worker.manifest,
    readiness,
    ...(agentToolTrace ? { agentToolTrace } : {}),
  };
  const manifestContent = serialize(manifest);
  return {
    ...worker,
    executionMode: "adapter_execution",
    confirmed: Boolean(deliveryGate.authorization),
    readiness,
    canExecute,
    deliveryGate,
    blockers,
    manifest,
    entries: worker.entries.map((entry) => ({
      ...entry,
      canExecute,
      content: entry.kind === "export_manifest" ? manifestContent : entry.content,
      contentHash: entry.kind === "export_manifest" ? stableHash(manifestContent) : entry.contentHash,
    })),
  };
}

function normalizeSha256(value: string | undefined) {
  const normalized = value?.trim().toLowerCase() || "";
  return normalized.startsWith("sha256:") ? normalized : normalized ? `sha256:${normalized}` : "";
}

function projectPath(projectRoot: string, relativePath: string) {
  const root = projectRoot.replace(/\\/g, "/").replace(/\/+$/, "");
  return `${root}/${relativePath}`;
}

async function verifyDeliveryMediaHashes(input: {
  worker: ExportWorkerState;
  bridge: ExportActionBridge;
  projectRoot: string;
}) {
  const errors: string[] = [];
  if (!input.bridge.sandboxHashFile) {
    return ["[delivery_media_hash_unverified] Electron export bridge cannot verify source media hashes before writing."];
  }
  const mediaFiles = input.worker.manifest.mediaFiles || [];
  for (const mediaFile of mediaFiles) {
    const binding = input.worker.deliveryGate.reviewBindings.find((item) => (
      item.shotId === mediaFile.shotId
      && item.outputPath === mediaFile.sourcePath
      && normalizeSha256(item.outputHash) === normalizeSha256(mediaFile.sourceHash)
    ));
    if (!binding) errors.push(`[delivery_review_identity_mismatch] Export source ${mediaFile.sourcePath} has no exact review binding.`);
  }
  for (const binding of input.worker.deliveryGate.reviewBindings) {
    const mediaFile = mediaFiles.find((item) => (
      item.shotId === binding.shotId
      && item.sourcePath === binding.outputPath
      && normalizeSha256(item.sourceHash) === normalizeSha256(binding.outputHash)
    ));
    if (!mediaFile) {
      errors.push(`[delivery_review_identity_mismatch] Export copy source does not match review receipt ${binding.reviewReceiptId}.`);
      continue;
    }
    try {
      const result = await input.bridge.sandboxHashFile(projectPath(input.projectRoot, binding.outputPath));
      if (normalizeSha256(result.hash) !== normalizeSha256(binding.outputHash)) {
        errors.push(`[delivery_media_hash_mismatch] ${binding.shotId} source media hash changed after review.`);
      }
    } catch (error) {
      errors.push(`[delivery_media_hash_unverified] ${binding.shotId} source media hash could not be verified: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return errors;
}

function manifestPath(worker: ExportWorkerState) {
  return worker.manifest.allowedWritePaths.find((path) => path.endsWith("/export_manifest.json")) || `${worker.exportRoot}/export_manifest.json`;
}

export async function runExportAction(input: RunExportActionInput): Promise<ExportActionState> {
  const deliveryGate = authorizeExportDeliveryGate({
    gate: input.worker.deliveryGate,
    confirmation: input.deliveryConfirmation || input.worker.deliveryGate.authorization,
    completedReceipts: input.completedDeliveryReceipts,
  });
  const worker = executableWorker(input.worker, deliveryGate, input.agentToolTrace);
  const memoryAdapter = new MemoryExportAdapter();
  const bridgeAdapter = input.bridge && input.projectRoot
    ? new BridgeExportAdapter(input.projectRoot, input.bridge)
    : undefined;
  const adapter = bridgeAdapter
    ? bridgeAdapter
    : memoryAdapter;
  const plannedWriteCount = worker.entries.filter((entry) => entry.operation === "write_file").length;
  if (worker.canExecute && input.bridge && input.projectRoot) {
    const mediaErrors = await verifyDeliveryMediaHashes({ worker, bridge: input.bridge, projectRoot: input.projectRoot });
    if (mediaErrors.length) {
      return {
        status: "blocked",
        label: "导出还未就绪",
        detail: "源视频与人工复核记录不一致。",
        exportRoot: worker.exportRoot,
        manifestPath: manifestPath(worker),
        executedCount: 0,
        plannedWriteCount,
        writes: [],
        errors: mediaErrors,
        agentToolTrace: input.agentToolTrace,
        deliveryGate: {
          ...deliveryGate,
          status: "blocked",
          canExecute: false,
          blockers: [
            ...deliveryGate.blockers,
            ...mediaErrors.map((message) => ({
              code: message.includes("delivery_media_hash_mismatch") ? "delivery_media_hash_mismatch" as const : "delivery_media_hash_unverified" as const,
              message,
            })),
          ],
        },
        outputAssets: [],
      };
    }
  }
  const result: ExportWorkerExecutionResult = await executeExportWorkerPlan(worker, adapter, input.signal, input.onProgress);

  if (!result.ok) {
    return {
      status: worker.blockers.length ? "blocked" : "failed",
      label: worker.blockers.length ? "导出还未就绪" : "导出失败",
      detail: "请补齐画面、素材或项目文件后再试。",
      exportRoot: worker.exportRoot,
      manifestPath: manifestPath(worker),
      executedCount: result.executed.length,
      plannedWriteCount,
      writes: memoryAdapter.writes,
      errors: result.errors,
      agentToolTrace: input.agentToolTrace,
      deliveryGate,
      outputAssets: [],
    };
  }

  const executionMode = bridgeAdapter ? "live" : "dry_run";
  const deliveryReceipt = createExportDeliveryReceipt({
    gate: deliveryGate,
    executionMode,
    outputs: bridgeAdapter?.outputs || [],
  });
  const outputAssets = deliveryReceipt?.executionMode === "live"
    ? deliveryReceipt.outputs.map((output) => output.path)
    : [];

  return {
    status: "ready",
    label: input.bridge && input.projectRoot ? "导出包已生成" : "导出清单已生成",
    detail: input.bridge && input.projectRoot ? "已写入当前项目的 exports 文件夹。" : "已整理好本次项目交付清单。",
    exportRoot: worker.exportRoot,
    manifestPath: manifestPath(worker),
    executedCount: result.executed.length,
    plannedWriteCount,
    writes: memoryAdapter.writes,
    agentToolTrace: input.agentToolTrace,
    deliveryGate,
    deliveryReceipt,
    outputAssets,
  };
}
