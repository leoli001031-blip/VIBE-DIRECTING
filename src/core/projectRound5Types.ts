import { stringArray } from "./runtimeApiClient";

export type ProjectRound5ShotGate = {
  shotId: string;
  taskRunId?: string;
  gateStatus?: string;
  ledgerStatus?: string;
  nextAction?: string;
  startFramePath?: string;
  startFrameSha256?: string;
  startExists?: boolean;
  startQaStatus?: string;
  endRequired?: boolean;
  endFramePath?: string;
  endExists?: boolean;
  endFrameSha256?: string;
  strictEditPreflightStatus?: string;
  strictEditPilotCandidate: boolean;
  blockers: string[];
  warnings: string[];
};

export type ProjectRound5GateSummary = {
  status?: string;
  shotGateMatrix: ProjectRound5ShotGate[];
  ledgerProjection?: Record<string, unknown>;
  assetGateSummary?: Record<string, unknown>;
  uiSummary?: Record<string, unknown>;
  isolation?: Record<string, unknown>;
};

export function normalizeProjectRound5ShotGate(shot: Record<string, unknown>, index: number): ProjectRound5ShotGate {
  return {
    shotId: typeof shot.shotId === "string" && shot.shotId.trim() ? shot.shotId : `ZP${String(index + 1).padStart(2, "0")}`,
    taskRunId: typeof shot.taskRunId === "string" ? shot.taskRunId : undefined,
    gateStatus: typeof shot.gateStatus === "string" ? shot.gateStatus : undefined,
    ledgerStatus: typeof shot.ledgerStatus === "string" ? shot.ledgerStatus : undefined,
    nextAction: typeof shot.nextAction === "string" ? shot.nextAction : undefined,
    startFramePath: typeof shot.startFramePath === "string" ? shot.startFramePath : undefined,
    startFrameSha256: typeof shot.startFrameSha256 === "string" ? shot.startFrameSha256 : undefined,
    startExists: typeof shot.startExists === "boolean" ? shot.startExists : undefined,
    startQaStatus: typeof shot.startQaStatus === "string" ? shot.startQaStatus : undefined,
    endRequired: typeof shot.endRequired === "boolean" ? shot.endRequired : undefined,
    endFramePath: typeof shot.endFramePath === "string" ? shot.endFramePath : undefined,
    endExists: typeof shot.endExists === "boolean" ? shot.endExists : undefined,
    endFrameSha256: typeof shot.endFrameSha256 === "string" ? shot.endFrameSha256 : undefined,
    strictEditPreflightStatus: typeof shot.strictEditPreflightStatus === "string" ? shot.strictEditPreflightStatus : undefined,
    strictEditPilotCandidate: shot.strictEditPilotCandidate === true,
    blockers: stringArray(shot.blockers),
    warnings: stringArray(shot.warnings),
  };
}
