import {
  executeExportWorkerPlan,
  type ExportWorkerAdapter,
  type ExportWorkerExecutionResult,
  type ExportWorkerReadiness,
  type ExportWorkerState,
} from "./exportWorker";

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
}

export interface ExportActionBridge {
  sandboxWriteFile(filePath: string, data: string): Promise<{ written: boolean; path: string; hash: string }>;
  sandboxCopyFile?(sourcePath: string, destinationPath: string): Promise<{ copied: boolean; sourcePath: string; path: string; hash: string; size: number }>;
}

export interface RunExportActionInput {
  worker: ExportWorkerState;
  projectRoot?: string;
  bridge?: ExportActionBridge;
  signal?: AbortSignal;
  onProgress?: (progress: { current: number; total: number; label: string }) => void;
}

class MemoryExportAdapter implements ExportWorkerAdapter {
  readonly writes: ExportActionWrite[] = [];

  mkdir() {
    return undefined;
  }

  writeFile(path: string, content: string) {
    this.writes.push({ path, content });
  }
}

class BridgeExportAdapter implements ExportWorkerAdapter {
  constructor(private readonly projectRoot: string, private readonly bridge: ExportActionBridge) {}

  mkdir() {
    return undefined;
  }

  private projectPath(path: string) {
    const root = this.projectRoot.replace(/\\/g, "/").replace(/\/+$/, "");
    return `${root}/${path}`;
  }

  async writeFile(path: string, content: string) {
    await this.bridge.sandboxWriteFile(this.projectPath(path), content);
  }

  async copyFile(sourcePath: string, destinationPath: string) {
    if (!this.bridge.sandboxCopyFile) {
      throw new Error("Electron export bridge does not implement copyFile.");
    }
    await this.bridge.sandboxCopyFile(this.projectPath(sourcePath), this.projectPath(destinationPath));
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

function executableWorker(worker: ExportWorkerState): ExportWorkerState {
  const readiness: ExportWorkerReadiness = worker.blockers.length ? "blocked" : "ready";
  const canExecute = worker.blockers.length === 0;
  const manifest = {
    ...worker.manifest,
    readiness,
  };
  const manifestContent = serialize(manifest);
  return {
    ...worker,
    executionMode: "adapter_execution",
    confirmed: true,
    readiness,
    canExecute,
    manifest,
    entries: worker.entries.map((entry) => ({
      ...entry,
      canExecute,
      content: entry.kind === "export_manifest" ? manifestContent : entry.content,
      contentHash: entry.kind === "export_manifest" ? stableHash(manifestContent) : entry.contentHash,
    })),
  };
}

function manifestPath(worker: ExportWorkerState) {
  return worker.manifest.allowedWritePaths.find((path) => path.endsWith("/export_manifest.json")) || `${worker.exportRoot}/export_manifest.json`;
}

export async function runExportAction(input: RunExportActionInput): Promise<ExportActionState> {
  const worker = executableWorker(input.worker);
  const memoryAdapter = new MemoryExportAdapter();
  const adapter = input.bridge && input.projectRoot
    ? new BridgeExportAdapter(input.projectRoot, input.bridge)
    : memoryAdapter;
  const result: ExportWorkerExecutionResult = await executeExportWorkerPlan(worker, adapter, input.signal, input.onProgress);
  const plannedWriteCount = worker.entries.filter((entry) => entry.operation === "write_file").length;

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
    };
  }

  return {
    status: "ready",
    label: input.bridge && input.projectRoot ? "导出包已生成" : "导出清单已生成",
    detail: input.bridge && input.projectRoot ? "已写入当前项目的 exports 文件夹。" : "当前环境已生成可测试的导出清单。",
    exportRoot: worker.exportRoot,
    manifestPath: manifestPath(worker),
    executedCount: result.executed.length,
    plannedWriteCount,
    writes: memoryAdapter.writes,
  };
}
