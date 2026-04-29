import type { ContextLevel, ProviderSlot, SubagentTaskPurpose } from "./types";

export type KnowledgePackType = "system_builtin" | "user_custom" | "project_local" | "external_imported";

export type KnowledgePackConsumer =
  | "agent_context"
  | "subagent_context"
  | "prompt_compiler"
  | "qa_gate"
  | "inspector"
  | "diagnostics";

export type KnowledgePackCategory =
  | "script"
  | "storyflow"
  | "story_function"
  | "style"
  | "composition"
  | "camera"
  | "lighting"
  | "color"
  | "lens_focus"
  | "performance"
  | "prompt"
  | "provider"
  | "qa"
  | "audio"
  | "agent";

export type KnowledgePackTrustLevel = "trusted" | "verified" | "unverified" | "experimental";

export type KnowledgeVerificationStatus = "not_required" | "pending" | "verified" | "failed";

export type KnowledgeTaskPurpose =
  | "script"
  | "asset"
  | "keyframe"
  | "edit"
  | "i2v"
  | "video"
  | "audio"
  | "qa"
  | "audit"
  | "export"
  | "unknown"
  | SubagentTaskPurpose;

export interface KnowledgeDependency {
  packId: string;
  version?: string;
  optional?: boolean;
  reason?: string;
}

export interface KnowledgeConflict {
  packId: string;
  reason: string;
}

export interface KnowledgeSnippet {
  id: string;
  title: string;
  summary?: string;
  content: string;
  keywords: string[];
  hash?: string;
  tokenEstimate?: number;
  sourceHeading?: string;
}

export interface KnowledgePack {
  id: string;
  version: string;
  hash: string;
  path: string;
  type: KnowledgePackType;
  category: KnowledgePackCategory;
  title: string;
  summary: string;
  tags: string[];
  applicableTaskPurposes: KnowledgeTaskPurpose[];
  applicableProviderSlots: ProviderSlot[];
  dependencies: KnowledgeDependency[];
  conflicts: KnowledgeConflict[];
  maxInjectionTokens: number;
  trustLevel: KnowledgePackTrustLevel;
  verificationStatus?: KnowledgeVerificationStatus;
  verificationReportId?: string;
  conflictAcknowledged?: boolean;
  enabled: boolean;
  defaultEnabled: boolean;
  createdAt: string;
  updatedAt: string;
  sourcePath?: string;
  snippets: KnowledgeSnippet[];
}

export interface KnowledgePackManifest {
  schemaVersion: string;
  manifestVersion: string;
  generatedAt: string;
  knowledgeLibraryRoot: string;
  manifestHash: string;
  packs: KnowledgePack[];
}

export interface KnowledgeRouteMatch {
  packId: string;
  version: string;
  hash: string;
  category: KnowledgePackCategory;
  reason: string;
  consumer: KnowledgePackConsumer;
  score: number;
  matchedTerms: string[];
  matchedSnippetIds: string[];
}

export interface KnowledgeRouteResult {
  routeId: string;
  taskId?: string;
  taskPurpose: KnowledgeTaskPurpose;
  providerSlot?: ProviderSlot;
  contextLevel: ContextLevel;
  inputHash: string;
  matches: KnowledgeRouteMatch[];
  injectedKnowledgePacks?: KnowledgeInjectionRecord[];
  injectedKnowledgeSnippetIds?: string[];
  notInjected?: Array<{ packId: string; reason: string }>;
  warnings: string[];
  createdAt: string;
}

export interface KnowledgeInjectedSnippet {
  packId: string;
  snippetId: string;
  title: string;
  content: string;
  tokenEstimate: number;
  hash?: string;
}

export interface KnowledgeInjectionRecord {
  packId: string;
  version: string;
  hash: string;
  category: KnowledgePackCategory;
  reason: string;
  consumer: KnowledgePackConsumer;
  injectedSnippetIds: string[];
  summaryHash: string;
  truncated: boolean;
  truncationReason?: string;
}

export interface ContextBudgetResult {
  budgetId: string;
  routeId: string;
  contextLevel: ContextLevel;
  maxInjectionTokens: number;
  usedTokens: number;
  injectedKnowledgePacks: KnowledgeInjectionRecord[];
  injectedSnippets: KnowledgeInjectedSnippet[];
  warnings: string[];
  createdAt: string;
}

export interface KnowledgeImportReport {
  schemaVersion: string;
  sourceRoot: string;
  targetRoot: string;
  manifestPath: string;
  importedPackCount: number;
  skippedFiles: string[];
  warnings: string[];
  manifestHash: string;
  generatedAt: string;
}

export interface KnowledgePackTestCase {
  id: string;
  userIntent: string;
  taskPurpose: KnowledgeTaskPurpose;
  providerSlot?: ProviderSlot;
  expectedPackIds: string[];
  forbiddenPackIds: string[];
}

export interface KnowledgeDependencyReport {
  packId: string;
  missingDependencies: KnowledgeDependency[];
  conflicts: KnowledgeConflict[];
  warnings: string[];
}
