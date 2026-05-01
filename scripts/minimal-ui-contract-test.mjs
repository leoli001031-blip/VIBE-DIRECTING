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
const directorProgressStrip = findFunctionBody(appSource, "DirectorProgressStrip");
const directorProgressStripState = findFunctionBody(appSource, "buildDirectorProgressStripState");
const minimalTopNav = findFunctionBody(appSource, "MinimalTopNav");
const minimalAgentPanel = findFunctionBody(appSource, "MinimalAgentPanel");
const selectedScopeLabel = findFunctionBody(appSource, "selectedScopeLabel");
const naturalWorkflowScopeLabel = findFunctionBody(appSource, "naturalWorkflowScopeLabel");
const workflowStatusLabel = findFunctionBody(appSource, "workflowStatusLabel");
const workflowNextStepLabel = findFunctionBody(appSource, "workflowNextStepLabel");
const workflowBadgeLabels = findFunctionBody(appSource, "workflowBadgeLabels");
const realPilotDirectorStatus = findFunctionBody(appSource, "RealPilotDirectorStatus");
const minimalAssetLibrary = findFunctionBody(appSource, "MinimalAssetLibrary");
const minimalPreview = findFunctionBody(appSource, "MinimalPreview");
const minimalProjectPlan = findFunctionBody(appSource, "buildMinimalProjectPlan");
const previewPlayerQueue = findFunctionBody(appSource, "buildPreviewPlayerQueue");
const previewQueueKind = findFunctionBody(appSource, "previewQueueKind");
const desktopShellView = findFunctionBody(appSource, "buildDesktopRuntimeShellView");
const subagentWorkerRuntimeDiagnostics = findFunctionBody(appSource, "SubagentWorkerRuntimeDiagnostics");
const agentCliMockRunnerDiagnostics = findFunctionBody(appSource, "AgentCliMockRunnerDiagnostics");
const codexCliAdapterSpikeDiagnostics = findFunctionBody(appSource, "CodexCliAdapterSpikeDiagnostics");
const exportWorkerDiagnostics = findFunctionBody(appSource, "ExportWorkerDiagnostics");
const voiceAudioSettingsDiagnostics = findFunctionBody(appSource, "VoiceAudioSettingsDiagnostics");
const providerEnablementGateDiagnostics = findFunctionBody(appSource, "ProviderEnablementGateDiagnostics");
const providerEnablementGateUiSummary = findFunctionBody(appSource, "buildProviderEnablementGateUiSummary");
const providerActionConfirmationReceiptDiagnostics = findFunctionBody(appSource, "ProviderActionConfirmationReceiptDiagnostics");
const providerActionConfirmationReceiptUiSummary = findFunctionBody(appSource, "buildProviderActionConfirmationReceiptUiSummary");
const providerExecutionHandoffDiagnostics = findFunctionBody(appSource, "ProviderExecutionHandoffDiagnostics");
const providerExecutionHandoffUiSummary = findFunctionBody(appSource, "buildProviderExecutionHandoffUiSummary");
const localOrchestratorDiagnostics = findFunctionBody(appSource, "LocalOrchestratorDiagnostics");
const localOrchestratorUiSummary = findFunctionBody(appSource, "buildLocalOrchestratorUiSummary");
const image2KeyframeRuntimeDiagnostics = findFunctionBody(appSource, "Image2KeyframeRuntimeDiagnostics");
const realPilotDiagnostics = findFunctionBody(appSource, "RealPilotDiagnostics");
const knowledgeUiSummary = findFunctionBody(appSource, "buildKnowledgeUiSummary");
const knowledgePackManager = findFunctionBody(appSource, "KnowledgePackManager");
const diagnosticsMode = findFunctionBody(appSource, "DiagnosticsMode");
const settingsShell = findFunctionBody(appSource, "SettingsShell");
const appBody = findFunctionBody(appSource, "App");
const failures = [];
const minimalAgentLanguageSurface = [
  minimalAgentPanel,
  selectedScopeLabel,
  naturalWorkflowScopeLabel,
  workflowStatusLabel,
  workflowNextStepLabel,
  workflowBadgeLabels,
].join("\n");

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
check(
  packageJson.scripts?.["preview-player:test"] === "node scripts/preview-player-test.mjs",
  "package.json must expose preview-player:test",
);

checkMessage(requireWithin(sequenceDoc, /Phase 9\.4/i, "Phase 9.4 entry in docs/core-development-sequence.md"));
checkMessage(requireWithin(sequenceDoc, /Phase 17/i, "Phase 17 entry in docs/core-development-sequence.md"));
checkMessage(requireWithin(sequenceDoc, /Phase 21\/23/i, "Phase 21/23 entry in docs/core-development-sequence.md"));
checkMessage(requireWithin(sequenceDoc, /UI 默认不展示术语库，只在 Inspector \/ Diagnostics 显示注入摘要/i, "Knowledge UI summary boundary in docs/core-development-sequence.md"));
checkMessage(requireWithin(sequenceDoc, /minimal-ui:test/i, "minimal-ui:test checklist item in docs/core-development-sequence.md"));
checkMessage(requireWithin(sequenceDoc, /preview-player:test/i, "preview-player:test checklist item in docs/core-development-sequence.md"));
checkMessage(requireWithin(contractDoc, /Minimal Director UI Contract/i, "minimal director UI contract doc title"));
checkMessage(requireWithin(contractDoc, /Diagnostics/i, "diagnostics boundary in minimal UI contract doc"));

