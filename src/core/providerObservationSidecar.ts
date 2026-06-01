import { sandboxPathValid } from "./sandboxPathUtils";
import type { ExecutionLedgerOutputSandbox } from "./executionLedger";

export interface SandboxWatcherEvent {
  eventId: string;
  eventType: "file_added" | "file_changed";
  filePath: string;
  hash?: string;
  hashAlgorithm?: "sha256";
  detectedAt: string;
}

export const providerObservationSidecarSchemaVersion = "0.1.0";

export interface ProviderObservation {
  schemaVersion: string;
  observationId: string;
  generatedAt: string;
  sourceEventId: string;
  taskPlanId: string;
  shotId?: string;
  jobId?: string;
  taskRunId?: string;
  outputFile: string;
  outputHash?: string;
  outputHashAlgorithm?: "sha256";
  outputSizeBytes?: number;
  observedAt: string;
  phase: "image2_single_shot_observation";
  notes: string[];
}

export interface BuildProviderObservationInput {
  event: SandboxWatcherEvent;
  taskPlanId: string;
  shotId?: string;
  jobId?: string;
  taskRunId?: string;
  generatedAt?: string;
}

function observationId(taskPlanId: string, eventId: string): string {
  return `provider_observation_${taskPlanId}_${eventId}`;
}

export function providerObservationFilePath(
  sandbox: ExecutionLedgerOutputSandbox,
  observation: ProviderObservation,
): string {
  const dir = sandbox.root;
  const fileName = `${observation.observationId}.json`;
  return `${dir}/provider_observations/${fileName}`;
}

export function buildProviderObservation(
  input: BuildProviderObservationInput,
): ProviderObservation {
  return {
    schemaVersion: providerObservationSidecarSchemaVersion,
    observationId: observationId(input.taskPlanId, input.event.eventId),
    generatedAt: input.generatedAt || new Date().toISOString(),
    sourceEventId: input.event.eventId,
    taskPlanId: input.taskPlanId,
    shotId: input.shotId,
    jobId: input.jobId,
    taskRunId: input.taskRunId,
    outputFile: input.event.filePath,
    outputHash: input.event.hash,
    outputHashAlgorithm: input.event.hashAlgorithm,
    observedAt: input.event.detectedAt,
    phase: "image2_single_shot_observation",
    notes: [
      "Provider observation sidecar binds the output file hash to its task plan and job, enabling artifact promotion after QA and manifest gates pass.",
    ],
  };
}

export async function writeProviderObservation(
  observation: ProviderObservation,
  sandbox: ExecutionLedgerOutputSandbox,
): Promise<{ filePath: string; written: boolean; blocker?: string }> {
  const filePath = providerObservationFilePath(sandbox, observation);

  if (!sandboxPathValid(filePath, sandbox)) {
    return { filePath, written: false, blocker: `Observation path outside sandbox: ${filePath}` };
  }
  return { filePath, written: false, blocker: "Observation writing is only available in the local runtime process." };
}

export interface HashMatchResult {
  matched: boolean;
  expectedHash?: string;
  actualHash?: string;
  observationFile?: string;
}

export function verifyObservationHash(
  observation: ProviderObservation,
  expectedHash: string,
): HashMatchResult {
  return {
    matched: observation.outputHash === expectedHash,
    expectedHash,
    actualHash: observation.outputHash,
    observationFile: undefined,
  };
}

export function observationMatchesTask(
  observation: ProviderObservation,
  taskPlanId: string,
): boolean {
  return observation.taskPlanId === taskPlanId;
}
