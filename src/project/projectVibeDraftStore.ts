import type { ElectronBridge } from "../core/electronBridge";
import {
  hashProjectVibeFacts,
  isPortableProjectPath,
  openProjectVibe,
  refreshProjectVibeSourceIndex,
  saveProjectVibe,
} from "./projectVibe";
import {
  projectVibeFileName,
  type ProjectVibeAsset,
  type ProjectVibeAssetKind,
  type ProjectVibeAssetStatus,
  type ProjectVibeDocument,
  type ProjectVibeOpenResult,
  type ProjectVibeReferenceRoleBinding,
  type ProjectVibeSaveResult,
  type ProjectVibeStorageAdapter,
} from "./types";

export type ProjectVibeDraftStorageMode = "electron_project_file" | "browser_local";

export interface ProjectVibeDraftTarget {
  projectRoot?: string;
  projectPath?: string;
  storageKey?: string;
}

export interface ProjectVibeDraftOpenResult extends ProjectVibeOpenResult {
  status: "restored" | "missing" | "unavailable" | "error";
  mode?: ProjectVibeDraftStorageMode;
  targetId: string;
  factHash?: string;
  sidecarVisualMemoryMerged?: boolean;
}

export interface ProjectVibeDraftSaveResult extends ProjectVibeSaveResult {
  status: "saved" | "unavailable" | "error";
  mode?: ProjectVibeDraftStorageMode;
  targetId: string;
}

type BrowserStorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function projectVibeDraftTargetId(target: ProjectVibeDraftTarget = {}): string {
  if (target.projectRoot && electronBridge()) {
    return `project-file:${normalizeProjectRootForDisplay(target.projectRoot)}/${projectPathForTarget(target)}`;
  }
  return `browser-draft:${browserStorageKey(target)}`;
}

export async function openProjectVibeDraft(target: ProjectVibeDraftTarget = {}): Promise<ProjectVibeDraftOpenResult> {
  const adapter = createProjectVibeDraftStorageAdapter(target);
  const targetId = projectVibeDraftTargetId(target);
  if (!adapter) {
    return { ok: false, status: "unavailable", targetId, errors: ["Project.vibe draft storage is unavailable."] };
  }

  try {
    const result = await openProjectVibe(adapter.adapter, projectPathForTarget(target));
    const sidecarVisualMemory = result.project
      ? await readProjectSidecarVisualMemory(adapter.adapter, projectPathForTarget(target))
      : undefined;
    const mergedProject = result.project && sidecarVisualMemory
      ? mergeProjectVibeWithSidecarVisualMemory(result.project, sidecarVisualMemory, target)
      : result.project;
    return {
      ...result,
      project: mergedProject,
      status: result.ok && result.project ? "restored" : "error",
      mode: adapter.mode,
      targetId,
      factHash: mergedProject ? hashProjectVibeFacts(mergedProject) : undefined,
      sidecarVisualMemoryMerged: Boolean(mergedProject && mergedProject !== result.project),
    };
  } catch (error) {
    return {
      ok: false,
      status: isMissingStorageError(error) ? "missing" : "error",
      mode: adapter.mode,
      targetId,
      errors: [error instanceof Error ? error.message : String(error)],
    };
  }
}

export function forgetBrowserProjectVibeDraft(target: ProjectVibeDraftTarget = {}): boolean {
  const bridge = electronBridge();
  if (target.projectRoot && bridge) return false;
  const storage = browserStorage();
  if (!storage) return false;
  storage.removeItem(browserStorageKey(target));
  return true;
}

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function textValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function firstTextValue(source: unknown, keys: string[]): string | undefined {
  if (!isRecord(source)) return undefined;
  for (const key of keys) {
    const value = textValue(source[key]);
    if (value) return value;
  }
  return undefined;
}

function textArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).map((item) => item.trim())));
}

function normalizeSidecarStatus(value?: string): ProjectVibeAssetStatus {
  const normalized = (value || "").toLowerCase();
  if (normalized.includes("locked")) return "locked";
  if (normalized.includes("candidate")) return "candidate";
  if (normalized.includes("reject")) return "rejected";
  if (normalized.includes("missing") || normalized.includes("not_generated")) return "missing";
  return "needs_review";
}

