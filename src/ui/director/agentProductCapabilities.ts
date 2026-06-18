import {
  buildDirectorResearchQuery,
  runAgentWebSearch,
  type AgentWebSearchResult,
  type AgentWebSearchSettings,
} from "../../core/agentWebSearchClient";
import type { DirectorAgentToolHandoff } from "../../core/directorAgentToolHandoff";
import type { DirectorAgentActionEnvelope } from "../../core/directorAgentAction";
import type { DirectorAgentToolAvailability } from "../../core/directorAgentToolHandoff";
import type {
  AgentControlledToolInvocationTarget,
  AgentVideoSubmitContract,
} from "./agentPanelProjection";
import {
  buildVibeAgentConfirmedProductPolicy,
  type VibeAgentExportExecutionCapability,
  buildVibeAgentExportExecutionCapability,
  buildVibeAgentProductExecutionCapabilities,
  type VibeAgentReferenceExecutionCapability,
  buildVibeAgentReferenceExecutionCapability,
  type VibeAgentResearchExecutionCapability,
  buildVibeAgentResearchExecutionCapability,
  type VibeAgentVideoExecutionCapability,
  buildVibeAgentVideoExecutionCapability,
  runRegisteredConfirmedVibeAgentProductAction,
  vibeAgentPermissionModeForConfirmedAction,
  type VibeAgentConfirmedToolRunOutcome,
} from "../../agent-core";

type AgentProductAction = (target?: AgentControlledToolInvocationTarget) => unknown | Promise<unknown>;
type MinimalAgentVideoCapability = VibeAgentVideoExecutionCapability<AgentVideoSubmitContract>;
type MinimalAgentReferenceCapability = VibeAgentReferenceExecutionCapability<AgentVideoSubmitContract>;
type MinimalAgentResearchCapability = VibeAgentResearchExecutionCapability<AgentWebSearchSettings, AgentWebSearchResult>;
type MinimalAgentExportCapability = VibeAgentExportExecutionCapability<AgentVideoSubmitContract>;

export interface MinimalAgentProductCapabilitiesInput {
  recoveryHint?: string;
  videoPermissionContract: AgentVideoSubmitContract;
  webSearchSettings: AgentWebSearchSettings;
  setStatus: (status: string) => void;
  setAgentToolHandoff: (handoff: DirectorAgentToolHandoff) => void;
  setResearchStatus: (status: "running" | "ready" | "blocked") => void;
  setReferenceStatus: (status: "idle") => void;
  setResearchResult: (result: AgentWebSearchResult | undefined) => void;
  createReferences?: AgentProductAction;
  submitVideo?: AgentProductAction;
  queryVideo?: AgentProductAction;
  runExport?: (target?: Pick<AgentControlledToolInvocationTarget, "agentToolTrace">) => unknown | Promise<unknown>;
}

export function buildMinimalAgentResearchProductCapability(
  input: Pick<MinimalAgentProductCapabilitiesInput, "webSearchSettings">,
): MinimalAgentResearchCapability {
  return buildVibeAgentResearchExecutionCapability<AgentWebSearchSettings, AgentWebSearchResult>({
    buildResearchQuery: buildDirectorResearchQuery,
    runWebSearch: ({ query, purpose, settings, agentToolTrace }) => runAgentWebSearch({
      query,
      purpose,
      settings: settings || input.webSearchSettings,
      agentToolTrace,
    }),
  });
}

export function buildMinimalAgentReferenceProductCapability(
  input: Pick<MinimalAgentProductCapabilitiesInput, "createReferences">,
): MinimalAgentReferenceCapability {
  return buildVibeAgentReferenceExecutionCapability<AgentVideoSubmitContract>({
    createReferences: input.createReferences,
  });
}

export function buildMinimalAgentVideoProductCapability(
  input: Pick<MinimalAgentProductCapabilitiesInput, "submitVideo" | "queryVideo">,
): MinimalAgentVideoCapability {
  return buildVibeAgentVideoExecutionCapability<AgentVideoSubmitContract>({
    submitVideo: input.submitVideo,
    queryVideo: input.queryVideo,
  });
}

export function buildMinimalAgentExportProductCapability(
  input: Pick<MinimalAgentProductCapabilitiesInput, "runExport">,
): MinimalAgentExportCapability {
  return buildVibeAgentExportExecutionCapability<AgentVideoSubmitContract>({
    runExport: input.runExport,
  });
}

export function buildMinimalAgentProductCapabilities(input: MinimalAgentProductCapabilitiesInput) {
  return buildVibeAgentProductExecutionCapabilities<AgentVideoSubmitContract, AgentWebSearchSettings, AgentWebSearchResult>({
    recoveryHint: input.recoveryHint,
    videoPermissionContract: input.videoPermissionContract,
    webSearchSettings: input.webSearchSettings,
    status: {
      setStatus: input.setStatus,
      setHandoff: input.setAgentToolHandoff,
      setResearchStatus: input.setResearchStatus,
      setReferenceStatus: input.setReferenceStatus,
      setResearchResult: input.setResearchResult,
    },
    research: buildMinimalAgentResearchProductCapability(input),
    references: buildMinimalAgentReferenceProductCapability(input),
    video: buildMinimalAgentVideoProductCapability(input),
    exportProject: buildMinimalAgentExportProductCapability(input),
  });
}

export interface RunMinimalAgentConfirmedProductActionInput extends MinimalAgentProductCapabilitiesInput {
  action?: DirectorAgentActionEnvelope;
  userIntent: string;
  preparedHandoff?: DirectorAgentToolHandoff;
  availability: DirectorAgentToolAvailability;
}

export interface MinimalAgentProductAdapterInput extends MinimalAgentProductCapabilitiesInput {
  availability: DirectorAgentToolAvailability;
}

export interface RunMinimalAgentProductAdapterActionInput {
  action?: DirectorAgentActionEnvelope;
  userIntent: string;
  preparedHandoff?: DirectorAgentToolHandoff;
}

export interface MinimalAgentProductAdapter {
  runConfirmedAction: (input: RunMinimalAgentProductAdapterActionInput) => Promise<VibeAgentConfirmedToolRunOutcome>;
}

export function buildMinimalAgentProductAdapter(input: MinimalAgentProductAdapterInput): MinimalAgentProductAdapter {
  const policy = buildVibeAgentConfirmedProductPolicy({
    availability: input.availability,
  });
  const capabilities = buildMinimalAgentProductCapabilities(input);
  return {
    runConfirmedAction: (actionInput) => runRegisteredConfirmedVibeAgentProductAction<AgentVideoSubmitContract, AgentWebSearchSettings, AgentWebSearchResult>({
      action: actionInput.action,
      userIntent: actionInput.userIntent,
      preparedHandoff: actionInput.preparedHandoff,
      permissionMode: actionInput.action ? vibeAgentPermissionModeForConfirmedAction(actionInput.action) : "plan_only",
      userConfirmed: true,
      ...policy,
      ...capabilities,
    }),
  };
}

export function runMinimalAgentConfirmedProductAction(
  input: RunMinimalAgentConfirmedProductActionInput,
): Promise<VibeAgentConfirmedToolRunOutcome> {
  return buildMinimalAgentProductAdapter(input).runConfirmedAction({
    action: input.action,
    userIntent: input.userIntent,
    preparedHandoff: input.preparedHandoff,
  });
}
