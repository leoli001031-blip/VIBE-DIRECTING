import fs from "node:fs";
import { builtinModules } from "node:module";
import path from "node:path";

const rootDir = process.cwd();
const sourceExtensions = [".ts", ".tsx", ".mts", ".mjs", ".js", ".jsx"];
const nodeBuiltins = new Set(builtinModules.map((moduleName) => moduleName.replace(/^node:/, "")));
const forbiddenBrowserTargets = new Set([
  "src/agent/index.ts",
  "src/agent/image2Tool.ts",
  "src/agent/jimengTool.ts",
  "src/project/localProjectVibeStorage.ts",
]);

function readText(relativePath: string) {
  return fs.readFileSync(path.join(rootDir, relativePath), "utf8");
}

function stripComments(source: string) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function normalizePath(filePath: string) {
  return path.relative(rootDir, filePath).replaceAll(path.sep, "/");
}

function extractRuntimeImports(source: string) {
  const stripped = stripComments(source);
  const imports: string[] = [];
  const importPattern =
    /\b(import|export)\s+(type\s+)?(?:[^"'`]*?\s+from\s+)?["']([^"']+)["']/g;
  let match: RegExpExecArray | null;

  while ((match = importPattern.exec(stripped))) {
    const isTypeOnly = Boolean(match[2]);
    if (!isTypeOnly) imports.push(match[3]);
  }

  return imports;
}

function extractAllImports(source: string) {
  const stripped = stripComments(source);
  const imports: string[] = [];
  const importPattern =
    /\b(import|export)\s+(type\s+)?(?:[^"'`]*?\s+from\s+)?["']([^"']+)["']/g;
  let match: RegExpExecArray | null;

  while ((match = importPattern.exec(stripped))) {
    imports.push(match[3]);
  }

  return imports;
}

function resolveLocalImport(fromFile: string, specifier: string) {
  if (!specifier.startsWith(".")) return undefined;

  const fromDir = path.dirname(path.join(rootDir, fromFile));
  const basePath = path.resolve(fromDir, specifier);
  const candidates = [
    ...sourceExtensions.map((extension) => `${basePath}${extension}`),
    ...sourceExtensions.map((extension) => path.join(basePath, `index${extension}`)),
  ];

  const match = candidates.find((candidate) => fs.existsSync(candidate));
  return match ? normalizePath(match) : undefined;
}

function listSourceFilesUnder(relativeDir: string) {
  const absoluteDir = path.join(rootDir, relativeDir);
  return fs
    .readdirSync(absoluteDir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(entry.parentPath, entry.name))
    .filter((filePath) => sourceExtensions.includes(path.extname(filePath)))
    .map(normalizePath)
    .sort();
}

function listDirectorFiles() {
  return listSourceFilesUnder("src/ui/director");
}

function collectRuntimeGraph(entryFile: string) {
  const seen = new Set<string>();
  const edges = new Map<string, string[]>();
  const queue = [entryFile];

  while (queue.length > 0) {
    const file = queue.shift();
    if (!file || seen.has(file)) continue;
    seen.add(file);

    const source = readText(file);
    const imports = extractRuntimeImports(source);
    const localTargets: string[] = [];

    for (const specifier of imports) {
      const target = resolveLocalImport(file, specifier);
      if (target) {
        localTargets.push(target);
        queue.push(target);
      }
    }

    edges.set(file, localTargets);
  }

  return { edges, seen };
}

function findPathToTarget(edges: Map<string, string[]>, target: string) {
  const queue: Array<{ file: string; path: string[] }> = [
    { file: "src/App.tsx", path: ["src/App.tsx"] },
  ];
  const seen = new Set<string>();

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || seen.has(current.file)) continue;
    seen.add(current.file);
    if (current.file === target) return current.path;

    for (const next of edges.get(current.file) ?? []) {
      queue.push({ file: next, path: [...current.path, next] });
    }
  }

  return undefined;
}

function assertNoNodeOnlySurface(file: string, failures: string[]) {
  const source = stripComments(readText(file));
  const imports = extractRuntimeImports(source);
  for (const specifier of imports) {
    const normalizedSpecifier = specifier.replace(/^node:/, "");
    if (specifier.startsWith("node:") || nodeBuiltins.has(normalizedSpecifier)) {
      failures.push(`${file} imports Node-only module "${specifier}"`);
    }
  }

  if (/\bprocess\.env\b/.test(source)) {
    failures.push(`${file} reads process.env in the browser entry surface`);
  }
}

function assertNoDirectProjectRealChainImport(file: string, failures: string[]) {
  const imports = extractAllImports(readText(file));
  for (const specifier of imports) {
    const target = resolveLocalImport(file, specifier);
    if (target === "src/core/projectRealChainStatus.ts") {
      failures.push(`${file} imports projectRealChainStatus directly; use a narrow client facade instead`);
    }
  }
}

const failures: string[] = [];
const appSource = stripComments(readText("src/App.tsx"));

if (/from\s+["']\.\/agent(?:\/index)?["']|import\s*\(\s*["']\.\/agent(?:\/index)?["']\s*\)/.test(appSource)) {
  failures.push("src/App.tsx must not import the src/agent barrel");
}

assertNoNodeOnlySurface("src/App.tsx", failures);
for (const directorFile of listDirectorFiles()) {
  assertNoNodeOnlySurface(directorFile, failures);
}

for (const file of [
  "src/App.tsx",
  "src/core/projectCurrentBindingClient.ts",
  "src/core/projectImage2Actions.ts",
  "src/core/projectImage2Client.ts",
  "src/core/projectImage2Derive.ts",
  "src/core/projectImage2Endpoints.ts",
  "src/core/projectImage2Types.ts",
  "src/core/projectRound5StrictEditClient.ts",
  "src/core/projectRound5Types.ts",
  "src/core/providerCredentialsClient.ts",
  ...listSourceFilesUnder("src/ui"),
]) {
  assertNoDirectProjectRealChainImport(file, failures);
}

const { edges, seen } = collectRuntimeGraph("src/App.tsx");
for (const file of seen) {
  assertNoNodeOnlySurface(file, failures);
}

for (const target of forbiddenBrowserTargets) {
  if (!seen.has(target)) continue;
  const importPath = findPathToTarget(edges, target)?.join(" -> ") ?? target;
  failures.push(`browser entry graph reaches forbidden agent target: ${importPath}`);
}

if (failures.length > 0) {
  throw new Error(`browser entry boundary failed:\n- ${failures.join("\n- ")}`);
}

console.log(
  `browser-entry-boundary-test: checked ${seen.size} App runtime modules and ${listDirectorFiles().length} director UI files.`,
);
