import fs from "node:fs";

function readText(path) {
  return fs.readFileSync(path, "utf8");
}

function readJson(path) {
  return JSON.parse(readText(path));
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function findFunctionBody(source, functionName) {
  const signature = `function ${functionName}`;
  const start = source.indexOf(signature);
  assert(start >= 0, `${functionName} component/function is missing`);

  const paramsOpen = source.indexOf("(", start);
  assert(paramsOpen >= 0, `${functionName} has no parameter list`);

  let paramDepth = 0;
  let paramsClose = -1;
  for (let index = paramsOpen; index < source.length; index += 1) {
    const char = source[index];
    if (char === "(") paramDepth += 1;
    if (char === ")") paramDepth -= 1;
    if (paramDepth === 0) {
      paramsClose = index;
      break;
    }
  }

  assert(paramsClose >= 0, `${functionName} parameter list was not closed`);
  const open = source.indexOf("{", paramsClose);
  assert(open >= 0, `${functionName} has no function body`);

  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth === 0) return source.slice(open + 1, index);
  }

  throw new Error(`${functionName} body was not closed`);
}

function countPattern(source, pattern) {
  return (source.match(pattern) || []).length;
}

function countLiteral(source, literal) {
  return (source.match(new RegExp(literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length;
}

function requireAny(source, patterns, label) {
  return patterns.some((pattern) => pattern.test(source)) ? undefined : `${label} is missing`;
}

function requireWithin(source, pattern, label) {
  return pattern.test(source) ? undefined : `${label} is missing`;
}

function firstLineOf(source, pattern) {
  const index = source.search(pattern);
  if (index < 0) return undefined;
  return source.slice(0, index).split("\n").length;
}

function findFunctionNames(source, pattern) {
  return Array.from(source.matchAll(/function\s+([A-Za-z0-9_]+)\s*\(/g))
    .map((match) => match[1])
    .filter((name) => pattern.test(name));
}

const appPath = "src/App.tsx";
const stylesPath = "src/styles.css";
const packagePath = "package.json";
const sequenceDocPath = "docs/core-development-sequence.md";
const contractDocPath = "docs/ui/minimal-director-ui-contract.md";

const appSource = stripComments(readText(appPath));
const stylesSource = stripComments(readText(stylesPath));
const packageJson = readJson(packagePath);
const sequenceDoc = readText(sequenceDocPath);
const contractDoc = readText(contractDocPath);

const directorMode = findFunctionBody(appSource, "DirectorMode");
const minimalTopNav = findFunctionBody(appSource, "MinimalTopNav");
const minimalAgentPanel = findFunctionBody(appSource, "MinimalAgentPanel");
const minimalProjectPlan = findFunctionBody(appSource, "buildMinimalProjectPlan");
const desktopShellView = findFunctionBody(appSource, "buildDesktopRuntimeShellView");
const diagnosticsMode = findFunctionBody(appSource, "DiagnosticsMode");
const settingsShell = findFunctionBody(appSource, "SettingsShell");
const appBody = findFunctionBody(appSource, "App");
const failures = [];

function check(condition, message) {
  if (!condition) failures.push(message);
}

function checkMessage(message) {
  if (message) failures.push(message);
}

check(
  packageJson.scripts?.["minimal-ui:test"] === "node scripts/minimal-ui-contract-test.mjs",
  "package.json must expose minimal-ui:test",
);

checkMessage(requireWithin(sequenceDoc, /Phase 9\.4/i, "Phase 9.4 entry in docs/core-development-sequence.md"));
checkMessage(requireWithin(sequenceDoc, /minimal-ui:test/i, "minimal-ui:test checklist item in docs/core-development-sequence.md"));
checkMessage(requireWithin(contractDoc, /Minimal Director UI Contract/i, "minimal director UI contract doc title"));
checkMessage(requireWithin(contractDoc, /Diagnostics/i, "diagnostics boundary in minimal UI contract doc"));

checkMessage(requireWithin(appSource, /function\s+DirectorMode\s*\(/, "DirectorMode component"));
checkMessage(requireWithin(appSource, /function\s+MinimalAgentPanel\s*\(/, "MinimalAgentPanel component"));
checkMessage(requireWithin(appSource, /function\s+DiagnosticsMode\s*\(/, "DiagnosticsMode component"));
checkMessage(requireWithin(appBody, /mode\s*===\s*"diagnostics"/, "Diagnostics entry in App mode switch/rendering"));
checkMessage(requireWithin(appBody, /mode\s*===\s*"director"/, "Director mode rendering"));
checkMessage(requireWithin(minimalAgentPanel, /buildDirectorWorkflowState\s*\(/, "MinimalAgentPanel must use buildDirectorWorkflowState"));
check(
  !/buildStoryChangeTransaction\s*\(/.test(minimalAgentPanel),
  "MinimalAgentPanel must not call buildStoryChangeTransaction directly",
);
check(
  !/buildReflowImpactReport\s*\(/.test(minimalAgentPanel),
  "MinimalAgentPanel must not call buildReflowImpactReport directly",
);
checkMessage(requireWithin(minimalAgentPanel, /selectedShotId\s*:/, "MinimalAgentPanel selectedShotId workflow selection"));
checkMessage(requireWithin(minimalAgentPanel, /selectedAssetId\s*:/, "MinimalAgentPanel selectedAssetId workflow selection"));
checkMessage(requireWithin(minimalAgentPanel, /sectionId\s*:/, "MinimalAgentPanel sectionId workflow selection"));

const phase14ProjectSurface = `${minimalTopNav}\n${minimalProjectPlan}`;
checkMessage(requireWithin(phase14ProjectSurface, /Project/i, "Phase 14 Project entry in minimal top navigation"));
checkMessage(requireWithin(phase14ProjectSurface, /project\.vibe/i, "Phase 14 project.vibe entry badge"));
checkMessage(requireWithin(phase14ProjectSurface, /Plan\s+preview/i, "Phase 14 plan preview badge"));

checkMessage(requireWithin(desktopShellView, /buildDesktopRuntimePlan\s*\(/, "Phase 15 Settings shell must use buildDesktopRuntimePlan"));
checkMessage(requireWithin(settingsShell, /Desktop Runtime\s*\/\s*Permission Shell/i, "Phase 15 Desktop Runtime / Permission Shell in Settings"));
checkMessage(requireWithin(settingsShell, /runtime mode/i, "Phase 15 runtime mode row in Settings"));
checkMessage(requireWithin(settingsShell, /platform\/path policy/i, "Phase 15 platform/path policy row in Settings"));
checkMessage(requireWithin(settingsShell, /project permission scope/i, "Phase 15 project permission scope row in Settings"));
checkMessage(requireWithin(settingsShell, /sidecar policy/i, "Phase 15 sidecar policy row in Settings"));
checkMessage(requireWithin(settingsShell, /credential vault placeholder/i, "Phase 15 credential vault placeholder row in Settings"));
checkMessage(requireWithin(settingsShell, /hard locks summary/i, "Phase 15 hard locks summary in Settings"));

checkMessage(requireAny(appSource, [/Asset Library/, /function\s+AssetLibrary/, /className="[^"]*asset-library/], "Asset Library main UI naming"));
checkMessage(requireAny(appSource, [/Preview/, /function\s+PreviewTimeline/, /className="[^"]*preview/], "Preview main UI"));
checkMessage(requireAny(appSource, [/Selected/, /Scope/], "Selected/Scope director context"));
checkMessage(requireAny(appSource, [/Story/, /section\.label/, /storySections/, /All Shots/], "Story/section tabs"));
checkMessage(requireAny(appSource, [/Diagnostics/, /diagnostics/], "Diagnostics entry"));

checkMessage(requireAny(stylesSource, [/asset-library/, /\.asset-panel/], "Asset Library styling hook"));
checkMessage(requireAny(stylesSource, [/preview/, /preview-timeline/], "Preview styling hook"));
checkMessage(requireAny(stylesSource, [/diagnostics/, /diagnostics-layout/], "Diagnostics styling hook"));

const directorTerms = [
  ["provider", /provider/gi],
  ["manifest", /manifest/gi],
  ["schema", /schema/gi],
  ["queue", /queue/gi],
  ["task envelope", /task\s*envelope|taskEnvelope/gi],
  ["hard lock", /hard\s*lock|hardLock/gi],
  ["forbiddenActions", /forbiddenActions/gi],
];
const directorTermCounts = directorTerms.map(([term, pattern]) => [term, countPattern(directorMode, pattern)]);
const directorTermTotal = directorTermCounts.reduce((sum, [, count]) => sum + count, 0);
const diagnosticsComponentBodies = [
  "DiagnosticsMode",
  ...findFunctionNames(appSource, /Diagnostics/),
  "ProviderDock",
  "SettingsShell",
  "EnvelopePreview",
].map((name) => findFunctionBody(appSource, name));
const diagnosticsSurface = diagnosticsComponentBodies.join("\n");
const diagnosticsTermTotal = directorTerms.reduce((sum, [, pattern]) => sum + countPattern(diagnosticsSurface, pattern), 0);

check(
  directorTermTotal <= 8,
  `DirectorMode contains too many engineering terms (${directorTermCounts.map(([term, count]) => `${term}:${count}`).join(", ")}); move details behind Diagnostics`,
);
check(
  diagnosticsTermTotal >= Math.max(4, directorTermTotal),
  "DiagnosticsMode should remain the primary home for engineering/status terms",
);

const minimalDirectorSurface = `${directorMode}\n${minimalAgentPanel}\n${minimalTopNav}\n${minimalProjectPlan}`;
const forbiddenMinimalTerms = [
  ["Queue Shell", /Queue\s+Shell/i],
  ["Provider Lock", /Provider\s+Lock/i],
  ["Task Envelope", /Task\s+Envelope|taskEnvelope/i],
  ["Desktop Runtime", /Desktop\s+Runtime/i],
  ["Permission Shell", /Permission\s+Shell/i],
  ["Tauri", /Tauri/i],
  ["sidecar", /sidecar/i],
  ["arbitrary shell", /arbitrary\s+shell/i],
  ["Runtime cache status", /Runtime\s+cache/i],
  ["No file mutation", /No\s+file\s+mutation/i],
  ["File-first facts", /File-first\s+facts/i],
  ["credential vault", /credential\s+vault/i],
  ["forbiddenActions", /forbiddenActions/i],
  ["manifest", /manifest/i],
  ["schema", /schema/i],
  ["provider", /provider/i],
  ["queue", /queue/i],
  ["credential/API key", /credential|API\s*key/i],
];
for (const [term, pattern] of forbiddenMinimalTerms) {
  check(!pattern.test(minimalDirectorSurface), `DirectorMode/MinimalAgentPanel must not expose ${term}`);
}

const appContactSheetCount = countLiteral(appSource, "contactSheets");
const diagnosticsContactSheetCount = countLiteral(diagnosticsMode, "contactSheets");
check(
  appContactSheetCount - diagnosticsContactSheetCount === 0,
  `contactSheets must not be resident in the Director minimal path; found ${appContactSheetCount - diagnosticsContactSheetCount} reference(s) outside Diagnostics`,
);

const contactLine = firstLineOf(appSource, /contactSheets/);
check(
  contactLine === undefined || diagnosticsMode.includes("contactSheets"),
  `contactSheets reference at ${appPath}:${contactLine} is outside Diagnostics`,
);

if (failures.length) {
  console.error("Minimal UI contract tests failed:");
  failures.forEach((failure, index) => console.error(`${index + 1}. ${failure}`));
  process.exit(1);
}

console.log(
  [
    "Minimal UI contract tests passed.",
    `Director engineering term total: ${directorTermTotal}.`,
    `Diagnostics engineering term total: ${diagnosticsTermTotal}.`,
    `contactSheets references outside Diagnostics: ${appContactSheetCount - diagnosticsContactSheetCount}.`,
  ].join(" "),
);
