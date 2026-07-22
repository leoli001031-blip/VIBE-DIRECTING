import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const browserDraftStorageKeyPrefix = "vibe-director:project-vibe:browser-draft";

export type BrowserDraftRecoveryPointers = {
  activeStorageKey?: string;
  pendingIntakeStorageKey?: string;
};

export type BrowserDraftRecoveryPointerKind = "active_project" | "pending_intake";

export function createBrowserDraftProfileStore(input: { userDataRoot: string }) {
  const root = path.join(path.resolve(input.userDataRoot), "browser-drafts");
  const statePath = path.join(root, "state.json");

  function bootstrap(): BrowserDraftRecoveryPointers {
    ensureDirectory(root);
    if (!fs.existsSync(statePath)) return {};
    assertRegularFile(statePath);
    try {
      const parsed = JSON.parse(fs.readFileSync(statePath, "utf8")) as BrowserDraftRecoveryPointers;
      return {
        activeStorageKey: validStorageKey(parsed.activeStorageKey),
        pendingIntakeStorageKey: validStorageKey(parsed.pendingIntakeStorageKey),
      };
    } catch {
      return {};
    }
  }

  function fileExists(storageKey: string, relativePath: string) {
    const filePath = draftFilePath(root, storageKey, relativePath, false);
    if (!fs.existsSync(filePath)) return false;
    assertRegularFile(filePath);
    return true;
  }

  function readFile(storageKey: string, relativePath: string) {
    const filePath = draftFilePath(root, storageKey, relativePath, false);
    assertRegularFile(filePath);
    return { content: fs.readFileSync(filePath, "utf8"), path: portablePath(relativePath) };
  }

  function writeFile(storageKey: string, relativePath: string, content: string) {
    if (typeof content !== "string") throw new Error("Browser draft content must be text.");
    const filePath = draftFilePath(root, storageKey, relativePath, true);
    writeTextAtomic(filePath, content);
    return { written: true, path: portablePath(relativePath) };
  }

  function deleteFile(storageKey: string, relativePath: string) {
    const filePath = draftFilePath(root, storageKey, relativePath, false);
    if (!fs.existsSync(filePath)) return { deleted: false, path: portablePath(relativePath) };
    assertRegularFile(filePath);
    fs.unlinkSync(filePath);
    return { deleted: true, path: portablePath(relativePath) };
  }

  function forget(storageKey: string) {
    const directory = draftDirectory(root, storageKey, false);
    if (!fs.existsSync(directory)) return { forgotten: false };
    assertDirectory(directory);
    fs.rmSync(directory, { recursive: true, force: true });
    return { forgotten: true };
  }

  function rememberPointer(kind: BrowserDraftRecoveryPointerKind, storageKey?: string) {
    const current = bootstrap();
    const next: BrowserDraftRecoveryPointers = { ...current };
    const key = storageKey ? requireStorageKey(storageKey) : undefined;
    if (kind === "active_project") next.activeStorageKey = key;
    else next.pendingIntakeStorageKey = key;
    writeTextAtomic(statePath, `${JSON.stringify(next, null, 2)}\n`);
    return next;
  }

  return {
    bootstrap,
    fileExists,
    readFile,
    writeFile,
    deleteFile,
    forget,
    rememberPointer,
  };
}

function draftFilePath(root: string, storageKey: string, relativePath: string, createParents: boolean) {
  const directory = draftDirectory(root, storageKey, createParents);
  const portable = portablePath(relativePath);
  const filePath = path.resolve(directory, ...portable.split("/"));
  if (!pathInside(directory, filePath)) throw new Error("Browser draft path escapes its profile directory.");
  const parent = path.dirname(filePath);
  if (createParents) ensureDirectory(parent, directory);
  else assertExistingAncestorsAreSafe(parent, directory);
  return filePath;
}

function draftDirectory(root: string, storageKey: string, create: boolean) {
  ensureDirectory(root);
  const directory = path.join(root, crypto.createHash("sha256").update(requireStorageKey(storageKey)).digest("hex"));
  if (create) ensureDirectory(directory, root);
  else assertExistingAncestorsAreSafe(directory, root);
  return directory;
}

function portablePath(value: string) {
  if (typeof value !== "string" || !value.trim() || value.includes("\0")) {
    throw new Error("Browser draft path is required.");
  }
  const normalized = path.posix.normalize(value.trim().replace(/\\/g, "/"));
  if (
    normalized === "."
    || normalized.startsWith("../")
    || path.posix.isAbsolute(normalized)
    || normalized.length > 512
  ) {
    throw new Error("Browser draft path must stay profile-relative.");
  }
  return normalized;
}

function validStorageKey(value?: string) {
  try {
    return value ? requireStorageKey(value) : undefined;
  } catch {
    return undefined;
  }
}

function requireStorageKey(value: string) {
  const key = typeof value === "string" ? value.trim() : "";
  if (
    !key.startsWith(`${browserDraftStorageKeyPrefix}:`)
    || key === `${browserDraftStorageKeyPrefix}:active`
    || key === `${browserDraftStorageKeyPrefix}:pending-intake`
    || key.length > 512
    || /[\r\n\0]/.test(key)
  ) {
    throw new Error("Invalid browser draft storage key.");
  }
  return key;
}

function ensureDirectory(directory: string, boundary = path.dirname(directory)) {
  const absoluteBoundary = path.resolve(boundary);
  const absoluteDirectory = path.resolve(directory);
  if (!pathInside(absoluteBoundary, absoluteDirectory)) throw new Error("Browser draft directory escapes its boundary.");
  const relative = path.relative(absoluteBoundary, absoluteDirectory);
  let cursor = absoluteBoundary;
  if (fs.existsSync(cursor)) assertDirectory(cursor);
  else fs.mkdirSync(cursor, { recursive: true, mode: 0o700 });
  for (const segment of relative.split(path.sep).filter(Boolean)) {
    cursor = path.join(cursor, segment);
    if (fs.existsSync(cursor)) assertDirectory(cursor);
    else fs.mkdirSync(cursor, { mode: 0o700 });
  }
}

function assertExistingAncestorsAreSafe(target: string, boundary: string) {
  const absoluteBoundary = path.resolve(boundary);
  const absoluteTarget = path.resolve(target);
  if (!pathInside(absoluteBoundary, absoluteTarget)) throw new Error("Browser draft path escapes its boundary.");
  let cursor = absoluteBoundary;
  if (fs.existsSync(cursor)) assertDirectory(cursor);
  for (const segment of path.relative(absoluteBoundary, absoluteTarget).split(path.sep).filter(Boolean)) {
    cursor = path.join(cursor, segment);
    if (!fs.existsSync(cursor)) return;
    assertDirectory(cursor);
  }
}

function assertDirectory(target: string) {
  const stat = fs.lstatSync(target);
  if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error("Browser draft storage contains an unsafe directory.");
}

function assertRegularFile(target: string) {
  const stat = fs.lstatSync(target);
  if (stat.isSymbolicLink() || !stat.isFile()) throw new Error("Browser draft storage contains an unsafe file.");
}

function writeTextAtomic(target: string, content: string) {
  ensureDirectory(path.dirname(target));
  if (fs.existsSync(target)) assertRegularFile(target);
  const temporary = `${target}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(temporary, content, { encoding: "utf8", mode: 0o600 });
  fs.renameSync(temporary, target);
}

function pathInside(root: string, target: string) {
  const relative = path.relative(path.resolve(root), path.resolve(target));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}
