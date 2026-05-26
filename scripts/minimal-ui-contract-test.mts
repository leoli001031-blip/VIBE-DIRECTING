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

function findOptionalFunctionBody(source, functionName) {
  const signature = `function ${functionName}`;
  return source.includes(signature) ? findFunctionBody(source, functionName) : "";
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

function extractStringLiterals(source) {
  return Array.from(source.matchAll(/(["'`])((?:\\.|(?!\1)[\s\S])*?)\1/g))
    .map((match) => match[2])
    .join("\n");
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
const directorModePath = "src/ui/director/DirectorModeShell.tsx";
const directorProgressStripPath = "src/ui/director/DirectorProgressStrip.tsx";
const minimalDirectorStatusDotPath = "src/ui/director/MinimalDirectorStatusDot.tsx";
const minimalTopNavPath = "src/ui/director/MinimalTopNav.tsx";
const minimalStoryFlowPath = "src/ui/director/MinimalStoryFlow.tsx";
const newVideoStartPath = "src/ui/director/NewVideoStart.tsx";
const newVideoProjectVibePlannerPath = "src/core/newVideoProjectVibePlanner.ts";
const minimalAssetLibraryPath = "src/ui/director/MinimalAssetLibrary.tsx";
const assetLibraryUiPath = "src/ui/director/assetLibraryUi.ts";
const creatorDeskPanelsPath = "src/ui/director/CreatorDeskPanels.tsx";
const creatorDeskProjectionPath = "src/ui/app/creatorDeskProjection.ts";
const minimalPreviewPath = "src/ui/director/MinimalPreview.tsx";
const minimalAgentPanelPath = "src/ui/director/MinimalAgentPanel.tsx";
const agentPanelProjectionPath = "src/ui/director/agentPanelProjection.ts";
const image2AssetGenerationActionPath = "src/ui/director/useImage2AssetGenerationAction.ts";
const image2EndFrameActionPath = "src/ui/director/useImage2EndFrameAction.ts";
const p6RealImage2ActionPath = "src/ui/director/useP6RealImage2Action.ts";
const localIndexTtsActionPath = "src/ui/director/useLocalIndexTtsAction.ts";
const localQwen3TtsCloneActionPath = "src/ui/director/useLocalQwen3TtsCloneAction.ts";
const minimalExportPath = "src/ui/director/MinimalExport.tsx";
const minimalAudioPlanPath = "src/ui/director/MinimalAudioPlan.tsx";
const appOverviewPath = "src/ui/common/AppOverview.tsx";
const projectRealChainPanelPath = "src/ui/project/ProjectRealChainPanel.tsx";
const projectFactsStripPath = "src/ui/diagnostics/ProjectFactsStrip.tsx";
const diagnosticsModePath = "src/ui/diagnostics/DiagnosticsMode.tsx";
const runtimeDiagnosticsProjectionPath = "src/ui/diagnostics/projections/runtimeDiagnostics.ts";
const providerGateDiagnosticsPath = "src/ui/diagnostics/ProviderGateDiagnostics.tsx";
const subagentWorkerRuntimeDiagnosticsPath = "src/ui/diagnostics/SubagentWorkerRuntimeDiagnostics.tsx";
const agentCliMockRunnerDiagnosticsPath = "src/ui/diagnostics/AgentCliMockRunnerDiagnostics.tsx";
const cliAdapterSpikeDiagnosticsPath = "src/ui/diagnostics/CliAdapterSpikeDiagnostics.tsx";
const exportWorkerDiagnosticsPath = "src/ui/diagnostics/ExportWorkerDiagnostics.tsx";
const voiceAudioSettingsDiagnosticsPath = "src/ui/diagnostics/VoiceAudioSettingsDiagnostics.tsx";
const localOrchestratorDiagnosticsPath = "src/ui/diagnostics/LocalOrchestratorDiagnostics.tsx";
const visualConsistencyContractDiagnosticsPath = "src/ui/diagnostics/VisualConsistencyContractDiagnostics.tsx";
const fullTaskSubagentPacketPlannerDiagnosticsPath = "src/ui/diagnostics/FullTaskSubagentPacketPlannerDiagnostics.tsx";
const knowledgePackUserManagementDiagnosticsPath = "src/ui/diagnostics/KnowledgePackUserManagementDiagnostics.tsx";
const workerRuntimeGateDiagnosticsPath = "src/ui/diagnostics/WorkerRuntimeGateDiagnostics.tsx";
const providerClosedLoopShellDiagnosticsPath = "src/ui/diagnostics/ProviderClosedLoopShellDiagnostics.tsx";
const betaAcceptanceDiagnosticsPath = "src/ui/diagnostics/BetaAcceptanceDiagnostics.tsx";
const videoPlanningDiagnosticsPath = "src/ui/diagnostics/VideoPlanningDiagnostics.tsx";
const image2KeyframeRuntimeDiagnosticsPath = "src/ui/diagnostics/Image2KeyframeRuntimeDiagnostics.tsx";
const realPilotDiagnosticsPath = "src/ui/diagnostics/RealPilotDiagnostics.tsx";
const settingsShellPath = "src/ui/diagnostics/SettingsShell.tsx";
const currentProjectRuntimeHookPath = "src/ui/app/useCurrentProjectRuntimePanels.ts";
const stylesPath = "src/styles.css";
const directorStylesPath = "src/styles/director.css";
const projectRealChainPanelCssPath = "src/ui/project/ProjectRealChainPanel.css";
const packagePath = "package.json";
const sequenceDocPath = "docs/core-development-sequence.md";
const contractDocPath = "docs/ui/minimal-director-ui-contract.md";

const appSource = stripComments(readText(appPath));
const directorModeSource = stripComments(readText(directorModePath));
const directorProgressStripSource = stripComments(readText(directorProgressStripPath));
const minimalDirectorStatusDotSource = stripComments(readText(minimalDirectorStatusDotPath));
const minimalTopNavSource = stripComments(readText(minimalTopNavPath));
const minimalStoryFlowSource = stripComments(readText(minimalStoryFlowPath));
const newVideoStartSource = stripComments(readText(newVideoStartPath));
const newVideoProjectVibePlannerSource = stripComments(readText(newVideoProjectVibePlannerPath));
const minimalAssetLibrarySource = stripComments(readText(minimalAssetLibraryPath));
const assetLibraryUiSource = stripComments(readText(assetLibraryUiPath));
const creatorDeskPanelsSource = stripComments(readText(creatorDeskPanelsPath));
const creatorDeskProjectionSource = stripComments(readText(creatorDeskProjectionPath));
const minimalPreviewSource = stripComments(readText(minimalPreviewPath));
const minimalAgentPanelSource = stripComments(readText(minimalAgentPanelPath));
const agentPanelProjectionSource = stripComments(readText(agentPanelProjectionPath));
const image2AssetGenerationActionSource = stripComments(readText(image2AssetGenerationActionPath));
const image2EndFrameActionSource = stripComments(readText(image2EndFrameActionPath));
const p6RealImage2ActionSource = stripComments(readText(p6RealImage2ActionPath));
const localIndexTtsActionSource = stripComments(readText(localIndexTtsActionPath));
const localQwen3TtsCloneActionSource = stripComments(readText(localQwen3TtsCloneActionPath));
const minimalExportSource = stripComments(readText(minimalExportPath));
const minimalAudioPlanSource = stripComments(readText(minimalAudioPlanPath));
const appOverviewSource = stripComments(readText(appOverviewPath));
const projectRealChainPanelSource = stripComments(readText(projectRealChainPanelPath));
const projectFactsStripSource = stripComments(readText(projectFactsStripPath));
const diagnosticsModeSource = stripComments(readText(diagnosticsModePath));
const runtimeDiagnosticsProjectionSource = stripComments(readText(runtimeDiagnosticsProjectionPath));
const providerGateDiagnosticsSource = stripComments(readText(providerGateDiagnosticsPath));
const subagentWorkerRuntimeDiagnosticsSource = stripComments(readText(subagentWorkerRuntimeDiagnosticsPath));
const agentCliMockRunnerDiagnosticsSource = stripComments(readText(agentCliMockRunnerDiagnosticsPath));
const cliAdapterSpikeDiagnosticsSource = stripComments(readText(cliAdapterSpikeDiagnosticsPath));
const exportWorkerDiagnosticsSource = stripComments(readText(exportWorkerDiagnosticsPath));
const voiceAudioSettingsDiagnosticsSource = stripComments(readText(voiceAudioSettingsDiagnosticsPath));
const localOrchestratorDiagnosticsSource = stripComments(readText(localOrchestratorDiagnosticsPath));
const visualConsistencyContractDiagnosticsSource = stripComments(readText(visualConsistencyContractDiagnosticsPath));
const fullTaskSubagentPacketPlannerDiagnosticsSource = stripComments(readText(fullTaskSubagentPacketPlannerDiagnosticsPath));
const knowledgePackUserManagementDiagnosticsSource = stripComments(readText(knowledgePackUserManagementDiagnosticsPath));
const workerRuntimeGateDiagnosticsSource = stripComments(readText(workerRuntimeGateDiagnosticsPath));
const providerClosedLoopShellDiagnosticsSource = stripComments(readText(providerClosedLoopShellDiagnosticsPath));
const betaAcceptanceDiagnosticsSource = stripComments(readText(betaAcceptanceDiagnosticsPath));
const videoPlanningDiagnosticsSource = stripComments(readText(videoPlanningDiagnosticsPath));
const image2KeyframeRuntimeDiagnosticsSource = stripComments(readText(image2KeyframeRuntimeDiagnosticsPath));
const realPilotDiagnosticsSource = stripComments(readText(realPilotDiagnosticsPath));
const settingsShellSource = stripComments(readText(settingsShellPath));
const currentProjectRuntimeHookSource = stripComments(readText(currentProjectRuntimeHookPath));
const extractedDiagnosticsSources = [
  diagnosticsModeSource,
  runtimeDiagnosticsProjectionSource,
  providerGateDiagnosticsSource,
  subagentWorkerRuntimeDiagnosticsSource,
  agentCliMockRunnerDiagnosticsSource,
  cliAdapterSpikeDiagnosticsSource,
  exportWorkerDiagnosticsSource,
  voiceAudioSettingsDiagnosticsSource,
  localOrchestratorDiagnosticsSource,
  visualConsistencyContractDiagnosticsSource,
  fullTaskSubagentPacketPlannerDiagnosticsSource,
  knowledgePackUserManagementDiagnosticsSource,
  workerRuntimeGateDiagnosticsSource,
  providerClosedLoopShellDiagnosticsSource,
  betaAcceptanceDiagnosticsSource,
  videoPlanningDiagnosticsSource,
  image2KeyframeRuntimeDiagnosticsSource,
  realPilotDiagnosticsSource,
  settingsShellSource,
];
const stylesSource = stripComments(`${readText(directorStylesPath)}\n${readText(stylesPath)}\n${readText(projectRealChainPanelCssPath)}`);
const packageJson = readJson(packagePath);
const sequenceDoc = readText(sequenceDocPath);
const contractDoc = readText(contractDocPath);

const directorMode = findFunctionBody(directorModeSource, "DirectorMode");
const directorProgressStrip = findFunctionBody(directorProgressStripSource, "DirectorProgressStrip");
const directorProgressStripState = findFunctionBody(directorProgressStripSource, "buildDirectorProgressStripState");
const minimalDirectorStatusDot = findFunctionBody(minimalDirectorStatusDotSource, "MinimalDirectorStatusDot");
const minimalTopNav = findFunctionBody(minimalTopNavSource, "MinimalTopNav");
const minimalStoryFlow = findFunctionBody(minimalStoryFlowSource, "MinimalStoryFlow");
const newVideoStart = findFunctionBody(newVideoStartSource, "NewVideoStart");
const creatorDeskPanels = findFunctionBody(creatorDeskPanelsSource, "CreatorDeskPanels");
const creatorDeskProjection = findFunctionBody(creatorDeskProjectionSource, "buildCreatorDeskProjection");
const formatShotNumber = findFunctionBody(minimalStoryFlowSource, "formatShotNumber");
const shortStoryFunction = findFunctionBody(minimalStoryFlowSource, "shortStoryFunction");
const shotStatusLabel = findFunctionBody(minimalStoryFlowSource, "shotStatusLabel");
const minimalAgentPanel = findFunctionBody(minimalAgentPanelSource, "MinimalAgentPanel");
const cleanLabel = findFunctionBody(agentPanelProjectionSource, "cleanLabel");
const selectedScopeLabel = findFunctionBody(agentPanelProjectionSource, "selectedScopeLabel");
const productScopeLabel = findFunctionBody(agentPanelProjectionSource, "productScopeLabel");
const naturalWorkflowScopeLabel = findFunctionBody(agentPanelProjectionSource, "naturalWorkflowScopeLabel");
const workflowStatusLabel = findFunctionBody(agentPanelProjectionSource, "workflowStatusLabel");
const workflowNextStepLabel = findFunctionBody(agentPanelProjectionSource, "workflowNextStepLabel");
const workflowBadgeLabels = findFunctionBody(agentPanelProjectionSource, "workflowBadgeLabels");
const workflowCanConfirm = findFunctionBody(agentPanelProjectionSource, "workflowCanConfirm");
const workflowPanelStatusLabel = findFunctionBody(agentPanelProjectionSource, "workflowPanelStatusLabel");
const workflowPanelNextStepLabel = findFunctionBody(agentPanelProjectionSource, "workflowPanelNextStepLabel");
const workflowPlanFacts = findFunctionBody(agentPanelProjectionSource, "workflowPlanFacts");
const realPilotDirectorStatus = findFunctionBody(appSource, "RealPilotDirectorStatus");
const oneShotActionPanel = findOptionalFunctionBody(appSource, "OneShotActionPanel");
const projectRealChainPanel = findFunctionBody(projectRealChainPanelSource, "ProjectRealChainPanel");
const videoPrepareSummaryStrip = findFunctionBody(diagnosticsModeSource, "VideoPrepareSummaryStrip");
const projectFactsStrip = findFunctionBody(projectFactsStripSource, "ProjectFactsStrip");
const projectStoreSnapshotForUi = findFunctionBody(appSource, "buildProjectStoreSnapshotForUi");
const projectFactsUiSummary = findFunctionBody(appSource, "buildProjectFactsUiSummary");
const confirmNewVideoProjectVibeDraft = findFunctionBody(appSource, "confirmNewVideoProjectVibeDraft");
const confirmImage2OneShot = currentProjectRuntimeHookSource;
const minimalAssetLibrary = findFunctionBody(minimalAssetLibrarySource, "MinimalAssetLibrary");
const assetSourceKindForPath = findFunctionBody(assetLibraryUiSource, "assetSourceKindForPath");
const assetLibraryUserBlockers = findFunctionBody(assetLibraryUiSource, "assetLibraryUserBlockers");
const minimalPreview = findFunctionBody(minimalPreviewSource, "MinimalPreview");
const previewItemLabel = findFunctionBody(minimalPreviewSource, "previewItemLabel");
const previewVideoStatusLabel = findFunctionBody(minimalPreviewSource, "previewVideoStatusLabel");
const previewVideoStageCopy = findFunctionBody(minimalPreviewSource, "previewVideoStageCopy");
const minimalExport = findFunctionBody(minimalExportSource, "MinimalExport");
const minimalAudioPlan = [
  findFunctionBody(minimalAudioPlanSource, "MinimalAudioPlan"),
  findFunctionBody(minimalAudioPlanSource, "MinimalAudioPlanContent"),
].join("\n");
const minimalProjectPlan = findFunctionBody(appSource, "buildMinimalProjectPlan");
const agentReceiptStatusLabel = findFunctionBody(agentPanelProjectionSource, "agentReceiptStatusLabel");
const agentReceiptCountSummary = findFunctionBody(agentPanelProjectionSource, "agentReceiptCountSummary");
const confirmAgentPlanProjection = findFunctionBody(agentPanelProjectionSource, "confirmAgentPlanProjection");
const previewPlayerQueue = findFunctionBody(minimalPreviewSource, "buildPreviewPlayerQueue");
const previewQueueKind = findFunctionBody(minimalPreviewSource, "previewQueueKind");
const appOverview = findFunctionBody(appOverviewSource, "AppOverview");
const desktopShellView = findFunctionBody(runtimeDiagnosticsProjectionSource, "buildDesktopRuntimeShellView");
const subagentWorkerRuntimeDiagnostics = findFunctionBody(subagentWorkerRuntimeDiagnosticsSource, "SubagentWorkerRuntimeDiagnostics");
const agentCliMockRunnerDiagnostics = findFunctionBody(agentCliMockRunnerDiagnosticsSource, "AgentCliMockRunnerDiagnostics");
const cliAdapterSpikeDiagnostics = findFunctionBody(cliAdapterSpikeDiagnosticsSource, "CliAdapterSpikeDiagnostics");
const exportWorkerDiagnostics = findFunctionBody(exportWorkerDiagnosticsSource, "ExportWorkerDiagnostics");
const voiceAudioSettingsDiagnostics = findFunctionBody(voiceAudioSettingsDiagnosticsSource, "VoiceAudioSettingsDiagnostics");
const providerEnablementGateDiagnostics = findFunctionBody(providerGateDiagnosticsSource, "ProviderEnablementGateDiagnostics");
const providerEnablementGateUiSummary = findFunctionBody(providerGateDiagnosticsSource, "buildProviderEnablementGateUiSummary");
const providerExecutionPermissionGateDiagnostics = findFunctionBody(providerGateDiagnosticsSource, "ProviderExecutionPermissionGateDiagnostics");
const providerExecutionPermissionGateUiSummary = findFunctionBody(providerGateDiagnosticsSource, "buildProviderExecutionPermissionGateUiSummary");
const providerActionConfirmationReceiptDiagnostics = findFunctionBody(providerGateDiagnosticsSource, "ProviderActionConfirmationReceiptDiagnostics");
const providerActionConfirmationReceiptUiSummary = findFunctionBody(providerGateDiagnosticsSource, "buildProviderActionConfirmationReceiptUiSummary");
const providerExecutionHandoffDiagnostics = findFunctionBody(providerGateDiagnosticsSource, "ProviderExecutionHandoffDiagnostics");
const providerExecutionHandoffUiSummary = findFunctionBody(providerGateDiagnosticsSource, "buildProviderExecutionHandoffUiSummary");
const localOrchestratorDiagnostics = findFunctionBody(localOrchestratorDiagnosticsSource, "LocalOrchestratorDiagnostics");
const localOrchestratorUiSummary = findFunctionBody(runtimeDiagnosticsProjectionSource, "buildLocalOrchestratorUiSummary");
const visualConsistencyContractDiagnostics = findFunctionBody(visualConsistencyContractDiagnosticsSource, "VisualConsistencyContractDiagnostics");
const visualConsistencyContractUiSummary = findFunctionBody(runtimeDiagnosticsProjectionSource, "buildVisualConsistencyContractUiSummary");
const fullTaskSubagentPacketPlannerDiagnostics = findFunctionBody(fullTaskSubagentPacketPlannerDiagnosticsSource, "FullTaskSubagentPacketPlannerDiagnostics");
const fullTaskSubagentPacketPlannerUiSummary = findFunctionBody(runtimeDiagnosticsProjectionSource, "buildFullTaskSubagentPacketPlannerUiSummary");
const knowledgePackUserManagementDiagnostics = findFunctionBody(knowledgePackUserManagementDiagnosticsSource, "KnowledgePackUserManagementDiagnostics");
const knowledgePackUserManagementUiSummary = findFunctionBody(runtimeDiagnosticsProjectionSource, "buildKnowledgePackUserManagementUiSummary");
const workerRuntimeGateDiagnostics = findFunctionBody(workerRuntimeGateDiagnosticsSource, "WorkerRuntimeGateDiagnostics");
const workerRuntimeGateUiSummary = findFunctionBody(runtimeDiagnosticsProjectionSource, "buildWorkerRuntimeGateUiSummary");
const providerClosedLoopShellDiagnostics = findFunctionBody(providerClosedLoopShellDiagnosticsSource, "ProviderClosedLoopShellDiagnostics");
const providerClosedLoopShellUiSummary = findFunctionBody(runtimeDiagnosticsProjectionSource, "buildProviderClosedLoopShellUiSummary");
const betaAcceptanceDiagnostics = findFunctionBody(betaAcceptanceDiagnosticsSource, "BetaAcceptanceDiagnostics");
const betaAcceptanceUiSummary = findFunctionBody(runtimeDiagnosticsProjectionSource, "buildBetaAcceptanceUiSummary");
const videoPlanningDiagnostics = findFunctionBody(videoPlanningDiagnosticsSource, "VideoPlanningDiagnostics");
const shotVideoGateInspector = findFunctionBody(appSource, "ShotVideoGateInspector");
const image2KeyframeRuntimeDiagnostics = findFunctionBody(image2KeyframeRuntimeDiagnosticsSource, "Image2KeyframeRuntimeDiagnostics");
const motionTypeLabel = findFunctionBody(runtimeDiagnosticsProjectionSource, "motionTypeLabel");
const motionEndpointFactsForShot = findFunctionBody(runtimeDiagnosticsProjectionSource, "motionEndpointFactsForShot");
const motionContractSummaryForGate = findFunctionBody(runtimeDiagnosticsProjectionSource, "motionContractSummaryForGate");
const firstMotionEndpointNotice = findFunctionBody(runtimeDiagnosticsProjectionSource, "firstMotionEndpointNotice");
const realPilotDiagnostics = findFunctionBody(realPilotDiagnosticsSource, "RealPilotDiagnostics");
const realImage2GateDiagnostics = findFunctionBody(appSource, "RealImage2GateDiagnostics");
const knowledgeUiSummary = findFunctionBody(diagnosticsModeSource, "buildKnowledgeUiSummary");
const knowledgePackManager = findFunctionBody(diagnosticsModeSource, "KnowledgePackManager");
const diagnosticsMode = findFunctionBody(diagnosticsModeSource, "DiagnosticsMode");
const settingsShell = findFunctionBody(settingsShellSource, "SettingsShell");
const appBody = findFunctionBody(appSource, "App");
const failures = [];
const defaultMountedDirectorSurface = [
  directorMode,
  minimalDirectorStatusDot,
  newVideoStart,
  minimalStoryFlow,
  minimalAssetLibrary,
  minimalPreview,
  minimalAgentPanel,
  minimalTopNav,
].join("\n");
const defaultMountedDirectorCopySurface = extractStringLiterals(defaultMountedDirectorSurface);
const defaultDirectorAppMountStart = appBody.indexOf('{mode === "director" && (');
const defaultDirectorAppMountEnd = appBody.indexOf('{mode === "inspector" && (', defaultDirectorAppMountStart);
const defaultDirectorAppMount = defaultDirectorAppMountStart >= 0 && defaultDirectorAppMountEnd > defaultDirectorAppMountStart
  ? appBody.slice(defaultDirectorAppMountStart, defaultDirectorAppMountEnd)
  : "";
checkMessage(requireWithin(appSource, /from\s+["']\.\/ui\/common\/AppOverview["']/, "App.tsx must import AppOverview"));
checkMessage(requireWithin(appBody, /mode\s*!==\s*["']director["'][\s\S]*<AppOverview\s+audit=\{audit\}\s+view=\{view\}\s+blockerCount=\{blockers\.length\}\s*\/>/, "App body must mount AppOverview outside Director mode"));
for (const label of ["Story Flow", "Visual Memory", "Queue", "Blockers"]) {
  checkMessage(requireWithin(appOverview, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `AppOverview must keep ${label} metric label`));
}
check(!/AppOverview/.test(defaultMountedDirectorSurface), "default mounted Director surface must not include AppOverview");
const minimalAgentLanguageSurface = [
  minimalAgentPanel,
  selectedScopeLabel,
  productScopeLabel,
  naturalWorkflowScopeLabel,
  workflowStatusLabel,
  workflowNextStepLabel,
  workflowBadgeLabels,
  workflowPanelStatusLabel,
  workflowPanelNextStepLabel,
  workflowPlanFacts,
].join("\n");

function check(condition, message) {
  if (!condition) failures.push(message);
}

function checkMessage(message) {
  if (message) failures.push(message);
}

check(
  packageJson.scripts?.["minimal-ui:test"] === "tsx scripts/minimal-ui-contract-test.mts",
  "package.json must expose minimal-ui:test",
);
check(
  packageJson.scripts?.["preview-player:test"] === "tsx scripts/preview-player-test.mts",
  "package.json must expose preview-player:test",
);
check(
  packageJson.scripts?.["minimal-runtime-projection:test"] === "tsx scripts/minimal-runtime-projection-test.mts",
  "package.json must expose minimal-runtime-projection:test",
);
checkMessage(requireWithin(sequenceDoc, /Phase 9\.4/i, "Phase 9.4 entry in docs/core-development-sequence.md"));
checkMessage(requireWithin(sequenceDoc, /Phase 17/i, "Phase 17 entry in docs/core-development-sequence.md"));
checkMessage(requireWithin(sequenceDoc, /Phase 21\/23/i, "Phase 21/23 entry in docs/core-development-sequence.md"));
checkMessage(requireWithin(sequenceDoc, /Phase 39：Knowledge Pack User Management/i, "Phase 39 Knowledge Pack User Management entry in docs/core-development-sequence.md"));
checkMessage(requireWithin(sequenceDoc, /UI 默认不展示术语库，只在 Inspector \/ Diagnostics 显示注入摘要/i, "Knowledge UI summary boundary in docs/core-development-sequence.md"));
checkMessage(requireWithin(sequenceDoc, /minimal-ui:test/i, "minimal-ui:test checklist item in docs/core-development-sequence.md"));
checkMessage(requireWithin(sequenceDoc, /preview-player:test/i, "preview-player:test checklist item in docs/core-development-sequence.md"));
checkMessage(requireWithin(contractDoc, /Minimal Director UI Contract/i, "minimal director UI contract doc title"));
checkMessage(requireWithin(contractDoc, /Diagnostics/i, "diagnostics boundary in minimal UI contract doc"));

checkMessage(requireWithin(directorModeSource, /function\s+DirectorMode\s*\(/, "DirectorMode component"));
checkMessage(requireWithin(appSource, /import\s+\{\s*DirectorMode\s*\}\s+from\s+"\.\/ui\/director\/DirectorModeShell"/, "App must import extracted DirectorModeShell component"));
checkMessage(requireWithin(appBody, /<DirectorMode\b/, "App must mount extracted DirectorMode component"));
checkMessage(requireWithin(directorProgressStripSource, /function\s+DirectorProgressStrip\s*\(/, "Phase 35 Director progress strip component"));
checkMessage(requireWithin(directorProgressStripSource, /function\s+buildDirectorProgressStripState\s*\(/, "Phase 35 Director progress strip state builder"));
checkMessage(requireWithin(appSource, /from\s+"\.\/ui\/director\/DirectorProgressStrip"/, "App must import extracted DirectorProgressStrip module"));
check(!/function\s+DirectorProgressStrip\s*\(/.test(appSource), "App must not keep DirectorProgressStrip component after extraction");
checkMessage(requireWithin(minimalDirectorStatusDotSource, /function\s+MinimalDirectorStatusDot\s*\(/, "minimal director status dot component"));
checkMessage(requireWithin(appSource, /import\s+\{\s*MinimalDirectorStatusDot\s*\}\s+from\s+"\.\/ui\/director\/MinimalDirectorStatusDot"/, "App must import extracted minimal director status dot component"));
checkMessage(requireWithin(minimalTopNavSource, /function\s+MinimalTopNav\s*\(/, "MinimalTopNav component"));
checkMessage(requireWithin(appSource, /import\s+\{\s*MinimalTopNav\s*\}\s+from\s+"\.\/ui\/director\/MinimalTopNav"/, "App must import extracted MinimalTopNav component"));
checkMessage(requireWithin(appBody, /<MinimalTopNav\b/, "App must mount extracted MinimalTopNav component"));
checkMessage(requireWithin(minimalAgentPanelSource, /function\s+MinimalAgentPanel\s*\(/, "MinimalAgentPanel component"));
checkMessage(requireWithin(directorModeSource, /import\s+\{\s*MinimalAgentPanel\s*\}\s+from\s+"\.\/MinimalAgentPanel"/, "DirectorMode must import extracted MinimalAgentPanel component"));
checkMessage(requireWithin(creatorDeskPanelsSource, /function\s+CreatorDeskPanels\s*\(/, "CreatorDeskPanels component"));
checkMessage(requireWithin(creatorDeskProjectionSource, /function\s+buildCreatorDeskProjection\s*\(/, "creator desk projection helper"));
checkMessage(requireWithin(appSource, /import\s+\{\s*buildCreatorDeskProjection\s*\}\s+from\s+"\.\/ui\/app\/creatorDeskProjection"/, "App must import creator desk projection helper"));
checkMessage(requireWithin(appBody, /creatorDeskProjection\s*=\s*useMemo\(\(\)\s*=>\s*buildCreatorDeskProjection\(/, "App must derive creator desk projection outside DirectorMode"));
checkMessage(requireWithin(appBody, /creatorDesk=\{creatorDeskProjection\}/, "App must pass creator desk projection into DirectorMode"));
checkMessage(requireWithin(directorModeSource, /import\s+\{\s*CreatorDeskPanels\s*\}\s+from\s+"\.\/CreatorDeskPanels"/, "DirectorMode must import CreatorDeskPanels"));
checkMessage(requireWithin(newVideoStartSource, /function\s+NewVideoStart\s*\(/, "NewVideoStart component"));
checkMessage(requireWithin(directorModeSource, /import\s+\{\s*NewVideoStart[\s\S]*\}\s+from\s+"\.\/NewVideoStart"/, "DirectorMode must import NewVideoStart"));
checkMessage(requireWithin(directorMode, /<NewVideoStart[\s\S]*shots=\{shots\}[\s\S]*canCreateLocalProject=\{canCreateLocalProject\}[\s\S]*onCreateLocalProject=\{onCreateLocalProject\}[\s\S]*onDraftConfirmed=\{onNewVideoDraftConfirmed\}/, "Director story view must mount the new video start entry before Story Flow with local project creation"));
checkMessage(requireWithin(directorModeSource, /NewVideoStartConfirmationContext[\s\S]*onNewVideoDraftConfirmed\?:[\s\S]*Promise<boolean \| void>/, "DirectorMode must expose async new-video confirmation context"));
check(!/buildDirectorWorkflowState|confirmAgentPlanProjection/.test(directorModeSource), "New-video entry must not reuse the old agent projection path in DirectorMode");
checkMessage(requireWithin(appSource, /buildNewVideoProjectVibeStagedTransaction[\s\S]*commitNewVideoProjectVibeStagedTransaction[\s\S]*NewVideoProjectVibeStagedTransactionPreview/, "App must import staged Project.vibe new-video helpers"));
checkMessage(requireWithin(appBody, /useRef<NewVideoProjectVibeStagedTransactionPreview \| undefined>\(undefined\)/, "App must hold the latest new-video staged transaction"));
checkMessage(requireWithin(confirmNewVideoProjectVibeDraft, /buildNewVideoProjectVibeStagedTransaction[\s\S]*newVideoStagedTransactionRef\.current[\s\S]*commitNewVideoProjectVibeStagedTransaction[\s\S]*saveProjectVibeDraft[\s\S]*applyProjectVibeProjectState/, "App new-video confirmation must stage, commit, save, then refresh Project.vibe state"));
check(!/createImage2GateForShot/.test(confirmNewVideoProjectVibeDraft), "App new-video confirmation must not open Image2 generation gates");
checkMessage(requireWithin(newVideoProjectVibePlannerSource, /buildScriptPlannerState[\s\S]*applyProjectVibeTransaction/, "New-video Project.vibe helper must bridge through script planner patch ops"));
checkMessage(requireWithin(newVideoProjectVibePlannerSource, /projectVibePatchOperations/, "New-video Project.vibe helper must use script planner Project.vibe operations"));
checkMessage(requireWithin(newVideoStartSource, /buildIntakeStagedPlanProjection[\s\S]*buildProjectIntakeDraft/, "NewVideoStart must use the intake draft projection helper"));
checkMessage(requireWithin(newVideoStartSource, /buildStoryDiscussionWorkspace[\s\S]*confirmStoryDiscussionDeltas[\s\S]*stageStoryDiscussionTurn/, "NewVideoStart must expose the discussion workspace path"));
checkMessage(requireWithin(newVideoStartSource, /stagedDeltas[\s\S]*待确认修改/, "NewVideoStart must surface staged discussion deltas for confirmation"));
checkMessage(requireWithin(newVideoStartSource, /确认修改[\s\S]*修改已确认/, "NewVideoStart must let users confirm staged discussion deltas before draft confirmation"));
for (const label of ["从新视频开始", "和 AI 导演说", "主角参考", "风格参考", "场景参考", "道具参考", "添加文件", "拖入图片、音乐或脚本", "发送", "选项目文件夹"]) {
  checkMessage(requireWithin(newVideoStartSource, new RegExp(label), `NewVideoStart must expose ${label}`));
}
checkMessage(requireWithin(newVideoStartSource, /待确认/, "NewVideoStart must expose pending draft copy inside details"));
checkMessage(requireWithin(newVideoStartSource, /确认/, "NewVideoStart must expose the confirm draft action"));
checkMessage(requireWithin(newVideoStartSource, /已确认|已进入故事流/, "NewVideoStart must expose confirmed draft copy"));
for (const label of ["导演讨论", "角色", "场景", "音频", "分镜", "发送", "确认修改"]) {
  checkMessage(requireWithin(newVideoStartSource, new RegExp(label), `NewVideoStart discussion workspace must expose ${label}`));
}
checkMessage(requireWithin(newVideoStartSource, /不会直接生成/, "NewVideoStart must state the intake draft does not directly generate"));
check(!/Project\.vibe|task[-\s]*envelope|provider|schema|queue|credential/i.test(extractStringLiterals(newVideoStartSource)), "NewVideoStart default copy must hide engineering terms");
checkMessage(requireWithin(newVideoStartSource, /referenceBindingPurposeLabels[\s\S]*prop:\s*"道具"[\s\S]*referenceBindingScopeLabels[\s\S]*whole_video:\s*"全片"[\s\S]*shot_range:\s*"指定镜头"[\s\S]*绑定用途/, "NewVideoStart reference images must expose editable purpose and shot-scope binding"));
checkMessage(requireWithin(newVideoStartSource, /声音参考[\s\S]*配乐参考/, "NewVideoStart audio copy must distinguish voice and music references"));
check(!/Voice\s+Source\s+Library/i.test(extractStringLiterals(newVideoStartSource)), "NewVideoStart default copy must not expose Voice Source Library");
checkMessage(requireWithin(newVideoStartSource, /<details\s+className="new-video-file-details"[\s\S]*className="new-video-file-list"/, "NewVideoStart selected material list must be behind details"));
checkMessage(requireWithin(newVideoStartSource, /className="new-video-asset-action new-video-primary-action"[\s\S]*发送/, "NewVideoStart bottom composer must expose the single submit action"));
checkMessage(requireWithin(newVideoStartSource, /Cmd Enter 发送/, "NewVideoStart composer must expose the keyboard send shortcut"));
check(!/className="new-video-start-footer"[\s\S]*<button[\s\S]*发送/.test(newVideoStartSource), "NewVideoStart footer must not duplicate the composer submit action");
checkMessage(requireWithin(newVideoStartSource, /className="new-video-plan-summary"[\s\S]*projectionTitleForDisplay[\s\S]*projection\.summary\.scriptPreview[\s\S]*confirmDraft/, "NewVideoStart organized draft default must show only title, short preview, and confirmation action"));
checkMessage(requireWithin(newVideoStartSource, /<details\s+className="new-video-plan-details"[\s\S]*projection\.summary\.assetCounts[\s\S]*projection\.missingChecklist[\s\S]*projection\.stagedPlan/, "NewVideoStart organized draft counts, checklist, and plan must live inside details"));
check(!/<details\s+className="new-video-plan-details"[^>]*open/.test(newVideoStartSource), "NewVideoStart organized draft details must be collapsed by default");
checkMessage(requireWithin(stylesSource, /\.new-video-plan-summary/, "NewVideoStart compact organized draft styling hook"));
checkMessage(requireWithin(stylesSource, /\.new-video-file-details/, "NewVideoStart material details styling hook"));
checkMessage(requireWithin(directorMode, /<CreatorDeskPanels\s+projection=\{creatorDesk\}\s+onRetryMissing=\{onRetryMissingBatch\}[\s\S]*onRetryItem=\{onRetryReviewItem\}[\s\S]*onRejectItem=\{onRejectReviewItem\}/, "Director story view must mount CreatorDeskPanels with per-item retry/reject actions"));
checkMessage(requireWithin(directorMode, /onSelectItem=\{\(item\)\s*=>\s*item\.shotId\s*&&\s*onSelectShot\(item\.shotId\)\}/, "Director story view must let Review Tray selection bind the normal Agent chat"));
checkMessage(requireWithin(directorMode, /storyboardProjectPlanInput=\{storyboardProjectPlanInput\}[\s\S]*onDirectorFeedbackConfirmed=\{onDirectorFeedbackConfirmed\}/, "DirectorMode must pass confirmed feedback recompiles into the normal Agent chat path"));
const creatorDeskPanelCopy = extractStringLiterals(creatorDeskPanelsSource);
checkMessage(requireWithin(creatorDeskPanelsSource, /故事[\s\S]*画面[\s\S]*复核列表/, "CreatorDeskPanels must expose creator-facing planner, preparation, and review panels"));
checkMessage(requireWithin(creatorDeskPanelsSource, /视频生成/, "CreatorDeskPanels must expose the video generation panel"));
for (const statusLabel of ["未生成", "已提交", "排队中", "生成中", "已完成", "可稍后恢复"]) {
  checkMessage(requireWithin(creatorDeskPanelsSource, new RegExp(statusLabel), `CreatorDeskPanels must expose ${statusLabel} video status`));
}
checkMessage(requireWithin(creatorDeskPanelsSource, /即梦常见约[\s\S]*分钟[\s\S]*可以离开后恢复查询/, "CreatorDeskPanels must explain long video waits with resume copy"));
checkMessage(requireWithin(creatorDeskPanelsSource, /镜头画面[\s\S]*画面到视频/, "CreatorDeskPanels must default to reference-to-video sequencing"));
checkMessage(requireWithin(creatorDeskPanelsSource, /requiresEndFrame[\s\S]*特殊结束画面/, "CreatorDeskPanels must keep endpoint-tail sequencing only for endpoint control items"));
for (const statusLabel of ["待复核", "待补齐", "可重试", "已通过", "已锁定"]) {
  checkMessage(requireWithin(creatorDeskPanelCopy, new RegExp(statusLabel), `CreatorDeskPanels must expose ${statusLabel}`));
}
for (const actionLabel of ["通过", "重试", "拒绝", "锁定"]) {
  checkMessage(requireWithin(creatorDeskPanelsSource, new RegExp(actionLabel), `CreatorDeskPanels must expose ${actionLabel} action`));
}
for (const lockLabel of ["角色参考", "场景参考", "道具参考", "本镜头画面"]) {
  checkMessage(requireWithin(creatorDeskPanelsSource, new RegExp(lockLabel), `CreatorDeskPanels must expose ${lockLabel} lock target`));
}
checkMessage(requireWithin(creatorDeskPanelsSource, /review-tray-select[\s\S]*onSelectItem\?\.\(item\)/, "Review Tray items must be selectable instead of opening a separate feedback box"));
checkMessage(requireWithin(stylesSource, /review-tray-select/, "Review Tray selected-item button must have neutral styling"));
checkMessage(requireWithin(appBody, /onRetryReviewItem=\{\(item\)\s*=>\s*applyCreatorReviewDecision\(item,\s*"retry"\)\}[\s\S]*onRejectReviewItem=\{\(item\)\s*=>\s*applyCreatorReviewDecision\(item,\s*"reject"\)\}/, "App must route per-item retry/reject through Project.vibe review decisions"));
checkMessage(requireWithin(appBody, /onLockReviewItem=\{\(item,\s*target\)\s*=>\s*applyCreatorReviewDecision\(item,\s*"lock",\s*target\)\}/, "App must route lock target through Project.vibe review decisions"));
checkMessage(requireWithin(appBody, /assetKind:\s*promotionMode\s*\?\s*lockAssetKind\s*:\s*"reference"[\s\S]*assetLabel[\s\S]*usedByShotIds/, "App must promote Review Tray locks with selected asset kind, label, and shot usage"));
check(!/Script Planner|Batch Generation|Review Tray|Needs review|Missing|Approved|Locked|Approve/.test(creatorDeskPanelCopy), "CreatorDeskPanels must not expose English planner/review copy in the default UI");
checkMessage(requireWithin(creatorDeskProjection, /concurrencyLabel:\s*"Concurrency 10"[\s\S]*retryLabel:\s*"Retry Missing"/, "creator batch projection must expose concurrency 10 and Retry Missing"));
checkMessage(requireWithin(creatorDeskProjection, /safetyLabel[\s\S]*Retry downshifts to/, "creator batch projection must expose retry downshift copy"));
checkMessage(requireWithin(creatorDeskProjection, /videoGeneration[\s\S]*buildCreatorVideoGenerationProjection/, "creator desk projection must carry Jimeng video generation status"));
check(!/function\s+(selectedScopeLabel|buildAgentPanelProjection|confirmAgentPlanProjection|agentProjectionBadges|agentProjectionNextStep|agentReceiptStatusLabel|agentReceiptCountSummary)\s*\(/.test(appSource), "App must not keep MinimalAgentPanel helper functions after extraction");
checkMessage(requireWithin(diagnosticsModeSource, /function\s+DiagnosticsMode\s*\(/, "DiagnosticsMode component"));
checkMessage(requireWithin(appBody, /showInspector\s*&&/, "Diagnostics entry in App mode switch/rendering"));
checkMessage(requireWithin(appBody, /mode\s*===\s*"director"/, "Director mode rendering"));
checkMessage(defaultDirectorAppMount ? undefined : "App default Director render block must be sliceable");
check(
  !/<div\s+className="minimal-gate-panel"|gate-phase-label|gate-shot-label|Image2 生成已锁定|Shot:\s*\{realImage2Gate|>\s*解锁生成\s*<|>\s*生成画面\s*<|>\s*重新锁定\s*</.test(defaultDirectorAppMount),
  "Default Director app mount must not expose the Image2 gate panel or generation gate controls",
);
checkMessage(requireWithin(appBody, /showInspector[\s\S]*<RealImage2GateDiagnostics[\s\S]*gate=\{realImage2Gate\}/, "Image2 gate detail must be mounted inside Diagnostics only"));
checkMessage(requireWithin(realImage2GateDiagnostics, /Image2 Gate[\s\S]*Shot[\s\S]*Schema[\s\S]*解锁生成[\s\S]*生成画面[\s\S]*重新锁定/, "Diagnostics must keep the Image2 gate detail and controls"));
checkMessage(requireWithin(stylesSource, /\.real-image2-gate-details/, "Diagnostics Image2 gate detail styling"));
check(!/\.minimal-gate-panel/.test(stylesSource), "Default Director gate panel styling must be removed");
check(!/<DirectorProgressStrip\s+runtimeState=\{runtimeState\}\s*\/>/.test(directorMode), "Director Clean Mode must not keep the detailed progress strip mounted on the three main pages");
checkMessage(requireWithin(appBody, /state=\{workbenchProgressState\}/, "App must pass the compact creator status dot into DirectorMode"));
checkMessage(requireWithin(directorMode, /\{statusNode\}/, "DirectorMode must render the injected compact creator status dot"));
checkMessage(requireWithin(diagnosticsMode, /<DirectorProgressStrip\s+state=\{buildDirectorProgressStripState\(\s*buildLocalOrchestratorUiSummary\(runtimeState\)\s*\)\}\s*\/>/, "Diagnostics must keep the detailed runtime progress strip"));
checkMessage(requireWithin(appBody, /buildDirectorProgressStripState\(\s*buildLocalOrchestratorUiSummary\(workbenchRuntimeState\)\s*\)/, "compact director status dot derives from runtime progress state in App"));
checkMessage(requireWithin(minimalDirectorStatusDotSource, /state\s*:\s*DirectorProgressStripState/, "compact director status dot must receive presentational progress state"));
check(!/state\.segments\.map/.test(minimalDirectorStatusDot), "compact director status dot must not render detailed progress counts");
checkMessage(requireWithin(appBody, /buildDirectorProgressStripState\(\s*buildLocalOrchestratorUiSummary\(/, "Phase 35 progress strip must derive from Phase 34 runtime summary"));
check(
  !/readDirectorProgressOverride|progressRecord|stateRecord\.directorProgress|uiRecord\.directorProgress/.test(directorProgressStripState),
  "Phase 35 progress strip must not accept UI-only progress overrides",
);
checkMessage(requireWithin(directorProgressStripState, /summary\.ready\s*\+\s*summary\.waiting/, "Phase 35 preparing count from local orchestrator summary"));
checkMessage(requireWithin(directorProgressStripState, /summary\.runningPlanned\s*\+\s*summary\.waitingOutput/, "Phase 35 working count from local orchestrator summary"));
checkMessage(requireWithin(directorProgressStripState, /summary\.qaPending\s*\+\s*summary\.needsReview/, "Phase 35 review count from local orchestrator summary"));
checkMessage(requireWithin(directorProgressStripState, /summary\.blocked\s*\+\s*summary\.failed\s*\+\s*summary\.stalled/, "Phase 35 blocked count from local orchestrator summary"));
checkMessage(requireWithin(directorProgressStripState, /summary\.completeVerified/, "Phase 35 complete count from local orchestrator summary"));
checkMessage(requireWithin(directorProgressStrip, /项目处理进度/, "Phase 35 progress strip accessible label"));
checkMessage(requireWithin(`${directorProgressStrip}\n${directorProgressStripState}`, /准备中/, "Phase 35 progress strip preparing label"));
checkMessage(requireWithin(`${directorProgressStrip}\n${directorProgressStripState}`, /生成中/, "Phase 35 progress strip working label"));
checkMessage(requireWithin(`${directorProgressStrip}\n${directorProgressStripState}`, /等待复核/, "Phase 35 progress strip review label"));
checkMessage(requireWithin(`${directorProgressStrip}\n${directorProgressStripState}`, /有阻断/, "Phase 35 progress strip blocked label"));
checkMessage(requireWithin(`${directorProgressStrip}\n${directorProgressStripState}`, /已完成/, "Phase 35 progress strip complete label"));
checkMessage(requireWithin(directorProgressStrip, /director-progress-track/, "Phase 35 progress strip visual track"));
checkMessage(requireWithin(directorProgressStrip, /state\.segments\.map/, "Phase 35 progress strip must render all five summary segments"));
checkMessage(requireWithin(directorProgressStrip, /0 0 0/, "Phase 35 zero-value progress segments must not stretch layout"));
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
checkMessage(requireWithin(minimalAgentPanel, /workflowCanConfirm\s*\(/, "Round 3 MinimalAgentPanel confirmation guard"));
checkMessage(requireWithin(agentPanelProjectionSource, /buildMinimalRuntimeProjection/, "One Creator Loop minimal runtime projection helper import/use"));
checkMessage(requireWithin(minimalAgentPanel, /buildAgentPanelProjection\s*\(/, "One Creator Loop MinimalAgentPanel must use creator-facing runtime projection"));
checkMessage(requireWithin(agentPanelProjectionSource, /confirmProjectPendingTransactionForRuntime/, "MinimalAgentPanel confirmation must use project transaction confirmation receipt"));
checkMessage(requireWithin(agentPanelProjectionSource, /stageProjectFactsForCommit/, "MinimalAgentPanel confirmation must stage project facts after receipt confirmation"));
checkMessage(requireWithin(minimalAgentPanel, /confirmAgentPlanProjection\s*\(/, "MinimalAgentPanel confirmPlan must use receipt-backed confirmation helper"));
checkMessage(requireWithin(confirmAgentPlanProjection, /confirmProjectPendingTransactionForRuntime\s*\(/, "receipt-backed confirmation helper must call confirmProjectPendingTransactionForRuntime"));
checkMessage(requireWithin(confirmAgentPlanProjection, /stageProjectFactsForCommit\s*\(/, "receipt-backed confirmation helper must call staged project facts commit API"));
checkMessage(requireWithin(confirmAgentPlanProjection, /buildProjectStoreApplyPlanForStagedFacts\s*\(\s*\{\s*receipt:\s*stagedReceipt,\s*generatedAt:\s*receipt\.generatedAt\s*\}\s*\)/, "Agent confirmation helper must build a read-only staged Project Store apply plan"));
checkMessage(requireWithin(confirmAgentPlanProjection, /receipt\.runtimeProjection/, "receipt-backed confirmation helper must project from receipt runtimeProjection"));
checkMessage(requireWithin(confirmAgentPlanProjection, /receipt\.queuedCount/, "receipt-backed confirmation helper must use receipt counts"));
checkMessage(requireWithin(confirmAgentPlanProjection, /stagedReceipt\.status\s*===\s*"staged"/, "Agent confirmation helper must surface only staged project fact commits"));
checkMessage(requireWithin(confirmAgentPlanProjection, /projectVibeWriteAllowed\s*===\s*false/, "receipt-backed confirmation helper must preserve project.vibe write lock"));
checkMessage(requireWithin(confirmAgentPlanProjection, /projectVibeWriteExecuted\s*===\s*false/, "receipt-backed confirmation helper must preserve project.vibe execution lock"));
checkMessage(requireWithin(confirmAgentPlanProjection, /noFileMutation\s*===\s*true/, "receipt-backed confirmation helper must preserve no file mutation lock"));
checkMessage(requireWithin(confirmAgentPlanProjection, /providerSubmissionForbidden\s*===\s*true/, "receipt-backed confirmation helper must preserve provider submission lock"));
checkMessage(requireWithin(confirmAgentPlanProjection, /workerSpawnForbidden\s*===\s*true/, "receipt-backed confirmation helper must preserve worker spawn lock"));
checkMessage(requireWithin(confirmAgentPlanProjection, /stagedReceipt\.providerCalled\s*===\s*false/, "staged project facts commit must preserve providerCalled=false"));
checkMessage(requireWithin(confirmAgentPlanProjection, /stagedReceipt\.workerSpawned\s*===\s*false/, "staged project facts commit must preserve workerSpawned=false"));
checkMessage(requireWithin(agentReceiptStatusLabel, /queuedCount\s*>\s*0[\s\S]*已加入计划/, "creator receipt status should prefer queued work over repair-only copy"));
checkMessage(requireWithin(agentReceiptCountSummary, /Math\.max\s*\(\s*receipt\.blockedCount\s*,\s*receipt\.runtimeProjection\.staleArtifactCount\s*\)/, "creator receipt count summary must merge blocked/stale repair counts"));
checkMessage(requireWithin(agentPanelProjectionSource, /function\s+agentProjectionBadges[\s\S]*confirmed[\s\S]*先等复核/, "confirmed Agent panel badges should avoid duplicate repair counts"));
checkMessage(requireWithin(minimalAgentPanel, /minimal-state-dots/, "One Creator Loop MinimalAgentPanel must render compact progress dots"));
checkMessage(requireWithin(`${minimalAgentPanel}\n${workflowCanConfirm}`, /dry_run_ready/, "Round 3 confirmation only after dry-run ready"));
checkMessage(requireWithin(agentPanelProjectionSource, /function\s+agentProjectionNextStep[\s\S]*canConfirm[\s\S]*确认后只会加入计划/, "Agent panel confirmable projection must show a confirmation next step before missing-reference copy"));
checkMessage(requireWithin(minimalAgentPanel, /agentProjectionNextStep\s*\([^)]*canConfirm/, "MinimalAgentPanel must pass the confirmation guard into projection next-step copy"));
checkMessage(requireWithin(minimalAgentPanel, /minimal-agent-selection-context/, "MinimalAgentPanel must show selected context before feedback"));
checkMessage(requireWithin(stylesSource, /minimal-agent-selection-context/, "MinimalAgentPanel selected context must have styling"));
checkMessage(requireWithin(directorMode, /director-bottom-composer/, "DirectorMode must mount Agent as a fixed bottom composer"));
checkMessage(requireWithin(stylesSource, /\.director-bottom-composer[\s\S]*position:\s*fixed/, "Agent composer must stay fixed at the bottom"));
checkMessage(requireWithin(stylesSource, /\.minimal-director\.has-bottom-composer,[\s\S]*padding-bottom:\s*clamp\(380px,\s*46vh,\s*560px\)/, "Director workspace must reserve enough bottom space for fixed composer actions"));
checkMessage(requireWithin(stylesSource, /\.creator-desk-panels,[\s\S]*\.review-tray-item,[\s\S]*scroll-margin-bottom:\s*clamp\(360px,\s*44vh,\s*560px\)/, "Review actions must scroll above the fixed composer instead of being covered"));
checkMessage(requireWithin(stylesSource, /\.minimal-director,\s*[\s\S]*\.minimal-director\.preview\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)/, "Director workspace must be a single-column workspace"));
checkMessage(requireWithin(stylesSource, /\.director-flow-overview\s*\{[\s\S]*display:\s*none/, "Noisy workflow overview should stay hidden in the simple creator surface"));
checkMessage(requireWithin(stylesSource, /\.director-bottom-composer \.minimal-agent-status-row,[\s\S]*\.director-bottom-composer \.minimal-agent-details,[\s\S]*\.director-bottom-composer \.minimal-agent-badges\s*\{[\s\S]*display:\s*none/, "Bottom composer must hide status/details by default"));
checkMessage(requireWithin(minimalAgentPanelSource, /buildDirectorFeedbackRecompile/, "MinimalAgentPanel must compile selected-shot feedback into a structured recompile"));
checkMessage(requireWithin(minimalAgentPanelSource, /onDirectorFeedbackConfirmed/, "MinimalAgentPanel must confirm structured feedback through the Project.vibe callback"));
checkMessage(requireWithin(minimalAgentLanguageSurface, /参考 \/ 视频安排/, "MinimalAgentPanel feedback plan must name reference/video recompile targets"));
checkMessage(requireWithin(minimalAgentLanguageSurface, /不会开始生成|不会生成/, "MinimalAgentPanel feedback plan must explain recompile without starting generation"));
checkMessage(requireWithin(minimalAgentLanguageSurface, /当前选择/, "MinimalAgentPanel feedback must keep a selected-object context"));
checkMessage(requireWithin(minimalAgentPanelSource, /已选中内容，直接说改法/, "MinimalAgentPanel selected-object footer copy must be clear"));
checkMessage(requireWithin(minimalAgentLanguageSurface, /写脚本、提需求/, "MinimalAgentPanel must keep one normal chat entry for project-wide feedback"));
checkMessage(requireWithin(minimalAgentLanguageSurface, /说这段怎么改/, "MinimalAgentPanel selected input placeholder"));
checkMessage(requireWithin(minimalAgentPanelSource, /textareaRef\.current\?\.focus/, "MinimalAgentPanel should focus the composer after selection or file add"));
checkMessage(requireWithin(minimalAgentPanelSource, /Cmd Enter 发送/, "MinimalAgentPanel composer must expose the keyboard send shortcut"));
checkMessage(requireWithin(minimalAgentLanguageSurface, /发送[\s\S]*确认修改/, "MinimalAgentPanel confirmation action labels"));
checkMessage(requireWithin(minimalAgentPanelSource, /showFooterPrimaryAction\s*=\s*!workflow\s*\|\|\s*planPhase\s*===\s*"idle"[\s\S]*showFooterPrimaryAction[\s\S]*<Send/, "MinimalAgentPanel must keep the bottom send action out of staged confirmation state"));
checkMessage(requireWithin(minimalAgentPanelSource, /function\s+revisePlan[\s\S]*previousIntent[\s\S]*setText\(previousIntent\)/, "MinimalAgentPanel must restore the last feedback text when the creator chooses to revise"));
checkMessage(requireWithin(minimalAgentPanelSource, /创作者路径/, "MinimalAgentPanel must label the creator path"));
checkMessage(requireWithin(minimalAgentPanelSource, /描述修改[\s\S]*生成计划[\s\S]*确认应用/, "MinimalAgentPanel must show a simple creator path"));
checkMessage(requireWithin(minimalAgentPanelSource, /修改计划详情/, "MinimalAgentPanel staged plan must use simplified plan copy"));
checkMessage(requireWithin(minimalAgentPanelSource, /故事 \/ 镜头 \/ 复核/, "MinimalAgentPanel staged plan must name the final write targets in user copy"));
check(
  !/排队中|已计划|待写入项目事实|transaction|queueItems/.test(minimalAgentPanel),
  "Director Clean Mode Agent panel must not expose queue/project-fact implementation copy",
);
check(!/准备修改|开始生成/.test(minimalAgentLanguageSurface), "Director Clean Mode Agent panel must avoid heavy prepare/generate workflow copy");
checkMessage(requireWithin(minimalAgentPanel, /minimal-agent-plan/, "Director Clean Mode should keep staged plan details available behind disclosure"));
checkMessage(requireWithin(minimalAgentPanel, /minimal-agent-steps/, "Director Clean Mode should show a light creator-path stepper in the Agent panel"));
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
checkMessage(requireWithin(phase14ProjectSurface, /故事流/, "Director Clean Mode story summary in minimal top navigation"));
checkMessage(requireWithin(phase14ProjectSurface, /个镜头/, "Director Clean Mode shot count badge must use product copy"));
checkMessage(requireWithin(phase14ProjectSurface, /个锁定参考/, "Director Clean Mode locked reference count badge must use product copy"));
checkMessage(requireWithin(phase14ProjectSurface, /statusLabel/, "One Creator Loop top navigation short runtime status"));
checkMessage(requireWithin(phase14ProjectSurface, /minimal-state-dots/, "One Creator Loop top navigation compact progress dots"));
checkMessage(requireWithin(minimalTopNav, /aria-label="导演视图"/, "Top navigation view aria label must use product copy"));
checkMessage(requireWithin(minimalTopNav, /视觉记忆/, "Top navigation asset view must use product copy"));
checkMessage(requireWithin(minimalTopNav, /预览/, "Top navigation preview view must use product copy"));
checkMessage(requireWithin(minimalTopNav, /aria-label="设置"[\s\S]*settings-link-label">设置/, "One Creator Loop settings entry should use product copy"));
checkMessage(requireWithin(settingsShell, /使用 Tavily 联网/, "Settings must expose Tavily as a visible web research choice"));
checkMessage(requireWithin(settingsShell, /Tavily 还没有 Key/, "Settings must explain missing Tavily credential in product copy"));
checkMessage(requireWithin(minimalAgentPanel, /开启 Tavily/, "Agent panel must make external research discoverable before it is enabled"));
checkMessage(requireWithin(minimalTopNav, /shortSectionLabel\s*\(/, "Top navigation story section tabs must use compact section labels"));
checkMessage(requireWithin(minimalTopNav, /title=\{activeSection\?\.label\s*\|\|\s*"故事"\}/, "Top navigation must keep full active section label in title"));
checkMessage(requireWithin(stylesSource, /\.minimal-section-label[\s\S]{0,220}text-overflow:\s*ellipsis/, "Top navigation section labels must ellipsize"));
check(!/<button\b[^>]*diagnostics-link[\s\S]{0,120}>\s*Diagnostics\s*<\/button>/i.test(minimalTopNav), "One Creator Loop Diagnostics must not be a prominent text button in the top navigation");
check(!/Plan\s+preview/i.test(phase14ProjectSurface), "Minimal top navigation must not expose Plan preview copy");
checkMessage(requireWithin(directorMode, /activeSection\?\.label\s*\|\|\s*"故事流"/, "DirectorMode fallback section label must use product copy"));
checkMessage(requireWithin(`${minimalPreview}\n${previewVideoStageCopy}`, /还缺素材/, "Preview missing material card must use product copy"));
checkMessage(requireWithin(`${minimalPreview}\n${previewVideoStatusLabel}\n${previewVideoStageCopy}`, /videoGeneration[\s\S]*视频\$\{video\.label\}|视频\$\{video\.label\}[\s\S]*video\.detail/, "Preview must surface video status and detail copy"));
checkMessage(requireWithin(minimalPreview, /播放预览/, "Preview play aria label must use product copy"));
checkMessage(requireWithin(minimalPreview, /暂停预览/, "Preview pause aria label must use product copy"));
checkMessage(requireWithin(previewItemLabel, /formatShotNumber/, "Preview must sanitize raw current-project labels before display"));
for (const label of ["素材包", "复核记录", "预览媒体", "项目文件", "制作报告", "正式预览还需复核"]) {
  checkMessage(requireWithin(minimalExportSource, new RegExp(label), `Export view must use creator-facing ${label} copy`));
}
check(!/提示质检|prompt QA|导出清单已生成|export_manifest/i.test(extractStringLiterals(minimalExportSource)), "Export view default copy must hide engineering export labels");
checkMessage(requireWithin(minimalAudioPlan, /配乐[\s\S]*淡入[\s\S]*淡出/, "Audio plan must use creator-facing audio copy"));
check(!/Formal gate blockers|paths|音频 plan|Fade in|Fade out/.test(extractStringLiterals(`${minimalExport}\n${minimalAudioPlan}`)), "Export/Audio views must not expose engineering copy");

const defaultDirectorSurfaceText = extractStringLiterals(`${minimalTopNav}\n${directorMode}\n${minimalPreview}\n${minimalProjectPlan}`);
for (const [term, pattern] of [
  ["Asset Library", /Asset Library/],
  ["Preview", /Preview/],
  ["Diagnostics", /Diagnostics/],
  ["locked refs", /locked refs/],
  ["shots", /(^|[^.])\bshots\b/],
  ["Story", /\bStory\b/],
]) {
  check(!pattern.test(defaultDirectorSurfaceText), `Default Director surface must not expose ${term}`);
}

checkMessage(requireWithin(minimalAssetLibrary, /<details\s+className="asset-library-add"/, "Asset Library add asset form must be collapsed behind a light entry"));
checkMessage(requireWithin(minimalAssetLibrary, /blockerLabel/, "Asset Library blockers must collapse to a short status"));
checkMessage(requireWithin(minimalAssetLibrary, /asset-feature-grid anchors/, "Asset Library props/styles must render as image-first asset cards"));
check(!/blockers\.slice\(0,\s*4\)\.map/.test(minimalAssetLibrary), "Asset Library must not show long blocker chips on the main surface");
check(!/Queue|queue|gate|provider/.test(minimalStoryFlow), "Story Flow must not expose queue/gate/provider engineering details");
checkMessage(requireWithin(formatShotNumber, /CURRENT_PROJECT[\s\S]*当前项目/, "Story Flow must display the current-project placeholder with product copy"));
checkMessage(requireWithin(shortStoryFunction, /current_project_story_pending[\s\S]*(待补齐故事流|等待同步)/, "Story Flow fallback story function must use product copy"));
check(!/"Setup"/.test(minimalStoryFlowSource), "Story Flow fallback labels must not expose Setup");
checkMessage(requireWithin(shotStatusLabel, /blocked[\s\S]*(待补齐|需复核)/, "Story Flow status label must map blocked to product copy"));
checkMessage(requireWithin(minimalStoryFlow, /aria-label=\{cardState\.label\}/, "Story Flow dot aria-label must use product status labels"));
checkMessage(requireWithin(minimalStoryFlow, /currentRequiresEndFrame[\s\S]*usesEndpointEndFrame\(currentShot\)[\s\S]*currentRequiresEndFrame &&/, "Story Flow cards must show end-frame status only for explicit endpoint control"));
checkMessage(requireWithin(minimalStoryFlow, /currentDisplayReference[\s\S]*shotDisplayReference\(currentShot/, "Story Flow default reference status must use the active visual reference"));
check(!/aria-label=\{shot\.status\}/.test(minimalStoryFlow), "Story Flow dot aria-label must not expose raw shot status");
checkMessage(requireWithin(minimalAgentPanel, /productScopeLabel\(projectScopeLabel\)/, "Agent panel must sanitize projected scope labels before display"));
checkMessage(requireWithin(minimalAgentPanel, /showEndpointEndFrameControls[\s\S]*showEndFrameAction/, "Agent panel must hide end-frame CTA unless endpoint control is explicit"));
checkMessage(requireWithin(`${cleanLabel}\n${productScopeLabel}`, /CURRENT_PROJECT[\s\S]*当前项目/, "Agent scope must sanitize current-project placeholders before display"));
check(!/正在看\s*\$\{[^}]*\.id\}/.test(selectedScopeLabel), "Agent scope must not render raw selected shot ids");

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
checkMessage(requireWithin(image2KeyframeRuntimeDiagnostics, /Motion Facts/i, "Image2 keyframe diagnostics must summarize motion endpoint facts"));
checkMessage(requireWithin(image2KeyframeRuntimeDiagnostics, /blocked pair motion blocker/i, "Image2 keyframe diagnostics must count blocked-pair motion blockers"));
checkMessage(requireWithin(image2KeyframeRuntimeDiagnostics, /provider locks/i, "Phase 17 provider locks diagnostics copy"));
checkMessage(requireWithin(image2KeyframeRuntimeDiagnostics, /closed loop/i, "Phase 17 closed-loop diagnostics copy"));
checkMessage(requireWithin(runtimeDiagnosticsProjectionSource, /function\s+motionTypeLabel\s*\(/, "motion endpoint label helper"));
checkMessage(requireWithin(runtimeDiagnosticsProjectionSource, /function\s+motionEndpointFactsForShot\s*\(/, "selected-shot motion endpoint facts helper"));
checkMessage(requireWithin(runtimeDiagnosticsProjectionSource, /function\s+motionContractSummaryForGate\s*\(/, "motion contract gate summary helper"));
checkMessage(requireWithin(runtimeDiagnosticsProjectionSource, /function\s+firstMotionEndpointNotice\s*\(/, "first motion endpoint notice helper"));
checkMessage(requireWithin(`${motionTypeLabel}\n${motionEndpointFactsForShot}\n${motionContractSummaryForGate}\n${firstMotionEndpointNotice}`, /静止[\s\S]*表情[\s\S]*姿态[\s\S]*走位[\s\S]*交互[\s\S]*运镜[\s\S]*揭示[\s\S]*状态变化/, "motion endpoint helper Chinese labels"));
check(!/<VideoPrepareSummaryStrip\b/.test(directorMode), "Director Clean Mode must not mount VideoPrepareSummaryStrip in the default DirectorMode");
check(!/<ProjectRealChainPanel\b/.test(directorMode), "Director Clean Mode must not mount ProjectRealChainPanel in the default DirectorMode");
checkMessage(requireWithin(diagnosticsMode, /<ProjectRealChainPanel\b/, "DiagnosticsMode must mount ProjectRealChainPanel"));
checkMessage(requireWithin(projectRealChainPanelSource, /import\s+"\.\/ProjectRealChainPanel\.css"/, "ProjectRealChainPanel must import its extracted CSS"));
checkMessage(requireWithin(diagnosticsMode, /<VideoPrepareSummaryStrip\s+runtimeState=\{runtimeState\}\s+selectedShot=\{selectedShot\}\s*\/>/, "DiagnosticsMode motion prepare strip mounted"));
checkMessage(requireWithin(videoPrepareSummaryStrip, /videoPlanning\.taskPlans/, "VideoPrepareSummaryStrip must summarize video task plans"));
checkMessage(requireWithin(videoPrepareSummaryStrip, /readinessGates|Gates/, "Diagnostics motion prepare strip must expose readiness gate status"));
checkMessage(requireWithin(shotVideoGateInspector, /motionContractSummaryForGate\s*\(/, "ShotVideoGateInspector must call motion contract summary helper"));
checkMessage(requireWithin(shotVideoGateInspector, /firstMotionEndpointNotice\s*\(/, "ShotVideoGateInspector must call first motion endpoint notice helper"));
checkMessage(requireWithin(shotVideoGateInspector, /Motion Type/i, "ShotVideoGateInspector motion type field"));
checkMessage(requireWithin(shotVideoGateInspector, /End Frame Required/i, "ShotVideoGateInspector end-frame-required field"));
checkMessage(requireWithin(shotVideoGateInspector, /Body Mechanics/i, "ShotVideoGateInspector body mechanics field"));
checkMessage(requireWithin(shotVideoGateInspector, /Editable \/ Protected/i, "ShotVideoGateInspector editable/protected counts field"));
checkMessage(requireWithin(shotVideoGateInspector, /Bbox-only guard/i, "ShotVideoGateInspector bbox-only guard field"));
checkMessage(requireWithin(videoPlanningDiagnostics, /buildMotionEndpointDiagnosticsSummary\s*\(/, "VideoPlanningDiagnostics must use motion endpoint diagnostics summary helper"));
checkMessage(requireWithin(videoPlanningDiagnostics, /Motion Endpoint/i, "Diagnostics must expose Motion Endpoint statistics"));
checkMessage(requireWithin(videoPlanningDiagnostics, /Motion Contract/i, "Diagnostics must expose Motion Contract statistics"));
checkMessage(requireWithin(diagnosticsMode, /VisualConsistencyContractDiagnostics/, "Phase 37 visual consistency contract diagnostics mounted"));
checkMessage(requireWithin(settingsShell, /Visual Consistency Contract/i, "Phase 37 visual consistency contract settings summary"));
checkMessage(requireWithin(visualConsistencyContractDiagnostics, /Visual Consistency Contract/i, "Phase 37 visual consistency contract diagnostics panel"));
checkMessage(requireWithin(visualConsistencyContractDiagnostics, /shot layout/i, "Phase 37 shot layout diagnostics copy"));
checkMessage(requireWithin(visualConsistencyContractDiagnostics, /spatial memory/i, "Phase 37 spatial memory diagnostics copy"));
checkMessage(requireWithin(visualConsistencyContractDiagnostics, /keyframe pair/i, "Phase 37 keyframe pair diagnostics copy"));
checkMessage(requireWithin(visualConsistencyContractDiagnostics, /master QA/i, "Phase 37 master inheritance QA diagnostics copy"));
checkMessage(requireWithin(visualConsistencyContractUiSummary, /masterInheritanceQaGateDefined/i, "Phase 37 master inheritance typed gate summary"));
checkMessage(requireWithin(diagnosticsMode, /FullTaskSubagentPacketPlannerDiagnostics/, "Phase 38 Full Task Subagent Packet Planner diagnostics mounted"));
checkMessage(requireWithin(settingsShell, /Full Task Subagent Packet Planner/i, "Phase 38 Settings read-only packet planner summary"));
checkMessage(requireWithin(fullTaskSubagentPacketPlannerDiagnostics, /Full Task Subagent Packet Planner/i, "Phase 38 Full Task Subagent Packet Planner diagnostics panel"));
checkMessage(requireWithin(fullTaskSubagentPacketPlannerDiagnostics, /Validated Packet/i, "Phase 38 validated packet diagnostics copy"));
checkMessage(requireWithin(fullTaskSubagentPacketPlannerDiagnostics, /Expected Outputs/i, "Phase 38 expected outputs diagnostics copy"));
checkMessage(requireWithin(`${fullTaskSubagentPacketPlannerDiagnostics}\n${fullTaskSubagentPacketPlannerUiSummary}`, /source fact trace/i, "Phase 38 source fact trace diagnostics copy"));
checkMessage(requireWithin(`${fullTaskSubagentPacketPlannerDiagnostics}\n${fullTaskSubagentPacketPlannerUiSummary}`, /knowledge trace/i, "Phase 38 knowledge trace diagnostics copy"));
checkMessage(requireWithin(`${fullTaskSubagentPacketPlannerDiagnostics}\n${fullTaskSubagentPacketPlannerUiSummary}`, /free-text worker\/task forbidden/i, "Phase 38 free-text worker diagnostics copy"));
checkMessage(requireWithin(diagnosticsMode, /KnowledgePackUserManagementDiagnostics/, "Phase 39 Knowledge Pack User Management diagnostics mounted"));
checkMessage(requireWithin(settingsShell, /Phase 39 Knowledge Pack User Management/i, "Phase 39 Settings read-only user management summary"));
checkMessage(requireWithin(knowledgePackUserManagementDiagnostics, /Phase 39 Knowledge Pack User Management/i, "Phase 39 Knowledge Pack User Management diagnostics panel"));
checkMessage(requireWithin(knowledgePackUserManagementDiagnostics, /User Flows/i, "Phase 39 user flow diagnostics copy"));
checkMessage(requireWithin(knowledgePackUserManagementDiagnostics, /Route \/ Conflict/i, "Phase 39 route conflict diagnostics copy"));
checkMessage(requireWithin(`${knowledgePackUserManagementDiagnostics}\n${knowledgePackUserManagementUiSummary}`, /version\/hash\/dependency/i, "Phase 39 version/hash/dependency diagnostics copy"));
checkMessage(requireWithin(`${knowledgePackUserManagementDiagnostics}\n${knowledgePackUserManagementUiSummary}`, /hard gate override forbidden/i, "Phase 39 hard gate override forbidden copy"));
checkMessage(requireWithin(`${knowledgePackUserManagementDiagnostics}\n${knowledgePackUserManagementUiSummary}`, /scoped verified injection only/i, "Phase 39 scoped injection copy"));
checkMessage(requireWithin(`${knowledgePackUserManagementDiagnostics}\n${knowledgePackUserManagementUiSummary}`, /formal references stay gated/i, "Phase 39 formal reference gate copy"));
checkMessage(requireWithin(diagnosticsMode, /WorkerRuntimeGateDiagnostics/, "Phase 40 Worker Runtime Gate diagnostics mounted"));
checkMessage(requireWithin(settingsShell, /Phase 40\s+Worker Runtime Gate/i, "Phase 40 Settings read-only worker runtime summary"));
checkMessage(requireWithin(workerRuntimeGateDiagnostics, /Phase 40\s+Worker Runtime Gate/i, "Phase 40 Worker Runtime Gate diagnostics panel"));
checkMessage(requireWithin(workerRuntimeGateDiagnostics, /Runtime Contract/i, "Phase 40 runtime contract diagnostics copy"));
checkMessage(requireWithin(workerRuntimeGateDiagnostics, /Default Gate/i, "Phase 40 default gate diagnostics copy"));
checkMessage(requireWithin(`${workerRuntimeGateDiagnostics}\n${settingsShell}`, /validated envelope/i, "Phase 40 validated envelope Diagnostics/Settings copy"));
checkMessage(requireWithin(`${workerRuntimeGateDiagnostics}\n${settingsShell}`, /structured result/i, "Phase 40 structured result Diagnostics/Settings copy"));
checkMessage(requireWithin(`${workerRuntimeGateDiagnostics}\n${settingsShell}`, /spawn\/resume\/daemon\/shell\/credential\/file\/provider/i, "Phase 40 execution path Diagnostics/Settings copy"));
checkMessage(requireWithin(workerRuntimeGateUiSummary, /noAgentResumeByDefault/i, "Phase 40 no resume typed gate summary"));
checkMessage(requireWithin(diagnosticsMode, /ProviderClosedLoopShellDiagnostics/, "Phase 41 Provider Closed-loop Shell diagnostics mounted"));
checkMessage(requireWithin(settingsShell, /Phase 41 Provider Closed-loop Shell/i, "Phase 41 Settings read-only provider closed-loop shell summary"));
checkMessage(requireWithin(providerClosedLoopShellDiagnostics, /Phase 41 Provider Closed-loop Shell/i, "Phase 41 Provider Closed-loop Shell diagnostics panel"));
checkMessage(requireWithin(providerClosedLoopShellDiagnostics, /Watcher/i, "Phase 41 watcher Diagnostics copy"));
checkMessage(requireWithin(providerClosedLoopShellDiagnostics, /Manifest/i, "Phase 41 manifest Diagnostics copy"));
checkMessage(requireWithin(providerClosedLoopShellDiagnostics, /QA Gate/i, "Phase 41 QA gate Diagnostics copy"));
checkMessage(requireWithin(providerClosedLoopShellDiagnostics, /Promotion Gate/i, "Phase 41 promotion gate Diagnostics copy"));
checkMessage(requireWithin(`${providerClosedLoopShellDiagnostics}\n${providerClosedLoopShellUiSummary}\n${settingsShell}`, /provider submit\/live submit\/credential\/shell/i, "Phase 41 provider/live/credential/shell Diagnostics/Settings copy"));
checkMessage(requireWithin(providerClosedLoopShellUiSummary, /image2ClosedLoopShellDefined/i, "Phase 41 Image2 typed gate summary"));
checkMessage(requireWithin(providerClosedLoopShellUiSummary, /seedanceClosedLoopShellDefined/i, "Phase 41 Seedance typed gate summary"));
checkMessage(requireWithin(providerClosedLoopShellUiSummary, /watcherRequired/i, "Phase 41 watcher typed gate summary"));
checkMessage(requireWithin(providerClosedLoopShellUiSummary, /manifestRequired/i, "Phase 41 manifest typed gate summary"));
checkMessage(requireWithin(providerClosedLoopShellUiSummary, /qaGateRequired/i, "Phase 41 QA typed gate summary"));
checkMessage(requireWithin(providerClosedLoopShellUiSummary, /promotionGateRequired/i, "Phase 41 promotion typed gate summary"));
checkMessage(requireWithin(diagnosticsMode, /BetaAcceptanceDiagnostics/, "Phase 42 Beta Acceptance diagnostics mounted"));
checkMessage(requireWithin(settingsShell, /Phase 42 Beta Acceptance/i, "Phase 42 Settings read-only beta acceptance summary"));
checkMessage(requireWithin(betaAcceptanceDiagnostics, /Phase 42 Beta Acceptance/i, "Phase 42 Beta Acceptance diagnostics panel"));
checkMessage(requireWithin(betaAcceptanceDiagnostics, /Mac\/Windows/i, "Phase 42 Mac/Windows readiness Diagnostics copy"));
checkMessage(requireWithin(betaAcceptanceDiagnostics, /Project \/ Export/i, "Phase 42 project/export Diagnostics copy"));
checkMessage(requireWithin(betaAcceptanceDiagnostics, /Runtime Gates/i, "Phase 42 runtime gates Diagnostics copy"));
checkMessage(requireWithin(betaAcceptanceDiagnostics, /Provider Gate/i, "Phase 42 provider gate Diagnostics copy"));
checkMessage(requireWithin(betaAcceptanceDiagnostics, /Tests/i, "Phase 42 test matrix Diagnostics copy"));
checkMessage(requireWithin(betaAcceptanceDiagnostics, /Closure/i, "Phase 42 closure Diagnostics copy"));
checkMessage(requireWithin(`${betaAcceptanceDiagnostics}\n${betaAcceptanceUiSummary}\n${settingsShell}`, /provider submit\/credential\/shell/i, "Phase 42 provider submit/credential/shell Diagnostics/Settings copy"));
checkMessage(requireWithin(betaAcceptanceUiSummary, /macDesktopReadiness/i, "Phase 42 Mac typed gate summary"));
checkMessage(requireWithin(betaAcceptanceUiSummary, /windowsDesktopReadiness/i, "Phase 42 Windows typed gate summary"));
checkMessage(requireWithin(betaAcceptanceUiSummary, /workerRuntimeGate/i, "Phase 42 worker runtime typed gate summary"));
checkMessage(requireWithin(betaAcceptanceUiSummary, /providerClosedLoopShell/i, "Phase 42 provider closed-loop typed gate summary"));
checkMessage(requireWithin(betaAcceptanceUiSummary, /betaAcceptanceOwnsClosure/i, "Phase 42 owns closure typed gate summary"));
checkMessage(requireWithin(betaAcceptanceUiSummary, /finalPhaseNumberLocked/i, "Phase 42 final phase locked typed gate summary"));
check(
  !/RealPilotDirectorStatus/.test(directorMode),
  "Director Clean Mode must not mount RealPilotDirectorStatus in the default DirectorMode",
);
checkMessage(requireWithin(diagnosticsMode, /RealPilotDiagnostics/, "post-Phase42 real test round Real Pilot diagnostics mounted"));
checkMessage(requireWithin(settingsShell, /Real Pilot\s*\/\s*真实小样/i, "post-Phase42 real test round Real Pilot settings status"));
checkMessage(requireWithin(realPilotDirectorStatus, /真实小样/, "post-Phase42 real test round Real Pilot Director status title"));
checkMessage(requireWithin(realPilotDirectorStatus, /选择镜头/, "post-Phase42 real test round Real Pilot selected shots copy"));
checkMessage(requireWithin(realPilotDirectorStatus, /首帧控制/, "post-Phase42 real test round Real Pilot first-frame control copy"));
checkMessage(requireWithin(realPilotDirectorStatus, /输出文件夹/, "post-Phase42 real test round Real Pilot output folder copy"));
checkMessage(requireWithin(realPilotDirectorStatus, /预计输出/, "post-Phase42 real test round Real Pilot estimated output copy"));
checkMessage(requireWithin(realPilotDirectorStatus, /动作确认后才进入单次测试/, "One Creator Loop Real Pilot action-time-confirmation-before-one-shot copy"));
check(!/确认后生成/.test(realPilotDirectorStatus), "real test round Real Pilot must not imply immediate generation");
checkMessage(requireWithin(realPilotDirectorStatus, /Image2/, "post-Phase42 real test round Real Pilot Image2 first copy"));
checkMessage(requireWithin(realPilotDirectorStatus, /Seedance/, "post-Phase42 real test round Real Pilot Seedance parked copy"));
check(
  !/OneShotActionPanel/.test(directorMode),
  "Director Clean Mode must not mount OneShotActionPanel in the default DirectorMode",
);
if (oneShotActionPanel) {
  checkMessage(requireWithin(oneShotActionPanel, /单次小样/, "Round 4 one-shot action panel title"));
  checkMessage(requireWithin(oneShotActionPanel, /确认单次小样/, "Round 4 action-time confirmation button copy"));
  checkMessage(requireWithin(oneShotActionPanel, /等待文件/, "Round 4 waiting-file user state"));
  checkMessage(requireWithin(oneShotActionPanel, /需要复核/, "Round 4 needs-review user state"));
  checkMessage(requireWithin(oneShotActionPanel, /已记录本次确认/, "Round 4 confirmation receipt user copy"));
  checkMessage(requireWithin(oneShotActionPanel, /summary\.oneShotStatus\s*===\s*"需要复核"/, "pre-real-test returned output must surface one-shot review status"));
  checkMessage(requireWithin(oneShotActionPanel, /输出已回流，等待人工复核。/, "pre-real-test returned output review detail"));
}
checkMessage(requireWithin(realPilotDiagnostics, /Real Pilot\s*\/\s*真实小样/i, "post-Phase42 real test round Real Pilot diagnostics panel"));
checkMessage(requireWithin(realPilotDiagnostics, /Review Status/i, "post-Phase42 real test round Real Pilot diagnostics review status"));
checkMessage(requireWithin(realPilotDiagnostics, /First Frame Control/i, "post-Phase42 real test round Real Pilot diagnostics frames summary"));
check(!/<button\b/i.test(realPilotDirectorStatus), "post-Phase42 real test round Real Pilot Director status must stay read-only");
check(!/<button\b/i.test(realPilotDiagnostics), "post-Phase42 real test round Real Pilot diagnostics must not expose executable buttons");
const realTestRoundConfirmationSurface = `${realPilotDirectorStatus}\n${realPilotDiagnostics}\n${settingsShell}`;
checkMessage(requireWithin(realPilotDirectorStatus, /先复核/, "real test round Real Pilot review-first status"));
checkMessage(requireWithin(realPilotDirectorStatus, /等待确认/, "real test round Real Pilot waiting-confirmation status"));
checkMessage(requireWithin(realPilotDirectorStatus, /1 个镜头小样/, "real test round Real Pilot one-shot sample copy"));
checkMessage(requireWithin(realPilotDirectorStatus, /0 自动重试/, "real test round Real Pilot no-auto-retry copy"));
checkMessage(requireWithin(realPilotDirectorStatus, /输出文件夹/, "real test round Real Pilot output folder copy"));
checkMessage(requireWithin(realPilotDirectorStatus, /未就绪|单次待确认/, "One Creator Loop Real Pilot one-shot readiness copy"));
checkMessage(requireWithin(realPilotDirectorStatus, /不自动生成/, "One Creator Loop Real Pilot no-auto-generation copy"));
checkMessage(requireWithin(realPilotDirectorStatus, /handoff-status-line/, "Round 6 visible handoff status line"));
checkMessage(requireWithin(realPilotDirectorStatus, /小样状态/, "Round 6 accessible handoff status label"));
checkMessage(requireWithin(realPilotDirectorStatus, /handoffLabel/, "Round 6 handoff short label binding"));
checkMessage(requireWithin(realPilotDirectorStatus, /handoffDetail/, "Round 6 handoff detail binding"));
checkMessage(requireWithin(realTestRoundConfirmationSurface, /执行前确认/, "real test round pre-execution confirmation summary"));
checkMessage(requireWithin(realTestRoundConfirmationSurface, /预算上限/, "real test round budget cap summary"));
checkMessage(requireWithin(realTestRoundConfirmationSurface, /输出监听/, "real test round output watcher summary"));
checkMessage(requireWithin(realTestRoundConfirmationSurface, /请求预览/, "real test round request preview summary"));
checkMessage(requireWithin(realTestRoundConfirmationSurface, /单次确认/, "one-shot confirmation summary"));
checkMessage(requireWithin(realTestRoundConfirmationSurface, /动作确认待定|先完成复核/, "One Creator Loop action-time confirmation state"));
const realPilotOneShotMainSurface = `${realPilotDirectorStatus}\n${oneShotActionPanel}`;
check(
  !/roadmap phase|Phase\s*4[3-6]|Round\s*5/i.test(realPilotOneShotMainSurface),
  "Real Pilot / one-shot main surface must not expose roadmap growth labels",
);
for (const [term, pattern] of [
  ["provider", /provider/i],
  ["credential", /credential/i],
  ["shell", /shell/i],
  ["schema", /schema/i],
]) {
  check(!pattern.test(realPilotOneShotMainSurface), `Real Pilot / one-shot main surface must not expose ${term}`);
}
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
  check(!pattern.test(realTestRoundConfirmationSurface), `Real Pilot UI must not imply ${copy}`);
}
const handoffMinimalSurface = realPilotDirectorStatus;
for (const [term, pattern] of [
  ["provider", /provider/i],
  ["credential", /credential/i],
  ["shell", /shell/i],
  ["schema", /schema/i],
]) {
  check(!pattern.test(handoffMinimalSurface), `Round 6 visible handoff status must not expose ${term}`);
}
checkMessage(requireWithin(diagnosticsMode, /AgentCliMockRunnerDiagnostics/, "Phase 26 Agent/CLI Mock Runner summary mounted in Diagnostics"));
checkMessage(requireWithin(agentCliMockRunnerDiagnostics, /Agent\/CLI Mock Runner/i, "Phase 26 Agent/CLI Mock Runner diagnostics panel"));
checkMessage(requireWithin(agentCliMockRunnerDiagnostics, /Runner Kind/i, "Phase 26 runner kind summary"));
checkMessage(requireWithin(agentCliMockRunnerDiagnostics, /Replacement Proof/i, "Phase 26 replacement proof summary"));
checkMessage(requireWithin(agentCliMockRunnerDiagnostics, /Readiness/i, "Phase 26 ready/blocked summary"));
checkMessage(requireWithin(agentCliMockRunnerDiagnostics, /No-op Results/i, "Phase 26 no-op result count summary"));
checkMessage(requireWithin(agentCliMockRunnerDiagnostics, /phase26-lock-strip/i, "Phase 26 hard locks summary"));
checkMessage(requireWithin(diagnosticsMode, /CliAdapterSpikeDiagnostics/, "Phase 29 CliAdapterSpikeDiagnostics mounted in Diagnostics"));
checkMessage(requireWithin(cliAdapterSpikeDiagnostics, /CLI Adapter Spike/i, "Phase 29 CLI Adapter Spike diagnostics panel"));
checkMessage(requireWithin(cliAdapterSpikeDiagnostics, /Contract Mode/i, "Phase 29 contract mode summary"));
checkMessage(requireWithin(cliAdapterSpikeDiagnostics, /Replacement Proof/i, "Phase 29 replacement proof summary"));
checkMessage(requireWithin(cliAdapterSpikeDiagnostics, /Input Source/i, "Phase 29 input source summary"));
checkMessage(requireWithin(cliAdapterSpikeDiagnostics, /Spawn\s*\/\s*Resume/i, "Phase 29 spawn/resume shape summary"));
checkMessage(requireWithin(cliAdapterSpikeDiagnostics, /Provider Submit/i, "Phase 29 provider submit summary"));
checkMessage(requireWithin(cliAdapterSpikeDiagnostics, /phase29-lock-strip/i, "Phase 29 hard locks summary"));
checkMessage(requireWithin(diagnosticsMode, /ExportWorkerDiagnostics/, "Phase 27 ExportWorkerDiagnostics mounted in Diagnostics"));
checkMessage(requireWithin(exportWorkerDiagnostics, /Export Worker Diagnostics/i, "Phase 27 Export Worker diagnostics panel"));
checkMessage(requireWithin(exportWorkerDiagnostics, /Readiness/i, "Phase 27 readiness summary"));
checkMessage(requireWithin(exportWorkerDiagnostics, /Scope/i, "Phase 27 scope summary"));
checkMessage(requireWithin(exportWorkerDiagnostics, /Planned Writes/i, "Phase 27 planned writes summary"));
checkMessage(requireWithin(exportWorkerDiagnostics, /Export Root/i, "Phase 27 export root summary"));
checkMessage(requireWithin(exportWorkerDiagnostics, /Blocked\s*\/\s*warnings/i, "Phase 27 blockers/warnings summary"));
checkMessage(requireWithin(exportWorkerDiagnostics, /phase27-lock-strip/i, "Phase 27 hard lock strip"));
checkMessage(requireWithin(diagnosticsMode, /VoiceAudioSettingsDiagnostics/, "Phase 28 VoiceAudioSettingsDiagnostics mounted in Diagnostics"));
checkMessage(requireWithin(runtimeDiagnosticsProjectionSource, /phase_28_voice_audio_settings_ui/, "Phase 28 voiceAudioSettings phase reader"));
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
checkMessage(requireWithin(diagnosticsMode, /ProviderExecutionPermissionGateDiagnostics/, "Phase 31 ProviderExecutionPermissionGateDiagnostics mounted in Diagnostics"));
checkMessage(requireWithin(providerExecutionPermissionGateDiagnostics, /Provider Execution Permission Gate/i, "Phase 31 Provider Execution Permission Gate diagnostics panel"));
checkMessage(requireWithin(providerExecutionPermissionGateDiagnostics, /Readiness/i, "Phase 31 readiness summary"));
checkMessage(requireWithin(providerExecutionPermissionGateDiagnostics, /Reviewable/i, "Phase 31 reviewable summary"));
checkMessage(requireWithin(providerExecutionPermissionGateDiagnostics, /Action Confirm/i, "Phase 31 action confirmation summary"));
checkMessage(requireWithin(providerExecutionPermissionGateDiagnostics, /Provider Submit/i, "Phase 31 provider submit summary"));
checkMessage(requireWithin(`${providerExecutionPermissionGateDiagnostics}\n${providerExecutionPermissionGateUiSummary}`, /providerExecutionPermissionGate/i, "Phase 31 providerExecutionPermissionGate parser"));
checkMessage(requireWithin(`${providerExecutionPermissionGateDiagnostics}\n${providerExecutionPermissionGateUiSummary}`, /credential\/live\/worker\/file locked/i, "Phase 31 credential/live/worker/file locks"));
checkMessage(requireWithin(providerExecutionPermissionGateDiagnostics, /phase31-lock-strip/i, "Phase 31 hard lock strip"));
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
checkMessage(requireWithin(localOrchestratorDiagnostics, /Blocked/i, "Phase 34 blocked summary"));
checkMessage(requireWithin(localOrchestratorDiagnostics, /Complete Verified/i, "Phase 34 complete-verified summary"));
checkMessage(requireWithin(localOrchestratorDiagnostics, /complete verified/i, "Phase 34 complete verified queue copy"));
checkMessage(requireWithin(localOrchestratorDiagnostics, /Stalled/i, "Phase 34 stalled summary"));
checkMessage(requireWithin(localOrchestratorDiagnostics, /Auto-continue/i, "Phase 34 auto-continue next-ready summary"));
checkMessage(requireWithin(localOrchestratorDiagnostics, /Provider\s*\/\s*file\s*\/\s*daemon locks/i, "Phase 34 provider/file/daemon locks summary"));
checkMessage(requireWithin(localOrchestratorDiagnostics, /Blockers\s*\/\s*warnings/i, "Phase 34 blockers/warnings summary"));
checkMessage(requireWithin(settingsShell, /Local Orchestrator/i, "Phase 34 Settings Local Orchestrator summary"));
checkMessage(requireWithin(settingsShell, /running planned/i, "Phase 34 Settings running planned summary"));
checkMessage(requireWithin(settingsShell, /waiting output/i, "Phase 34 Settings waiting output summary"));
checkMessage(requireWithin(settingsShell, /QA pending/i, "Phase 34 Settings QA pending summary"));
checkMessage(requireWithin(settingsShell, /needs review/i, "Phase 34 Settings needs review summary"));
checkMessage(requireWithin(settingsShell, /complete verified/i, "Phase 34 Settings complete verified summary"));
checkMessage(requireWithin(settingsShell, /hard locks/i, "Phase 34 Settings hard locks count"));
checkMessage(requireWithin(`${localOrchestratorDiagnostics}\n${localOrchestratorUiSummary}`, /localOrchestrator/i, "Phase 34 localOrchestrator fail-soft parser"));
checkMessage(requireWithin(`${localOrchestratorDiagnostics}\n${localOrchestratorUiSummary}`, /plan-only/i, "Phase 34 plan-only auto-continue summary"));
checkMessage(requireWithin(`${localOrchestratorDiagnostics}\n${localOrchestratorUiSummary}`, /provider\/file\/daemon locked/i, "Phase 34 provider/file/daemon lock text"));
checkMessage(requireWithin(localOrchestratorDiagnostics, /phase34-lock-strip/i, "Phase 34 hard lock strip"));
check(!/<button\b/i.test(localOrchestratorDiagnostics), "Phase 34 Local Orchestrator diagnostics must stay read-only and expose no buttons");
checkMessage(requireWithin(previewPlayerQueue, /draftPreview\.events/, "Phase 21/23 Preview Player queue must use previewExport.draftPreview.events"));
checkMessage(requireWithin(previewPlayerQueue, /image_hold/, "Phase 21/23 Preview Player queue must include image holds"));
checkMessage(requireWithin(previewPlayerQueue, /video_clip/, "Phase 21/23 Preview Player queue must include video clips"));
checkMessage(requireWithin(`${previewPlayerQueue}\n${previewQueueKind}`, /missing_placeholder/, "Phase 21/23 Preview Player queue must include missing placeholders"));
checkMessage(requireWithin(minimalPreview, /buildPreviewPlayerQueue\s*\(/, "Phase 21/23 MinimalPreview must render the Preview Player queue"));
checkMessage(requireWithin(minimalPreview, /previewSummary\.detail/, "One Creator Loop MinimalPreview must show a short runtime projection summary"));
checkMessage(requireWithin(minimalPreview, /preview-stage-card/, "Phase 21/23 Preview Player needs a large preview shell"));
checkMessage(requireWithin(minimalPreview, /aria-label=\{`当前选中预览：\$\{activeLabel\}`\}[\s\S]*onClick=\{\(\)\s*=>\s*activeItem\?\.shotId\s*&&\s*onSelectShot\(activeItem\.shotId\)\}/, "Preview stage click must bind the active shot to the normal Agent chat"));
check(!/Demo package/.test(minimalPreview), "Director Clean Mode Preview must not show Demo package copy");
check(!/packageStatus/.test(minimalPreview), "Director Clean Mode Preview must not keep package status in the main preview");
check(!/packageCount/.test(minimalPreview), "Director Clean Mode Preview must not keep package count in the main preview");
checkMessage(requireWithin(stylesSource, /preview-stage-card/, "Phase 21/23 Preview Player stage styling"));
checkMessage(requireWithin(stylesSource, /preview-export-summary/, "One Creator Loop preview export summary styling"));

checkMessage(requireAny(`${appSource}\n${minimalAssetLibrarySource}`, [/Asset Library/, /function\s+AssetLibrary/, /className="[^"]*asset-library/], "Asset Library main UI naming"));
checkMessage(requireAny(appSource, [/Preview/, /function\s+PreviewTimeline/, /className="[^"]*preview/], "Preview main UI"));
checkMessage(requireAny(appSource, [/Selected/, /Scope/], "Selected/Scope director context"));
checkMessage(requireAny(appSource, [/Story/, /section\.label/, /storySections/, /All Shots/], "Story/section tabs"));
checkMessage(requireAny(appSource, [/Diagnostics/, /diagnostics/], "Diagnostics entry"));
check(!/ProjectFactsStrip/.test(directorMode), "Director Clean Mode must not mount ProjectFactsStrip in the default DirectorMode");
check(!/project-plan-actions|Project Store/.test(directorMode), "Phase 36 main Director surface must not expose project file plan controls");
checkMessage(requireWithin(diagnosticsMode, /<ProjectFactsStrip\b/, "DiagnosticsMode must mount ProjectFactsStrip"));
checkMessage(requireWithin(projectFactsStrip, /Project Store/, "Round 2 Project Store strip remains available outside the clean surface"));
checkMessage(requireWithin(`${projectFactsStrip}\n${projectFactsUiSummary}`, /project\.vibe/, "Phase 36 project.vibe fact source copy"));
checkMessage(requireWithin(`${projectFactsStrip}\n${projectFactsUiSummary}`, /project files/, "Phase 36 project files fact source copy"));
checkMessage(requireWithin(projectFactsStrip, /runtime-state/, "Round 2 runtime-state label"));
checkMessage(requireWithin(projectFactsStrip, /derived cache/, "Round 2 runtime-state derived cache copy"));
checkMessage(requireWithin(projectFactsUiSummary, /不是事实源/, "Round 2 runtime-state not source-of-truth copy"));
checkMessage(requireWithin(projectFactsStrip, /create/, "Round 2 create plan action"));
checkMessage(requireWithin(projectFactsStrip, /open/, "Round 2 open plan action"));
checkMessage(requireWithin(projectFactsStrip, /save/, "Round 2 save plan action"));
checkMessage(requireWithin(projectStoreSnapshotForUi, /createProjectStoreSnapshot/, "Round 2 Project Store snapshot builder"));
checkMessage(requireWithin(projectFactsUiSummary, /buildProjectStoreIoGate/, "Round 2 Project Store IO gate builder"));
checkMessage(requireWithin(projectFactsUiSummary, /saveProjectStoreSnapshot/, "Round 2 Project Store save plan builder"));
for (const label of ["角色参考", "场景/天气参考", "道具参考", "音频参考", "待复核", "已锁定"]) {
  checkMessage(requireWithin(minimalAssetLibrary, new RegExp(label), `Asset Library default ${label} slot copy`));
}
const minimalAssetLibraryCopy = extractStringLiterals(minimalAssetLibrary);
checkMessage(requireWithin(minimalAssetLibrary, /正在准备参考/, "Asset generation running copy must describe generation, not project connection"));
check(!/assetGenerationAction\?\.disabled\)[\s\S]{0,120}正在连接项目/.test(minimalAssetLibrary), "Running asset generation must not be mislabeled as project connection");
checkMessage(requireWithin(minimalAssetLibrary, /未选择项目\|未同步\|连接项目失败/, "Project connection copy should only trigger on actual project mismatch messages"));
const directorCreatorFacingCopy = extractStringLiterals([
  minimalAssetLibrarySource,
  minimalAgentPanelSource,
  agentPanelProjectionSource,
  creatorDeskPanelsSource,
  settingsShellSource,
  image2AssetGenerationActionSource,
  image2EndFrameActionSource,
  p6RealImage2ActionSource,
  localIndexTtsActionSource,
  localQwen3TtsCloneActionSource,
].join("\n"));
for (const [label, pattern] of [
  ["角色主参考", /角色主参考/],
  ["场景 master", /场景\s*master/i],
  ["风格文本/锚图", /风格文本\/锚图/],
  ["风格 / 道具", /风格\s*\/\s*道具/],
  ["文本约束", /文本约束/],
  ["候选", /候选/],
  ["visible review copy", />\s*review\s*</i],
  ["Voice Source Library", /Voice\s+Source\s+Library/i],
  ["voice role copy", /角色音色|音乐方向|环境声|声音风格|旁白/],
  ["audio reuse copy", /可复用/],
]) {
  check(!pattern.test(minimalAssetLibraryCopy), `Asset Library default copy must not expose ${label}`);
}
for (const [label, pattern] of [
  ["stiff confirm-now copy", /确认现在/],
  ["provider return jargon", /回流后/],
  ["manual review jargon", /人工复核/],
  ["asset internal reusable-subject rule", /可复用主体|局部细节/],
  ["old project-reference CTA", /补全项目参考|补全参考|补全中|扫描整个项目/],
  ["casual negative role label", /不管/],
]) {
  check(!pattern.test(directorCreatorFacingCopy), `Director creator-facing copy must not expose ${label}`);
}
checkMessage(requireWithin(directorCreatorFacingCopy, /补齐[\s\S]*参考/, "Image generation confirmation must use creator-facing copy"));
checkMessage(requireWithin(directorCreatorFacingCopy, /结果先给你看/, "Generation actions should explain review behavior in user language"));
checkMessage(requireWithin(minimalAssetLibrary, /className="asset-library-advanced"[\s\S]*placeholder="手填路径（可选）"[\s\S]*placeholder="补充说明（可选）"/, "Asset Library manual path and notes must stay behind advanced add controls"));
checkMessage(requireWithin(minimalAssetLibrary, /className="asset-library-advanced asset-library-selected-advanced"[\s\S]*aria-label="编辑补充说明"/, "Asset Library selected notes editor must stay behind advanced controls"));
checkMessage(requireWithin(appSource, /voiceSourceLibrary=\{workbenchRuntimeState\.voiceSourceLibrary\}/, "Asset Library receives workspace voice references"));
for (const label of ["type", "authority", "future", "shots"]) {
  check(!new RegExp(`<dt>${label}</dt>|>${label}<`).test(minimalAssetLibrary), `Director Clean Mode asset cards must not expose ${label} metadata`);
}
checkMessage(requireWithin(minimalAssetLibrary, /onAddAsset/, "Round 2 Asset Library add callback"));
checkMessage(requireWithin(minimalAssetLibrary, /onUpdateAsset/, "Round 2 Asset Library update callback"));
checkMessage(requireWithin(minimalAssetLibrary, /onMarkAssetStatus/, "Round 2 Asset Library status callback"));
checkMessage(requireWithin(assetLibraryUserBlockers, /缺角色参考/, "Round 2 missing character blocker"));
checkMessage(requireWithin(assetLibraryUserBlockers, /缺场景\/天气参考/, "Round 2 missing scene blocker"));
checkMessage(requireWithin(assetLibraryUserBlockers, /待复核/, "Round 2 candidate review blocker"));
checkMessage(requireWithin(assetSourceKindForPath, /contact_sheet/, "Round 2 contact sheet source filter"));
checkMessage(requireWithin(assetSourceKindForPath, /provider_temp_output/, "Round 2 temp output source filter"));
checkMessage(requireWithin(assetSourceKindForPath, /failed_output/, "Round 2 failed output source filter"));
checkMessage(requireWithin(assetSourceKindForPath, /shot_output/, "Round 2 shot output source filter"));

checkMessage(requireAny(stylesSource, [/asset-library/, /\.asset-panel/], "Asset Library styling hook"));
checkMessage(requireWithin(stylesSource, /asset-library-toolbar/, "Round 2 Asset Library toolbar styling hook"));
checkMessage(requireWithin(stylesSource, /asset-edit-surface/, "Round 2 Asset Library edit styling hook"));
checkMessage(requireWithin(stylesSource, /project-facts-strip/, "Round 2 Project Store strip styling hook"));
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
  "ProviderDock",
  "EnvelopePreview",
].map((name) => findOptionalFunctionBody(appSource, name));
const diagnosticsSurface = `${diagnosticsComponentBodies.join("\n")}\n${extractedDiagnosticsSources.join("\n")}`;
const diagnosticsTermTotal = directorTerms.reduce((sum, [, pattern]) => sum + countPattern(diagnosticsSurface, pattern), 0);

check(
  directorTermTotal === 0,
  `DirectorMode contains engineering terms (${directorTermCounts.map(([term, count]) => `${term}:${count}`).join(", ")}); move details behind Diagnostics`,
);
// Note: threshold intentionally low (>=4) since Diagnostics contains engineering data by design;
// high term counts (e.g. 1400) are expected and do not indicate a regression.
check(
  diagnosticsTermTotal >= Math.max(4, directorTermTotal),
  "DiagnosticsMode should remain the primary home for engineering/status terms",
);

const minimalDirectorSurface = `${directorMode}\n${directorProgressStrip}\n${realPilotDirectorStatus}\n${oneShotActionPanel}\n${minimalAgentPanel}\n${creatorDeskPanels}\n${minimalTopNav}\n${minimalProjectPlan}`;
for (const [term, pattern] of [
  ["provider", /provider/i],
  ["receipt", /receipt/i],
  ["授权票据", /授权票据/],
  ["授权引用", /授权引用/],
  ["请求票据", /请求票据/],
  ["Round", /\bRound\b/i],
  ["Phase", /\bPhase\b/i],
  ["ZP", /\bZP\d*/i],
  ["strict edit", /strict\s+edit/i],
  ["edit 证据", /edit\s*证据/i],
  ["handoff", /handoff/i],
  ["hash-bound", /hash-bound/i],
  ["semantic QA", /semantic\s+QA/i],
  ["Queue Shell", /Queue\s+Shell/i],
  ["Provider Lock", /Provider\s+Lock/i],
  ["gate", /\bgate\b/i],
  ["queue", /\bqueue\b/i],
  ["runtime 状态", /runtime\s+状态/i],
  ["runtime endpoint", /runtime\s+endpoint/i],
  ["sidecar", /sidecar/i],
  ["Image2", /Image2/i],
  ["准备小样包", /准备小样包/],
  ["确认 handoff", /确认\s+handoff/i],
  ["准备授权票据", /准备授权票据/],
  ["检查回流", /检查回流/],
  ["复核检查", /复核检查/],
]) {
  check(!pattern.test(defaultMountedDirectorCopySurface), `default mounted Director surface must not expose ${term}`);
}
const projectRealChainUserSurface = [
  projectRealChainPanel,
  findFunctionBody(projectRealChainPanelSource, "projectRealChainStatusLabel"),
  findFunctionBody(projectRealChainPanelSource, "projectReviewCheckStatusLabel"),
  findFunctionBody(projectRealChainPanelSource, "projectReviewCheckDetail"),
  findFunctionBody(projectRealChainPanelSource, "projectPreviewReadyLabel"),
  findFunctionBody(projectRealChainPanelSource, "projectProductionReviewLabel"),
  findFunctionBody(projectRealChainPanelSource, "projectPermissionReceiptLabel"),
  findFunctionBody(projectRealChainPanelSource, "projectOneShotStatusLabel"),
  findFunctionBody(projectRealChainPanelSource, "projectOneShotProgress"),
  findFunctionBody(projectRealChainPanelSource, "projectOneShotEvidence"),
].join("\n");
checkMessage(requireWithin(projectRealChainUserSurface, /项目状态/, "current project chain panel must use creator-facing project status copy"));
checkMessage(requireWithin(projectRealChainUserSurface, /同步状态/, "current project chain panel must use light sync copy"));
checkMessage(requireWithin(projectRealChainUserSurface, /本地复核/, "current project chain panel must describe local review without Image2/demo copy"));
checkMessage(requireWithin(projectRealChainUserSurface, /Preview[\s\S]*ready/, "current project chain panel must expose preview ready state"));
checkMessage(requireWithin(projectRealChainUserSurface, /Production[\s\S]*needs_review/, "current project chain panel must expose production review state"));
checkMessage(requireWithin(projectRealChainUserSurface, /displayTitle[\s\S]*runtime 状态已同步/, "current project chain panel must show bound project title instead of sandbox project id"));
checkMessage(requireWithin(projectRealChainUserSurface, /未选择项目/, "current project chain panel must show unbound project copy"));
checkMessage(requireWithin(projectRealChainUserSurface, /未同步/, "current project chain panel must show unsynced project copy"));
checkMessage(requireWithin(projectRealChainUserSurface, /项目路径/, "current project chain panel must expose a simple project path entry"));
checkMessage(requireWithin(projectRealChainUserSurface, /最近项目/, "current project chain panel must expose recent project choices"));
checkMessage(requireWithin(projectRealChainUserSurface, /连接项目/, "current project chain panel must expose a creator-facing connect action"));
checkMessage(requireWithin(projectRealChainUserSurface, /准备小样包[\s\S]*确认动作[\s\S]*许可回执[\s\S]*结果检查/, "current project chain panel must expose the P6 one-shot four-step flow"));
checkMessage(requireWithin(projectRealChainUserSurface, /授权票据/, "current project chain panel must expose localized permission receipt copy"));
checkMessage(requireWithin(projectRealChainUserSurface, /授权引用/, "current project chain panel must expose localized authorization reference copy"));
checkMessage(requireWithin(projectRealChainUserSurface, /只生成许可回执/, "current project chain panel must explain permission-receipt-only behavior"));
checkMessage(requireWithin(projectRealChainUserSurface, /不读取密钥、不直接生成/, "current project chain panel must explain no secret read/no direct generation behavior"));
checkMessage(requireWithin(projectRealChainPanel, /permissionBaseReady[\s\S]*Boolean\(image2OneShotState\.receipt \|\| image2OneShotState\.summary\?\.receipt\)[\s\S]*&& sampleWaiting[\s\S]*&& !sampleRunning[\s\S]*&& !sampleReview/, "permission receipt action must be enabled only after handoff confirmation"));
check(!/permissionBaseReady[\s\S]{0,180}sampleReady\s*\|\|\s*sampleWaiting/.test(projectRealChainPanel), "prepared sample state must not enable permission receipt action");
checkMessage(requireWithin(confirmImage2OneShot, /confirmProjectImage2OneShot/, "one-shot confirm action must keep a distinct confirmation step"));
check(!/prepareProjectImage2OneShotTrigger/.test(confirmImage2OneShot), "one-shot confirm action must not auto-prepare external execution; permission receipt stays a separate user action");
check(!/prepareProjectImage2OneShotTrigger/.test(appSource), "App shell must not import or auto-call the external one-shot trigger helper");
checkMessage(requireWithin(projectRealChainPanel, /className="project-real-chain-messages"[\s\S]*className="project-real-chain-message"/, "current project chain messages must be grouped in one grid item"));
checkMessage(requireWithin(stylesSource, /\.project-real-chain-messages\s*\{[\s\S]*grid-area:\s*message[\s\S]*display:\s*flex[\s\S]*flex-wrap:\s*wrap/, "current project chain messages must wrap in one shared grid area"));
checkMessage(requireWithin(stylesSource, /\.project-real-chain-permission\s*\{[\s\S]*grid-area:\s*permission[\s\S]*grid-template-columns:/, "permission receipt row should have stable responsive columns"));
checkMessage(requireWithin(stylesSource, /\.project-real-chain-permission\s*\{[\s\S]*justify-self:\s*stretch[\s\S]*width:\s*100%[\s\S]*box-sizing:\s*border-box/, "permission receipt row should fill the current-project grid area"));
checkMessage(requireWithin(stylesSource, /@media \(max-width:\s*1040px\)[\s\S]*\.project-real-chain-panel\s*\{[\s\S]*grid-template-areas:[\s\S]*"batch"[\s\S]*"oneshot"[\s\S]*"policy"[\s\S]*"evidence"[\s\S]*"permission"/, "mobile current-project grid template must include the one-shot area before permission row"));
checkMessage(requireWithin(stylesSource, /@media \(max-width:\s*1040px\)[\s\S]*\.project-real-chain-permission\s*\{[\s\S]*grid-template-columns:\s*1fr[\s\S]*justify-items:\s*stretch[\s\S]*\.project-real-chain-permission > div,\s*[\s\S]*\.project-real-chain-permission input,\s*[\s\S]*\.project-real-chain-permission button\s*\{[\s\S]*width:\s*100%[\s\S]*box-sizing:\s*border-box/, "permission receipt row children should fill narrow mobile layout"));
check(!/\.project-real-chain-message\s*\{[\s\S]{0,160}grid-area:\s*message/.test(stylesSource), "individual current project chain messages must not claim the grid area");
checkMessage(requireWithin(minimalTopNav, /aria-label="项目计划状态"/, "top nav project plan status aria label should be localized"));
check(!/real-demo-005/.test(`${appSource}\n${stylesSource}`), "main app/styles must not keep 005 demo class names");
for (const [term, pattern] of [
  ["runtime endpoint", /runtime\s+endpoint/i],
  ["fallback report", /fallback\s+report/i],
  ["005 sandbox", /005\s+sandbox/i],
  ["real demo id", /real_demo_e2e_005/i],
  ["demo", /\bdemo\b/i],
  ["provider submit", /provider\s+未提交|provider\s+submit/i],
  ["provider", /\bprovider\b/i],
  ["prompt", /\bprompt\b/i],
  ["queue", /\bqueue\b/i],
  ["prepare status", /prepare\s+未执行|prepare\s+ran|prepareRan/i],
  ["live submit", /live\s+submit/i],
  ["ledger copy", /\bledger\b/i],
  ["needs review English", /needs\s+review/i],
]) {
  check(!pattern.test(projectRealChainUserSurface), `current project chain panel must not expose ${term}`);
}
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
  ["queue", /queue/i],
  ["Local Orchestrator", /Local\s+Orchestrator|LocalOrchestrator/i],
  ["Full Task Subagent Packet Planner", /Full\s+Task\s+Subagent\s+Packet\s+Planner/i],
  ["validated packet", /validated\s+packet/i],
  ["TaskEnvelope", /Task\s*Envelope|TaskEnvelope/i],
  ["knowledge trace", /knowledge\s+trace/i],
  ["source fact trace", /source\s+fact\s+trace/i],
  ["manifest", /manifest/i],
  ["spawn", /spawn/i],
  ["daemon", /daemon/i],
  ["QA pending", /QA\s+pending/i],
]) {
  check(!pattern.test(minimalDirectorSurface), `main Director surface must not expose ${term}`);
}
for (const copy of ["Run", "Submit", "Execute", "直接提交", "自动执行", "立即生成"]) {
  check(
    !new RegExp(copy.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(minimalDirectorButtonSurface),
    `real test round main Director surface must not expose dangerous ${copy} button`,
  );
}
const forbiddenMinimalTerms = [
  ["Queue Shell", /Queue\s+Shell/i],
  ["Local Orchestrator", /Local\s+Orchestrator|LocalOrchestrator/i],
  ["Provider Lock", /Provider\s+Lock/i],
  ["Task Envelope", /Task\s+Envelope|taskEnvelope/i],
  ["Desktop Runtime", /Desktop\s+Runtime/i],
  ["Permission Shell", /Permission\s+Shell/i],
  ["Subagent Worker Runtime", /Subagent\s+Worker\s+Runtime/i],
  ["Worker Runtime", /Worker\s+Runtime/i],
  ["Full Task Subagent Packet Planner", /Full\s+Task\s+Subagent\s+Packet\s+Planner/i],
  ["validated envelope", /validated\s+envelope/i],
  ["validated packet", /validated\s+packet/i],
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
  ["spawn", /spawn/i],
  ["daemon", /daemon/i],
  ["QA pending", /QA\s+pending/i],
  ["credential/API key", /credential|API\s*key/i],
  ["Image2 Asset", /Image2\s+Asset/i],
  ["Image2 runtime", /Image2\s+runtime/i],
  ["Keyframe Runtime", /Keyframe\s+Runtime/i],
  ["keyframe pair", /keyframe\s+pair/i],
  ["end-frame derivation", /end[-\s]?frame\s+derivation/i],
  ["provider locks", /provider\s+locks?/i],
  ["Visual Consistency Contract", /Visual\s+Consistency\s+Contract/i],
  ["shot layout", /shot\s+layout/i],
  ["spatial memory", /spatial\s+memory/i],
  ["master inheritance QA", /master\s+inheritance\s+QA/i],
  ["knowledge trace", /knowledge\s+trace/i],
  ["source fact trace", /source\s+fact\s+trace/i],
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
  ["Knowledge Pack User Management", /Knowledge\s+Pack\s+User\s+Management/i],
  ["Worker Runtime", /Worker\s+Runtime/i],
  ["Knowledge Router", /Knowledge\s+Router/i],
  ["Knowledge Library", /Knowledge\s+Library/i],
  ["hash", /\bhash\b/i],
  ["Visual Consistency Contract", /Visual\s+Consistency\s+Contract/i],
  ["Full Task Subagent Packet Planner", /Full\s+Task\s+Subagent\s+Packet\s+Planner/i],
  ["validated packet", /validated\s+packet/i],
  ["knowledge trace", /knowledge\s+trace/i],
  ["source fact trace", /source\s+fact\s+trace/i],
  ["shot layout", /shot\s+layout/i],
  ["spatial memory", /spatial\s+memory/i],
  ["keyframe pair", /keyframe\s+pair/i],
  ["master inheritance QA", /master\s+inheritance\s+QA/i],
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
  ["Agent spawn", /Agent\s+spawn|spawn\s+Agent/i],
  ["Agent resume", /Agent\s+resume|resume\s+Agent/i],
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
  ["Agent CLI Adapter Spike", /Agent\s+CLI\s+Adapter\s+Spike/i],
  ["Agent CLI Adapter readiness", /Agent\s+CLI\s+Adapter\s+readiness/i],
  ["Run Agent", /Run\s+Agent/i],
  ["Spawn Agent", /Spawn\s+Agent/i],
  ["Resume Agent", /Resume\s+Agent/i],
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
  ["queue harness", /queue\s+harness/i],
  ["auto-continue", /auto[-\s]?continue/i],
  ["queue machine", /queue\s+machine/i],
  ["TaskEnvelope", /Task\s*Envelope|TaskEnvelope/i],
  ["manifest", /manifest/i],
  ["QA pending", /QA\s+pending/i],
  ["running planned", /running\s+planned/i],
  ["daemon", /daemon/i],
  ["Agent spawn", /Agent\s+spawn|spawn\s+Agent/i],
  ["spawn", /spawn/i],
  ["provider submit", /provider\s+submit/i],
  ["runtimeState.localOrchestrator", /runtimeState\.localOrchestrator|localOrchestrator/i],
  ["next-ready", /next[-\s]?ready/i],
  ["waiting output", /waiting\s+output/i],
  ["complete verified", /complete\s+verified/i],
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
const phase40ForbiddenMainTerms = [
  ["Phase 40", /Phase\s*40/i],
  ["Worker Runtime", /Worker\s+Runtime/i],
  ["validated envelope", /validated\s+envelope/i],
  ["structured result", /structured\s+result/i],
  ["spawn", /spawn/i],
  ["daemon", /daemon/i],
  ["shell", /shell/i],
  ["credential", /credential/i],
  ["provider submit", /provider\s+submit/i],
];
for (const [term, pattern] of phase40ForbiddenMainTerms) {
  const count = countPattern(phase2123DirectorSurface, pattern);
  check(count === 0, `Phase 40 main Director surface must expose 0 ${term} term(s), found ${count}`);
}
const phase41ForbiddenMainTerms = [
  ["Phase 41", /Phase\s*41/i],
  ["Provider Closed-loop Shell", /Provider\s+Closed[-\s]?loop\s+Shell/i],
  ["watcher", /watcher/i],
  ["manifest", /manifest/i],
  ["QA gate", /QA\s+gate/i],
  ["promotion gate", /promotion\s+gate/i],
  ["provider submit", /provider\s+submit/i],
  ["live submit", /live\s+submit/i],
  ["credential", /credential/i],
  ["shell", /shell/i],
];
for (const [term, pattern] of phase41ForbiddenMainTerms) {
  const count = countPattern(phase2123DirectorSurface, pattern);
  check(count === 0, `Phase 41 main Director surface must expose 0 ${term} term(s), found ${count}`);
}
const phase42ForbiddenMainTerms = [
  ["Phase 42", /Phase\s*42/i],
  ["Beta Acceptance", /Beta\s+Acceptance/i],
  ["Mac/Windows readiness", /Mac\/Windows\s+readiness|Mac\s+readiness|Windows\s+readiness/i],
  ["test matrix", /test\s+matrix/i],
  ["provider submit", /provider\s+submit/i],
  ["live submit", /live\s+submit/i],
  ["credential", /credential/i],
  ["shell", /shell/i],
  ["final phase", /final\s+phase/i],
];
for (const [term, pattern] of phase42ForbiddenMainTerms) {
  const count = countPattern(phase2123DirectorSurface, pattern);
  check(count === 0, `Phase 42 main Director surface must expose 0 ${term} term(s), found ${count}`);
}
check(!/Formal\s+Gate|Proxy\s+Duration|Draft\s+Events|blockedPlaceholder/i.test(minimalPreview), "Preview Player copy must stay short and not show gate/proxy counters");
check(/locked/i.test(minimalAssetLibrary) && /review/i.test(minimalAssetLibrary) && !/>\s*candidate\s*</i.test(minimalAssetLibrary), "Asset Library must keep locked/review consistency states without visible candidate copy");

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
checkMessage(requireWithin(settingsShell, /Agent CLI Adapter readiness/i, "Phase 29 agent CLI Adapter readiness summary in Settings"));
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
  "Run Agent",
  "Spawn Agent",
  "Resume Agent",
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
