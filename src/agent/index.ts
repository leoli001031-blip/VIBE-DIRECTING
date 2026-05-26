// Agent framework — barrel exports

export { createLLMProvider } from "./llmProvider";
export type {
  LLMProviderConfig,
  LLMProvider,
  LLMToolCall,
  LLMUsage,
  LLMCallResult,
} from "./llmProvider";

export { ToolRegistry } from "./toolRegistry";
export type {
  ToolContext,
  ToolResult,
  ToolDefinition,
} from "./toolRegistry";

export { SessionManager } from "./sessionManager";
export type {
  SessionConfig,
  SessionState,
} from "./sessionManager";

export { AgentLoop } from "./agentLoop";
export type {
  AgentLoopConfig,
  AgentIteration,
  AgentToolTrace,
  AgentRunResult,
} from "./agentLoop";

export { runDirectorPrototypeClosedLoop } from "./directorPrototypeLoop";
export type {
  DirectorPrototypeClosedLoopInput,
  DirectorPrototypeClosedLoopResult,
  DirectorPrototypePreviewItem,
  DirectorPrototypeProviderSummary,
} from "./directorPrototypeLoop";

export { createImage2Tool } from "./image2Tool";
export type { Image2ToolConfig, Image2Result } from "./image2Tool";

export {
  createLanyiImage2AgentTool,
  lanyiImage2AgentToolName,
  lanyiImage2AgentToolSchemaVersion,
} from "./lanyiImage2AgentTool";
export type {
  LanyiImage2AgentProviderMode,
  LanyiImage2AgentResultStatus,
  LanyiImage2AgentToolConfig,
  LanyiImage2AgentToolInput,
  LanyiImage2AgentToolResult,
  LanyiImage2EvidenceCandidate,
  LanyiImage2RealProviderGateContract,
  LanyiImage2ReceiptCandidate,
  LanyiImage2SubmitPlanCandidate,
} from "./lanyiImage2AgentTool";

export { createAgentFileTool } from "./fileTool";
export type { AgentFileToolConfig, AgentFileToolResult } from "./fileTool";

export {
  agentWebSearchToolName,
  agentWebSearchToolSchemaVersion,
  createAgentWebSearchTool,
} from "./webSearchTool";
export type {
  AgentWebSearchCitation,
  AgentWebSearchProvider,
  AgentWebSearchPurpose,
  AgentWebSearchToolConfig,
  AgentWebSearchToolInput,
  AgentWebSearchToolResult,
} from "./webSearchTool";

export {
  canPromoteOwnedAgentResult,
  createMockOwnedAgentConfig,
  createOwnedAgentToolRegistry,
  ownedAgentLoopSchemaVersion,
  runOwnedAgentTaskEnvelope,
  validateOwnedAgentTaskEnvelope,
} from "./ownedAgentLoop";
export type {
  OwnedAgentLoopConfig,
  OwnedAgentProviderPath,
  OwnedAgentProviderMode,
  OwnedAgentReceiptCandidate,
  OwnedAgentRunStatus,
  OwnedAgentSessionCheckpoint,
  OwnedAgentStructuredResult,
  OwnedAgentValidatedTaskEnvelope,
  RunOwnedAgentTaskEnvelopeInput,
} from "./ownedAgentLoop";

export {
  ownedAgentImage2SubmitPlanSchemaVersion,
  queueOwnedAgentImage2SubmitPlansForP6,
} from "./ownedAgentImage2SubmitPlan";
export type {
  OwnedAgentImage2P6SchedulerProjection,
  OwnedAgentImage2SubmitPlanConfirmation,
} from "./ownedAgentImage2SubmitPlan";

export { createJimengTool } from "./jimengTool";
export type { JimengToolConfig, JimengResult } from "./jimengTool";
