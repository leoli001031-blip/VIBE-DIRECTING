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
const directorAgentTextQaInputPath = "src/core/directorAgentTextQaInput.ts";
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
const directorAgentTextQaInputSource = stripComments(readText(directorAgentTextQaInputPath));
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
const preparePrototypeAgentDemo = findFunctionBody(appSource, "preparePrototypeAgentDemo");

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
  /const PROJECT_PLAN_ADDED_LABEL = "故事已确认"[\s\S]*const PREVIEW_READY_REVIEW_LABEL = "预览已生成、等待确认"/,
  "Prototype demo status must use creator-facing project/preview copy",
);
checkWithin(
  agentPanelProjectionSource,
  /projectRestored[\s\S]*已恢复项目[\s\S]*PROJECT_PLAN_ADDED_LABEL/,
  "Prototype demo status must distinguish restored drafts from newly added project plans",
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
  appSource,
  /import \{ runDirectorProductAgentLoop \} from "\.\/agent\/directorProductAgentLoop"/,
  "App.tsx must use the product Agent loop entrypoint",
);
checkWithin(
  app,
  /runDirectorProductAgentLoop\(\{[\s\S]*agentActionEnvelope:\s*input\.agentActionEnvelope[\s\S]*agentToolHandoff:\s*input\.agentToolHandoff/,
  "App.tsx Agent confirmation must preserve the user-reviewed staged action and handoff",
);
checkWithin(
  app,
  /runDirectorProductAgentLoop\(\{[\s\S]*availability:\s*input\.availability[\s\S]*agentActionEnvelope:\s*input\.agentActionEnvelope/,
  "App.tsx Agent confirmation must preserve frontend tool availability when preparing the controlled handoff",
);
checkWithin(
  app,
  /function\s+stagePrototypeAgentPlan\(input: StagePrototypeAgentPlanInput\): Promise<StagePrototypeAgentPlanResult>[\s\S]*const productAgentLoopInput = \{[\s\S]*userConfirmed:\s*false[\s\S]*runDirectorProductAgentLoop\(productAgentLoopInput\)/,
  "App.tsx must expose an unconfirmed staged Product Agent path before user confirmation",
);
checkWithin(
  app,
  /function\s+stagePrototypeAgentPlan\(input: StagePrototypeAgentPlanInput\): Promise<StagePrototypeAgentPlanResult>[\s\S]*const productAgentLoopInput = \{[\s\S]*availability:\s*input\.availability[\s\S]*runDirectorProductAgentLoop\(productAgentLoopInput\)/,
  "App.tsx staged Product Agent path must receive frontend tool availability",
);
checkWithin(
  app,
  /function\s+stagePrototypeAgentPlan\(input: StagePrototypeAgentPlanInput\): Promise<StagePrototypeAgentPlanResult>[\s\S]*runAgentVideoTextQaPreflight\(\{[\s\S]*ruleQaReport:\s*productAgentLoop\.ruleQaReport[\s\S]*textQaReport[\s\S]*runDirectorProductAgentLoop\(\{[\s\S]*textQaReport/,
  "App.tsx staged Product Agent path must consume video text QA when a compiled prompt is available",
);
checkWithin(
  directorAgentTextQaInputSource,
  /function\s+buildDirectorAgentVideoTextQaInput[\s\S]*const seedancePrompt = input\.seedancePrompt\?\.trim\(\)[\s\S]*if \(!seedancePrompt\) return undefined[\s\S]*seedancePrompt,/,
  "renderer video text QA must defer instead of evaluating a missing Seedance prompt",
);
checkWithin(
  app,
  /agentActionEnvelope:\s*productAgentLoop\.action[\s\S]*agentToolHandoff:\s*productAgentLoop\.toolHandoff[\s\S]*qaFeedback:\s*productAgentLoop\.qaFeedback/,
  "App.tsx staged Agent result must return the product-loop action, handoff, and QA feedback to the UI",
);
checkWithin(
  agentPanelProjectionSource,
  /export type StagePrototypeAgentPlanResult[\s\S]*qaFeedback\?: DirectorQaUserFeedback[\s\S]*projectRecordLabel\?: string[\s\S]*projectImpactLabel\?: string[\s\S]*projectTaskLabel\?: string/,
  "Agent staged callback result must expose creator-facing Project.vibe impact summaries and QA feedback before confirmation",
);
checkWithin(
  app,
  /function\s+prototypeAgentStageProjectRecordSummary[\s\S]*确认后保存到项目[\s\S]*projectTaskLabel/,
  "App.tsx must derive pre-confirmation Project.vibe impact summaries from the staged creative loop",
);
checkWithin(
  app,
  /const\s+projectRecordSummary\s*=\s*prototypeAgentStageProjectRecordSummary\(productAgentLoop\.stageResult\)[\s\S]*\.\.\.projectRecordSummary/,
  "App.tsx staged Agent result must return the Project.vibe impact summary to the UI",
);
checkWithin(
  app,
  /onStagePrototypeAgentPlan=\{stagePrototypeAgentPlan\}/,
  "DirectorMode must receive the staged Product Agent callback",
);
checkWithin(
  app,
  /prototypeAgentFriendlyError/,
  "App.tsx prototype failure copy must classify Agent errors",
);
checkWithin(
  app,
  /项目已保留，预览需要确认/,
  "App.tsx prototype failure copy must explain preserved project with preview failure",
);
checkWithin(
  app,
  /项目未写入：请先打开或创建项目文件夹/,
  "App.tsx prototype failure copy must explain missing project folder",
);
checkWithin(
  app,
  /项目未写入：这次修改还没形成可执行任务/,
  "App.tsx prototype failure copy must explain task-envelope blockers",
);
checkWithin(
  app,
  /projectSaved:\s*projectVibeWritten/,
  "App.tsx prototype failure result must preserve saved-project state",
);
checkWithin(
  app,
  /const\s+confirmedAgentToolHandoff\s*=\s*productAgentLoop\.toolHandoff/,
  "App.tsx must use the product Agent loop handoff as the authoritative confirmed handoff",
);
checkWithin(
  preparePrototypeAgentDemo,
  /productAgentLoop\.qaFeedback\?\.summary[\s\S]*productAgentLoop\.blockedReasons\[0\][\s\S]*productAgentLoop\.action\.userFacingMessage/,
  "App.tsx must surface product Agent preflight blockers before falling back to internal confirmation errors",
);
const productLoopIndex = preparePrototypeAgentDemo.indexOf("runDirectorProductAgentLoop");
const selectedShotFallbackGuardIndex = preparePrototypeAgentDemo.indexOf("Prototype Agent demo requires a selected shot.");
const legacyPrototypeLoopIndex = preparePrototypeAgentDemo.indexOf("runDirectorPrototypeClosedLoop");
check(
  productLoopIndex >= 0
    && selectedShotFallbackGuardIndex > productLoopIndex
    && selectedShotFallbackGuardIndex < legacyPrototypeLoopIndex,
  "Project-level Agent actions must reach the product Agent loop before the legacy selected-shot fallback guard",
);
checkWithin(
  app,
  /async function runLocalExportAction\(input\?: \{[\s\S]*agentToolTrace\?: ExportActionState\["agentToolTrace"\][\s\S]*signal\?: AbortSignal[\s\S]*\}\)[\s\S]*signal: input\?\.signal[\s\S]*setExportActionState\(nextState\)[\s\S]*return nextState[\s\S]*setExportActionState\(failedState\)[\s\S]*return failedState/,
  "App.tsx Agent-triggered export must return the structured export action result",
);
checkWithin(
  app,
  /knowledgeManifest:\s*productAgentKnowledgeManifest/,
  "App.tsx must pass the local knowledge manifest into the product Agent loop runtime projection",
);
checkWithin(
  app,
  /const\s+confirmedRuntimeState\s*=\s*productAgentLoop\.nextRuntimeState\s*\|\|\s*buildProjectRuntimeStateFromProjectVibe/,
  "App.tsx must prefer the product Agent loop runtime projection after confirmed writeback",
);
checkWithin(
  preparePrototypeAgentDemo,
  /confirmedAgentToolHandoff\.status === "ready"[\s\S]*setRuntimeState\(confirmedRuntimeState\)[\s\S]*confirmedAgentToolHandoff\.status === "handled_by_project_write"/,
  "App.tsx ready tool handoff must refresh UI from the product Agent loop runtime projection",
);
checkWithin(
  preparePrototypeAgentDemo,
  /confirmedAgentToolHandoff\.status === "handled_by_project_write"[\s\S]*setRuntimeState\(confirmedRuntimeState\)/,
  "App.tsx project-only handoff must refresh UI from the product Agent loop runtime projection",
);
checkWithin(
  agentPanelProjectionSource,
  /export type PreviewPrototypeAgentDemoResult[\s\S]*agentToolHandoff\?: DirectorAgentToolHandoff/,
  "Agent preview callback result must expose the authoritative confirmed tool handoff",
);
checkWithin(
  agentPanelProjectionSource,
  /export type PreviewPrototypeAgentDemoResult[\s\S]*projectRecordLabel\?: string[\s\S]*projectImpactLabel\?: string[\s\S]*projectTaskLabel\?: string/,
  "Agent preview callback result must expose creator-facing Project.vibe writeback summaries",
);
checkWithin(
  agentPanelProjectionSource,
  /export type PreviewPrototypeAgentDemoResult[\s\S]*projectFactHash\?: string/,
  "Agent preview callback result must expose the Project.vibe fact hash produced by confirmed writeback",
);
checkWithin(
  app,
  /Promise<PreviewPrototypeAgentDemoResult>/,
  "App.tsx Agent confirmation callback must return the product Agent loop result contract",
);
checkWithin(
  app,
  /function\s+prototypeAgentProjectRecordSummary[\s\S]*projectRecordLabel[\s\S]*projectImpactLabel[\s\S]*projectTaskLabel/,
  "App.tsx must derive creator-facing Project.vibe writeback summaries from the confirmed creative loop",
);
checkWithin(
  app,
  /const\s+projectRecordSummary\s*=\s*prototypeAgentProjectRecordSummary\(creativeLoop\)/,
  "App.tsx must compute the Project.vibe writeback summary from the authoritative creative loop receipt",
);
checkWithin(
  app,
  /return \{[\s\S]*agentToolHandoff:\s*confirmedAgentToolHandoff[\s\S]*projectVibeWritten:[\s\S]*\.\.\.projectRecordSummary/,
  "App.tsx Agent confirmation callback must return the handoff and Project.vibe summary chosen by the product Agent loop",
);
checkWithin(
  preparePrototypeAgentDemo,
  /prototypeProjectVibeRef\.current = creativeLoop\.nextProject[\s\S]*setPrototypeProjectVibe\(creativeLoop\.nextProject\)[\s\S]*confirmedAgentToolHandoff\.status === "ready"[\s\S]*projectFactHash:\s*confirmedSaveResult\.factHash/,
  "App.tsx must publish confirmed Project.vibe facts synchronously and return their fact hash before tool execution",
);
checkWithin(
  preparePrototypeAgentDemo,
  /confirmedAgentToolHandoff\.status === "ready"[\s\S]*项目已保存，准备执行工具[\s\S]*return \{[\s\S]*agentToolHandoff:\s*confirmedAgentToolHandoff[\s\S]*confirmedAgentToolHandoff\.status === "handled_by_project_write"/,
  "App.tsx ready tool handoff must write Project.vibe and return before prototype preview generation",
);
checkWithin(
  preparePrototypeAgentDemo,
  /confirmedAgentToolHandoff\.status === "ready"[\s\S]*previewReady:\s*false/,
  "App.tsx ready tool handoff must not mark a generic preview as generated",
);
checkWithin(
  app,
  /!confirmedSaveResult\.ok\s*&&\s*confirmedAgentToolHandoff\.status === "ready"[\s\S]*project_save_failed_before_tool_handoff/,
  "App.tsx must stop ready tool handoff when the confirmed project write fails",
);
checkWithin(
  app,
  /const\s+sourceProject\s*=\s*useCurrentProjectWorkbenchProjectionForRuntime[\s\S]*createProjectVibeFromRuntimeState\(workbenchRuntimeState\)/,
  "App.tsx Agent writeback must use the visible current-project workbench as source",
);
checkWithin(
  appSource,
  /syncProjectRealChainStoryFactsFromProjectVibe/,
  "App.tsx pure project patch handoff must refresh the current-project workbench projection",
);
checkWithin(
  appSource,
  /referenceStrategy:\s*shot\.referenceStrategy/,
  "App.tsx project patch projection refresh must preserve structured reference strategy",
);
checkWithin(
  app,
  /修改已写入项目/,
  "App.tsx pure project patch handoff must show project-written success",
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
