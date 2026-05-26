import { isElectron, getElectronBridge } from "./electronBridge";
import type { ExecutionLedgerOutputSandbox } from "./executionLedger";
import {
  buildProviderObservation,
  providerObservationFilePath,
  type ProviderObservation,
  type SandboxWatcherEvent,
} from "./providerObservationSidecar";
import { sandboxPathValid } from "./sandboxPathUtils";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _electronBridge = (isElectron() ? getElectronBridge() : null) as any;

export const realImage2GateSchemaVersion = "0.1.0";

export type RealImage2GatePhase =
  | "locked"
  | "ready"
  | "generating"
  | "watching"
  | "file_detected"
  | "observation_written"
  | "promoted"
  | "blocked";

export interface RealImage2GateState {
  schemaVersion: string;
  phase: RealImage2GatePhase;
  sandbox: ExecutionLedgerOutputSandbox;
  shotId: string;
  taskPlanId: string;
  generatedAt: string;
  watcherEvents: SandboxWatcherEvent[];
  observations: ProviderObservation[];
  latestOutputFile?: string;
  latestOutputHash?: string;
  previewUrl?: string;
  promoted: boolean;
  blockers: string[];
  userMessage: string;
}

export interface BuildRealImage2GateInput {
  generatedAt?: string;
  sandbox: ExecutionLedgerOutputSandbox;
  shotId: string;
  taskPlanId: string;
  imagePrompt?: string;
}

export interface StartRealImage2GenerationInput {
  state: RealImage2GateState;
  imageData?: Uint8Array;
  fileName?: string;
  onPhaseChange: (state: RealImage2GateState) => void;
}

function cloneState(state: RealImage2GateState): RealImage2GateState {
  return {
    ...state,
    watcherEvents: [...state.watcherEvents],
    observations: [...state.observations],
    blockers: [...state.blockers],
  };
}

function phaseMessage(phase: RealImage2GatePhase): string {
  switch (phase) {
    case "locked": return "Image2 单镜头生成已锁定。";
    case "ready": return "准备生成，等待确认。";
    case "generating": return "正在调用 Image2 生成画面...";
    case "watching": return "正在监控输出目录...";
    case "file_detected": return "检测到输出文件，正在写入观测记录...";
    case "observation_written": return "观测记录已写入，等待复核确认。";
    case "promoted": return "画面已生成并通过复核，可以预览。";
    case "blocked": return "生成被阻断，请检查阻断原因。";
  }
}

