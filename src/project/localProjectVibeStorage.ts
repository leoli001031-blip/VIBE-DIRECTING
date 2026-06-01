import { access, mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";

import {
  applyProjectVibeTransaction,
  hashProjectVibeFacts,
  isPortableProjectPath,
  openProjectVibe,
  saveProjectVibe,
  type ProjectVibePatchResult,
} from "./projectVibe";
import {
  projectVibeFileName,
  type ProjectVibeDocument,
  type ProjectVibeOpenResult,
  type ProjectVibeRunReceipt,
  type ProjectVibeSaveResult,
  type ProjectVibeStorageAdapter,
  type ProjectVibeTransaction,
} from "./types";

export interface LocalProjectVibeWorkspace {
  projectRoot: string;
  projectPath: string;
  projectFilePath: string;
  adapter: ProjectVibeStorageAdapter;
}

export interface AppendLocalProjectVibeRunReceiptInput {
  projectRoot: string;
  projectPath?: string;
  run: ProjectVibeRunReceipt;
  transaction: Pick<ProjectVibeTransaction, "id" | "actor" | "reason" | "createdAt">;
}

export interface AppendLocalProjectVibeRunReceiptResult {
  ok: boolean;
  workspace: LocalProjectVibeWorkspace;
  openResult: ProjectVibeOpenResult;
  patchResult?: ProjectVibePatchResult;
  saveResult?: ProjectVibeSaveResult;
  factHashBefore?: string;
  factHashAfter?: string;
  errors: string[];
}

export function createLocalProjectVibeWorkspace(
  projectRoot: string,
  projectPath = projectVibeFileName,
): LocalProjectVibeWorkspace {
  const resolvedRoot = resolve(projectRoot);
  const normalizedProjectPath = normalizeProjectRelativePath(projectPath);
  return {
    projectRoot: resolvedRoot,
    projectPath: normalizedProjectPath,
    projectFilePath: resolveProjectScopedPath(resolvedRoot, normalizedProjectPath),
    adapter: createLocalProjectVibeStorageAdapter(resolvedRoot),
  };
}

export function createLocalProjectVibeStorageAdapter(projectRoot: string): ProjectVibeStorageAdapter {
  const resolvedRoot = resolve(projectRoot);

  return {
    async mkdir(path: string): Promise<void> {
      await mkdir(resolveProjectScopedPath(resolvedRoot, path), { recursive: true });
    },
    async existsFile(path: string): Promise<boolean> {
      try {
        await access(resolveProjectScopedPath(resolvedRoot, path));
        return true;
      } catch {
        return false;
      }
    },
    async readFile(path: string): Promise<string> {
      return readFile(resolveProjectScopedPath(resolvedRoot, path), "utf8");
    },
    async writeFile(path: string, content: string): Promise<void> {
      const targetPath = resolveProjectScopedPath(resolvedRoot, path);
      await atomicWriteFile(targetPath, content);
    },
    async writeFileAtomic(path: string, content: string): Promise<void> {
      const targetPath = resolveProjectScopedPath(resolvedRoot, path);
      await atomicWriteFile(targetPath, content);
    },
  };
}

export async function openLocalProjectVibe(
  projectRoot: string,
  projectPath = projectVibeFileName,
): Promise<ProjectVibeOpenResult> {
  const workspace = createLocalProjectVibeWorkspace(projectRoot, projectPath);
  return openProjectVibe(workspace.adapter, workspace.projectPath);
}

export async function saveLocalProjectVibe(
  projectRoot: string,
  project: ProjectVibeDocument,
  projectPath = projectVibeFileName,
): Promise<ProjectVibeSaveResult> {
  const workspace = createLocalProjectVibeWorkspace(projectRoot, projectPath);
  return saveProjectVibe(workspace.adapter, project, workspace.projectPath);
}

export async function appendLocalProjectVibeRunReceipt(
  input: AppendLocalProjectVibeRunReceiptInput,
): Promise<AppendLocalProjectVibeRunReceiptResult> {
  const workspace = createLocalProjectVibeWorkspace(input.projectRoot, input.projectPath);
  const openResult = await openProjectVibe(workspace.adapter, workspace.projectPath);
  if (!openResult.ok || !openResult.project) {
    return { ok: false, workspace, openResult, errors: openResult.errors };
  }

  const factHashBefore = hashProjectVibeFacts(openResult.project);
  const patchResult = applyProjectVibeTransaction(openResult.project, {
    ...input.transaction,
    operations: [{ op: "append_run_receipt", run: input.run }],
  });

  if (patchResult.receipt.status !== "applied") {
    return {
      ok: false,
      workspace,
      openResult,
      patchResult,
      factHashBefore,
      errors: patchResult.receipt.errors,
    };
  }

  const saveResult = await saveProjectVibe(workspace.adapter, patchResult.project, workspace.projectPath);
  return {
    ok: saveResult.ok,
    workspace,
    openResult,
    patchResult,
    saveResult,
    factHashBefore,
    factHashAfter: saveResult.factHash,
    errors: saveResult.errors,
  };
}

export function resolveLocalProjectVibeFilePath(projectRoot: string, projectPath = projectVibeFileName): string {
  return createLocalProjectVibeWorkspace(projectRoot, projectPath).projectFilePath;
}

function resolveProjectScopedPath(projectRoot: string, path: string): string {
  const normalizedPath = normalizeProjectRelativePath(path);
  const targetPath = resolve(projectRoot, normalizedPath);
  const scopedRelativePath = relative(projectRoot, targetPath);
  if (scopedRelativePath === "" || scopedRelativePath.startsWith("..") || isAbsolute(scopedRelativePath)) {
    throw new Error(`Project.vibe local path must stay inside project root: ${path}`);
  }
  return targetPath;
}

function normalizeProjectRelativePath(path: string): string {
  const normalizedPath = path.trim().replace(/\\/g, "/");
  if (!normalizedPath || normalizedPath.endsWith("/") || !isPortableProjectPath(normalizedPath)) {
    throw new Error(`Project.vibe local path must be project-root-relative and portable: ${path}`);
  }
  return normalizedPath;
}

async function atomicWriteFile(targetPath: string, content: string): Promise<void> {
  await mkdir(dirname(targetPath), { recursive: true });
  const tempPath = `${targetPath}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  try {
    await writeFile(tempPath, content, "utf8");
    await rename(tempPath, targetPath);
  } catch (error) {
    try {
      await unlink(tempPath);
    } catch {
      // Best effort cleanup; the original target is left untouched if rename fails.
    }
    throw error;
  }
}