function sidecarKindFromValue(item: JsonRecord, fallback: ProjectVibeAssetKind): ProjectVibeAssetKind {
  const raw = [
    firstTextValue(item, ["kind"]),
    firstTextValue(item, ["assetType"]),
    firstTextValue(item, ["type"]),
    firstTextValue(item, ["role"]),
  ].filter(Boolean).join(" ").toLowerCase();
  if (/storyboard|分镜|故事板|reference/.test(raw)) return "reference";
  if (/character|role|人物|角色/.test(raw)) return "character";
  if (/scene|location|weather|场景|天气|空间/.test(raw)) return "scene";
  if (/prop|object|道具|物件/.test(raw)) return "prop";
  if (/style|look|风格/.test(raw)) return "style";
  return fallback;
}

function projectRelativeSidecarPath(value: string | undefined, projectRoot?: string) {
  const cleaned = value?.trim().replace(/\\/g, "/");
  if (!cleaned) return undefined;
  const root = projectRoot?.trim().replace(/\\/g, "/").replace(/\/+$/, "");
  const relative = root && cleaned.startsWith(`${root}/`) ? cleaned.slice(root.length + 1) : cleaned.replace(/^\/+/, "");
  return isPortableProjectPath(relative) ? relative : undefined;
}

function sidecarRoleBinding(kind: ProjectVibeAssetKind): ProjectVibeReferenceRoleBinding | undefined {
  if (kind === "reference") {
    return {
      role: "storyboard_reference",
      useFor: ["composition", "blocking", "camera", "timing"],
      ignoreFor: ["character_identity", "scene_weather", "prop_design"],
      priority: 1,
      conflictRule: "Storyboards guide motion and layout only; locked character, scene, and prop references remain authoritative.",
    };
  }
  return undefined;
}

function sidecarAssetFromRecord(
  item: unknown,
  fallbackKind: ProjectVibeAssetKind,
  index: number,
  sourceRef: string,
  projectRoot?: string,
): ProjectVibeAsset | undefined {
  if (!isRecord(item)) return undefined;
  const kind = sidecarKindFromValue(item, fallbackKind);
  const id = firstTextValue(item, ["id", "assetId", "roleId", "sceneId", "styleId"]) || `${kind}_${index + 1}`;
  const authority = isRecord(item.referenceAuthority) ? item.referenceAuthority : undefined;
  const path = projectRelativeSidecarPath(
    firstTextValue(item, ["mainReferencePath", "path", "sourcePath", "referencePath"])
      || firstTextValue(authority, ["path"]),
    projectRoot,
  );
  const status = normalizeSidecarStatus(
    firstTextValue(authority, ["lockedStatus"])
      || firstTextValue(item, ["lockedStatus", "visualMemoryStatus", "status"]),
  );
  const label = firstTextValue(item, ["displayName", "name", "title", "label"]) || id;
  const textConstraints = Array.from(new Set([
    ...textArray(item.textConstraints),
    ...textArray(item.mustPreserve),
    ...textArray(item.spatialAnchors),
    firstTextValue(item, ["description", "positive"]),
    ...textArray(item.mustAvoid).map((value) => `避免 ${value}`),
    firstTextValue(item, ["negative"]) ? `避免 ${firstTextValue(item, ["negative"])}` : undefined,
    label,
  ].filter((value): value is string => Boolean(value?.trim()))));
  return {
    id,
    kind,
    label,
    status,
    path,
    textConstraints,
    usedByShotIds: textArray(item.usedByShotIds),
    sourceRefs: [sourceRef],
    lockedBy: status === "locked" ? "user" : undefined,
    roleBinding: sidecarRoleBinding(kind),
  };
}

function sidecarAssetsFromVisualMemory(visualMemory: unknown, projectRoot?: string): ProjectVibeAsset[] {
  if (!isRecord(visualMemory)) return [];
  const assets: ProjectVibeAsset[] = [];
  for (const [key, kind] of [
    ["roles", "character"],
    ["characters", "character"],
    ["scenes", "scene"],
    ["props", "prop"],
    ["styles", "style"],
  ] as Array<[string, ProjectVibeAssetKind]>) {
    const items = Array.isArray(visualMemory[key]) ? visualMemory[key] : [];
    items.forEach((item, index) => {
      const asset = sidecarAssetFromRecord(item, kind, index, `project/visual_memory.json#${key}/${index}`, projectRoot);
      if (asset) assets.push(asset);
    });
  }
  if (isRecord(visualMemory.style)) {
    const asset = sidecarAssetFromRecord(visualMemory.style, "style", 0, "project/visual_memory.json#style", projectRoot);
    if (asset) assets.push(asset);
  }
  const genericAssets = Array.isArray(visualMemory.assets) ? visualMemory.assets : [];
  genericAssets.forEach((item, index) => {
    const asset = sidecarAssetFromRecord(item, "reference", index, `project/visual_memory.json#assets/${index}`, projectRoot);
    if (asset) assets.push(asset);
  });
  const seen = new Set<string>();
  return assets.filter((asset) => {
    if (seen.has(asset.id)) return false;
    seen.add(asset.id);
    return true;
  });
}

