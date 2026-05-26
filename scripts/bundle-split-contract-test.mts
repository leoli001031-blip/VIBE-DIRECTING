import fs from "node:fs";

function readText(filePath: string) {
  return fs.readFileSync(filePath, "utf8");
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`FAIL: ${message}`);
}

function stripComments(source: string) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function importSpecifierPattern(specifier: string) {
  const escaped = specifier.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`["']${escaped}["']`);
}

function staticImportStatements(source: string) {
  const statements: string[] = [];
  const importFromPattern = /^\s*(?:import|export)\s+(?!type\b)[\s\S]*?\bfrom\s*["'][^"']+["']\s*;?/gm;
  const bareImportPattern = /^\s*import\s+["'][^"']+["']\s*;?/gm;

  for (const match of source.matchAll(importFromPattern)) statements.push(match[0]);
  for (const match of source.matchAll(bareImportPattern)) statements.push(match[0]);

  return statements;
}

function importStatementSpecifier(statement: string) {
  const fromSpecifier = statement.match(/\bfrom\s*["']([^"']+)["']/);
  if (fromSpecifier) return fromSpecifier[1];
  const bareSpecifier = statement.match(/^\s*import\s*["']([^"']+)["']/);
  return bareSpecifier?.[1];
}

function assertNoStaticModuleImport(source: string, specifier: string, label: string) {
  const specifierPattern = importSpecifierPattern(specifier);
  const forbidden = staticImportStatements(source).find((statement) => specifierPattern.test(statement));
  assert(!forbidden, `${label} must not be imported by App's static browser entry: ${forbidden}`);
}

function assertNoStaticImportPrefix(source: string, prefix: string, label: string) {
  const forbidden = staticImportStatements(source)
    .map((statement) => ({ statement, specifier: importStatementSpecifier(statement) }))
    .filter(({ specifier }) => specifier?.startsWith(prefix));
  assert(
    forbidden.length === 0,
    `${label} must stay out of App's static browser entry:\n${forbidden.map(({ statement }) => statement).join("\n")}`,
  );
}

function assertLazyComponentImport(source: string, componentName: string, specifier: string) {
  const escapedComponent = componentName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const escapedSpecifier = specifier.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const lazyPattern = new RegExp(
    `const\\s+${escapedComponent}\\s*=\\s*lazy\\s*\\(\\s*\\(\\s*\\)\\s*=>\\s*import\\s*\\(\\s*["']${escapedSpecifier}["']\\s*\\)[\\s\\S]{0,260}default\\s*:\\s*${escapedComponent}`,
  );
  assert(
    lazyPattern.test(source),
    `${componentName} must be loaded through React.lazy(() => import("${specifier}"))`,
  );
}

function assertStaticComponentImport(source: string, componentName: string, specifier: string) {
  const escapedComponent = componentName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const escapedSpecifier = specifier.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const staticImportPattern = new RegExp(
    `import\\s*\\{[\\s\\S]*\\b${escapedComponent}\\b[\\s\\S]*\\}\\s*from\\s*["']${escapedSpecifier}["']`,
  );
  assert(
    staticImportPattern.test(source),
    `${componentName} must remain a direct App import from "${specifier}"`,
  );
}

function assertRenderedDirectly(source: string, componentName: string) {
  assert(
    new RegExp(`<${componentName}\\b`).test(source),
    `${componentName} must still be mounted directly from App`,
  );
}

function assertRenderedBehindSuspense(source: string, componentName: string) {
  const componentIndex = source.indexOf(`<${componentName}`);
  assert(componentIndex >= 0, `${componentName} must still be mounted from App`);
  const suspenseOpen = source.lastIndexOf("<Suspense", componentIndex);
  const suspenseClose = source.lastIndexOf("</Suspense>", componentIndex);
  assert(
    suspenseOpen > suspenseClose,
    `${componentName} lazy boundary must be rendered inside a Suspense fallback`,
  );
}

const appSource = stripComments(readText("src/App.tsx"));
const directorModeSource = stripComments(readText("src/ui/director/DirectorModeShell.tsx"));
const viteConfigSource = stripComments(readText("vite.config.ts"));

assertNoStaticModuleImport(appSource, "./ui/diagnostics/DiagnosticsMode", "DiagnosticsMode");
assertNoStaticModuleImport(appSource, "./ui/inspector/InspectorModeShell", "InspectorMode");
assertNoStaticImportPrefix(appSource, "./ui/diagnostics/", "Diagnostics subpanels");
assertNoStaticModuleImport(appSource, "./ui/project/ProjectRealChainPanel", "ProjectRealChainPanel");
assertLazyComponentImport(appSource, "DiagnosticsMode", "./ui/diagnostics/DiagnosticsMode");
assertLazyComponentImport(appSource, "InspectorMode", "./ui/inspector/InspectorModeShell");
assertRenderedBehindSuspense(appSource, "DiagnosticsMode");
assertRenderedBehindSuspense(appSource, "InspectorMode");

assertStaticComponentImport(appSource, "DirectorMode", "./ui/director/DirectorModeShell");
assertStaticComponentImport(appSource, "MinimalTopNav", "./ui/director/MinimalTopNav");
assertRenderedDirectly(appSource, "DirectorMode");
assertRenderedDirectly(appSource, "MinimalTopNav");

assertNoStaticModuleImport(directorModeSource, "./MinimalPreview", "MinimalPreview");
assertNoStaticModuleImport(directorModeSource, "./MinimalAudioPlan", "MinimalAudioPlan");
assertNoStaticModuleImport(directorModeSource, "./MinimalExport", "MinimalExport");
assertLazyComponentImport(directorModeSource, "MinimalPreview", "./MinimalPreview");
assertLazyComponentImport(directorModeSource, "MinimalAudioPlan", "./MinimalAudioPlan");
assertLazyComponentImport(directorModeSource, "MinimalExport", "./MinimalExport");
assertRenderedBehindSuspense(directorModeSource, "MinimalPreview");
assertRenderedBehindSuspense(directorModeSource, "MinimalAudioPlan");
assertRenderedBehindSuspense(directorModeSource, "MinimalExport");
assertStaticComponentImport(directorModeSource, "MinimalStoryFlow", "./MinimalStoryFlow");
assertStaticComponentImport(directorModeSource, "MinimalAgentPanel", "./MinimalAgentPanel");
assertRenderedDirectly(directorModeSource, "MinimalStoryFlow");
assertRenderedDirectly(directorModeSource, "MinimalAgentPanel");

for (const chunkName of ["core-runtime", "agent-runtime", "demo-data"]) {
  assert(
    viteConfigSource.includes(`return "${chunkName}"`),
    `vite manualChunks must keep ${chunkName} out of the main browser entry chunk`,
  );
}

console.log("bundle-split-contract-test: App lazy/direct entry contract checks completed.");
