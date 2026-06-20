import fs from "node:fs";
import path from "node:path";
import type { ProjectFolderFileEntry } from "./projectAgentWorkspace";

export interface ScanProjectFolderFilesOptions {
  maxDepth?: number;
  maxFiles?: number;
  now?: string;
}

const ignoredDirectoryNames = new Set([
  ".git",
  ".vibe-runtime",
  "node_modules",
  "release",
  "dist",
]);

export function scanProjectFolderFiles(
  projectRoot: string,
  options: ScanProjectFolderFilesOptions = {},
): ProjectFolderFileEntry[] {
  const root = path.resolve(projectRoot);
  const maxDepth = Math.max(0, options.maxDepth ?? 4);
  const maxFiles = Math.max(1, options.maxFiles ?? 300);
  const entries: ProjectFolderFileEntry[] = [];

  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) return entries;

  function walk(current: string, depth: number) {
    if (entries.length >= maxFiles || depth > maxDepth) return;
    let children: fs.Dirent[];
    try {
      children = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }

    for (const child of children) {
      if (entries.length >= maxFiles) return;
      if (child.name.startsWith(".") && child.name !== ".vibe") continue;
      if (child.isDirectory() && ignoredDirectoryNames.has(child.name)) continue;

      const fullPath = path.join(current, child.name);
      const relativePath = path.relative(root, fullPath).replace(/\\/g, "/");
      if (!relativePath || relativePath.startsWith("..")) continue;

      if (child.isDirectory()) {
        walk(fullPath, depth + 1);
        continue;
      }
      if (!child.isFile()) continue;

      try {
        const stat = fs.statSync(fullPath);
        entries.push({
          path: relativePath,
          sizeBytes: stat.size,
          modifiedAt: stat.mtime.toISOString(),
        });
      } catch {
        // Ignore files that disappear during a scan.
      }
    }
  }

  walk(root, 0);
  return entries;
}