function withAssetId(values: string[], assetId: string) {
  return values.includes(assetId) ? values : [...values, assetId];
}

export function mergeProjectVibeWithSidecarVisualMemory(
  project: ProjectVibeDocument,
  sidecarVisualMemory: unknown,
  target: ProjectVibeDraftTarget = {},
): ProjectVibeDocument {
  const sidecarAssets = sidecarAssetsFromVisualMemory(sidecarVisualMemory, target.projectRoot);
  if (!sidecarAssets.length) return project;
  const existingAssets = new Map(project.assets.map((asset) => [asset.id, asset]));
  const mergedAssets = [...project.assets];
  for (const asset of sidecarAssets) {
    const existing = existingAssets.get(asset.id);
    if (existing) {
      Object.assign(existing, {
        ...asset,
        textConstraints: Array.from(new Set([...existing.textConstraints, ...asset.textConstraints])),
        usedByShotIds: Array.from(new Set([...existing.usedByShotIds, ...asset.usedByShotIds])),
        sourceRefs: Array.from(new Set([...existing.sourceRefs, ...asset.sourceRefs])),
      });
    } else {
      mergedAssets.push(asset);
    }
  }

  const sidecarByShot = new Map<string, ProjectVibeAsset[]>();
  for (const asset of sidecarAssets) {
    for (const shotId of asset.usedByShotIds) {
      const list = sidecarByShot.get(shotId) || [];
      list.push(asset);
      sidecarByShot.set(shotId, list);
    }
  }
  const mergedShots = project.shots.map((shot) => {
    const linked = sidecarByShot.get(shot.id) || [];
    return linked.reduce((nextShot, asset) => {
      if (asset.kind === "character") {
        return { ...nextShot, characterAssetIds: withAssetId(nextShot.characterAssetIds, asset.id) };
      }
      if (asset.kind === "scene") {
        return { ...nextShot, sceneAssetIds: withAssetId(nextShot.sceneAssetIds, asset.id) };
      }
      if (asset.kind === "prop") {
        return { ...nextShot, propAssetIds: withAssetId(nextShot.propAssetIds, asset.id) };
      }
      return nextShot;
    }, shot);
  });
  const existingEntryAssetIds = new Set(project.visualMemory.entries.map((entry) => entry.assetId));
  const sidecarEntries = sidecarAssets
    .filter((asset) => !existingEntryAssetIds.has(asset.id))
    .map((asset) => ({
      id: `vm_${asset.id}`,
      assetId: asset.id,
      kind: asset.kind,
      label: asset.label,
      status: asset.status,
      textConstraints: asset.textConstraints,
      usedByShotIds: asset.usedByShotIds,
      canUseAsFutureReference: asset.status === "locked",
      sourceRefs: asset.sourceRefs,
      roleBinding: asset.roleBinding,
    }));

  return refreshProjectVibeSourceIndex({
    ...project,
    assets: mergedAssets,
    shots: mergedShots,
    visualMemory: {
      ...project.visualMemory,
      entries: [...project.visualMemory.entries, ...sidecarEntries],
    },
  }, project.manifest.updatedAt);
}

async function readProjectSidecarVisualMemory(
  adapter: ProjectVibeStorageAdapter,
  projectPath: string,
): Promise<unknown | undefined> {
  const normalizedPath = projectPathForTarget({ projectPath });
  const base = normalizedPath.includes("/")
    ? normalizedPath.split("/").slice(0, -1).join("/")
    : "";
  const sidecarPath = `${base ? `${base}/` : ""}visual_memory.json`;
  try {
    if (adapter.existsFile && !(await adapter.existsFile(sidecarPath))) return undefined;
    const content = await adapter.readFile(sidecarPath);
    return JSON.parse(content);
  } catch {
    return undefined;
  }
}

