import type { KnowledgePack, KnowledgePackCategory, KnowledgePackManifest } from "./knowledgeTypes";
import { normalizeKnowledgeManifest, normalizeKnowledgePack, validateKnowledgeManifest, validateKnowledgePack } from "./knowledgeManifest";
import type { ProjectSourceIndex } from "./types";

export interface KnowledgeLibrary {
  manifest: KnowledgePackManifest;
}

export interface KnowledgeLibraryValidation {
  valid: boolean;
  issues: string[];
}

export function createKnowledgeLibrary(manifest: KnowledgePackManifest): KnowledgeLibrary {
  return {
    manifest: normalizeKnowledgeManifest(manifest),
  };
}

export function validateKnowledgeLibrary(library: KnowledgeLibrary): KnowledgeLibraryValidation {
  const issues = validateKnowledgeManifest(library.manifest);

  return {
    valid: issues.length === 0,
    issues,
  };
}

export function listKnowledgePacks(library: KnowledgeLibrary, options: { enabledOnly?: boolean } = {}): KnowledgePack[] {
  return library.manifest.packs.filter((pack) => !options.enabledOnly || pack.enabled);
}

export function findKnowledgePack(library: KnowledgeLibrary, packId: string): KnowledgePack | undefined {
  return library.manifest.packs.find((pack) => pack.id === packId);
}

export function listKnowledgePacksByCategory(library: KnowledgeLibrary, category: KnowledgePackCategory): KnowledgePack[] {
  return library.manifest.packs.filter((pack) => pack.category === category);
}

export function selectAvailableKnowledgePacks(manifest: KnowledgePackManifest, sourceIndex?: ProjectSourceIndex): KnowledgePack[] {
  const normalized = normalizeKnowledgeManifest(manifest);
  const activeIds = new Set(sourceIndex?.activeKnowledgePackIds || []);
  const disabledIds = new Set(sourceIndex?.disabledKnowledgePackIds || []);
  const bindings = sourceIndex?.packVersionBindings || {};

  return normalized.packs.filter((pack) => {
    if (disabledIds.has(pack.id)) return false;
    if (activeIds.size && !activeIds.has(pack.id)) return false;
    if (!activeIds.size && !pack.enabled) return false;

    const binding = bindings[pack.id];
    if (binding && (binding.version !== pack.version || binding.hash !== pack.hash)) return false;

    return true;
  });
}

function updatePackEnabled(library: KnowledgeLibrary, packId: string, enabled: boolean): KnowledgeLibrary {
  return createKnowledgeLibrary({
    ...library.manifest,
    packs: library.manifest.packs.map((pack) => (pack.id === packId ? normalizeKnowledgePack({ ...pack, enabled }) : pack)),
  });
}

export function activateKnowledgePack(library: KnowledgeLibrary, packId: string): KnowledgeLibrary {
  return updatePackEnabled(library, packId, true);
}

export function disableKnowledgePack(library: KnowledgeLibrary, packId: string): KnowledgeLibrary {
  return updatePackEnabled(library, packId, false);
}

export function upsertKnowledgePack(library: KnowledgeLibrary, nextPack: KnowledgePack): KnowledgeLibrary {
  const pack = normalizeKnowledgePack(nextPack);
  const exists = library.manifest.packs.some((item) => item.id === pack.id);
  const packs = exists
    ? library.manifest.packs.map((item) => (item.id === pack.id ? pack : item))
    : [...library.manifest.packs, pack];

  return createKnowledgeLibrary({
    ...library.manifest,
    packs,
  });
}

export function assertKnowledgePackValid(pack: KnowledgePack): KnowledgePack {
  const issues = validateKnowledgePack(pack);

  if (issues.length) {
    throw new Error(`Invalid knowledge pack ${pack.id || "(missing id)"}: ${issues.join("; ")}`);
  }

  return normalizeKnowledgePack(pack);
}
