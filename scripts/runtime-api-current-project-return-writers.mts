import path from "node:path";

function projectVibePath(relativePath, normalizeRelativePath) {
  const normalized = normalizeRelativePath(relativePath || "");
  return path.basename(normalized) === "project.vibe" || normalized.includes("/project.vibe");
}

function atomicWriteJson(filePath, payload, writeFileSync, renameSync) {
  const tempPath = path.join(path.dirname(filePath), `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`);
  writeFileSync(tempPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  renameSync(tempPath, filePath);
}

function atomicWriteBytes(filePath, bytes, writeFileSync, renameSync) {
  const tempPath = path.join(path.dirname(filePath), `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`);
  writeFileSync(tempPath, bytes);
  renameSync(tempPath, filePath);
}

function pathInsideTextRoot(candidatePath, rootPath, normalizeRelativePath) {
  if (typeof candidatePath !== "string" || !candidatePath.trim()) return false;
  if (typeof rootPath !== "string" || !rootPath.trim()) return false;
  const normalizedPath = normalizeRelativePath(candidatePath.trim());
  const normalizedRoot = normalizeRelativePath(rootPath.trim()).replace(/\/+$/g, "");
  return normalizedPath === normalizedRoot || normalizedPath.startsWith(`${normalizedRoot}/`);
}

export function createRuntimeApiCurrentProjectReturnWriters({
  repoRootRealPath,
  scopedRepoPath,
  normalizeRelativePath,
  oneShotPathInsideRoot,
  isPathInsideRealRoot,
  existsSync,
  mkdirSync,
  writeFileSync,
  renameSync,
  realpathSync,
} = {}) {
  if (!repoRootRealPath) throw new Error("repoRootRealPath is required.");
  if (typeof scopedRepoPath !== "function") throw new Error("scopedRepoPath is required.");
  if (typeof normalizeRelativePath !== "function") throw new Error("normalizeRelativePath is required.");
  if (typeof oneShotPathInsideRoot !== "function") throw new Error("oneShotPathInsideRoot is required.");
  if (typeof isPathInsideRealRoot !== "function") throw new Error("isPathInsideRealRoot is required.");
  if (typeof existsSync !== "function") throw new Error("existsSync is required.");
  if (typeof mkdirSync !== "function") throw new Error("mkdirSync is required.");
  if (typeof writeFileSync !== "function") throw new Error("writeFileSync is required.");
  if (typeof renameSync !== "function") throw new Error("renameSync is required.");
  if (typeof realpathSync !== "function") throw new Error("realpathSync is required.");

  function oneShotExecutorPathInsideSandbox(relativePath, sandboxRoot, shotRoot) {
    return oneShotPathInsideRoot(relativePath, sandboxRoot) && oneShotPathInsideRoot(relativePath, shotRoot);
  }

  function assertOneShotExecutorSandboxWritePath(relativePath, sandboxRoot, shotRoot) {
    if (!oneShotExecutorPathInsideSandbox(relativePath, sandboxRoot, shotRoot)) {
      throw new Error(`Refusing to write outside one-shot executor sandbox: ${relativePath}`);
    }
    if (projectVibePath(relativePath, normalizeRelativePath)) {
      throw new Error(`Refusing to mutate project.vibe from executor: ${relativePath}`);
    }
    const filePath = scopedRepoPath(relativePath);
    const sandboxPath = scopedRepoPath(sandboxRoot);
    const shotPath = scopedRepoPath(shotRoot);
    mkdirSync(path.dirname(filePath), { recursive: true });
    const dirRealPath = realpathSync(path.dirname(filePath));
    const sandboxRealPath = realpathSync(sandboxPath);
    const shotRealPath = realpathSync(shotPath);
    if (!isPathInsideRealRoot(dirRealPath, sandboxRealPath)
      || !isPathInsideRealRoot(dirRealPath, shotRealPath)
      || !isPathInsideRealRoot(sandboxRealPath, repoRootRealPath)) {
      throw new Error(`Refusing to write through unsafe executor real path: ${relativePath}`);
    }
    if (existsSync(filePath)) {
      const fileRealPath = realpathSync(filePath);
      if (!isPathInsideRealRoot(fileRealPath, sandboxRealPath) || !isPathInsideRealRoot(fileRealPath, shotRealPath)) {
        throw new Error(`Refusing to overwrite unsafe executor path: ${relativePath}`);
      }
    }
    return filePath;
  }

  function writeOneShotExecutorJson(relativePath, payload, sandboxRoot, shotRoot) {
    const filePath = assertOneShotExecutorSandboxWritePath(relativePath, sandboxRoot, shotRoot);
    atomicWriteJson(filePath, payload, writeFileSync, renameSync);
  }

  function writeOneShotExecutorBytes(relativePath, bytes, sandboxRoot, shotRoot) {
    const filePath = assertOneShotExecutorSandboxWritePath(relativePath, sandboxRoot, shotRoot);
    atomicWriteBytes(filePath, bytes, writeFileSync, renameSync);
    return filePath;
  }

  function assertCurrentProjectRuntimeWritePath(relativePath, source) {
    const normalized = normalizeRelativePath(relativePath || "");
    const rootRelativePath = normalizeRelativePath(source.runRootRelativePath || "");
    const isAbsoluteTarget = path.isAbsolute(normalized);
    const prefixedProjectRelativePath = !isAbsoluteTarget && pathInsideTextRoot(normalized, rootRelativePath, normalizeRelativePath);
    if (!isAbsoluteTarget && !prefixedProjectRelativePath && (normalized.startsWith("../") || normalized.includes("/../"))) {
      throw new Error(`Refusing to write return projection outside current project root: ${relativePath}`);
    }
    if (!isAbsoluteTarget && !prefixedProjectRelativePath && !oneShotPathInsideRoot(normalized, rootRelativePath)) {
      // User-created projects can live outside the repository. For those projects,
      // short project-local paths like "assets/generated/a.png" are valid writes.
      if (!source.runRootPath || pathInsideTextRoot(normalized, "..", normalizeRelativePath)) {
        throw new Error(`Refusing to write return projection outside current project root: ${relativePath}`);
      }
    }
    if (isAbsoluteTarget && !pathInsideTextRoot(normalized, normalizeRelativePath(source.runRootPath || ""), normalizeRelativePath)) {
      throw new Error(`Refusing to write return projection outside current project root: ${relativePath}`);
    }
    if (projectVibePath(normalized, normalizeRelativePath)) {
      throw new Error(`Refusing to mutate project.vibe from runtime return writer: ${relativePath}`);
    }
    const filePath = isAbsoluteTarget
      ? path.resolve(normalized)
      : prefixedProjectRelativePath
        ? scopedRepoPath(normalized)
        : path.resolve(source.runRootPath, normalized);
    mkdirSync(path.dirname(filePath), { recursive: true });
    const dirRealPath = realpathSync(path.dirname(filePath));
    const runRootRealPath = realpathSync(source.runRootPath);
    if (!isPathInsideRealRoot(dirRealPath, runRootRealPath)) {
      throw new Error(`Refusing to write through unsafe project return path: ${relativePath}`);
    }
    return filePath;
  }

  function writeCurrentProjectRuntimeJson(relativePath, payload, source) {
    const filePath = assertCurrentProjectRuntimeWritePath(relativePath, source);
    atomicWriteJson(filePath, payload, writeFileSync, renameSync);
  }

  function writeCurrentProjectRuntimeBytes(relativePath, bytes, source) {
    const filePath = assertCurrentProjectRuntimeWritePath(relativePath, source);
    atomicWriteBytes(filePath, bytes, writeFileSync, renameSync);
    return filePath;
  }

  return {
    oneShotExecutorPathInsideSandbox,
    assertOneShotExecutorSandboxWritePath,
    writeOneShotExecutorJson,
    writeOneShotExecutorBytes,
    assertCurrentProjectRuntimeWritePath,
    writeCurrentProjectRuntimeJson,
    writeCurrentProjectRuntimeBytes,
  };
}