checkMessage(requireWithin(appSource, /function\s+DirectorMode\s*\(/, "DirectorMode component"));
checkMessage(requireWithin(appSource, /function\s+DirectorProgressStrip\s*\(/, "Phase 35 Director progress strip component"));
checkMessage(requireWithin(appSource, /function\s+MinimalAgentPanel\s*\(/, "MinimalAgentPanel component"));
checkMessage(requireWithin(appSource, /function\s+DiagnosticsMode\s*\(/, "DiagnosticsMode component"));
checkMessage(requireWithin(appBody, /mode\s*===\s*"diagnostics"/, "Diagnostics entry in App mode switch/rendering"));
checkMessage(requireWithin(appBody, /mode\s*===\s*"director"/, "Director mode rendering"));
checkMessage(requireWithin(directorMode, /DirectorProgressStrip/, "Phase 35 progress strip mounted in DirectorMode"));
checkMessage(requireWithin(directorProgressStripState, /buildLocalOrchestratorUiSummary\s*\(/, "Phase 35 progress strip must derive from Phase 34 runtime summary"));
checkMessage(requireWithin(directorProgressStrip, /项目处理进度/, "Phase 35 progress strip accessible label"));
checkMessage(requireWithin(`${directorProgressStrip}\n${directorProgressStripState}`, /准备中/, "Phase 35 progress strip preparing label"));
checkMessage(requireWithin(`${directorProgressStrip}\n${directorProgressStripState}`, /生成中/, "Phase 35 progress strip working label"));
checkMessage(requireWithin(`${directorProgressStrip}\n${directorProgressStripState}`, /等待复核/, "Phase 35 progress strip review label"));
checkMessage(requireWithin(`${directorProgressStrip}\n${directorProgressStripState}`, /有阻断/, "Phase 35 progress strip blocked label"));
checkMessage(requireWithin(`${directorProgressStrip}\n${directorProgressStripState}`, /已完成/, "Phase 35 progress strip complete label"));
checkMessage(requireWithin(directorProgressStrip, /director-progress-track/, "Phase 35 progress strip visual track"));
checkMessage(requireWithin(stylesSource, /\.director-progress-strip/, "Phase 35 progress strip styling"));
check(!/<button\b/i.test(directorProgressStrip), "Phase 35 progress strip must stay read-only and expose no buttons");
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
checkMessage(requireWithin(minimalAgentLanguageSurface, /描述你想怎么改\.\.\./, "MinimalAgentPanel natural input placeholder"));
checkMessage(requireWithin(minimalAgentLanguageSurface, /准备修改/, "MinimalAgentPanel prepare-copy label"));
checkMessage(requireWithin(minimalAgentLanguageSurface, /等待确认/, "MinimalAgentPanel confirmation-wait label"));
checkMessage(requireWithin(minimalAgentLanguageSurface, /开始生成/, "MinimalAgentPanel generation starts only after confirmation copy"));
for (const [term, pattern] of [
  ["Preview plan", /Preview\s+plan/i],
  ["Refine selected beat", /Refine\s+selected\s+beat/i],
  ["Plan preview", /Plan\s+preview/i],
  ["Ready to review", /Ready\s+to\s+review/i],
  ["Needs confirmation", /Needs\s+confirmation/i],
  ["Confirm before", /Confirm\s+before/i],
  ["provider/credential/shell", /provider|credential|shell/i],
]) {
  check(!pattern.test(minimalAgentLanguageSurface), `MinimalAgentPanel must not expose ${term}`);
}

const phase14ProjectSurface = `${minimalTopNav}\n${minimalProjectPlan}`;
checkMessage(requireWithin(phase14ProjectSurface, /Project/i, "Phase 14 Project entry in minimal top navigation"));
checkMessage(requireWithin(phase14ProjectSurface, /project\.vibe/i, "Phase 14 project.vibe entry badge"));
checkMessage(requireWithin(phase14ProjectSurface, /Ready/i, "Phase 14 ready badge"));
check(!/Plan\s+preview/i.test(phase14ProjectSurface), "Minimal top navigation must not expose Plan preview copy");

checkMessage(requireWithin(desktopShellView, /buildDesktopRuntimePlan\s*\(/, "Phase 15 Settings shell must use buildDesktopRuntimePlan"));
checkMessage(requireWithin(settingsShell, /Desktop Runtime\s*\/\s*Permission Shell/i, "Phase 15 Desktop Runtime / Permission Shell in Settings"));
checkMessage(requireWithin(settingsShell, /runtime mode/i, "Phase 15 runtime mode row in Settings"));
checkMessage(requireWithin(settingsShell, /platform\/path policy/i, "Phase 15 platform/path policy row in Settings"));
checkMessage(requireWithin(settingsShell, /project permission scope/i, "Phase 15 project permission scope row in Settings"));
checkMessage(requireWithin(settingsShell, /sidecar policy/i, "Phase 15 sidecar policy row in Settings"));
checkMessage(requireWithin(settingsShell, /credential vault placeholder/i, "Phase 15 credential vault placeholder row in Settings"));
checkMessage(requireWithin(settingsShell, /hard locks summary/i, "Phase 15 hard locks summary in Settings"));

checkMessage(requireWithin(subagentWorkerRuntimeDiagnostics, /buildSubagentWorkerRuntimeView\s*\(/, "Phase 16 worker runtime diagnostics must use buildSubagentWorkerRuntimeView"));
checkMessage(requireWithin(subagentWorkerRuntimeDiagnostics, /Subagent Worker Runtime/i, "Phase 16 Subagent Worker Runtime diagnostics panel"));
checkMessage(requireWithin(subagentWorkerRuntimeDiagnostics, /validated envelope only/i, "Phase 16 validated-envelope-only diagnostics copy"));
checkMessage(requireWithin(subagentWorkerRuntimeDiagnostics, /structured result required/i, "Phase 16 structured result diagnostics copy"));
checkMessage(requireWithin(diagnosticsMode, /Image2KeyframeRuntimeDiagnostics/, "Phase 17 Image2 keyframe runtime diagnostics mounted"));
checkMessage(requireWithin(image2KeyframeRuntimeDiagnostics, /Image2 Asset \+ Keyframe Runtime/i, "Phase 17 Image2 Asset + Keyframe Runtime diagnostics panel"));
checkMessage(requireWithin(image2KeyframeRuntimeDiagnostics, /Keyframe Runtime/i, "Phase 17 keyframe runtime diagnostics copy"));
checkMessage(requireWithin(image2KeyframeRuntimeDiagnostics, /keyframe pair/i, "Phase 17 keyframe pair diagnostics copy"));
checkMessage(requireWithin(image2KeyframeRuntimeDiagnostics, /end-frame derivation/i, "Phase 17 end-frame derivation diagnostics copy"));
checkMessage(requireWithin(image2KeyframeRuntimeDiagnostics, /provider locks/i, "Phase 17 provider locks diagnostics copy"));
checkMessage(requireWithin(image2KeyframeRuntimeDiagnostics, /closed loop/i, "Phase 17 closed-loop diagnostics copy"));
checkMessage(requireWithin(directorMode, /RealPilotDirectorStatus/, "Phase 43 Real Pilot status mounted in DirectorMode"));
checkMessage(requireWithin(diagnosticsMode, /RealPilotDiagnostics/, "Phase 43 Real Pilot diagnostics mounted"));
checkMessage(requireWithin(settingsShell, /Real Pilot\s*\/\s*真实小样/i, "Phase 43 Real Pilot settings status"));
checkMessage(requireWithin(realPilotDirectorStatus, /真实小样/, "Phase 43 Real Pilot Director status title"));
checkMessage(requireWithin(realPilotDirectorStatus, /选择镜头/, "Phase 43 Real Pilot selected shots copy"));
checkMessage(requireWithin(realPilotDirectorStatus, /首尾帧/, "Phase 43 Real Pilot start/end frames copy"));
checkMessage(requireWithin(realPilotDirectorStatus, /输出文件夹/, "Phase 43 Real Pilot output folder copy"));
checkMessage(requireWithin(realPilotDirectorStatus, /预计生成/, "Phase 43 Real Pilot estimated generation copy"));
checkMessage(requireWithin(realPilotDirectorStatus, /确认后进入\s*1-shot\s*测试准备/, "Phase 44 Real Pilot confirmation-before-one-shot-prep copy"));
check(!/确认后生成/.test(realPilotDirectorStatus), "Phase 44 Real Pilot must not imply immediate generation");
checkMessage(requireWithin(realPilotDirectorStatus, /Image2/, "Phase 43 Real Pilot Image2 first copy"));
checkMessage(requireWithin(realPilotDirectorStatus, /Seedance/, "Phase 43 Real Pilot Seedance parked copy"));
checkMessage(requireWithin(realPilotDiagnostics, /Real Pilot\s*\/\s*真实小样/i, "Phase 43 Real Pilot diagnostics panel"));
checkMessage(requireWithin(realPilotDiagnostics, /Review Status/i, "Phase 43 Real Pilot diagnostics review status"));
checkMessage(requireWithin(realPilotDiagnostics, /Start\s*\/\s*End Frames/i, "Phase 43 Real Pilot diagnostics frames summary"));
check(!/<button\b/i.test(realPilotDirectorStatus), "Phase 43 Real Pilot Director status must stay read-only");
check(!/<button\b/i.test(realPilotDiagnostics), "Phase 43 Real Pilot diagnostics must not expose executable buttons");
const phase44ConfirmationSurface = `${realPilotDirectorStatus}\n${realPilotDiagnostics}\n${settingsShell}`;
checkMessage(requireWithin(realPilotDirectorStatus, /先复核/, "Phase 44 Real Pilot review-first status"));
checkMessage(requireWithin(realPilotDirectorStatus, /等待确认/, "Phase 44 Real Pilot waiting-confirmation status"));
checkMessage(requireWithin(realPilotDirectorStatus, /1 个镜头小样/, "Phase 44 Real Pilot one-shot sample copy"));
checkMessage(requireWithin(realPilotDirectorStatus, /0 自动重试/, "Phase 44 Real Pilot no-auto-retry copy"));
checkMessage(requireWithin(realPilotDirectorStatus, /输出文件夹/, "Phase 44 Real Pilot output folder copy"));
checkMessage(requireWithin(phase44ConfirmationSurface, /执行前确认/, "Phase 44 pre-execution confirmation summary"));
checkMessage(requireWithin(phase44ConfirmationSurface, /预算上限/, "Phase 44 budget cap summary"));
checkMessage(requireWithin(phase44ConfirmationSurface, /输出监听/, "Phase 44 output watcher summary"));
checkMessage(requireWithin(phase44ConfirmationSurface, /请求预览/, "Phase 44 request preview summary"));
for (const [term, pattern] of [
  ["provider", /provider/i],
  ["credential", /credential/i],
  ["shell", /shell/i],
  ["dry-run", /dry[-\s]?run/i],
  ["Run", /\bRun\b/i],
  ["Submit", /\bSubmit\b/i],
  ["Execute", /\bExecute\b/i],
  ["API key", /API\s*key/i],
  ["provider prompt", /provider\s+prompt/i],
  ["submit", /submit/i],
  ["schema", /schema/i],
  ["queue", /queue/i],
  ["task envelope", /task\s*envelope|taskEnvelope/i],
]) {
  check(!pattern.test(realPilotDirectorStatus), `Real Pilot Director status must not expose ${term}`);
}
for (const [copy, pattern] of [
  ["direct submit", /direct\s+submit|直接提交/i],
  ["automatic execution", /automatic\s+execution|自动执行/i],
  ["immediate generation", /immediate\s+generation|立即生成/i],
  ["auto run", /auto\s+run|自动运行/i],
]) {
  check(!pattern.test(phase44ConfirmationSurface), `Real Pilot UI must not imply ${copy}`);
}
checkMessage(requireWithin(diagnosticsMode, /AgentCliMockRunnerDiagnostics/, "Phase 26 Agent/CLI Mock Runner summary mounted in Diagnostics"));
checkMessage(requireWithin(agentCliMockRunnerDiagnostics, /Agent\/CLI Mock Runner/i, "Phase 26 Agent/CLI Mock Runner diagnostics panel"));
checkMessage(requireWithin(agentCliMockRunnerDiagnostics, /Runner Kind/i, "Phase 26 runner kind summary"));
checkMessage(requireWithin(agentCliMockRunnerDiagnostics, /Replacement Proof/i, "Phase 26 replacement proof summary"));
checkMessage(requireWithin(agentCliMockRunnerDiagnostics, /Readiness/i, "Phase 26 ready/blocked summary"));
checkMessage(requireWithin(agentCliMockRunnerDiagnostics, /No-op Results/i, "Phase 26 no-op result count summary"));
checkMessage(requireWithin(agentCliMockRunnerDiagnostics, /phase26-lock-strip/i, "Phase 26 hard locks summary"));
checkMessage(requireWithin(diagnosticsMode, /CodexCliAdapterSpikeDiagnostics/, "Phase 29 CodexCliAdapterSpikeDiagnostics mounted in Diagnostics"));
checkMessage(requireWithin(codexCliAdapterSpikeDiagnostics, /Codex CLI Adapter Spike/i, "Phase 29 Codex CLI Adapter Spike diagnostics panel"));
checkMessage(requireWithin(codexCliAdapterSpikeDiagnostics, /Contract Mode/i, "Phase 29 contract mode summary"));
checkMessage(requireWithin(codexCliAdapterSpikeDiagnostics, /Replacement Proof/i, "Phase 29 replacement proof summary"));
checkMessage(requireWithin(codexCliAdapterSpikeDiagnostics, /Input Source/i, "Phase 29 input source summary"));
checkMessage(requireWithin(codexCliAdapterSpikeDiagnostics, /Spawn\s*\/\s*Resume/i, "Phase 29 spawn/resume shape summary"));
checkMessage(requireWithin(codexCliAdapterSpikeDiagnostics, /Provider Submit/i, "Phase 29 provider submit summary"));
checkMessage(requireWithin(codexCliAdapterSpikeDiagnostics, /phase29-lock-strip/i, "Phase 29 hard locks summary"));
checkMessage(requireWithin(diagnosticsMode, /ExportWorkerDiagnostics/, "Phase 27 ExportWorkerDiagnostics mounted in Diagnostics"));
checkMessage(requireWithin(exportWorkerDiagnostics, /Export Worker Diagnostics/i, "Phase 27 Export Worker diagnostics panel"));
checkMessage(requireWithin(exportWorkerDiagnostics, /Readiness/i, "Phase 27 readiness summary"));
checkMessage(requireWithin(exportWorkerDiagnostics, /Scope/i, "Phase 27 scope summary"));
checkMessage(requireWithin(exportWorkerDiagnostics, /Planned Writes/i, "Phase 27 planned writes summary"));
checkMessage(requireWithin(exportWorkerDiagnostics, /Export Root/i, "Phase 27 export root summary"));
checkMessage(requireWithin(exportWorkerDiagnostics, /Blocked\s*\/\s*warnings/i, "Phase 27 blockers/warnings summary"));
checkMessage(requireWithin(exportWorkerDiagnostics, /phase27-lock-strip/i, "Phase 27 hard lock strip"));
checkMessage(requireWithin(diagnosticsMode, /VoiceAudioSettingsDiagnostics/, "Phase 28 VoiceAudioSettingsDiagnostics mounted in Diagnostics"));
checkMessage(requireWithin(appSource, /phase_28_voice_audio_settings_ui/, "Phase 28 voiceAudioSettings phase reader"));
checkMessage(requireWithin(voiceAudioSettingsDiagnostics, /Phase 28 Voice\/Audio Settings/i, "Phase 28 Voice/Audio Settings diagnostics panel"));
checkMessage(requireWithin(voiceAudioSettingsDiagnostics, /Readiness/i, "Phase 28 readiness summary"));
checkMessage(requireWithin(voiceAudioSettingsDiagnostics, /Voice Sources/i, "Phase 28 voice sources summary"));
checkMessage(requireWithin(voiceAudioSettingsDiagnostics, /Audio Plans/i, "Phase 28 audio plans summary"));
checkMessage(requireWithin(voiceAudioSettingsDiagnostics, /No BGM Policy/i, "Phase 28 no BGM policy summary"));
checkMessage(requireWithin(voiceAudioSettingsDiagnostics, /Provider Slots/i, "Phase 28 provider slots summary"));
checkMessage(requireWithin(voiceAudioSettingsDiagnostics, /Blockers\s*\/\s*warnings/i, "Phase 28 blockers/warnings summary"));
checkMessage(requireWithin(voiceAudioSettingsDiagnostics, /phase28-lock-strip/i, "Phase 28 hard lock strip"));
checkMessage(requireWithin(diagnosticsMode, /ProviderEnablementGateDiagnostics/, "Phase 30 ProviderEnablementGateDiagnostics mounted in Diagnostics"));
checkMessage(requireWithin(providerEnablementGateDiagnostics, /Provider Enablement Gate/i, "Phase 30 Provider Enablement Gate diagnostics panel"));
checkMessage(requireWithin(providerEnablementGateDiagnostics, /Readiness/i, "Phase 30 readiness summary"));
checkMessage(requireWithin(providerEnablementGateDiagnostics, /ready_for_confirmation/i, "Phase 30 ready_for_confirmation count"));
checkMessage(requireWithin(providerEnablementGateDiagnostics, /Token/i, "Phase 30 confirmation token placeholder status"));
checkMessage(requireWithin(providerEnablementGateDiagnostics, /Packet/i, "Phase 30 packet complete status"));
checkMessage(requireWithin(providerEnablementGateDiagnostics, /Closed Loop/i, "Phase 30 closed loop status"));
checkMessage(requireWithin(`${providerEnablementGateDiagnostics}\n${providerEnablementGateUiSummary}`, /Fast\s*\/\s*VIP\s*\/\s*text-to-video\s*\/\s*BGM prompt absent/i, "Phase 30 forbidden paths absent summary"));
checkMessage(requireWithin(`${providerEnablementGateDiagnostics}\n${providerEnablementGateUiSummary}`, /canSubmitProvider=false/i, "Phase 30 canSubmitProvider=false summary"));
checkMessage(requireWithin(`${providerEnablementGateDiagnostics}\n${providerEnablementGateUiSummary}`, /provider submit blocked/i, "Phase 30 provider submit blocked summary"));
checkMessage(requireWithin(`${providerEnablementGateDiagnostics}\n${providerEnablementGateUiSummary}`, /credential\/live submit\/shell locked/i, "Phase 30 credential/live submit/shell locks"));
checkMessage(requireWithin(providerEnablementGateDiagnostics, /Blockers\s*\/\s*warnings/i, "Phase 30 blockers/warnings summary"));
checkMessage(requireWithin(providerEnablementGateDiagnostics, /phase30-lock-strip/i, "Phase 30 hard lock strip"));
checkMessage(requireWithin(diagnosticsMode, /ProviderActionConfirmationReceiptDiagnostics/, "Phase 32 ProviderActionConfirmationReceiptDiagnostics mounted in Diagnostics"));
checkMessage(requireWithin(providerActionConfirmationReceiptDiagnostics, /Provider Action Confirmation Receipt/i, "Phase 32 Provider Action Confirmation Receipt diagnostics panel"));
checkMessage(requireWithin(providerActionConfirmationReceiptDiagnostics, /Readiness/i, "Phase 32 readiness summary"));
checkMessage(requireWithin(providerActionConfirmationReceiptDiagnostics, /Ready Receipts/i, "Phase 32 ready receipts summary"));
checkMessage(requireWithin(providerActionConfirmationReceiptDiagnostics, /Blocked/i, "Phase 32 blocked summary"));
checkMessage(requireWithin(providerActionConfirmationReceiptDiagnostics, /Confirmed Count/i, "Phase 32 confirmed count summary"));
checkMessage(requireWithin(providerActionConfirmationReceiptDiagnostics, /Provider Submit/i, "Phase 32 provider submit summary"));
checkMessage(requireWithin(providerActionConfirmationReceiptDiagnostics, /Credential\s*\/\s*Worker\s*\/\s*File/i, "Phase 32 credential/worker/file lock summary"));
checkMessage(requireWithin(`${providerActionConfirmationReceiptDiagnostics}\n${providerActionConfirmationReceiptUiSummary}`, /providerActionConfirmationReceipt/i, "Phase 32 providerActionConfirmationReceipt parser"));
checkMessage(requireWithin(`${providerActionConfirmationReceiptDiagnostics}\n${providerActionConfirmationReceiptUiSummary}`, /Phase\s*32/i, "Phase 32 Diagnostics engineering label"));
checkMessage(requireWithin(`${providerActionConfirmationReceiptDiagnostics}\n${providerActionConfirmationReceiptUiSummary}`, /provider submit blocked/i, "Phase 32 provider submit blocked summary"));
checkMessage(requireWithin(`${providerActionConfirmationReceiptDiagnostics}\n${providerActionConfirmationReceiptUiSummary}`, /credential\/worker\/file locked/i, "Phase 32 credential/worker/file locked summary"));
checkMessage(requireWithin(providerActionConfirmationReceiptDiagnostics, /phase32-lock-strip/i, "Phase 32 hard lock strip"));
checkMessage(requireWithin(diagnosticsMode, /ProviderExecutionHandoffDiagnostics/, "Phase 33 ProviderExecutionHandoffDiagnostics mounted in Diagnostics"));
checkMessage(requireWithin(providerExecutionHandoffDiagnostics, /Provider Execution Handoff/i, "Phase 33 Provider Execution Handoff diagnostics panel"));
checkMessage(requireWithin(providerExecutionHandoffDiagnostics, /Readiness/i, "Phase 33 readiness summary"));
checkMessage(requireWithin(providerExecutionHandoffDiagnostics, /Handoff Count/i, "Phase 33 handoff count summary"));
checkMessage(requireWithin(providerExecutionHandoffDiagnostics, /Blocked Count/i, "Phase 33 blocked count summary"));
checkMessage(requireWithin(providerExecutionHandoffDiagnostics, /Confirmed Count/i, "Phase 33 confirmed count summary"));
checkMessage(requireWithin(providerExecutionHandoffDiagnostics, /Provider Submit/i, "Phase 33 provider submit lock summary"));
checkMessage(requireWithin(providerExecutionHandoffDiagnostics, /Credential\s*\/\s*Worker\s*\/\s*File/i, "Phase 33 credential/worker/file lock summary"));
checkMessage(requireWithin(`${providerExecutionHandoffDiagnostics}\n${providerExecutionHandoffUiSummary}`, /providerExecutionHandoff/i, "Phase 33 providerExecutionHandoff parser"));
checkMessage(requireWithin(`${providerExecutionHandoffDiagnostics}\n${providerExecutionHandoffUiSummary}`, /Final Action Gate/i, "Phase 33 final action gate diagnostics label"));
checkMessage(requireWithin(`${providerExecutionHandoffDiagnostics}\n${providerExecutionHandoffUiSummary}`, /provider submit locked/i, "Phase 33 provider submit locked summary"));
checkMessage(requireWithin(`${providerExecutionHandoffDiagnostics}\n${providerExecutionHandoffUiSummary}`, /credential\/worker\/file locked/i, "Phase 33 credential/worker/file locked summary"));
checkMessage(requireWithin(providerExecutionHandoffDiagnostics, /phase33-lock-strip/i, "Phase 33 hard lock strip"));
checkMessage(requireWithin(diagnosticsMode, /LocalOrchestratorDiagnostics/, "Phase 34 LocalOrchestratorDiagnostics mounted in Diagnostics"));
checkMessage(requireWithin(localOrchestratorDiagnostics, /Local Orchestrator\s*\/\s*Auto-continue/i, "Phase 34 Local Orchestrator / Auto-continue diagnostics panel"));
checkMessage(requireWithin(localOrchestratorDiagnostics, /Readiness/i, "Phase 34 readiness summary"));
checkMessage(requireWithin(localOrchestratorDiagnostics, /Queue Total/i, "Phase 34 queue total summary"));
checkMessage(requireWithin(localOrchestratorDiagnostics, /Ready/i, "Phase 34 ready count summary"));
checkMessage(requireWithin(localOrchestratorDiagnostics, /Waiting/i, "Phase 34 waiting count summary"));
checkMessage(requireWithin(localOrchestratorDiagnostics, /Running\s*\/\s*Output/i, "Phase 34 running/waiting-output summary"));
checkMessage(requireWithin(localOrchestratorDiagnostics, /QA Pending/i, "Phase 34 QA pending summary"));
checkMessage(requireWithin(localOrchestratorDiagnostics, /Needs Review|needs review/i, "Phase 34 needs-review summary"));
checkMessage(requireWithin(localOrchestratorDiagnostics, /Stalled/i, "Phase 34 stalled summary"));
checkMessage(requireWithin(localOrchestratorDiagnostics, /Auto-continue/i, "Phase 34 auto-continue next-ready summary"));
checkMessage(requireWithin(localOrchestratorDiagnostics, /Provider\s*\/\s*file\s*\/\s*daemon locks/i, "Phase 34 provider/file/daemon locks summary"));
checkMessage(requireWithin(localOrchestratorDiagnostics, /Blockers\s*\/\s*warnings/i, "Phase 34 blockers/warnings summary"));
checkMessage(requireWithin(`${localOrchestratorDiagnostics}\n${localOrchestratorUiSummary}`, /localOrchestrator/i, "Phase 34 localOrchestrator fail-soft parser"));
checkMessage(requireWithin(`${localOrchestratorDiagnostics}\n${localOrchestratorUiSummary}`, /plan-only/i, "Phase 34 plan-only auto-continue summary"));
checkMessage(requireWithin(`${localOrchestratorDiagnostics}\n${localOrchestratorUiSummary}`, /provider\/file\/daemon locked/i, "Phase 34 provider/file/daemon lock text"));
checkMessage(requireWithin(localOrchestratorDiagnostics, /phase34-lock-strip/i, "Phase 34 hard lock strip"));
checkMessage(requireWithin(previewPlayerQueue, /draftPreview\.events/, "Phase 21/23 Preview Player queue must use previewExport.draftPreview.events"));
checkMessage(requireWithin(previewPlayerQueue, /image_hold/, "Phase 21/23 Preview Player queue must include image holds"));
checkMessage(requireWithin(previewPlayerQueue, /video_clip/, "Phase 21/23 Preview Player queue must include video clips"));
checkMessage(requireWithin(`${previewPlayerQueue}\n${previewQueueKind}`, /missing_placeholder/, "Phase 21/23 Preview Player queue must include missing placeholders"));
checkMessage(requireWithin(minimalPreview, /buildPreviewPlayerQueue\s*\(/, "Phase 21/23 MinimalPreview must render the Preview Player queue"));
checkMessage(requireWithin(minimalPreview, /preview-stage-card/, "Phase 21/23 Preview Player needs a large preview shell"));
checkMessage(requireWithin(stylesSource, /preview-stage-card/, "Phase 21/23 Preview Player stage styling"));

checkMessage(requireAny(appSource, [/Asset Library/, /function\s+AssetLibrary/, /className="[^"]*asset-library/], "Asset Library main UI naming"));
checkMessage(requireAny(appSource, [/Preview/, /function\s+PreviewTimeline/, /className="[^"]*preview/], "Preview main UI"));
checkMessage(requireAny(appSource, [/Selected/, /Scope/], "Selected/Scope director context"));
checkMessage(requireAny(appSource, [/Story/, /section\.label/, /storySections/, /All Shots/], "Story/section tabs"));
checkMessage(requireAny(appSource, [/Diagnostics/, /diagnostics/], "Diagnostics entry"));
for (const label of ["角色主参考", "三视图", "表情", "场景 master", "多视角", "风格锚图", "文本约束"]) {
  checkMessage(requireWithin(minimalAssetLibrary, new RegExp(label), `Asset Library ${label} slot copy`));
}

checkMessage(requireAny(stylesSource, [/asset-library/, /\.asset-panel/], "Asset Library styling hook"));
checkMessage(requireWithin(stylesSource, /asset-slot-strip/, "Asset Library slot strip styling hook"));
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

const minimalDirectorSurface = `${directorMode}\n${directorProgressStrip}\n${realPilotDirectorStatus}\n${minimalAgentPanel}\n${minimalTopNav}\n${minimalProjectPlan}`;
const minimalDirectorButtonSurface = Array.from(minimalDirectorSurface.matchAll(/<button\b[\s\S]*?<\/button>/gi))
  .map((match) => match[0])
  .join("\n");
for (const [term, pattern] of [
  ["Run", /\bRun\b/i],
  ["Submit", /\bSubmit\b/i],
  ["Execute", /\bExecute\b/i],
  ["API key", /API\s*key/i],
  ["credential", /credential/i],
  ["shell", /shell/i],
  ["provider prompt", /provider\s+prompt/i],
  ["automatic execution", /automatic\s+execution|自动执行/i],
  ["direct submit", /direct\s+submit|直接提交/i],
  ["immediate generation", /immediate\s+generation|立即生成/i],
]) {
  check(!pattern.test(minimalDirectorSurface), `Phase 44 main Director surface must not expose ${term}`);
}
for (const copy of ["Run", "Submit", "Execute", "直接提交", "自动执行", "立即生成"]) {
  check(
    !new RegExp(copy.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(minimalDirectorButtonSurface),
    `Phase 44 main Director surface must not expose dangerous ${copy} button`,
  );
}
const forbiddenMinimalTerms = [
  ["Queue Shell", /Queue\s+Shell/i],
  ["Provider Lock", /Provider\s+Lock/i],
  ["Task Envelope", /Task\s+Envelope|taskEnvelope/i],
  ["Desktop Runtime", /Desktop\s+Runtime/i],
  ["Permission Shell", /Permission\s+Shell/i],
  ["Subagent Worker Runtime", /Subagent\s+Worker\s+Runtime/i],
  ["validated envelope", /validated\s+envelope/i],
  ["structured result", /structured\s+result/i],
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
  ["Image2 Asset", /Image2\s+Asset/i],
  ["Image2 runtime", /Image2\s+runtime/i],
  ["Keyframe Runtime", /Keyframe\s+Runtime/i],
  ["keyframe pair", /keyframe\s+pair/i],
  ["end-frame derivation", /end[-\s]?frame\s+derivation/i],
  ["provider locks", /provider\s+locks?/i],
  ["Export Worker", /Export\s+Worker/i],
  ["file mutation", /file\s+mutation/i],
  ["write files", /write\s+files/i],
  ["export manifest", /export\s+manifest/i],
  ["project IO contract", /project\s+IO\s+contract/i],
];
for (const [term, pattern] of forbiddenMinimalTerms) {
  check(!pattern.test(minimalDirectorSurface), `DirectorMode/MinimalAgentPanel must not expose ${term}`);
}

const phase2123DirectorSurface = [
  directorMode,
  directorProgressStrip,
  realPilotDirectorStatus,
  minimalTopNav,
  minimalAgentPanel,
  minimalAssetLibrary,
  minimalPreview,
  minimalProjectPlan,
].join("\n");
const phase2123ForbiddenMainTerms = [
  ["providerSubmissionForbidden", /providerSubmissionForbidden/i],
  ["schema", /schema/i],
  ["manifest", /manifest/i],
  ["TaskEnvelope", /Task\s*Envelope|TaskEnvelope/i],
  ["Image2 Runtime", /Image2\s+Runtime/i],
  ["Voice Source Library", /Voice\s+Source\s+Library/i],
  ["Knowledge Pack Manager", /Knowledge\s+Pack\s+Manager/i],
  ["Knowledge Router", /Knowledge\s+Router/i],
  ["Knowledge Library", /Knowledge\s+Library/i],
  ["Export Worker", /Export\s+Worker/i],
  ["file mutation", /file\s+mutation/i],
  ["write files", /write\s+files/i],
  ["export manifest", /export\s+manifest/i],
  ["project IO contract", /project\s+IO\s+contract/i],
];
for (const [term, pattern] of phase2123ForbiddenMainTerms) {
  const count = countPattern(phase2123DirectorSurface, pattern);
  check(count === 0, `Phase 21/23 main Director surface must expose 0 ${term} term(s), found ${count}`);
}
const phase26ForbiddenMainTerms = [
  ["Agent/CLI Mock Runner", /Agent\/CLI\s+Mock\s+Runner/i],
  ["Codex spawn", /Codex\s+spawn|spawn\s+Codex/i],
  ["Codex resume", /Codex\s+resume|resume\s+Codex/i],
  ["provider submit", /provider\s+submit/i],
  ["validated envelope", /validated\s+envelope/i],
  ["replacement proof", /replacement\s+proof/i],
];
for (const [term, pattern] of phase26ForbiddenMainTerms) {
  const count = countPattern(phase2123DirectorSurface, pattern);
  check(count === 0, `Phase 26 main Director surface must expose 0 ${term} term(s), found ${count}`);
}
const phase28ForbiddenMainTerms = [
  ["Phase 28 Voice/Audio Settings", /Phase\s+28\s+Voice\/Audio\s+Settings/i],
  ["Voice/Audio Settings", /Voice\/Audio\s+Settings/i],
  ["Voice/Audio Settings readiness", /Voice\/Audio\s+Settings\s+readiness/i],
  ["Provider Slots", /Provider\s+Slots/i],
  ["provider slots planned/live", /provider\s+slots\s+planned\/live/i],
  ["hard lock strip", /hard\s+lock\s+strip/i],
  ["TTS submit", /TTS\s+submit/i],
  ["music submit", /music\s+submit/i],
  ["audio provider", /audio\s+provider/i],
  ["provider live", /provider\s+live/i],
];
for (const [term, pattern] of phase28ForbiddenMainTerms) {
  const count = countPattern(phase2123DirectorSurface, pattern);
  check(count === 0, `Phase 28 main Director surface must expose 0 ${term} term(s), found ${count}`);
}
const phase29ForbiddenMainTerms = [
  ["Codex CLI Adapter Spike", /Codex\s+CLI\s+Adapter\s+Spike/i],
  ["Codex CLI Adapter readiness", /Codex\s+CLI\s+Adapter\s+readiness/i],
  ["Run Codex", /Run\s+Codex/i],
  ["Spawn Codex", /Spawn\s+Codex/i],
  ["Resume Codex", /Resume\s+Codex/i],
  ["Execute CLI", /Execute\s+CLI/i],
  ["Run CLI", /Run\s+CLI/i],
  ["Run Adapter", /Run\s+Adapter/i],
  ["Submit Provider", /Submit\s+Provider/i],
  ["validated envelope", /validated\s+envelope/i],
  ["structured result", /structured\s+result/i],
  ["adapter shape", /adapter\s+shape/i],
];
for (const [term, pattern] of phase29ForbiddenMainTerms) {
  const count = countPattern(phase2123DirectorSurface, pattern);
  check(count === 0, `Phase 29 main Director surface must expose 0 ${term} term(s), found ${count}`);
}
const phase30ForbiddenMainTerms = [
  ["Provider Enablement Gate", /Provider\s+Enablement\s+Gate/i],
  ["provider/gate/packet/credential/shell", /provider|gate|packet|credential|shell/i],
  ["Fast/VIP/text-to-video/BGM prompt", /Fast|VIP|text-to-video|BGM\s+prompt/i],
  ["ready_for_confirmation", /ready_for_confirmation/i],
  ["canSubmitProvider", /canSubmitProvider/i],
  ["provider submit", /provider\s+submit/i],
];
for (const [term, pattern] of phase30ForbiddenMainTerms) {
  const count = countPattern(phase2123DirectorSurface, pattern);
  check(count === 0, `Phase 30 main Director surface must expose 0 ${term} term(s), found ${count}`);
}
const phase32ForbiddenMainTerms = [
  ["Phase32", /Phase\s*32/i],
  ["Action-time Confirmation Receipt", /Action[-\s]?time\s+Confirmation\s+Receipt/i],
  ["Provider Action Confirmation Receipt", /Provider\s+Action\s+Confirmation\s+Receipt/i],
  ["providerActionConfirmationReceipt", /providerActionConfirmationReceipt/i],
  ["canSubmitProvider", /canSubmitProvider/i],
  ["providerSubmitAllowed", /providerSubmitAllowed/i],
  ["Provider Submit", /Provider\s+Submit/i],
];
for (const [term, pattern] of phase32ForbiddenMainTerms) {
  const count = countPattern(phase2123DirectorSurface, pattern);
  check(count === 0, `Phase 32 main Director surface must expose 0 ${term} term(s), found ${count}`);
}
const phase33ForbiddenMainTerms = [
  ["Phase33", /Phase\s*33/i],
  ["Provider Execution Handoff", /Provider\s+Execution\s+Handoff/i],
  ["Final Action Gate", /Final\s+Action\s+Gate/i],
  ["providerExecutionHandoff", /providerExecutionHandoff/i],
  ["Submit Provider", /Submit\s+Provider/i],
  ["Confirm Action", /Confirm\s+Action/i],
  ["Confirm Provider", /Confirm\s+Provider/i],
  ["Record Confirmation", /Record\s+Confirmation/i],
  ["provider submit", /provider\s+submit/i],
  ["canSubmitProvider", /canSubmitProvider/i],
];
for (const [term, pattern] of phase33ForbiddenMainTerms) {
  const count = countPattern(phase2123DirectorSurface, pattern);
  check(count === 0, `Phase 33 main Director surface must expose 0 ${term} term(s), found ${count}`);
}
const phase34ForbiddenMainTerms = [
  ["Phase34", /Phase\s*34/i],
  ["Local Orchestrator", /Local\s+Orchestrator/i],
  ["auto-continue", /auto[-\s]?continue/i],
  ["queue machine", /queue\s+machine/i],
  ["daemon", /daemon/i],
  ["Codex spawn", /Codex\s+spawn|spawn\s+Codex/i],
  ["provider submit", /provider\s+submit/i],
  ["runtimeState.localOrchestrator", /runtimeState\.localOrchestrator|localOrchestrator/i],
  ["next-ready", /next[-\s]?ready/i],
  ["waiting output", /waiting\s+output/i],
];
for (const [term, pattern] of phase34ForbiddenMainTerms) {
  const count = countPattern(phase2123DirectorSurface, pattern);
  check(count === 0, `Phase 34 main Director surface must expose 0 ${term} term(s), found ${count}`);
}
const phase35ForbiddenMainTerms = [
  ["Local Orchestrator", /Local\s+Orchestrator/i],
  ["TaskEnvelope", /Task\s*Envelope|TaskEnvelope/i],
  ["manifest", /manifest/i],
  ["provider submit", /provider\s+submit/i],
  ["spawn", /spawn/i],
  ["daemon", /daemon/i],
  ["credential", /credential/i],
  ["shell", /shell/i],
  ["Execute", /\bExecute\b/i],
  ["Run", /\bRun\b/i],
  ["Submit", /\bSubmit\b/i],
];
for (const [term, pattern] of phase35ForbiddenMainTerms) {
  const count = countPattern(phase2123DirectorSurface, pattern);
  check(count === 0, `Phase 35 main Director surface must expose 0 ${term} term(s), found ${count}`);
}
check(!/Formal\s+Gate|Proxy\s+Duration|Draft\s+Events|blockedPlaceholder/i.test(minimalPreview), "Preview Player copy must stay short and not show gate/proxy counters");
check(/locked/i.test(minimalAssetLibrary) && /candidate/i.test(minimalAssetLibrary) && /review/i.test(minimalAssetLibrary), "Asset Library must keep locked/candidate/review consistency states");

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

checkMessage(requireWithin(diagnosticsMode, /KnowledgePackManager/, "Phase 25 Knowledge Pack Manager mounted in Diagnostics"));
checkMessage(requireWithin(settingsShell, /Knowledge Pack Manager readiness/i, "Phase 25 Knowledge Pack Manager readiness summary in Settings"));
checkMessage(requireWithin(settingsShell, /Agent\/CLI Mock Runner readiness/i, "Phase 26 Agent/CLI Mock Runner readiness summary in Settings"));
checkMessage(requireWithin(settingsShell, /adapter boundary mock\/no-op only/i, "Phase 26 adapter boundary summary in Settings"));
checkMessage(requireWithin(settingsShell, /Codex CLI Adapter readiness/i, "Phase 29 Codex CLI Adapter readiness summary in Settings"));
checkMessage(requireWithin(settingsShell, /spawn\/resume/i, "Phase 29 spawn/resume settings summary"));
checkMessage(requireWithin(settingsShell, /Export Worker readiness/i, "Phase 27 Export Worker readiness summary in Settings"));
checkMessage(requireWithin(settingsShell, /export IO scope/i, "Phase 27 export IO scope summary in Settings"));
checkMessage(requireWithin(settingsShell, /Voice\/Audio Settings readiness/i, "Phase 28 Voice/Audio Settings readiness summary in Settings"));
checkMessage(requireWithin(settingsShell, /source\(s\)/i, "Phase 28 source counts in Settings"));
checkMessage(requireWithin(settingsShell, /audio plan\(s\)/i, "Phase 28 audio plan counts in Settings"));
checkMessage(requireWithin(settingsShell, /no BGM/i, "Phase 28 no BGM summary in Settings"));
checkMessage(requireWithin(settingsShell, /provider live/i, "Phase 28 provider live count in Settings"));
checkMessage(requireWithin(settingsShell, /Provider Enablement Gate readiness/i, "Phase 30 Provider Enablement Gate readiness summary in Settings"));
checkMessage(requireWithin(settingsShell, /ready_for_confirmation/i, "Phase 30 ready_for_confirmation count in Settings"));
checkMessage(requireWithin(`${settingsShell}\n${providerEnablementGateUiSummary}`, /provider submit blocked/i, "Phase 30 provider submit blocked summary in Settings"));
checkMessage(requireWithin(settingsShell, /Provider Action Confirmation readiness/i, "Phase 32 Provider Action Confirmation readiness summary in Settings"));
checkMessage(requireWithin(settingsShell, /ready receipt\(s\)/i, "Phase 32 ready receipt count in Settings"));
checkMessage(requireWithin(settingsShell, /confirmed/i, "Phase 32 confirmed count in Settings"));
checkMessage(requireWithin(`${settingsShell}\n${providerActionConfirmationReceiptUiSummary}`, /provider submit blocked/i, "Phase 32 provider submit blocked summary in Settings"));
checkMessage(requireWithin(`${settingsShell}\n${providerActionConfirmationReceiptUiSummary}`, /credential\/worker\/file locked/i, "Phase 32 credential/worker/file locked summary in Settings"));
checkMessage(requireWithin(settingsShell, /Provider Execution Handoff readiness/i, "Phase 33 Provider Execution Handoff readiness summary in Settings"));
checkMessage(requireWithin(settingsShell, /handoff\(s\)/i, "Phase 33 handoff count in Settings"));
checkMessage(requireWithin(`${settingsShell}\n${providerExecutionHandoffUiSummary}`, /provider submit locked/i, "Phase 33 provider submit locked summary in Settings"));
checkMessage(requireWithin(`${settingsShell}\n${providerExecutionHandoffUiSummary}`, /credential\/worker\/file locked/i, "Phase 33 credential/worker/file locked summary in Settings"));
checkMessage(requireWithin(settingsShell, /Local Orchestrator:\s*\{localOrchestratorSummary\.readiness\}/i, "Phase 34 Local Orchestrator readiness summary in Settings"));
checkMessage(requireWithin(settingsShell, /next ready\s*\{localOrchestratorSummary\.nextReadyCount\}/i, "Phase 34 next-ready count in Settings"));
checkMessage(requireWithin(`${settingsShell}\n${localOrchestratorUiSummary}`, /plan-only/i, "Phase 34 plan-only summary in Settings"));
checkMessage(requireWithin(`${settingsShell}\n${localOrchestratorUiSummary}`, /provider\/file\/daemon locked/i, "Phase 34 provider/file/daemon locks in Settings"));
checkMessage(requireWithin(knowledgePackManager, /Enabled/i, "Phase 25 Knowledge summary enabled/total metric"));
checkMessage(requireWithin(knowledgePackManager, /Injected/i, "Phase 25 Knowledge summary injected/unique metric"));
checkMessage(requireWithin(knowledgePackManager, /Warnings\s*\/\s*Blockers/i, "Phase 25 Knowledge summary warnings/blockers metric"));
checkMessage(requireWithin(knowledgePackManager, /Budget Used/i, "Phase 25 Knowledge summary budget-used metric"));
checkMessage(requireWithin(`${knowledgeUiSummary}\n${knowledgePackManager}`, /Hard lock/i, "Phase 25 Knowledge hard-lock reminder"));
check(!/route-tester|route-results|knowledge-task-table|Category distribution|Consumer distribution|matched pack|snippet/i.test(knowledgePackManager), "Knowledge Pack Manager must stay summary-only; no route tester, match table, distributions, or snippet details");
check(!/knowledge-manager|Knowledge\s+Pack|Knowledge\s+Router|Knowledge\s+Library/i.test(phase2123DirectorSurface), "Director main surface must not contain a Knowledge panel or Knowledge engineering copy");
check(!/route-tester|route-results|knowledge-task-table/i.test(stylesSource), "Knowledge diagnostics CSS must not keep heavy route tester or task-table shells");
const forbiddenButtonCopy = [
  "Live Submit",
  "Run Codex",
  "Spawn Codex",
  "Resume Codex",
  "Execute CLI",
  "Run CLI",
  "Submit Provider",
  "Save Credentials",
  "Save Credential",
  "Run Provider",
  "Run Adapter",
  "Confirm Provider",
  "Confirm Action",
  "Confirm Receipt",
  "Record Confirmation",
  "Submit Receipt",
  "Review Submit",
  "Start Daemon",
  "Continue Now",
  "Start Orchestrator",
  "Run Orchestrator",
  "Export Now",
  "Write Files",
  "Create Directory",
  "Copy Media",
  "Render Media",
  "Generate FCPXML",
  "Open Shell",
  "Run Export Worker",
  "Generate Audio",
  "Run TTS",
  "Generate BGM",
  "Upload Voice Sample",
  "Save API Key",
  "Submit Audio Provider",
  "Write Audio File",
  "Generate Image",
  "Generate Video",
  "Enable Live Submit",
  "Run Image2",
  "Run Seedance",
];
for (const copy of forbiddenButtonCopy) {
  check(
    !new RegExp(`<button\\b[\\s\\S]{0,240}${copy.replace(/\s+/g, "\\s+")}`, "i").test(appSource),
    `UI must not expose ${copy} button copy`,
  );
}
const phase28ForbiddenButtonCopy = [
  "Generate Audio",
  "Run TTS",
  "Generate BGM",
  "Upload Voice Sample",
  "Save API Key",
  "Save Credentials",
  "Run Provider",
  "Submit Audio Provider",
  "Write Audio File",
];
for (const copy of phase28ForbiddenButtonCopy) {
  check(
    !new RegExp(copy.replace(/\s+/g, "\\s+"), "i").test(appSource),
    `Phase 28 UI must not expose ${copy} copy`,
  );
}

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