export async function saveProjectVibeDraft(
  target: ProjectVibeDraftTarget,
  project: ProjectVibeDocument,
): Promise<ProjectVibeDraftSaveResult> {
  const adapter = createProjectVibeDraftStorageAdapter(target);
  const targetId = projectVibeDraftTargetId(target);
  if (!adapter) {
    return {
      ok: false,
      status: "unavailable",
      mode: undefined,
      targetId,
      path: projectPathForTarget(target),
      factHash: hashProjectVibeFacts(project),
      validation: {
        ok: false,
        errors: ["Project.vibe draft storage is unavailable."],
        warnings: [],
        checkedAt: new Date().toISOString(),
      },
      errors: ["Project.vibe draft storage is unavailable."],
    };
  }

  try {
    const result = await saveProjectVibe(adapter.adapter, project, projectPathForTarget(target));
    return {
      ...result,
      status: result.ok ? "saved" : "error",
      mode: adapter.mode,
      targetId,
    };
  } catch (error) {
    return {
      ok: false,
      status: "error",
      mode: adapter.mode,
      targetId,
      path: projectPathForTarget(target),
      factHash: hashProjectVibeFacts(project),
      validation: {
        ok: false,
        errors: [error instanceof Error ? error.message : String(error)],
        warnings: [],
        checkedAt: new Date().toISOString(),
      },
      errors: [error instanceof Error ? error.message : String(error)],
    };
  }
}

function createProjectVibeDraftStorageAdapter(target: ProjectVibeDraftTarget): {
  adapter: ProjectVibeStorageAdapter;
  mode: ProjectVibeDraftStorageMode;
} | undefined {
  const bridge = electronBridge();
  if (target.projectRoot && bridge) {
    return {
      mode: "electron_project_file",
      adapter: {
        async existsFile(path: string) {
          if (bridge.sandboxFileExists) {
            return (await bridge.sandboxFileExists(resolveElectronProjectFilePath(target.projectRoot!, path))).exists;
          }
          return true;
        },
        async readFile(path: string) {
          return (await bridge.sandboxReadFile(resolveElectronProjectFilePath(target.projectRoot!, path))).content;
        },
        async writeFile(path: string, content: string) {
          await bridge.sandboxWriteFile(resolveElectronProjectFilePath(target.projectRoot!, path), content);
        },
      },
    };
  }

  const storage = browserStorage();
  if (!storage) return undefined;
  return {
    mode: "browser_local",
    adapter: {
      existsFile(path: string) {
        return storage.getItem(browserStorageKey(target, path)) != null;
      },
      readFile(path: string) {
        const value = storage.getItem(browserStorageKey(target, path));
        if (value == null) throw new Error(`Project.vibe draft not found: ${browserStorageKey(target, path)}`);
        return value;
      },
      writeFile(path: string, content: string) {
        storage.setItem(browserStorageKey(target, path), content);
      },
    },
  };
}

function projectPathForTarget(target: ProjectVibeDraftTarget): string {
  const path = (target.projectPath || projectVibeFileName).trim().replace(/\\/g, "/");
  if (!isPortableProjectPath(path)) throw new Error(`Project.vibe draft path must be project-root-relative: ${target.projectPath}`);
  return path;
}

function resolveElectronProjectFilePath(projectRoot: string, projectPath: string): string {
  const root = projectRoot.trim().replace(/\\/g, "/").replace(/\/+$/, "");
  if (!root || root.includes("\n") || root.includes("\r")) {
    throw new Error("Project root is required before saving Project.vibe.");
  }
  return `${root}/${projectPathForTarget({ projectPath })}`;
}

function browserStorageKey(target: ProjectVibeDraftTarget, path = projectPathForTarget(target)): string {
  const base = target.storageKey?.trim() || "vibe-director:project-vibe:current";
  return `${base}:${path}`;
}

function electronBridge(): ElectronBridge | undefined {
  if (typeof window === "undefined") return undefined;
  return window.vibeRuntime;
}

function browserStorage(): BrowserStorageLike | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

function normalizeProjectRootForDisplay(projectRoot: string): string {
  return projectRoot.trim().replace(/\\/g, "/").replace(/\/+$/, "");
}

function isMissingStorageError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /not found|missing|no such file|ENOENT/i.test(message);
}
