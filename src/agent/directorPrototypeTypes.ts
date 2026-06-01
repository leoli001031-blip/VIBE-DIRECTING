import type { AgentRunResult, AgentToolTrace } from "./agentLoop";
import type {
  ProjectVibeDocument,
  ProjectVibeRunReceipt,
  ProjectVibeTransactionReceipt,
} from "../project";
import type { ProviderId } from "../providers";

export interface DirectorPrototypeClosedLoopInput {
  project: ProjectVibeDocument;
  userIntent: string;
  selectedShotId: string;
  now?: string;
  runId?: string;
  sessionId?: string;
  providerId?: ProviderId;
}

export interface DirectorPrototypeProviderSummary {
  requestId: string;
  providerId: ProviderId;
  taskKind: string;
  status: string;
  reviewStatus: string;
  inputHash: string;
  outputPath: string;
  liveSubmit: false;
  adapterMode: "mock_only";
  fastTest: true;
}

export interface DirectorPrototypePreviewItem {
  id: string;
  shotId: string;
  title: string;
  mediaPath: string;
  source: "provider_mock_return";
  providerRequestId: string;
  inputHash: string;
}

export interface DirectorPrototypeClosedLoopResult {
  nextProject: ProjectVibeDocument;
  transactionReceipt: ProjectVibeTransactionReceipt;
  providerRequestSummary: DirectorPrototypeProviderSummary;
  previewItem: DirectorPrototypePreviewItem;
  toolTrace: AgentToolTrace[];
  agentRun: AgentRunResult;
  runReceipt: ProjectVibeRunReceipt;
}
