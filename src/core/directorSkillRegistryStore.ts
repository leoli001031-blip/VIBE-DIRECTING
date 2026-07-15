import {
  createDirectorSkillRegistry,
  DIRECTOR_SKILL_GLOBAL_REGISTRY_RELATIVE_PATH,
  parseDirectorSkillRegistry,
  serializeDirectorSkillRegistry,
  validateDirectorSkillRegistry,
  type DirectorSkillRegistry,
} from "./directorSkillRegistry";

export interface DirectorSkillRegistryStorageAdapter {
  existsFile?(path: string): Promise<boolean>;
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
}

export interface DirectorSkillRegistryStoreResult {
  ok: boolean;
  status: "restored" | "created" | "written" | "invalid" | "error";
  path: string;
  registry?: DirectorSkillRegistry;
  errors: string[];
}

export function directorSkillGlobalRegistryPath(appDataRoot: string): string {
  const root = appDataRoot.trim().replace(/\\/g, "/").replace(/\/+$/g, "");
  if (!root) throw new Error("App data root is required for the global Skill registry");
  return `${root}/${DIRECTOR_SKILL_GLOBAL_REGISTRY_RELATIVE_PATH}`;
}

export async function loadDirectorSkillGlobalRegistry(
  adapter: DirectorSkillRegistryStorageAdapter,
  appDataRoot: string,
  input: { registryId?: string; generatedAt?: string } = {},
): Promise<DirectorSkillRegistryStoreResult> {
  const path = directorSkillGlobalRegistryPath(appDataRoot);
  try {
    if (adapter.existsFile && !(await adapter.existsFile(path))) {
      return {
        ok: true,
        status: "created",
        path,
        registry: createDirectorSkillRegistry(input.registryId, input.generatedAt),
        errors: [],
      };
    }
    const content = await adapter.readFile(path);
    const parsed = parseDirectorSkillRegistry(content);
    return parsed.ok && parsed.registry
      ? { ok: true, status: "restored", path, registry: parsed.registry, errors: [] }
      : { ok: false, status: "invalid", path, registry: parsed.registry, errors: parsed.errors };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/enoent|not found|missing/i.test(message)) {
      return {
        ok: true,
        status: "created",
        path,
        registry: createDirectorSkillRegistry(input.registryId, input.generatedAt),
        errors: [],
      };
    }
    return { ok: false, status: "error", path, errors: [message] };
  }
}

export async function saveDirectorSkillGlobalRegistry(
  adapter: DirectorSkillRegistryStorageAdapter,
  appDataRoot: string,
  registry: DirectorSkillRegistry,
): Promise<DirectorSkillRegistryStoreResult> {
  const path = directorSkillGlobalRegistryPath(appDataRoot);
  const errors = validateDirectorSkillRegistry(registry);
  if (errors.length) return { ok: false, status: "invalid", path, registry, errors };
  try {
    await adapter.writeFile(path, serializeDirectorSkillRegistry(registry));
    return { ok: true, status: "written", path, registry, errors: [] };
  } catch (error) {
    return { ok: false, status: "error", path, registry, errors: [error instanceof Error ? error.message : String(error)] };
  }
}
