export interface SchemaRegistryEntry {
  fileName: string;
  id: string;
  version: string;
  purpose: string;
  typeName: string;
}

export const schemaVersion = "0.1.0";

export const schemaRegistry: SchemaRegistryEntry[] = [
  {
    fileName: "common.schema.json",
    id: "https://vibecore.local/schemas/common.schema.json",
    version: schemaVersion,
    purpose: "Shared enums and reusable schema definitions.",
    typeName: "CommonSchemaDefinitions",
  },
  {
    fileName: "project_source_index.schema.json",
    id: "https://vibecore.local/schemas/project_source_index.schema.json",
    version: schemaVersion,
    purpose: "Project-local current-facts index used before old chats or historical folders.",
    typeName: "ProjectSourceIndex",
  },
  {
    fileName: "knowledge_pack.schema.json",
    id: "https://vibecore.local/schemas/knowledge_pack.schema.json",
    version: schemaVersion,
    purpose: "Versioned and hash-locked knowledge pack metadata and snippets.",
    typeName: "KnowledgePack",
  },
  {
    fileName: "knowledge_pack_manifest.schema.json",
    id: "https://vibecore.local/schemas/knowledge_pack_manifest.schema.json",
    version: schemaVersion,
    purpose: "Knowledge library manifest for imported, built-in, user, and project packs.",
    typeName: "KnowledgePackManifest",
  },
  {
    fileName: "knowledge_route_result.schema.json",
    id: "https://vibecore.local/schemas/knowledge_route_result.schema.json",
    version: schemaVersion,
    purpose: "Deterministic knowledge routing result for task context injection.",
    typeName: "KnowledgeRouteResult",
  },
  {
    fileName: "context_budget.schema.json",
    id: "https://vibecore.local/schemas/context_budget.schema.json",
    version: schemaVersion,
    purpose: "Bounded knowledge snippet selection produced from a route result.",
    typeName: "ContextBudgetResult",
  },
  {
    fileName: "knowledge_import_report.schema.json",
    id: "https://vibecore.local/schemas/knowledge_import_report.schema.json",
    version: schemaVersion,
    purpose: "Report produced by the knowledge library import script.",
    typeName: "KnowledgeImportReport",
  },
  {
    fileName: "knowledge_pack_test_case.schema.json",
    id: "https://vibecore.local/schemas/knowledge_pack_test_case.schema.json",
    version: schemaVersion,
    purpose: "Deterministic router test case for knowledge pack routing.",
    typeName: "KnowledgePackTestCase",
  },
  {
    fileName: "knowledge_dependency_report.schema.json",
    id: "https://vibecore.local/schemas/knowledge_dependency_report.schema.json",
    version: schemaVersion,
    purpose: "Knowledge pack dependency and conflict report.",
    typeName: "KnowledgeDependencyReport",
  },
  {
    fileName: "reference_authority.schema.json",
    id: "https://vibecore.local/schemas/reference_authority.schema.json",
    version: schemaVersion,
    purpose: "Reference role, polarity, lock status, allowed use, and future-reference safety.",
    typeName: "ReferenceAuthority",
  },
  {
    fileName: "preflight_report.schema.json",
    id: "https://vibecore.local/schemas/preflight_report.schema.json",
    version: schemaVersion,
    purpose: "Hard gate report required before queue ready_to_submit.",
    typeName: "PreflightReport",
  },
  {
    fileName: "task_envelope.schema.json",
    id: "https://vibecore.local/schemas/task_envelope.schema.json",
    version: schemaVersion,
    purpose: "Provider or worker execution contract with mandatory preflight.",
    typeName: "TaskEnvelope",
  },
  {
    fileName: "subagent_task_envelope.schema.json",
    id: "https://vibecore.local/schemas/subagent_task_envelope.schema.json",
    version: schemaVersion,
    purpose: "Standardized subagent context packet replacing ad hoc task instructions.",
    typeName: "SubagentTaskEnvelope",
  },
  {
    fileName: "subagent_result.schema.json",
    id: "https://vibecore.local/schemas/subagent_result.schema.json",
    version: schemaVersion,
    purpose: "Machine-readable formal subagent result contract.",
    typeName: "SubagentResult",
  },
  {
    fileName: "keyframe_pair_derivation.schema.json",
    id: "https://vibecore.local/schemas/keyframe_pair_derivation.schema.json",
    version: schemaVersion,
    purpose: "Start/end frame derivation proof before formal I2V submission.",
    typeName: "KeyframePairDerivation",
  },
  {
    fileName: "task_run.schema.json",
    id: "https://vibecore.local/schemas/task_run.schema.json",
    version: schemaVersion,
    purpose: "Local queue and provider task runtime state.",
    typeName: "TaskRun",
  },
  {
    fileName: "manifest_matcher.schema.json",
    id: "https://vibecore.local/schemas/manifest_matcher.schema.json",
    version: schemaVersion,
    purpose: "Deterministic expected-output, hash, derivative, and QA coverage report.",
    typeName: "ManifestMatcherReport",
  },
  {
    fileName: "story_change_transaction.schema.json",
    id: "https://vibecore.local/schemas/story_change_transaction.schema.json",
    version: schemaVersion,
    purpose: "Structured transaction before natural-language edits mutate story or assets.",
    typeName: "StoryChangeTransaction",
  },
  {
    fileName: "preview_event.schema.json",
    id: "https://vibecore.local/schemas/preview_event.schema.json",
    version: schemaVersion,
    purpose: "Draft and formal preview timeline event contract.",
    typeName: "PreviewEvent",
  },
];

export function findSchemaByType(typeName: string): SchemaRegistryEntry | undefined {
  return schemaRegistry.find((entry) => entry.typeName === typeName);
}

export function findSchemaByFileName(fileName: string): SchemaRegistryEntry | undefined {
  return schemaRegistry.find((entry) => entry.fileName === fileName);
}