function localRuntimeOnlyBlocker(): string {
  return "本地文件监听和观测写入已移到运行时进程；请通过当前项目的 Image2 运行时动作生成并回流。";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function watcherEventFromBridgeResult(value: unknown): SandboxWatcherEvent | undefined {
  if (!isRecord(value)) return undefined;
  const event = isRecord(value.event) ? value.event : value;
  if (typeof event.eventId !== "string" || typeof event.filePath !== "string") return undefined;
  return {
    eventId: event.eventId,
    eventType: event.eventType === "file_changed" ? "file_changed" : "file_added",
    filePath: event.filePath,
    hash: typeof event.hash === "string" ? event.hash : undefined,
    hashAlgorithm: event.hashAlgorithm === "sha256" ? "sha256" : undefined,
    detectedAt: typeof event.detectedAt === "string" ? event.detectedAt : new Date().toISOString(),
  };
}

async function writeProviderObservationViaBridge(
  observation: ProviderObservation,
  sandbox: ExecutionLedgerOutputSandbox,
): Promise<{ filePath: string; written: boolean; blocker?: string }> {
  const filePath = providerObservationFilePath(sandbox, observation);
  if (!sandboxPathValid(filePath, sandbox)) {
    return { filePath, written: false, blocker: `Observation path outside sandbox: ${filePath}` };
  }
  if (!_electronBridge?.sandboxWriteFile) {
    return { filePath, written: false, blocker: localRuntimeOnlyBlocker() };
  }
  try {
    const result = await _electronBridge.sandboxWriteFile(filePath, JSON.stringify(observation, null, 2));
    if (result?.written) return { filePath: result.path || filePath, written: true };
    return { filePath, written: false, blocker: "写入观测记录失败。" };
  } catch (error) {
    return {
      filePath,
      written: false,
      blocker: error instanceof Error ? error.message : "写入观测记录失败。",
    };
  }
}

export function buildRealImage2GateState(input: BuildRealImage2GateInput): RealImage2GateState {
  const generatedAt = input.generatedAt || new Date().toISOString();
  return {
    schemaVersion: realImage2GateSchemaVersion,
    phase: "locked",
    sandbox: input.sandbox,
    shotId: input.shotId,
    taskPlanId: input.taskPlanId,
    generatedAt,
    watcherEvents: [],
    observations: [],
    promoted: false,
    blockers: [],
    userMessage: phaseMessage("locked"),
  };
}

export function unlockRealImage2Gate(state: RealImage2GateState): RealImage2GateState {
  if (state.phase !== "locked") return state;
  const next = cloneState(state);
  next.phase = "ready";
  next.userMessage = phaseMessage("ready");
  return next;
}

export function lockRealImage2Gate(state: RealImage2GateState): RealImage2GateState {
  const next = cloneState(state);
  next.phase = "locked";
  next.userMessage = phaseMessage("locked");
  return next;
}

export function startRealImage2Generation(input: StartRealImage2GenerationInput): {
  state: RealImage2GateState;
  stop: () => void;
} {
  const { state, imageData, fileName, onPhaseChange } = input;
  const next = cloneState(state);
  next.phase = "generating";
  next.userMessage = phaseMessage("generating");
  onPhaseChange(next);

  const outputFileName = fileName || `${state.shotId}_image2_${Date.now()}.png`;
  const outputPath = `${state.sandbox.root}/${outputFileName}`;
  let watcherStop: (() => void) | undefined;

  function advance(phase: RealImage2GatePhase, blocker?: string) {
    next.phase = phase;
    if (blocker) next.blockers.push(blocker);
    next.userMessage = phaseMessage(phase);
    onPhaseChange(cloneState(next));
  }

  async function handleWatcherEvent(event: SandboxWatcherEvent) {
    next.watcherEvents.push(event);
    next.latestOutputFile = event.filePath;
    next.latestOutputHash = event.hash;
    advance("file_detected");

    if (!event.hash) {
      advance("blocked", "检测到的文件无法计算哈希。");
      return;
    }

    const observation = buildProviderObservation({
      event,
      taskPlanId: state.taskPlanId,
      shotId: state.shotId,
      generatedAt: state.generatedAt,
    });

    const result = await writeProviderObservationViaBridge(observation, state.sandbox);
    if (result.written) {
      next.observations.push(observation);
      advance("observation_written");
    } else {
      advance("blocked", result.blocker || "写入观测记录失败。");
    }
  }

  async function startWatching() {
    next.phase = "watching";
    next.userMessage = phaseMessage("watching");
    onPhaseChange(cloneState(next));

    if (!isElectron() || !_electronBridge?.sandboxWatch) {
      advance("blocked", localRuntimeOnlyBlocker());
      return;
    }

    try {
      const result = await _electronBridge.sandboxWatch(state.sandbox.root);
      if (!result?.watching) {
        advance("blocked", typeof result?.reason === "string" ? result.reason : "本地目录监听没有启动。");
        return;
      }
      const event = watcherEventFromBridgeResult(result);
      if (event) void handleWatcherEvent(event);
      watcherStop = () => undefined;
    } catch (error) {
      advance("blocked", error instanceof Error ? error.message : "本地目录监听启动失败。");
    }
  }

  if (imageData) {
    void imageData;
    void outputPath;
    advance("blocked", "浏览器层不再直接写入生成文件；请通过当前项目的 Image2 运行时动作生成并回流。");
  } else {
    startWatching();
  }

  return {
    state: cloneState(next),
    stop() {
      watcherStop?.();
    },
  };
}

export function promoteRealImage2Artifact(
  state: RealImage2GateState,
  expectedHash?: string,
): RealImage2GateState {
  const next = cloneState(state);

  if (next.phase !== "observation_written") {
    next.phase = "blocked";
    next.blockers.push("只有在观测记录写入后才能提升为正式产出。");
    next.userMessage = phaseMessage("blocked");
    return next;
  }

  const latestObservation = next.observations[next.observations.length - 1];
  if (!latestObservation) {
    next.phase = "blocked";
    next.blockers.push("没有可用的观测记录进行哈希验证。");
    next.userMessage = phaseMessage("blocked");
    return next;
  }

  if (expectedHash && latestObservation.outputHash !== expectedHash) {
    next.phase = "blocked";
    next.blockers.push(`哈希不匹配：期望 ${expectedHash}，实际 ${latestObservation.outputHash || "无"}`);
    next.userMessage = phaseMessage("blocked");
    return next;
  }

  next.phase = "promoted";
  next.promoted = true;
  next.previewUrl = next.latestOutputFile;
  next.userMessage = phaseMessage("promoted");
  return next;
}

export function realImage2GatePromotionReady(state: RealImage2GateState): boolean {
  return state.phase === "observation_written" && state.observations.length > 0 && !!state.latestOutputHash;
}

export function realImage2GateCanGenerate(state: RealImage2GateState): boolean {
  return state.phase === "ready";
}

export const realImage2GateHardLocks = {
  scopedImage2Only: true as const,
  maxOneShotPerGate: 1 as const,
  providerSubmissionForbidden: false as const,
  noFileMutation: false as const,
  noCredentialRead: true as const,
  noCredentialWrite: true as const,
  noShellExecution: true as const,
  noWorkerSpawn: true as const,
  liveSubmitAllowed: false as const,
  videoProvidersParked: true as const,
  audioProvidersParked: true as const,
  jimengParked: true as const,
  seedanceParked: true as const,
  onlyImage2Allowed: true as const,
  sandboxScopedOutputOnly: true as const,
  watcherManifestQaRequired: true as const,
  providerSelfReportCannotComplete: true as const,
};
