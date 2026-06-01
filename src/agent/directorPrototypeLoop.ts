import { AgentLoop } from "./agentLoop";
import {
  createDirectorAgentPlan,
  createDirectorAgentToolContext,
} from "./directorAgentPlan";
import {
  createDirectorAgentMockProvider,
  directorPrototypeAgentConfig,
} from "./directorAgentMockProvider";
import { createDirectorProviderRegistry } from "./directorAgentProviderTools";
import {
  createDirectorProviderReviewState,
  requirePromotedMockProviderRequest,
} from "./reviewState";
import { appendDirectorPrototypeRunReceipt } from "./projectWriter";
import {
  createDirectorPrototypePreviewItem,
  summarizeDirectorProviderRequest,
} from "./previewAdapter";
import type {
  DirectorPrototypeClosedLoopInput,
  DirectorPrototypeClosedLoopResult,
} from "./directorPrototypeTypes";

export type {
  DirectorPrototypeClosedLoopInput,
  DirectorPrototypeClosedLoopResult,
  DirectorPrototypePreviewItem,
  DirectorPrototypeProviderSummary,
} from "./directorPrototypeTypes";

export async function runDirectorPrototypeClosedLoop(
  input: DirectorPrototypeClosedLoopInput,
): Promise<DirectorPrototypeClosedLoopResult> {
  const plan = createDirectorAgentPlan(input);
  const providerState = createDirectorProviderReviewState();
  const registry = createDirectorProviderRegistry(providerState);
  const mockProvider = createDirectorAgentMockProvider(plan);

  const loop = new AgentLoop(
    {
      provider: directorPrototypeAgentConfig.provider,
      providerClient: mockProvider,
      session: directorPrototypeAgentConfig.session,
      maxTurns: directorPrototypeAgentConfig.maxTurns,
    },
    registry,
    createDirectorAgentToolContext(plan),
  );

  const agentRun = await loop.run(plan.userPrompt);

  if (!agentRun.completed) {
    throw new Error(`Agent loop did not complete: ${agentRun.finalResponse}`);
  }
  const promotedRequest = requirePromotedMockProviderRequest(providerState, plan.requestId);
  const writeResult = appendDirectorPrototypeRunReceipt(input.project, plan, promotedRequest);

  return {
    nextProject: writeResult.nextProject,
    transactionReceipt: writeResult.transactionReceipt,
    providerRequestSummary: summarizeDirectorProviderRequest(promotedRequest),
    previewItem: createDirectorPrototypePreviewItem(plan, promotedRequest),
    toolTrace: agentRun.toolTrace,
    agentRun,
    runReceipt: writeResult.runReceipt,
  };
}
