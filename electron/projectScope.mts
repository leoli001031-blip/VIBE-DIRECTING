import path from "node:path";

export interface ProjectRootScope {
  rememberProjectRoot(projectRoot: string): string;
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
  return {
    rememberProjectRoot(projectRoot: string) {
      const resolved = path.resolve(projectRoot);
      allowedProjectRoots.add(resolved);
      return resolved;
    },
    forgetProjectRoot(projectRoot: string) {
      const resolved = path.resolve(projectRoot);
      return allowedProjectRoots.delete(resolved);
    },
    resolveOpenedProjectPath(filePath: string, label: string) {
      const resolved = path.resolve(filePath);
      const root = Array.from(allowedProjectRoots).find((candidate) => isInsideRoot(candidate, resolved));
      if (!root) {
        throw new Error(`${label} must stay inside an opened project folder.`);
      }
      return resolved;
    },
    findRoot(filePath: string) {
      const resolved = path.resolve(filePath);
      return Array.from(allowedProjectRoots).find((candidate) => isInsideRoot(candidate, resolved));
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
