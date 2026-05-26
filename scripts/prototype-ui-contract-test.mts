import fs from "node:fs";

function readText(path: string) {
  return fs.readFileSync(path, "utf8");
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`FAIL: ${message}`);
}

function stripComments(source: string) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function findFunctionBody(source: string, functionName: string) {
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

function extractStringLiterals(source: string) {
  return Array.from(source.matchAll(/(["'`])((?:\\.|(?!\1)[\s\S])*?)\1/g))
    .map((match) => match[2])
    .join("\n");
}

const minimalAgentPanelPath = "src/ui/director/MinimalAgentPanel.tsx";
const agentPanelProjectionPath = "src/ui/director/agentPanelProjection.ts";
const directorModePath = "src/ui/director/DirectorModeShell.tsx";
const creatorDeskPanelsPath = "src/ui/director/CreatorDeskPanels.tsx";
const appPath = "src/App.tsx";
const minimalTopNavPath = "src/ui/director/MinimalTopNav.tsx";
const minimalStoryFlowPath = "src/ui/director/MinimalStoryFlow.tsx";
const minimalAssetLibraryPath = "src/ui/director/MinimalAssetLibrary.tsx";
const minimalPreviewPath = "src/ui/director/MinimalPreview.tsx";
const minimalExportPath = "src/ui/director/MinimalExport.tsx";

const minimalAgentPanelSource = stripComments(readText(minimalAgentPanelPath));
const agentPanelProjectionSource = stripComments(readText(agentPanelProjectionPath));
const directorModeSource = stripComments(readText(directorModePath));
const creatorDeskPanelsSource = stripComments(readText(creatorDeskPanelsPath));
const appSource = stripComments(readText(appPath));
const minimalTopNavSource = stripComments(readText(minimalTopNavPath));
const minimalStoryFlowSource = stripComments(readText(minimalStoryFlowPath));
const minimalAssetLibrarySource = stripComments(readText(minimalAssetLibraryPath));
const minimalPreviewSource = stripComments(readText(minimalPreviewPath));
const minimalExportSource = stripComments(readText(minimalExportPath));

const minimalAgentPanel = findFunctionBody(minimalAgentPanelSource, "MinimalAgentPanel");
const prototypeAgentDemoProjection = findFunctionBody(agentPanelProjectionSource, "buildPrototypeAgentDemoProjection");
const directorMode = findFunctionBody(directorModeSource, "DirectorMode");
const creatorDeskPanels = findFunctionBody(creatorDeskPanelsSource, "CreatorDeskPanels");
const app = findFunctionBody(appSource, "App");

const failures: string[] = [];

function checkWithin(source: string, pattern: RegExp, label: string) {
  if (!pattern.test(source)) failures.push(`${label} is missing`);
}

function check(condition: unknown, message: string) {
  if (!condition) failures.push(message);
}

const prototypeDemoCallback =
  /on[A-Za-z0-9]*(Prototype|Demo)[A-Za-z0-9]*(Prototype|Demo)[A-Za-z0-9]*/;
const prototypeDemoResult =
  /(prototypeDemoResult|demoPrototypeResult|prototypeResult|demoResult|latestPrototypeDemoResult|latestPrototypeAgentDemo|prototypeAgentDemo|PrototypeAgentDemoRun)/;

checkWithin(
  minimalAgentPanelSource,
  prototypeDemoCallback,
  "MinimalAgentPanel prototype demo callback prop",
);
checkWithin(
  minimalAgentPanel,
  prototypeDemoResult,
  "MinimalAgentPanel prototype demo result state/render",
);
checkWithin(
  minimalAgentPanel,
  /prototype[\s\S]{0,160}demo|demo[\s\S]{0,160}prototype/i,
  "MinimalAgentPanel prototype demo UI affordance",
);
checkWithin(
  minimalAgentPanel,
  /aria-label=.*(prototype|demo)|className=.*(prototype|demo)|<small[\s\S]*?(prototype|demo)|<strong[\s\S]*?(prototype|demo)/i,
  "MinimalAgentPanel prototype demo result display",
);
checkWithin(
  agentPanelProjectionSource,
  /已加入项目计划[\s\S]*预览已生成、等待复核/,
  "Prototype demo status must use creator-facing project/preview copy",
);
checkWithin(
  agentPanelProjectionSource,
  /(projectSaved|已保存到项目)/,
  "Prototype demo status must surface local project save state",
);
check(
  !/已加入\s+project\.vibe/.test(prototypeAgentDemoProjection),
  "Prototype demo status must not expose project.vibe in visible copy",
);

checkWithin(
  directorModeSource,
  prototypeDemoCallback,
  "DirectorModeShell prototype demo callback prop",
);
checkWithin(
  directorMode,
  new RegExp(`<MinimalAgentPanel[\\s\\S]*${prototypeDemoCallback.source}[\\s\\S]*=\\{`),
  "DirectorModeShell pass-through into MinimalAgentPanel",
);
checkWithin(
  directorMode,
  /<CreatorDeskPanels\s+projection=\{creatorDesk\}/,
  "DirectorModeShell creator desk panel mount",
);

const appHandlerPatterns = [
  /function\s+(handle|run|prepare|start)[A-Za-z0-9]*(Prototype|Demo)[A-Za-z0-9]*(Prototype|Demo)[A-Za-z0-9]*\s*\(/,
  /const\s+(handle|run|prepare|start)[A-Za-z0-9]*(Prototype|Demo)[A-Za-z0-9]*(Prototype|Demo)[A-Za-z0-9]*\s*=/,
  /export\s+const\s+prototypeDemoPathWired\s*=\s*true/,
];
check(
  appHandlerPatterns.some((pattern) => pattern.test(appSource)),
  "App.tsx prototype demo handler or prototypeDemoPathWired marker is missing",
);
checkWithin(
  app,
  /openProjectVibeDraft/,
  "App.tsx must restore local Project.vibe draft state",
);
checkWithin(
  app,
  /saveProjectVibeDraft/,
  "App.tsx must save local Project.vibe draft state after prototype runs",
);
checkWithin(
  app,
  new RegExp(`<DirectorMode[\\s\\S]*${prototypeDemoCallback.source}[\\s\\S]*=\\{`),
  "App.tsx must pass prototype demo handler into DirectorMode",
);

const mainDirectorUserSurface = [
  directorMode,
  creatorDeskPanels,
  minimalAgentPanel,
  minimalTopNavSource,
  minimalStoryFlowSource,
  minimalAssetLibrarySource,
  minimalPreviewSource,
  minimalExportSource,
]
  .map(extractStringLiterals)
  .join("\n");

for (const [label, pattern] of [
  ["credential", /credential|api\s*key|secret|密钥|凭证/i],
  ["schema", /\bschema\b|schemaVersion|结构定义/i],
  ["runtime cache", /runtime\s*cache|runtime-cache|运行时缓存/i],
  ["real submit", /real\s*submit|live\s*submit|provider\s*submit|真实提交|直接提交|发起调用/i],
] as const) {
  check(!pattern.test(mainDirectorUserSurface), `main Director UI must not expose ${label}`);
}

if (failures.length > 0) {
  throw new Error(`prototype UI contract failed:\n- ${failures.join("\n- ")}`);
}

console.log("prototype-ui-contract-test: target wiring checks completed.");
