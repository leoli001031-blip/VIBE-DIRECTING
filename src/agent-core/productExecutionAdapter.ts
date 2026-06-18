import type {
  VibeAgentConfirmedActionHandler,
  VibeAgentConfirmedActionHandlers,
} from "./actionExecutor";
import type { DirectorAgentToolHandoff } from "../core/directorAgentToolHandoff";
import type { DirectorAgentToolTrace } from "../core/directorAgentToolTrace";
import type { VibeAgentProductToolInvocationTarget } from "./confirmedProductActionRunner";

export interface VibeAgentProductExecutionAdapter<TValue = unknown> {
  writeProject?: VibeAgentConfirmedActionHandler<TValue>;
  researchStyle?: VibeAgentConfirmedActionHandler<TValue>;
  generateReferences?: VibeAgentConfirmedActionHandler<TValue>;
  submitVideo?: VibeAgentConfirmedActionHandler<TValue>;
  queryVideo?: VibeAgentConfirmedActionHandler<TValue>;
  exportProject?: VibeAgentConfirmedActionHandler<TValue>;
}

export function buildVibeAgentProductExecutionHandlers<TValue>(
  adapter: VibeAgentProductExecutionAdapter<TValue>,
): VibeAgentConfirmedActionHandlers<TValue> {
  const handlers: VibeAgentConfirmedActionHandlers<TValue> = {};
  if (adapter.writeProject) handlers.write_project = adapter.writeProject;
  if (adapter.researchStyle) handlers.research_style = adapter.researchStyle;
  if (adapter.generateReferences) handlers.generate_references = adapter.generateReferences;
  if (adapter.submitVideo) handlers.submit_video = adapter.submitVideo;
  if (adapter.queryVideo) handlers.query_video = adapter.queryVideo;
  if (adapter.exportProject) handlers.export_project = adapter.exportProject;
  return handlers;
}

export interface VibeAgentProductExecutionCapabilities<
  TVideoPermissionContract = unknown,
  TWebSearchSettings = unknown,
  TWebSearchResult = unknown,
> {
  recoveryHint?: string;
  videoPermissionContract?: TVideoPermissionContract;
  webSearchSettings?: TWebSearchSettings;
  status: {
    setStatus: (status: string) => void;
    setHandoff: (handoff: DirectorAgentToolHandoff) => void;
    setResearchStatus?: (status: "running" | "ready" | "blocked") => void;
    setReferenceStatus?: (status: "idle") => void;
    setResearchResult?: (result: TWebSearchResult | undefined) => void;
  };
  research?: {
    buildResearchQuery?: (userIntent: string) => string;
    runWebSearch?: (input: {
      query: string;
      purpose: "style_research";
      settings?: TWebSearchSettings;
      agentToolTrace: DirectorAgentToolTrace;
    }) => Promise<TWebSearchResult> | TWebSearchResult;
  };
  references?: {
    createReferences?: (target?: VibeAgentProductToolInvocationTarget<TVideoPermissionContract>) => Promise<unknown> | unknown;
  };
  video?: {
    submitVideo?: (target?: VibeAgentProductToolInvocationTarget<TVideoPermissionContract>) => Promise<unknown> | unknown;
    queryVideo?: (target?: VibeAgentProductToolInvocationTarget<TVideoPermissionContract>) => Promise<unknown> | unknown;
  };
  exportProject?: {
    runExport?: (target?: Pick<VibeAgentProductToolInvocationTarget<TVideoPermissionContract>, "agentToolTrace">) => Promise<unknown> | unknown;
  };
}

export type VibeAgentResearchExecutionCapability<TWebSearchSettings = unknown, TWebSearchResult = unknown> =
  VibeAgentProductExecutionCapabilities<unknown, TWebSearchSettings, TWebSearchResult>["research"];

export type VibeAgentReferenceExecutionCapability<TVideoPermissionContract = unknown> =
  VibeAgentProductExecutionCapabilities<TVideoPermissionContract>["references"];

export type VibeAgentVideoExecutionCapability<TVideoPermissionContract = unknown> =
  VibeAgentProductExecutionCapabilities<TVideoPermissionContract>["video"];

export type VibeAgentExportExecutionCapability<TVideoPermissionContract = unknown> =
  VibeAgentProductExecutionCapabilities<TVideoPermissionContract>["exportProject"];

export function buildVibeAgentResearchExecutionCapability<TWebSearchSettings = unknown, TWebSearchResult = unknown>(
  input: NonNullable<VibeAgentResearchExecutionCapability<TWebSearchSettings, TWebSearchResult>>,
): VibeAgentResearchExecutionCapability<TWebSearchSettings, TWebSearchResult> {
  return input;
}

export function buildVibeAgentReferenceExecutionCapability<TVideoPermissionContract = unknown>(
  input: NonNullable<VibeAgentReferenceExecutionCapability<TVideoPermissionContract>>,
): VibeAgentReferenceExecutionCapability<TVideoPermissionContract> {
  return input;
}

export function buildVibeAgentVideoExecutionCapability<TVideoPermissionContract = unknown>(
  input: NonNullable<VibeAgentVideoExecutionCapability<TVideoPermissionContract>>,
): VibeAgentVideoExecutionCapability<TVideoPermissionContract> {
  return input;
}

export function buildVibeAgentExportExecutionCapability<TVideoPermissionContract = unknown>(
  input: NonNullable<VibeAgentExportExecutionCapability<TVideoPermissionContract>>,
): VibeAgentExportExecutionCapability<TVideoPermissionContract> {
  return input;
}

export function buildVibeAgentProductExecutionCapabilities<
  TVideoPermissionContract = unknown,
  TWebSearchSettings = unknown,
  TWebSearchResult = unknown,
>(
  input: VibeAgentProductExecutionCapabilities<TVideoPermissionContract, TWebSearchSettings, TWebSearchResult>,
) {
  return {
    recoveryHint: input.recoveryHint,
    videoPermissionContract: input.videoPermissionContract,
    webSearchSettings: input.webSearchSettings,
    setStatus: input.status.setStatus,
    setHandoff: input.status.setHandoff,
    setResearchStatus: input.status.setResearchStatus,
    setReferenceStatus: input.status.setReferenceStatus,
    setResearchResult: input.status.setResearchResult,
    buildResearchQuery: input.research?.buildResearchQuery,
    runWebSearch: input.research?.runWebSearch,
    createReferences: input.references?.createReferences,
    submitVideo: input.video?.submitVideo,
    queryVideo: input.video?.queryVideo,
    runExport: input.exportProject?.runExport,
  };
}
