import { existsSync, realpathSync, statSync } from "node:fs";
import path from "node:path";

export interface ProjectRootScope {
  rememberProjectRoot(projectRoot: string): string;
  resolveAuthorizedProjectRoot(projectRoot: string, label: string): string;
  forgetProjectRoot(projectRoot: string): boolean;
  resolveOpenedProjectPath(filePath: string, label: string): string;
  findRoot(filePath: string): string | undefined;
  roots(): string[];
}

export function isInsideRoot(root: string, target: string) {
  const scopedRelative = path.relative(root, target);
  return scopedRelative === "" || (!scopedRelative.startsWith("..") && !path.isAbsolute(scopedRelative));
}

export function createProjectRootScope(): ProjectRootScope {
  const allowedProjectRoots = new Set<string>();
  const projectRootAliases = new Map<string, string>();

  function canonicalExistingDirectory(directoryPath: string) {
    const resolved = path.resolve(directoryPath);
    if (!existsSync(resolved) || !statSync(resolved).isDirectory()) {
      throw new Error("Project root must be an existing directory.");
    }
    return realpathSync(resolved);
  }

  function authorizedRootForPath(filePath: string) {
    const resolved = path.resolve(filePath);
    let match: { alias: string; root: string } | undefined;
    for (const [alias, root] of projectRootAliases) {
      if (!isInsideRoot(alias, resolved)) continue;
      if (!match || alias.length > match.alias.length) match = { alias, root };
    }
    return match?.root;
  }

  function nearestExistingAncestor(filePath: string) {
    let candidate = path.resolve(filePath);
    while (!existsSync(candidate)) {
      const parent = path.dirname(candidate);
      if (parent === candidate) return undefined;
      candidate = parent;
    }
    return candidate;
  }

  function assertRealPathInsideRoot(filePath: string, root: string, label: string) {
    const existingAncestor = nearestExistingAncestor(filePath);
    if (!existingAncestor) {
      throw new Error(`${label} must stay inside an opened project folder.`);
    }
    const realAncestor = realpathSync(existingAncestor);
    if (!isInsideRoot(root, realAncestor)) {
      throw new Error(`${label} must stay inside an opened project folder.`);
    }
  }

  return {
    rememberProjectRoot(projectRoot: string) {
      const resolved = path.resolve(projectRoot);
      const canonical = canonicalExistingDirectory(resolved);
      allowedProjectRoots.add(canonical);
      projectRootAliases.set(resolved, canonical);
      projectRootAliases.set(canonical, canonical);
      return canonical;
    },
    resolveAuthorizedProjectRoot(projectRoot: string, label: string) {
      const resolved = path.resolve(projectRoot);
      const canonical = projectRootAliases.get(resolved);
      if (!canonical || !allowedProjectRoots.has(canonical)) {
        throw new Error(`${label} requires an authorized project folder.`);
      }
      if (canonicalExistingDirectory(resolved) !== canonical) {
        throw new Error(`${label} requires an authorized project folder.`);
      }
      return canonical;
    },
    forgetProjectRoot(projectRoot: string) {
      const resolved = path.resolve(projectRoot);
      let canonical = projectRootAliases.get(resolved);
      if (!canonical && existsSync(resolved)) {
        try {
          canonical = realpathSync(resolved);
        } catch {
          canonical = undefined;
        }
      }
      if (!canonical) return false;
      for (const [alias, root] of projectRootAliases) {
        if (root === canonical) projectRootAliases.delete(alias);
      }
      return allowedProjectRoots.delete(canonical);
    },
    resolveOpenedProjectPath(filePath: string, label: string) {
      const resolved = path.resolve(filePath);
      const root = authorizedRootForPath(resolved);
      if (!root) {
        throw new Error(`${label} must stay inside an opened project folder.`);
      }
      assertRealPathInsideRoot(resolved, root, label);
      return resolved;
    },
    findRoot(filePath: string) {
      const resolved = path.resolve(filePath);
      const root = authorizedRootForPath(resolved);
      if (!root) return undefined;
      try {
        assertRealPathInsideRoot(resolved, root, "Project path");
        return root;
      } catch {
        return undefined;
      }
    },
    roots() {
      return Array.from(allowedProjectRoots);
    },
  };
}

export function spawnAllowed(command: string, args: string[]) {
  const executable = path.basename(command);
  const normalizedArgs = args || [];
  if (!["node", "npm", "npx"].includes(executable)) return false;
  return normalizedArgs.length === 1 && ["--version", "-v"].includes(normalizedArgs[0]);
}
