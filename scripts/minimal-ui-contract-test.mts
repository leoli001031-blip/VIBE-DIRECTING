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
  const literals = [];
  for (let index = 0; index < source.length; index += 1) {
    const quote = source[index];
    if (quote !== "\"" && quote !== "'" && quote !== "`") continue;
    let value = "";
    for (index += 1; index < source.length; index += 1) {
      const char = source[index];
      if (char === "\\") {
        value += char;
        if (index + 1 < source.length) {
          index += 1;
          value += source[index];
        }
        continue;
      }
      if (char === quote) break;
      value += char;
    }
    literals.push(value);
  }
  return literals.join("\n");
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
const projectFileUiPath = "src/ui/app/projectFileUi.ts";
const projectStatusViewModelPath = "src/ui/app/projectStatusViewModel.ts";
const directorModePath = "src/ui/director/DirectorModeShell.tsx";
const directorProgressStripPath = "src/ui/director/DirectorProgressStrip.tsx";
const directorWorkflowOverviewPath = "src/ui/director/DirectorWorkflowOverview.tsx";
const minimalDirectorStatusDotPath = "src/ui/director/MinimalDirectorStatusDot.tsx";
const minimalTopNavPath = "src/ui/director/MinimalTopNav.tsx";
const minimalStoryFlowPath = "src/ui/director/MinimalStoryFlow.tsx";
const directorSkillUiPath = "src/ui/director/directorSkillUi.ts";
const newVideoStartPath = "src/ui/director/NewVideoStart.tsx";
const newVideoProjectVibePlannerPath = "src/core/newVideoProjectVibePlanner.ts";
const assetReconciliationPath = "src/core/assetReconciliation.ts";
const minimalAssetLibraryPath = "src/ui/director/MinimalAssetLibrary.tsx";
const assetLibraryUiPath = "src/ui/director/assetLibraryUi.ts";
const creatorDeskPanelsPath = "src/ui/director/CreatorDeskPanels.tsx";
const creatorDeskProjectionPath = "src/ui/app/creatorDeskProjection.ts";
const minimalPreviewPath = "src/ui/director/MinimalPreview.tsx";
const minimalAgentPanelPath = "src/ui/director/MinimalAgentPanel.tsx";
const agentVideoExecutionControllerPath = "src/ui/director/agentVideoExecutionController.ts";
const agentProductCapabilitiesPath = "src/ui/director/agentProductCapabilities.ts";
const agentPanelProjectionPath = "src/ui/director/agentPanelProjection.ts";
const agentCoreToolEventsPath = "src/agent-core/toolEvents.ts";
const confirmedActionOutcomePath = "src/agent-core/confirmedActionOutcome.ts";
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
const currentProjectRuntimeClientPath = "src/core/projectCurrentBindingClient.ts";
const projectAgentStagedPlanDraftPath = "src/project/projectAgentStagedPlanDraft.ts";
const localRuntimeApiServerPath = "scripts/local-runtime-api-server.mts";
const stylesPath = "src/styles.css";
const directorStylesPath = "src/styles/director.css";
const projectRealChainPanelCssPath = "src/ui/project/ProjectRealChainPanel.css";
const packagePath = "package.json";
const sequenceDocPath = "docs/core-development-sequence.md";
const contractDocPath = "docs/ui/minimal-director-ui-contract.md";

const appSource = stripComments(readText(appPath));
const projectFileUiSource = stripComments(readText(projectFileUiPath));
const projectStatusViewModelSource = stripComments(readText(projectStatusViewModelPath));
const directorModeSource = stripComments(readText(directorModePath));
const directorProgressStripSource = stripComments(readText(directorProgressStripPath));
const directorWorkflowOverviewSource = stripComments(readText(directorWorkflowOverviewPath));
const minimalDirectorStatusDotSource = stripComments(readText(minimalDirectorStatusDotPath));
const minimalTopNavSource = stripComments(readText(minimalTopNavPath));
const minimalStoryFlowSource = stripComments(readText(minimalStoryFlowPath));
const directorSkillUiSource = stripComments(readText(directorSkillUiPath));
const newVideoStartSource = stripComments(readText(newVideoStartPath));
const newVideoProjectVibePlannerSource = stripComments(readText(newVideoProjectVibePlannerPath));
const assetReconciliationSource = stripComments(readText(assetReconciliationPath));
const minimalAssetLibrarySource = stripComments(readText(minimalAssetLibraryPath));
const assetLibraryUiSource = stripComments(readText(assetLibraryUiPath));
const creatorDeskPanelsSource = stripComments(readText(creatorDeskPanelsPath));
const creatorDeskProjectionSource = stripComments(readText(creatorDeskProjectionPath));
const minimalPreviewSource = stripComments(readText(minimalPreviewPath));
const minimalAgentPanelSource = stripComments(readText(minimalAgentPanelPath));
const agentVideoExecutionControllerSource = stripComments(readText(agentVideoExecutionControllerPath));
const agentProductCapabilitiesSource = stripComments(readText(agentProductCapabilitiesPath));
const agentPanelProjectionSource = stripComments(readText(agentPanelProjectionPath));
const agentCoreToolEventsSource = stripComments(readText(agentCoreToolEventsPath));
const confirmedActionOutcomeSource = stripComments(readText(confirmedActionOutcomePath));
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
const currentProjectRuntimeClientSource = stripComments(readText(currentProjectRuntimeClientPath));
const projectAgentStagedPlanDraftSource = stripComments(readText(projectAgentStagedPlanDraftPath));
const localRuntimeApiServerSource = stripComments(readText(localRuntimeApiServerPath));
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
const projectStatusViewModel = findFunctionBody(projectStatusViewModelSource, "buildProjectStatusViewModel");
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
const shotAudioInspector = findFunctionBody(appSource, "ShotAudioInspector");
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
checkMessage(requireWithin(appSource, /import\s+\{\s*DirectorMode\s*\}\s+from\s+"\.\/ui\/director\/DirectorModeShell(?:AgentKernel(?:V\d+)?)?"/, "App must import extracted DirectorModeShell component"));
checkMessage(requireWithin(appBody, /<DirectorMode\b/, "App must mount extracted DirectorMode component"));
checkMessage(requireWithin(projectStatusViewModelSource, /export\s+function\s+buildProjectStatusViewModel\s*\(/, "Project status view model must expose a single creator-facing status builder"));
checkMessage(requireWithin(projectStatusViewModel, /stage[\s\S]*doing[\s\S]*waitingFor[\s\S]*nextAction/, "Project status view model must explain current stage, current work, waiting state, and next action"));
checkMessage(requireWithin(projectStatusViewModelSource, /videoStage\?:[\s\S]*CreatorVideoStageLike/, "Project status view model must accept the creator desk video stage"));
checkMessage(requireWithin(projectStatusViewModelSource, /videoStage\.generation\?\.queueSummary/, "Project status view model must summarize serial video queue progress from the unified video stage"));
checkMessage(requireWithin(projectStatusViewModelSource, /referenceBatch\?:[\s\S]*ReferenceBatchProgressLike/, "Project status view model must accept reference generation batch progress"));
checkMessage(requireWithin(projectStatusViewModelSource, /referenceProgressLabel[\s\S]*readyCount[\s\S]*missingCount[\s\S]*Math\.max\([\s\S]*plannedCount[\s\S]*ready \+ missing[\s\S]*retryCount/, "Project status view model must turn reference generation progress into creator-facing copy"));
checkMessage(requireWithin(projectStatusViewModelSource, /videoTaskFactsForStatus[\s\S]*原因[\s\S]*下一步[\s\S]*completed[\s\S]*needs_review[\s\S]*输出[\s\S]*下一步[\s\S]*当前段", "排队", "查询", "提交号"/, "Project status view model must keep active queue facts compact and reserve next-step facts for failure/completed states"));
checkMessage(requireWithin(projectStatusViewModelSource, /agentCommand\?:[\s\S]*CreatorAgentCommandLike/, "Project status view model must accept the current Agent suggestion"));
checkMessage(requireWithin(projectStatusViewModelSource, /agentTimelineStatus\?:\s*VibeAgentTimelineStatusView[\s\S]*if \(input\.agentTimelineStatus\)[\s\S]*timelineStatus\.stage[\s\S]*timelineStatus\.nextAction/, "Project status view model must be able to use the real Agent timeline as the visible status source"));
checkMessage(requireWithin(projectStatusViewModelSource, /newVideoStatus\?:[\s\S]*NewVideoEntryStatusLike/, "Project status view model must accept the fresh new-video planning status"));
checkMessage(requireWithin(projectStatusViewModel, /newVideoStatus\.status === "planning"[\s\S]*正在拆镜头/, "Project status view model must show active fresh-project planning instead of empty-project copy"));
checkMessage(requireWithin(projectStatusViewModelSource, /draftShotCount\?:\s*number/, "Fresh new-video status should carry draft shot counts for the unified status facts"));
checkMessage(requireWithin(projectStatusViewModel, /草案 \$\{countLabel\(shotCount, "个"\)\}/, "Project status facts should show draft shot counts before the project is confirmed"));
checkMessage(requireWithin(projectStatusViewModel, /!input\.folderReady && input\.projectReady[\s\S]*需要保存位置[\s\S]*在右侧选择保存位置/, "Confirmed browser drafts must ask users to choose a save location from the Agent rail before generation actions"));
checkMessage(requireWithin(projectStatusViewModelSource, /const localProjectSetupRequired = !input\.folderReady && input\.projectReady && shotCount > 0[\s\S]*localProjectSetupRequired[\s\S]*\? "选择保存位置"/, "Confirmed browser drafts must keep the project overview focused on choosing a save location before any later reference or video guidance"));
checkMessage(requireWithin(projectStatusViewModelSource, /input\.projectReady && shotCount > 0[\s\S]*"待保存草案"[\s\S]*"先写想法"/, "Confirmed browser drafts must show draft-save status instead of asking for another idea"));
checkMessage(requireWithin(appSource, /function\s+isBrowserDraftProjectRoot[\s\S]*\.vibe-runtime\/browser-projects[\s\S]*selectedProjectIsBrowserDraft[\s\S]*browserDraftHasNoLocalProject[\s\S]*!selectedProjectIsBrowserDraft/, "App must not treat browser draft storage as a real local project folder"));
checkMessage(requireWithin(appSource, /runtimeBindingIsLocalProject[\s\S]*browserDraftHasNoLocalProject = !runtimeBindingIsLocalProject[\s\S]*activeProjectFileRoot[\s\S]*runtimeBindingIsLocalProject[\s\S]*runtimeProjectBinding\.projectRoot/, "Runtime-bound local projects must override unavailable browser folder dialogs and become the active project root"));
checkMessage(requireWithin(projectStatusViewModelSource, /label:\s*"AI 导演"/, "Project status facts should use creator-facing AI director label"));
checkMessage(requireWithin(projectStatusViewModelSource, /function referenceDisplayedMissingCount[\s\S]*referenceGapCount[\s\S]*framePlan\?\.missingCount[\s\S]*referenceBatch\?\.missingCount[\s\S]*visualMemory\.summary\.missing/, "Project status view model must merge all missing-reference sources before showing reference readiness"));
checkMessage(requireWithin(projectStatusViewModelSource, /displayedMissing[\s\S]*`还缺 \$\{displayedMissing\} 张画面参考`/, "Local projects should surface missing references before review when references are missing"));
checkMessage(requireWithin(projectStatusViewModel, /missingReferenceNextAction[\s\S]*input\.agentCommand\?\.kind === "generate_references"[\s\S]*input\.agentCommand\.label[\s\S]*生成参考[\s\S]*missingReferences[\s\S]*missingReferenceNextAction/, "Local projects should prioritize boundary-aware reference generation guidance instead of routing users to review"));
checkMessage(requireWithin(projectStatusViewModelSource, /const currentAssetWaiting = assetWaitingLabel\(input\)[\s\S]*if \(input\.agentTimelineStatus\)[\s\S]*!currentAssetWaiting/, "Hard missing-reference state must override optimistic Agent timeline copy"));
checkMessage(requireWithin(projectStatusViewModelSource, /audioFactLabel[\s\S]*声音参考/, "Project status view model must summarize voice references in creator-facing copy"));
checkMessage(requireWithin(projectStatusViewModelSource, /exportWorkerCanPrepareDelivery\(input\.exportWorker\)[\s\S]*stage:\s*"等待确认导出"[\s\S]*doing:\s*"本地交付包已整理，确认后才会写入文件"[\s\S]*waitingFor:\s*"右侧确认导出交付包"[\s\S]*tone:\s*"waiting"[\s\S]*input\.exportWorker\?\.readiness === "ready"[\s\S]*stage:\s*"等待确认导出"[\s\S]*nextAction:\s*"在右侧确认导出交付包"/, "Export-ready status must read as waiting for Agent confirmation instead of final delivery readiness"));
check(!/\b(real-chain|relay\s+queue|Project\.vibe|provider)\b/i.test(extractStringLiterals(projectStatusViewModelSource)), "Project status view model copy must hide engineering state sources");
checkMessage(requireWithin(directorModeSource, /function\s+ProjectStatusSummary\s*\(/, "DirectorMode must render the project status summary component"));
checkMessage(requireWithin(directorModeSource, /videoQueryActive[\s\S]*确认查询[\s\S]*查询只取回结果，不会重复提交/, "Project status summary must keep recoverable video actions compact and action-oriented"));
checkMessage(requireWithin(directorMode, /className="director-workbar"[\s\S]*<ProjectStatusSummary\s+status=\{displayedProjectStatusView\}/, "Director workbar must render the displayed unified project status summary"));
checkMessage(requireWithin(directorModeSource, /import type \{ AgentCurrentTaskProjection \}[\s\S]*const \[agentCurrentTaskProjection, setAgentCurrentTaskProjection\] = useState<AgentCurrentTaskProjection>\(\)/, "DirectorMode must store the complete right-rail current-task projection instead of reconstructing a confirmation label"));
checkMessage(requireWithin(directorModeSource, /handleAgentCurrentTaskProjectionChange[\s\S]*setAgentCurrentTaskProjection\([\s\S]*onCurrentTaskProjectionChange=\{handleAgentCurrentTaskProjectionChange\}/, "DirectorMode must receive the structured current-task projection from MinimalAgentPanel"));
checkMessage(requireWithin(directorModeSource, /const displayedPendingAgentConfirmationCopy = agentCurrentTaskProjection\?\.requiresConfirmation[\s\S]*\? agentCurrentTaskProjection\.label[\s\S]*: ""/, "DirectorMode workbar confirmation copy must consume the projected confirmation boundary directly"));
check(!/function latestPendingAgentConfirmation|function pendingAgentConfirmationLabel|function laterUserMessageReplacesPendingConfirmation|function currentAgentCommandConfirmationLabel/.test(directorModeSource), "DirectorMode must not independently parse timeline or command display copy to choose the current confirmation");
checkMessage(requireWithin(minimalAgentPanelSource, /const agentCurrentTaskProjection = useMemo[\s\S]*buildAgentCurrentTaskProjection\([\s\S]*restoredStagedPlan: agentCurrentTaskStagedPlanRestoreFromDraft\(restoredAgentStagedPlanDraft\)/, "Restored staged-plan ownership must enter the workbar through AgentCurrentTaskProjection"));
checkMessage(requireWithin(directorModeSource, /function restoredAgentVideoPermissionContract[\s\S]*draft\?\.status !== "active"[\s\S]*draft\.videoPermissionContract\?\.mode[\s\S]*mode !== "plan_only"[\s\S]*referenceGenerationAllowed:[\s\S]*Boolean\(draft\.videoPermissionContract\?\.referenceGenerationAllowed\)[\s\S]*useEffect\(\(\) => \{[\s\S]*restoredAgentStagedPlanDraft\?\.status !== "active"[\s\S]*setVideoPermissionContract\(\(current\) => \{[\s\S]*restoredAgentVideoPermissionContract\(restoredAgentStagedPlanDraft, current\)/, "DirectorMode must sync the restored staged sidecar permission contract into the shell so plan-only revisions do not leave the workbar on a stale reference-allowed confirmation"));
checkMessage(requireWithin(directorModeSource, /function projectStatusViewWithPendingAgentConfirmation[\s\S]*stage:\s*"等待你确认"[\s\S]*右侧消息里有[\s\S]*先处理消息里的确认/, "Director workbar must let a pending right-rail Agent confirmation override stale project next-step copy"));
checkMessage(requireWithin(directorModeSource, /function projectStatusViewWithEditingAgentConfirmation[\s\S]*editingStoryDraftConfirmation = label === "确认这版故事"[\s\S]*stage:\s*"继续说明"[\s\S]*editingStoryDraftConfirmation \? "正在修改当前草案" : `正在修改「\$\{label\}」`[\s\S]*editingStoryDraftConfirmation \? "发送右侧输入，或清空后回到确认故事" : "发送右侧输入，或清空后再回到确认"[\s\S]*editingStoryDraftConfirmation \? "修改草案" : "正在修改确认"/, "Director workbar must distinguish editing a pending story draft from editing a generic right-rail confirmation"));
check(!/pendingAgentConfirmationHasVisibleCard|staleProjectEditConfirmation|currentCommandConfirmationCopy/.test(directorModeSource), "Director workbar must not arbitrate projected confirmation state against generic command or stale-card copy");
checkMessage(requireWithin(directorMode, /const displayedPendingAgentConfirmationForStatus = displayedPendingAgentConfirmationCopy[\s\S]*projectStatusViewWithPendingAgentConfirmation\([\s\S]*displayedPendingAgentConfirmationForStatus/, "Director workbar must pass the projection-owned task directly into project status surfaces"));
checkMessage(requireWithin(directorMode, /const \[agentCurrentTaskProjection, setAgentCurrentTaskProjection\] = useState<AgentCurrentTaskProjection>\(\)[\s\S]*const displayedPendingAgentConfirmationCopy = agentCurrentTaskProjection\?\.requiresConfirmation[\s\S]*agentCurrentTaskProjection\.label/, "Director workbar and surface gates must use the right rail's complete projection instead of hidden timeline fallback state"));
checkMessage(requireWithin(directorMode, /const \[agentEditingPendingConfirmation,\s*setAgentEditingPendingConfirmation\] = useState\(false\)[\s\S]*handleAgentEditingPendingConfirmationChange[\s\S]*setAgentEditingPendingConfirmation[\s\S]*agentEditingPendingConfirmation && displayedPendingAgentConfirmationCopy[\s\S]*projectStatusViewWithEditingAgentConfirmation\(activeProjectStatusView,\s*displayedPendingAgentConfirmationCopy\)[\s\S]*pendingAgentConfirmationForSurfaces = agentEditingPendingConfirmation && displayedPendingAgentConfirmationCopy[\s\S]*const agentEditingConfirmationLabel = agentEditingPendingConfirmation && displayedPendingAgentConfirmationCopy[\s\S]*displayedPendingAgentConfirmationCopy/, "Director workbar must show editing-confirmation copy while still keeping pending-confirmation gates active for reference, video, and export surfaces"));
checkMessage(requireWithin(creatorDeskPanelsSource, /const agentConfirmationTakingFocus = projectStatusStage === "等待你确认"[\s\S]*const referenceConfirmationEditingTakingFocus = Boolean\([\s\S]*const primaryFlowTakingFocus = agentConfirmationTakingFocus[\s\S]*referenceConfirmationEditingTakingFocus[\s\S]*exportFlowTakingFocus[\s\S]*videoFlowTakingFocus[\s\S]*先处理右侧消息里的确认/, "CreatorDeskPanels must stop competing with the right-side Agent confirmation while a confirmation is pending or being edited"));
checkMessage(requireWithin(creatorDeskPanelsSource, /const exportConfirmationTakingFocus = projectStatusStage === "等待确认导出"[\s\S]*exportFlowTakingFocus = Boolean\([\s\S]*exportConfirmationTakingFocus[\s\S]*missing: exportConfirmationTakingFocus[\s\S]*本地交付包已整理，等待确认[\s\S]*label: exportConfirmationTakingFocus \? "确认导出" : "交付可看"[\s\S]*确认前不会写入导出文件/, "CreatorDeskPanels must describe export-ready work as a right-rail confirmation, not as already final delivery"));
checkMessage(requireWithin(creatorDeskPanelsSource, /const displayCurrentTask = referenceConfirmationEditingTakingFocus[\s\S]*发送修改说明[\s\S]*agentConfirmationTakingFocus[\s\S]*missing: projectStatusView\?\.doing[\s\S]*plan: projectStatusView\?\.nextAction[\s\S]*label: projectStatusView\?\.nextAction/, "CreatorDeskPanels must mirror the active Agent confirmation or edited confirmation in the current-task copy"));
checkMessage(requireWithin(creatorDeskPanelsSource, /const agentConfirmationHandoffActive = agentConfirmationTakingFocus && !referenceConfirmationEditingTakingFocus[\s\S]*const agentConfirmationHandoffLabel = projectStatusView\?\.nextAction \|\| "确认当前消息"[\s\S]*const agentConfirmationHandoffDetail = projectStatusView\?\.waitingFor \|\| "确认前不会执行。"[\s\S]*const showAgentReasoningDisclosure = !agentConfirmationHandoffActive[\s\S]*&& !referenceConfirmationEditingTakingFocus[\s\S]*&& !localProjectSetupTakingFocus/, "CreatorDeskPanels must prepare a compact main-area handoff and hide process reasoning while the right-side Agent confirmation, edited confirmation, or save-location setup owns the action"));
checkMessage(requireWithin(directorModeSource, /function isNewVideoSurfaceAgentTimelineEntry\(entry: VibeAgentTimelineEntry\)[\s\S]*isVibeAgentIntakeTimelineEntry\(entry\)[\s\S]*local_agent_[\s\S]*local_project_setup_[\s\S]*buildVibeAgentTimelineStatusView\(surfaceAgentTimelineEntries\)[\s\S]*agentTimelineStatus:\s*agentTimelineStatusView/, "Director workbar status must share the surface-scoped Agent timeline status source"));
checkMessage(requireWithin(directorModeSource, /function projectStatusViewWithCommittedDraft[\s\S]*stage:\s*"项目故事已更新"[\s\S]*故事已确认/, "Director workbar must collapse already-confirmed draft state into a clear story-updated status"));
checkMessage(requireWithin(directorMode, /projectStatusViewWithCommittedDraft\([\s\S]*projectStatusViewWithActiveVideo\(rawProjectStatusView,\s*creatorDesk\)[\s\S]*isCommittedNewVideoDraftAgentRun\(latestPrototypeAgentDemo\)/, "Director workbar must suppress stale waiting-confirmation status after the draft has been written"));
checkMessage(requireWithin(directorMode, /buildProjectStatusViewModel\(\{[\s\S]*videoStage:\s*creatorDesk\?\.videoStage/, "DirectorMode must feed CreatorDesk videoStage into the unified project status"));
checkMessage(requireWithin(directorMode, /buildProjectStatusViewModel\(\{[\s\S]*referenceBatch:\s*creatorDesk\?\.batchGeneration/, "DirectorMode must feed CreatorDesk reference generation progress into the unified project status"));
checkMessage(requireWithin(directorMode, /visibleAgentCommand[\s\S]*确认生成参考[\s\S]*确认提交视频/, "DirectorMode must adapt CreatorDesk Agent guidance to the visible execution boundary"));
checkMessage(requireWithin(directorMode, /const surfaceAgentCommand = showNewVideoStart \? undefined : visibleAgentCommand[\s\S]*buildProjectStatusViewModel\(\{[\s\S]*agentStage:\s*creatorDesk\?\.agentStage[\s\S]*agentCommand:\s*surfaceAgentCommand/, "DirectorMode must suppress stale CreatorDesk Agent guidance on the new-video intake surface"));
checkMessage(requireWithin(directorMode, /const\s+projectNavReady\s*=\s*projectReady\s*&&\s*!showNewVideoStart/, "DirectorMode must treat an open new-video draft as a draft context, not the old project context"));
checkMessage(requireWithin(directorMode, /const\s+agentSelectionReady\s*=\s*projectReady\s*&&\s*!showNewVideoStart\s*&&\s*agentShotBoundView/, "DirectorMode must not bind the Agent composer to stale project shots while a new-video draft is open"));
checkMessage(requireWithin(directorModeSource, /function restoredNewVideoDraftSummary[\s\S]*confirmation_request[\s\S]*intakePhase === "planning_ready"[\s\S]*draft_confirmed[\s\S]*shotCount/, "DirectorMode must restore pending new-video draft context from the Agent timeline instead of falling back to stale project shots"));
checkMessage(requireWithin(directorModeSource, /function restoredNewVideoDraftStatus[\s\S]*status: "ready"[\s\S]*draftShotCount: restored\.shotCount[\s\S]*const restoredNewVideoStatus = useMemo[\s\S]*restoredNewVideoDraftActive \? restoredNewVideoDraftStatus\(restoredNewVideoDraft\)[\s\S]*if \(newVideoStatus && newVideoStatus\.status !== "empty"\) return[\s\S]*onNewVideoStatusChange\?\.\(restoredNewVideoStatus\)/, "DirectorMode must sync restored pending draft shot counts back to App even after the empty new-video composer reports first, so the top nav does not show stale project story counts"));
checkMessage(requireWithin(directorModeSource, /function newVideoEntryProjectStatusView[\s\S]*项目[\s\S]*新视频[\s\S]*AI 导演[\s\S]*先整理[\s\S]*const newVideoEntryStatusView = useMemo[\s\S]*showNewVideoStart \? newVideoEntryProjectStatusView\(newVideoStatus,\s*restoredNewVideoDraft\)[\s\S]*const activeProjectStatusView = newVideoEntryStatusView \|\| projectStatusView[\s\S]*projectStatusViewWithPendingAgentConfirmation\(\s*activeProjectStatusView/, "DirectorMode must use a clean new-video status view while the new-video entry is visible instead of reusing stale project sync state"));
checkMessage(requireWithin(directorModeSource, /const emptyNewVideoStatus = rawStatusKind === "empty" && !restoredDraftActive[\s\S]*const statusTitle = rawStatusKind === "empty" \? undefined[\s\S]*const statusDetail = rawStatusKind === "empty" \? undefined[\s\S]*const doing = emptyNewVideoStatus \? "AI 会先整理故事和镜头"[\s\S]*const waitingFor = emptyNewVideoStatus \? "故事素材"[\s\S]*const nextAction = emptyNewVideoStatus \? "发送后整理故事和镜头"/, "Empty new-video project status must summarize the Agent-first planning boundary instead of repeating first-input instructions"));
check(!/发送后生成可确认草案/.test(directorModeSource), "Empty new-video status copy must not include confirmation-like words before a draft exists");
check(!/function newVideoEntryProjectStatusView[\s\S]*等待第一条想法/.test(directorModeSource), "Empty new-video project status must not repeat the waiting-for-first-idea copy already owned by the Agent composer");
checkMessage(requireWithin(directorMode, /<MinimalAgentPanel[\s\S]*agentCommand=\{surfaceAgentCommand\}[\s\S]*projectObservation=\{projectNavReady \? creatorDesk\?\.projectObservation : undefined\}/, "DirectorMode must pass project Agent commands and observations only when the current project context is active"));
checkMessage(requireWithin(directorMode, /shot=\{agentSelectionReady \? selectedShot : undefined\}[\s\S]*selectedShots=\{agentSelectionReady \? selectedShots : \[\]\}/, "DirectorMode must clear old shot selections from the Agent composer while a new-video draft is open"));
checkMessage(requireWithin(minimalAgentPanelSource, /projectObservation\?:\s*ProjectObservationProjection[\s\S]*if \(projectObservation && !referencesUsableForAgent && !timelineShowsReferenceReady && !timelineHasReferenceValidation && !timelineShowsVideoReady && !timelineHasVideoValidation\) return projectObservation;[\s\S]*buildProjectObservation\([\s\S]*referenceExecutionValidated:\s*timelineHasReferenceValidation[\s\S]*videoExecutionValidated:\s*timelineHasVideoValidation/, "MinimalAgentPanel must prefer the unified project observation unless real readiness or structured execution validation requires a fresh projection"));
checkMessage(requireWithin(minimalStoryFlowSource, /projectVibeCreatorFacingStoryLabel\(value,\s*""\)[\s\S]*replace\(/, "Story UI text cleanup must hide Project.vibe permission-control labels before rendering"));
checkMessage(requireWithin(directorModeSource, /label:\s*cleanStoryText\(section\.label\)\s*\|\|\s*"当前故事"/, "DirectorMode section rail must sanitize restored section labels before rendering"));
checkMessage(requireWithin(agentPanelProjectionSource, /projectVibeCreatorFacingStoryLabel\(value,\s*""\)[\s\S]*replace\(/, "Agent scope labels must hide Project.vibe permission-control labels before rendering"));
checkMessage(requireWithin(minimalAgentPanelSource, /const shotTitle = cleanStoryText\(input\.shot\.title\) \|\| "未命名"[\s\S]*\$\{formatShotNumber\(input\.shot\.id\)\} · \$\{shotTitle\}/, "Agent selection chips must sanitize restored shot titles before rendering"));
checkMessage(requireWithin(directorMode, /const \[newVideoStatus, setNewVideoStatus\] = useState<NewVideoStartStatus \| undefined>\(\)/, "DirectorMode must track fresh-project planning status from the composer"));
checkMessage(requireWithin(directorMode, /newVideoStatus,\s*[\s\S]*exportAction/, "DirectorMode must feed fresh-project planning status into the unified project status"));
check(!/className="director-workbar"[\s\S]{0,200}\{statusNode\}/.test(directorMode), "Director workbar must not duplicate the legacy status node");
checkMessage(requireWithin(stylesSource, /\.project-status-summary\s*\{[\s\S]*grid-template-columns:[\s\S]*\.project-status-summary-facts/, "Unified project status summary needs responsive styling"));
check(!/\.director-workbar\s*,[\s\S]{0,120}display:\s*none/.test(stylesSource), "Director workbar must stay visible for the unified project status");
checkMessage(requireWithin(directorProgressStripSource, /function\s+DirectorProgressStrip\s*\(/, "Phase 35 Director progress strip component"));
checkMessage(requireWithin(directorProgressStripSource, /function\s+buildDirectorProgressStripState\s*\(/, "Phase 35 Director progress strip state builder"));
check(!/from\s+"\.\/ui\/director\/DirectorProgressStrip"/.test(appSource), "App must not import the legacy progress strip into the default Director surface");
check(!/function\s+DirectorProgressStrip\s*\(/.test(appSource), "App must not keep DirectorProgressStrip component after extraction");
checkMessage(requireWithin(minimalDirectorStatusDotSource, /function\s+MinimalDirectorStatusDot\s*\(/, "minimal director status dot component"));
check(!/MinimalDirectorStatusDot/.test(appSource), "App must not mount the legacy compact status dot on the default Director surface");
checkMessage(requireWithin(minimalTopNavSource, /function\s+MinimalTopNav\s*\(/, "MinimalTopNav component"));
checkMessage(requireWithin(appSource, /import\s+\{\s*MinimalTopNav\s*\}\s+from\s+"\.\/ui\/director\/MinimalTopNav"/, "App must import extracted MinimalTopNav component"));
checkMessage(requireWithin(appBody, /<MinimalTopNav\b/, "App must mount extracted MinimalTopNav component"));
checkMessage(requireWithin(appBody, /const\s+\[selectedShotId,\s*setSelectedShotId\]\s*=\s*useState\(""\)/, "App must start without a synthetic selected shot before a project is loaded"));
checkMessage(requireWithin(appBody, /const\s+\[selectedShotIds,\s*setSelectedShotIds\]\s*=\s*useState<string\[\]>\(\[\]\)/, "App must start without synthetic selected shot ids before a project is loaded"));
check(!/useState\(["']A1_01["']\)/.test(appBody), "App must not seed the old A1_01 fixture as a default selected shot");
checkMessage(requireWithin(appSource, /browserProjectDraftStorageKeyPrefix[\s\S]*function\s+initialBrowserProjectDraftStorageKey[\s\S]*Date\.now\(\)/, "Browser draft entry must use an ephemeral session key instead of restoring an old fixed current draft"));
check(!/useRef\(["']vibe-director:project-vibe:current["']\)/.test(appBody), "Browser draft entry must not reuse the old fixed current draft storage key");
checkMessage(requireWithin(appBody, /const\s+workbenchSelectedShotId\s*=\s*useMemo[\s\S]*if\s*\(shotIds\.has\(selectedShotId\)\)\s*return\s+selectedShotId[\s\S]*projectedDefault[\s\S]*shotIds\.has\(projectedDefault\)[\s\S]*return\s+sourceShots\[0\]\?\.id\s*\|\|\s*""/, "Workbench selected shot must resolve only from existing project shots"));
checkMessage(requireWithin(minimalAgentPanelSource, /function\s+MinimalAgentPanel\s*\(/, "MinimalAgentPanel component"));
checkMessage(requireWithin(directorModeSource, /import\s+\{\s*MinimalAgentPanel\s*\}\s+from\s+"\.\/MinimalAgentPanel"/, "DirectorMode must import extracted MinimalAgentPanel component"));
check(!/\?agent-kernel-v\d+/.test(directorModeSource), "DirectorMode must not pin Agent UI imports with fixed query strings");
checkMessage(requireWithin(creatorDeskPanelsSource, /function\s+CreatorDeskPanels\s*\(/, "CreatorDeskPanels component"));
checkMessage(requireWithin(creatorDeskProjectionSource, /function\s+buildCreatorDeskProjection\s*\(/, "creator desk projection helper"));
checkMessage(requireWithin(appSource, /import\s+\{\s*buildCreatorDeskProjection\s*\}\s+from\s+"\.\/ui\/app\/creatorDeskProjection"/, "App must import creator desk projection helper"));
checkMessage(requireWithin(appBody, /creatorDeskProjection\s*=\s*useMemo\(\(\)\s*=>\s*buildCreatorDeskProjection\(/, "App must derive creator desk projection outside DirectorMode"));
checkMessage(requireWithin(appBody, /creatorDesk=\{creatorDeskProjection\}/, "App must pass creator desk projection into DirectorMode"));
checkMessage(requireWithin(directorModeSource, /import\s+\{\s*CreatorDeskPanels\s*\}\s+from\s+"\.\/CreatorDeskPanels"/, "DirectorMode must import CreatorDeskPanels"));
checkMessage(requireWithin(newVideoStartSource, /function\s+NewVideoStart\s*\(/, "NewVideoStart component"));
checkMessage(requireWithin(directorModeSource, /const\s+NewVideoStart\s*=\s*lazy\s*\([\s\S]*import\("\.\/NewVideoStart"\)/, "DirectorMode must lazy-load NewVideoStart"));
checkMessage(requireWithin(directorMode, /<NewVideoStart[\s\S]*shots=\{shots\}[\s\S]*canCreateLocalProject=\{canCreateLocalProject\}[\s\S]*onDraftConfirmed=\{confirmNewVideoDraft\}/, "Director story view must mount the new video start entry before Story Flow without forcing project creation before planning"));
checkMessage(requireWithin(directorModeSource, /NewVideoStartConfirmationContext[\s\S]*onNewVideoDraftConfirmed\?:[\s\S]*Promise<boolean \| void>/, "DirectorMode must expose async new-video confirmation context"));
check(!/buildDirectorWorkflowState|confirmAgentPlanProjection/.test(directorModeSource), "New-video entry must not reuse the old agent projection path in DirectorMode");
checkMessage(requireWithin(appSource, /import type \{\s*NewVideoProjectVibeStagedTransactionPreview\s*\} from "\.\/core\/newVideoProjectVibePlanner"/, "App must keep the staged Project.vibe new-video preview type"));
checkMessage(requireWithin(appSource, /function\s+isFreshProjectSessionRequested\(\)[\s\S]*params\.get\("fresh"\)\s*===\s*"1"[\s\S]*params\.get\("new"\)\s*===\s*"1"[\s\S]*function\s+shouldAutoRestoreRememberedProject\(\)[\s\S]*isFreshProjectSessionRequested\(\)[\s\S]*return\s+false/, "Fresh/new browser sessions must not auto-restore the last project"));
checkMessage(requireWithin(appSource, /freshProjectSessionResetAttemptedRef[\s\S]*freshProjectSessionRequested[\s\S]*rememberedProjectRestoreAttemptedRef\.current\s*=\s*true[\s\S]*resetAllProjectState\(\)[\s\S]*新项目待开始[\s\S]*forgetCurrentProject\(\)/, "Fresh/new browser sessions must immediately clear visible state before clearing stale runtime project bindings"));
checkMessage(requireWithin(appSource, /function\s+newVideoComposerResetKeyFromUrl\(\)[\s\S]*isFreshProjectSessionRequested\(\)[\s\S]*return "fresh-session"[\s\S]*params\.get\("case"\)[\s\S]*params\.get\("ts"\)[\s\S]*case-session:\$\{caseId\}:\$\{sessionId\}/, "Fresh/new and case+ts browser sessions must reset the new-video composer draft"));
checkMessage(requireWithin(appSource, /newVideoComposerResetKey=\{newVideoComposerResetKeyFromUrl\(\)\}/, "DirectorMode must receive the URL-scoped new-video composer reset key"));
checkMessage(requireWithin(directorModeSource, /newVideoComposerResetKey\?:\s*string[\s\S]*effectiveNewVideoComposerResetKey[\s\S]*composerResetKey=\{effectiveNewVideoComposerResetKey\}/, "DirectorMode must forward fresh composer reset state to NewVideoStart"));
checkMessage(requireWithin(newVideoStartSource, /composerResetKey\?:\s*string[\s\S]*clearStoredNewVideoComposerDraft\(composerStorageKey\)[\s\S]*setScript\(""\)[\s\S]*setStyle\(""\)/, "NewVideoStart must clear stale composer text when a fresh session is requested"));
checkMessage(requireWithin(appSource, /await import\("\.\/core\/newVideoProjectVibePlanner"\)[\s\S]*buildNewVideoProjectVibeStagedTransaction[\s\S]*commitNewVideoProjectVibeStagedTransaction/, "App must lazy-load staged Project.vibe new-video helpers"));
checkMessage(requireWithin(appBody, /useRef<NewVideoProjectVibeStagedTransactionPreview \| undefined>\(undefined\)/, "App must hold the latest new-video staged transaction"));
checkMessage(requireWithin(confirmNewVideoProjectVibeDraft, /buildNewVideoProjectVibeStagedTransaction[\s\S]*newVideoStagedTransactionRef\.current[\s\S]*commitNewVideoProjectVibeStagedTransaction[\s\S]*saveProjectVibeDraft[\s\S]*applyProjectVibeProjectState/, "App new-video confirmation must stage, commit, save, then refresh Project.vibe state"));
check(!/createImage2GateForShot/.test(confirmNewVideoProjectVibeDraft), "App new-video confirmation must not open Image2 generation gates");
checkMessage(requireWithin(newVideoProjectVibePlannerSource, /buildScriptPlannerState[\s\S]*applyProjectVibeTransaction/, "New-video Project.vibe helper must bridge through script planner patch ops"));
checkMessage(requireWithin(newVideoProjectVibePlannerSource, /projectVibePatchOperations/, "New-video Project.vibe helper must use script planner Project.vibe operations"));
checkMessage(requireWithin(newVideoStartSource, /buildIntakeStagedPlanProjection[\s\S]*buildProjectIntakeDraft/, "NewVideoStart must use the intake draft projection helper"));
checkMessage(requireWithin(newVideoStartSource, /buildStoryDiscussionWorkspace[\s\S]*confirmStoryDiscussionDeltas[\s\S]*stageStoryDiscussionTurn/, "NewVideoStart must expose the discussion workspace path"));
checkMessage(requireWithin(newVideoStartSource, /stagedDeltas[\s\S]*待确认修改/, "NewVideoStart must surface staged discussion deltas for confirmation"));
checkMessage(requireWithin(newVideoStartSource, /确认修改[\s\S]*修改已确认/, "NewVideoStart must let users confirm staged discussion deltas before draft confirmation"));
for (const label of ["从新视频开始", "继续修改", "主角参考", "风格参考", "场景参考", "道具参考", "添加文件", "拖入图片、声音或脚本", "AI 拆分", "确认后选保存位置"]) {
  checkMessage(requireWithin(newVideoStartSource, new RegExp(label), `NewVideoStart must expose ${label}`));
}
checkMessage(requireWithin(newVideoStartSource, /待确认/, "NewVideoStart must expose pending draft copy inside details"));
checkMessage(requireWithin(newVideoStartSource, /确认/, "NewVideoStart must expose the confirm draft action"));
checkMessage(requireWithin(newVideoStartSource, /已确认|已进入故事流/, "NewVideoStart must expose confirmed draft copy"));
for (const label of ["修改建议", "角色", "场景", "声音", "分镜", "发送", "确认修改"]) {
  checkMessage(requireWithin(newVideoStartSource, new RegExp(label), `NewVideoStart discussion workspace must expose ${label}`));
}
checkMessage(requireWithin(newVideoStartSource, /不会直接生成/, "NewVideoStart must state the intake draft does not directly generate"));
check(!/Project\.vibe|task[-\s]*envelope|provider|schema|queue|credential/i.test(extractStringLiterals(newVideoStartSource)), "NewVideoStart default copy must hide engineering terms");
checkMessage(requireWithin(newVideoStartSource, /referenceBindingPurposeLabels[\s\S]*prop:\s*"道具"[\s\S]*referenceBindingScopeLabels[\s\S]*whole_video:\s*"全片"[\s\S]*shot_range:\s*"指定镜头"[\s\S]*绑定用途/, "NewVideoStart reference images must expose editable purpose and shot-scope binding"));
checkMessage(requireWithin(newVideoStartSource, /声音参考[\s\S]*生成视频时用来锁定声线/, "NewVideoStart audio copy must treat uploaded audio as voice reference on the demo path"));
checkMessage(requireWithin(newVideoStartSource, /全能参考[\s\S]*锁定这段画面，生成前仍会等待确认/, "NewVideoStart must describe omni reference as a confirmable planning mode, not an immediate video action"));
check(!newVideoStartSource.includes("直接用角色、场景、道具和文字导演提示生成视频。"), "NewVideoStart must not imply omni reference directly submits video");
checkMessage(requireWithin(directorSkillUiSource, /用角色、场景、道具和文字说明锁定画面[\s\S]*生成前仍会等待确认/, "Minimal story flow strategy copy must keep generation behind confirmation"));
check(!/Voice\s+Source\s+Library/i.test(extractStringLiterals(newVideoStartSource)), "NewVideoStart default copy must not expose Voice Source Library");
checkMessage(requireWithin(directorModeSource, /<NewVideoStart[\s\S]*composerPlacement="draft_only"/, "DirectorMode must keep the initial new-project input in the right Agent rail"));
checkMessage(requireWithin(newVideoStartSource, /new-video-start-guide[\s\S]*aria-label="开始方式"[\s\S]*先整理故事和镜头[\s\S]*确认前只整理故事，不会生成/, "Empty new-project guide should explain the planning boundary instead of repeating the input instruction"));
checkMessage(requireWithin(newVideoStartSource, /new-video-agent-entry-hint[\s\S]*右侧 Agent 已准备[\s\S]*草案生成后，这里会展开镜头、素材候选和确认边界/, "Empty new-project workspace must show one quiet result-area hint instead of a second input instruction"));
check(!/把想法、脚本、图片或声音交给 AI 导演；这里会展示草案和镜头/.test(extractStringLiterals(newVideoStartSource)), "Middle empty-state hint must not repeat the right Agent input instruction");
checkMessage(requireWithin(newVideoStartSource, /const showAgentEntryHint = !showComposerSurface[\s\S]*&& !projection[\s\S]*&& !submittedDraft[\s\S]*&& storyboardRows\.length === 0[\s\S]*&& !hasDraft[\s\S]*&& !discussionWorkspace[\s\S]*const showNewVideoWorkspace = showComposerSurface \|\| showAgentEntryHint[\s\S]*\{showNewVideoWorkspace && \(/, "Agent-entry hint must disappear once a draft, projection, or discussion workspace exists"));
check(!/先和右侧 AI 导演说|在右侧和 AI 导演说|右侧和 AI 导演说/.test(extractStringLiterals(newVideoStartSource)), "Middle empty state must not repeat the right-rail input instruction");
checkMessage(requireWithin(newVideoStartSource, /const showComposerSurface = composerPlacement !== "draft_only"/, "Agent-first new-project mode must not remount the old middle composer after a draft appears"));
checkMessage(requireWithin(newVideoStartSource, /const showInlineAgentThread = composerPlacement !== "draft_only" && displayAgentMessages\.length > 0/, "Agent-first new-project mode must keep the message flow in the right Agent rail instead of duplicating it in the middle canvas"));
checkMessage(requireWithin(newVideoStartSource, /const showMiddleDiscussionWorkspace = composerPlacement !== "draft_only" && Boolean\(discussionWorkspace\)/, "Agent-first new-project mode must not duplicate the draft discussion workspace in the middle canvas"));
checkMessage(requireWithin(stylesSource, /\.new-video-agent-entry-hint[\s\S]*min-height:\s*220px[\s\S]*border:\s*1px dashed/, "Empty new-project Agent-entry hint needs dedicated styling"));
checkMessage(requireWithin(newVideoStartSource, /localProjectLabel = storyboardPlanningStatus === "running"[\s\S]*"正在整理"[\s\S]*"先写想法"/, "NewVideoStart planning state must not leave the local-project hint saying to write an idea after the idea was sent"));
check(!/new-video-start-guide[\s\S]{0,220}aria-label="下一步"/.test(newVideoStartSource), "Empty new-project guide must not duplicate the unified next-action surface");
checkMessage(requireWithin(newVideoStartSource, /className="new-video-composer-inbox"[\s\S]*素材收件箱[\s\S]*AI 导演会先判断用途[\s\S]*referenceInboxSuggestion[\s\S]*audioInboxSuggestion/, "NewVideoStart dropped files must show a creator-facing inbox with classification and binding suggestions"));
checkMessage(requireWithin(stylesSource, /\.new-video-composer-inbox[\s\S]*\.new-video-composer-inbox-head[\s\S]*\.new-video-composer-attachments span em/, "NewVideoStart inbox needs dedicated styling for suggested bindings"));
checkMessage(requireWithin(newVideoStartSource, /<details\s+className="new-video-file-details"[\s\S]*className="new-video-file-list"/, "NewVideoStart selected material list must be behind details"));
checkMessage(requireWithin(newVideoStartSource, /className="new-video-asset-action new-video-primary-action"[\s\S]*composerPrimaryLabel/, "NewVideoStart bottom composer must expose one fixed primary action"));
checkMessage(requireWithin(newVideoStartSource, /composerPrimaryTitle[\s\S]*先让 AI 导演拆故事、分镜和节奏/, "NewVideoStart fixed send action must explain that Agent planning happens after send"));
checkMessage(requireWithin(newVideoStartSource, /aria-label=\{composerPrimaryAriaLabel\}[\s\S]*\{composerPrimaryLabel\}/, "NewVideoStart composer must expose one explicit visible send button"));
checkMessage(requireWithin(stylesSource, /\.new-video-composer-bar\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\) max-content[\s\S]*grid-template-areas:[\s\S]*"file action"[\s\S]*"copy copy"/, "NewVideoStart composer bar must reserve a dedicated visible send-button area"));
checkMessage(requireWithin(stylesSource, /\.new-video-composer-bar > \.new-video-asset-action:not\(\.new-video-primary-action\)\s*\{[\s\S]*grid-area:\s*file;[\s\S]*justify-self:\s*start/, "NewVideoStart add-file action must stay a compact secondary button instead of stretching across the send row"));
checkMessage(requireWithin(stylesSource, /\.minimal-director\.composer-only \.new-video-unified-composer\s*\{[\s\S]*grid-template-rows:\s*minmax\(0,\s*1fr\) auto auto auto auto;[\s\S]*overflow:\s*hidden/, "NewVideoStart composer-only shell must keep the send row visible instead of letting long text push it away"));
checkMessage(requireWithin(stylesSource, /\.new-video-bottom-portal \.new-video-unified-composer\s*\{[\s\S]*grid-template-rows:\s*minmax\(0,\s*1fr\) auto auto auto auto;[\s\S]*overflow:\s*hidden/, "NewVideoStart bottom portal must keep the send row visible instead of scrolling it out of sight"));
checkMessage(requireWithin(stylesSource, /\.minimal-director\.composer-only \.new-video-composer-field,[\s\S]*\.new-video-bottom-portal \.new-video-composer-field\s*\{[\s\S]*min-height:\s*0;[\s\S]*overflow:\s*hidden/, "NewVideoStart composer field must shrink internally instead of pushing the send button away"));
checkMessage(requireWithin(stylesSource, /\.minimal-director\.composer-only \.new-video-composer-bar,[\s\S]*\.new-video-bottom-portal \.new-video-composer-bar\s*\{[\s\S]*position:\s*sticky;[\s\S]*bottom:\s*0/, "NewVideoStart send row must stay pinned in both composer-only and bottom-portal modes"));
checkMessage(requireWithin(stylesSource, /\.new-video-composer-field textarea\s*\{[\s\S]*max-height:\s*min\(22vh,\s*180px\);[\s\S]*overflow-y:\s*auto;[\s\S]*resize:\s*none/, "NewVideoStart text area must scroll internally so the primary action stays visible"));
checkMessage(requireWithin(stylesSource, /\.new-video-primary-action\s*\{[\s\S]*flex:\s*0 0 auto[\s\S]*background:\s*#7a5528/, "NewVideoStart send button must use a visible fixed background and not shrink away"));
checkMessage(requireWithin(stylesSource, /\.new-video-primary-action\s*\{[\s\S]*white-space:\s*nowrap/, "NewVideoStart send button label must not wrap or collapse"));
checkMessage(requireWithin(stylesSource, /\.new-video-primary-action:disabled\s*\{[\s\S]*background:\s*rgba\(232,\s*222,\s*209,\s*0\.92\)[\s\S]*opacity:\s*1/, "NewVideoStart disabled send button must stay visible instead of fading like it disappeared"));
check(!/className="new-video-start-footer"[\s\S]*<button[\s\S]*发送/.test(newVideoStartSource), "NewVideoStart footer must not duplicate the composer submit action");
checkMessage(requireWithin(newVideoStartSource, /className="new-video-plan-summary"[\s\S]*projectionTitleForDisplay[\s\S]*projection\.summary\.scriptPreview[\s\S]*new-video-next-hint/, "NewVideoStart organized draft default must show only title, short preview, and a bottom-action hint"));
checkMessage(requireWithin(newVideoStartSource, /const confirmedFlowTitle = "确认后只保存故事"[\s\S]*const confirmedFlowDetail = activeVideoPermissionContract\.mode === "reference_allowed"[\s\S]*之后你可以让 AI 补参考，视频仍要单独确认[\s\S]*activeVideoPermissionContract\.mode === "video_allowed"[\s\S]*参考和视频都要在后续消息里再确认[\s\S]*补参考、发视频和导出都等你再说/, "NewVideoStart organized draft must keep story confirmation as a save-only action across execution boundaries"));
check(!/确认后先补参考|确认后进入可提交视频/.test(newVideoStartSource), "NewVideoStart organized draft must not imply draft confirmation generates references or submits video");
{
  const storyboardHeader = /<header className="new-video-storyboard-card-head">([\s\S]*?)<\/header>/.exec(newVideoStartSource)?.[1] || "";
  check(!/new-video-storyboard-actions/.test(storyboardHeader), "NewVideoStart storyboard row edit buttons must stay out of the main card header");
}
checkMessage(requireWithin(newVideoStartSource, /className="new-video-storyboard-card-detail"[\s\S]*open=\{expandedStoryboardRowIds\.has\(row\.id\)\}[\s\S]*onToggle=\{\(event\) => setStoryboardRowDetailOpen\(row\.id, event\.currentTarget\.open\)\}[\s\S]*expandedStoryboardRowIds\.has\(row\.id\) &&[\s\S]*new-video-storyboard-actions[\s\S]*上移[\s\S]*删除/, "NewVideoStart storyboard row edit buttons must render only inside the expanded per-shot details disclosure"));
checkMessage(requireWithin(newVideoStartSource, /selectedStoryboardRowId[\s\S]*function selectStoryboardRow[\s\S]*setSelectedMaterialId\(""\)[\s\S]*agentSelectionContext: NewVideoStartAgentSelectionContext[\s\S]*onStatusChange\?\.\(\{ \.\.\.entryStatus, agentSelectionContext \}\)[\s\S]*draft_selection_context_[\s\S]*这个指向[\s\S]*不会生成参考或提交视频[\s\S]*role="button"[\s\S]*aria-pressed=\{selectedStoryboardRowId === row\.id\}/, "NewVideoStart draft shots must be selectable, clear material selection, immediately publish parent Agent context, and persist timeline context for deictic feedback"));
checkMessage(requireWithin(newVideoStartSource, /agentSelectionContext = useMemo<NewVideoStartAgentSelectionContext \| undefined>[\s\S]*selectedStoryboardRowId[\s\S]*title: "当前镜头"[\s\S]*直接说“这个”怎么改[\s\S]*selectedMaterialId === "audio_reference"[\s\S]*agentSelectionContext/, "NewVideoStart status must expose the currently selected draft shot, material, or audio for the right Agent rail"));
checkMessage(requireWithin(stylesSource, /\.new-video-storyboard-card:hover,[\s\S]*\.new-video-storyboard-card:focus-visible[\s\S]*\.new-video-storyboard-card\.is-selected/, "NewVideoStart selectable draft shots need visible hover, focus, and selected states"));
checkMessage(requireWithin(newVideoStartSource, /selectedStoryboardRowId === row\.id[\s\S]*new-video-storyboard-selected-hint[\s\S]*已选中，可说“这个”/, "NewVideoStart selected draft shots must show a visible deictic feedback hint"));
checkMessage(requireWithin(stylesSource, /\.new-video-storyboard-selected-hint\s*\{[\s\S]*white-space:\s*nowrap[\s\S]*color:\s*var\(--studio-accent\)/, "NewVideoStart selected draft shot hint must stay compact and visible"));
checkMessage(requireWithin(newVideoStartSource, /selectedMaterialId[\s\S]*function selectReferenceMaterial[\s\S]*setSelectedStoryboardRowId\(""\)[\s\S]*agentSelectionContext: NewVideoStartAgentSelectionContext[\s\S]*onStatusChange\?\.\(\{ \.\.\.entryStatus, agentSelectionContext \}\)[\s\S]*draft_material_selection_context_[\s\S]*这个指向[\s\S]*重新判断用途[\s\S]*aria-pressed=\{selectedMaterialId === file\.id\}[\s\S]*选中素材/, "NewVideoStart uploaded materials must be selectable, clear shot selection, immediately publish parent Agent context, and persist timeline context"));
checkMessage(requireWithin(newVideoStartSource, /function selectAudioMaterial[\s\S]*setSelectedStoryboardRowId\(""\)[\s\S]*agentSelectionContext: NewVideoStartAgentSelectionContext[\s\S]*onStatusChange\?\.\(\{ \.\.\.entryStatus, agentSelectionContext \}\)[\s\S]*这个音频[\s\S]*audioCopy\.title[\s\S]*aria-pressed=\{selectedMaterialId === "audio_reference"\}[\s\S]*选中声音素材/, "NewVideoStart uploaded audio must be selectable, clear shot selection, immediately publish parent Agent context, and persist timeline context"));
checkMessage(requireWithin(stylesSource, /\.new-video-file-list span:hover,[\s\S]*\.new-video-file-list span:focus-visible[\s\S]*\.new-video-file-list span\.is-selected[\s\S]*\.new-video-file-list em[\s\S]*\.new-video-file-list em\.is-placeholder/, "NewVideoStart selectable materials need visible hover, focus, selected, and stable placeholder states"));
checkMessage(requireWithin(stylesSource, /\.new-video-storyboard-card-detail:not\(\[open\]\) > :not\(summary\)\s*\{[\s\S]*display:\s*none !important/, "Closed storyboard shot details must hide edit fields and row action buttons"));
checkMessage(requireWithin(newVideoStartSource, /<details\s+className="new-video-plan-details"[\s\S]*projection\.summary\.assetCounts[\s\S]*projection\.missingChecklist[\s\S]*projection\.stagedPlan/, "NewVideoStart organized draft counts, checklist, and plan must live inside details"));
checkMessage(requireWithin(newVideoStartSource, /const \[planDetailsOpen, setPlanDetailsOpen\] = useState\(false\)/, "NewVideoStart organized draft details must be collapsed by default"));
checkMessage(requireWithin(newVideoStartSource, /className="new-video-plan-details"[\s\S]*open=\{planDetailsOpen\}[\s\S]*onToggle=\{\(event\) => setPlanDetailsOpen\(event\.currentTarget\.open\)\}[\s\S]*planDetailsOpen &&/, "NewVideoStart organized draft details must render internal plan only after expansion"));
checkMessage(requireWithin(stylesSource, /\.new-video-plan-summary/, "NewVideoStart compact organized draft styling hook"));
checkMessage(requireWithin(stylesSource, /\.new-video-file-details/, "NewVideoStart material details styling hook"));
checkMessage(requireWithin(directorMode, /DirectorDetailDisclosure[\s\S]*title="故事和镜头"[\s\S]*<MinimalStoryFlow/, "Director story view must keep story details behind a disclosure"));
checkMessage(requireWithin(directorMode, /<CreatorDeskPanels[\s\S]*projection=\{creatorDesk\}[\s\S]*onRetryMissing=\{sessionRetryMissingBatch\}[\s\S]*onRetryItem=\{sessionRetryReviewItem\}[\s\S]*onRejectItem=\{onRejectReviewItem\}/, "Director story view must mount CreatorDeskPanels with contract-aware retry/reject actions"));
checkMessage(requireWithin(directorMode, /<CreatorDeskPanels[\s\S]*projectStatusView=\{displayedProjectStatusView\}/, "Director story view must pass the displayed unified project status into CreatorDeskPanels"));
checkMessage(requireWithin(directorMode, /const \[agentReferencePlanningFocus, setAgentReferencePlanningFocus\] = useState\(false\)[\s\S]*const \[agentEditingPendingConfirmation,\s*setAgentEditingPendingConfirmation\] = useState\(false\)[\s\S]*const agentEditingConfirmationLabel = agentEditingPendingConfirmation && displayedPendingAgentConfirmationCopy[\s\S]*referencePlanningFocusActive=\{agentReferencePlanningFocus && !agentPendingAction && folderReady\}[\s\S]*referenceConfirmationEditingFocusActive=\{Boolean\(agentEditingConfirmationLabel\)\}[\s\S]*editingConfirmationLabel=\{agentEditingConfirmationLabel\}[\s\S]*onReferencePlanningFocusChange=\{handleAgentReferencePlanningFocusChange\}/, "Director story view must bridge Agent reference-plan focus and edited confirmation focus into CreatorDeskPanels"));
check(!/onRequestReferencePermission=|onRequestVideoPermission=/.test(directorMode), "CreatorDeskPanels must not receive separate top-level execution callbacks");
checkMessage(requireWithin(directorMode, /onSelectItem=\{\(item\)\s*=>\s*item\.shotId\s*&&\s*onSelectShot\(item\.shotId\)\}/, "Director story view must let Review Tray selection bind the normal Agent chat"));
checkMessage(requireWithin(directorMode, /storyboardProjectPlanInput=\{storyboardProjectPlanInput\}[\s\S]*onDirectorFeedbackConfirmed=\{onDirectorFeedbackConfirmed\}/, "DirectorMode must pass confirmed feedback recompiles into the normal Agent chat path"));
const creatorDeskPanelCopy = extractStringLiterals(creatorDeskPanelsSource);
checkMessage(requireWithin(creatorDeskPanelsSource, /故事[\s\S]*画面[\s\S]*复核列表/, "CreatorDeskPanels must expose creator-facing planner, preparation, and review panels"));
checkMessage(requireWithin(creatorDeskPanelsSource, /视频生成/, "CreatorDeskPanels must expose the video generation panel"));
checkMessage(requireWithin(creatorDeskPanelsSource, /reasoningDisclosureLabel = videoFlowTakingFocus \? "视频进度" : "AI 导演怎么判断"[\s\S]*reasoningDisclosureSummary = videoFlowTakingFocus[\s\S]*activeVideoProgressSubject[\s\S]*referenceGenerationDeferredByCreator[\s\S]*之后补参考[\s\S]*displayPreflight\.modeSummary[\s\S]*reasoningDisclosureDetail = videoFlowTakingFocus/, "CreatorDeskPanels must switch the reasoning disclosure from reference strategy to video progress while video work is active"));
checkMessage(requireWithin(creatorDeskPanelsSource, /referenceGenerationDeferredByCreator[\s\S]*label:\s*"等你指令"[\s\S]*现在不会生成参考；你说“开始补参考”后再确认范围/, "CreatorDeskPanels must keep plan-only missing references as a deferred entry instead of a generation confirmation"));
checkMessage(requireWithin(creatorDeskPanelsSource, /referenceGenerationDeferredByCreator[\s\S]*当前不会生成参考；需要时在右侧说“开始补参考”/, "CreatorDeskPanels deferred reference reasoning detail must point back to the Agent chat instead of asking for confirmation"));
checkMessage(requireWithin(creatorDeskPanelsSource, /referencePlanningTakingFocus[\s\S]*label:\s*"生成前会再确认"[\s\S]*detail:\s*"现在不会生成图片，也不会提交视频。"/, "CreatorDeskPanels reference-planning focus must say future generation will re-confirm, not imply an active confirmation card"));
checkMessage(requireWithin(creatorDeskPanelsSource, /reasoningDisclosureDetail = videoFlowTakingFocus[\s\S]*projectVideoBlocked[\s\S]*按提示处理后再继续/, "CreatorDeskPanels blocked video detail must not say it is waiting for video results"));
checkMessage(requireWithin(creatorDeskPanelsSource, /完整项目细节[\s\S]*creator-desk-detail-grid/, "CreatorDeskPanels must nest full project details behind the Agent reasoning disclosure"));
checkMessage(requireWithin(creatorDeskPanelsSource, /displayPreflight\.checks\.map/, "CreatorDeskPanels must render preflight checks from the shared projection"));
checkMessage(requireWithin(creatorDeskProjection, /const agentStage = buildCreatorAgentStage/, "creator desk projection must expose a single Agent stage for the primary next action"));
checkMessage(requireWithin(creatorDeskProjection, /agentCommand:\s*buildCreatorAgentCommand\(agentStage\)/, "creator desk projection must expose a single Agent command for the primary CTA"));
checkMessage(requireWithin(creatorDeskPanelsSource, /nextActionCopy = videoCanResume[\s\S]*查询结果[\s\S]*statusNextAction[\s\S]*displayAgentCommand\.label/, "CreatorDeskPanels summary copy must keep resumable video guidance action-oriented and otherwise prefer unified project status"));
checkMessage(requireWithin(creatorDeskPanelsSource, /statusSummary = projectStatusView\?\.doing[\s\S]*statusDetail = projectStatusView\?\.waitingFor[\s\S]*editedConfirmationLabel = editingConfirmationLabel[\s\S]*editedConfirmationBoundary[\s\S]*visibleStatusSummary = referenceConfirmationEditingTakingFocus[\s\S]*正在修改「\$\{editedConfirmationLabel\}」[\s\S]*referencePlanningTakingFocus \? "参考计划已准备" : statusSummary[\s\S]*visibleStatusDetail = referenceConfirmationEditingTakingFocus[\s\S]*editedConfirmationBoundary[\s\S]*referencePlanningTakingFocus \? "现在不会生成图片，也不会提交视频。" : statusDetail[\s\S]*visibleStatusSummary \|\|[\s\S]*visibleStatusDetail \|\|/, "CreatorDeskPanels visible summary/detail must use the same project status as the workbar unless Agent reference-plan or edited-confirmation focus is active"));
checkMessage(requireWithin(creatorDeskPanelsSource, /referencePlanningFocusActive\?: boolean[\s\S]*referenceConfirmationEditingFocusActive\?: boolean[\s\S]*editingConfirmationLabel\?: string[\s\S]*const referenceConfirmationEditingTakingFocus = Boolean\([\s\S]*referenceConfirmationEditingFocusActive && !exportFlowTakingFocus && !videoFlowTakingFocus[\s\S]*const primaryFlowTakingFocus = agentConfirmationTakingFocus[\s\S]*referenceConfirmationEditingTakingFocus[\s\S]*const referencePlanningTakingFocus = Boolean\(referencePlanningFocusActive && localProjectReady && !primaryFlowTakingFocus\)[\s\S]*const localProjectSetupTakingFocus = Boolean\([\s\S]*!localProjectReady[\s\S]*hasStoryDraftForProject[\s\S]*保存位置\|本地项目[\s\S]*const referenceGenerationConfirmationTakingFocus = Boolean\([\s\S]*确认生成参考\|生成参考[\s\S]*const projectEditConfirmationTakingFocus = Boolean\([\s\S]*确认修改\|确认方式\|确认重排[\s\S]*referenceConfirmationEditingTakingFocus[\s\S]*发送修改说明[\s\S]*displayStoryDetail = referenceConfirmationEditingTakingFocus[\s\S]*当前故事[\s\S]*referencePlanningTakingFocus[\s\S]*当前故事[\s\S]*referenceGenerationConfirmationTakingFocus[\s\S]*当前故事[\s\S]*projectEditConfirmationTakingFocus[\s\S]*当前故事[\s\S]*localProjectSetupTakingFocus[\s\S]*当前故事[\s\S]*referenceGenerationDeferredByCreator[\s\S]*当前故事[\s\S]*projectObservation\.story\.detail/, "CreatorDeskPanels must show edited confirmations even before save-location setup, while story-level reference planning still requires a local project"));
checkMessage(requireWithin(creatorDeskPanelsSource, /const batchGenerationActionLabel = displayAgentCommand\.kind === "generate_references"[\s\S]*displayAgentCommand\.label[\s\S]*retryLabel\(batchGeneration\.retryLabel\)/, "CreatorDeskPanels batch action label must follow the boundary-aware Agent command"));
checkMessage(requireWithin(creatorDeskPanelsSource, /displayAgentCommand\.kind === "generate_references" \? \([\s\S]*Agent 建议：\{batchGenerationActionLabel\}/, "CreatorDeskPanels must route reference generation through clear bottom composer guidance instead of a second execution button"));
checkMessage(requireWithin(creatorDeskPanelsSource, /normalized === "running"[\s\S]*生成中[\s\S]*参考正在生成/, "CreatorDeskPanels must show reference generation progress as running instead of review-ready"));
check(!creatorDeskPanelsSource.includes("canRunBatchGeneration") && !creatorDeskPanelsSource.includes("<button onClick={onRetryMissing}"), "CreatorDeskPanels details must not expose a second batch reference generation button");
checkMessage(requireWithin(creatorDeskPanelsSource, /agentProjectRequirementCopy\(\{ localProjectBusy, canCreateLocalProject \}\)/, "CreatorDeskPanels must share browser-draft/local-project requirement copy with the bottom Agent button"));
checkMessage(requireWithin(creatorDeskPanelsSource, /const hasStoryDraftForProject = scriptPlanner\.shotCount > 0 \|\| framePlan\.items\.length > 0/, "CreatorDeskPanels must distinguish empty drafts from confirmed browser stories"));
checkMessage(requireWithin(creatorDeskPanelsSource, /assetReconciliationNextAction = !localProjectReady && hasStoryDraftForProject[\s\S]*projectRequirement\.label[\s\S]*creatorAssetNextActionForView/, "CreatorDeskPanels asset matching must ask for a local project before reference preparation"));
checkMessage(requireWithin(creatorDeskPanelsSource, /browserDraftLabel = hasStoryDraftForProject \? projectRequirement\.label : "先写想法"[\s\S]*nextActionCopy = videoCanResume[\s\S]*statusNextAction \|\| \(!localProjectReady[\s\S]*browserDraftLabel/, "CreatorDeskPanels should point confirmed browser stories to local-project setup instead of saying to write another idea"));
checkMessage(requireWithin(creatorDeskPanelsSource, /hasStoryDraftForProject[\s\S]*projectRequirement\.detail[\s\S]*projectRequirement\.hint/, "CreatorDeskPanels must reuse project requirement detail and hint for unsaved stories"));
checkMessage(requireWithin(creatorDeskPanelsSource, /!localProjectReady[\s\S]*还没有选择保存位置[\s\S]*projectRequirement\.label[\s\S]*referenceGenerationNeedsPermission/, "CreatorDeskPanels must prioritize local-project setup before reference-generation permission copy"));
checkMessage(requireWithin(creatorDeskPanelsSource, /可以继续说想法；生成参考、视频或导出前再选择保存位置/, "CreatorDeskPanels browser-draft hint must say planning can continue"));
checkMessage(requireWithin(creatorDeskPanelsSource, /projectEditConfirmationTakingFocus[\s\S]*先处理右侧「\$\{statusNextAction \|\| statusSummary \|\| "确认修改"\}」；不确认也可以继续说明怎么改[\s\S]*localProjectSetupTakingFocus[\s\S]*可以继续改故事；生成参考、发送视频或导出前，先在右侧确认保存位置[\s\S]*agentConfirmationTakingFocus[\s\S]*先处理右侧消息里的确认；中间只保留项目结果[\s\S]*消息流会接着这个状态处理/, "CreatorDeskPanels project-edit confirmations must override stale save-location hints, while save-location focus still uses creator-facing next-step copy instead of the generic message-flow fallback"));
checkMessage(requireWithin(creatorDeskPanelsSource, /描述想法[\s\S]*拆故事流[\s\S]*准备参考[\s\S]*发送与预览[\s\S]*预览与导出/, "CreatorDeskPanels must expose the Agent-first five-stage path"));
checkMessage(requireWithin(creatorDeskPanelsSource, /AI 导演选择的做法[\s\S]*agentSkillPills/, "CreatorDeskPanels must explain the AI director selected skills near the status summary"));
checkMessage(requireWithin(creatorDeskPanelsSource, /agentConfirmationHandoffActive \? \([\s\S]*creator-agent-confirmation-handoff[\s\S]*aria-label="右侧消息等待确认"[\s\S]*右侧等待确认[\s\S]*agentConfirmationHandoffLabel[\s\S]*agentConfirmationHandoffDetail[\s\S]*\) : \([\s\S]*creator-agent-current-task[\s\S]*AI 导演当前任务[\s\S]*理解[\s\S]*缺口[\s\S]*准备[\s\S]*确认/, "CreatorDeskPanels must collapse repeated task detail into a right-rail confirmation handoff while preserving the normal four-part task surface"));
checkMessage(requireWithin(creatorDeskPanelsSource, /function summaryLine[\s\S]*projectInbox\.needsReviewCount[\s\S]*个素材待确认[\s\S]*没有待处理项/, "CreatorDeskPanels summary must prioritize ProjectInbox review work before saying there is nothing pending"));
checkMessage(requireWithin(creatorDeskPanelsSource, /function canRetryReviewItem[\s\S]*input\.item\.status === "needs_review" \|\| input\.item\.status === "retry"[\s\S]*Boolean\(input\.onRetryItem \|\| input\.onRetryMissing\)/, "CreatorDeskPanels must not show per-shot retry buttons for merely missing references"));
checkMessage(requireWithin(creatorDeskPanelsSource, /点选后可说/, "Project inbox items must explain natural-language correction through the bottom Agent composer"));
checkMessage(requireWithin(creatorDeskPanelsSource, /creator-inbox-select[\s\S]*onSelectInboxItem\?\.\(item\)/, "Project inbox items must be selectable instead of static labels"));
checkMessage(requireWithin(directorModeSource, /onSelectInboxItem=\{\(item\)[\s\S]*item\.assetId[\s\S]*onSelectAsset\(item\.assetId\)[\s\S]*onOpenDirectorView\?\.\("assets"\)/, "DirectorMode must select inbox assets in the existing asset context instead of opening another feedback UI"));
checkMessage(requireWithin(assetReconciliationSource, /summary\.merged > 0[\s\S]*已并入/, "Asset reconciliation summary must tell users when small details were merged into parent references"));
checkMessage(requireWithin(assetReconciliationSource, /summary\.merged > 0[\s\S]*局部细节已并入主体参考/, "Asset reconciliation next action must explain merged details without asking users to review fake standalone assets"));
checkMessage(requireWithin(creatorDeskPanelsSource, /assetReconciliation\.summary\.missing > 0[\s\S]*assetReconciliation\.summary\.merged > 0/, "CreatorDeskPanels must show asset matching when references are missing or merged"));
checkMessage(requireWithin(creatorDeskPanelsSource, /const showProjectInbox = projectInbox\.totalCount > 0 && !submitVideoCommandVisible && !primaryFlowTakingFocus[\s\S]*const projectInboxDefaultOpen = showProjectInbox && projectInbox\.needsReviewCount > 0/, "CreatorDeskPanels must collapse the full material inbox while video/export is the primary task"));
checkMessage(requireWithin(creatorDeskPanelsSource, /const displayVideoTaskActive = videoTaskActive && !projectVideoBlocked/, "CreatorDeskPanels must not treat QA-blocked video attempts as active generation"));
checkMessage(requireWithin(creatorDeskPanelsSource, /const videoFlowTakingFocus = !exportFlowTakingFocus && \([\s\S]*projectVideoBlocked[\s\S]*displayVideoTaskActive/, "CreatorDeskPanels must keep blocked video work in the primary video lane instead of showing unrelated material inbox work"));
checkMessage(requireWithin(creatorDeskPanelsSource, /const displayProjectInboxSummary = displayVideoTaskActive[\s\S]*个素材已在项目中[\s\S]*const displayProjectInboxNextAction = displayVideoTaskActive[\s\S]*视频处理中，不需要再确认用途/, "CreatorDeskPanels must soften the material inbox copy only while video is actually queued or generating"));
checkMessage(requireWithin(creatorDeskPanelsSource, /const displayIntentLabel = exportFlowTakingFocus[\s\S]*交付复核[\s\S]*projectVideoBlocked[\s\S]*处理视频[\s\S]*displayVideoTaskActive[\s\S]*查询视频[\s\S]*等待视频[\s\S]*现在在做：\{displayIntentLabel\}/, "CreatorDeskPanels must show blocked, export, query, or wait intent from the unified video state"));
checkMessage(requireWithin(creatorDeskPanelsSource, /const activeVideoQueryFact = videoGeneration\.taskFacts\.find[\s\S]*label === "查询"[\s\S]*activeVideoProgressParts\.join\("；"\)/, "CreatorDeskPanels must show queue query attempts in the visible video progress copy"));
checkMessage(requireWithin(creatorDeskPanelsSource, /Math\.max\(batchGeneration\.missingCount, reviewTray\.counts\.missing\)\} 个镜头缺画面/, "CreatorDeskPanels missing-frame summary must use creator-facing quantity copy"));
check(!/className="creator-agent-glance"/.test(creatorDeskPanelsSource), "CreatorDeskPanels must not show a second always-visible Agent flow above the current task");
checkMessage(requireWithin(creatorDeskPanelsSource, /displayAgentCommand\.kind === "open_preview"[\s\S]*预览/, "CreatorDeskPanels preview hint must follow the Agent command"));
checkMessage(requireWithin(creatorDeskPanelsSource, /displayAgentCommand\.kind === "open_export"[\s\S]*交付/, "CreatorDeskPanels export hint must follow the Agent command"));
checkMessage(requireWithin(directorModeSource, /!showCreatorDeskPanel && !showNewVideoStart[\s\S]*<DirectorDetailDisclosure[\s\S]*title="流程详情"/, "DirectorMode must hide the workflow disclosure when the Agent current-task panel or new-video composer is the primary surface"));
checkMessage(requireWithin(creatorDeskProjection, /const preflight = buildCreatorPreflightProjection/, "creator desk projection must derive the shared preflight summary"));
checkMessage(requireWithin(creatorDeskProjectionSource, /故事板叙事[\s\S]*故事板快切[\s\S]*全能参考/, "creator preflight must summarize the three reference modes"));
checkMessage(requireWithin(creatorDeskProjectionSource, /status === "recoverable"[\s\S]*在消息中确认「查询结果」，不会重复发送/, "Creator desk projection must route resumable videos back to the Agent message task"));
for (const statusLabel of ["未生成", "已发送", "排队中", "生成中", "已完成", "可稍后恢复"]) {
  checkMessage(requireWithin(creatorDeskPanelsSource, new RegExp(statusLabel), `CreatorDeskPanels must expose ${statusLabel} video status`));
}
checkMessage(requireWithin(creatorDeskPanelsSource, /即梦常见约[\s\S]*分钟[\s\S]*可以离开后查询结果/, "CreatorDeskPanels must explain long video waits with resume copy"));
check(!/会先生成故事板参考/.test(creatorDeskProjectionSource), "Creator desk video copy must not imply every video path starts with storyboard references");
checkMessage(requireWithin(creatorDeskProjectionSource, /会先准备所需参考画面[\s\S]*一次发送一个视频任务/, "Creator desk video copy must stay reference-mode neutral"));
checkMessage(requireWithin(creatorDeskPanelsSource, /const videoCanResume = Boolean\(videoSendAction\?\.canResume \|\| videoGeneration\.canResume \|\| videoStage\.canResume\) && !videoReturnedForReview/, "CreatorDeskPanels must merge runtime and action resume readiness while stopping after returned videos enter review"));
checkMessage(requireWithin(creatorDeskPanelsSource, /videoCanResume[\s\S]*在消息中确认「查询结果」，不会重复发送/, "CreatorDeskPanels must explain resumable Seedance jobs without exposing a second query button"));
checkMessage(requireWithin(creatorDeskPanelsSource, /需要取回结果时，在消息中确认查询[\s\S]*需要发送视频时，在消息中确认发送/, "CreatorDeskPanels must route video execution to Agent message tasks"));
check(!/onClick=\{onSendVideo\}|videoSendAction\.suggestedActionLabel/.test(creatorDeskPanelsSource), "CreatorDeskPanels must not own video submit/query execution");
check(!/creator-primary-action|runCreatorPrimaryAction/.test(creatorDeskPanelsSource), "CreatorDeskPanels must not expose a second primary execution button");
check(!/creator-command-chip/.test(creatorDeskPanelsSource), "CreatorDeskPanels must avoid repeating the primary action in a second status chip");
checkMessage(requireWithin(creatorDeskPanelsSource, /creator-summary-next[\s\S]*creatorStepHint/, "CreatorDeskPanels summary must keep short Agent-task guidance beside the status"));
checkMessage(requireWithin(creatorDeskPanelsSource, /在消息中确认「查询结果」[\s\S]*在消息中确认发送下一段/, "CreatorDeskPanels must point users to Agent message tasks for execution"));
checkMessage(requireWithin(minimalAgentPanelSource, /const exportFooterActionTakesPriority = Boolean\(exportResultIsPrimary && exportFooterAction && !hasComposerInput\)[\s\S]*const footerDirectAction = exportFooterActionTakesPriority[\s\S]*\? exportFooterAction[\s\S]*: canOfferFooterDirectAction/, "MinimalAgentPanel must own the single visible generation/submission action while letting focused export work surface its confirmation"));
checkMessage(requireWithin(minimalAgentPanelSource, /const EXPORT_PACKAGE_CONTENTS_LABEL = "当前可打包资料、制作报告、缺失视频说明"[\s\S]*const exportReadyForConfirmation = Boolean\([\s\S]*currentView === "export"[\s\S]*exportWorkerReadyForAgentConfirmation\(exportWorker\)[\s\S]*const exportFocusScopeLabel = exportReadyForConfirmation \? "本地交付包"[\s\S]*const exportFocusSelectionChips = exportResultIsPrimary[\s\S]*exportReadyForConfirmation[\s\S]*label: "下一步", value: "确认导出"[\s\S]*label: "保护", value: "确认前不写文件、不生成缺失视频"[\s\S]*label: "范围", value: "当前项目"[\s\S]*label: "包含", value: EXPORT_PACKAGE_CONTENTS_LABEL[\s\S]*label: "写入文件", value: "已生成"[\s\S]*displayedSelectionChips = pendingDraftShotCount[\s\S]*exportFocusSelectionChips\.length[\s\S]*exportFocusSelectionChips[\s\S]*referencePlanningContextActive/, "MinimalAgentPanel export focus must use structured worker readiness while the confirmation card owns package contents and write boundary"));
checkMessage(requireWithin(minimalAgentPanelSource, /displayedAgentBoundaryConfirmationLabel = !hasVisibleComposerInput && agentCurrentTaskProjection\.requiresConfirmation[\s\S]*\? agentCurrentTaskProjection\.label[\s\S]*displayedAgentBoundarySummaryLabel = editingReferenceGenerationConfirmationActive[\s\S]*agentCurrentTaskProjection\.step === "export" && agentCurrentTaskProjection\.requiresConfirmation[\s\S]*"确认导出"[\s\S]*agentCurrentTaskProjection\.step === "prepare_references" && agentCurrentTaskProjection\.requiresConfirmation[\s\S]*agentCurrentTaskProjection\.label[\s\S]*displayedAgentBoundaryDetail = composerToolIntentShouldYieldToProjectEditConfirmation[\s\S]*exportReadyForConfirmation[\s\S]*确认前不会写入本地导出文件/, "MinimalAgentPanel waiting-task work-mode copy must come from structured projection steps while composer-editing states keep explicit boundary detail"));
checkMessage(requireWithin(minimalAgentPanelSource, /visibleCompactSelectionHint = pendingDraftShotCount[\s\S]*exportResultIsPrimary[\s\S]*displayedCompactSelectionHint[\s\S]*referencePlanningContextActive/, "MinimalAgentPanel export focus must override stale reference-plan selection hints"));
checkMessage(requireWithin(minimalAgentPanelSource, /const footerActionConfirmationMessage = \(\(\) => \{[\s\S]*const action = footerDirectAction[\s\S]*if \(action === exportFooterAction\) \{[\s\S]*id: "footer_action_export"/, "MinimalAgentPanel footer confirmation cards must use the final focused footer action so export work appears in the message flow"));
checkMessage(requireWithin(minimalAgentPanelSource, /const footerActionConfirmationMessage = \(\(\) => \{[\s\S]*role: "confirmation"[\s\S]*fullAgentThreadMessages\.push\(footerActionConfirmationMessage\)/, "MinimalAgentPanel must expose empty-composer next actions as Agent message-flow confirmation cards"));
checkMessage(requireWithin(minimalAgentPanelSource, /footerActionMatchesProjectedCurrentTask[\s\S]*!minimalAgentFooterConfirmationHasExistingVisiblePeer\(agentThreadMessages, footerActionConfirmationMessage\)[\s\S]*agentThreadMessages = \[\.\.\.agentThreadMessages, footerActionConfirmationMessage\]/, "MinimalAgentPanel must keep the projection-matching footer confirmation visible after compaction when no equivalent current-task card exists"));
check(!/className="minimal-agent-next-button"/.test(minimalAgentPanelSource), "MinimalAgentPanel footer must not expose a second next-action button beside Send");
checkMessage(requireWithin(minimalAgentPanelSource, /runFooterReferenceGeneration[\s\S]*agentVideoPermissionForMode\("reference_allowed"\)/, "bottom reference action must grant reference permission before running"));
checkMessage(requireWithin(minimalAgentPanelSource, /runFooterVideoAction[\s\S]*agentVideoPermissionForMode\("video_allowed"\)/, "bottom video action must grant video permission before running"));
checkMessage(requireWithin(creatorDeskPanelsSource, /function reviewItemTargetView[\s\S]*"preview"[\s\S]*"assets"/, "CreatorDeskPanels must route reference review to assets and video review to preview"));
checkMessage(requireWithin(creatorDeskPanelsSource, /镜头画面[\s\S]*画面到视频/, "CreatorDeskPanels must default to reference-to-video sequencing"));
checkMessage(requireWithin(creatorDeskPanelsSource, /requiresEndFrame[\s\S]*特殊结束画面/, "CreatorDeskPanels must keep endpoint-tail sequencing only for endpoint control items"));
for (const statusLabel of ["待复核", "缺参考", "可重试", "已通过", "已锁定"]) {
  checkMessage(requireWithin(creatorDeskPanelCopy, new RegExp(statusLabel), `CreatorDeskPanels must expose ${statusLabel}`));
}
for (const actionLabel of ["通过", "重试", "拒绝", "锁定"]) {
  checkMessage(requireWithin(creatorDeskPanelsSource, new RegExp(actionLabel), `CreatorDeskPanels must expose ${actionLabel} action`));
}
for (const lockLabel of ["角色参考", "场景参考", "道具参考", "本镜头画面"]) {
  checkMessage(requireWithin(creatorDeskPanelsSource, new RegExp(lockLabel), `CreatorDeskPanels must expose ${lockLabel} lock target`));
}
checkMessage(requireWithin(creatorDeskPanelsSource, /review-tray-select[\s\S]*onSelectItem\?\.\(item\)/, "Review Tray items must be selectable instead of opening a separate feedback box"));
checkMessage(requireWithin(creatorDeskPanelsSource, /review-tray-select[\s\S]*aria-label=\{`选择\$\{itemLabel\(item\)\}：/, "Review Tray item buttons must expose a clear accessible selection label"));
checkMessage(requireWithin(creatorDeskPanelsSource, /aria-label=\{`\$\{itemLabel\(item\)\}：通过复核`\}/, "Review Tray approve buttons must expose action-specific aria labels"));
checkMessage(requireWithin(creatorDeskPanelsSource, /aria-label=\{`\$\{itemLabel\(item\)\}：重新生成`\}/, "Review Tray retry buttons must expose action-specific aria labels"));
checkMessage(requireWithin(stylesSource, /review-tray-select/, "Review Tray selected-item button must have neutral styling"));
checkMessage(requireWithin(appBody, /onRetryReviewItem=\{\(item\)\s*=>\s*applyCreatorReviewDecision\(item,\s*"retry"\)\}[\s\S]*onRejectReviewItem=\{\(item\)\s*=>\s*applyCreatorReviewDecision\(item,\s*"reject"\)\}/, "App must route per-item retry/reject through Project.vibe review decisions"));
checkMessage(requireWithin(appBody, /onLockReviewItem=\{\(item,\s*target\)\s*=>\s*applyCreatorReviewDecision\(item,\s*"lock",\s*target\)\}/, "App must route lock target through Project.vibe review decisions"));
checkMessage(requireWithin(appBody, /if \(item\.assetId && rejectMode\)/, "Asset-backed rejects may use the fast asset-status path"));
check(!/item\.assetId && \(promotionMode \|\| rejectMode\)/.test(appBody), "Review Tray locks must not bypass Project.vibe review decisions");
checkMessage(requireWithin(appSource, /function projectRelativeReviewMediaPath/, "Review decisions must normalize media paths before writing Project.vibe"));
checkMessage(requireWithin(appBody, /outputPath:\s*reviewMediaPath/, "Review decision outputPath must use the normalized project-relative media path"));
check(!/outputPath:\s*item\.mediaPath/.test(appBody), "Review decisions must not write raw item.mediaPath into Project.vibe");
checkMessage(requireWithin(appBody, /assetKind:\s*promotionMode\s*\?\s*lockAssetKind\s*:\s*"reference"[\s\S]*assetLabel[\s\S]*usedByShotIds/, "App must promote Review Tray locks with selected asset kind, label, and shot usage"));
check(!/Script Planner|Batch Generation|Review Tray|Needs review|Missing|Approved|Locked|Approve/.test(creatorDeskPanelCopy), "CreatorDeskPanels must not expose English planner/review copy in the default UI");
checkMessage(requireWithin(creatorDeskProjection, /concurrencyLabel:\s*"Concurrency 10"[\s\S]*retryLabel:\s*"Retry Missing"/, "creator batch projection must expose concurrency 10 and Retry Missing"));
checkMessage(requireWithin(creatorDeskProjection, /safetyLabel[\s\S]*Retry downshifts to/, "creator batch projection must expose retry downshift copy"));
checkMessage(requireWithin(creatorDeskProjection, /videoStage[\s\S]*buildCreatorVideoStageProjection[\s\S]*videoGeneration\s*=\s*videoStage\.generation/, "creator desk projection must carry a single video stage with Jimeng generation status"));
checkMessage(requireWithin(creatorDeskPanelsSource, /const videoGeneration = videoStage\.generation/, "CreatorDeskPanels must read video state from the single video stage projection"));
checkMessage(requireWithin(creatorDeskProjectionSource, /function videoTaskFactsForRelayQueue[\s\S]*taskFacts:\s*videoTaskFactsForRelayQueue/, "Creator desk video projection must surface recoverable task evidence from the relay queue"));
checkMessage(requireWithin(creatorDeskProjectionSource, /fact\("提交号"[\s\S]*fact\("输入参考"[\s\S]*fact\("原因"[\s\S]*fact\("下一步"/, "Creator desk video task facts must include submit id, reference inputs, issue reason, and next step"));
checkMessage(requireWithin(creatorDeskPanelsSource, /className="video-task-facts"[\s\S]*aria-label="视频任务状态"[\s\S]*fact\.label[\s\S]*fact\.value/, "Creator desk video panel must render creator-facing task evidence"));
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
check(!/state=\{workbenchProgressState\}/.test(appBody), "App must not pass a second status source into DirectorMode");
check(!/\bstatusNode\b/.test(directorModeSource), "DirectorMode must rely on ProjectStatusSummary instead of the legacy status node prop");
checkMessage(requireWithin(diagnosticsMode, /<DirectorProgressStrip\s+state=\{buildDirectorProgressStripState\(\s*buildLocalOrchestratorUiSummary\(runtimeState\)\s*\)\}\s*\/>/, "Diagnostics must keep the detailed runtime progress strip"));
check(!/buildDirectorProgressStripState\(\s*buildLocalOrchestratorUiSummary\(workbenchRuntimeState\)\s*\)/.test(appBody), "App must not compute a hidden legacy progress state for the default Director surface");
checkMessage(requireWithin(minimalDirectorStatusDotSource, /state\s*:\s*DirectorProgressStripState/, "compact director status dot must receive presentational progress state"));
check(!/state\.segments\.map/.test(minimalDirectorStatusDot), "compact director status dot must not render detailed progress counts");
checkMessage(requireWithin(diagnosticsMode, /buildDirectorProgressStripState\(\s*buildLocalOrchestratorUiSummary\(/, "Phase 35 progress strip must derive from Phase 34 runtime summary inside Diagnostics"));
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
checkMessage(requireWithin(`${directorProgressStrip}\n${directorProgressStripState}`, /待处理/, "Phase 35 progress strip blocked label"));
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
checkMessage(requireWithin(agentReceiptStatusLabel, /queuedCount\s*>\s*0[\s\S]*已加入故事流/, "creator receipt status should prefer queued work over repair-only copy"));
checkMessage(requireWithin(agentReceiptCountSummary, /Math\.max\s*\(\s*receipt\.blockedCount\s*,\s*receipt\.runtimeProjection\.staleArtifactCount\s*\)/, "creator receipt count summary must merge blocked/stale repair counts"));
checkMessage(requireWithin(agentPanelProjectionSource, /function\s+agentProjectionBadges[\s\S]*confirmed[\s\S]*先等复核/, "confirmed Agent panel badges should avoid duplicate repair counts"));
checkMessage(requireWithin(minimalAgentPanel, /minimal-state-dots/, "One Creator Loop MinimalAgentPanel must render compact progress dots"));
checkMessage(requireWithin(`${minimalAgentPanel}\n${workflowCanConfirm}`, /dry_run_ready/, "Round 3 confirmation only after dry-run ready"));
checkMessage(requireWithin(agentPanelProjectionSource, /function\s+agentProjectionNextStep[\s\S]*canConfirm[\s\S]*确认后只会保存故事/, "Agent panel confirmable projection must show a confirmation next step before missing-reference copy"));
checkMessage(requireWithin(minimalAgentPanel, /agentProjectionNextStep\s*\([^)]*canConfirm/, "MinimalAgentPanel must pass the confirmation guard into projection next-step copy"));
checkMessage(requireWithin(minimalAgentPanel, /minimal-agent-selection-context/, "MinimalAgentPanel must show selected context before feedback"));
checkMessage(requireWithin(stylesSource, /minimal-agent-selection-context/, "MinimalAgentPanel selected context must have styling"));
checkMessage(requireWithin(minimalAgentPanelSource, /footerSelectionTargetCopy[\s\S]*你说“这个”时，我会理解为：\$\{displayedCompactScopeLabel\}；消息里的确认只会做它写明的事。[\s\S]*minimal-agent-footer-target/, "MinimalAgentPanel input footer must distinguish typed selection feedback from the current confirmation card scope"));
checkMessage(requireWithin(stylesSource, /minimal-agent-footer-target/, "MinimalAgentPanel selected-reference footer hint must be styled"));
checkMessage(requireWithin(minimalAgentPanelSource, /const showSkillStack = Boolean\(selectedSkillSummary \|\| visibleSavedSkillCount \|\| runtimeState\.storyFlow\.shots\.length > 0\)/, "Skills panel must remain available as a project capability surface after a story exists"));
checkMessage(requireWithin(minimalAgentPanelSource, /const showVisibleSkillStack = showSkillStack[\s\S]*&& !visibleConfirmationLocksWorkMode[\s\S]*&& !composerEditingPendingConfirmation[\s\S]*&& !localProjectSetupConfirmationContextActive[\s\S]*\{showVisibleSkillStack && \([\s\S]*minimal-agent-skill-stack/, "Skills panel must give way to visible, edited, or save-location Agent confirmations"));
checkMessage(requireWithin(minimalAgentPanelSource, /const projectLoadedSkillLabel = visibleSavedSkillCount[\s\S]*已加载[\s\S]*还没有保存的项目 Skill/, "Skills panel must show the current project loaded Skills state"));
checkMessage(requireWithin(minimalAgentPanelSource, /const mySkillActionLabel = selectedSkillAlreadySaved[\s\S]*当前做法已在项目里[\s\S]*把当前做法保存为[\s\S]*把这个沉淀成 Skill/, "Skills panel must explain how creator-owned Skills are saved"));
checkMessage(requireWithin(minimalAgentPanelSource, /<details className="minimal-agent-skill-disclosure" open=\{skillSaveContextActive \|\| undefined\}>[\s\S]*className="minimal-agent-skill-summary"[\s\S]*点开查看 Skills[\s\S]*minimal-agent-skill-groups[\s\S]*当前项目已加载[\s\S]*Agent 推荐[\s\S]*我的 Skills/, "Skills panel must default to a compact disclosure and only expose the three groups when opened or while saving a Skill"));
checkMessage(requireWithin(minimalAgentPanelSource, /skillSaveMouseDownHandledRef[\s\S]*minimal-agent-skill-save-button[\s\S]*onMouseDown=\{\(event\) => \{[\s\S]*event\.preventDefault\(\)[\s\S]*skillSaveMouseDownHandledRef\.current = true[\s\S]*requestSelectedSkillDraftSave\("把当前做法保存为 Skill"\)[\s\S]*onClick=\{\(event\) => \{[\s\S]*skillSaveMouseDownHandledRef\.current[\s\S]*requestSelectedSkillDraftSave\("把当前做法保存为 Skill"\)[\s\S]*先生成保存确认卡[\s\S]*保存为 Skill/, "My Skills group must expose a blur-safe creator-facing save action that only stages a confirmation card"));
checkMessage(requireWithin(minimalAgentPanelSource, /selectedSkillReasonLabel[\s\S]*replace[\s\S]*agentRecommendedSkillCopy[\s\S]*原因：\$\{selectedSkillReasonLabel\}[\s\S]*影响 \$\{selectedSkillImpactLabel\}[\s\S]*minimal-agent-skill-groups[\s\S]*当前项目已加载[\s\S]*Agent 推荐[\s\S]*agentRecommendedSkillCopy[\s\S]*我的 Skills/, "Skills panel must keep the three creator-facing groups while explaining why the Agent recommendation affects the project"));
checkMessage(requireWithin(minimalAgentPanelSource, /selectedSkillOneLine[\s\S]*selectedSkillImpactLabel[\s\S]*selectedSkillUseWhenLabel[\s\S]*selectedSkillAvoidWhenLabel[\s\S]*selectedSkillSourceLabel/, "Selected Skill detail must explain what it does, where it applies, when to use it, when to avoid it, and the source shot"));
checkMessage(requireWithin(minimalAgentPanelSource, /\(selectedSkillCard \|\| selectedSkillSummary\)[\s\S]*minimal-agent-skill-detail/, "Selected Skill details must still render when only the Agent recommendation summary is available"));
checkMessage(requireWithin(minimalAgentPanelSource, /minimal-agent-skill-detail[\s\S]*aria-label="Skill 使用说明"[\s\S]*做什么[\s\S]*作用于[\s\S]*适合[\s\S]*别用在[\s\S]*使用镜头/, "Skills panel must show creator-readable selected Skill usage details"));
checkMessage(requireWithin(minimalAgentPanelSource, /<details className="minimal-agent-skill-detail" aria-label="Skill 使用说明">[\s\S]*<summary>[\s\S]*Skill 说明[\s\S]*展开[\s\S]*做什么[\s\S]*使用镜头[\s\S]*<\/details>/, "Skill usage detail must stay available but default to a compact disclosure so the Agent thread remains the main rail surface"));
checkMessage(requireWithin(stylesSource, /\.minimal-agent-skill-detail[\s\S]*display:\s*grid[\s\S]*\.minimal-agent-skill-detail small[\s\S]*grid-template-columns:[\s\S]*\.director-agent-rail \.minimal-agent-skill-detail/, "Selected Skill usage details need compact rail-safe styling"));
checkMessage(requireWithin(stylesSource, /\.minimal-agent-skill-disclosure[\s\S]*display:\s*grid[\s\S]*\.minimal-agent-skill-summary[\s\S]*display:\s*flex[\s\S]*list-style:\s*none[\s\S]*\.minimal-agent-skill-summary::-webkit-details-marker[\s\S]*display:\s*none[\s\S]*\.minimal-agent-skill-summary em/, "Skills disclosure summary needs compact rail-safe styling"));
checkMessage(requireWithin(stylesSource, /\.minimal-agent-skill-save-button[\s\S]*display:\s*inline-flex[\s\S]*\.minimal-agent-skill-save-button:hover/, "Skill save action needs compact rail-safe styling"));
checkMessage(requireWithin(stylesSource, /\.minimal-agent-skill-detail summary[\s\S]*display:\s*flex[\s\S]*list-style:\s*none[\s\S]*\.minimal-agent-skill-detail summary::-webkit-details-marker[\s\S]*display:\s*none/, "Skill usage disclosure needs compact rail-safe summary styling"));
checkMessage(requireWithin(minimalAgentPanelSource, /minimalAgentSkillRecommendationsFromTimelineEntry[\s\S]*skillRecommendations[\s\S]*minimal-agent-skill-recommendations[\s\S]*推荐方法说明[\s\S]*作用于/, "Agent Skill recommendations must be visible as explained message content, not only hidden details"));
checkMessage(requireWithin(stylesSource, /\.minimal-agent-skill-recommendations[\s\S]*display:\s*grid[\s\S]*\.minimal-agent-skill-recommendations small[\s\S]*border:[\s\S]*\.minimal-agent-skill-recommendations em/, "Agent Skill recommendation explanation cards need compact non-overlapping styling"));
checkMessage(requireWithin(minimalAgentPanelSource, /minimalAgentAssetInboxSummaryFromTimelineEntry[\s\S]*handlingLabels[\s\S]*bindingPreviewLabels[\s\S]*foldedDetailLabels[\s\S]*assetInboxSummary[\s\S]*aria-label="素材识别摘要"[\s\S]*类型[\s\S]*等你确认[\s\S]*边界[\s\S]*先确认再写入项目[\s\S]*处理方式[\s\S]*建议绑定[\s\S]*并入镜头/, "Agent material scanning must explain recognized materials, handling, confirmation boundary, and binding suggestions in the message flow"));
checkMessage(requireWithin(minimalAgentPanelSource, /COMPOSER_MATERIAL_INTAKE_HELP[\s\S]*会先进入素材收件箱[\s\S]*采用前等你确认[\s\S]*const showComposerMaterialIntakeHint = !attachments\.length && !emptyComposerPendingConfirmationLabel && !skillSaveContextActive[\s\S]*aria-describedby=\{showComposerMaterialIntakeHint \? "minimal-agent-material-intake-help" : undefined\}[\s\S]*showComposerMaterialIntakeHint && \([\s\S]*minimal-agent-material-intake-hint/, "Agent material picker entry must explain the inbox and confirmation boundary before the native file picker opens, but yield while a confirmation or save-Skill edit owns the composer"));
checkMessage(requireWithin(minimalAgentPanelSource, /function minimalAgentMessageIsMaterialInboxCard\(message: MinimalAgentMessage\)[\s\S]*message\.assetInboxSummary[\s\S]*classify_assets[\s\S]*scan_assets[\s\S]*素材已识别\|项目素材/, "Agent material cards must be identifiable before visible-thread compaction"));
checkMessage(requireWithin(minimalAgentPanelSource, /function minimalAgentMessageIsProjectWriteResult\(message: MinimalAgentMessage\)[\s\S]*message\.id === "project_story_flow_ready_state"[\s\S]*message\.entryType !== "action_result" \|\| message\.toolName !== "write_project"[\s\S]*修改已写入项目\|项目已更新\|故事已确认\|已保存到项目/, "Agent story-ready state must count as a completed project-write focus for visible-thread material compaction"));
checkMessage(requireWithin(minimalAgentPanelSource, /function minimalAgentMaterialInboxSupersededByProjectResult\(messages: MinimalAgentMessage\[\], message: MinimalAgentMessage\)[\s\S]*minimalAgentMessageIsMaterialInboxCard\(message\)[\s\S]*latestUserIndex[\s\S]*minimalAgentMessageIsProjectWriteResult\(candidate\)[\s\S]*!minimalAgentMaterialInboxSupersededByProjectResult\(filteredMessages,\s*message\)/, "Agent material cards must not steal focus after a same-turn project-write result card"));
checkMessage(requireWithin(stylesSource, /\.minimal-agent-asset-inbox-summary small\.is-boundary[\s\S]*border-color[\s\S]*background[\s\S]*\.minimal-agent-asset-inbox-summary small\.is-boundary strong/, "Agent material scan boundary must have a quiet but visible style"));
checkMessage(requireWithin(stylesSource, /\.minimal-agent-asset-inbox-summary[\s\S]*grid-template-columns:[\s\S]*\.minimal-agent-asset-inbox-summary small[\s\S]*overflow-wrap:\s*anywhere/, "Agent material scanning summary needs compact non-overlapping styling"));
checkMessage(requireWithin(stylesSource, /\.minimal-agent-material-intake-hint[\s\S]*font-size:\s*11px[\s\S]*line-height:\s*1\.35/, "Agent material picker entry hint must stay compact in the right rail"));
check(!/minimal-agent-skill-groups small:not\(:nth-child\(2\)\)/.test(stylesSource), "Agent rail must not hide the project-loaded or my-Skills groups");
check(!/\.director-agent-rail \.minimal-agent-skill-groups\s*\{[^}]*display:\s*none/.test(stylesSource), "Agent rail must not hide the three creator-facing Skills groups");
checkMessage(requireWithin(directorMode, /director-agent-rail/, "DirectorMode must mount Agent as the right-side conversation rail"));
checkMessage(requireWithin(stylesSource, /\.director-agent-rail\s*\{[\s\S]*position:\s*sticky[\s\S]*max-height:\s*calc\(100vh - 108px\)/, "Agent rail must stay visible on desktop without covering project controls"));
checkMessage(requireWithin(stylesSource, /\.director-agent-rail \.minimal-agent-panel[\s\S]*display:\s*flex[\s\S]*flex-direction:\s*column[\s\S]*border-radius:\s*18px[\s\S]*overflow:\s*hidden/, "Agent rail must keep AI identity, messages, and input in one non-overlapping column"));
checkMessage(requireWithin(stylesSource, /\.director-agent-rail \.minimal-agent-thread\s*\{[\s\S]*flex:\s*1 1 220px[\s\S]*overflow:\s*auto/, "Agent rail must scroll the message thread instead of the whole panel"));
checkMessage(requireWithin(stylesSource, /\.director-agent-rail \.minimal-agent-input\s*\{[\s\S]*position:\s*relative[\s\S]*bottom:\s*auto/, "Agent rail input must not use sticky bottom overlay that covers messages"));
checkMessage(requireWithin(directorModeSource, /function\s+DirectorProjectRail[\s\S]*aria-label="项目导航"[\s\S]*故事[\s\S]*参考[\s\S]*视频[\s\S]*交付/, "Director workspace must expose a simple left project rail"));
checkMessage(requireWithin(directorModeSource, /const runtimeShotIds = new Set\(runtimeState\.storyFlow\.shots\.map[\s\S]*const scopedShots = directorView === "story" \|\| !activeSection[\s\S]*\? runtimeState\.storyFlow\.shots[\s\S]*runtimeState\.storyFlow\.shots\.filter[\s\S]*const\s+projectNavShotCount\s*=\s*showNewVideoStart \? \(newVideoStatus\?\.draftShotCount \|\| restoredNewVideoDraft\?\.shotCount \|\| 0\) : runtimeState\.storyFlow\.shots\.length[\s\S]*const\s+projectRailTitle\s*=\s*showNewVideoStart \? pendingDraftRailTitle \|\| "新视频项目" : runtimeState\.project\.title \|\| projectScopeLabel \|\| "新视频项目"[\s\S]*totalShots=\{projectNavShotCount\}/, "Director project rail, story scope, and Agent state must share the active draft/project shot count and title instead of mixing stale project copy"));
checkMessage(requireWithin(directorModeSource, /function\s+creatorReferenceGapCount[\s\S]*visibleMissing[\s\S]*batchGeneration\?\.missingCount[\s\S]*framePlan\?\.missingCount[\s\S]*if \(visibleMissing > 0\) return visibleMissing[\s\S]*assetReconciliation/, "Creator reference gap count must prefer visible image-reference gaps before internal asset-reconciliation counts"));
checkMessage(requireWithin(directorModeSource, /function\s+directorProjectRailReferenceLabel[\s\S]*referenceGapCount[\s\S]*displayedMissing[\s\S]*缺 \$\{displayedMissing\} 张[\s\S]*summary\?\.needsReview[\s\S]*待看[\s\S]*summary\?\.matched[\s\S]*可用/, "Project rail reference tab must prefer creator-facing shot-level gaps before internal asset counts"));
checkMessage(requireWithin(directorModeSource, /const projectRailReferenceGapCount = creatorReferenceGapCount\(creatorDesk\)[\s\S]*directorProjectRailReferenceLabel\([\s\S]*displayableReferenceAssetCount\(runtimeState\.visualMemory\.assets\),[\s\S]*projectRailReferenceGapCount/, "Project rail reference count must share the same shot-level missing-reference source as the main project status"));
checkMessage(requireWithin(directorModeSource, /const projectRailReferenceGapCount = creatorReferenceGapCount\(creatorDesk\)[\s\S]*cloneElement\(assetLibraryNode as ReactElement<\{ pendingConfirmationLabel\?: string; referenceGapCount\?: number \}>[\s\S]*referenceGapCount:\s*projectRailReferenceGapCount/, "Asset Library page must receive the same visible reference gap count as the left project rail"));
checkMessage(requireWithin(directorModeSource, /function\s+displayableReferenceAssetCount[\s\S]*asset\.type === "style"[\s\S]*png\|jpe\?g\|webp\|gif[\s\S]*directorProjectRailReferenceLabel\([\s\S]*displayableReferenceAssetCount\(runtimeState\.visualMemory\.assets\)/, "Project rail reference count must match visible image references instead of counting style metadata or hidden records"));
checkMessage(requireWithin(directorModeSource, /const\s+projectRailDisplayReferenceLabel\s*=\s*showNewVideoStart[\s\S]*:\s*projectRailReferenceLabel[\s\S]*referenceLabel=\{projectRailDisplayReferenceLabel\}/, "Project rail must receive a dedicated reference status label for the active draft/project context"));
checkMessage(requireWithin(directorModeSource, /function\s+directorProjectRailVideoLabel[\s\S]*not_submitted[\s\S]*未生成[\s\S]*recoverable[\s\S]*可查询[\s\S]*needs_review[\s\S]*待看[\s\S]*completed[\s\S]*可预览/, "Project rail video tab must use real video stage labels instead of preview placeholder counts"));
checkMessage(requireWithin(directorModeSource, /const\s+projectRailDisplayVideoLabel\s*=\s*showNewVideoStart \? "未生成" : projectRailVideoLabel[\s\S]*videoLabel=\{projectRailDisplayVideoLabel\}/, "Project rail must receive a dedicated video status label for the active draft/project context"));
check(!/previewCount\s*\|\|\s*"待回流"/.test(directorModeSource), "Project rail must not display preview placeholder count as a video result count");
checkMessage(requireWithin(stylesSource, /\.minimal-director\.has-agent-rail,[\s\S]*\.minimal-director\.preview\.has-agent-rail\s*\{[\s\S]*grid-template-columns:\s*minmax\(168px,\s*196px\) minmax\(0,\s*1fr\) minmax\(320px,\s*380px\)/, "Director workspace must reserve left project navigation, center results, and right Agent rail"));
checkMessage(requireWithin(stylesSource, /@media \(max-width:\s*1180px\)[\s\S]*\.minimal-director\.has-agent-rail,[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)[\s\S]*\.director-agent-rail[\s\S]*position:\s*static/, "Agent rail must fall back cleanly on narrow screens"));
checkMessage(requireWithin(stylesSource, /@media \(max-width:\s*1180px\)[\s\S]*\.director-agent-rail\s*\{[\s\S]*max-height:\s*min\(720px,\s*calc\(100vh - 112px\)\)[\s\S]*order:\s*-3[\s\S]*\.director-agent-rail \.minimal-agent-panel,[\s\S]*max-height:\s*inherit/, "Narrow Agent rail must stay above project navigation and keep the send button inside the viewport"));
checkMessage(requireWithin(stylesSource, /\.minimal-director,\s*[\s\S]*\.minimal-director\.preview\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)/, "Director workspace must be a single-column workspace"));
for (const flowLabel of ["创建项目", "AI 拆分", "生成参考", "复核", "发送视频", "预览", "导出"]) {
  checkMessage(requireWithin(directorWorkflowOverviewSource, new RegExp(flowLabel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `Agent-first workflow overview must expose ${flowLabel}`));
}
checkMessage(requireWithin(directorWorkflowOverviewSource, /creatorDesk\?\.videoStage/, "Agent-first workflow overview must read the unified videoStage"));
checkMessage(requireWithin(directorWorkflowOverviewSource, /const videoReturned = Boolean\(selectedShot\?\.videoPath\)[\s\S]*videoGeneration\?\.completedCount[\s\S]*const exportReady = videoComplete/, "Workflow overview must mark preview/export ready only after video media returns"));
check(!/const exportReady = currentView === "export" \|\| videoComplete/.test(directorWorkflowOverviewSource), "Workflow overview must not mark export deliverable merely because the export tab is open");
checkMessage(requireWithin(stylesSource, /\.director-flow-steps\s*\{[\s\S]*grid-template-columns:\s*repeat\(7,\s*minmax\(72px,\s*1fr\)\)/, "Agent-first workflow overview must fit all seven steps"));
check(!/\.director-flow-overview\s*\{[\s\S]{0,120}display:\s*none/.test(stylesSource), "Agent-first workflow overview must stay visible in the simple creator surface");
checkMessage(requireWithin(stylesSource, /\.director-bottom-composer \.minimal-agent-details,[\s\S]*\.director-bottom-composer \.minimal-agent-badges,[\s\S]*\.director-bottom-composer \.minimal-agent-action-log,[\s\S]*\.director-bottom-composer \.minimal-agent-generation-details\s*\{[\s\S]*display:\s*none/, "Bottom composer must keep logs/details/generation details collapsed by default while keeping the status row visible"));
checkMessage(requireWithin(stylesSource, /\.director-bottom-composer \.minimal-agent-advanced-controls,[\s\S]*\.minimal-director\.composer-only \.new-video-agent-boundary-details,[\s\S]*\.new-video-bottom-portal \.new-video-agent-boundary-details\s*\{[\s\S]*display:\s*none/, "Bottom composers must hide work-scope controls from the main path; creators can ask for scope changes in natural language"));
check(!/new-video-agent-boundary-details/.test(newVideoStart), "NewVideoStart bottom composer must not mount work-scope controls; creators can change scope in natural language");
checkMessage(requireWithin(stylesSource, /\.director-bottom-composer \.minimal-agent-capability-strip\s*\{[\s\S]*display:\s*none/, "Bottom composer must keep capability chips out of the main path"));
checkMessage(requireWithin(stylesSource, /:has\(\.project-control-popover\)[\s\S]*\.new-video-bottom-portal[\s\S]*pointer-events:\s*none/, "Project control popover must temporarily move the bottom composer out of the way"));
checkMessage(requireWithin(stylesSource, /body:has\(\.project-control-popover\) \.new-video-unified-composer[\s\S]*opacity:\s*0/, "Project control popover must hide the new-project composer, not just the portal wrapper"));
checkMessage(requireWithin(stylesSource, /\.project-control-popover\s*\{[\s\S]*display:\s*flex[\s\S]*flex-direction:\s*column[\s\S]*overflow:\s*hidden/, "Project control popover must keep actions visible while only the recent-project list scrolls"));
checkMessage(requireWithin(stylesSource, /\.project-control-recent\s*\{[\s\S]*flex:\s*1 1 auto[\s\S]*min-height:\s*0[\s\S]*\.project-control-recent-list\s*\{[\s\S]*overflow:\s*auto/, "Project control recent-project list must absorb overflow instead of pushing actions below the popover"));
checkMessage(requireWithin(minimalAgentPanelSource, /const primaryDisabledPrefix = !hasComposerInput && !isPreparingPlan \? "等待输入：" : "暂不能继续："/, "Bottom composer must distinguish empty input from a real blocker"));
checkMessage(requireWithin(minimalAgentPanelSource, /const composerIntentNeedsLocalProject = Boolean\([\s\S]*visibleComposerInputText[\s\S]*!localProjectReadyForTools[\s\S]*projectRequiredForWorkflow[\s\S]*projectBlockedWithoutFooterResolver[\s\S]*intentNeedsLocalProjectBeforeTooling\(visibleComposerInputText\)[\s\S]*composerReadyDraftDeferredToolStatus[\s\S]*先确认故事[\s\S]*const footerStatusCopy = composerReadyDraftDeferredToolIntent[\s\S]*composerReadyDraftDeferredToolStatus[\s\S]*composerIntentNeedsLocalProject[\s\S]*需要保存位置：发送后先确认保存位置[\s\S]*composerReferenceGenerationFromReferencePlan[\s\S]*识别为：生成参考图（等待确认）[\s\S]*composerPermissionContract[\s\S]*识别为：更新工作方式[\s\S]*hasVisibleComposerInput[\s\S]*识别为：\$\{composerIntentRoute\.label\}[\s\S]*消息里等待你确认：/, "Bottom composer must show structured save-location, reference-generation, and work-mode status before normal visible-input intent labels"));
checkMessage(requireWithin(minimalAgentPanelSource, /const pendingReferenceGenerationConfirmationChips = pendingReferenceGenerationConfirmationMessage[\s\S]*确认生成参考[\s\S]*label: "范围", value: "当前故事"[\s\S]*label: "参考", value: projectObservation\?\.references\.label \|\| "参考不完整"[\s\S]*displayedSelectionChips = pendingDraftShotCount[\s\S]*pendingReferenceGenerationConfirmationChips\.length[\s\S]*pendingReferenceGenerationConfirmationChips[\s\S]*referencePlanningContextActive/, "Right-rail selection chips must keep pending reference confirmations to scope and readiness while the confirmation card owns after-effects"));
check(!/const pendingReferenceGenerationConfirmationChips = pendingReferenceGenerationConfirmationMessage[\s\S]{0,420}确认后生成参考图，不提交视频/.test(minimalAgentPanelSource), "Right-rail pending reference scope chips must not repeat confirmation-card after-effects");
checkMessage(requireWithin(minimalAgentPanelSource, /function agentToolPreflightNotice\(handoff: DirectorAgentToolHandoff\)[\s\S]*reference_generation_not_ready[\s\S]*图片服务还没连接[\s\S]*先去设置里连接图片服务[\s\S]*const confirmationPreflightNotice = confirmationUsesPrimaryAction && handoffPreflightBlocked && displayedAgentToolHandoff[\s\S]*agentToolPreflightNotice\(displayedAgentToolHandoff\)[\s\S]*minimal-agent-action-hint[\s\S]*confirmationPreflightNotice/, "Blocked reference-generation confirmations must show the missing image-service reason in the visible Agent card"));
checkMessage(requireWithin(image2AssetGenerationActionSource, /const liveRuntimeProjectIdentity = runtimeProjectIdentity[\s\S]*currentProjectBindingIdentity\(await loadCurrentProjectBindingStatus\(\)\)[\s\S]*status: "blocked", message: "先选择项目。"/, "Image2 action runner must still resolve the current project binding live and block at run time when no project exists"));
checkMessage(requireWithin(image2AssetGenerationActionSource, /const assetGenerationAction = useMemo<Image2AssetGenerationActionView>\(\(\) => \(\{[\s\S]*disabled:\s*actionState\.status === "running" \|\| !keyConfigured[\s\S]*\}\), \[actionState\.message, actionState\.status, keyConfigured\]\)/, "Image2 action availability must not contradict Settings by treating a stale runtimeProjectIdentity projection as a missing image service"));
checkMessage(requireWithin(minimalAgentPanelSource, /const refreshedToolHandoff = buildVibeAgentToolHandoff\(\{[\s\S]*action: draft\.action[\s\S]*userConfirmed: false[\s\S]*availability: currentAgentToolAvailability\(draft\.action\)[\s\S]*setAgentToolHandoff\(refreshedToolHandoff\)/, "Restored Agent confirmations must refresh stale tool handoffs from action-specific live availability before showing image-service blockers"));
checkMessage(requireWithin(minimalAgentPanelSource, /function refreshedRestoredAgentStagedPlanDraft[\s\S]*nonConfirmationToolBlockers\(refreshedToolHandoff\)[\s\S]*loopStatus:\s*blockedReasons\.length \? "blocked" : "awaiting_confirmation"[\s\S]*onRefreshRestoredAgentStagedPlanDraft\?\.\(refreshedDraft\)/, "Restored Agent confirmations must persist refreshed live-availability handoffs so the staged-plan sidecar does not keep stale image-service blockers"));
checkMessage(requireWithin(appSource, /async function refreshRestoredAgentStagedPlanDraft\(draft: ProjectAgentStagedPlanDraft\)[\s\S]*restoredAgentStagedPlanDraft\?\.draftId[\s\S]*saveProjectAgentStagedPlanDraft\(prototypeProjectDraftTarget,\s*draft\)[\s\S]*setRestoredAgentStagedPlanDraft\(draft\)/, "App must write refreshed restored Agent staged plans back to project/runtime sidecars"));
checkMessage(requireWithin(minimalAgentPanelSource, /const composerReferenceGenerationSelectionChips = composerReferenceGenerationFromReferencePlan[\s\S]*确认后生成参考图，不提交视频[\s\S]*displayedSelectionChips = pendingDraftShotCount[\s\S]*composerReferenceGenerationSelectionChips\.length[\s\S]*composerReferenceGenerationSelectionChips[\s\S]*pendingReferenceGenerationConfirmationChips/, "Right-rail selection chips must explain confirmation-after-effects while the user is editing a reference-generation confirmation"));
checkMessage(requireWithin(minimalAgentPanelSource, /const composerExecutionTimelineEntries = mergeVibeAgentTimelineEntries\([\s\S]*const composerTimelineShowsReferenceReady = agentTimelineHasSucceededLiveExecution\([\s\S]*"prepare_references"[\s\S]*agentGenerationProjectIdentity[\s\S]*const composerTimelineHasReferenceValidation = agentTimelineHasValidatedExecution\([\s\S]*"prepare_references"[\s\S]*agentGenerationProjectIdentity[\s\S]*const storyHasMissingReferencesForComposer = Boolean\([\s\S]*runtimeState\.visualMemory\.summary\.missing > 0[\s\S]*projectObservation\?\.references\.status === "missing"[\s\S]*&& !composerTimelineShowsReferenceReady[\s\S]*&& !composerTimelineHasReferenceValidation[\s\S]*const composerVideoIntentShouldConfirmReferencesFirst = Boolean\([\s\S]*storyHasMissingReferencesForComposer[\s\S]*intentRequestsVideoSubmitWork\(referencePlanningIntentText\)[\s\S]*const composerVideoReferencePreflightChips = composerVideoIntentShouldConfirmReferencesFirst[\s\S]*label: "范围", value: "当前故事"[\s\S]*label: "下一步", value: "先补参考"[\s\S]*displayedSelectionChips = pendingDraftShotCount[\s\S]*composerVideoReferencePreflightChips\.length[\s\S]*composerVideoReferencePreflightChips/, "Right-rail typed send-video preflights must keep current-story scope unless current-identity live readiness or structured validation satisfies the reference boundary"));
checkMessage(requireWithin(minimalAgentPanelSource, /const composerIntentCanStartNewVideoWithoutProject = Boolean\([\s\S]*visibleComposerInputText[\s\S]*!currentProjectHasStoryContext[\s\S]*directorIntentCanStartNewVideoPlanningWithoutProject\(visibleComposerInputText\)[\s\S]*const composerIntentNeedsLocalProject = Boolean\([\s\S]*!composerIntentCanStartNewVideoWithoutProject[\s\S]*intentNeedsLocalProjectBeforeTooling\(visibleComposerInputText\)[\s\S]*const typedIntentCanStartNewVideoWithoutProject = Boolean\([\s\S]*currentTypedIntent[\s\S]*!currentProjectHasStoryContext[\s\S]*directorIntentCanStartNewVideoPlanningWithoutProject\(currentTypedIntent\)[\s\S]*!typedIntentCanStartNewVideoWithoutProject[\s\S]*intentNeedsLocalProjectBeforeTooling\(currentTypedIntent\)/, "Empty-project fresh story text such as 从零开始一个新视频 must start Agent planning instead of previewing save-location setup"));
checkMessage(requireWithin(minimalAgentPanelSource, /const primaryOperationConfirmationLabel = agentNextActionAvailable[\s\S]*\? agentCurrentTaskProjection\.label[\s\S]*const emptyComposerConfirmationLabel = footerNewVideoDraftConfirmationLabel[\s\S]*primaryOperationConfirmationLabel[\s\S]*currentTimelineConfirmationLabel[\s\S]*const emptyComposerPendingConfirmationLabel = !hasVisibleComposerInput && !canContinuePendingNewVideoDraft[\s\S]*const activeFooterConfirmationLabel = footerNewVideoDraftConfirmationLabel[\s\S]*primaryOperationConfirmationLabel[\s\S]*currentTimelineConfirmationLabel[\s\S]*const localProjectSetupRecoveryTakesFooterFocus = Boolean\([\s\S]*minimalAgentMessageIncompleteLocalProjectSetup\(localProjectSetupNotice\)[\s\S]*!preparedProjectEditCanConfirmWithoutLocalProject[\s\S]*const footerStatusCopy = composerReadyDraftDeferredToolIntent[\s\S]*localProjectSetupRecoveryTakesFooterFocus[\s\S]*activeFooterConfirmationLabel[\s\S]*emptyComposerPendingConfirmationLabel[\s\S]*localProjectSetupConfirmationContextActive[\s\S]*可点上方「选择保存位置」，也可以直接写要改哪里。[\s\S]*要修改就直接输入；确认在上方消息里。[\s\S]*消息里等待你确认：\$\{activeFooterConfirmationLabel\}/, "Pending footer copy must prefer the projection-owned confirmation label while save-location recovery stays concrete and the empty Send entry remains conversational"));
checkMessage(requireWithin(minimalAgentPanelSource, /const composerLocalProjectHint = canCreateProjectFromFooter[\s\S]*不会生成参考、提交视频或导出[\s\S]*const composerHint = emptyComposerPendingConfirmationLabel[\s\S]*\? ""[\s\S]*: sendDisabledReason[\s\S]*editingSkillSaveConfirmationActive[\s\S]*点发送后会先让你确认保存 Skill[\s\S]*composerReadyDraftDeferredToolIntent[\s\S]*composerReadyDraftDeferredToolHint[\s\S]*composerReferenceGenerationFromReferencePlan[\s\S]*点发送后会先让你确认生成参考图[\s\S]*composerPermissionContract[\s\S]*点发送后只更新工作方式，不改草案、不生成参考、不提交视频[\s\S]*composerIntentNeedsLocalProject[\s\S]*composerLocalProjectHint/, "Bottom composer typed ready-draft deferred tool requests, local-project blockers, save-Skill edits, staged reference generation, work-mode commands, busy states, and empty pending confirmations must explain what Send will do without repeating the same confirmation copy"));
checkMessage(requireWithin(minimalAgentPanelSource, /const footerStatusCopy = composerReadyDraftDeferredToolIntent[\s\S]*canContinuePendingNewVideoDraft[\s\S]*内容已准备，点发送让 AI 导演拆故事[\s\S]*newVideoDraftPlanningForAgent[\s\S]*AI 导演：草案出来后，你可以确认，也可以继续改。[\s\S]*cleanedEmptyComposerTimelineNextLine/, "Bottom composer planner-busy status must not show the generic empty-input prompt beside the busy disabled reason"));
checkMessage(requireWithin(minimalAgentPanelSource, /const composerReadyNewVideoDraftConfirmationIntent = Boolean\([\s\S]*composerReadyDraftInputText[\s\S]*activeNewVideoDraftConfirmation[\s\S]*!composerIntentNeedsLocalProject[\s\S]*isNewVideoDraftConfirmationRouteIntent\(composerReadyDraftInputText\)[\s\S]*const composerReadyDraftDeferredToolIntent = Boolean\([\s\S]*activeNewVideoDraftConfirmation[\s\S]*composerIntentNeedsLocalProject[\s\S]*intentRequestsToolOrExportWork\(composerReadyDraftInputText\)[\s\S]*const composerProjectEditConfirmationBlockPreviewMessage: MinimalAgentMessage \| undefined = \([\s\S]*composerToolIntentShouldYieldToProjectEditConfirmation[\s\S]*title: "AI 导演：先处理当前修改"[\s\S]*const composerLocalProjectBlockPreviewMessage: MinimalAgentMessage \| undefined = \([\s\S]*!composerReadyDraftPreviewMessage[\s\S]*!composerProjectEditConfirmationBlockPreviewMessage[\s\S]*composerIntentNeedsLocalProject[\s\S]*title: "AI 导演：需要保存位置"/, "Typed ready-draft confirmations such as 继续 must yield to pending project edits or save-location blockers before showing a confirm-story preview"));
checkMessage(requireWithin(minimalAgentPanelSource, /function latestPendingProjectEditConfirmationMessage\(entries: VibeAgentTimelineEntry\[\]\)[\s\S]*minimalAgentConfirmationSuperseded\(messages,\s*index\)[\s\S]*minimalAgentMessageIsWaitingConfirmation\(message\) && minimalAgentMessageIsStructuredProjectDraftEdit\(message\)[\s\S]*latestProjectEditTimelineConfirmationMessage[\s\S]*latestPendingProjectEditConfirmationMessage\(agentTimelineEntries\)[\s\S]*visibleTimelineConfirmationMessage,[\s\S]*latestTimelineConfirmationMessage,[\s\S]*latestProjectEditTimelineConfirmationMessage/, "Right Agent must preserve structured pending project-edit confirmations across later pure work-mode turns"));
checkMessage(requireWithin(minimalAgentPanelSource, /function preservedProjectEditConfirmationTimelineEntry\([\s\S]*preserved_project_edit_confirmation_[\s\S]*actionKind: message\.actionKind \|\| "revise_story_or_shot"[\s\S]*preservedFromMessageId: message\.id[\s\S]*if \(userIntentIsPermissionControlOnly && !referenceGenerationFromReferencePlan && !continueReferenceGenerationFromStoryPlan\)[\s\S]*const preservedProjectEditConfirmation = activeProjectEditConfirmationMessage[\s\S]*preservedProjectEditConfirmationTimelineEntry\(activeProjectEditConfirmationMessage,\s*executionBoundaryChangedAt\)[\s\S]*rememberAgentTimelineEntries\(\[[\s\S]*buildExecutionBoundaryControlUserTimelineEntry[\s\S]*buildExecutionBoundaryChangedTimelineEntry[\s\S]*\.\.\.\(preservedProjectEditConfirmation \? \[preservedProjectEditConfirmation\] : \[\]\)/, "Pure work-mode sends must keep pending project-edit confirmations in the current Agent turn"));
checkMessage(requireWithin(minimalAgentPanelSource, /const composerLocalProjectBlockPreviewMessage: MinimalAgentMessage \| undefined = \([\s\S]*!composerProjectEditConfirmationBlockPreviewMessage[\s\S]*visibleComposerInputText[\s\S]*composerIntentNeedsLocalProject[\s\S]*title: "AI 导演：需要保存位置"[\s\S]*我看到了“\$\{shortAgentPanelMessageText\(visibleComposerInputText\)\}”[\s\S]*fullAgentThreadMessages\.push\(composerProjectEditConfirmationBlockPreviewMessage\)[\s\S]*activeProjectEditConfirmationMessage[\s\S]*fullAgentThreadMessages\.push\(activeProjectEditConfirmationMessage\)[\s\S]*fullAgentThreadMessages\.push\(composerLocalProjectBlockPreviewMessage\)[\s\S]*!composerReadyDraftPreviewMessage && !composerProjectEditConfirmationBlockPreviewMessage && !composerLocalProjectBlockPreviewMessage && !composerNewStoryPreviewMessage && !composerReferenceGenerationPreviewMessage && !composerSkillSavePreviewMessage && !composerStoryRevisionPreviewMessage/, "Right Agent thread must preview typed project-edit and save-location blockers with the user's current intent, and pending project-edit confirmations must remain in focus"));
checkMessage(requireWithin(minimalAgentPanelSource, /const composerInputIsPermissionControlOnly = Boolean\([\s\S]*isDirectorAgentPermissionControlOnlyIntent\(composerReadyDraftInputText\)[\s\S]*const composerReferenceGenerationFromReferencePlan = Boolean\([\s\S]*!composerInputIsPermissionControlOnly[\s\S]*referencePlanningGenerationRequestText\(composerReadyDraftInputText\)[\s\S]*const composerPurePermissionContract = composerReadyDraftInputText[\s\S]*composerInputIsPermissionControlOnly/, "Ready-draft work-mode commands such as 允许补参考但不要提交视频 must not be stolen by reference-generation routing"));
checkMessage(requireWithin(minimalAgentPanelSource, /const composerPermissionLabel = composerPermissionContract[\s\S]*agentVideoPermissionDisplayLabel\(composerPermissionContract,\s*composerReadyDraftInputText\)[\s\S]*识别为：更新工作方式[\s\S]*composerPermissionLabel/, "Ready-draft pure work-mode previews must display user-facing no-video labels such as 视频不提交 instead of generic capability labels"));
checkMessage(requireWithin(minimalAgentPanelSource, /function composerFooterCopyIsRedundant\(hint: string,\s*status: string\)[\s\S]*normalizedComposerFooterCopy\(hint\) === normalizedComposerFooterCopy\(status\)[\s\S]*const footerHintCopy = composerFooterCopyIsRedundant\(composerHint,\s*footerStatusCopy\) \? "" : composerHint[\s\S]*\{footerHintCopy && <small>\{footerHintCopy\}<\/small>\}/, "Bottom composer must suppress duplicate hint/action copy, including waiting-input prefix variants"));
checkMessage(requireWithin(minimalAgentPanelSource, /const emptyComposerIdleNowLineActive = Boolean\([\s\S]*!hasVisibleComposerInput[\s\S]*!attachments\.length[\s\S]*!emptyComposerPendingConfirmationLabel[\s\S]*!storySavedIdleNowLineActive[\s\S]*sendDisabledReason === "先写一句，或拖入文件。"[\s\S]*const displaySendDisabledReason = storySavedIdleNowLineActive[\s\S]*等待你的下一句指令[\s\S]*emptyComposerIdleNowLineActive[\s\S]*等待输入[\s\S]*sendDisabledReason/, "Empty first-run composer now-line must collapse the repeated write-or-drop-file disabled copy into a compact idle state"));
checkMessage(requireWithin(minimalAgentPanelSource, /footerActionIsVideoQuery[\s\S]*消息里可以查询结果，不会重复提交[\s\S]*displayStatusLineText[\s\S]*等待即梦结果/, "Bottom composer must collapse recoverable video query copy into one clear Agent-message prompt"));
checkMessage(requireWithin(minimalAgentPanelSource, /function cleanEmptyComposerTimelineFooterLine\(value: string,\s*hasComposerInput: boolean\)[\s\S]*Skill 保存已暂停\|暂停保存 Skill\|动作已取消\|可以继续改这条导演经验[\s\S]*return "";[\s\S]*const cleanedEmptyComposerTimelineNextLine = cleanEmptyComposerTimelineFooterLine\(agentTimelineNextLine,\s*hasComposerInput\)[\s\S]*cleanedEmptyComposerTimelineNextLine[\s\S]*\? cleanedEmptyComposerTimelineNextLine[\s\S]*primaryDisabled/, "Idle Agent composer footer must not keep stale cancelled save-Skill timeline copy after the confirmation card is gone"));
checkMessage(requireWithin(minimalAgentPanelSource, /function minimalAgentMessageIsCancelledSkillSaveResult\(message: MinimalAgentMessage\)[\s\S]*message\.toolName === "save_skill"[\s\S]*message\.entryType === "action_result"[\s\S]*message\.lifecycle === "cancelled"[\s\S]*function minimalAgentMessageBelongsToSkillSaveTurn\(message: MinimalAgentMessage\)[\s\S]*message\.id\.startsWith\("skill_save_"\)[\s\S]*const cancelledSkillSaveTurnShouldYieldToStoryIdle = Boolean\([\s\S]*!skillSaveContextActive[\s\S]*!hasVisibleComposerInput[\s\S]*projectStatusView\?\.stage === "故事已保存"[\s\S]*const agentThreadMessagesForCurrentFocus = cancelledSkillSaveTurnShouldYieldToStoryIdle[\s\S]*!minimalAgentMessageBelongsToSkillSaveTurn\(message\)[\s\S]*displayedAgentThreadMessages/, "Idle current-story Agent message flow must hide cancelled save-Skill turns from the active focus without deleting the persisted timeline"));
checkMessage(requireWithin(minimalAgentPanelSource, /const storySavedIdleNowLineActive = Boolean\([\s\S]*projectStatusView\?\.stage === "故事已保存"[\s\S]*!hasVisibleComposerInput[\s\S]*!attachments\.length[\s\S]*!emptyComposerPendingConfirmationLabel[\s\S]*emptyComposerSendDisabledReason === "先写一句，或拖入文件。"[\s\S]*sendDisabledReason === emptyComposerSendDisabledReason[\s\S]*const displaySendDisabledReason = storySavedIdleNowLineActive[\s\S]*等待你的下一句指令[\s\S]*sendDisabledReason/, "Saved-story empty now-line must avoid echoing the generic empty composer prompt"));
checkMessage(requireWithin(minimalAgentPanelSource, /const displayStatusLineText = footerActionIsVideoQuery[\s\S]*emptyComposerPendingConfirmationLabel[\s\S]*`等待确认：\$\{emptyComposerPendingConfirmationLabel\}`[\s\S]*sendDisabledReason[\s\S]*\? displaySendDisabledReason[\s\S]*activeFooterConfirmationLabel \|\| footerNewVideoDraftConfirmationReady[\s\S]*\? footerStatusCopy[\s\S]*hasVisibleComposerInput[\s\S]*\? footerStatusCopy[\s\S]*cleanEmptyComposerStatusLine\(agentTimelineStatusLine \|\| statusLineText/, "Bottom now-line must prioritize the current visible confirmation, generic disabled copy override, or visible typed intent over stale Agent timeline summaries"));
checkMessage(requireWithin(minimalAgentPanelSource, /const liveComposerValueRef = useRef\(""\)/, "Agent composer must keep a live textarea value ref for send-time focus stability"));
checkMessage(requireWithin(minimalAgentPanelSource, /const lastVisibleComposerInputRef = useRef\(""\)/, "Agent composer must keep the last user-visible textarea input for accessibility click fallback"));
checkMessage(requireWithin(minimalAgentPanelSource, /function updateText\(value: string\) \{[\s\S]*liveComposerValueRef\.current = value[\s\S]*lastVisibleComposerInputRef\.current = value[\s\S]*setText\(value\)/, "Agent composer text updates must keep both live refs in sync"));
checkMessage(requireWithin(minimalAgentPanelSource, /window\.setInterval\(\(\) => \{[\s\S]*textareaRef\.current\?\.value\.trim\(\)[\s\S]*liveComposerValueRef\.current = value[\s\S]*lastVisibleComposerInputRef\.current = value[\s\S]*if \(value !== text\.trim\(\) \|\| workflow\) updateText\(value\)[\s\S]*120[\s\S]*window\.clearInterval\(intervalId\)[\s\S]*\}, \[text, workflow\]\)/, "Agent composer must poll the focused DOM value so clipboard and accessibility input clears stale staged workflows before send"));
checkMessage(requireWithin(minimalAgentPanelSource, /function currentComposerTextValue\(\) \{[\s\S]*textareaRef\.current\?\.value \|\| liveComposerValueRef\.current \|\| text[\s\S]*function handleSend\(\) \{[\s\S]*const currentTypedIntent = captureComposerLiveValue\(\) \|\| lastVisibleComposerInputRef\.current\.trim\(\)[\s\S]*setActiveComposerTurnIntent\(currentTypedIntent\)/, "Sending must lock the textarea's visible value as the current Agent turn before old confirmations can take focus without making stale visible input disable confirmations"));
checkMessage(requireWithin(minimalAgentPanelSource, /function handleSend\(\) \{[\s\S]*if \(currentTypedIntent\) \{[\s\S]*setActiveComposerTurnIntent\(currentTypedIntent\)[\s\S]*setText\(""\)[\s\S]*liveComposerValueRef\.current = ""[\s\S]*lastVisibleComposerInputRef\.current = ""[\s\S]*\}/, "Sending typed text must clear the visible composer refs after locking the current Agent turn so pending confirmations do not look like fresh input"));
checkMessage(requireWithin(minimalAgentPanelSource, /function currentComposerTextValue\(\) \{[\s\S]*textareaRef\.current\?\.value \|\| liveComposerValueRef\.current \|\| text[\s\S]*\}/, "Visible composer input must ignore last-visible fallback so cleared inputs do not disable pending confirmations"));
check(
  !/function currentComposerTextValue\(\) \{\s*return \([^)]*lastVisibleComposerInputRef\.current/.test(minimalAgentPanelSource),
  "Last-visible composer fallback must be send-time only, not normal visible input state",
);
checkMessage(requireWithin(minimalAgentPanelSource, /function handleComposerBlur\(event: FocusEvent<HTMLTextAreaElement>\) \{[\s\S]*event\.currentTarget\.value\.trim\(\)[\s\S]*liveComposerValueRef\.current = value[\s\S]*onBlur=\{handleComposerBlur\}/, "Agent composer blur must preserve the live textarea value before accessibility click activation can clear controlled input"));
checkMessage(requireWithin(minimalAgentPanelSource, /function captureComposerLiveValue\(\) \{[\s\S]*const value = currentComposerTextValue\(\)[\s\S]*liveComposerValueRef\.current = value[\s\S]*lastVisibleComposerInputRef\.current = value[\s\S]*function handleSendPointerDown\(event: PointerEvent<HTMLButtonElement>\)[\s\S]*event\.preventDefault\(\)[\s\S]*handleSend\(\)[\s\S]*function handleSendMouseDown\(event: MouseEvent<HTMLButtonElement>\)[\s\S]*if \(sendPointerHandledRef\.current\) return[\s\S]*event\.preventDefault\(\)[\s\S]*handleSend\(\)[\s\S]*onPointerDown=\{handleSendPointerDown\}[\s\S]*onMouseDown=\{handleSendMouseDown\}[\s\S]*onClick=\{handleSendClick\}/, "Agent send button must send from pointer/mouse-down so the live textarea value wins before focus or controlled-input redraw"));
checkMessage(requireWithin(minimalAgentPanelSource, /const sendPointerHandledRef = useRef\(false\)[\s\S]*function handleSendClick\(\) \{[\s\S]*sendPointerHandledRef\.current[\s\S]*sendPointerHandledRef\.current = false[\s\S]*return;[\s\S]*captureComposerLiveValue\(\)[\s\S]*handleSend\(\)/, "Agent send click handler must avoid double-sending after pointer-down while keeping keyboard and accessibility activation as a live-value fallback"));
checkMessage(requireWithin(minimalAgentPanelSource, /const hasCurrentComposerInput = Boolean\(currentTypedIntent \|\| attachments\.length\)[\s\S]*if \(!hasCurrentComposerInput && !canContinuePendingNewVideoDraft\)[\s\S]*if \(!hasCurrentComposerInput && canContinuePendingNewVideoDraft\)/, "Current typed text must preempt empty-composer draft continuation even if React state lags behind the DOM"));
checkMessage(requireWithin(minimalAgentPanelSource, /const currentTypedIntentIsPermissionControlOnly = Boolean\([\s\S]*isDirectorAgentPermissionControlOnlyIntent\(currentTypedIntent\)[\s\S]*const composerNeedsLocalProject = !currentTypedIntentIsPermissionControlOnly && \([\s\S]*!localProjectReadyForTools[\s\S]*projectRequiredForWorkflow[\s\S]*projectBlockedWithoutFooterResolver[\s\S]*intentNeedsLocalProjectBeforeTooling\(currentTypedIntent\)[\s\S]*const continueDirectAction = currentTypedIntent && isContinueIntent\(currentTypedIntent\) && !attachments\.length && !composerNeedsLocalProject[\s\S]*\? projectedFooterDirectAction/, "Typed generation or continue requests must not bypass structured save-location state or the projection-matched footer action"));
checkMessage(requireWithin(minimalAgentPanelSource, /if \(composerNeedsLocalProject\) \{[\s\S]*rememberLocalProjectBlockForIntent\(currentTypedIntent\)[\s\S]*return;[\s\S]*\}[\s\S]*const continueDirectAction/, "Typed local-project blockers must stop in handleSend before direct actions or Agent planning can stage generation confirmations"));
checkMessage(requireWithin(minimalAgentPanelSource, /if \(composerNeedsLocalProject\) \{[\s\S]*liveComposerValueRef\.current = ""[\s\S]*lastVisibleComposerInputRef\.current = ""[\s\S]*rememberLocalProjectBlockForIntent\(currentTypedIntent\)[\s\S]*void prepareChange\(currentTypedIntent \|\| undefined,\s*currentComposerSelectionOverride\(currentTypedIntent\)\)/, "After consuming live composer text, send must hand the locked intent to the planner before fallback refs are cleared by the prepared turn"));
checkMessage(requireWithin(minimalAgentPanelSource, /const currentTypedIntentIsPermissionControlOnly = Boolean\([\s\S]*isDirectorAgentPermissionControlOnlyIntent\(currentTypedIntent\)[\s\S]*currentTypedIntent[\s\S]*activeProjectEditConfirmationMessage[\s\S]*activeProjectEditConfirmationLabel[\s\S]*!currentTypedIntentIsPermissionControlOnly[\s\S]*intentRequestsToolOrExportWork\(currentTypedIntent\)[\s\S]*buildPendingProjectEditBlockedTimelineEntries[\s\S]*setStatus\(`先处理当前修改：\$\{activeProjectEditConfirmationLabel\}`\)[\s\S]*const composerNeedsLocalProject = !currentTypedIntentIsPermissionControlOnly/, "Sending typed tool requests must preserve a pending project-edit confirmation before the save-location blocker can replace it, while pure work-mode commands bypass both blockers"));
checkMessage(requireWithin(minimalAgentPanelSource, /function localProjectBlockedIntentLabel\(route: ReturnType<typeof routeProjectAgentIntent>, userIntent = ""\)[\s\S]*isContinueIntent\(userIntent\) && !intentRequestsToolOrExportWork\(userIntent\)[\s\S]*"继续下一步"[\s\S]*video_submit[\s\S]*"发送视频"[\s\S]*export[\s\S]*"导出交付包"[\s\S]*reference_generation[\s\S]*"补参考"[\s\S]*return route\.label/, "Save-location blocker summaries must preserve pure continue plus concrete typed reference, video, and export intents"));
checkMessage(requireWithin(minimalAgentPanelSource, /function rememberLocalProjectBlockForIntent\(userIntent: string\)[\s\S]*const blockedIntentRoute = routeProjectAgentIntent\(\{[\s\S]*text: userIntent[\s\S]*observation: composerProjectObservation[\s\S]*const blockedIntentLabel = localProjectBlockedIntentLabel\(blockedIntentRoute,\s*userIntent\)[\s\S]*\{ label: "你想做", value: blockedIntentLabel \}[\s\S]*\{ label: "先做", value: "选择保存位置" \}[\s\S]*\{ label: "保护", value: "不生成参考、不提交视频、不导出" \}/, "Sent save-location blocker messages must keep the current continue or tool intent in their visible facts"));
checkMessage(requireWithin(minimalAgentPanelSource, /const userIntentIsPermissionControlOnly = isDirectorAgentPermissionControlOnlyIntent\(userIntent\)[\s\S]*const userIntentNeedsLocalProject = !userIntentIsPermissionControlOnly[\s\S]*!localProjectReadyForTools[\s\S]*projectRequiredForWorkflow[\s\S]*projectBlockedWithoutFooterResolver[\s\S]*intentNeedsLocalProjectBeforeTooling\(userIntent\)[\s\S]*if \(userIntentNeedsLocalProject\)[\s\S]*rememberLocalProjectBlockForIntent\(userIntent\)/, "Prepared Agent turns must use structured local-project readiness before staging generation confirmations while pure work-mode commands bypass the blocker"));
checkMessage(requireWithin(minimalAgentPanelSource, /function intentNeedsLocalProjectBeforeTooling\(value: string\)[\s\S]*isDirectorAgentPermissionControlOnlyIntent\(text\)[\s\S]*return false[\s\S]*intentIsStoryRevisionWithoutTooling\(text\)[\s\S]*return false[\s\S]*继续\|下一步\|生成\|参考\|视频/, "Local-project blockers must not swallow permission-only or pure story/shot revision messages"));
checkMessage(requireWithin(minimalAgentPanelSource, /function intentRequestsToolOrExportWork\(value: string\)[\s\S]*asksReference[\s\S]*asksVideo[\s\S]*asksExport[\s\S]*asksStartTool[\s\S]*return \(asksReference && !blocksReference\)/, "Story/shot revision bypass must still keep active reference, video, export, and execution requests behind the local-project gate"));
checkMessage(requireWithin(minimalAgentPanelSource, /const stageStoryRevisionLocally = !localProjectReadyForTools[\s\S]*currentProjectHasStoryContext[\s\S]*intentIsStoryRevisionWithoutTooling\(userIntent\)[\s\S]*if \(!stageStoryRevisionLocally\) \{[\s\S]*stagedAgentPlan = await onStagePrototypeAgentPlan\?\.\(\{[\s\S]*const stagedAgentTimelineEntries = stagedAgentPlan\?\.agentTimelineEntries/, "Temporary-project story revisions must stage a local current-turn Agent plan instead of depending on save-location or restored timeline writes"));
checkMessage(requireWithin(minimalAgentPanelSource, /requestedStoryboardShotCountFromIntent[\s\S]*const composerReadyDraftRequestedShotCount = requestedStoryboardShotCountFromIntent\(composerReadyDraftInputText\)[\s\S]*const visibleExplicitAgentSelectionContext = newVideoAgentSelectionContext \|\| explicitAgentSelectionContextFromTimeline\([\s\S]*const composerReadyDraftSelectedShotTarget = readyDraftSelectedShotTargetFromAgentContext\(visibleExplicitAgentSelectionContext\)[\s\S]*const composerReadyDraftTargetShotRevision = !composerReadyDraftRequestedShotCount[\s\S]*readyDraftTargetShotRevisionFromIntent\(composerReadyDraftInputText,\s*newVideoDraftShotCountForAgent,\s*composerReadyDraftSelectedShotTarget\)[\s\S]*const composerReadyDraftFeedbackLabel = composerReadyDraftRequestedShotCount[\s\S]*\? `重排为 \$\{composerReadyDraftRequestedShotCount\} 个镜头`[\s\S]*composerReadyDraftTargetShotRevision[\s\S]*\? composerReadyDraftTargetShotRevision\.label[\s\S]*composerReadyDraftTargetsExistingShot[\s\S]*\? "修改当前草案"[\s\S]*const composerReadyDraftFeedbackFacts = composerReadyDraftRequestedShotCount[\s\S]*\{ label: "目标镜头", value: `\$\{composerReadyDraftRequestedShotCount\} 个` \}[\s\S]*composerReadyDraftTargetShotRevision[\s\S]*\{ label: "目标", value: composerReadyDraftTargetShotRevision\.targetFact \}[\s\S]*\{ label: "改动", value: composerReadyDraftTargetShotRevision\.changeFact \}[\s\S]*\{ label: "保护", value: "保留原动作" \}[\s\S]*title: `AI 导演：\$\{composerReadyDraftFeedbackLabel\}`/, "Ready draft feedback preview must keep shot-count restructures while showing target-shot edits such as 最后一镜 or selected-shot 这个镜头 as concrete current-draft previews"));
checkMessage(requireWithin(minimalAgentPanelSource, /function readyDraftSelectedShotTargetFromAgentContext\(context\?:[\s\S]*const rawTarget = context\?\.chips\.find\(\(chip\) => chip\.label === "这个指向"\)\?\.value \|\| ""[\s\S]*const target = cleanStoryText\(rawTarget\)[\s\S]*const rangeMatch = rawTarget\.match[\s\S]*\|\| target\.match[\s\S]*targetFact: `第 \$\{shotNumber\} 镜（已选中）`/, "Selected draft-shot previews must parse raw 1-2 chips before cleanStoryText removes the hyphen"));
checkMessage(requireWithin(minimalAgentPanelSource, /function readyDraftRemovalTargetFromText\(value: string\)[\s\S]*只改场景\|不要改动作\|不要改变动作\|不改动作\|不改变动作\|保留动作\|动作不变\|动作保持不变[\s\S]*不要再提\|不要\|别\|不用\|去掉\|移除\|删掉\|删除[\s\S]*const removalTarget = readyDraftRemovalTargetFromText\(text\)[\s\S]*const targetFact = selectedMatch[\s\S]*tailMatch && removalTarget[\s\S]*含\$\{removalTarget\}的镜头[\s\S]*去掉：\$\{removalTarget\}/, "Ready draft target-shot preview must identify removal phrases such as 结尾那镜不要月亮 without treating 不要改动作 as a deletion"));
checkMessage(requireWithin(minimalAgentPanelSource, /const composerSkillSavePreviewMessage: MinimalAgentMessage \| undefined = \([\s\S]*editingSkillSaveConfirmationActive[\s\S]*AI 导演：保存导演经验[\s\S]*发送后会先生成保存确认卡[\s\S]*fullAgentThreadMessages\.push\(composerSkillSavePreviewMessage\)[\s\S]*!composerSkillSavePreviewMessage && !composerStoryRevisionPreviewMessage/, "Save-Skill edits must show a current-turn Agent preview for saving project Skills instead of falling through to story revision preview"));
checkMessage(requireWithin(minimalAgentPanelSource, /const composerNewStoryPreviewMessage[\s\S]*!currentProjectHasStoryContext[\s\S]*directorIntentCanStartNewVideoPlanningWithoutProject\(visibleComposerInputText\)[\s\S]*title: "AI 导演：整理新故事"[\s\S]*body: "我理解你要把这句话整理成新视频草案[\s\S]*fullAgentThreadMessages\.push\(composerNewStoryPreviewMessage\)/, "First-message new-story input must show the current user intent followed by an Agent understanding card before Send"));
checkMessage(requireWithin(minimalAgentPanelSource, /const composerStoryRevisionPreviewMessage: MinimalAgentMessage \| undefined = \([\s\S]*visibleComposerInputText[\s\S]*!activeNewVideoDraftConfirmation[\s\S]*!composerIntentNeedsLocalProject[\s\S]*!composerPermissionContract[\s\S]*!editingSkillSaveConfirmationActive[\s\S]*composerIntentRoute\.kind === "revision"[\s\S]*title: `AI 导演：\$\{composerIntentRoute\.label === "修改当前内容" \? "修改故事" : composerIntentRoute\.label\}`[\s\S]*发送后我会先整理成可确认修改，不会生成参考图，也不会发送视频/, "Existing-story typed revisions such as shot-count restructuring must show a current-turn Agent preview before Send, while pure work-mode and save-Skill commands stay scoped away from story edits"));
checkMessage(requireWithin(minimalAgentPanelSource, /function minimalAgentMessageIsPassiveProjectReadyState\(message: MinimalAgentMessage\)[\s\S]*project_story_flow_ready_state[\s\S]*const composerCurrentTurnPreviewActive = Boolean\([\s\S]*composerReadyDraftPreviewMessage[\s\S]*composerProjectEditConfirmationBlockPreviewMessage[\s\S]*composerLocalProjectBlockPreviewMessage[\s\S]*composerNewStoryPreviewMessage[\s\S]*composerStoryRevisionPreviewMessage[\s\S]*stateAwareAgentThreadMessages = fullAgentThreadMessages\.filter\(\(message\) =>[\s\S]*!\(composerCurrentTurnPreviewActive && minimalAgentMessageIsPassiveProjectReadyState\(message\)\)/, "Right Agent typed-preview flow must not keep the passive story-ready status card between the user's current input and the Agent understanding card"));
checkMessage(requireWithin(minimalAgentPanelSource, /if \(footerNewVideoDraftConfirmationReady\)[\s\S]*建议行动：确认这版故事[\s\S]*if \(showAgentNote \|\| showAgentResultNote \|\| preparedContext\?\.userIntent\?\.trim\(\)\) return undefined;[\s\S]*if \(projectRequiredForWorkflow\)[\s\S]*建议行动：选择保存位置/, "Save-location suggestion cards must not override a prepared current Agent turn such as a story revision"));
checkMessage(requireWithin(minimalAgentPanelSource, /if \(!visibleAgentTimelineEntries\.length && showAgentNote\) \{[\s\S]*id: "assistant-plan"[\s\S]*if \(agentNextActionAvailable && agentActionEnvelope\) \{[\s\S]*id: "assistant-plan-confirmation"[\s\S]*entryType: "confirmation_request"[\s\S]*role: "confirmation"[\s\S]*toolName: "request_user_confirmation"[\s\S]*actionKind: agentActionEnvelope\.kind[\s\S]*actionId: agentActionEnvelope\.actionId[\s\S]*确认前不会执行；确认后只按这一步推进/, "Prepared Agent turns must put their confirmation request in the visible message flow instead of only below the fold"));
checkMessage(requireWithin(minimalAgentPanelSource, /function minimalAgentMessageIsProjectDraftEdit\(message: MinimalAgentMessage\) \{[\s\S]*message\.actionKind === "revise_story_or_shot" \|\| message\.actionKind === "update_shot_strategy"[\s\S]*minimalAgentFactValue\(message,\s*\["动作",\s*"会做",\s*"执行",\s*"调用",\s*"成本"\]\)[\s\S]*storyShotCount/, "Project edit confirmations must be detected even when restored timeline copy lost actionKind"));
checkMessage(requireWithin(minimalAgentPanelSource, /function minimalAgentMessageIsProjectDraftEdit\(message: MinimalAgentMessage\) \{[\s\S]*改项目\|修改项目\|更新项目\|重排/, "Project edit confirmations must treat project-edit facts as stronger than save-location copy"));
checkMessage(requireWithin(minimalAgentPanelSource, /function minimalAgentMessageIsLocalProjectSetup\(message: MinimalAgentMessage\) \{[\s\S]*minimalAgentMessageIsProjectDraftEdit\(message\)[\s\S]*return false[\s\S]*保存位置/, "Project edit confirmations must stay separate from save-location confirmations"));
checkMessage(requireWithin(minimalAgentPanelSource, /function agentActionIsProjectDraftEdit\(action\?: DirectorAgentActionEnvelope\) \{[\s\S]*revise_story_or_shot[\s\S]*update_shot_strategy/, "Prepared project edit detection must be narrow"));
checkMessage(requireWithin(minimalAgentPanelSource, /agentCurrentTaskProjection\.step === "confirm_story"[\s\S]*agentCurrentTaskProjection\.confirmationKind === "project_edit"[\s\S]*const canDispatchProjectEdit[\s\S]*void confirmPlan\(\)[\s\S]*confirmRestoredProjectEditFromMessage\(activeProjectEditConfirmationMessage\)/, "Prepared story or shot edits must remain projection-owned instead of yielding to save-location work"));
checkMessage(requireWithin(minimalAgentPanelSource, /const confirmationIsLocalProjectSetup = agentCurrentTaskProjection\.step === "choose_save_location"/, "Rendered confirmation routing must use the projected save-location step"));
checkMessage(requireWithin(minimalAgentPanelSource, /async function confirmRestoredProjectEditFromMessage\(message: MinimalAgentMessage\)[\s\S]*restoredAgentStagedPlanDraft\?\.status === "active"[\s\S]*minimalAgentMessageIsProjectDraftEdit\(message\)[\s\S]*buildConfirmedAgentToolHandoff\(action\)[\s\S]*runConfirmedAgentTool\(action,\s*userIntent,\s*confirmedHandoff\)/, "Restored prepared story or shot edits must execute the persisted staged plan instead of re-sending confirmation text"));
checkMessage(requireWithin(minimalAgentPanelSource, /const confirmationUsesPreparedProjectEdit = agentCurrentTaskProjection\.step === "confirm_story"[\s\S]*agentCurrentTaskProjection\.confirmationKind === "project_edit"[\s\S]*confirmationUsesPreparedProjectEdit[\s\S]*Boolean\(hasVisibleComposerInput \|\| isPreparingPlan\)[\s\S]*if \(confirmationUsesPreparedProjectEdit\) \{[\s\S]*if \(workflow\) \{[\s\S]*void confirmPlan\(\)[\s\S]*void confirmRestoredProjectEditFromMessage\(message\)/, "Projection-classified story or shot edits must confirm their own plan instead of opening another task"));
checkMessage(requireWithin(minimalAgentPanelSource, /function minimalAgentMessageInvalidatesConfirmation\(message: MinimalAgentMessage, confirmation: MinimalAgentMessage\) \{[\s\S]*message\.entryType !== "state_change"[\s\S]*isMinimalAgentSelectionContextId\(message\.id\) && minimalAgentMessageIsWaitingConfirmation\(confirmation\)[\s\S]*return false[\s\S]*message\.id\.startsWith\("execution_boundary_"\)/, "Automatic selection-context cards must not invalidate the current waiting confirmation before the user can see it"));
checkMessage(requireWithin(minimalAgentPanelSource, /const stagedAgentTimelineEntries = stagedAgentPlan\?\.agentTimelineEntries\?\.length[\s\S]*stagedAgentPlan\.agentActionEnvelope\.status === nextAgentActionEnvelope\.status[\s\S]*setAgentTimelineEntries\([\s\S]*stagedAgentActionMatchesChosen && stagedAgentTimelineEntries && agentTimelineEntriesForCurrentUserIntent\(stagedAgentTimelineEntries, userIntent\)[\s\S]*\? stagedAgentTimelineEntries[\s\S]*: buildLocalPreparedAgentTimelineEntries\(\{[\s\S]*userIntent,[\s\S]*action: nextAgentActionEnvelope/, "A new typed Agent plan without matching Product Agent timeline entries and status must render a local current-turn Agent message instead of silently clearing the input"));
checkMessage(requireWithin(minimalAgentPanelSource, /function agentTimelineEntriesForCurrentUserIntent\(entries: VibeAgentTimelineEntry\[\], userIntent: string\)[\s\S]*entry\.type === "user_message"[\s\S]*cleanMinimalAgentMessageCopy\(entry\.body\)\.includes\(intentLead\)[\s\S]*const nextUserIndex = entries\.findIndex[\s\S]*index > currentUserIndex && entry\.type === "user_message"[\s\S]*return entries\.slice\(currentUserIndex, nextUserIndex >= 0 \? nextUserIndex : undefined\)/, "Right-rail timeline display must focus a persisted timeline on the current typed user turn without leaking later turns"));
checkMessage(requireWithin(minimalAgentPanelSource, /function visibleMinimalAgentMessages\(messages: MinimalAgentMessage\[\]\)[\s\S]*latestWaitingConfirmation = \[\.\.\.turnFocusedMessages\][\s\S]*find\(minimalAgentMessageIsWaitingConfirmation\)[\s\S]*pinned = latestWaitingConfirmation && !bounded\.some[\s\S]*pinnedBounded[\s\S]*placeSelectionContextBeforeActiveConfirmation\(pinnedBounded\)/, "Right-rail message compaction must pin an active current-turn confirmation without reviving resolved confirmation cards or older confirmation cards after a later user message"));
checkMessage(requireWithin(minimalAgentPanelSource, /const \[activeComposerTurnIntent, setActiveComposerTurnIntent\] = useState\(""\)/, "Agent composer must remember the latest typed turn while async planning replaces stale confirmations"));
checkMessage(requireWithin(minimalAgentPanelSource, /const visibleAgentTimelineEntries = useMemo\(\(\) => \{[\s\S]*restoredPendingAgentIntent[\s\S]*text\.trim\(\)[\s\S]*restoredPendingAgentIntent[\s\S]*liveComposerValueRef\.current\.trim\(\)[\s\S]*lastVisibleComposerInputRef\.current\.trim\(\)[\s\S]*preparedContext\?\.userIntent\?\.trim\(\)[\s\S]*activeComposerTurnIntent\.trim\(\)[\s\S]*agentTimelineEntriesForCurrentUserIntent\(agentTimelineEntries, currentUserIntent\) \|\| \[\][\s\S]*restoredAgentStagedPlanDraft\?\.userIntent[\s\S]*text\]\)/, "Prepared typed plans must display the current typed turn, or an active restored staged-plan confirmation before stale composer input"));
checkMessage(requireWithin(minimalAgentPanelSource, /function agentTimelineEntriesForLatestWaitingConfirmation\(entries: VibeAgentTimelineEntry\[\], activeReferenceGenerationActionId = ""\)[\s\S]*agentTimelineEntryRequestsActionConfirmation\(entries\[index\]\)[\s\S]*const confirmationMessage = timelineMessages\[confirmationIndex\][\s\S]*minimalAgentConfirmationSuperseded\(timelineMessages,\s*confirmationIndex\)[\s\S]*minimalAgentConfirmationMessageIsStaleAfterLaterResult\(timelineMessages,\s*confirmationMessage\)[\s\S]*minimalAgentReferenceGenerationConfirmationIsStale\(timelineMessages,\s*confirmationMessage,\s*false,\s*activeReferenceGenerationActionId\)[\s\S]*entries\.slice\(userIndex >= 0 \? userIndex : actionStartIndex, confirmationIndex \+ 1\)[\s\S]*function latestWaitingConfirmationUserIntent\(entries: VibeAgentTimelineEntry\[\], activeReferenceGenerationActionId = ""\)[\s\S]*const restoredReferenceGenerationActionId = restoredAgentStagedPlanDraft\?\.status === "active"[\s\S]*const activeConfirmationIntent = latestWaitingConfirmationUserIntent\(agentTimelineEntries,\s*restoredReferenceGenerationActionId\)[\s\S]*restoredPendingAgentIntent[\s\S]*activeConfirmationIntent[\s\S]*liveComposerValueRef\.current\.trim\(\)[\s\S]*if \(activeConfirmationIntent && currentUserIntent === activeConfirmationIntent\)[\s\S]*agentTimelineEntriesForLatestWaitingConfirmation\(agentTimelineEntries,\s*restoredReferenceGenerationActionId\)/, "Restored timeline confirmations must stay focused even if later plan-only turns were appended after the waiting confirmation, but must not revive after a later completed result closes the same action unless the active sidecar still owns that reference confirmation"));
checkMessage(requireWithin(minimalAgentPanelSource, /function latestWaitingReferenceGenerationConfirmationActionId\(entries: VibeAgentTimelineEntry\[\]\)[\s\S]*prepare_reference_generation[\s\S]*return entry\.actionId[\s\S]*const timelineReferenceGenerationActionId = latestWaitingReferenceGenerationConfirmationActionId\(agentTimelineEntries\)[\s\S]*const restoredReferenceGenerationActionId = restoredAgentStagedPlanDraft\?\.status === "active"[\s\S]*restoredAgentStagedPlanDraft\.action\?\.kind === "prepare_reference_generation"[\s\S]*timelineReferenceGenerationActionId/, "Right Agent confirmation focus must recover the latest active reference confirmation from structured timeline or staged-plan state"));
checkMessage(requireWithin(minimalAgentPanelSource, /function restoredAgentStagedPlanThreadMessages\(draft\?: ProjectAgentStagedPlanDraft\): MinimalAgentMessage\[\] \{[\s\S]*draft\.status !== "active"[\s\S]*action\.status !== "staged"[\s\S]*role: "user"[\s\S]*role: "confirmation"[\s\S]*toolName: "request_user_confirmation"[\s\S]*confirmationFacts/, "MinimalAgentPanel must restore active staged sidecars into a visible user turn and confirmation card"));
checkMessage(requireWithin(minimalAgentPanelSource, /const restoredStagedPlanThreadMessages = restoredAgentStagedPlanThreadMessages\(restoredAgentStagedPlanDraft\)[\s\S]*restoredStagedPlanConfirmationMessage[\s\S]*minimalAgentConfirmationRequestsSameAction[\s\S]*fullAgentThreadMessages\.push\(restoredStagedPlanUserMessage\)[\s\S]*fullAgentThreadMessages\.push\(restoredStagedPlanConfirmationMessage\)/, "MinimalAgentPanel must append restored staged confirmations after stale timeline turns without duplicating equivalent confirmations"));
checkMessage(requireWithin(minimalAgentPanelSource, /function rememberLocalProjectBlockForIntent\(userIntent: string\) \{[\s\S]*setActiveComposerTurnIntent\(userIntent\)[\s\S]*rememberAgentTimelineEntries\(buildLocalBlockedAgentTimelineEntries/, "Local-project blockers must mark their typed turn before appending the waiting confirmation"));
checkMessage(requireWithin(minimalAgentPanelSource, /if \(!userIntent\) \{[\s\S]*return;[\s\S]*\}[\s\S]*setActiveComposerTurnIntent\(userIntent\)[\s\S]*if \(isSaveDirectorSkillIntent\(userIntent\)\)/, "Preparing a normal typed turn must update the current Agent turn before staging or clearing old confirmations"));
checkMessage(requireWithin(minimalAgentPanelSource, /function minimalAgentMessagesFromTimelineEntries\(entries: VibeAgentTimelineEntry\[\]\)[\s\S]*latestUserIntent = cleanMinimalAgentMessageCopy\(entry\.body\)[\s\S]*revisionUserIntent: latestUserIntent/, "Agent timeline confirmation cards must keep the original user wording for revise actions"));
checkMessage(requireWithin(minimalAgentPanelSource, /const fullAgentThreadMessages: MinimalAgentMessage\[\] = minimalAgentMessagesFromTimelineEntries\(visibleAgentTimelineEntries\)[\s\S]*if \(!visibleAgentTimelineEntries\.length && showAgentNote\)/, "Agent message flow must use focused timeline entries so stale pending confirmations cannot hide the current plan card"));
checkMessage(requireWithin(minimalAgentPanelSource, /prepareChange[\s\S]*setPreparedContext\(finalPreparedSelection\)[\s\S]*setPlanPhase\("review"\)[\s\S]*setText\(""\)[\s\S]*setAttachments\(\[\]\)[\s\S]*fileInputRef\.current\.value = ""/, "After a typed Agent message is accepted, the composer must clear text, attachments, and the file input"));
checkMessage(requireWithin(minimalAgentPanelSource, /点发送或 Cmd Enter，交给 AI 导演整理/, "Bottom composer must keep the typed-input action hint concise"));
checkMessage(requireWithin(minimalAgentPanelSource, /const agentNextActionAvailable = Boolean\([\s\S]*!hasComposerInput[\s\S]*agentCurrentTaskProjection\.requiresConfirmation[\s\S]*primaryLabel !== "发送"[\s\S]*!readOnlyStatusInspection/, "Agent next actions must be detected from the projected confirmation boundary separately from the bottom send button"));
checkMessage(requireWithin(minimalAgentPanelSource, /const footerPrimaryLabel = isPreparingPlan \? "整理中" : "发送"[\s\S]*const footerPrimaryAriaLabel = sendAriaLabel/, "Bottom composer primary button must stay a send entry instead of becoming the workflow confirmation button"));
checkMessage(requireWithin(stylesSource, /\.minimal-agent-footer-copy[\s\S]*text-overflow:\s*ellipsis/, "Bottom composer primary-button explanation must stay compact and non-overlapping"));
checkMessage(requireWithin(stylesSource, /\.minimal-agent-input-footer\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\) max-content;[\s\S]*grid-template-areas:[\s\S]*"file action"[\s\S]*"copy copy"/, "Bottom Agent composer footer must reserve a dedicated visible primary-action area"));
checkMessage(requireWithin(stylesSource, /\.director-bottom-composer \.minimal-agent-input\s*\{[\s\S]*overflow-x:\s*hidden;[\s\S]*overflow-y:\s*auto;/, "Bottom Agent composer must prevent horizontal overflow from hiding the primary action"));
checkMessage(requireWithin(stylesSource, /\.new-video-composer-bar\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\) max-content;[\s\S]*grid-template-areas:[\s\S]*"file action"[\s\S]*"copy copy"/, "New project composer footer must reserve a dedicated visible primary-action area"));
checkMessage(requireWithin(stylesSource, /\.minimal-agent-input-footer,[\s\S]*\.new-video-bottom-portal \.new-video-composer-bar\s*\{[\s\S]*grid-template-areas:[\s\S]*"file action"[\s\S]*"copy copy"/, "Bottom composers must keep file and primary action on the first row so the send button cannot be pushed offscreen"));
checkMessage(requireWithin(stylesSource, /\.minimal-agent-send-button,[\s\S]*\.new-video-primary-action\s*\{[\s\S]*grid-area:\s*action/, "Bottom composers must reserve a dedicated visible action area for send/confirm"));
check(!/\.minimal-agent-suggested-button/.test(stylesSource), "Bottom Agent composer must not keep stale suggested-action button styles");
checkMessage(requireWithin(stylesSource, /\.creator-desk-panels\s*\{[\s\S]*position:\s*sticky/, "Creator desk must promote the next Agent step into the main workspace"));
checkMessage(requireWithin(stylesSource, /\.creator-step-cta/, "Creator desk must expose a dedicated next-step status area"));
checkMessage(requireWithin(stylesSource, /\.creator-agent-confirmation-handoff[\s\S]*grid-template-columns:\s*120px[\s\S]*\.creator-agent-current-task[\s\S]*grid-template-columns:\s*48px/, "Creator desk must style the compact confirmation handoff separately from the normal four-part current Agent task"));
checkMessage(requireWithin(creatorDeskPanelsSource, /showAgentReasoningDisclosure && \([\s\S]*creator-status-details creator-agent-reasoning[\s\S]*reasoningDisclosureLabel[\s\S]*creator-preflight-strip[\s\S]*creator-desk-details/, "Creator desk must put process and full details behind one adaptive Agent disclosure, hidden while a right-side confirmation owns the action or is being edited"));
checkMessage(requireWithin(stylesSource, /\.creator-status-details:not\(\[open\]\) \.creator-preflight-strip,[\s\S]*\.creator-status-details:not\(\[open\]\) \.creator-desk-details\s*\{[\s\S]*display:\s*none/, "Creator desk process and full details must stay collapsed by default"));
checkMessage(requireWithin(creatorDeskPanels, /creator-review-shortcuts[\s\S]*优先复核/, "Creator desk review shortcut must be visible outside the process details"));
checkMessage(requireWithin(creatorDeskPanelsSource, /const showProjectInbox = projectInbox\.totalCount > 0 && !submitVideoCommandVisible && !primaryFlowTakingFocus[\s\S]*const projectInboxDefaultOpen = showProjectInbox && projectInbox\.needsReviewCount > 0 && reviewShortcutItems\.length === 0[\s\S]*key=\{`project-inbox-\$\{projectInboxDefaultOpen \? "open" : "closed"\}`\}[\s\S]*open=\{projectInboxDefaultOpen\}/, "Creator desk should collapse the full material inbox when a shorter review shortcut is available or video/export is active"));
checkMessage(requireWithin(stylesSource, /\.director-detail-disclosure/, "Director detail sections must have a compact disclosure shell"));
checkMessage(requireWithin(stylesSource, /\.minimal-director\.composer-only \.new-video-start > summary\s*\{[\s\S]{0,80}display:\s*none/, "Composer-only mode must hide only the outer NewVideoStart summary"));
check(!/\.minimal-director\.composer-only \.new-video-start summary\s*\{[\s\S]{0,80}display:\s*none/.test(stylesSource), "Composer-only mode must not hide nested draft details like research actions");
checkMessage(requireWithin(minimalDirectorStatusDot, /state\.detail[\s\S]*<small>/, "MinimalDirectorStatusDot must show the current project/status detail"));
checkMessage(requireWithin(stylesSource, /\.minimal-director-status small[\s\S]*text-overflow:\s*ellipsis/, "MinimalDirectorStatusDot detail must be compact and non-overlapping"));
checkMessage(requireWithin(newVideoStart, /composerDisabledReason/, "NewVideoStart composer must explain why send is disabled"));
checkMessage(requireWithin(newVideoStart, /composerHelper/, "NewVideoStart composer must keep helper copy contextual"));
checkMessage(requireWithin(newVideoStart, /title=\{composerPrimaryTitle\}/, "NewVideoStart send action should expose disabled reason or the current bottom action"));
checkMessage(requireWithin(newVideoStart, /onClick=\{composerConfirmsDraft \? \(\) => \{ void confirmDraft\(\); \} : submitComposer\}/, "NewVideoStart bottom action must confirm a ready draft instead of duplicating a second top CTA"));
checkMessage(requireWithin(newVideoStartSource, /function isDraftConfirmationIntent/, "NewVideoStart ready draft must classify natural-language confirmation"));
checkMessage(requireWithin(newVideoStart, /isDraftConfirmationIntent\(discussionFeedback\)/, "NewVideoStart ready draft must route confirmation text through the composer"));
checkMessage(requireWithin(newVideoStart, /isDraftConfirmationIntent\(commandText\)[\s\S]*showNoReadyDraftNotice\(commandText\)/, "NewVideoStart must not treat confirmation-only Agent commands as a fresh script when no draft is ready"));
checkMessage(requireWithin(newVideoStart, /草案没问题就确认，或直接说“没问题，继续”/, "NewVideoStart ready draft helper must explain natural-language confirmation"));
checkMessage(requireWithin(newVideoStart, /planSummaryActionHint[\s\S]*storyboardPlanningStatus === "running"[\s\S]*草案出来后可确认[\s\S]*确认这版故事[\s\S]*new-video-next-hint[\s\S]*planSummaryActionHint/, "NewVideoStart plan summary must point to the current composer state instead of exposing a premature confirmation action"));
checkMessage(requireWithin(newVideoStart, /const pendingDraftOfficialStoryCopy = storyboardRows\.length > 0[\s\S]*确认后这 \$\{storyboardRows\.length\} 个镜头会成为正式故事[\s\S]*storyboardPlanningRunning \? "正在整理镜头" : "待确认草案"[\s\S]*storyboardPlanningRunning \? "AI 还在整理镜头，完成后再确认。" : pendingDraftOfficialStoryCopy/, "NewVideoStart plan summary must not label a running storyboard plan as ready to confirm and must describe pending draft shots without contradicting the left draft count"));
check(!/确认后左侧故事数才会更新/.test(newVideoStart), "NewVideoStart pending-draft copy must not contradict the visible left-side draft count");
checkMessage(requireWithin(minimalAgentPanelSource, /const readyNewVideoDraftForAgent = Boolean\([\s\S]*runtimeState\.storyFlow\.shots\.length === 0[\s\S]*!newVideoDraftBusyForAgent[\s\S]*newVideoDraftReadyForAgent/, "Right Agent composer must use the structured new-video ready state"));
check(!/newVideoDraftStatusCopy|newVideoDraftTimelineCopy/.test(minimalAgentPanelSource), "Right Agent draft readiness must not scrape display copy or timeline prose");
checkMessage(requireWithin(minimalAgentPanelSource, /const savedStoryReferencePlanStatusActive = Boolean\([\s\S]*localProjectReady[\s\S]*runtimeProjectRootIsLocalFolder\(runtimeState\.project\.root\)[\s\S]*runtimeState\.storyFlow\.shots\.length > 0[\s\S]*const referencePlanningContextActive = referencePlanningFocusActive \|\| referencePlanningGenerationIntentActive[\s\S]*const storyReferenceDeferredFocusActive = Boolean\([\s\S]*savedStoryReferencePlanStatusActive[\s\S]*const storyReferencePlanOnlyIntentActive = Boolean\([\s\S]*!referencePlanningGenerationRequestText\(referencePlanningIntentText\)[\s\S]*const storyReferencePlanningIntentActive = Boolean\([\s\S]*savedStoryReferencePlanStatusActive \|\| storyReferencePlanOnlyIntentActive[\s\S]*const composerVideoIntentShouldConfirmReferencesFirst = Boolean\([\s\S]*intentRequestsVideoSubmitWork\(referencePlanningIntentText\)[\s\S]*const baseStoryLevelReferenceContextActive = referencePlanningContextActive[\s\S]*storyReferenceDeferredFocusActive[\s\S]*storyReferencePlanningIntentActive[\s\S]*composerVideoIntentShouldConfirmReferencesFirst[\s\S]*const storyLevelReferenceContextActive = baseStoryLevelReferenceContextActive \|\| pendingReferenceGenerationContextActive/, "Right Agent selection summary must keep structured saved-story, plan-only reference, and send-video preflight scope at story level"));
checkMessage(requireWithin(minimalAgentPanelSource, /const savedStoryIdleReferenceFocusActive = Boolean\([\s\S]*referencePlanningFocusActive[\s\S]*savedStoryReferencePlanStatusActive[\s\S]*storyShotCountRevisionPlaceholderActive = Boolean\([\s\S]*!newStoryComposerScopeActive[\s\S]*pendingStoryShotCountRevisionConfirmationCount[\s\S]*restoredAgentStagedPlanDraft\.action\?\.kind === "revise_story_or_shot"[\s\S]*const inputPlaceholder = newStoryComposerScopeActive[\s\S]*继续说这个新视频怎么拍[\s\S]*storyShotCountRevisionPlaceholderActive[\s\S]*继续说这次重排怎么改[\s\S]*localProjectSetupConfirmationContextActive[\s\S]*storyLevelReferenceContextActive[\s\S]*savedStoryIdleReferenceFocusActive[\s\S]*继续修改故事，或说“开始补参考”[\s\S]*继续说参考怎么安排/, "Right Agent empty composer placeholder must use structured saved-story and shot-edit state before save-location and reference prompts"));
checkMessage(requireWithin(minimalAgentPanelSource, /const referencePlanningSurfaceFocusActive = Boolean\([\s\S]*referencePlanningContextActive[\s\S]*text\.trim\(\)[\s\S]*pendingReferenceGenerationConfirmationChips\.length[\s\S]*onReferencePlanningFocusChange\?\.\(referencePlanningSurfaceFocusActive\)/, "Right Agent must not let reference-plan focus override the main workbench while the user is editing a reference-generation confirmation"));
checkMessage(requireWithin(minimalAgentPanelSource, /const storyShotCountRevisionIntentCount = requestedStoryboardShotCountFromIntent\(referencePlanningIntentText\)[\s\S]*const storyShotCountRevisionIntentActive = Boolean\([\s\S]*!attachments\.length[\s\S]*storyShotCountRevisionIntentCount[\s\S]*const pendingStoryShotCountRevisionConfirmationCount[\s\S]*const restoredStoryShotCountRevisionCount[\s\S]*const storyShotCountRevisionFocusCount = storyShotCountRevisionIntentCount[\s\S]*pendingStoryShotCountRevisionConfirmationCount[\s\S]*restoredStoryShotCountRevisionCount[\s\S]*baseDisplayedScopeLabel[\s\S]*storyShotCountRevisionFocusActive[\s\S]*"当前故事"[\s\S]*baseDisplayedSelectionHint[\s\S]*storyShotCountRevisionFocusActive[\s\S]*重排为 \$\{storyShotCountRevisionFocusCount\} 个镜头[\s\S]*displayedSelectionChips[\s\S]*storyShotCountRevisionFocusActive[\s\S]*目标镜头[\s\S]*storyShotCountRevisionFocusCount/, "Right Agent composer must show explicit saved-story shot-count revisions as current-story work with target shot count, not as selected-shot or reference-plan work"));
checkMessage(requireWithin(minimalAgentPanelSource, /newVideoAgentSelectionContext\?: \{[\s\S]*title: string[\s\S]*chips: Array<\{ label: string; value: string \}>[\s\S]*const visibleExplicitAgentSelectionContext = newVideoAgentSelectionContext \|\| explicitAgentSelectionContextFromTimeline[\s\S]*mergeVibeAgentTimelineEntries\(visibleAgentTimelineEntries, restoredAgentTimelineEntries \|\| \[\]\)[\s\S]*const explicitTimelineSelectionContext = visibleExplicitAgentSelectionContext[\s\S]*const pendingDraftSelectionContext = pendingDraftShotCount \? explicitTimelineSelectionContext : undefined[\s\S]*const pendingDraftSelectionNextLabel = composerPermissionContract[\s\S]*更新工作方式[\s\S]*hasVisibleComposerInput[\s\S]*发送修改说明[\s\S]*newVideoDraftBusyForAgent[\s\S]*等草案出来后复核[\s\S]*const pendingDraftSelectionHint = composerPermissionContract[\s\S]*只更新工作方式为[\s\S]*不改草案，不生成参考，也不提交视频[\s\S]*hasVisibleComposerInput[\s\S]*正在修改当前草案；发送后先更新草案，不会生成参考或提交视频[\s\S]*const pendingDraftSelectionChips = pendingDraftSelectionContext\?\.chips\?\.length[\s\S]*pendingDraftSelectionNextLabel[\s\S]*shouldUseExplicitTimelineSelectionContext = Boolean\(explicitTimelineSelectionContext && !composerPermissionContract && !pendingDraftShotCount && !storyLevelReferenceContextActive && !skillSaveContextActive\)[\s\S]*visibleCompactSelectionHint = pendingDraftShotCount[\s\S]*pendingDraftSelectionHint[\s\S]*composerPermissionContract[\s\S]*只更新工作方式为[\s\S]*selectionContextTitle = exportResultIsPrimary \|\| videoResultIsPrimary[\s\S]*composerPermissionContract[\s\S]*更新工作方式[\s\S]*displayedSelectionChips = pendingDraftShotCount[\s\S]*pendingDraftSelectionChips[\s\S]*composerPermissionContract[\s\S]*label: "工作方式"[\s\S]*editingSkillSaveConfirmationChips\.length[\s\S]*referencePlanningContextActive[\s\S]*referencePlanningFocusChips[\s\S]*storyReferencePlanningIntentActive[\s\S]*storyReferencePlanningIntentChips[\s\S]*storyReferenceDeferredFocusActive[\s\S]*storyReferenceDeferredChips[\s\S]*shouldUseExplicitTimelineSelectionContext/, "Right Agent selection summary must prioritize selected pending-draft and pure work-mode context before live shot selection"));
checkMessage(requireWithin(minimalAgentPanelSource, /const composerPermissionControlInputActive = Boolean\([\s\S]*isDirectorAgentPermissionControlOnlyIntent\(text\.trim\(\)\)[\s\S]*detectAgentVideoPermissionContract\(text\.trim\(\), localVideoPermissionContract\)[\s\S]*const pendingDraftScopeActive = Boolean\(newVideoDraftShotCountForAgent \|\| newVideoDraftBusyForAgent\)[\s\S]*const pendingDraftScopeLabel = composerPermissionControlInputActive[\s\S]*更新工作方式[\s\S]*text\.trim\(\) \|\| attachments\.length[\s\S]*正在修改草案[\s\S]*newVideoDraftBusyForAgent[\s\S]*正在整理草案[\s\S]*当前故事[\s\S]*const baseDisplayedScopeLabel = composerPermissionControlInputActive[\s\S]*更新工作方式[\s\S]*localProjectSetupConfirmationContextActive[\s\S]*skillSaveContextActive[\s\S]*pendingDraftScopeActive[\s\S]*pendingDraftScopeLabel[\s\S]*storyShotCountRevisionFocusActive/, "Right Agent header scope must stay on pure work-mode, pending draft, edit, or planner focus before falling back to story flow"));
checkMessage(requireWithin(minimalAgentPanelSource, /const latestVisibleAgentUserIntent = \[\.\.\.visibleAgentTimelineEntries\][\s\S]*entry\.type === "user_message"[\s\S]*activeComposerTurnIntent\.trim\(\)[\s\S]*preparedContext\?\.userIntent\?\.trim\(\)[\s\S]*const pendingDraftRevisionBusyForAgent = Boolean\([\s\S]*newVideoDraftBusyForAgent[\s\S]*pendingDraftShotCount[\s\S]*修改这版草案\|修改当前草案\|重排\|改成\\s\*\[0-9０-９\]\{1,3\}\\s\*个镜头[\s\S]*const pendingDraftRevisionBusyReply = pendingDraftRevisionBusyForAgent[\s\S]*title: `重排为 \$\{pendingDraftShotCount\} 个镜头`[\s\S]*这里只更新草案，不生成参考图，也不发送视频[\s\S]*const passiveAgentReply[\s\S]*pendingDraftRevisionBusyReply\?\.title[\s\S]*pendingDraftRevisionBusyReply\?\.body[\s\S]*pendingDraftRevisionBusyReply\?\.facts/, "Right Agent passive reply must preserve a pending-draft revision target while the planner is running"));
checkMessage(requireWithin(minimalAgentPanelSource, /const newStoryComposerScopeActive = Boolean\([\s\S]*text\.trim\(\)[\s\S]*runtimeState\.storyFlow\.shots\.length === 0[\s\S]*directorIntentCanStartNewVideoPlanningWithoutProject\(text\)[\s\S]*baseDisplayedScopeLabel[\s\S]*pendingDraftScopeActive[\s\S]*newStoryComposerScopeActive[\s\S]*"新视频草案"[\s\S]*storyShotCountRevisionFocusActive[\s\S]*baseDisplayedSelectionHint[\s\S]*newStoryComposerScopeActive[\s\S]*点发送后先形成草案[\s\S]*visibleCompactSelectionHint[\s\S]*newStoryComposerScopeActive[\s\S]*点发送后先形成草案[\s\S]*selectionContextTitle[\s\S]*newStoryComposerScopeActive[\s\S]*"新视频草案"[\s\S]*displayedSelectionChips[\s\S]*newStoryComposerScopeActive[\s\S]*label: "范围", value: "新视频草案"[\s\S]*label: "目标镜头"[\s\S]*storyShotCountRevisionIntentCount/, "Right Agent cockpit must show a first typed idea as a new-video draft before shot-count copy can be treated as a saved-story rewrite"));
checkMessage(requireWithin(minimalAgentPanelSource, /const editingReferenceGenerationConfirmationActive = Boolean\([\s\S]*text\.trim\(\)[\s\S]*!attachments\.length[\s\S]*pendingReferenceGenerationConfirmationChips\.length[\s\S]*const editingReferenceGenerationConfirmationChips = editingReferenceGenerationConfirmationActive[\s\S]*修改[\s\S]*正在修改确认[\s\S]*发送前不生成参考图/, "Right Agent must detect when a waiting reference-generation confirmation has been pulled back into the composer for editing"));
checkMessage(requireWithin(minimalAgentPanelSource, /const localProjectSetupConfirmationContextActive = pendingTimelineConfirmationStepForContext === "choose_save_location"[\s\S]*localProjectBusy[\s\S]*!localProjectReady[\s\S]*runtimeState\.storyFlow\.shots\.length > 0[\s\S]*!runtimeProjectRootIsLocalFolder\(runtimeState\.project\.root\)/, "Right Agent save-location busy and unsaved-root state must stay scoped to the current story"));
checkMessage(requireWithin(minimalAgentPanelSource, /const baseDisplayedSelectionHint = composerPermissionControlInputActive[\s\S]*只更新工作方式；不改故事，不生成参考，也不提交视频[\s\S]*localProjectSetupConfirmationContextActive[\s\S]*故事已确认；先选择保存位置[\s\S]*editingReferenceGenerationConfirmationActive[\s\S]*正在修改「确认生成参考」；发送后会重新判断[\s\S]*pendingReferenceGenerationConfirmationChips\.length[\s\S]*当前看整个故事；确认卡会说明生成范围和边界。[\s\S]*referencePlanningContextActive[\s\S]*参考计划已准备；真正生成参考前会再确认[\s\S]*storyReferencePlanningIntentActive[\s\S]*我会先准备参考计划；不会生成图片，也不会提交视频[\s\S]*storyReferenceDeferredFocusActive[\s\S]*故事已保存；可以继续修改故事，或说“开始补参考”/, "Right Agent composer hint must show pure work-mode, save-location, edited reference-confirmation, pending reference-confirmation, and typed/saved-story reference-entry copy before falling back to selected-shot copy"));
checkMessage(requireWithin(minimalAgentPanelSource, /const visibleCompactSelectionHint = pendingDraftShotCount[\s\S]*editingReferenceGenerationConfirmationActive[\s\S]*正在修改「确认生成参考」；发送后会重新判断[\s\S]*pendingReferenceGenerationConfirmationChips\.length[\s\S]*当前看整个故事；确认卡会说明生成范围和边界。[\s\S]*referencePlanningContextActive[\s\S]*参考计划已准备；真正生成前会再确认/, "Right Agent visible header hint must prefer edited reference-confirmation copy before stale pending-confirmation or plan-only reference-entry copy"));
checkMessage(requireWithin(minimalAgentPanelSource, /const projectedVideoQueryContextActive = Boolean\([\s\S]*!hasVisibleComposerInput[\s\S]*videoQueryMode[\s\S]*agentCurrentTaskProjection\.step === "submit_video"[\s\S]*agentCurrentTaskProjection\.label === "查询视频结果"[\s\S]*const projectedVideoQuerySelectionChips = projectedVideoQueryContextActive[\s\S]*label: "任务", value: agentCurrentTaskProjection\.label[\s\S]*label: "提交", value: "不会重复提交"[\s\S]*visibleCompactSelectionHint = pendingDraftShotCount[\s\S]*projectedVideoQueryContextActive[\s\S]*等待确认[\s\S]*displayedSelectionChips = pendingDraftShotCount[\s\S]*projectedVideoQuerySelectionChips\.length[\s\S]*projectedVideoQuerySelectionChips/, "Right Agent running-query summary must follow the current task projection instead of stale story or export context"));
checkMessage(requireWithin(minimalAgentPanelSource, /const selectionContextTitle = exportResultIsPrimary \|\| videoResultIsPrimary[\s\S]*pendingReferenceGenerationConfirmationChips\.length[\s\S]*\? "当前故事"[\s\S]*referencePlanningContextActive/, "Right Agent pending reference-generation confirmation must title the visible scope as current story, not a generic current selection"));
checkMessage(requireWithin(minimalAgentPanelSource, /const pendingReferenceGenerationPreviewProjection = pendingReferenceGenerationConfirmationChips\.length[\s\S]*等待确认生成参考[\s\S]*参考不完整[\s\S]*图片服务未连接[\s\S]*不提交视频[\s\S]*const displayedPrototypeAgentProjection = pendingReferenceGenerationPreviewProjection \|\| prototypeAgentProjection[\s\S]*const showDisplayedPrototypeAgentProjection = Boolean\([\s\S]*displayedPrototypeAgentProjection[\s\S]*!visibleConfirmationLocksWorkMode[\s\S]*!composerEditingPendingConfirmation[\s\S]*!localProjectSetupConfirmationContextActive[\s\S]*showDisplayedPrototypeAgentProjection && displayedPrototypeAgentProjection && \([\s\S]*aria-label="创作者预览状态"[\s\S]*displayedPrototypeAgentProjection\.statusLabel/, "Right Agent creator preview badges must use current confirmation state only outside visible confirmation-card handoff, confirmation-editing focus, and save-location confirmation focus"));
checkMessage(requireWithin(minimalAgentPanelSource, /footerSelectionTargetCopy = hasActiveSelection && !composerPermissionContract && !composerToolIntentShouldYieldToProjectEditConfirmation && !storyShotCountRevisionFocusActive && !storyLevelReferenceContextActive && !localProjectSetupConfirmationContextActive && !skillSaveContextActive[\s\S]*你说“这个”时，我会理解为：\$\{displayedCompactScopeLabel\}/, "Right Agent composer footer must suppress selected-shot deictic copy during pure work-mode, story-level reference planning, shot-count restructuring, save-location, save-Skill confirmation/editing, or pending project-edit blocker focus"));
checkMessage(requireWithin(minimalAgentPanelSource, /agentShotSwitcherItems\.length > 1 && !composerPermissionContract && !composerToolIntentShouldYieldToProjectEditConfirmation && !storyShotCountRevisionFocusActive && !storyLevelReferenceContextActive && !localProjectSetupConfirmationContextActive && !skillSaveContextActive/, "Right Agent must hide the shot switcher while pure work-mode, story-level reference planning, shot-count restructuring, save-location, save-Skill confirmation/editing, or pending project-edit blocker focus owns the thread"));
checkMessage(requireWithin(directorMode, /newVideoDraftReadyForAgent=\{showNewVideoStart && newVideoStatus\?\.status === "ready"\}[\s\S]*newVideoAgentSelectionContext=\{showNewVideoStart \? newVideoStatus\?\.agentSelectionContext : undefined\}/, "DirectorModeShell must bridge selected new-video draft/material context into the right Agent rail"));
checkMessage(requireWithin(minimalAgentPanelSource, /isNewVideoDraftConfirmationRouteIntent\(userIntent\)[\s\S]*await onStartNewVideoDraftFromAgent\(userIntent\)[\s\S]*!localProjectReadyForTools/, "Right Agent composer must prioritize natural-language draft confirmations before local-project blocking"));
checkMessage(requireWithin(minimalAgentPanelSource, /const pendingReferenceGenerationContextActive = Boolean\([\s\S]*pendingReferenceGenerationConfirmationChips\.length[\s\S]*restoredAgentStagedPlanDraft\?\.status === "active"[\s\S]*restoredAgentStagedPlanDraft\.action\?\.kind === "prepare_reference_generation"/, "Right Agent composer must keep restored reference-generation confirmations in the current-project context"));
checkMessage(requireWithin(minimalAgentPanelSource, /const persistedStoryContextActive = Boolean\([\s\S]*runtimeState\.storyFlow\.shots\.length > 0[\s\S]*projectObservation\?\.story\.status === "selected"/, "Right Agent composer must keep visible story context available even while confirmation cards are being edited"));
checkMessage(requireWithin(minimalAgentPanelSource, /const currentProjectHasStoryContext = Boolean\([\s\S]*pendingReferenceGenerationContextActive[\s\S]*persistedStoryContextActive/, "Right Agent composer must know when the visible project or pending reference confirmation already belongs to the current story"));
check(!/currentProjectHasStoryContext[\s\S]{0,240}projectObservation\?\.story\.status === "drafted"/.test(minimalAgentPanelSource), "Right Agent ready-draft confirmation must not treat an unconfirmed drafted story as an existing project story");
checkMessage(requireWithin(minimalAgentPanelSource, /readyNewVideoDraftForAgent[\s\S]*runtimeState\.storyFlow\.shots\.length === 0[\s\S]*onStartNewVideoDraftFromAgent[\s\S]*runtimeState\.storyFlow\.shots\.length === 0[\s\S]*shouldRouteToReadyNewVideoDraft\(userIntent\)[\s\S]*await onStartNewVideoDraftFromAgent\(userIntent\)[\s\S]*runtimeState\.storyFlow\.shots\.length === 0[\s\S]*!currentProjectHasStoryContext[\s\S]*intentCanStartNewVideoPlanningWithoutProject\(userIntent\)/, "Right Agent composer must route ready-draft confirmation, feedback, or first-story input into NewVideoStart before local-project blocking, but never over an existing story"));
checkMessage(requireWithin(minimalAgentPanelSource, /const activeNewVideoDraftConfirmation = readyNewVideoDraftForAgent/, "Right Agent ready-draft action must use the same status/timeline readiness source as natural-language confirmation"));
checkMessage(requireWithin(minimalAgentPanelSource, /function agentCurrentTaskMessageIsStructuredNewVideoDraftConfirmation\(message: MinimalAgentMessage\)[\s\S]*minimalAgentMessageIsWaitingConfirmation\(message\)[\s\S]*agentCurrentTaskStepFromMessage\(message\) === "confirm_story"[\s\S]*message\.id\.startsWith\("new_video_confirmation_"\)[\s\S]*const timelineNewVideoDraftConfirmationReady = Boolean\([\s\S]*agentCurrentTaskMessageIsStructuredNewVideoDraftConfirmation\(visibleTimelineConfirmationMessage\)[\s\S]*const visibleNewVideoDraftConfirmation = timelineNewVideoDraftConfirmationReady/, "Right Agent must turn only a structured new-video confirmation into an executable ready-draft action"));
checkMessage(requireWithin(minimalAgentPanelSource, /if \(agentCurrentTaskProjection\.step === "confirm_story"\) \{[\s\S]*const confirmDraftFromAgent = onConfirmNewVideoDraftFromAgent \|\| \(\(\) => onStartNewVideoDraftFromAgent\?\.\(NEW_VIDEO_DRAFT_CONFIRM_LABEL\)\)[\s\S]*label: agentCurrentTaskProjection\.label[\s\S]*statusLine: disabled \? disabledReason : `下一步：\$\{agentCurrentTaskProjection\.label\}`[\s\S]*void confirmDraftFromAgent\(\)/, "Projection-selected new-video drafts must expose the dedicated right-rail confirmation action"));
checkMessage(requireWithin(minimalAgentPanelSource, /newVideoDraft:[\s\S]*status: newVideoDraftReadyForAgent[\s\S]*\? "ready"[\s\S]*const primaryOperation = \(\(\) => \{[\s\S]*agentCurrentTaskProjection\.step === "choose_save_location"[\s\S]*agentCurrentTaskProjection\.step === "confirm_story"/, "Ready draft and save-location state must enter one projected primary-operation switch instead of competing fallbacks"));
checkMessage(requireWithin(minimalAgentPanelSource, /function minimalAgentMessageIsNewVideoDraftConfirmation\([\s\S]*message\.id\.startsWith\("new_video_confirmation_"\)[\s\S]*isNewVideoDraftConfirmationLabel\(action\.label\)/, "Recovered timeline story confirmations must self-identify as new-video draft confirmations"));
checkMessage(requireWithin(minimalAgentPanelSource, /const visibleConfirmationActionAvailable = agentNextActionAvailable[\s\S]*minimalAgentMessageRequestsActionConfirmation\(message\) && message\.id === activeConfirmationMessageId && !minimalAgentMessageRequestsSkillSave\(message\)[\s\S]*const confirmationIsNewVideoDraftAction = agentCurrentTaskProjection\.step === "confirm_story"[\s\S]*const confirmationIsLocalProjectSetup = agentCurrentTaskProjection\.step === "choose_save_location"[\s\S]*const confirmationUsesPreparedProjectEdit = agentCurrentTaskProjection\.step === "confirm_story"[\s\S]*const confirmationUsesPrimaryAction = \[[\s\S]*\.includes\(agentCurrentTaskProjection\.step\)[\s\S]*const confirmationButtonLabel = confirmationAction\.label[\s\S]*runConfirmationAction[\s\S]*confirmDraftFromAgent[\s\S]*startLocalProjectSetupFromMessage[\s\S]*confirmPlan\(\)[\s\S]*handleNext\(\)[\s\S]*prepareChange\(agentMessageConfirmationIntent\(message,\s*confirmationAction\.label\),\s*currentComposerSelectionOverride\(\)\)/, "The projection-selected confirmation card must route every task through its existing dispatcher"));
checkMessage(requireWithin(minimalAgentPanelSource, /const statusReadyNewVideoDraftConfirmation = Boolean\([\s\S]*!visibleTimelineConfirmationMessage[\s\S]*newVideoDraftReadyForAgent[\s\S]*const footerNewVideoDraftConfirmationReady = Boolean\([\s\S]*timelineNewVideoDraftConfirmationReady[\s\S]*statusReadyNewVideoDraftConfirmation/, "Footer must recognize ready new-video drafts only from structured state or a structured timeline confirmation"));
checkMessage(requireWithin(minimalAgentPanelSource, /const footerNewVideoDraftConfirmationReady = Boolean\([\s\S]*timelineNewVideoDraftConfirmationReady[\s\S]*statusReadyNewVideoDraftConfirmation[\s\S]*const showFooterNextActionButton = \(agentNextActionAvailable && !hasComposerInput\) \|\| footerNewVideoDraftConfirmationReady/, "Footer must detect structured ready new-video drafts for message-flow confirmation even when the normal next action is not available"));
checkMessage(requireWithin(minimalAgentPanelSource, /const footerNewVideoDraftConfirmationId = `footer_action_new_video_draft_[\s\S]*id: footerNewVideoDraftConfirmationId[\s\S]*title: "建议行动：确认这版故事"[\s\S]*确认后只保存故事[\s\S]*toolName: "write_project"[\s\S]*确认后保存故事/, "Ready new-video drafts must appear as a current-turn Agent confirmation message instead of a footer workflow button"));
checkMessage(requireWithin(minimalAgentPanelSource, /if \(hasComposerInput\) return undefined[\s\S]*id: footerNewVideoDraftConfirmationId[\s\S]*if \(showAgentNote \|\| showAgentResultNote \|\| preparedContext\?\.userIntent\?\.trim\(\)\) return undefined;[\s\S]*if \(projectRequiredForWorkflow\) \{[\s\S]*id: "footer_action_project_setup"/, "Ready new-video draft confirmation must create a visible Agent card while prepared current turns suppress local-project setup suggestions"));
checkMessage(requireWithin(minimalAgentPanelSource, /function minimalAgentFooterConfirmationHasExistingVisiblePeer[\s\S]*footerMessage\.id\.startsWith\("footer_action_"\)[\s\S]*minimalAgentConfirmationRequestsSameAction\(candidate,\s*footerMessage\)[\s\S]*const footerActionMatchesProjectedCurrentTask = Boolean\([\s\S]*agentCurrentTaskStepFromMessage\(footerActionConfirmationMessage\) === agentCurrentTaskProjection\.step[\s\S]*const shouldAppendFooterActionConfirmationMessage = Boolean\([\s\S]*footerActionMatchesProjectedCurrentTask[\s\S]*!minimalAgentFooterConfirmationHasExistingVisiblePeer\(fullAgentThreadMessages,\s*footerActionConfirmationMessage\)[\s\S]*fullAgentThreadMessages\.push\(footerActionConfirmationMessage\)/, "Ready draft fallback confirmation must match the projected step and avoid duplicating an equivalent visible card"));
checkMessage(requireWithin(minimalAgentPanelSource, /id: "footer_action_export"[\s\S]*title: "建议行动：导出交付包"[\s\S]*确认前不会写入导出文件[\s\S]*toolName: "export_project"[\s\S]*actionKind: "prepare_export"[\s\S]*label: "包含", value: EXPORT_PACKAGE_CONTENTS_LABEL/, "Ready export work must appear as an Agent confirmation message with local package contents instead of only a topbar export button"));
check(!/value: "视频、项目包、报告"/.test(minimalAgentPanelSource), "Default Agent export confirmation copy must not imply missing videos are ready final deliverables");
checkMessage(requireWithin(minimalAgentPanelSource, /directorIntentStartsFreshVideoDraft\(value\)/, "Right Agent composer must recognize explicit fresh-video requests through the shared core intent helper"));
checkMessage(requireWithin(minimalAgentPanelSource, /function intentContinuesCurrentProject\(value: string\)[\s\S]*composerIntentTargetsProjectScope\(text\)[\s\S]*storyShotCountRevisionForCurrentStory \|\| intentContinuesCurrentProject\(userIntent\)[\s\S]*onStartNewVideoDraftFromAgent && !currentProjectContinueIntent && !storyShotCountRevisionForCurrentStory && !planOnlyReferenceFollowupForCurrentStory && intentStartsFreshVideoDraft\(userIntent\)/, "Whole-story or whole-shot revision wording must stay with the current project before fresh-video routing can run"));
checkMessage(requireWithin(minimalAgentPanelSource, /onStartNewVideoDraftFromAgent && !currentProjectContinueIntent && !storyShotCountRevisionForCurrentStory && !planOnlyReferenceFollowupForCurrentStory && intentStartsFreshVideoDraft\(userIntent\)[\s\S]*setStatus\("开始新草案"\)[\s\S]*await onStartNewVideoDraftFromAgent\(userIntent\)[\s\S]*readyNewVideoDraftForAgent/, "Explicit fresh-video requests must reach the new-video draft intake before current-project, selected-shot, shot-count restructuring, or plan-only reference planning"));
checkMessage(requireWithin(directorMode, /agentNewVideoDraftActive[\s\S]*const showNewVideoStart = !projectReady \|\| shots\.length === 0 \|\| agentNewVideoDraftActive/, "Director shell must let the right Agent temporarily open a new-video draft even when the current project already has shots"));
checkMessage(requireWithin(directorMode, /const restoredAgentStagedPlanTakingFocus = Boolean\([\s\S]*restoredAgentStagedPlanDraft\?\.status === "active"[\s\S]*restoredAgentStagedPlanDraft\.action\?\.status === "staged"[\s\S]*const restoredNewVideoDraftActive = Boolean\(restoredNewVideoDraft\) && !restoredAgentStagedPlanTakingFocus[\s\S]*const showNewVideoStart = !projectReady \|\| shots\.length === 0 \|\| agentNewVideoDraftActive \|\| restoredNewVideoDraftActive/, "Restored staged Agent confirmations must take focus over older new-video draft history so the right rail can restore the confirmation card"));
checkMessage(requireWithin(directorMode, /function startNewVideoFromAgent[\s\S]*setAgentIntakeCommand\(\{[\s\S]*projectTargetMode:\s*"new_project"/, "Right Agent fresh-video requests must be saved as a new project instead of silently reusing the currently selected project"));
checkMessage(requireWithin(directorMode, /setAgentNewVideoDraftActive\(true\)[\s\S]*setAgentIntakeCommand/, "Starting a new video from the right Agent must activate the central draft surface before passing the intake command"));
checkMessage(requireWithin(directorMode, /const result = await onNewVideoDraftConfirmed\?\.\(draft,\s*context\)[\s\S]*result !== false[\s\S]*setAgentNewVideoDraftActive\(false\)/, "Confirmed Agent-started drafts must return the center surface to the normal project story flow"));
checkMessage(requireWithin(directorMode, /newVideoDraftReadyForAgent=\{showNewVideoStart && newVideoStatus\?\.status === "ready"\}/, "Director shell must expose ready new-video drafts to the right Agent composer"));
checkMessage(requireWithin(directorMode, /onStagePrototypeAgentPlan=\{showNewVideoStart \? undefined : onStagePrototypeAgentPlan\}/, "Director shell must not expose the old project Agent planner while the new-video intake surface is active"));
checkMessage(requireWithin(minimalAgentPanelSource, /buildDirectorFeedbackRecompile/, "MinimalAgentPanel must compile selected-shot feedback into a structured recompile"));
checkMessage(requireWithin(minimalAgentPanelSource, /onDirectorFeedbackConfirmed/, "MinimalAgentPanel must confirm structured feedback through the Project.vibe callback"));
checkMessage(requireWithin(minimalAgentLanguageSurface, /参考 \/ 视频安排/, "MinimalAgentPanel feedback plan must name reference/video recompile targets"));
checkMessage(requireWithin(minimalAgentLanguageSurface, /不会开始生成|不会生成/, "MinimalAgentPanel feedback plan must explain recompile without starting generation"));
checkMessage(requireWithin(minimalAgentLanguageSurface, /当前选择/, "MinimalAgentPanel feedback must keep a selected-object context"));
checkMessage(requireWithin(minimalAgentPanelSource, /const emptyNewVideoEntryContextActive = Boolean\([\s\S]*projectStatusView\?\.stage === "准备开始"[\s\S]*projectStatusView\.nextAction === "发送后整理故事和镜头"[\s\S]*emptyNewVideoEntryContextActive[\s\S]*先整理故事和镜头；草案出来后可点镜头修改[\s\S]*emptyNewVideoEntryContextActive[\s\S]*"新视频入口"[\s\S]*emptyNewVideoEntryContextActive[\s\S]*\? "当前范围"/, "Empty new-video Agent cockpit must show the current entry scope instead of generic how-to copy"));
checkMessage(requireWithin(minimalAgentPanelSource, /已选中内容，直接说改法/, "MinimalAgentPanel selected-object footer copy must be clear"));
checkMessage(requireWithin(minimalAgentLanguageSurface, /写一句想法，或拖入脚本、图片、声音/, "MinimalAgentPanel must keep one normal chat entry for project-wide feedback"));
checkMessage(requireWithin(minimalAgentLanguageSurface, /说这块怎么改/, "MinimalAgentPanel selected input placeholder"));
checkMessage(requireWithin(stylesSource, /\.creator-desk-panels\.compact\s*\{[\s\S]*pointer-events:\s*none[\s\S]*\.creator-desk-panels\.compact button,[\s\S]*\.creator-desk-panels\.compact summary,[\s\S]*pointer-events:\s*auto/, "Creator status panel must not block clicks on underlying shots while keeping real controls clickable"));
checkMessage(requireWithin(minimalAgentPanelSource, /textareaRef\.current\?\.focus/, "MinimalAgentPanel should focus the composer after selection or file add"));
checkMessage(requireWithin(minimalAgentPanelSource, /const agentNextActionAvailable = Boolean\([\s\S]*!hasComposerInput[\s\S]*agentCurrentTaskProjection\.requiresConfirmation[\s\S]*primaryLabel !== "发送"[\s\S]*!readOnlyStatusInspection/, "MinimalAgentPanel must detect empty-composer next actions from projection without converting the send button into that action"));
checkMessage(requireWithin(minimalAgentPanelSource, /const sendAriaLabel = "发送"/, "MinimalAgentPanel send button must keep a stable accessible name; disabled reasons belong in status/title copy"));
checkMessage(requireWithin(minimalAgentPanelSource, /function handleSend\(\)[\s\S]*void prepareChange\(currentTypedIntent \|\| undefined,\s*currentComposerSelectionOverride\(currentTypedIntent\)\)/, "MinimalAgentPanel fixed send button must always route typed text or files to the Agent"));
checkMessage(requireWithin(minimalAgentPanelSource, /className="minimal-agent-send-button"[\s\S]*aria-label=\{footerPrimaryAriaLabel\}[\s\S]*\{footerPrimaryLabel\}/, "MinimalAgentPanel composer must expose one visible primary action button"));
checkMessage(requireWithin(minimalAgentPanelSource, /<textarea[\s\S]*aria-label="和 AI 导演说"[\s\S]*placeholder=\{inputPlaceholder\}/, "MinimalAgentPanel composer textarea must keep a stable Agent label even when placeholder copy changes"));
checkMessage(requireWithin(agentPanelProjectionSource, /agentTimelineEntries\?:\s*VibeAgentTimelineEntry\[\]/, "Agent stage result must carry real Agent timeline entries into the UI contract"));
checkMessage(requireWithin(agentPanelProjectionSource, /PreviewPrototypeAgentDemoResult[\s\S]*agentTimelineEntries\?:\s*VibeAgentTimelineEntry\[\]/, "Confirmed Agent result must carry updated timeline entries back into the UI contract"));
checkMessage(requireWithin(agentPanelProjectionSource, /StagePrototypeAgentPlanResult[\s\S]*agentKernelTurn\?:\s*VibeAgentKernelTurn/, "Agent stage result must carry the structured Kernel turn into the UI contract"));
checkMessage(requireWithin(agentPanelProjectionSource, /PreviewPrototypeAgentDemoResult[\s\S]*agentKernelTurn\?:\s*VibeAgentKernelTurn/, "Confirmed Agent result must carry the structured Kernel turn back into the UI contract"));
checkMessage(requireWithin(appSource, /openProjectAgentTimeline\([\s\S]*runVibeAgentTurn\([\s\S]*previousTimeline:\s*existingAgentTimeline\.timeline[\s\S]*saveProjectAgentTimeline\(/, "App stage plan must restore and save the real Agent timeline sidecar"));
checkMessage(requireWithin(appSource, /runVibeAgentTurn\([\s\S]*action:\s*productAgentLoop\.action[\s\S]*previousTimeline:\s*existingAgentTimeline\.timeline/, "App stage plan must persist the authoritative Product Agent action into the Agent timeline instead of re-inferring it"));
checkMessage(requireWithin(appSource, /vibeAgentPermissionModeForStage\(input,\s*productAgentLoop\.action\)/, "App stage timeline permission must follow the chosen Agent action, not only the global UI mode"));
checkMessage(requireWithin(appSource, /agentTimelineEntries:\s*boundAgentTimeline\.entries/, "App stage result must return fact-bound timeline entries to the composer"));
checkMessage(requireWithin(appSource, /agentKernelTurn:\s*vibeAgentTurn\.kernelTurn/, "App stage result must return the structured Kernel turn to the composer"));
checkMessage(requireWithin(appSource, /recordConfirmedVibeAgentTurn[\s\S]*Promise<\{ entries: VibeAgentTimelineEntry\[\]; kernelTurn: VibeAgentKernelTurn \}>/, "Confirmed Agent timeline recorder must return both entries and the structured Kernel turn"));
checkMessage(requireWithin(appSource, /agentTimelineEntries:\s*confirmedAgentTurn\.entries[\s\S]*agentKernelTurn:\s*confirmedAgentTurn\.kernelTurn/, "Confirmed Agent result must return entries and Kernel turn together"));
checkMessage(requireWithin(appSource, /recordConfirmedVibeAgentTurn[\s\S]*userConfirmed:\s*true[\s\S]*saveProjectAgentTimeline\(/, "Confirmed Agent actions must append and persist the real Agent timeline sidecar"));
checkMessage(requireWithin(appSource, /recordConfirmedVibeAgentTurn[\s\S]*runVibeAgentTurn\([\s\S]*action:\s*input\.action[\s\S]*userConfirmed:\s*true/, "Confirmed Agent timeline must reuse the confirmed action that the creator approved"));
checkMessage(requireWithin(minimalAgentPanelSource, /runAgentVideoConfirmedProductAction\(\{[\s\S]*controller:\s*agentVideoExecutionController[\s\S]*availability:\s*currentAgentToolAvailability\(action\)[\s\S]*references:\s*\{[\s\S]*video:\s*\{[\s\S]*videoQuery:\s*\{[\s\S]*exportProject:\s*\{/, "MinimalAgentPanel must delegate confirmed product callbacks to the shared execution controller"));
checkMessage(requireWithin(agentVideoExecutionControllerSource, /input\.controller\.runExecution\(\{[\s\S]*executionMode:\s*execution\.live \? "live" : "dry_run"[\s\S]*const productAdapter = buildMinimalAgentProductAdapter\(\{[\s\S]*createReferences:\s*\(target\)[\s\S]*action:\s*"prepare_references"[\s\S]*submitVideo:\s*\(target\)[\s\S]*action:\s*"submit_video"[\s\S]*queryVideo:\s*\(target\)[\s\S]*operation:\s*"query"[\s\S]*runExport:\s*\(target\)[\s\S]*action:\s*"export"[\s\S]*productAdapter\.runConfirmedAction/, "Execution controller must wrap all product callbacks before delegating policy and handoff to the Minimal Agent product adapter"));
checkMessage(requireWithin(agentProductCapabilitiesSource, /function buildMinimalAgentResearchProductCapability[\s\S]*buildVibeAgentResearchExecutionCapability[\s\S]*function buildMinimalAgentReferenceProductCapability[\s\S]*buildVibeAgentReferenceExecutionCapability[\s\S]*function buildMinimalAgentVideoProductCapability[\s\S]*buildVibeAgentVideoExecutionCapability[\s\S]*function buildMinimalAgentExportProductCapability[\s\S]*buildVibeAgentExportExecutionCapability/, "Agent product capability adapter must split product callbacks into named capability builders"));
checkMessage(requireWithin(agentProductCapabilitiesSource, /buildVibeAgentProductExecutionCapabilities<AgentVideoSubmitContract,\s*AgentWebSearchSettings,\s*AgentWebSearchResult>[\s\S]*status:\s*\{[\s\S]*setHandoff:\s*input\.setAgentToolHandoff[\s\S]*research:\s*buildMinimalAgentResearchProductCapability\(input\)[\s\S]*references:\s*buildMinimalAgentReferenceProductCapability\(input\)[\s\S]*video:\s*buildMinimalAgentVideoProductCapability\(input\)[\s\S]*exportProject:\s*buildMinimalAgentExportProductCapability\(input\)/, "Agent product capability adapter must pass product callbacks through the named Minimal Agent capability builders"));
checkMessage(requireWithin(agentProductCapabilitiesSource, /function buildMinimalAgentProductAdapter[\s\S]*buildVibeAgentConfirmedProductPolicy[\s\S]*availability:\s*input\.availability[\s\S]*runConfirmedAction:[\s\S]*runRegisteredConfirmedVibeAgentProductAction<AgentVideoSubmitContract,\s*AgentWebSearchSettings,\s*AgentWebSearchResult>[\s\S]*permissionMode:\s*actionInput\.action \? vibeAgentPermissionModeForConfirmedAction\(actionInput\.action\) : "plan_only"[\s\S]*\.\.\.policy[\s\S]*\.\.\.capabilities/, "UI Agent product adapter must delegate confirmed registered product execution to Agent Core"));
check(!/applyRegisteredVibeAgentAction/.test(minimalAgentPanelSource), "MinimalAgentPanel must not dispatch registered Agent actions directly");
check(!/buildVibeAgentProductExecutionHandlers/.test(minimalAgentPanelSource), "MinimalAgentPanel must not build product execution handler maps directly");
check(!/buildVibeAgentProductExecutionCapabilities/.test(minimalAgentPanelSource), "MinimalAgentPanel must not build product execution capabilities directly");
check(!/buildVibeAgentConfirmedProductPolicy/.test(minimalAgentPanelSource), "MinimalAgentPanel must not build product execution policy directly");
check(!/runRegisteredConfirmedVibeAgentProductAction/.test(minimalAgentPanelSource), "MinimalAgentPanel must not call the registered product action runner directly");
checkMessage(requireWithin(minimalAgentPanelSource, /function rememberConfirmedToolStart[\s\S]*buildVibeAgentConfirmedActionStartedEntry[\s\S]*rememberAgentTimelineEntries\(\[entry\]\)/, "Confirmed Agent tool execution must append a tool-call start entry before product callbacks run"));
checkMessage(requireWithin(minimalAgentPanelSource, /function rememberConfirmedToolOutcome[\s\S]*buildVibeAgentConfirmedActionToolResultEntry[\s\S]*buildVibeAgentConfirmedActionReportEntry[\s\S]*rememberAgentTimelineEntries\(\[toolResultEntry,\s*reportEntry\]\)/, "Confirmed Agent tool execution must append both the tool result and the user-facing action report"));
checkMessage(requireWithin(minimalAgentPanelSource, /rememberConfirmedToolStart\(authoritativeAgentActionEnvelope,[\s\S]*existingEntries:\s*previewResult\?\.agentTimelineEntries[\s\S]*runConfirmedAgentTool\(\s*authoritativeAgentActionEnvelope[\s\S]*projectFactHash:\s*previewResult\?\.projectFactHash/, "Confirmed Agent execution must not duplicate App-provided started entries and must carry post-write facts into the main product callback"));
checkMessage(requireWithin(minimalAgentPanelSource, /rememberConfirmedToolStart\(agentActionEnvelope,\s*\{ retry:\s*true,\s*force:\s*true \}\)[\s\S]*runConfirmedAgentTool\(agentActionEnvelope/, "Retrying a confirmed Agent tool must append a visible retry tool-call entry"));
checkMessage(requireWithin(appSource, /agentTimelineWriteQueueRef\s*=\s*useRef<Promise<void>>\(Promise\.resolve\(\)\)[\s\S]*function enqueueAgentTimelineWrite[\s\S]*agentTimelineWriteQueueRef\.current\.then\(write,\s*write\)/, "Agent timeline writes must be serialized so async tool results cannot be overwritten by older sidecar snapshots"));
checkMessage(requireWithin(appSource, /agentTimelineWriteEpochRef\s*=\s*useRef\(0\)[\s\S]*rememberVibeAgentTimelineEntries[\s\S]*const writeEpoch = agentTimelineWriteEpochRef\.current[\s\S]*writeEpoch !== agentTimelineWriteEpochRef\.current[\s\S]*saveProjectAgentTimeline[\s\S]*writeEpoch !== agentTimelineWriteEpochRef\.current[\s\S]*setRestoredAgentTimelineEntries/, "Queued Agent timeline writes must not restore stale draft messages after a project reset"));
checkMessage(requireWithin(appSource, /function resetAllProjectState\(\)[\s\S]*agentTimelineWriteEpochRef\.current \+= 1[\s\S]*setRestoredAgentTimelineEntries\(\[\]\)/, "Project reset must invalidate pending Agent timeline writes before clearing the visible timeline"));
checkMessage(requireWithin(appSource, /function currentAgentTimelineProjectIdentity\(\)[\s\S]*effectiveRuntimeProjectBinding\.status === "bound"[\s\S]*projectId[\s\S]*function projectForAgentTimeline\(project: ProjectVibeDocument\)[\s\S]*manifest:[\s\S]*projectId/, "Agent timeline persistence must use the currently bound project identity instead of a stale fallback project id"));
checkMessage(requireWithin(appSource, /rememberVibeAgentTimelineEntries[\s\S]*appendVibeAgentTimelineEntries\([\s\S]*saveProjectAgentTimeline\(/, "Actual Agent tool results must be appended and persisted to the Agent timeline sidecar"));
checkMessage(requireWithin(appSource, /rememberVibeAgentTimelineEntries[\s\S]*enqueueAgentTimelineWrite\(async \(\) =>[\s\S]*appendVibeAgentTimelineEntries[\s\S]*saveProjectAgentTimeline\(/, "Actual Agent tool results must use the serialized Agent timeline write queue"));
checkMessage(requireWithin(appSource, /rememberVibeAgentTimelineEntries[\s\S]*existingAgentTimeline\.status !== "restored"[\s\S]*agentTimelineEntriesAreContextOnly\(entries\)[\s\S]*return;/, "Selection/context-only Agent messages must not overwrite a timeline before history is restored"));
checkMessage(requireWithin(`${appSource}\n${directorModeSource}\n${minimalAgentPanelSource}`, /onRememberAgentTimelineEntries=\{rememberVibeAgentTimelineEntries\}[\s\S]*onRememberAgentTimelineEntries=\{onRememberAgentTimelineEntries\}[\s\S]*buildVibeAgentConfirmedActionToolResultEntry[\s\S]*buildVibeAgentConfirmedActionReportEntry/, "Actual Agent tool results must flow from MinimalAgentPanel through DirectorMode into the persisted Agent timeline"));
checkMessage(requireWithin(`${directorModeSource}\n${minimalAgentPanelSource}`, /restoredAgentTimelineEntries\?:\s*VibeAgentTimelineEntry\[\][\s\S]*restoredAgentTimelineEntries=\{surfaceAgentTimelineEntries\}/, "DirectorMode and MinimalAgentPanel must pass surface-scoped restored Agent timeline entries into the composer"));
checkMessage(requireWithin(`${directorModeSource}\n${newVideoStartSource}`, /<NewVideoStart[\s\S]*restoredAgentTimelineEntries=\{newVideoSurfaceAgentTimelineEntries\}[\s\S]*onRememberAgentTimelineEntries=\{onRememberAgentTimelineEntries\}[\s\S]*restoredAgentTimelineEntries\?:\s*VibeAgentTimelineEntry\[\]/, "DirectorMode must pass only new-video-scoped Agent timeline entries into the new-video intake composer"));
checkMessage(requireWithin(newVideoStartSource, /buildVibeAgentIntakeTimelineEntries[\s\S]*displayAgentMessages = timelineAgentMessages\.length \? timelineAgentMessages : agentMessages/, "NewVideoStart must prefer real persisted Agent timeline messages over local synthetic intake messages"));
checkMessage(requireWithin(minimalAgentPanelSource, /minimalAgentMessageFromTimelineEntry[\s\S]*tool_call[\s\S]*confirmation_request/, "MinimalAgentPanel must render tool calls and confirmation requests from the Agent timeline"));
checkMessage(requireWithin(minimalAgentPanelSource, /minimalAgentMessagesFromTimelineEntries\(visibleAgentTimelineEntries\)/, "MinimalAgentPanel message flow must prefer focused persisted Agent timeline entries over synthetic status text"));
checkMessage(requireWithin(minimalAgentPanelSource, /type MinimalAgentMessage[\s\S]*executionResult\?:\s*VibeAgentExecutionResultSummary/, "Agent timeline messages must carry the structured Kernel execution result into the UI message model"));
checkMessage(requireWithin(minimalAgentPanelSource, /function timelineExecutionResult\(entry: VibeAgentTimelineEntry\)[\s\S]*entry\.details\?\.executionResult[\s\S]*statusValues[\s\S]*summary/, "MinimalAgentPanel must parse executionResult from persisted timeline entry details"));
checkMessage(requireWithin(minimalAgentPanelSource, /className=\{`minimal-agent-execution-result \$\{message\.executionResult\.status\}`\}[\s\S]*结果[\s\S]*executionResultStatusLabel\(message\.executionResult\.status\)[\s\S]*下一步/, "Agent message flow must render execution result and next step directly in the message card"));
checkMessage(requireWithin(minimalAgentPanelSource, /function minimalAgentMessageStatusLabel[\s\S]*waiting[\s\S]*blocked[\s\S]*done/, "Agent timeline messages must preserve visible waiting, blocked, and done states"));
checkMessage(requireWithin(minimalAgentPanelSource, /function minimalAgentMessageRequestsActionConfirmation[\s\S]*request_user_confirmation[\s\S]*function minimalAgentMessageStageLabel[\s\S]*minimalAgentMessageRequestsActionConfirmation\(message\)[\s\S]*需要确认/, "Agent timeline messages must label confirmation requests in creator language"));
checkMessage(requireWithin(minimalAgentPanelSource, /function minimalAgentMessageStageLabel[\s\S]*action_result[\s\S]*完成结果/, "Agent timeline messages must label execution results in creator language"));
checkMessage(requireWithin(minimalAgentPanelSource, /function minimalAgentMessageStageLabel[\s\S]*推荐 Skills[\s\S]*推荐方法/, "Agent timeline messages must label Skill recommendations in creator language"));
checkMessage(requireWithin(minimalAgentPanelSource, /function isMinimalAgentSelectionContextId[\s\S]*selection_context_[\s\S]*draft_selection_context_[\s\S]*draft_material_selection_context_[\s\S]*function minimalAgentMessageStageLabel[\s\S]*state_change[\s\S]*isMinimalAgentSelectionContextId\(message\.id\)[\s\S]*当前选择[\s\S]*正在处理[\s\S]*message\.title === "执行边界"[\s\S]*确认范围/, "Agent timeline messages must label running state changes, selected context, draft selection context, and execution boundaries in creator language"));
checkMessage(requireWithin(minimalAgentPanelSource, /function explicitAgentSelectionContextFromTimeline[\s\S]*const binding = facts\.find\(\(fact\) => fact\.label === "识别为"\)\?\.value[\s\S]*looksLikeVoiceContext[\s\S]*声\|音频\|对白\|台词\|voice\|audio[\s\S]*looksLikeVoiceContext \? "voice" : "asset"/, "Restored draft material context must classify audio by binding facts instead of brittle ids"));
checkMessage(requireWithin(minimalAgentPanelSource, /function minimalAgentMessageTitleLabel[\s\S]*message\.entryType === "assistant_message" && stage === "理解"[\s\S]*minimalAgentMessageStatusLabel\(message\)[\s\S]*title === status[\s\S]*title === stage[\s\S]*title\.startsWith\(stage\)[\s\S]*remainder === status/, "Agent message headers must avoid repeating stage or status labels as titles"));
checkMessage(requireWithin(minimalAgentPanelSource, /minimal-agent-message-head[\s\S]*minimal-agent-message-status[\s\S]*message\.status/, "Agent timeline message headers must show persisted tool/action state"));
checkMessage(requireWithin(minimalAgentPanelSource, /minimal-agent-message-title[\s\S]*minimal-agent-message-stage[\s\S]*minimalAgentMessageStageLabel\(message\)[\s\S]*minimalAgentMessageTitleLabel\(message\)/, "Agent message headers must show the readable stage label without duplicating it in the title"));
checkMessage(requireWithin(minimalAgentPanelSource, /function minimalAgentMessageNeedsLocalProject[\s\S]*本地项目\|项目文件夹\|临时项目\|保存位置/, "Agent messages must identify local-project and save-location blockers from persisted timeline copy"));
checkMessage(requireWithin(minimalAgentPanelSource, /latestLocalProjectBlockedMessageId[\s\S]*startLocalProjectSetupFromMessage[\s\S]*onCreateLocalProject/, "Local-project blockers must expose a message-level action that reuses the existing project setup callback"));
checkMessage(requireWithin(minimalAgentPanelSource, /选择保存位置[\s\S]*先继续改文字/, "Local-project blocker messages must offer a clear save-location action and a text-only fallback"));
checkMessage(requireWithin(minimalAgentPanelSource, /function reviseLocalProjectBlockedIntent\(message: MinimalAgentMessage\)[\s\S]*currentComposerTextValue\(\)[\s\S]*activeComposerTurnIntent\.trim\(\)[\s\S]*minimalAgentFactValue\(message,\s*\["你想做",\s*"动作"\]\)[\s\S]*updateText\(revisionIntent\)[\s\S]*focus\(\{ preventScroll: true \}\)/, "Local-project blocker text fallback must restore a concrete user intent and focus the composer instead of only changing status"));
checkMessage(requireWithin(minimalAgentPanelSource, /function minimalAgentMessageIncompleteLocalProjectSetup\(message: MinimalAgentMessage\)[\s\S]*没有选择保存位置\|保存位置选择失败[\s\S]*function minimalAgentMessageCompletedToolAction/, "Cancelled or failed save-location result cards must be identifiable before offering text-only fallback"));
checkMessage(requireWithin(minimalAgentPanelSource, /function reviseLocalProjectBlockedIntent\(message: MinimalAgentMessage\)[\s\S]*shouldRestorePreviousIntent = !minimalAgentMessageIncompleteLocalProjectSetup\(message\)[\s\S]*shouldRestorePreviousIntent \? activeComposerTurnIntent\.trim\(\) : ""[\s\S]*shouldRestorePreviousIntent \? minimalAgentFactValue\(message,\s*\["你想做",\s*"动作"\]\) : ""/, "Text fallback after cancelling save-location setup must focus the composer without restoring the old new-video prompt"));
checkMessage(requireWithin(minimalAgentPanelSource, /minimal-agent-action-hint[\s\S]*当前环境不能直接选文件夹，请从项目入口选择保存位置/, "Disabled local-project setup actions must explain the fallback visibly, not only in a hover title"));
checkMessage(requireWithin(minimalAgentPanelSource, /function buildLocalProjectSetupTimelineEntries[\s\S]*选择保存位置[\s\S]*保存位置已选择[\s\S]*没有选择保存位置/, "Local-project setup must produce real Agent timeline entries for started, completed, and cancelled save-location states"));
checkMessage(requireWithin(minimalAgentPanelSource, /startLocalProjectSetupFromMessage[\s\S]*buildLocalProjectSetupTimelineEntries\(\{[\s\S]*phase:\s*"started"[\s\S]*await onCreateLocalProject\?\.\(\)[\s\S]*phase:\s*result \? "completed" : "cancelled"/, "Message-level local project setup must record start and result around the existing project callback"));
checkMessage(requireWithin(minimalAgentPanelSource, /localProjectSetupNotice[\s\S]*!localProjectReadyForTools[\s\S]*agentThreadMessages = \[\.\.\.agentThreadMessages,\s*localProjectSetupNotice\]/, "Local-project setup cancel or failure notices must stay visible in the right Agent thread even if timeline restoration filters them"));
checkMessage(requireWithin(minimalAgentPanelSource, /const localProjectSetupResultTakesFocus = agentThreadMessages\.some\(minimalAgentMessageIncompleteLocalProjectSetup\)[\s\S]*agentThreadMessages = agentThreadMessages\.filter\(\(message\) =>[\s\S]*!minimalAgentMessageRequestsActionConfirmation\(message\) \|\| !minimalAgentMessageIsLocalProjectSetup\(message\)/, "Cancelled or failed save-location result cards must replace stale save-location confirmation cards as the current Agent action"));
checkMessage(requireWithin(minimalAgentPanelSource, /const projectedStatusReplyMessage = !composerReadyDraftPreviewMessage[\s\S]*showPassiveAgentReply[\s\S]*passiveAgentReply[\s\S]*!localProjectSetupResultTakesFocus[\s\S]*minimalAgentThreadNeedsStatusReply\(agentThreadMessages\)/, "Cancelled or failed save-location result cards must not be followed by a duplicate passive save-location status reply"));
checkMessage(requireWithin(minimalAgentPanelSource, /footerActionConfirmationMessage[\s\S]*footerActionMatchesProjectedCurrentTask[\s\S]*!minimalAgentFooterConfirmationHasExistingVisiblePeer\(agentThreadMessages, footerActionConfirmationMessage\)[\s\S]*!\(localProjectSetupResultTakesFocus && minimalAgentMessageIsLocalProjectSetup\(footerActionConfirmationMessage\)\)[\s\S]*!hasComposerInput/, "Footer save-location confirmations must match the projected task and must not reappear after cancel or failure takes focus"));
checkMessage(requireWithin(minimalAgentPanelSource, /const localProjectSetupRecoveryTakesFooterFocus = Boolean\([\s\S]*!hasVisibleComposerInput[\s\S]*localProjectSetupNotice[\s\S]*minimalAgentMessageIncompleteLocalProjectSetup\(localProjectSetupNotice\)[\s\S]*const footerSelectionTargetCopy[\s\S]*localProjectSetupRecoveryTakesFooterFocus[\s\S]*你说“这个”时，我会理解为：\$\{displayedCompactScopeLabel\}[\s\S]*const footerStatusCopy/, "Cancelled or failed save-location result cards must remove confirmation-specific language from the selected-scope footer hint"));
checkMessage(requireWithin(minimalAgentPanelSource, /localProjectSetupRecoveryTakesFooterFocus[\s\S]*上方可重新选择保存位置，也可以继续改文字[\s\S]*const displayStatusLineText[\s\S]*localProjectSetupRecoveryTakesFooterFocus[\s\S]*footerStatusCopy[\s\S]*const composerHint[\s\S]*localProjectSetupRecoveryTakesFooterFocus[\s\S]*可以点上方「选择保存位置」，或直接写要改哪里。/, "Footer copy after cancelled or failed save-location setup must point to the visible recovery card instead of a stale message confirmation"));
checkMessage(requireWithin(minimalAgentPanelSource, /const resultEntries = buildLocalProjectSetupTimelineEntries\(\{[\s\S]*phase:\s*result \? "completed" : "cancelled"[\s\S]*setLocalProjectSetupNotice\(minimalAgentMessageFromTimelineEntry\(resultEntries\[0\]\)\)/, "Cancelling the local project picker must project the result directly into the visible Agent thread"));
checkMessage(requireWithin(minimalAgentPanelSource, /resumeAgentAfterLocalProjectSetupRef[\s\S]*!resumeAgentAfterLocalProjectSetupRef\.current \|\| !localProjectReadyForTools[\s\S]*prepareChange\("继续",\s*currentComposerSelectionOverride\(\)\)/, "Completed local-project setup must automatically resume the Agent continue turn once the folder is ready with the current selection"));
checkMessage(requireWithin(minimalAgentPanelSource, /const result = await onCreateLocalProject\?\.\(\);[\s\S]*if \(result\) \{[\s\S]*resumeAgentAfterLocalProjectSetupRef\.current = true[\s\S]*继续检查项目/, "Successful local-project setup must arm the Agent resume path instead of stopping at a passive status"));
checkMessage(requireWithin(minimalAgentPanelSource, /projectRequiredForWorkflow[\s\S]*perform:\s*\(\) => \{[\s\S]*startLocalProjectSetupFromMessage\(\)/, "Bottom project-required primary action must use the same Agent timeline project setup path"));
check(!/composerInputUsesNextAction/.test(minimalAgentPanelSource), "MinimalAgentPanel must not turn typed continue into a hidden confirmation shortcut before it enters the Agent timeline");
checkMessage(requireWithin(minimalAgentPanelSource, /function minimalAgentMessageCompletedLocalProjectSetup[\s\S]*write_project[\s\S]*项目文件夹已准备\|保存位置已选择/, "Completed local-project setup messages must be detected from real Agent timeline entries"));
checkMessage(requireWithin(minimalAgentPanelSource, /message\.id === latestLocalProjectReadyMessageId[\s\S]*prepareChange\("继续",\s*currentComposerSelectionOverride\(\)\)[\s\S]*继续检查项目/, "Completed local-project setup messages must expose a one-click Agent continue action with current selection context"));
checkMessage(requireWithin(minimalAgentPanelSource, /entryType\?:\s*VibeAgentTimelineEntry\["type"\]/, "Agent messages must preserve the original timeline entry type for result-specific actions"));
checkMessage(requireWithin(minimalAgentPanelSource, /resultView\?:\s*DirectorView[\s\S]*function timelineResultView[\s\S]*details\?\.resultView/, "Agent messages must preserve the timeline result view for result cards"));
checkMessage(requireWithin(minimalAgentPanelSource, /function minimalAgentMessageCompletedToolAction[\s\S]*action_result[\s\S]*generate_references[\s\S]*submit_video[\s\S]*query_video[\s\S]*export_showcase[\s\S]*export_project/, "Completed tool action results must be detected from persisted action_result entries"));
checkMessage(requireWithin(minimalAgentPanelSource, /function minimalAgentMessageBlockedToolAction[\s\S]*action_result[\s\S]*blocked[\s\S]*generate_references[\s\S]*submit_video[\s\S]*query_video[\s\S]*export_showcase[\s\S]*export_project/, "Blocked tool action results must be detected from persisted action_result entries"));
checkMessage(requireWithin(minimalAgentPanelSource, /buildVibeAgentTimelineStatusView\(stateAwareAgentTimelineEntries\)[\s\S]*agentTimelineStatusLine[\s\S]*agentTimelineNextLine/, "MinimalAgentPanel bottom status must derive from the same Agent timeline status source"));
checkMessage(requireWithin(minimalAgentPanelSource, /function completedToolActionView[\s\S]*message\.resultView === "assets"[\s\S]*message\.resultView === "preview"[\s\S]*message\.resultView === "export"[\s\S]*generate_references[\s\S]*assets[\s\S]*submit_video[\s\S]*preview[\s\S]*export_showcase[\s\S]*export/, "Completed tool action results must route to the right result surface from timeline resultView first"));
checkMessage(requireWithin(minimalAgentPanelSource, /function agentMessageNextIntent\(message: MinimalAgentMessage[\s\S]*message\.executionResult\?\.next[\s\S]*message\.next[\s\S]*fallback/, "Agent result continue actions must derive their next intent from the Kernel executionResult before falling back"));
const completedToolActionSnippetStart = minimalAgentPanelSource.indexOf("message.id === latestCompletedToolActionMessageId");
const completedToolActionSnippetEnd = minimalAgentPanelSource.indexOf("message.id === latestBlockedToolActionMessageId", completedToolActionSnippetStart);
const completedToolActionSnippet = completedToolActionSnippetStart >= 0 && completedToolActionSnippetEnd > completedToolActionSnippetStart
  ? minimalAgentPanelSource.slice(completedToolActionSnippetStart, completedToolActionSnippetEnd)
  : "";
checkMessage(requireWithin(minimalAgentPanelSource, /const latestCompletedToolActionMessageId = latestFinalToolActionMessage[\s\S]*minimalAgentMessageCompletedToolAction\(latestFinalToolActionMessage\)/, "Latest completed Agent tool result must be derived from the latest final tool action"));
checkMessage(requireWithin(completedToolActionSnippet, /completedToolActionView\(message\)[\s\S]*const nextIntent = agentMessageNextIntent\(message\)[\s\S]*const resultNextAction = projectedFooterDirectAction[\s\S]*const resultNextRequiresConfirmation = Boolean\([\s\S]*agentCurrentTaskProjection\.requiresConfirmation[\s\S]*prepareChange\([\s\S]*resultNextAction\.label,[\s\S]*currentComposerSelectionOverride\(resultNextAction\.label\)[\s\S]*resultNextAction\.perform\(\)[\s\S]*prepareChange\(nextIntent,\s*currentComposerSelectionOverride\(\)\)[\s\S]*\{resultNextLabel\}/, "Latest completed Agent tool result must stage confirmation-required next actions and only perform direct actions after their boundary is already satisfied"));
checkMessage(requireWithin(minimalAgentPanelSource, /function agentMessageRevisionIntent\(message: MinimalAgentMessage,\s*fallbackIntent = ""\)[\s\S]*message\.executionResult\?\.summary[\s\S]*agentMessageNextIntent\(message,[\s\S]*刚才这一步没通过[\s\S]*请按这个方向继续改/, "Blocked Agent result revision must carry the execution failure summary and next step back into the composer"));
checkMessage(requireWithin(minimalAgentPanelSource, /function agentMessageDraftRevisionIntent\(message: MinimalAgentMessage,\s*fallbackIntent = ""\)[\s\S]*isNewVideoDraftConfirmationLabel\(actionLabel\)[\s\S]*looksLikeFreshIdea[\s\S]*includesDraftSetupDirective[\s\S]*original\.length <= 40 && !looksLikeFreshIdea && !includesDraftSetupDirective[\s\S]*return "修改这版草案："/, "Fresh-draft confirmation revise actions must restore a compact draft-edit prompt instead of reusing the original new-video request"));
checkMessage(requireWithin(minimalAgentPanelSource, /function agentMessageRevisionIntent\(message: MinimalAgentMessage,\s*fallbackIntent = ""\)[\s\S]*const draftRevisionIntent = agentMessageDraftRevisionIntent\(message,\s*fallbackIntent\)[\s\S]*draftRevisionIntent \|\| cleanMinimalAgentMessageCopy\(message\.revisionUserIntent\?\.trim\(\) \|\| fallbackIntent\.trim\(\)\)[\s\S]*minimalAgentMessageRequestsActionConfirmation\(message\)[\s\S]*minimalAgentConfirmationAction\(message,\s*"继续"\)\.label[\s\S]*return fallback \|\| cleanMinimalAgentMessageCopy\(label\)/, "Confirmation-card revise actions must restore a message-specific revision intent instead of copying internal confirmation copy back into the composer"));
checkMessage(requireWithin(minimalAgentPanelSource, /function reviseFromAgentMessage\(message: MinimalAgentMessage\)[\s\S]*agentMessageRevisionIntent\(message,\s*previousIntent \|\| activeComposerTurnIntent\.trim\(\)\)[\s\S]*liveComposerValueRef\.current = revisionIntent[\s\S]*lastVisibleComposerInputRef\.current = revisionIntent[\s\S]*setText\(revisionIntent\)[\s\S]*继续改这一步/, "Blocked Agent result revise action must restore a message-specific revision intent and keep live composer refs in sync"));
checkMessage(requireWithin(minimalAgentPanelSource, /latestBlockedToolActionMessageId[\s\S]*minimalAgentMessageBlockedToolAction[\s\S]*message\.id === latestBlockedToolActionMessageId[\s\S]*retryConfirmedAgentTool[\s\S]*reviseFromAgentMessage\(message\)[\s\S]*继续修改/, "Latest blocked Agent tool result must expose retry and message-specific revise actions in the message flow"));
checkMessage(requireWithin(minimalAgentPanelSource, /function rememberAgentTimelineEntries[\s\S]*mergeVibeAgentTimelineEntries[\s\S]*onRememberAgentTimelineEntries/, "MinimalAgentPanel must use one helper to append and persist Agent timeline entries"));
checkMessage(requireWithin(minimalAgentPanelSource, /function minimalAgentMessageIsCompletedProcessCard[\s\S]*request_user_confirmation[\s\S]*run_confirmed_action[\s\S]*function minimalAgentMessageHasResultCard[\s\S]*tool_result[\s\S]*action_result[\s\S]*function minimalAgentMessageIsConfirmedExecutionProcessCard[\s\S]*run_confirmed_action[\s\S]*function minimalAgentMessageIsSupersededProcessCard[\s\S]*execution_boundary_[\s\S]*function minimalAgentMessageIsPreConfirmationExecutionLeak[\s\S]*minimalAgentMessageIsWaitingConfirmation\(candidate\)[\s\S]*function minimalAgentMessageIsSupersededObservationCard[\s\S]*inspect_project[\s\S]*plan_next_action[\s\S]*function minimalAgentMessageIsSupersededConfirmationPrepCard[\s\S]*minimalAgentMessageHasLaterConfirmationRequest[\s\S]*function minimalAgentMessageIsSupersededSelectionContextCard[\s\S]*isMinimalAgentSelectionContextId\(message\.id\)[\s\S]*isMinimalAgentSelectionContextId\(candidate\.id\)[\s\S]*function visibleMinimalAgentMessages[\s\S]*compactedMessages[\s\S]*!minimalAgentMessageIsPreConfirmationExecutionLeak\(filteredMessages,\s*message\)[\s\S]*latestUserIndex[\s\S]*hiddenCount/, "MinimalAgentPanel must keep long persisted Agent timelines readable by compacting completed internal process cards, superseded execution-process cards, stale pre-confirmation execution leaks, superseded observation cards, pre-confirmation prep cards, older selection context cards, and duplicate internal tool returns"));
checkMessage(requireWithin(minimalAgentPanelSource, /function minimalAgentMessageIsGenericAssistantPlanningReply\(message: MinimalAgentMessage\)[\s\S]*message\.title === "AI 导演"[\s\S]*message\.title !== "理解" && message\.title !== "我理解为"[\s\S]*继续看我下面的确认项[\s\S]*function minimalAgentMessageIsSupersededAssistantReplyCard\(messages: MinimalAgentMessage\[\], message: MinimalAgentMessage\)[\s\S]*!minimalAgentMessageIsGenericAssistantPlanningReply\(message\)[\s\S]*minimalAgentMessageRequestsActionConfirmation\(candidate\)[\s\S]*candidate\.entryType === "action_result"[\s\S]*candidate\.status !== "waiting"[\s\S]*candidate\.actionId === message\.actionId[\s\S]*!minimalAgentMessageIsSupersededAssistantReplyCard\(filteredMessages,\s*message\)/, "Agent thread must keep confirmation/result cards from competing with a generic same-action assistant reply, including the current-turn 理解 card"));
checkMessage(requireWithin(minimalAgentPanelSource, /function placeSelectionContextBeforeActiveConfirmation\(messages: MinimalAgentMessage\[\]\)[\s\S]*findIndex\(minimalAgentMessageIsWaitingConfirmation\)[\s\S]*selectionAfterConfirmation[\s\S]*minimalAgentMessageIsSelectionContext[\s\S]*withoutMovedSelection[\s\S]*return \[[\s\S]*selectionAfterConfirmation[\s\S]*withoutMovedSelection\.slice\(updatedConfirmationIndex\)[\s\S]*messages:\s*placeSelectionContextBeforeActiveConfirmation\(pinnedBounded\)/, "Agent thread must keep the active confirmation card as the final visible action while still showing what the current 'this' refers to"));
checkMessage(requireWithin(minimalAgentPanelSource, /function minimalAgentSelectionContextMessageIsOutsideActiveScope[\s\S]*storyLevelFocusActive: boolean[\s\S]*localProjectSetupFocusActive = false[\s\S]*storyShotCountRevisionFocusActive = false[\s\S]*projectEditBlockerFocusActive = false[\s\S]*isMinimalAgentSelectionContextId\(message\.id\)[\s\S]*draft_selection_context_[\s\S]*return false[\s\S]*if \(storyLevelFocusActive \|\| localProjectSetupFocusActive \|\| storyShotCountRevisionFocusActive \|\| projectEditBlockerFocusActive\) return true[\s\S]*!hasBoundSelection \|\| !activeSelectionKey[\s\S]*selectionContextMessageId\(activeSelectionKey\)[\s\S]*stateAwareAgentThreadMessages[\s\S]*minimalAgentSelectionContextMessageIsOutsideActiveScope\(\s*message,\s*selectionFocusKey,\s*hasBoundSelection,\s*storyLevelReferenceContextActive,\s*localProjectSetupConfirmationContextActive,\s*storyShotCountRevisionFocusActive[\s\S]*composerToolIntentShouldYieldToProjectEditConfirmation/, "Restored Agent timelines must hide stale selection-context cards when story-level reference focus, pending reference confirmation, shot-count restructuring, save-location confirmation, or a pending project-edit blocker owns the thread, while preserving draft-intake context"));
checkMessage(requireWithin(minimalAgentPanelSource, /const currentTimelineConfirmationLabel = visibleTimelineConfirmationMessage[\s\S]*minimalAgentConfirmationAction\(visibleTimelineConfirmationMessage,\s*NEW_VIDEO_DRAFT_CONFIRM_LABEL\)\.label[\s\S]*const hasAgentTimelineConfirmation[\s\S]*const timelineNewVideoDraftConfirmationReady = Boolean\([\s\S]*!latestNewVideoDraftCommitted[\s\S]*isNewVideoDraftConfirmationLabel\(currentTimelineConfirmationLabel\)/, "After a story draft is committed, later Agent confirmations such as reference generation must still provide the current confirmation label; only draft confirmations are hidden by the committed-draft guard"));
checkMessage(requireWithin(minimalAgentPanelSource, /function minimalAgentConfirmationRequestsOverlap[\s\S]*left\.actionId && right\.actionId && left\.actionId === right\.actionId[\s\S]*minimalAgentFactValue\(left,\s*\["动作"\]\)[\s\S]*minimalAgentFactValue\(right,\s*\["动作"\]\)[\s\S]*minimalAgentFactValue\(left,\s*\["目标",\s*"影响"\]\)[\s\S]*minimalAgentFactValue\(right,\s*\["目标",\s*"影响"\]\)[\s\S]*leftAction === rightAction[\s\S]*leftTarget === rightTarget[\s\S]*function minimalAgentConfirmationRequestsSameAction[\s\S]*minimalAgentConfirmationAction\(left,\s*"确认执行"\)\.label[\s\S]*targetCompatible[\s\S]*request_user_confirmation[\s\S]*toolCompatible[\s\S]*function minimalAgentMessageHasLaterConfirmationRequest[\s\S]*const messageIsConfirmationRequest = minimalAgentMessageRequestsActionConfirmation\(message\)[\s\S]*messageIsConfirmationRequest[\s\S]*minimalAgentConfirmationRequestsOverlap\(message,\s*candidate\)[\s\S]*!\s*message\.actionId \|\| !candidate\.actionId \|\| candidate\.actionId === message\.actionId/, "Agent visible thread must collapse duplicate generic and concrete confirmation cards for the same action target while still hiding generic pre-confirmation prep cards"));
checkMessage(requireWithin(minimalAgentPanelSource, /const latestUserIndex = currentMessages\.map\(\(message\) => message\.role\)\.lastIndexOf\("user"\)[\s\S]*const turnFocusedMessages = latestUserIndex >= 0[\s\S]*currentMessages\.slice\(latestUserIndex\)[\s\S]*latestWaitingConfirmation[\s\S]*hiddenCount:\s*Math\.max\(0,\s*currentMessages\.length - pinnedBounded\.length\)/, "MinimalAgentPanel visible history must focus the latest user turn while pinning active confirmations outside the saved-history notice"));
checkMessage(requireWithin(minimalAgentPanelSource, /const totalHiddenAgentThreadMessageCount = hiddenAgentThreadMessageCount/, "MinimalAgentPanel thread-history notice must not appear only because stale state reminders or inline context were compacted"));
checkMessage(requireWithin(minimalAgentPanelSource, /hiddenAgentThreadMessageCount[\s\S]*前面的记录已保存/, "MinimalAgentPanel must disclose when older Agent timeline messages are saved but hidden"));
checkMessage(requireWithin(minimalAgentPanelSource, /actionKind\?:\s*VibeAgentTimelineEntry\["actionKind"\]/, "Agent messages must preserve action kind so confirmation cards can name the real action"));
checkMessage(requireWithin(minimalAgentPanelSource, /function minimalAgentConfirmationAction[\s\S]*prepare_reference_generation[\s\S]*确认生成参考[\s\S]*prepare_video_submit[\s\S]*确认提交视频[\s\S]*query_video_result[\s\S]*确认查询结果[\s\S]*prepare_export[\s\S]*确认导出/, "Agent confirmation messages must derive concrete CTA copy from the persisted timeline action"));
checkMessage(requireWithin(minimalAgentPanelSource, /function minimalAgentConfirmationAction\(message: MinimalAgentMessage,\s*fallbackLabel: string\)[\s\S]*message\.toolName === "save_skill"[\s\S]*label: "确认保存 Skill"[\s\S]*确认后只保存到项目 Skills，不生成参考或提交视频/, "save-Skill confirmations must derive concrete footer and now-line copy instead of falling back to generic execution"));
checkMessage(requireWithin(minimalAgentPanelSource, /const pendingSkillSaveConfirmationMessage = pendingTimelineConfirmationMessageForContext[\s\S]*minimalAgentMessageRequestsSkillSave\(pendingTimelineConfirmationMessageForContext\)[\s\S]*const pendingSkillSaveConfirmationContextActive = Boolean\(pendingSkillSaveConfirmationMessage\)[\s\S]*const editingSkillSaveConfirmationActive = Boolean\(text\.trim\(\) && !attachments\.length && isSaveDirectorSkillIntent\(text\)\)[\s\S]*const skillSaveContextActive = pendingSkillSaveConfirmationContextActive \|\| editingSkillSaveConfirmationActive[\s\S]*const pendingSkillSaveConfirmationChips = pendingSkillSaveConfirmationContextActive[\s\S]*label: "动作", value: pendingSkillSaveActionLabel[\s\S]*label: "保存到", value: pendingSkillSaveTargetLabel[\s\S]*label: "保护", value: "不生成参考、不提交视频"[\s\S]*const editingSkillSaveConfirmationChips = editingSkillSaveConfirmationActive[\s\S]*label: "动作", value: "保存导演经验"[\s\S]*const baseDisplayedScopeLabel = composerPermissionControlInputActive[\s\S]*localProjectSetupConfirmationContextActive[\s\S]*skillSaveContextActive[\s\S]*pendingSkillSaveTargetLabel \|\| "项目 Skills"[\s\S]*const visibleCompactSelectionHint = pendingDraftShotCount[\s\S]*skillSaveContextActive[\s\S]*const selectionContextTitle = exportResultIsPrimary[\s\S]*skillSaveContextActive[\s\S]*保存导演经验[\s\S]*const displayedSelectionChips = pendingDraftShotCount[\s\S]*pendingSkillSaveConfirmationChips\.length[\s\S]*editingSkillSaveConfirmationChips\.length/, "save-Skill waiting confirmations and edits must replace stale reference-planning or selected-shot context in the right Agent cockpit"));
checkMessage(requireWithin(minimalAgentPanelSource, /function minimalAgentConfirmationAction\(message: MinimalAgentMessage,\s*fallbackLabel: string\)[\s\S]*message\.actionKind === "prepare_export"[\s\S]*label: "确认导出"[\s\S]*hint: "确认后只生成本地交付包和报告，不生成缺失视频。"/, "Export confirmation button help must say the local package confirmation does not generate missing videos"));
checkMessage(requireWithin(minimalAgentPanelSource, /function minimalAgentMessageTitleLabel\(message: MinimalAgentMessage\)[\s\S]*minimalAgentMessageRequestsActionConfirmation\(message\)[\s\S]*title === "请求确认"[\s\S]*minimalAgentConfirmationAction\(message,\s*"确认执行"\)\.label/, "Generic Agent confirmation titles must render as the concrete confirmation action"));
checkMessage(requireWithin(minimalAgentPanelSource, /function stableIntentBoundaryFacts\(entry: VibeAgentTimelineEntry\)[\s\S]*entry\.type === "user_message"[\s\S]*entry\.type === "assistant_message"[\s\S]*fact\.label === "边界" && \/权限和用户确认都已满足\/\.test\(fact\.value\)[\s\S]*当前只允许整理计划；需要你确认后，才能写入项目。[\s\S]*facts:\s*stableIntentBoundaryFacts\(entry\)/, "User and assistant planning cards must keep the original pre-confirmation boundary after execution results arrive"));
checkMessage(requireWithin(minimalAgentPanelSource, /function minimalAgentFactIsPreConfirmationBoundary\(label: string, value: string\)[\s\S]*label === "边界"[\s\S]*当前只允许整理计划\|需要你确认后，才能写入项目[\s\S]*function minimalAgentVisibleFacts\(message: MinimalAgentMessage\)[\s\S]*message\.entryType === "assistant_message" && minimalAgentFactIsPreConfirmationBoundary\(label, value\)[\s\S]*return false/, "Assistant planning cards must not keep showing stale pre-confirmation boundary chips in the visible thread after a confirmed action has already written the draft"));
checkMessage(requireWithin(minimalAgentPanelSource, /function minimalAgentConfirmationAction[\s\S]*minimalAgentFactValue\(message,\s*\["外部提交",\s*"会做",\s*"执行",\s*"调用",\s*"成本"\]\)[\s\S]*minimalAgentFactValue\(message,\s*\["目标",\s*"影响"\]\)[\s\S]*minimalAgentFactValue\(message,\s*\["写入",\s*"保存"\]\)[\s\S]*预计保存到/, "Agent confirmation hints must use the same cost/submission/save facts shown in the message flow"));
checkMessage(requireWithin(minimalAgentPanelSource, /function minimalAgentConfirmationBoundary\(message: MinimalAgentMessage\)[\s\S]*\["目标",\s*"影响"\][\s\S]*\["成本",\s*"调用",\s*"会做",\s*"执行"\][\s\S]*\["写入",\s*"保存"\][\s\S]*\["外部提交"\][\s\S]*确认前/, "Agent confirmation cards must summarize target, cost, writes, and external submission from message facts"));
checkMessage(requireWithin(minimalAgentPanelSource, /function minimalAgentConfirmationTargetPhrase\(message: MinimalAgentMessage,\s*targetFact: string\)[\s\S]*prepare_reference_generation[\s\S]*这次只补[\s\S]*prepare_video_submit[\s\S]*这次只提交[\s\S]*query_video_result[\s\S]*这次只查询[\s\S]*prepare_export[\s\S]*这次只导出[\s\S]*write_project[\s\S]*这次只保存/, "Agent confirmation boundary must use action-sensitive creator copy instead of saying every action only '补' something"));
checkMessage(requireWithin(minimalAgentPanelSource, /function minimalAgentMessageIsLocalProjectSetup[\s\S]*本地项目\|项目文件夹\|保存位置[\s\S]*function minimalAgentConfirmationBoundary\(message: MinimalAgentMessage\)[\s\S]*minimalAgentMessageIsLocalProjectSetup\(message\)[\s\S]*这次只选择故事保存位置[\s\S]*不会生成参考、提交视频或导出/, "Local-project setup confirmations must use a dedicated save-location boundary sentence instead of generic save-target copy"));
checkMessage(requireWithin(minimalAgentPanelSource, /function minimalAgentConfirmationAction\(message: MinimalAgentMessage,\s*fallbackLabel: string\)[\s\S]*草案\|故事流\|写入故事\|保存故事\|确认故事[\s\S]*label: NEW_VIDEO_DRAFT_CONFIRM_LABEL/, "Story-save confirmation cards must keep concrete draft-confirmation copy instead of generic execution copy"));
checkMessage(requireWithin(minimalAgentPanelSource, /function minimalAgentConfirmationReadableBody\(message: MinimalAgentMessage\)[\s\S]*isNewVideoDraftConfirmationLabel\(confirmationAction\.label\) \|\| \/保存故事\|确认故事\/\.test\(combinedCopy\)[\s\S]*这一步只保存故事，不会生成参考或提交视频[\s\S]*minimalAgentMessageIsLocalProjectSetup\(message\)[\s\S]*这一步只选择故事保存位置，不会生成参考、提交视频或导出[\s\S]*projectOnlyChange[\s\S]*这一步只更新项目草案，不会生成参考或提交视频/, "Story-save and local-project setup confirmation bodies must explain scoped actions before generic project-edit copy"));
checkMessage(requireWithin(minimalAgentPanelSource, /function minimalAgentConfirmationReadableBody\(message: MinimalAgentMessage\)[\s\S]*message\.actionKind === "prepare_export"[\s\S]*确认后才会写入本地导出文件[\s\S]*这一步会调用外部服务/, "Export confirmation bodies must describe local file writes before the generic external-service fallback"));
checkMessage(requireWithin(minimalAgentPanelSource, /function minimalAgentConfirmationCostPhrase\(costFact: string\)[\s\S]*参考生成[\s\S]*会生成参考图[\s\S]*Seedance\|视频提交[\s\S]*会提交 Seedance 视频任务[\s\S]*查询[\s\S]*只查询已有任务[\s\S]*导出[\s\S]*会生成交付包[\s\S]*function minimalAgentConfirmationBoundary\(message: MinimalAgentMessage\)[\s\S]*minimalAgentConfirmationTargetPhrase\(message,\s*targetFact\)[\s\S]*minimalAgentConfirmationCostPhrase\(costFact\)[\s\S]*确认前再核对/, "Agent confirmation boundary should read as one natural pre-confirmation sentence, not a debug fact list"));
checkMessage(requireWithin(minimalAgentPanelSource, /function minimalAgentConfirmationReadableBody\(message: MinimalAgentMessage\)[\s\S]*minimalAgentConfirmationAction\(message,\s*"确认执行"\)[\s\S]*我准备[\s\S]*确认后才执行/, "Agent confirmation card body must read like a chat reply that says what the Agent is about to do"));
checkMessage(requireWithin(minimalAgentPanelSource, /function minimalAgentMessageBody\(message: MinimalAgentMessage\)[\s\S]*minimalAgentMessageRequestsActionConfirmation\(message\)[\s\S]*minimalAgentConfirmationReadableBody\(message\)[\s\S]*cleanMinimalAgentMessageCopy\(message\.body\)[\s\S]*const messageBody = minimalAgentMessageBody\(message\)[\s\S]*<p>\{messageBody\}<\/p>/, "Agent thread rendering must use the readable body helper for confirmation cards and normal copy for ordinary messages"));
checkMessage(requireWithin(minimalAgentPanelSource, /function minimalAgentCompactFactLabels\(message: MinimalAgentMessage\)[\s\S]*message\.role === "user"[\s\S]*new Set<string>\(\)[\s\S]*message\.entryType === "assistant_message" && message\.title === "我理解为"[\s\S]*new Set<string>\(\)[\s\S]*function minimalAgentVisibleFacts\(message: MinimalAgentMessage\)[\s\S]*const compactLabels = minimalAgentCompactFactLabels\(message\)[\s\S]*compactLabels && !compactLabels\.has\(label\)/, "Agent thread must keep user and understanding messages readable by hiding low-value debug fact chips"));
checkMessage(requireWithin(minimalAgentPanelSource, /if \(action === referenceFooterAction \|\| action === endFrameFooterAction\) \{[\s\S]*const targetLabel = "当前项目缺少的参考"[\s\S]*\{ label: "目标", value: targetLabel \}/, "Automatic reference-generation confirmation must target the project gap instead of the default selected shot"));
checkMessage(requireWithin(minimalAgentPanelSource, /function cleanMinimalAgentMessageCopy\(value: string\)[\s\S]*不会提交\\s\*\(\?:Seedance\|即梦\)\(\?:\\s\*视频任务\)\?[\s\S]*不提交视频/, "Agent thread must clean old Seedance/Jimeng no-submit boundary wording before rendering"));
checkMessage(requireWithin(minimalAgentPanelSource, /function cleanMinimalAgentMessageCopy\(value: string\)[\s\S]*会提交外部视频任务[\s\S]*会提交 Seedance 视频任务[\s\S]*不会提交外部视频任务[\s\S]*不提交视频/, "Agent thread must clean old external-video-task wording before rendering"));
checkMessage(requireWithin(minimalAgentPanelSource, /function cleanMinimalAgentMessageCopy\(value: string\)[\s\S]*Image2[\s\S]*生成参考图[\s\S]*会调用参考生成[\s\S]*会生成参考图/, "Agent thread must clean old image-generation/provider wording before rendering"));
check(!/对象：|成本：|写入：|外部：/.test(minimalAgentPanelSource), "Agent confirmation boundary must not expose debug-style colon labels");
checkMessage(requireWithin(minimalAgentPanelSource, /function minimalAgentVisibleFacts\(message: MinimalAgentMessage\)[\s\S]*minimalAgentMessageRequestsActionConfirmation\(message\)[\s\S]*new Set\(\["成本",\s*"外部提交",\s*"写入",\s*"保存"\]\)[\s\S]*hiddenConfirmationLabels\.has\(label\)/, "Agent confirmation fact chips must hide engineering-style cost/write/external labels and leave those boundaries in natural copy"));
checkMessage(requireWithin(minimalAgentPanelSource, /function minimalAgentReadableConfirmationFact\(fact: \{ label: string; value: string \}\)[\s\S]*label === "成本"[\s\S]*label: "会发生"[\s\S]*label === "外部提交"[\s\S]*label: \/不提交\|不会提交\|只生成参考图\/\.test\(value\) \? "保护" : "提交"[\s\S]*function minimalAgentReadableConfirmationFacts\(facts: Array<\{ label: string; value: string \}>\)[\s\S]*facts\.map\(minimalAgentReadableConfirmationFact\)[\s\S]*function timelineResultView/, "Visible confirmation action strip must map engineering labels such as cost/external submission into creator-facing labels"));
checkMessage(requireWithin(minimalAgentPanelSource, /function visibleMessageConfirmationFacts\(message: MinimalAgentMessage\)[\s\S]*visiblePendingDraftShotFacts\([\s\S]*minimalAgentReadableConfirmationFacts\(minimalAgentMessageConfirmationFacts\(message\)\)[\s\S]*false/, "Visible message confirmation facts must pass through creator-facing label mapping before rendering"));
checkMessage(requireWithin(minimalAgentPanelSource, /function minimalAgentMessageInlineConfirmationFactsAreRedundant\(message: MinimalAgentMessage\)[\s\S]*message\.id === "footer_action_export" && message\.actionKind === "prepare_export"[\s\S]*const messageConfirmationFacts = visibleMessageConfirmationFacts\(message\)[\s\S]*const showMessageConfirmationFacts = messageConfirmationFacts\.length > 0[\s\S]*!minimalAgentMessageInlineConfirmationFactsAreRedundant\(message\)[\s\S]*showMessageConfirmationFacts/, "Export Agent confirmation cards must avoid showing the same package facts twice in both the card summary and post-confirmation strip"));
checkMessage(requireWithin(minimalAgentPanelSource, /function minimalAgentMessageInlineConfirmationFactsAreRedundant\(message: MinimalAgentMessage\)[\s\S]*minimalAgentMessageIsWaitingConfirmation\(message\) && minimalAgentMessageIsProjectDraftEdit\(message\)[\s\S]*const showMessageConfirmationFacts = messageConfirmationFacts\.length > 0[\s\S]*!minimalAgentMessageInlineConfirmationFactsAreRedundant\(message\)/, "Project-edit Agent confirmation cards must avoid repeating the same contract below the card summary"));
checkMessage(requireWithin(minimalAgentPanelSource, /function minimalAgentMessageIsReferenceGenerationConfirmation\(message: MinimalAgentMessage\)[\s\S]*确认生成参考[\s\S]*function minimalAgentMessageInlineConfirmationFactsAreRedundant\(message: MinimalAgentMessage\)[\s\S]*minimalAgentMessageIsReferenceGenerationConfirmation\(message\)[\s\S]*const showMessageConfirmationFacts = messageConfirmationFacts\.length > 0[\s\S]*!minimalAgentMessageInlineConfirmationFactsAreRedundant\(message\)/, "Reference-generation Agent confirmation cards must avoid repeating the same generation facts twice in both the card summary and post-confirmation strip"));
checkMessage(requireWithin(minimalAgentPanelSource, /function minimalAgentMessageIsProjectDraftEdit\(message: MinimalAgentMessage\)[\s\S]*改成\\s\*\\d\+\\s\*个镜头\|重排为\\s\*\\d\+\\s\*个镜头\|当前故事改成/, "Recovered shot-count edit confirmations must be classified as project edits even without actionKind"));
checkMessage(requireWithin(minimalAgentPanelSource, /const looksLikeNewStoryDraft = \/加入项目计划\|故事已确认\|确认故事\|待确认草案\|确认这版故事\|正式故事\|故事流\/\.test\(combinedCopy\)[\s\S]*if \(looksLikeNewStoryDraft && !explicitShotCountEdit\) return false/, "Fresh story draft confirmations must keep story-confirmation wording instead of being mislabeled as project edits"));
checkMessage(requireWithin(minimalAgentPanelSource, /if \(message\.actionKind === "revise_story_or_shot"\)[\s\S]*const concreteProjectEditLabel = minimalAgentProjectDraftEditConfirmationLabel\(message\)[\s\S]*label: concreteProjectEditLabel \|\| "确认修改"[\s\S]*if \(minimalAgentMessageIsProjectDraftEdit\(message\)\) \{[\s\S]*const concreteProjectEditLabel = minimalAgentProjectDraftEditConfirmationLabel\(message\)[\s\S]*label: concreteProjectEditLabel \|\| "确认修改"[\s\S]*function minimalAgentProjectDraftEditConfirmationLabel\(message: MinimalAgentMessage\)[\s\S]*requestedStoryboardShotCountFromIntent\(combinedCopy\)[\s\S]*确认重排为/, "Recovered shot-count project-edit confirmations must render a concrete confirmation action such as 确认重排为 3 个镜头"));
checkMessage(requireWithin(minimalAgentPanelSource, /function minimalAgentMessageTitleLabel\(message: MinimalAgentMessage\)[\s\S]*title === "请求确认" \|\| title === "确认修改项目" \|\| \/\^请确认\[:：\]\\s\*确认修改项目\$\/\.test\(title\)[\s\S]*minimalAgentConfirmationAction\(message,\s*"确认执行"\)\.label/, "Generic project-edit confirmation titles must render as the concrete action label in the visible message flow"));
checkMessage(requireWithin(minimalAgentPanelSource, /function minimalAgentMessageIsWaitingConfirmation\(message: MinimalAgentMessage\) \{[\s\S]*const confirmationFinished = message\.status === "done"[\s\S]*message\.entryType === "confirmation_request"/, "Timeline confirmation requests must keep rendering as waiting confirmations unless they have explicitly finished"));
checkMessage(requireWithin(minimalAgentPanelSource, /const visibleComposerDomInputText = text\.trim\(\)[\s\S]*const hasVisibleComposerInput = Boolean\(visibleComposerDomInputText \|\| attachments\.length\)/, "Message confirmation rendering must know whether the composer visibly contains text, separate from fallback refs"));
checkMessage(requireWithin(minimalAgentPanelSource, /const \[composerEditingConfirmationLabel,\s*setComposerEditingConfirmationLabel\] = useState\(""\)/, "Right Agent must keep the concrete confirmation label while the composer is editing that confirmation"));
checkMessage(requireWithin(minimalAgentPanelSource, /onEditingPendingConfirmationChange\?: \(active: boolean\) => void[\s\S]*const composerEditingPendingConfirmation = Boolean\([\s\S]*hasVisibleComposerInput[\s\S]*visibleTimelineConfirmationMessage[\s\S]*currentTimelineConfirmationLabel[\s\S]*composerEditingConfirmationLabel[\s\S]*editingSkillSaveConfirmationActive[\s\S]*restoredAgentStagedPlanDraft\?\.status === "active"[\s\S]*blockedReasons\.includes\("user_confirmation_required"\)[\s\S]*toolHandoff\?\.blockers\.includes\("user_confirmation_required"\)[\s\S]*onEditingPendingConfirmationChange\?\.\(composerEditingPendingConfirmation\)[\s\S]*return \(\) => onEditingPendingConfirmationChange\?\.\(false\)/, "Right Agent must tell the parent when a visible composer draft is editing a pending confirmation, including saved-label, save-Skill, and restored staged plans"));
checkMessage(requireWithin(minimalAgentPanelSource, /function updateText\(value: string\)[\s\S]*setText\(value\)[\s\S]*if \(!value\.trim\(\)\) \{[\s\S]*setComposerEditingConfirmationLabel\(""\)[\s\S]*onEditingPendingConfirmationChange\?\.\(false\)/, "Clearing the Agent composer must clear the edited confirmation label and restore the parent workbar from confirmation-editing mode"));
checkMessage(requireWithin(minimalAgentPanelSource, /function reviseFromAgentMessage\(message: MinimalAgentMessage\)[\s\S]*minimalAgentMessageRequestsActionConfirmation\(message\)[\s\S]*setComposerEditingConfirmationLabel\(minimalAgentConfirmationAction\(message,\s*primaryLabel\)\.label\)[\s\S]*onEditingPendingConfirmationChange\?\.\(true\)[\s\S]*setText\(revisionIntent\)/, "Clicking revise on a confirmation card must immediately put the parent workbar into confirmation-editing mode with the concrete label"));
checkMessage(requireWithin(minimalAgentPanelSource, /function handleSend\(\)[\s\S]*setText\(""\)[\s\S]*liveComposerValueRef\.current = ""[\s\S]*lastVisibleComposerInputRef\.current = ""[\s\S]*setComposerEditingConfirmationLabel\(""\)[\s\S]*onEditingPendingConfirmationChange\?\.\(false\)/, "Sending edited confirmation text must clear parent confirmation-editing mode and edited label"));
checkMessage(requireWithin(minimalAgentPanelSource, /onCurrentTaskProjectionChange\?: \(projection: AgentCurrentTaskProjection \| undefined\) => void[\s\S]*useEffect\(\(\) => \{[\s\S]*onCurrentTaskProjectionChange\?\.\(agentCurrentTaskProjection\)[\s\S]*\}, \[agentCurrentTaskProjection, onCurrentTaskProjectionChange\]\)[\s\S]*onCurrentTaskProjectionChange\?\.\(undefined\)/, "Right Agent must publish and clear the complete projected task for the parent workbar"));
checkMessage(requireWithin(minimalAgentPanelSource, /function agentCurrentTaskConfirmationMessage\([\s\S]*projection\.confirmationId[\s\S]*projection\.actionId[\s\S]*agentCurrentTaskStepFromMessage\(message\) === projection\.step[\s\S]*const activeConfirmationMessage = agentCurrentTaskConfirmationMessage\([\s\S]*agentCurrentTaskProjection,[\s\S]*agentThreadMessages/, "Project-edit and other confirmations must become active only through AgentCurrentTaskProjection"));
checkMessage(requireWithin(minimalAgentPanelSource, /message\.id === latestLocalProjectBlockedMessageId && !localProjectReadyForTools && !activeConfirmationMessageId[\s\S]*选择保存位置/, "Save-location recovery actions must hide while the projection owns a confirmation"));
checkMessage(requireWithin(minimalAgentPanelSource, /minimalAgentMessageRequestsActionConfirmation\(message\) && message\.id === activeConfirmationMessageId && !minimalAgentMessageRequestsSkillSave\(message\)[\s\S]*const confirmationDisabled = confirmationIsNewVideoDraftAction[\s\S]*hasComposerInput[\s\S]*onClick=\{\(\) => reviseFromAgentMessage\(message\)\}/, "The projection-selected confirmation must expose revise while composer input only disables its primary action"));
checkMessage(requireWithin(minimalAgentPanelSource, /const agentThreadMessagesForProjectedTask = agentThreadMessagesForCurrentFocus\.filter[\s\S]*!minimalAgentMessageIsWaitingConfirmation\(message\)[\s\S]*message\.id === activeConfirmationMessageId[\s\S]*const displayedAgentThreadMessages: MinimalAgentMessage\[\][\s\S]*isMinimalAgentSelectionContextId\(message\.id\)[\s\S]*可以确认「\$\{activeConfirmationActionLabel\}」，也可以继续说改法[\s\S]*const orderedDisplayedAgentThreadMessages = activeConfirmationMessageId[\s\S]*message\.id === activeConfirmationMessageId[\s\S]*message\.id !== activeConfirmationMessageId[\s\S]*orderedDisplayedAgentThreadMessages\.map/, "Visible selection context cards must point to the projected active confirmation, filter stale waiting cards, and keep the active confirmation first"));
checkMessage(requireWithin(minimalAgentPanelSource, /activeConfirmationMessageId[\s\S]*minimalAgentConfirmationAction\(message,\s*primaryLabel\)[\s\S]*const confirmationIsNewVideoDraftAction = agentCurrentTaskProjection\.step === "confirm_story"[\s\S]*const confirmationUsesPrimaryAction = \[[\s\S]*\.includes\(agentCurrentTaskProjection\.step\)[\s\S]*const confirmationDisabled = confirmationIsNewVideoDraftAction[\s\S]*const confirmationButtonLabel = confirmationAction\.label[\s\S]*const confirmationButtonHint = confirmationIsNewVideoDraftAction[\s\S]*从项目记录恢复的待确认动作[\s\S]*const runConfirmationAction = \(\) => \{[\s\S]*confirmDraftFromAgent[\s\S]*startLocalProjectSetupFromMessage[\s\S]*confirmPlan\(\)[\s\S]*handleNext\(\)[\s\S]*prepareChange\(agentMessageConfirmationIntent\(message,\s*confirmationAction\.label\),\s*currentComposerSelectionOverride\(\)\)[\s\S]*onClick=\{runConfirmationAction\}[\s\S]*disabled=\{confirmationDisabled\}[\s\S]*\{confirmationButtonLabel\}/, "The projected Agent confirmation must expose the concrete action for its structured task"));
checkMessage(requireWithin(minimalAgentPanelSource, /activeConfirmationMessageId[\s\S]*const confirmationBoundary = minimalAgentConfirmationBoundary\(message\)[\s\S]*className="minimal-agent-confirmation-boundary"[\s\S]*\{confirmationBoundary\}/, "The projected Agent confirmation must show its boundary before the action buttons"));
checkMessage(requireWithin(minimalAgentPanelSource, /const draftContextActive = Boolean\([\s\S]*newVideoDraftBusyForAgent[\s\S]*newVideoDraftPlanningForAgent[\s\S]*footerNewVideoDraftConfirmationReady[\s\S]*const footerProjectPlanHint = draftContextActive[\s\S]*草案出来后[\s\S]*videoPermissionBlockedByContract[\s\S]*当前只整理故事和镜头[\s\S]*footerProjectPlanHint[\s\S]*也可以继续补充想法/, "New-video draft and planning-only Agent footer hints must not reuse stale project readiness plans about reference review or video generation"));
checkMessage(requireWithin(minimalAgentPanelSource, /const displayedAgentBoundaryConfirmationLabel = !hasVisibleComposerInput && agentCurrentTaskProjection\.requiresConfirmation[\s\S]*\? agentCurrentTaskProjection\.label[\s\S]*const displayedAgentBoundarySummaryLabel = editingReferenceGenerationConfirmationActive[\s\S]*const displayedAgentBoundaryDetail = composerToolIntentShouldYieldToProjectEditConfirmation[\s\S]*displayedAgentBoundaryConfirmationLabel[\s\S]*当前等待你确认[\s\S]*const displayedWorkModeSummaryLabel = visibleConfirmationLocksWorkMode[\s\S]*确认卡接管[\s\S]*displayedAgentBoundarySummaryLabel[\s\S]*<strong>\{displayedWorkModeSummaryLabel\}<\/strong>[\s\S]*<small>\{displayedAgentBoundaryDetail\}<\/small>/, "The visible work-mode summary must use the projection label for the actual waiting task while preserving composer-editing explanations"));
checkMessage(requireWithin(minimalAgentPanelSource, /const pendingTimelineConfirmationStepForContext = pendingTimelineConfirmationMessageForContext[\s\S]*agentCurrentTaskStepFromMessage\(pendingTimelineConfirmationMessageForContext\)[\s\S]*const localProjectSetupComposerIntentActive = Boolean\([\s\S]*!localProjectReady \|\| !runtimeProjectRootIsLocalFolder\(runtimeState\.project\.root\)[\s\S]*intentNeedsLocalProjectBeforeTooling\(text\)[\s\S]*const localProjectSetupConfirmationContextActive = pendingTimelineConfirmationStepForContext === "choose_save_location"[\s\S]*localProjectSetupComposerIntentActive[\s\S]*const composerReferenceGenerationSelectionChips = composerReferenceGenerationFromReferencePlan && !composerIntentNeedsLocalProject/, "Unsaved confirmed-story tool requests must keep structured save-location context ahead of reference-generation selection chips"));
checkMessage(minimalAgentPanelSource.includes("确认参考计划") ? "Reference-generation confirmations must not use vague plan-only CTA copy once the action will generate references" : undefined);
checkMessage(requireWithin(minimalAgentPanelSource, /const visibleConfirmationLocksWorkMode = Boolean\([\s\S]*activeConfirmationMessageId[\s\S]*displayedAgentBoundaryConfirmationLabel[\s\S]*!hasVisibleComposerInput[\s\S]*确认卡已锁定[\s\S]*const displayedWorkModeSummaryLabel = visibleConfirmationLocksWorkMode[\s\S]*确认卡接管[\s\S]*displayedAgentBoundarySummaryLabel/, "Visible Agent confirmations must lock the work-mode panel and collapsed summary to a short confirmation-card handoff"));
checkMessage(requireWithin(minimalAgentPanelSource, /工作方式[\s\S]*<strong>\{displayedWorkModeSummaryLabel\}<\/strong>[\s\S]*visibleConfirmationLocksWorkMode[\s\S]*aria-label="AI 导演工作方式已锁定"[\s\S]*确认卡接管[\s\S]*lockedWorkModeDetail[\s\S]*更改 AI 导演工作方式[\s\S]*选择工作方式[\s\S]*AI 导演工作方式：\$\{item\.label\}[\s\S]*!visibleConfirmationLocksWorkMode && visibleAgentCapabilityGlanceItems/, "Agent execution boundary controls must read as creator-facing AI director work modes, while active confirmations hide disabled mode switches and capability chips"));
checkMessage(requireWithin(minimalAgentPanelSource, /function agentCapabilityItems[\s\S]*const referenceCapabilityValue = !contract\.referenceGenerationAllowed[\s\S]*\? "仅计划"[\s\S]*availability\.referenceGenerationReady[\s\S]*\? "可生成"[\s\S]*id: "reference"[\s\S]*label: "参考"[\s\S]*value: referenceCapabilityValue[\s\S]*aria-label="AI 导演当前能力"/, "Expanded work-mode capability chips must show plan-only reference state as 参考 / 仅计划 instead of 生成参考 / 先整理"));
checkMessage(requireWithin(minimalAgentPanelSource, /function visibleIdleActionSuggestionForPermission\([\s\S]*contract\.mode !== "plan_only" \|\| item\.kind !== "prepare_reference_generation"[\s\S]*label: "准备参考计划"[\s\S]*确认前不会生成图片，也不会提交视频[\s\S]*const idleActionSuggestions = !workflow[\s\S]*\.map\(\(item\) => visibleIdleActionSuggestionForPermission\(item, currentVideoPermissionContract\)\)[\s\S]*aria-label="AI 导演建议下一步"[\s\S]*\{item\.label\}/, "Expanded work-mode suggestions must show plan-only reference work as preparing a reference plan, not as direct image generation"));
checkMessage(requireWithin(stylesSource, /\.minimal-agent-permission-mode small[\s\S]*font-size:\s*11px[\s\S]*\.minimal-agent-permission-mode\.is-locked[\s\S]*display:\s*grid[\s\S]*\.minimal-agent-permission-mode\.is-locked span[\s\S]*min-width:\s*0/, "Locked work-mode confirmation handoff must have compact styling instead of inheriting the mode-switch layout"));
checkMessage(requireWithin(agentPanelProjectionSource, /agentVideoSubmitContractLabel[\s\S]*先整理[\s\S]*可补参考[\s\S]*可发视频[\s\S]*可以补参考/, "Agent permission labels must stay creator-facing and avoid implying immediate execution"));
checkMessage(requireWithin(minimalAgentPanelSource, /previewResult\?\.agentTimelineEntries\?\.length[\s\S]*setAgentTimelineEntries\(previewResult\.agentTimelineEntries\)/, "MinimalAgentPanel must refresh messages after confirmed Agent execution"));
checkMessage(requireWithin(minimalAgentPanelSource, /stagedAgentPlan\?\.agentKernelTurn[\s\S]*setLatestAgentKernelTurn\(stagedAgentPlan\.agentKernelTurn\)/, "MinimalAgentPanel must keep the structured Kernel turn after staging a plan"));
checkMessage(requireWithin(minimalAgentPanelSource, /previewResult\?\.agentKernelTurn[\s\S]*setLatestAgentKernelTurn\(previewResult\.agentKernelTurn\)/, "MinimalAgentPanel must refresh the structured Kernel turn after confirmed execution"));
checkMessage(requireWithin(minimalAgentPanelSource, /function agentKernelCapabilityItem\(turn: VibeAgentKernelTurn\)[\s\S]*turn\.executionResult\.status[\s\S]*需处理[\s\S]*等确认[\s\S]*执行中/, "MinimalAgentPanel must surface Kernel execution status in the existing Agent capability strip"));
checkMessage(requireWithin(agentCoreToolEventsSource, /buildVibeAgentTurnTimelineEntries[\s\S]*buildPlanNextActionResultEntry\(input,\s*suffix\),[\s\S]*buildExecutionBoundaryResultEntry\(input,\s*suffix\),[\s\S]*buildWriteAgentMessageCallEntry/, "Agent Core must persist the Kernel execution boundary into the message timeline before the final assistant reply"));
checkMessage(requireWithin(agentCoreToolEventsSource, /function buildExecutionBoundaryResultEntry[\s\S]*title:\s*"执行边界"[\s\S]*成本[\s\S]*写入[\s\S]*外部提交[\s\S]*确认[\s\S]*下一步/, "Execution boundary timeline entry must expose cost, writes, external submission, confirmation, and next-step facts"));
checkMessage(requireWithin(agentCoreToolEventsSource, /function executionBoundaryBodyFor[\s\S]*会提交 Seedance 串行任务/, "Execution boundary copy must explain external Seedance submission in creator language"));
checkMessage(requireWithin(agentCoreToolEventsSource, /function executionBoundaryBodyFor[\s\S]*我会停在这里等你确认/, "Execution boundary copy must explain waiting-for-confirmation state in creator language"));
checkMessage(requireWithin(agentCoreToolEventsSource, /function executionBoundaryBodyFor[\s\S]*你已经确认，我会开始执行/, "Execution boundary copy must explain confirmed execution state in creator language"));
checkMessage(requireWithin(agentCoreToolEventsSource, /function confirmedExecutionResultFor[\s\S]*status === "blocked"[\s\S]*"failed"[\s\S]*"cancelled"[\s\S]*"running"[\s\S]*"succeeded"/, "Confirmed Agent tool outcomes must collapse into the Agent Kernel executionResult statuses"));
checkMessage(requireWithin(agentCoreToolEventsSource, /buildVibeAgentConfirmedActionReportEntry[\s\S]*const executionResult = confirmedExecutionResultFor\(input\.outcome,\s*nextStep\)[\s\S]*executionResult/, "Confirmed user-facing action reports must carry the structured Agent Kernel executionResult"));
checkMessage(requireWithin(agentCoreToolEventsSource, /buildVibeAgentConfirmedActionToolResultEntry[\s\S]*const executionResult = confirmedExecutionResultFor\(input\.outcome,\s*nextStep\)[\s\S]*executionResult/, "Confirmed tool result cards must carry the structured Agent Kernel executionResult"));
checkMessage(requireWithin(agentCoreToolEventsSource, /buildVibeAgentConfirmedActionReportEntry[\s\S]*\{ label: "对象", value: selectedContext\.label \}[\s\S]*buildVibeAgentConfirmedActionToolResultEntry[\s\S]*\{ label: "对象", value: selectedContext\.label \}[\s\S]*buildVibeAgentConfirmedActionStartedEntry[\s\S]*\{ label: "对象", value: selectedContext\.label \}/, "Confirmed Agent execution cards must name the concrete selected object, not only the affected count"));
checkMessage(requireWithin(agentCoreToolEventsSource, /const resultFacts = confirmedOutcomeResultFacts\(input\.outcome\)[\s\S]*\.\.\.resultFacts[\s\S]*details:\s*\{[\s\S]*resultFacts/, "Confirmed Agent result cards must surface concrete result facts such as submit ids, media paths, and export manifests"));
checkMessage(requireWithin(confirmedActionOutcomeSource, /function videoResultFacts[\s\S]*提交号[\s\S]*视频[\s\S]*提示词/, "Confirmed video tool outcomes must expose submit id, media path, and prompt path as result facts"));
checkMessage(requireWithin(confirmedActionOutcomeSource, /function relayQueueFacts[\s\S]*队列[\s\S]*提交号[\s\S]*视频/, "Confirmed video tool outcomes must expose relay queue progress as result facts"));
checkMessage(requireWithin(confirmedActionOutcomeSource, /function exportResultFacts[\s\S]*导出目录[\s\S]*清单[\s\S]*写入/, "Confirmed export tool outcomes must expose export folder, manifest, and write count as result facts"));
checkMessage(requireWithin(minimalAgentPanelSource, /function rememberLocalProjectBlockForIntent\(userIntent: string\)[\s\S]*rememberAgentTimelineEntries\(buildLocalBlockedAgentTimelineEntries[\s\S]*title: "AI 导演：需要保存位置"[\s\S]*\{ label: "你想做", value: blockedIntentLabel \}[\s\S]*\{ label: "先做", value: "选择保存位置" \}[\s\S]*if \(composerNeedsLocalProject\) \{[\s\S]*rememberLocalProjectBlockForIntent\(currentTypedIntent\)/, "MinimalAgentPanel must append and persist typed Agent messages with an Agent-first save-location action when a temporary project blocks tool execution"));
checkMessage(requireWithin(minimalAgentPanelSource, /buildLocalBlockedAgentTimelineEntries[\s\S]*type:\s*"confirmation_request"[\s\S]*title:\s*"选择保存位置"[\s\S]*不会生成参考、提交视频或导出[\s\S]*toolName:\s*"write_project"/, "Local-project blockers must add a visible Agent save-location confirmation card before opening the folder picker"));
checkMessage(requireWithin(minimalAgentPanelSource, /if \(projectRequiredForWorkflow\) \{[\s\S]*id: "footer_action_project_setup"[\s\S]*title: "建议行动：选择保存位置"[\s\S]*只会让你选择这版故事的保存位置[\s\S]*不会生成参考、提交视频或导出[\s\S]*toolName: "write_project"/, "Confirmed temporary projects must surface save-location setup as an Agent confirmation card, not only as hint text"));
checkMessage(requireWithin(minimalAgentPanelSource, /const footerDirectActionBoundaryNotice = projectRequiredForWorkflow \|\| projectBlockedWithoutFooterResolver[\s\S]*\?\s*""[\s\S]*:\s*footerDirectActionBoundaryFor\(footerDirectAction\)/, "Save-location setup must suppress stale reference/video direct-action boundary copy in the bottom composer"));
checkMessage(requireWithin(minimalAgentPanelSource, /const agentDrivenContinueIntent = isContinueIntent\(userIntent\)[\s\S]*const actionExecutionPermissionContract = agentDrivenContinueIntent[\s\S]*\?\s*undefined[\s\S]*:\s*nextActionVideoPermissionContract/, "Typed continue should let the Agent stage the next action permission instead of hard-passing the current UI mode"));
checkMessage(requireWithin(minimalAgentPanelSource, /executionContract:\s*agentActionExecutionPermissionContract[\s\S]*directorAgentExecutionContractFromCreatorBoundary/, "Local Agent action construction must omit the explicit execution contract for Agent-driven continue"));
checkMessage(requireWithin(minimalAgentPanelSource, /videoPermissionContract:\s*agentActionExecutionPermissionContract[\s\S]*availability:\s*currentAgentToolAvailability\(localAgentActionEnvelope\)/, "Product Agent stage call must omit the explicit execution contract for Agent-driven continue while using action-specific availability"));
checkMessage(requireWithin(minimalAgentPanelSource, /agentVideoPermissionContractForAction\([\s\S]*nextAgentActionEnvelope[\s\S]*videoPermissionContract:\s*preparedAgentPermissionContract/, "Prepared Agent context must store the chosen action permission for confirmation"));
checkMessage(requireWithin(minimalAgentPanelSource, /confirmedToolVideoPermissionContract[\s\S]*agentVideoPermissionContractForAction\([\s\S]*videoPermissionContract:\s*confirmedToolVideoPermissionContract/, "Confirmed Agent tool execution must use the chosen action permission instead of the stale global UI mode"));
checkMessage(requireWithin(stylesSource, /\.minimal-agent-message\.tool[\s\S]*\.minimal-agent-message\.confirmation/, "Agent message styles must distinguish tool events and confirmation requests"));
checkMessage(requireWithin(stylesSource, /\.minimal-agent-message-title[\s\S]*\.minimal-agent-message-stage/, "Agent message headers must style the stage label without adding a new panel"));
checkMessage(requireWithin(stylesSource, /\.minimal-agent-message-status\.waiting[\s\S]*\.minimal-agent-message-status\.blocked[\s\S]*\.minimal-agent-message-status\.done/, "Agent message state badges must visually distinguish waiting, blocked, and done states"));
checkMessage(requireWithin(stylesSource, /\.minimal-agent-confirmation-boundary[\s\S]*flex:\s*1 0 100%[\s\S]*font-size:/, "Agent confirmation boundary must be visible in the message card instead of hidden in a title"));
checkMessage(requireWithin(stylesSource, /\.minimal-agent-message-actions button:disabled[\s\S]*background:\s*rgba\(47,\s*39,\s*34,\s*0\.08\)[\s\S]*color:\s*rgba\(47,\s*39,\s*34,\s*0\.46\)[\s\S]*cursor:\s*not-allowed[\s\S]*opacity:\s*1/, "Disabled Agent confirmation buttons must not keep the active primary-button appearance"));
checkMessage(requireWithin(minimalAgentLanguageSurface, /发送[\s\S]*确认修改/, "MinimalAgentPanel confirmation action labels"));
checkMessage(requireWithin(minimalAgentPanelSource, /className="minimal-agent-send-button"[\s\S]*onPointerDown=\{handleSendPointerDown\}[\s\S]*onClick=\{handleSendClick\}[\s\S]*<Send size=\{15\} \/>/, "MinimalAgentPanel primary composer action must stay a send button; workflow confirmation belongs to Agent messages"));
checkMessage(requireWithin(minimalAgentPanelSource, /const primaryAriaLabel = primaryDisabled[\s\S]*primaryDisabledReason[\s\S]*footerPrimaryAriaLabel/, "MinimalAgentPanel primary action must keep blocker details in accessible labels"));
checkMessage(requireWithin(minimalAgentPanelSource, /const composerPrimaryIsFresh = hasComposerInput \|\| !workflow \|\| planPhase === "idle" \|\| planPhase === "confirmed"[\s\S]*void prepareChange\(\)/, "MinimalAgentPanel must let new bottom input replace a pending staged plan through the unified primary operation"));
checkMessage(requireWithin(minimalAgentPanelSource, /function\s+revisePlan[\s\S]*previousIntent[\s\S]*setText\(previousIntent\)/, "MinimalAgentPanel must restore the last feedback text when the creator chooses to revise"));
checkMessage(requireWithin(minimalAgentPanelSource, /创作者路径/, "MinimalAgentPanel must label the creator path"));
checkMessage(requireWithin(minimalAgentPanelSource, /描述修改[\s\S]*生成计划[\s\S]*确认应用/, "MinimalAgentPanel must show a simple creator path"));
checkMessage(requireWithin(minimalAgentPanelSource, /修改计划详情/, "MinimalAgentPanel staged plan must use simplified plan copy"));
checkMessage(requireWithin(minimalAgentPanelSource, /故事 \/ 镜头 \/ 复核/, "MinimalAgentPanel staged plan must name the final write targets in user copy"));
checkMessage(requireWithin(minimalAgentPanelSource, /readOnlyStatusInspection[\s\S]*qaFeedbackFacts\(preparedContext\?\.qaFeedback\)/, "Read-only Agent status checks must surface QA feedback in the visible plan facts"));
checkMessage(requireWithin(minimalAgentPanelSource, /function\s+suggestedIntentFromQaFeedback[\s\S]*primaryAction[\s\S]*按项目检查修复/, "Read-only Agent status follow-up must turn QA feedback into a repair intent"));
checkMessage(requireWithin(minimalAgentPanelSource, /suggestedIntentFromStatusInspection\(agentActionEnvelope,\s*preparedContext\?\.qaFeedback\)/, "Status inspection continue action must prioritize QA repair feedback"));
checkMessage(requireWithin(minimalAgentPanelSource, /agentActionPathItems\(agentActionEnvelope,\s*preparedContext\?\.qaFeedback\)/, "Status action path must include QA repair feedback"));
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
checkMessage(requireWithin(minimalTopNav, /className="minimal-nav minimal-nav-menu"[\s\S]*aria-label="项目内容"/, "Top navigation should collapse story/reference/preview into one content menu"));
checkMessage(requireWithin(minimalTopNav, /minimal-nav-label">查看[\s\S]*aria-label="参考素材"/, "Top content menu asset view must use product copy"));
checkMessage(requireWithin(minimalTopNav, /aria-label="视频"[\s\S]*>\s*视频\s*</, "Top content menu video view must use product copy"));
checkMessage(requireWithin(minimalTopNav, /viewMenuOpen && \([\s\S]*className="minimal-nav-menu-list"[\s\S]*aria-label="参考素材"[\s\S]*aria-label="视频"/, "Top content menu list must render only while the menu is open"));
checkMessage(requireWithin(stylesSource, /\.minimal-nav\.minimal-nav-menu:not\(\[open\]\) \.minimal-nav-menu-list\s*\{[\s\S]*display:\s*none/, "Top content menu list must stay hidden while the menu is closed"));
checkMessage(requireWithin(minimalTopNav, /directorView === "export"[\s\S]*\? "交付"[\s\S]*\? "项目交付"/, "Top content menu summary must reflect the delivery view instead of falling back to story"));
checkMessage(requireWithin(minimalTopNav, /topbar-export-action[\s\S]*title=\{exportDisabled \? exportDisabledTitle : "查看交付页"\}[\s\S]*aria-label="交付"[\s\S]*>\s*交付\s*</, "The constant topbar action must open delivery, not look like a direct export command"));
checkMessage(requireWithin(minimalTopNav, /const exportDisabled = isEmptyProject \|\| !projectFolderReady/, "Browser drafts with shots must not enable export before a local project folder exists"));
checkMessage(requireWithin(minimalTopNav, /先选择保存位置，再查看交付/, "Delivery disabled copy must point browser drafts to choosing a save location first"));
checkMessage(requireWithin(minimalTopNav, /createProjectDisplayTitle[\s\S]*另开新草稿[\s\S]*createProjectDisplayAriaLabel[\s\S]*另开新草稿，不保存当前故事/, "Project control create action must not look like saving the current unsaved story"));
checkMessage(requireWithin(minimalTopNav, /aria-label="打开本地项目"[\s\S]*打开项目/, "Project control open action must have a clear accessible label"));
checkMessage(requireWithin(minimalTopNav, /project-control-actions[\s\S]*aria-label=\{createProjectDisplayAriaLabel\}[\s\S]*project-control-recent/, "Project control primary actions must appear before the recent-project list"));
checkMessage(requireWithin(minimalTopNav, /aria-label="设置"[\s\S]*settings-link-label">设置/, "One Creator Loop settings entry should use product copy"));
checkMessage(requireWithin(settingsShell, /使用联网资料/, "Settings must expose external research as a creator-facing choice"));
checkMessage(requireWithin(settingsShell, /联网查资料待配置/, "Settings must explain missing research connection in product copy"));
checkMessage(requireWithin(settingsShell, /连接联网查资料/, "Settings must let creators jump from missing research connection to the service connection form"));
checkMessage(requireWithin(settingsShell, /声音参考已准备[\s\S]*需要时再拖声音参考/, "Settings voice summary must treat audio only as voice reference on the demo path"));
checkMessage(requireWithin(settingsShell, /readyServiceConnectionCount[\s\S]*个创作服务可用/, "Settings service count must use visible creator services instead of raw stored credentials"));
check(!/serviceKeyOptions[\s\S]*cloud-tts/.test(settingsShell), "Settings default service picker must not expose cloud TTS on the demo path");
check(!/serviceConnections[\s\S]*云端配音/.test(settingsShell), "Settings default service cards must not expose cloud dubbing on the demo path");
check(!/真实生图、配音或发送视频/.test(settingsShell), "Settings default confirmation copy must not imply a local/cloud dubbing path");
checkMessage(requireWithin(minimalAudioPlan, /本版不做本地配音[\s\S]*锁定角色声线、语气和说话质感[\s\S]*视频本身不加配乐/, "Audio plan must describe uploaded audio as video-model voice reference only"));
check(!/生成克隆配音|克隆配音没有生成成功|正在生成本镜头克隆配音/.test(minimalAudioPlan), "Default audio plan must not expose parked local voice-clone actions");
check(!/音乐分析|自动混音|finalMixMusicAllowed \? "（配乐只在后期导出使用）"/.test(minimalAudioPlan), "Default audio plan must not expose parked music analysis or automatic mixing on the demo path");
checkMessage(requireWithin(stylesSource, /:has\(\.project-control-popover\)[\s\S]*\.director-bottom-composer[\s\S]*opacity:\s*0[\s\S]*pointer-events:\s*none/, "Opening the project picker must hide the bottom composer so project controls are not covered"));
checkMessage(requireWithin(settingsShell, /settings-disclosure-state[\s\S]*advancedOpen \? "收起" : "展开"/, "Settings advanced disclosure state must be real DOM copy"));
check(!/settings-advanced\s*>\s*summary::after/.test(stylesSource), "Settings must not use pseudo-content for disclosure state");
checkMessage(requireWithin(settingsShell, /function enableTavilySearch\(\)[\s\S]*setServicePanelOpen\(true\)[\s\S]*setCredFormProviderId\("tavily-search"\)/, "Choosing online research should immediately open the missing Tavily connection step"));
checkMessage(requireWithin(settingsShell, /没有联网查资料也能继续整理/, "Settings must explain that Tavily is optional for the planning path"));
checkMessage(requireWithin(settingsShell, /不连接也能继续本地规划/, "Settings must explain the Tavily tradeoff in the selected service helper"));
checkMessage(requireWithin(settingsShell, /setCredFormProviderId\("tavily-search"\)/, "Settings missing-research-key action must preselect the Tavily service key"));
checkMessage(requireWithin(settingsShell, /open=\{servicePanelOpen\}/, "Settings service panel must open from the missing research key action"));
checkMessage(requireWithin(settingsShell, /onProviderConfigStatusesChange\?\.\(providerStatuses\)/, "Settings must refresh parent provider readiness after saving or deleting a service key"));
checkMessage(requireWithin(settingsShell, /providerId\s*===\s*"tavily-search"[\s\S]*updateWebSearchSettings\(\{\s*enabled:\s*true,\s*provider:\s*"tavily_search",\s*allowNetwork:\s*true/, "Saving a Tavily key should immediately enable real web research"));
checkMessage(requireWithin(diagnosticsMode, /onProviderConfigStatusesChange=\{onProviderConfigStatusesChange\}/, "DiagnosticsMode must pass provider readiness refresh into Settings"));
checkMessage(requireWithin(diagnosticsMode, /const \[advancedOpen, setAdvancedOpen\] = useState\(false\)/, "Diagnostics advanced panels must stay unmounted until opened"));
checkMessage(requireWithin(diagnosticsMode, /\{advancedOpen && \([\s\S]*diagnostics-advanced-grid/, "Diagnostics advanced grid must render only after the disclosure opens"));
checkMessage(requireWithin(appSource, /onProviderConfigStatusesChange=\{setProviderConfigStatuses\}/, "App must let Settings refresh Agent web-search readiness after credential changes"));
checkMessage(requireWithin(minimalAgentPanel, /连接联网查资料/, "Agent panel must make external research discoverable before it is enabled"));
checkMessage(requireWithin(minimalAgentPanel, /不连接也能继续整理/, "Agent panel must explain the Tavily tradeoff without blocking planning"));
checkMessage(requireWithin(appSource, /agentWebSearchReadyForUi[\s\S]*webSearchReady=\{agentWebSearchReadyForUi\}/, "Director must pass credential-aware web-search readiness to the Agent surface"));
checkMessage(requireWithin(newVideoStartSource, /effectiveWebSearchReady[\s\S]*补好密钥/, "New video research action must not look available when a search key is missing"));
checkMessage(requireWithin(minimalTopNav, /shortSectionLabel\s*\(/, "Top navigation story section tabs must use compact section labels"));
checkMessage(requireWithin(minimalTopNav, /title=\{activeSection\?\.label\s*\|\|\s*"故事"\}/, "Top navigation must keep full active section label in title"));
checkMessage(requireWithin(stylesSource, /\.minimal-section-label[\s\S]{0,220}text-overflow:\s*ellipsis/, "Top navigation section labels must ellipsize"));
check(!/<button\b[^>]*diagnostics-link[\s\S]{0,120}>\s*Diagnostics\s*<\/button>/i.test(minimalTopNav), "One Creator Loop Diagnostics must not be a prominent text button in the top navigation");
check(!/Plan\s+preview/i.test(phase14ProjectSurface), "Minimal top navigation must not expose Plan preview copy");
checkMessage(requireWithin(directorMode, /activeSection\?\.label\s*\|\|\s*"故事流"/, "DirectorMode fallback section label must use product copy"));
checkMessage(requireWithin(directorMode, /localProjectReady=\{folderReady\}/, "Workflow overview must not call browser drafts a ready local project"));
checkMessage(requireWithin(directorMode, /projectStatusLabel=\{agentProjectStatusLabel\}/, "Agent panel must receive the user-facing project storage status"));
checkMessage(requireWithin(`${minimalPreview}\n${previewVideoStageCopy}`, /还缺素材/, "Preview missing material card must use product copy"));
checkMessage(requireWithin(`${minimalPreview}\n${previewVideoStatusLabel}\n${previewVideoStageCopy}`, /videoGeneration[\s\S]*视频\$\{video\.label\}|视频\$\{video\.label\}[\s\S]*video\.detail/, "Preview must surface video status and detail copy"));
checkMessage(requireWithin(minimalPreview, /queuedVideoTaskCount[\s\S]*视频任务处理中[\s\S]*activeVideoStatusLabel/, "Preview status must prioritize whole-timeline queued video work over the selected completed clip"));
checkMessage(requireWithin(minimalPreview, /minimal-preview-head[\s\S]*>\s*视频\s*</, "Video workspace title must use the main-area label 视频"));
checkMessage(requireWithin(minimalPreview, /播放预览/, "Preview play aria label must use product copy"));
checkMessage(requireWithin(minimalPreview, /暂停预览/, "Preview pause aria label must use product copy"));
checkMessage(requireWithin(previewItemLabel, /formatShotNumber/, "Preview must sanitize raw current-project labels before display"));
for (const label of ["素材包", "确认结果", "预览媒体", "项目文件", "制作报告", "正式预览还需复核"]) {
  checkMessage(requireWithin(minimalExportSource, new RegExp(label), `Export view must use creator-facing ${label} copy`));
}
checkMessage(requireWithin(minimalExportSource, /!localProjectReady[\s\S]*先选择保存位置[\s\S]*选择保存位置后，这里会整理交付文件[\s\S]*先选择保存位置。交付包会包含项目文件、锁定素材、预览和报告/, "Export view must route unsaved confirmed drafts back to save-location setup instead of project creation copy"));
check(!/先创建项目|创建或打开项目|先创建或打开项目/.test(minimalExportSource), "Export view must not use old create/open-project copy for the save-location gate");
checkMessage(requireWithin(minimalExport, /finalVideoPending[\s\S]*项目资料包[\s\S]*交付包/, "Export view must distinguish project package from final delivery when videos are pending"));
checkMessage(requireWithin(minimalExportSource, /pendingConfirmationLabel\?:\s*string[\s\S]*exportBlockedByAgentConfirmation[\s\S]*canPrepareExport = Boolean\(onRunExport\)[\s\S]*&& !exportBlockedByAgentConfirmation[\s\S]*const canExport = false/, "Export view must treat package generation as an Agent-confirmed action, not a direct main-area write"));
checkMessage(requireWithin(minimalExportSource, /<button className="export-run-button" disabled title=\{canPrepareExport[\s\S]*去右侧确认\$\{packageLabel\}[\s\S]*右侧 AI 导演会说明写入文件范围，确认前不会导出文件/, "Export view must route ready package generation to the right-side Agent confirmation"));
check(!/onClick=\{\(\) => \{ void onRunExport\?\.\(\); \}\}/.test(minimalExportSource), "Export view must not call onRunExport directly from the main area");
checkMessage(requireWithin(minimalExportSource, /先处理右侧消息里的[\s\S]*确认前不会导出文件/, "Export view must explain pending Agent confirmations before allowing file export"));
checkMessage(requireWithin(minimalExportSource, /function uniqueBlockerLabels\(reasons: string\[\], limit = 5\)[\s\S]*new Set\(reasons\.map\(blockerLabel\)\)[\s\S]*gateBlockerLabels = uniqueBlockerLabels\(gate\.blockedReasons\)[\s\S]*gateBlockerLabels\.map/, "Export gate blockers must dedupe repeated creator-facing labels before rendering"));
checkMessage(requireWithin(minimalExportSource, /profileBlockerLabels = uniqueBlockerLabels\(profile\.blockedReasons, 3\)[\s\S]*profileBlockerLabels\.map/, "Export profile blockers must dedupe repeated creator-facing labels before rendering"));
checkMessage(requireWithin(minimalExportSource, /function exportProfileFileSummary\(profile: ProjectPreviewExportState\["exportProfiles"\]\[number\], plannedFiles: number\)[\s\S]*profile\.kind === "asset_package" && profile\.readiness === "ready"[\s\S]*return `\$\{plannedFiles\} 个文件`[\s\S]*profile\.kind === "developer_archive" && profile\.readiness !== "ready" && !profile\.includedPaths\.length[\s\S]*return "等待制作结果"[\s\S]*profile\.readiness === "ready" && !profile\.includedPaths\.length[\s\S]*return "确认后生成文件"[\s\S]*return `\$\{profile\.includedPaths\.length\} 个文件`[\s\S]*displayedProfileFileSummary = exportProfileFileSummary\(profile, plannedFiles\)[\s\S]*\{displayedProfileFileSummary\} ·/, "Export profile details must not show global package file counts for blocked material profiles, empty-file ready profiles, or empty production archives"));
checkMessage(requireWithin(minimalExportSource, /function exportProfileFutureTargetCopy\(profile: ProjectPreviewExportState\["exportProfiles"\]\[number\]\)[\s\S]*futureTargetSummary\(profile\.futureTargets\)[\s\S]*!futureTargets \|\| profile\.readiness !== "ready"[\s\S]*return ""[\s\S]*return `可交接给：\$\{futureTargets\}`[\s\S]*futureTargetCopy = exportProfileFutureTargetCopy\(profile\)[\s\S]*\{futureTargetCopy\}/, "Export profile details must hide future handoff targets until a profile is actually ready"));
check(!/后续可接入/.test(minimalExportSource), "Export profile details must not expose future-roadmap copy in the default director UI");
checkMessage(requireWithin(directorMode, /<MinimalExport[\s\S]*pendingConfirmationLabel=\{pendingAgentConfirmationForSurfaces\}/, "DirectorMode must pass pending Agent confirmation state into the export surface"));
checkMessage(requireWithin(directorMode, /onEditingPendingConfirmationChange=\{handleAgentEditingPendingConfirmationChange\}[\s\S]*onCurrentTaskProjectionChange=\{handleAgentCurrentTaskProjectionChange\}/, "DirectorMode must receive confirmation-editing state and the complete current-task projection from the right Agent composer"));
checkMessage(requireWithin(minimalExportSource, /readyProfileLabel = "可打包资料"[\s\S]*blockedProfileLabel = canPrepareExport \? "后续可补" : "待处理"[\s\S]*aria-label="资料包摘要"/, "Export summary must frame ready items as local package material instead of direct export"));
checkMessage(requireWithin(minimalExportSource, /查看本地包明细[\s\S]*\{readyProfiles\} 个\{readyProfileLabel\} · \{blockedProfiles\} 个\{blockedProfileLabel\}/, "Export details must describe the local package instead of final delivery"));
checkMessage(requireWithin(minimalExportSource, /videoMissingCount[\s\S]*视频素材[\s\S]*视频结果/, "Export package summary must label missing video slots as material status instead of finished results"));
checkMessage(requireWithin(minimalExportSource, /videoSummaryLabel = finalVideoPending \? "视频素材" : "视频结果"[\s\S]*\{videoSummaryLabel\}：\{videoSummary\}/, "Export visible video summary must keep pending videos inside the local-package scope"));
checkMessage(requireWithin(minimalExportSource, /本轮只准备本地资料包/, "Export visible video summary must explain that missing videos are outside the current local package"));
checkMessage(requireWithin(minimalExportSource, /视频还在回流，先打包项目文件、参考和制作报告/, "Export view must not imply final delivery is ready while video results are still queued"));
check(!/素材包可以生成/.test(minimalExportSource), "Export primary copy must not imply the final material package is ready while videos may still be missing");
check(!/提示质检|prompt QA|导出清单已生成|export_manifest/i.test(extractStringLiterals(minimalExportSource)), "Export view default copy must hide engineering export labels");
checkMessage(requireWithin(minimalExport, /声音参考随视频模型使用，配乐留到后期/, "Export audio summary must match current demo voice-reference strategy"));
checkMessage(requireWithin(minimalAudioPlan, /声音边界[\s\S]*淡入[\s\S]*淡出/, "Audio plan must use creator-facing audio copy"));
checkMessage(requireWithin(shotAudioInspector, /声音参考[\s\S]*配乐边界[\s\S]*视频模型不生成配乐/, "Shot audio inspector must use voice-reference demo copy"));
check(!/Formal gate blockers|paths|音频 plan|Fade in|Fade out|TTS\s+|music\s+\{|linkedMusicJobId|linkedTtsJobId/.test(extractStringLiterals(`${minimalExport}\n${minimalAudioPlan}\n${shotAudioInspector}`)), "Export/Audio views must not expose engineering copy");

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
checkMessage(requireWithin(minimalAssetLibrarySource, /reviewBoundaryCopy[\s\S]*reviewCounts\.needsReview > 0[\s\S]*localProjectReady[\s\S]*个素材等你确认；确认后才进入故事参考库[\s\S]*先选择保存位置，确认后才进入故事参考库[\s\S]*新素材会先分类，等你确认后才进入故事参考库[\s\S]*选择保存位置后再进入故事参考库/, "Asset Library must explain that newly scanned materials wait for creator confirmation and save location before entering story references"));
checkMessage(requireWithin(minimalAssetLibrarySource, /localDetailBoundaryCopy[\s\S]*手、眼神、车灯会跟随对应角色、场景或道具说明，不会单独变成新参考项/, "Asset Library must prevent object details from being presented as standalone references in creator-facing copy"));
checkMessage(requireWithin(minimalAssetLibrarySource, /referenceGapCount = 0[\s\S]*visibleReferenceMissingCount = Math\.max\(reviewCounts\.missing,\s*Math\.round\(referenceGapCount\)\)[\s\S]*aria-label="参考状态"[\s\S]*等你确认 \{reviewCounts\.needsReview\} 个[\s\S]*已锁定 \{reviewCounts\.locked\} 个[\s\S]*缺参考 \{visibleReferenceMissingCount\} 张[\s\S]*aria-label="素材确认边界"[\s\S]*reviewBoundaryCopy[\s\S]*localDetailBoundaryCopy/, "Asset Library reference status must use counted review/locked facts and the visible project reference gap before showing the material confirmation boundary"));
checkMessage(requireWithin(minimalAssetLibrarySource, /visibleReferenceMissingCount > 0 && pendingConfirmationLabel[\s\S]*当前故事还缺 \$\{visibleReferenceMissingCount\} 张参考；先处理右侧确认，或继续说明怎么改/, "Asset Library next step must not tell creators to add random material when the current story already has a pending reference confirmation"));
checkMessage(requireWithin(minimalAssetLibrarySource, /if \(!message\)[\s\S]*!localProjectReady\) return "先选择保存位置"[\s\S]*正在连接保存位置[\s\S]*!localProjectReady\) return "先选保存位置"/, "Asset Library unsaved-story reference generation copy must route creators to save location instead of local-project setup"));
checkMessage(requireWithin(minimalAssetLibrarySource, /reviewActionBlockedBySaveLocation = !localProjectReady[\s\S]*!localProjectReady && reviewCounts\.needsReview > 0[\s\S]*先处理右侧「\$\{pendingConfirmationLabel\}」，再确认这些参考[\s\S]*disabled=\{reviewActionBlockedBySaveLocation\}[\s\S]*先选择保存位置，再锁定 \$\{reviewableAssets\.length\} 个待复核参考[\s\S]*先选保存位置[\s\S]*先选择保存位置，再锁定或修改参考/, "Asset Library must not let unsaved stories lock or edit references before the save-location confirmation"));
checkMessage(requireWithin(minimalAssetLibrarySource, /return "先放脚本和素材，AI 会先分类，采用前等你确认。"/, "Asset Library next step must explain material classification and confirmation before adoption"));
checkMessage(requireWithin(stylesSource, /\.asset-review-boundary[\s\S]*grid-template-columns:\s*96px minmax\(0,\s*1fr\)[\s\S]*\.asset-review-boundary small[\s\S]*grid-column:\s*2/, "Asset Library material confirmation boundary must have compact styling"));
checkMessage(requireWithin(minimalAssetLibrary, /blockerLabel/, "Asset Library blockers must collapse to a short status"));
checkMessage(requireWithin(minimalAssetLibrary, /asset-feature-grid anchors/, "Asset Library props/styles must render as image-first asset cards"));
check(!/blockers\.slice\(0,\s*4\)\.map/.test(minimalAssetLibrary), "Asset Library must not show long blocker chips on the main surface");
check(!/Queue|queue|gate|provider/.test(minimalStoryFlow), "Story Flow must not expose queue/gate/provider engineering details");
checkMessage(requireWithin(formatShotNumber, /CURRENT_PROJECT[\s\S]*当前项目/, "Story Flow must display the current-project placeholder with product copy"));
checkMessage(requireWithin(shortStoryFunction, /current_project_story_pending[\s\S]*(待写故事流|等待同步)/, "Story Flow fallback story function must use product copy"));
check(!/"Setup"/.test(minimalStoryFlowSource), "Story Flow fallback labels must not expose Setup");
checkMessage(requireWithin(shotStatusLabel, /blocked[\s\S]*(缺画面|需复核|待写故事)/, "Story Flow status label must map blocked to product copy"));
checkMessage(requireWithin(minimalStoryFlow, /aria-label=\{cardState\.label\}/, "Story Flow dot aria-label must use product status labels"));
checkMessage(requireWithin(minimalStoryFlow, /aria-label=\{`选择镜头 \$\{displayShotNumber\(shot\.id\)\}：/, "Story Flow shot cards must expose a clear selection label"));
checkMessage(requireWithin(minimalStoryFlow, /currentRequiresEndFrame[\s\S]*usesEndpointEndFrame\(currentShot\)[\s\S]*currentRequiresEndFrame &&/, "Story Flow cards must show end-frame status only for explicit endpoint control"));
checkMessage(requireWithin(minimalStoryFlow, /currentDisplayReference[\s\S]*shotDisplayReference\(currentShot/, "Story Flow default reference status must use the active visual reference"));
check(!/aria-label=\{shot\.status\}/.test(minimalStoryFlow), "Story Flow dot aria-label must not expose raw shot status");
checkMessage(requireWithin(minimalStoryFlow, /aria-label="Agent 推荐的做法"[\s\S]*Agent 推荐的做法/, "Story Flow must describe internal strategy selection as an Agent recommendation"));
checkMessage(requireWithin(minimalStoryFlow, /current-shot-skill-explain[\s\S]*适合[\s\S]*currentSkillSummary\.appliesTo[\s\S]*避开[\s\S]*currentSkillSummary\.avoidWhen[\s\S]*影响[\s\S]*currentSkillSummary\.affects/, "Story Flow Skill recommendation must explain fit, anti-fit, and affected workflow area"));
checkMessage(requireWithin(minimalStoryFlow, /explicitShotReferenceStrategy\(currentShot\)/, "Story Flow must not display the omni fallback as an explicit selected strategy"));
check(!/AI 选择的技能|aria-label="导演技能"/.test(minimalStoryFlow), "Story Flow must not expose internal skill terminology on the main surface");
checkMessage(requireWithin(directorSkillUiSource, /function strategyUseCase[\s\S]*function strategyAvoidCase[\s\S]*function strategyAffects[\s\S]*appliesTo:\s*strategyUseCase\(strategy\)[\s\S]*avoidWhen:\s*strategyAvoidCase\(strategy\)[\s\S]*affects:\s*strategyAffects\(strategy\)/, "Director Skill summaries must provide user-facing applicability, anti-fit, and affected-stage explanations"));
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
  checkMessage(requireWithin(oneShotActionPanel, /输出已回来，等待确认。/, "pre-real-test returned output review detail"));
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
checkMessage(requireWithin(minimalPreviewSource, /pendingConfirmationLabel\?:\s*string[\s\S]*pendingConfirmationCopy[\s\S]*先处理右侧消息里的「\$\{pendingConfirmationLabel\}」[\s\S]*确认前不会生成视频[\s\S]*pendingConfirmationCopy \|\| previewVideoStageCopy\(activeItem\)/, "Preview view must explain pending right-rail Agent confirmations before video generation can proceed"));
checkMessage(requireWithin(directorMode, /<MinimalPreview[\s\S]*pendingConfirmationLabel=\{pendingAgentConfirmationForSurfaces\}/, "DirectorMode must pass pending Agent confirmation state into the video preview surface"));
checkMessage(requireWithin(directorMode, /<DirectorDetailDisclosure[\s\S]*title="流程详情"[\s\S]*pendingAgentConfirmationForSurfaces[\s\S]*先处理右侧消息里的「\$\{pendingAgentConfirmationForSurfaces\}」/, "Workflow detail must point video/preview users back to the pending right-rail confirmation"));
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
for (const label of ["角色参考", "场景/天气参考", "道具参考", "声音参考", "待复核", "已锁定"]) {
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
  ["voice role copy", /角色音色|音乐方向|环境声|声音风格|旁白|音频参考|配乐/],
  ["audio reuse copy", /可复用/],
]) {
  check(!pattern.test(minimalAssetLibraryCopy), `Asset Library default copy must not expose ${label}`);
}
for (const [label, pattern] of [
  ["stiff confirm-now copy", /确认现在/],
  ["provider return jargon", /回来后/],
  ["manual review jargon", /人工复核/],
  ["asset internal reusable-subject rule", /可复用主体|局部细节/],
  ["old project-reference CTA", /补全项目参考|补全参考|补全中|扫描整个项目/],
  ["casual negative role label", /不管/],
]) {
  check(!pattern.test(directorCreatorFacingCopy), `Director creator-facing copy must not expose ${label}`);
}
checkMessage(requireWithin(directorCreatorFacingCopy, /生成[\s\S]*参考/, "Image generation confirmation must use creator-facing copy"));
checkMessage(requireWithin(directorCreatorFacingCopy, /结果(?:会)?先进入复核|结果会进入复核区|完成后去参考页复核/, "Generation actions should explain review behavior in user language"));
checkMessage(requireWithin(minimalAssetLibrary, /aria-label=\{`选择参考素材 \$\{cleanLabel\(asset\.name\)\} ·/, "Asset cards must expose clear accessible selection labels"));
checkMessage(requireWithin(minimalAssetLibrary, /<details className="asset-generation-manual"[\s\S]*aria-label="手动生成缺少的参考图和故事板"/, "Asset generation action manual recovery must stay behind disclosure"));
checkMessage(requireWithin(minimalAssetLibrarySource, /pendingConfirmationLabel\?:\s*string/, "Asset Library must accept a pending Agent confirmation label"));
checkMessage(requireWithin(minimalAssetLibrary, /generationBlockedByAgentConfirmation[\s\S]*先处理确认[\s\S]*disabled=\{assetGenerationAction\?\.disabled \|\| generationBlockedByAgentConfirmation\}/, "Asset generation manual recovery must be disabled while a right-rail Agent confirmation is pending"));
checkMessage(requireWithin(directorMode, /pendingAgentConfirmationForSurfaces[\s\S]*cloneElement\(assetLibraryNode as ReactElement<\{ pendingConfirmationLabel\?: string; referenceGapCount\?: number \}>[\s\S]*pendingConfirmationLabel:\s*pendingAgentConfirmationForSurfaces[\s\S]*projectReady \? displayedAssetLibraryNode/, "DirectorMode must pass pending Agent confirmation state into the Asset Library surface"));
checkMessage(requireWithin(minimalAssetLibrarySource, /onMarkAllReviewAssetsLocked\?:\s*\(assetIds:\s*string\[\]\)/, "Asset Library must accept a batch reference review action"));
checkMessage(requireWithin(minimalAssetLibrarySource, /const reviewableAssets = library\.assets\.filter[\s\S]*asset\.status === "review"[\s\S]*asset\.status === "candidate"/, "Asset Library batch review must only target reviewable generated references"));
checkMessage(requireWithin(minimalAssetLibrary, /className="asset-review-all-button"[\s\S]*全部通过/, "Asset Library must expose one clear batch approve action for generated references"));
checkMessage(requireWithin(stylesSource, /\.asset-review-all-button\s*\{[\s\S]*white-space:\s*nowrap/, "Asset Library batch approve action must stay visible and not wrap away"));
checkMessage(requireWithin(minimalAssetLibrary, /className="asset-library-advanced"[\s\S]*placeholder="手填路径（可选）"[\s\S]*placeholder="补充说明（可选）"/, "Asset Library manual path and notes must stay behind advanced add controls"));
checkMessage(requireWithin(minimalAssetLibrary, /className="asset-library-advanced asset-library-selected-advanced"[\s\S]*aria-label="编辑补充说明"/, "Asset Library selected notes editor must stay behind advanced controls"));
checkMessage(requireWithin(appSource, /voiceSourceLibrary=\{workbenchRuntimeState\.voiceSourceLibrary\}/, "Asset Library receives workspace voice references"));
checkMessage(requireWithin(appSource, /async function markAllReviewAssetsLocked\(assetIds: string\[\]\)[\s\S]*let nextLibrary = assetLibrary[\s\S]*for \(const assetId of reviewAssetIds\)[\s\S]*markCurrentProjectAssetStatus/, "App must batch-lock review assets from one fresh library snapshot and write them back to the current project"));
checkMessage(requireWithin(appSource, /onMarkAllReviewAssetsLocked=\{markAllReviewAssetsLocked\}/, "App must wire batch reference approval into the Asset Library"));
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
  ["检查结果", /检查结果/],
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
checkMessage(requireWithin(projectRealChainUserSurface, /预览[\s\S]*可预览/, "current project chain panel must expose preview ready state"));
checkMessage(requireWithin(projectRealChainUserSurface, /成片[\s\S]*待复核/, "current project chain panel must expose production review state"));
checkMessage(requireWithin(projectRealChainUserSurface, /displayTitle[\s\S]*项目状态已同步/, "current project chain panel must show bound project title instead of sandbox project id"));
checkMessage(requireWithin(projectRealChainUserSurface, /未选择项目/, "current project chain panel must show unbound project copy"));
checkMessage(requireWithin(projectRealChainUserSurface, /未同步/, "current project chain panel must show unsynced project copy"));
checkMessage(requireWithin(projectRealChainUserSurface, /项目路径/, "current project chain panel must expose a simple project path entry"));
checkMessage(requireWithin(projectRealChainUserSurface, /最近项目/, "current project chain panel must expose recent project choices"));
checkMessage(requireWithin(projectRealChainUserSurface, /连接项目/, "current project chain panel must expose a creator-facing connect action"));
checkMessage(requireWithin(projectRealChainUserSurface, /准备小样包[\s\S]*确认动作[\s\S]*许可回执[\s\S]*结果检查/, "current project chain panel must expose the one-shot four-step flow"));
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
checkMessage(requireWithin(minimalTopNav, /const projectControlButtonLabel = !projectFolderReady && isEmptyProject \? "打开或新建项目" : projectTitleLabel/, "top nav should make the empty unbound project control read as the project entry"));
checkMessage(requireWithin(minimalTopNav, /aria-label=\{`项目控制：\$\{projectControlButtonLabel\}，\$\{projectControlStatus\}`\}/, "top nav project button should expose the current project action and storage status without crowding visible chrome"));
checkMessage(requireWithin(minimalTopNavSource, /function\s+recentProjectMetaLabel[\s\S]*有项目文件[\s\S]*待初始化/, "top nav recent projects must show project-file status"));
checkMessage(requireWithin(minimalTopNavSource, /function\s+recentProjectFolderLabel[\s\S]*function\s+recentProjectDisplayLabel[\s\S]*duplicateNameCounts[\s\S]*recentProjectFolderLabel\(project\.projectRoot\)[\s\S]*aria-label=\{`打开项目 \$\{displayLabel\}`\}/, "top nav recent projects must make duplicate project names distinguishable without repeating full paths in the title"));
checkMessage(requireWithin(minimalTopNavSource, /function\s+formatRecentProjectUpdatedAt[\s\S]*刚刚[\s\S]*分钟前[\s\S]*小时前/, "top nav recent projects must show compact recency copy"));
checkMessage(requireWithin(minimalTopNavSource, /projectStorageKind\?:\s*"local" \| "temporary" \| "unbound"/, "top nav must accept the exact project storage kind"));
checkMessage(requireWithin(minimalTopNavSource, /storageKind[\s\S]*projectStorageKind[\s\S]*projectFolderReady = storageKind !== "unbound"/, "top nav project folder readiness must come from the storage kind, not just any project root"));
checkMessage(requireWithin(minimalTopNavSource, /projectStorageBadge[\s\S]*草案[\s\S]*本地[\s\S]*未连接/, "top nav project title must expose whether the current work is draft, local, or not connected"));
checkMessage(requireWithin(minimalTopNavSource, /projectControlStatus[\s\S]*未连接项目/, "top nav project popover must distinguish unsaved drafts from local projects"));
checkMessage(requireWithin(minimalTopNavSource, /recentProjectItems[\s\S]*\.slice\(0,\s*4\)/, "top nav project control must keep the recent-project list short enough for demo use"));
checkMessage(requireWithin(stylesSource, /\.project-title-storage[\s\S]*\.project-title-storage\.local[\s\S]*\.project-title-storage\.temporary[\s\S]*\.project-title-storage\.draft/, "top nav local/temporary/draft badge must have stable visual states"));
check(!/const emptyProjectPrimary = canForgetProject/.test(minimalTopNavSource), "top nav empty-project wording must not infer local folder readiness from the close-project action");
check(!/const projectRootLabel = compactProjectPathLabel\(projectRoot\) \|\| \(canForgetProject/.test(minimalTopNavSource), "top nav project root label must not claim a local folder is connected without projectRoot");
check(!/const projectControlStatus = canForgetProject/.test(minimalTopNavSource), "top nav project status must not infer project binding from canForgetProject");
checkMessage(requireWithin(minimalTopNavSource, /projectContentSummary[\s\S]*下方发送脚本[\s\S]*projectPlan\.statusLabel/, "top nav project control must explain current project content state"));
checkMessage(requireWithin(minimalTopNavSource, /projectSaveSummary[\s\S]*确认草案后创建项目文件[\s\S]*保存文件/, "top nav project control must explain where the local project file will be saved"));
checkMessage(requireWithin(minimalTopNavSource, /这里切换保存位置[\s\S]*不会删除文件/, "top nav project control must explain project switching without destructive wording"));
checkMessage(requireWithin(minimalTopNavSource, /退出[\s\S]*不删除本地文件/, "top nav project close action must be creator-facing and non-destructive"));
checkMessage(requireWithin(minimalTopNavSource, /forgetProjectActionTitle[\s\S]*放弃当前草案，回到空项目[\s\S]*forgetProjectActionLabel[\s\S]*放弃草案[\s\S]*退出项目/, "temporary new-video drafts must expose a clear abandon-draft action"));
checkMessage(requireWithin(minimalTopNavSource, /project-control-recent-remove[\s\S]*从列表移除，不删除本地文件[\s\S]*event\.stopPropagation\(\)/, "recent project removal must be explicit and must not trigger the open-project action"));
checkMessage(requireWithin(minimalTopNavSource, /const active = Boolean\(projectRoot && project\.projectRoot === projectRoot\)[\s\S]*const removeDisabled = active \|\| !onRemoveRecentProject[\s\S]*当前项目请用退出项目/, "recent project removal must route the active project through the explicit exit-project action"));
checkMessage(requireWithin(minimalTopNavSource, /project-control-recent-empty[\s\S]*打开或新建项目后，会在这里快速切换/, "top nav project control must show an empty state for recent projects"));
checkMessage(requireWithin(appSource, /projectFileSelectionDetail\([\s\S]*canChooseProjectRootFromDialog\s*\|\|\s*canCreateLocalProjectFromDialog/, "project file status detail must use real local-project picker availability"));
checkMessage(requireWithin(appSource, /createProjectTitle="新建项目"[\s\S]*createProjectAriaLabel="新建项目"/, "project control create action must use one clear new-project label instead of exposing browser draft internals"));
checkMessage(requireWithin(minimalTopNavSource, /当前故事还没保存[\s\S]*另开草稿不会保存它[\s\S]*生成参考前请先在桌面 App 选择保存位置/, "unsaved story project control must warn before opening a blank draft"));
checkMessage(requireWithin(appSource, /if \(!canCreateLocalProjectFromDialog\) \{[\s\S]*return createBrowserRuntimeProject\(draft, context, options\)/, "new project action must create a visible browser runtime project outside Electron instead of only changing hidden draft storage"));
checkMessage(requireWithin(appSource, /async function createBrowserRuntimeProject\(\s*draft\?: NewVideoStartDraft,\s*context\?: NewVideoStartConfirmationContext/, "browser runtime project creation must support the top-nav new-project action without requiring a prepared draft"));
checkMessage(requireWithin(appSource, /const binding = await connectCurrentProject\([\s\S]*if \(!binding \|\| binding\.status !== "bound"\) \{[\s\S]*return createBrowserDraftProject\(draft, context, options\)/, "browser runtime project creation must fall back to browser draft storage when the runtime API is unavailable"));
checkMessage(requireWithin(appSource, /function naturalProjectTitleFromScript[\s\S]*\[：:\][\s\S]*function projectDisplayNameFromDraft[\s\S]*const naturalTitle = naturalProjectTitleFromScript\(draft\?\.script\)[\s\S]*if \(naturalTitle\) return naturalTitle/, "new-video project titles must derive a readable name from natural idea text before falling back to generic copy"));
checkMessage(requireWithin(appSource, /if \(shouldUseSelectedProject && projectFileSelection\.status === "selected"\) \{[\s\S]*if \(selectedProjectIsBrowserDraft\) \{[\s\S]*storageKey: browserProjectDraftStorageKeyRef\.current \|\| prototypeProjectDraftStorageKeyValue/, "new-video confirmation must not write browser-project roots through file storage in the in-app browser"));
checkMessage(requireWithin(appSource, /const runtimeSaveIdentity = draftTarget\.projectRoot[\s\S]*\? \{ projectRoot: draftTarget\.projectRoot \}[\s\S]*: undefined/, "browser draft confirmations must not be saved again through a stale current runtime identity"));
checkMessage(requireWithin(appSource, /async function removeRecentProjectRecord[\s\S]*window\.vibeRuntime\?\.forgetProject\?\.\(normalizedRoot\)[\s\S]*setRecentProjectSelections\(clearRememberedProjectRoot\(normalizedRoot\)\)/, "recent project removal must clear both runtime and local remembered project records"));
checkMessage(requireWithin(appSource, /const freshProjectSessionRequested = isFreshProjectSessionRequested\(\)[\s\S]*const runtimeBindingIsLocalProject = runtimeProjectBinding\.status === "bound"[\s\S]*&& \(!freshProjectSessionRequested \|\| projectFileSelection\.status === "selected"\)/, "fresh project sessions must ignore stale runtime bindings until the user explicitly selects or creates a project"));
checkMessage(requireWithin(appSource, /if \(runtimeProjectBinding\.status !== "bound" \|\| !runtimeProjectBinding\.projectRoot\) return;[\s\S]*if \(freshProjectSessionRequested && projectFileSelection\.status !== "selected"\) return;[\s\S]*if \(runtimeBindingIsBrowserDraft\) return;[\s\S]*setProjectFileSelection\(\{[\s\S]*projectRoot: runtimeProjectBinding\.projectRoot/, "fresh project sessions and transient browser-runtime projects must not let a stale runtime binding repopulate the visible desktop project before explicit selection"));
checkMessage(requireWithin(appSource, /if \(!runtimeBindingIsLocalProject \|\| !runtimeProjectBinding\.projectRoot\) return undefined;[\s\S]*if \(freshProjectSessionRequested && projectFileSelection\.status !== "selected"\) return undefined;[\s\S]*openProjectAgentTimeline\(/, "fresh project sessions must not restore a stale Agent timeline before explicit project selection"));
checkMessage(requireWithin(appSource, /function shouldAutoRestoreRememberedProject\(\)[\s\S]*if \(isFreshProjectSessionRequested\(\)\) return false[\s\S]*window\.localStorage\.getItem\(autoRestoreRememberedProjectStorageKey\)[\s\S]*return Boolean\(readRememberedProjectSelection\(\)\?\.projectRoot\)/, "normal app restarts must restore an existing remembered local project even if an older build did not write the auto-restore flag"));
checkMessage(requireWithin(appSource, /const rememberedSelection = readRememberedProjectSelection\(\)[\s\S]*runtimeProjectBinding\.status === "bound"[\s\S]*normalizeProjectRootForUiCompare\(runtimeProjectBinding\.projectRoot\) === normalizeProjectRootForUiCompare\(rememberedSelection\.projectRoot\)[\s\S]*rememberedProjectRestoreAttemptedRef\.current = true[\s\S]*return/, "remembered project restore must not overwrite an already bootstrapped runtime project with an empty local shell"));
checkMessage(requireWithin(appSource, /function writeRememberedProjectSelection[\s\S]*window\.localStorage\.setItem\(rememberedProjectRootStorageKey[\s\S]*window\.localStorage\.setItem\(autoRestoreRememberedProjectStorageKey, "true"\)/, "saving or selecting a local project must opt into auto-restoring it on the next desktop launch"));
checkMessage(requireWithin(appSource, /function clearRememberedProjectRoot[\s\S]*const shouldClearRemembered = !projectRoot \|\| remembered\?\.projectRoot === projectRoot[\s\S]*window\.localStorage\.removeItem\(rememberedProjectRootStorageKey\)[\s\S]*window\.localStorage\.removeItem\(autoRestoreRememberedProjectStorageKey\)/, "forgetting the current remembered project must clear the auto-restore flag with the remembered root"));
checkMessage(requireWithin(currentProjectRuntimeHookSource, /loadCurrentProjectBindingStatus\(\)\.then\(\(binding\)[\s\S]*setRuntimeProjectBinding\(\(current\) => \([\s\S]*current\.status === "loading" \|\| \(binding\.status === "bound" && current\.status !== "bound"\)[\s\S]*\? binding[\s\S]*: current/, "startup runtime binding restore must accept a later bound result instead of dropping it after an early unbound state"));
checkMessage(requireWithin(appSource, /const freshProjectSessionPendingSelection = freshProjectSessionRequested && projectFileSelection\.status !== "selected"[\s\S]*const directorNewVideoResetEntryActive = mode === "director"[\s\S]*newVideoSessionResetNonce > 0[\s\S]*!hasWorkbenchProjectContent[\s\S]*!selectedProjectIsLocalProject[\s\S]*const directorNewVideoEntryActive = mode === "director"[\s\S]*directorNewVideoResetEntryActive[\s\S]*const visibleProjectTitle = pendingDraftTitleForNav\(directorNewVideoStatus\) \|\| \(directorNewVideoEntryActive \? "新视频项目" : visibleProjectTitleBase\)[\s\S]*const hasActiveNewVideoDraftForTopNav = Boolean\(directorNewVideoStatus && directorNewVideoStatus\.status !== "empty"\)[\s\S]*const newVideoDraftPendingProjectSelection = hasActiveNewVideoDraftForTopNav[\s\S]*!hasWorkbenchProjectContent[\s\S]*!localProjectReadyForUi[\s\S]*const storyFlowPendingProjectSelection = projectContentReadyForUi && !localProjectReadyForUi[\s\S]*const projectControlShowsNewVideoEntry = freshProjectSessionPendingSelection[\s\S]*directorNewVideoResetEntryActive[\s\S]*newVideoDraftPendingProjectSelection[\s\S]*storyFlowPendingProjectSelection[\s\S]*const projectControlRoot = projectControlShowsNewVideoEntry[\s\S]*\? undefined[\s\S]*const projectControlStorageKind = projectControlShowsNewVideoEntry[\s\S]*\? "temporary" as const/, "fresh, reset, pending-draft, or confirmed unsaved story sessions must make the top nav use a temporary project instead of stale runtime/browser draft copy"));
checkMessage(requireWithin(appSource, /function activeNewVideoDraftShotCountForTopNav[\s\S]*status === "empty" \|\| status\.status === "confirmed"[\s\S]*function newVideoDraftSectionsForTopNav[\s\S]*label: "待确认草案"[\s\S]*const activeNewVideoDraftShotCountForNav = activeNewVideoDraftShotCountForTopNav\(directorNewVideoStatus\)[\s\S]*const topNavStorySections = useMemo<RuntimeView\["storySections"\]>\([\s\S]*activeNewVideoDraftShotCountForNav > 0[\s\S]*newVideoDraftSectionsForTopNav\(activeNewVideoDraftShotCountForNav\)[\s\S]*<MinimalTopNav[\s\S]*sections=\{topNavStorySections\}[\s\S]*activeSectionId=\{activeNewVideoDraftShotCountForNav > 0 \? undefined/, "App top nav must show pending draft shot counts instead of stale project story counts while a restored new-video confirmation is active"));
checkMessage(requireWithin(appSource, /function agentStagedPlanSupersededByNewVideoDraft[\s\S]*draft\.status !== "active"[\s\S]*entry\.type === "confirmation_request"[\s\S]*entry\.details\?\.intakePhase === "planning_ready"[\s\S]*timelineEntryTimeMs\(entry\) > draftTime[\s\S]*function agentStagedPlanSupersededBySkillSaveConfirmation[\s\S]*entry\.toolName === "save_skill"[\s\S]*waiting_for_confirmation[\s\S]*function agentStagedPlanRestoreResultForTimeline[\s\S]*agentStagedPlanSupersededBySkillSaveConfirmation\(result\.draft,\s*entries\)[\s\S]*status: "cleared"/, "App must treat later pending new-video draft or save-Skill confirmations as superseding an older active Agent staged plan"));
checkMessage(requireWithin(appSource, /const stagedPlanRestore = agentStagedPlanRestoreResultForTimeline\(stagedPlanOpen,\s*timelineOpen\.timeline\.entries\)[\s\S]*if \(!stagedPlanRestore\.ok && stagedPlanRestore\.status === "cleared" && stagedPlanOpen\.draft\)[\s\S]*clearProjectAgentStagedPlanDraft\(prototypeProjectDraftTarget[\s\S]*setRestoredAgentStagedPlanDraft\(stagedPlanRestore\.ok \? stagedPlanRestore\.draft : undefined\)/, "App must clear superseded staged sidecars from disk before restoring Agent UI state, even when the stale sidecar was already non-restorable"));
check((appSource.match(/agentStagedPlanRestoreResultForTimeline\(stagedPlanOpen,\s*timelineOpen\.timeline\.entries\)/g) || []).length >= 2, "Both browser-draft and local-project staged-plan restore paths must filter superseded Agent plans");
checkMessage(requireWithin(appSource, /const runtimeDraftTarget: ProjectVibeDraftTarget = \{[\s\S]*projectRoot: runtimeProjectBinding\.projectRoot[\s\S]*async function restoreRuntimeAgentTimeline\(\)[\s\S]*openProjectVibeDraft\(runtimeDraftTarget\)[\s\S]*applyProjectVibeProjectState\(projectOpen\.project,\s*runtimeDraftTarget\)[\s\S]*openProjectAgentTimeline\(runtimeDraftTarget[\s\S]*if \(timelineOpen\.ok\)[\s\S]*const stagedPlanOpen = await openProjectAgentStagedPlanDraft\(runtimeDraftTarget[\s\S]*const actionLogOpen = await openProjectAgentActionLog\(runtimeDraftTarget[\s\S]*const generationLedgerOpen = await openProjectAgentGenerationJobLedger\([\s\S]*const stagedPlanRestore = agentStagedPlanRestoreResultForTimeline\(stagedPlanOpen,\s*timelineOpen\.timeline\.entries\)[\s\S]*clearProjectAgentStagedPlanDraft\(runtimeDraftTarget[\s\S]*setRestoredAgentStagedPlanDraft\(stagedPlanRestore\.ok \? stagedPlanRestore\.draft : undefined\)[\s\S]*setRestoredAgentTimelineEntries\(timelineOpen\.ok \? timelineOpen\.timeline\.entries : \[\]\)[\s\S]*setRestoredAgentGenerationJobLedger\(generationLedgerOpen\.ok \? generationLedgerOpen\.ledger : undefined\)/, "runtime Agent recovery must apply Project.vibe first, then restore timeline, staged plan, and generation ledger independently"));
checkMessage(requireWithin(currentProjectRuntimeClientSource, /projectCurrentAgentStagedPlanEndpoint[\s\S]*projects\/current\/agent-staged-plan[\s\S]*loadCurrentProjectAgentStagedPlanTextFromRuntime[\s\S]*saveCurrentProjectAgentStagedPlanTextToRuntime/, "current-project runtime client must expose Agent staged-plan read/write helpers"));
checkMessage(requireWithin(projectAgentStagedPlanDraftSource, /loadCurrentProjectAgentStagedPlanTextFromRuntime[\s\S]*saveCurrentProjectAgentStagedPlanTextToRuntime[\s\S]*saveProjectAgentStagedPlanDraft[\s\S]*saveCurrentProjectAgentStagedPlanTextToRuntime[\s\S]*writeProjectVibeSidecarText[\s\S]*openProjectAgentStagedPlanDraft[\s\S]*loadCurrentProjectAgentStagedPlanTextFromRuntime[\s\S]*readProjectVibeSidecarText[\s\S]*selectLatestProjectAgentStagedPlanRestoreResult/, "Agent staged-plan draft storage must double-read and double-write current-project runtime sidecars"));
checkMessage(requireWithin(localRuntimeApiServerSource, /currentProjectAgentStagedPlanEndpoint[\s\S]*projects\/current\/agent-staged-plan[\s\S]*currentProjectAgentStagedPlanSidecarPath[\s\S]*agent-staged-plan\.json[\s\S]*handleCurrentProjectAgentStagedPlanRoute[\s\S]*req\.method !== "GET" && req\.method !== "POST"[\s\S]*readFileSync\(sidecarPath,\s*"utf8"\)[\s\S]*writeFileSync\(tempPath,\s*content,\s*"utf8"\)[\s\S]*handleCurrentProjectAgentStagedPlanRoute\(req,\s*res,\s*url\)/, "local runtime server must expose a current-project Agent staged-plan sidecar read/write route"));
checkMessage(requireWithin(appSource, /currentProjectPath=\{projectControlShowsNewVideoEntry \? undefined : projectFileSelection\.status === "selected" \? projectFileSelection\.projectPath : effectiveRuntimeProjectBinding\.projectVibePath\}/, "fresh or reset new-video sessions must not pass a stale runtime project path into the top nav"));
checkMessage(requireWithin(appSource, /hasActiveNewVideoDraftForTopNav[\s\S]*directorNewVideoStatus\.status !== "empty"[\s\S]*canForgetProjectFromTopNav[\s\S]*hasActiveNewVideoDraftForTopNav[\s\S]*localProjectReadyForUi[\s\S]*hasWorkbenchProjectContent[\s\S]*canForgetProject=\{canForgetProjectFromTopNav\}/, "temporary new-video drafts must keep an abandon action in the top project control before they become story content"));
checkMessage(requireWithin(appSource, /function resetAllProjectState\(\)[\s\S]*setDirectorNewVideoStatus\(undefined\)[\s\S]*setNewVideoSessionResetNonce\(\(nonce\) => nonce \+ 1\)/, "project reset must clear active new-video draft state and reset the new-video composer"));
checkMessage(requireWithin(appSource, /if \(!freshProjectSessionRequested \|\| freshProjectSessionResetAttemptedRef\.current\) return undefined;[\s\S]*resetAllProjectState\(\);[\s\S]*setProjectPathInput\(""\);[\s\S]*setProjectRealChainState\(\{ status: "unavailable", message: "新项目待开始。"/, "fresh project sessions must clear visible project and Agent state immediately"));
checkMessage(requireWithin(directorModeSource, /newVideoResetKey\?: number[\s\S]*effectiveNewVideoComposerResetKey[\s\S]*project-reset[\s\S]*useEffect\(\(\) => \{[\s\S]*setNewVideoStatus\(undefined\)[\s\S]*setAgentNewVideoDraftActive\(false\)[\s\S]*key=\{effectiveNewVideoComposerResetKey \|\| "new-video-start"\}[\s\S]*composerResetKey=\{effectiveNewVideoComposerResetKey\}/, "Director mode must forward project resets into the new-video entry UI"));
checkMessage(requireWithin(directorModeSource, /newVideoSurfaceAgentTimelineEntries = useMemo\([\s\S]*\(\) => newVideoResetKey[\s\S]*\? \[\][\s\S]*restoredAgentTimelineEntries[\s\S]*\[newVideoResetKey,\s*restoredAgentTimelineEntries\]/, "Project reset must keep abandoned new-video Agent timeline entries out of the fresh entry"));
checkMessage(requireWithin(`${newVideoStartSource}\n${directorModeSource}`, /sessionResetKey\?: number[\s\S]*activeNewVideoResetKey[\s\S]*surfaceAgentIntakeCommand[\s\S]*sessionResetKey[\s\S]*activeNewVideoResetKey[\s\S]*agentIntakeCommand=\{surfaceAgentIntakeCommand\}/, "Project reset must block stale right-rail new-video commands from replaying into the fresh entry"));
checkMessage(requireWithin(directorModeSource, /activeNewVideoResetKeyRef[\s\S]*activeNewVideoResetKey[\s\S]*handleNewVideoStatusChange[\s\S]*activeNewVideoResetKeyRef\.current !== activeNewVideoResetKey[\s\S]*return/, "Project reset must ignore stale new-video status callbacks from the abandoned entry"));
checkMessage(requireWithin(appSource, /async function forgetProjectFileRoot\(\)[\s\S]*const draftTargetToForget = prototypeProjectDraftTarget[\s\S]*resetAllProjectState\(\);[\s\S]*await forgetCurrentProject\(\)/, "top nav abandon must reset the visible project before slower runtime cleanup can let stale draft status reappear"));
checkMessage(requireWithin(newVideoStartSource, /function clearAllStoredNewVideoComposerDrafts\(\)[\s\S]*newVideoComposerDraftStorageKeyPrefix[\s\S]*composerStorageKeyRef\.current = composerStorageKey[\s\S]*clearAllStoredNewVideoComposerDrafts\(\)[\s\S]*clearStoredNewVideoComposerDraft\(composerStorageKey\)/, "NewVideoStart reset must clear all stored composer drafts and prevent storage-key hydration from restoring an abandoned idea"));
checkMessage(requireWithin(newVideoStartSource, /composerResetKeyRef\.current = composerResetKey[\s\S]*storyboardAiPlanRunIdRef\.current \+= 1[\s\S]*setStoryboardPlanningStartedAt\(undefined\)[\s\S]*setStoryboardPlanningElapsedSeconds\(0\)/, "NewVideoStart reset must invalidate pending storyboard timers and AI plan callbacks"));
checkMessage(requireWithin(directorModeSource, /<MinimalAgentPanel[\s\S]*newVideoResetKey=\{activeNewVideoResetKey\}[\s\S]*newVideoDraftPendingForAgent=/, "Director mode must forward project resets into the right-side Agent panel"));
checkMessage(requireWithin(minimalAgentPanelSource, /newVideoResetKey\?: number[\s\S]*newVideoResetKeyRef[\s\S]*useEffect\(\(\) => \{[\s\S]*newVideoResetKeyRef\.current === newVideoResetKey[\s\S]*setText\(""\)[\s\S]*setAgentTimelineEntries\(\[\]\)[\s\S]*setActiveComposerTurnIntent\(""\)[\s\S]*onPendingAgentActionChange\?\.\(false\)[\s\S]*onCurrentTaskProjectionChange\?\.\(undefined\)/, "MinimalAgentPanel reset must clear abandoned right-rail turns, messages, pending state, and the published current-task projection"));
check(!/prototypeProjectVibeRef\.current\.shots\.length > 0 \|\| projectFileSelectionRef\.current\.status === "selected"/.test(appSource), "fresh project reset must not preserve stale visible shots or project selections");
checkMessage(requireWithin(projectFileUiSource, /!canUseLocalProjectPicker[\s\S]*可以先整理想法[\s\S]*if \(selection\.detail\)/, "preview project detail must not be hidden by stale project-picker detail"));
checkMessage(requireWithin(minimalTopNavSource, /projectPickerDisabledCopy[\s\S]*可以先整理想法[\s\S]*project-control-action-note/, "top nav disabled project actions must explain unsaved drafts"));
checkMessage(requireWithin(stylesSource, /\.project-control-summary\s*\{[\s\S]*border-top:[\s\S]*padding-top:/, "top nav project control summary must have a distinct readable row"));
checkMessage(requireWithin(stylesSource, /\.project-control-recent-meta\s*\{[\s\S]*font-family:\s*inherit/, "top nav recent project metadata should read like product copy, not a path"));
checkMessage(requireWithin(stylesSource, /\.project-control-recent-empty\s*\{[\s\S]*line-height:/, "top nav recent project empty state must be readable"));
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
  .map((match) => match[0].replace(/<button\b[^>]*>/gi, "<button>"))
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
checkMessage(requireWithin(newVideoStart, /new-video-agent-reply/, "NewVideoStart must show an Agent reply card after sending instead of only changing the page state"));
checkMessage(requireWithin(newVideoStart, /new-video-agent-thread[\s\S]*new-video-agent-message/, "NewVideoStart Agent reply must be rendered as a message thread"));
checkMessage(requireWithin(newVideoStart, /和 AI 导演的对话/, "NewVideoStart Agent thread must label the dialogue surface"));
checkMessage(requireWithin(newVideoStart, /AI 导演：/, "NewVideoStart Agent thread must label assistant messages"));
checkMessage(requireWithin(minimalAgentPanel, /passiveAgentReply/, "MinimalAgentPanel must translate project status into a visible Agent reply"));
checkMessage(requireWithin(minimalAgentPanel, /minimal-agent-thread[\s\S]*minimal-agent-message/, "MinimalAgentPanel must render Agent status and plans as a message thread"));
checkMessage(requireWithin(minimalAgentPanel, /agentThreadRef[\s\S]*thread\.scrollTop\s*=\s*activeConfirmationMessageId \? 0 : thread\.scrollHeight/, "MinimalAgentPanel must anchor the active confirmation first while keeping the latest reply visible when no confirmation is active"));
checkMessage(requireWithin(minimalAgentPanel, /和 AI 导演的对话/, "MinimalAgentPanel Agent thread must label the dialogue surface"));
checkMessage(requireWithin(minimalAgentPanel, /AI 导演：/, "MinimalAgentPanel Agent thread must label assistant messages"));
checkMessage(requireWithin(stylesSource, /\.new-video-agent-reply\b/, "Agent reply card styling is missing"));
checkMessage(requireWithin(stylesSource, /\.new-video-agent-message\.user[\s\S]*justify-self:\s*end[\s\S]*\.new-video-agent-message\.assistant[\s\S]*justify-self:\s*start/, "New video Agent thread must visually separate user and assistant messages"));
checkMessage(requireWithin(stylesSource, /\.minimal-agent-message\.user[\s\S]*justify-self:\s*end[\s\S]*\.minimal-agent-message\.assistant[\s\S]*justify-self:\s*start/, "Project Agent thread must visually separate user and assistant messages"));
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
