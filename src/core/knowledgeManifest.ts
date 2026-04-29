import type {
  KnowledgeDependencyReport,
  KnowledgePack,
  KnowledgePackManifest,
  KnowledgePackTestCase,
  KnowledgeSnippet,
} from "./knowledgeTypes";

export const knowledgeSchemaVersion = "0.1.0";

export function estimateKnowledgeTokens(value: string): number {
  return Math.max(1, Math.ceil(value.length / 4));
}

export function stableKnowledgeHash(value: string): string {
  let hash = 0x811c9dc5;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return `vck_${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) => left.localeCompare(right));
}

function normalizeSnippet(snippet: KnowledgeSnippet, index: number): KnowledgeSnippet {
  const content = snippet.content.trim();
  const title = snippet.title.trim() || `Snippet ${index + 1}`;

  return {
    ...snippet,
    id: snippet.id.trim() || `snippet-${index + 1}`,
    title,
    content,
    keywords: uniqueSorted(snippet.keywords || []),
    hash: snippet.hash || stableKnowledgeHash(`${title}\n${content}`),
    tokenEstimate: snippet.tokenEstimate || estimateKnowledgeTokens(content),
  };
}

export function normalizeKnowledgePack(pack: KnowledgePack): KnowledgePack {
  const snippets = (pack.snippets || []).map(normalizeSnippet);

  return {
    ...pack,
    id: pack.id.trim(),
    version: pack.version.trim(),
    hash: pack.hash.trim(),
    path: pack.path.replaceAll("\\", "/"),
    title: pack.title.trim(),
    summary: pack.summary.trim(),
    tags: uniqueSorted(pack.tags || []),
    applicableTaskPurposes: uniqueSorted(pack.applicableTaskPurposes || []) as KnowledgePack["applicableTaskPurposes"],
    applicableProviderSlots: uniqueSorted(pack.applicableProviderSlots || []) as KnowledgePack["applicableProviderSlots"],
    dependencies: pack.dependencies || [],
    conflicts: pack.conflicts || [],
    maxInjectionTokens: Math.max(1, Math.floor(pack.maxInjectionTokens || 600)),
    snippets,
  };
}

export function normalizeKnowledgeManifest(manifest: KnowledgePackManifest): KnowledgePackManifest {
  const packs = [...(manifest.packs || [])]
    .map(normalizeKnowledgePack)
    .sort((left, right) => left.id.localeCompare(right.id));

  return {
    ...manifest,
    schemaVersion: manifest.schemaVersion || knowledgeSchemaVersion,
    knowledgeLibraryRoot: manifest.knowledgeLibraryRoot.replaceAll("\\", "/"),
    packs,
  };
}

export function validateKnowledgePack(pack: KnowledgePack): string[] {
  const issues: string[] = [];

  if (!pack.id) issues.push("id is required");
  if (!pack.version) issues.push(`${pack.id || "pack"} version is required`);
  if (!pack.hash) issues.push(`${pack.id || "pack"} hash is required`);
  if (!pack.path) issues.push(`${pack.id || "pack"} path is required`);
  if (!pack.title) issues.push(`${pack.id || "pack"} title is required`);
  if (!pack.summary) issues.push(`${pack.id || "pack"} summary is required`);
  if (!pack.maxInjectionTokens || pack.maxInjectionTokens < 1) {
    issues.push(`${pack.id || "pack"} maxInjectionTokens must be positive`);
  }

  return issues;
}

export function validateKnowledgeManifest(manifest: KnowledgePackManifest): string[] {
  const normalized = normalizeKnowledgeManifest(manifest);
  const issues = normalized.packs.flatMap(validateKnowledgePack);
  const seen = new Set<string>();

  for (const pack of normalized.packs) {
    if (seen.has(pack.id)) issues.push(`duplicate pack id: ${pack.id}`);
    seen.add(pack.id);
  }

  return issues;
}

export function buildKnowledgeDependencyReport(
  pack: KnowledgePack,
  packs: KnowledgePack[],
): KnowledgeDependencyReport {
  const packIds = new Set(packs.map((item) => item.id));

  return {
    packId: pack.id,
    missingDependencies: pack.dependencies.filter((dependency) => !dependency.optional && !packIds.has(dependency.packId)),
    conflicts: pack.conflicts.filter((conflict) => packIds.has(conflict.packId)),
    warnings: [],
  };
}

export function makeKnowledgePackTestCase(input: KnowledgePackTestCase): KnowledgePackTestCase {
  return {
    ...input,
    expectedPackIds: uniqueSorted(input.expectedPackIds),
    forbiddenPackIds: uniqueSorted(input.forbiddenPackIds),
  };
}
