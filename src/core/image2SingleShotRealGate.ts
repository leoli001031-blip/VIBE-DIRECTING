import type { ExecutionLedgerOutputSandbox } from "./executionLedger";
import type { SandboxWatcherEvent } from "./providerObservationSidecar";
import { startSandboxWatcher, type SandboxWatcher } from "./sandboxWatcherNode";
import {
  buildProviderObservation,
  type ProviderObservation,
} from "./providerObservationSidecar";
import { writeProviderObservation } from "./providerObservationSidecarNode";

export const image2SingleShotRealGateSchemaVersion = "0.1.0";

export type Image2RealGatePhase =
  | "locked"
  | "watching"
  | "file_detected"
  | "observation_written"
  | "promoted"
  | "blocked";

export interface Image2RealGateState {
  schemaVersion: string;
  phase: Image2RealGatePhase;
  sandbox: ExecutionLedgerOutputSandbox;
  taskPlanId: string;
  shotId?: string;
  jobId?: string;
  generatedAt: string;
  watcherEvents: SandboxWatcherEvent[];
  observations: ProviderObservation[];
  latestOutputFile?: string;
  latestOutputHash?: string;
  promoted: boolean;
  blockers: string[];
}

export interface StartImage2RealTestFlowInput {
  sandbox: ExecutionLedgerOutputSandbox;
  taskPlanId: string;
  shotId?: string;
  jobId?: string;
  generatedAt?: string;
  onStateChange: (state: Image2RealGateState) => void;
}

export function startImage2RealTestFlow(
  input: StartImage2RealTestFlowInput,
): { state: Image2RealGateState; stop: () => void } {
  const generatedAt = input.generatedAt || new Date().toISOString();

  const state: Image2RealGateState = {
    schemaVersion: image2SingleShotRealGateSchemaVersion,
    phase: "watching",
    sandbox: input.sandbox,
    taskPlanId: input.taskPlanId,
    shotId: input.shotId,
    jobId: input.jobId,
    generatedAt,
    watcherEvents: [],
    observations: [],
    promoted: false,
    blockers: [],
  };

  function updatePhase(phase: Image2RealGatePhase, blocker?: string) {
    state.phase = phase;
    if (blocker) state.blockers.push(blocker);
    input.onStateChange({ ...state, watcherEvents: [...state.watcherEvents], observations: [...state.observations], blockers: [...state.blockers] });
  }

  async function handleWatcherEvent(event: SandboxWatcherEvent) {
    state.watcherEvents.push(event);
    state.latestOutputFile = event.filePath;
    state.latestOutputHash = event.hash;
    updatePhase("file_detected");

    if (!event.hash) {
      updatePhase("blocked", "Detected file has no computable hash.");
      return;
    }

    const observation = buildProviderObservation({
      event,
      taskPlanId: input.taskPlanId,
      shotId: input.shotId,
      jobId: input.jobId,
      generatedAt,
    });

    const result = await writeProviderObservation(observation, input.sandbox);
    if (result.written) {
      state.observations.push(observation);
      updatePhase("observation_written");
    } else {
      updatePhase("blocked", result.blocker || "Failed to write observation sidecar.");
    }
  }

  const watcher: SandboxWatcher = startSandboxWatcher(input.sandbox, (event) => {
    handleWatcherEvent(event);
  });

  return {
    state,
    stop() {
      watcher.stop();
      updatePhase("locked");
    },
  };
}

export function promoteImage2Artifact(
  state: Image2RealGateState,
  expectedHash: string,
): Image2RealGateState {
  const latestObservation = state.observations[state.observations.length - 1];
  if (!latestObservation) {
    return { ...state, phase: "blocked", blockers: [...state.blockers, "No observation available for hash verification."] };
  }

  const hashMatches = latestObservation.outputHash === expectedHash;
  if (!hashMatches) {
    return {
      ...state,
      phase: "blocked",
      blockers: [...state.blockers, `Hash mismatch: expected ${expectedHash}, got ${latestObservation.outputHash || "none"}`],
    };
  }

  return {
    ...state,
    phase: "promoted",
    promoted: true,
  };
}

export function image2RealGatePromotionReady(state: Image2RealGateState): boolean {
  return state.phase === "observation_written" && state.observations.length > 0 && !!state.latestOutputHash;
}
