import type { DirectorAgentActionEnvelope } from "../core/directorAgentAction";
import {
  executeConfirmedVibeAgentAction,
  executeRegisteredVibeAgentAction,
  type VibeAgentConfirmedActionExecutionContext,
  type VibeAgentConfirmedActionExecutionResult,
  type VibeAgentConfirmedActionHandlers,
} from "./actionExecutor";
import { listVibeAgentActionNames } from "./actionRegistry";
import { runVibeAgentTurn } from "./runAgentTurn";
import type {
  VibeAgentPermissionMode,
  VibeAgentToolName,
  VibeAgentTurnInput,
  VibeAgentTurnResult,
} from "./types";

export interface VibeAgentRuntimeAdapter {
  listActions(): VibeAgentToolName[];
  runTurn(input: VibeAgentTurnInput): VibeAgentTurnResult;
  runConfirmedAction<TValue>(input: {
    action: DirectorAgentActionEnvelope;
    permissionMode: VibeAgentPermissionMode;
    userConfirmed?: boolean;
    apply: (context: VibeAgentConfirmedActionExecutionContext) => Promise<TValue> | TValue;
  }): Promise<VibeAgentConfirmedActionExecutionResult<TValue>>;
  runRegisteredAction<TValue>(input: {
    action: DirectorAgentActionEnvelope;
    permissionMode: VibeAgentPermissionMode;
    userConfirmed?: boolean;
    handlers: VibeAgentConfirmedActionHandlers<TValue>;
  }): Promise<VibeAgentConfirmedActionExecutionResult<TValue>>;
}

export function createVibeAgentRuntimeAdapter(): VibeAgentRuntimeAdapter {
  return {
    listActions: listVibeAgentActionNames,
    runTurn: runVibeAgentTurn,
    runConfirmedAction: executeConfirmedVibeAgentAction,
    runRegisteredAction: executeRegisteredVibeAgentAction,
  };
}
