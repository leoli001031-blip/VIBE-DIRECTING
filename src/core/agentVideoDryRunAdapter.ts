import {
  runAgentVideoExecution,
  type AgentVideoExecutionAction,
  type AgentVideoExecutionAdapterResult,
  type RunAgentVideoExecutionInput,
} from "./agentVideoExecutionAdapter";

export type AgentVideoDryRunAction = AgentVideoExecutionAction;

export type RunAgentVideoDryRunConfirmedActionInput = Omit<
  RunAgentVideoExecutionInput,
  "executionMode" | "liveExecutionAllowed" | "liveCapability" | "execute" | "timeoutMs" | "signal"
>;

export type AgentVideoDryRunAdapterResult = AgentVideoExecutionAdapterResult & {
  dryRunOnly: true;
  liveSubmitAllowed: false;
};

export async function runAgentVideoDryRunConfirmedAction(
  input: RunAgentVideoDryRunConfirmedActionInput,
): Promise<AgentVideoDryRunAdapterResult> {
  return await runAgentVideoExecution({
    ...input,
    executionMode: "dry_run",
  }) as AgentVideoDryRunAdapterResult;
}
