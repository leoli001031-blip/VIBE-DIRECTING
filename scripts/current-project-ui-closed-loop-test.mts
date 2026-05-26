import fs from "node:fs";
import {
  currentProjectBindingIdentity,
  deriveCurrentProjectChoices,
  deriveCurrentProjectBindingStatus,
  deriveProjectRealChainStatus,
  guardProjectRealChainUiStateForCurrentProject,
  loadCurrentProjectBindingStatus,
  loadCurrentProjectChoices,
  loadProjectRealChainStatus,
  projectCurrentBindingEndpoint,
  projectCurrentChoicesEndpoint,
  projectCurrentSelectEndpoint,
  projectRuntimeRequestPath,
  projectRealChainRunCheckEndpoint,
  projectRealChainStatusEndpoint,
  projectRound5StrictEditReturnEndpoint,
  runProjectRealChainCheck,
  selectCurrentProjectBinding,
} from "../src/core/projectCurrentRuntimeClient.ts";
import {
  confirmProjectImage2OneShot,
  deriveProjectImage2BatchPlanStatus,
  deriveProjectImage2OneShotStatus,
  executeReturnedProjectImage2OneShot,
  guardProjectImage2BatchUiStateForCurrentProject,
  guardProjectImage2OneShotUiStateForCurrentProject,
  loadProjectImage2BatchPlan,
  loadProjectImage2OneShotStatus,
  prepareProjectImage2OneShot,
  prepareProjectImage2OneShotPermissionReceipt,
  prepareProjectImage2OneShotTrigger,
  projectImage2BatchPlanEndpoint,
  projectImage2BatchRunCheckEndpoint,
  projectImage2OneShotStatusEndpoint,
  projectImage2OneShotPrepareEndpoint,
  projectImage2OneShotConfirmEndpoint,
  projectImage2OneShotPrepareTriggerEndpoint,
  projectImage2OneShotExecuteReturnEndpoint,
  runProjectImage2BatchCheck,
} from "../src/core/projectImage2Client.ts";
import {
  applyCurrentProjectWorkbenchProjectionToRuntimeState,
  buildCurrentProjectWorkbenchProjection,
  currentProjectWorkbenchProjectionSource,
} from "../src/core/currentProjectWorkbenchProjection.ts";
import {
  buildCurrentProjectPreviewProjection,
} from "../src/core/currentProjectPreviewProjection.ts";
import { createAssetLibraryFromCurrentProjectWorkbench } from "../src/ui/app/projectRuntimeProjections.ts";
import { assetLibraryAssetToRecord } from "../src/ui/director/assetLibraryUi.ts";
import { toMediaSrc } from "../src/ui/common/MediaFrame.tsx";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readText(path) {
  return fs.readFileSync(path, "utf8");
}

function findFunctionBody(source, functionName) {
  const signature = `function ${functionName}`;
  const start = source.indexOf(signature);
  assert(start >= 0, `${functionName} is missing`);
  const paramsOpen = source.indexOf("(", start);
  assert(paramsOpen >= 0, `${functionName} has no params`);
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
  const open = source.indexOf("{", paramsClose);
  assert(open >= 0, `${functionName} has no body`);
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth === 0) return source.slice(open + 1, index);
  }
  throw new Error(`${functionName} body was not closed`);
}
function assertProductCopy(message) {
  assert(/未选择项目|未同步/.test(message || ""), "unbound/mismatch copy should be product-facing");
  assert(!/005|fallback|endpoint|provider|ledger|prompt|queue/i.test(message || ""), "unbound/mismatch copy must not expose engineering/demo details");
}

function extractStringLiterals(source) {
  return Array.from(source.matchAll(/(["'`])((?:\\.|(?!\1)[\s\S])*?)\1/g))
    .map((match) => match[2])
    .join("\n");
}

function assertCreatorPanelContract() {
  const appSource = readText("src/App.tsx");
  const currentProjectRuntimeHookSource = readText("src/ui/app/useCurrentProjectRuntimePanels.ts");
  const minimalTopNavSource = readText("src/ui/director/MinimalTopNav.tsx");
  const directorModeSource = readText("src/ui/director/DirectorModeShell.tsx");
  const creatorDeskPanelsSource = readText("src/ui/director/CreatorDeskPanels.tsx");
  const creatorDeskProjectionSource = readText("src/ui/app/creatorDeskProjection.ts");
  const workbenchProjectionSource = readText("src/core/currentProjectWorkbenchProjection.ts");
  const minimalStoryFlowSource = readText("src/ui/director/MinimalStoryFlow.tsx");
  const agentPanelSource = readText("src/ui/director/MinimalAgentPanel.tsx");
  const agentPanelProjectionSource = readText("src/ui/director/agentPanelProjection.ts");
  const p6RealImage2ActionSource = readText("src/ui/director/useP6RealImage2Action.ts");
  const image2AssetGenerationActionSource = readText("src/ui/director/useImage2AssetGenerationAction.ts");
  const projectRealChainPanelSource = readText("src/ui/project/ProjectRealChainPanel.tsx");
  const agentPanelContractSource = `${agentPanelSource}\n${agentPanelProjectionSource}`;
  const stylesSource = `${readText("src/styles.css")}\n${readText("src/ui/project/ProjectRealChainPanel.css")}`;
  const app = findFunctionBody(appSource, "App");
  const currentProjectRuntimeSurface = `${app}\n${currentProjectRuntimeHookSource}`;
  const panel = findFunctionBody(projectRealChainPanelSource, "ProjectRealChainPanel");
  const surface = [
    panel,
    findFunctionBody(projectRealChainPanelSource, "projectRealChainStatusLabel"),
    findFunctionBody(projectRealChainPanelSource, "projectReviewCheckStatusLabel"),
    findFunctionBody(projectRealChainPanelSource, "projectReviewCheckDetail"),
    findFunctionBody(projectRealChainPanelSource, "projectPreviewReadyLabel"),
    findFunctionBody(projectRealChainPanelSource, "projectProductionReviewLabel"),
    findFunctionBody(projectRealChainPanelSource, "projectOneShotStatusLabel"),
    findFunctionBody(projectRealChainPanelSource, "projectOneShotProgress"),
    findFunctionBody(projectRealChainPanelSource, "projectOneShotEvidence"),
  ].join("\n");

  for (const [label, pattern] of [
    ["runtime endpoint", /runtime\s+endpoint/i],
    ["fallback report", /fallback\s+report/i],
    ["005 sandbox", /005\s+sandbox/i],
    ["real demo id", /real_demo_e2e_005/i],
    ["demo", /\bdemo\b/i],
    ["provider submit", /provider\s+submit|provider\s+未提交/i],
    ["prompt", /\bprompt\b/i],
    ["queue", /\bqueue\b/i],
    ["prepare ran", /prepare\s+ran|prepareRan|prepare\s+未执行/i],
    ["live submit", /live\s+submit/i],
    ["ledger", /\bledger\b/i],
    ["needs review English", /needs\s+review/i],
  ]) {
    assert(!pattern.test(surface), `ProjectRealChainPanel exposed ${label}`);
  }

  assert(/项目状态/.test(surface), "ProjectRealChainPanel should expose creator-facing project status copy");
  assert(/本地复核/.test(surface), "ProjectRealChainPanel should expose creator-facing review copy");
  assert(/未选择项目/.test(surface), "ProjectRealChainPanel should expose unbound project copy");
  assert(/未同步/.test(surface), "ProjectRealChainPanel should expose unsynced project copy");
  assert(/项目路径/.test(surface), "ProjectRealChainPanel should expose project path selection copy");
  assert(/打开项目/.test(surface), "ProjectRealChainPanel should expose project open copy");
  assert(/项目文件状态/.test(panel), "ProjectRealChainPanel should expose project file status");
  assert(/最近项目/.test(surface), "ProjectRealChainPanel should expose recent projects copy");
  assert(/onRemoveRecentProject/.test(minimalTopNavSource), "Top project control must let creators remove a recent project record");
  assert(/移除这条项目记录，不删除本地文件/.test(minimalTopNavSource), "Recent project removal must explain that local files are not deleted");
  assert(/onRemoveRecentProject=\{removeRecentProjectRecord\}/.test(appSource), "App must wire recent project record removal into the project control");
  assert(/连接项目/.test(surface), "ProjectRealChainPanel should expose connect project copy");
  assert(/已观察输出[\s\S]*returnedCount[\s\S]*plannedCount/.test(surface), "ProjectRealChainPanel should show observed output count");
  assert(/张需复核/.test(surface), "ProjectRealChainPanel should show needs-review image count");
  assert(/Preview[\s\S]*ready/.test(surface), "ProjectRealChainPanel should expose preview ready state");
  assert(/Production[\s\S]*needs_review/.test(surface), "ProjectRealChainPanel should expose production review state");
  assert(/<button disabled=\{disabled\} onClick=\{onRun\}>[\s\S]*同步状态/.test(panel), "sync status button must route to project status run-check");
  assert(/<button disabled=\{reviewDisabled\} onClick=\{onRunImage2Batch\}>[\s\S]*复核检查/.test(panel), "review check button must route to Image2 batch run-check");
  assert(/单镜头小样/.test(surface), "ProjectRealChainPanel should expose one-shot sample copy");
  assert(/P6 单镜头小样/.test(surface), "ProjectRealChainPanel should expose P6 one-shot flow copy");
  assert(/准备小样包/.test(surface), "ProjectRealChainPanel should expose sample prepare copy");
  assert(/确认动作/.test(surface), "ProjectRealChainPanel should expose action confirmation copy");
  assert(/等待结果/.test(surface), "ProjectRealChainPanel should expose waiting-result copy");
  assert(/授权票据/.test(surface), "ProjectRealChainPanel should expose permission receipt copy");
  assert(/授权引用/.test(surface), "ProjectRealChainPanel should expose authorization reference copy");
  assert(/只生成许可回执/.test(surface), "ProjectRealChainPanel should state permission receipt only copy");
  assert(/不读取密钥、不直接生成/.test(surface), "ProjectRealChainPanel should state no secret read/no direct generation copy");
  assert(/动作记录/.test(surface), "ProjectRealChainPanel should expose action evidence without provider copy");
  assert(/文件指纹/.test(surface), "ProjectRealChainPanel should expose file fingerprint evidence");
  assert(/已收到画面，复核后再进入正式结果/.test(surface), "ProjectRealChainPanel should expose needs-review evidence in user language");
  assert(/未发现可用结果/.test(surface), "ProjectRealChainPanel should expose missing-result state");
  assert(/重新检查/.test(surface), "ProjectRealChainPanel should let missing returns be checked again");
  assert(/retryHint/.test(projectRealChainPanelSource), "ProjectRealChainPanel should surface retry hints without engineering language");
  assert(/只准备小样和检查结果，不直接发起生成/.test(surface), "ProjectRealChainPanel should state no direct submit from UI");
  assert(/生成许可回执/.test(surface), "ProjectRealChainPanel should expose permission receipt action");
  assert(/结果检查/.test(surface), "ProjectRealChainPanel should expose result-check step");
  assert(/onPrepareImage2OneShot/.test(panel), "one-shot sample button must route to prepare handler");
  assert(/onChooseProjectRoot/.test(panel), "project open button must route to the Electron project chooser handler");
  assert(/onPrepareImage2OneShotPermissionReceipt/.test(panel), "permission receipt button must route to explicit helper");
  assert(/permissionBaseReady[\s\S]*Boolean\(image2OneShotState\.receipt \|\| image2OneShotState\.summary\?\.receipt\)[\s\S]*&& sampleWaiting[\s\S]*&& !sampleRunning[\s\S]*&& !sampleReview/.test(panel), "permission receipt button must enable only after handoff is confirmed");
  assert(!/permissionBaseReady[\s\S]{0,180}sampleReady\s*\|\|\s*sampleWaiting/.test(panel), "prepared state must not enable permission receipt button before handoff");
  assert(/onConfirmImage2OneShot/.test(panel), "one-shot confirm button must route to confirm handler");
  assert(/onCheckImage2OneShotReturn/.test(panel), "one-shot sample button must route to execute-return handler");
  assert(!/callImage2Provider|submitProvider|liveSubmit/.test(panel), "P6 panel must not directly trigger live generation");
  assert(/import\s+"\.\/ProjectRealChainPanel\.css"/.test(projectRealChainPanelSource), "ProjectRealChainPanel must import its extracted CSS");
  assert(/aria-label="当前项目状态"/.test(panel), "current project panel should use creator-facing status aria copy");
  assert(/aria-label="P6 单镜头流程"/.test(panel), "P6 one-shot flow should have user-facing aria copy");
  assert(/aria-label="P6 结果状态"/.test(panel), "P6 result status should have user-facing aria copy");
  assert(/aria-label="当前项目预览图"/.test(panel), "current project thumbnails should use creator-facing preview aria copy");
  assert(/\.project-real-chain-one-shot-flow\s*\{[\s\S]*grid-area:\s*flow[\s\S]*grid-template-columns:\s*repeat\(4/.test(stylesSource), "P6 flow should render as a stable four-step row");
  assert(/className="project-real-chain-messages"[\s\S]*className="project-real-chain-message"/.test(panel), "ProjectRealChainPanel should group messages before placing them in the grid");
  assert(/\.project-real-chain-messages\s*\{[\s\S]*grid-area:\s*message[\s\S]*display:\s*flex[\s\S]*flex-wrap:\s*wrap/.test(stylesSource), "project real-chain messages should share one wrapping grid item");
  assert(!/\.project-real-chain-message\s*\{[\s\S]{0,160}grid-area:\s*message/.test(stylesSource), "individual project real-chain messages must not claim the grid area");
  assert(/displayTitle[\s\S]*runtime 状态已同步/.test(surface), "ProjectRealChainPanel should show the bound title for synced runtime status");
  assert(/selectCurrentProjectBinding\(\{\s*projectRoot/.test(currentProjectRuntimeSurface), "current project hook must select the current project through the runtime helper");
  assert(/chooseProjectRoot\(\)/.test(app), "App must use the Electron project chooser when opening a project file root");
  assert(
    /const\s+activeProjectFileRoot\s*=\s*projectFileSelection\.status\s*===\s*"selected"[\s\S]{0,120}:\s*undefined/.test(app),
    "App must only write Project.vibe files after the user opens a project folder",
  );
  assert(
    !/const\s+activeProjectFileRoot[\s\S]{0,160}runtimeProjectIdentity\?\.projectRoot/.test(app),
    "App must not reuse runtime fixture identity as an Electron project-file write target",
  );
  assert(
    /projectDraftTargetForNewVideoConfirmation[\s\S]*createNewVideoLocalProject/.test(app),
    "new-video confirmation must create a local project before Project.vibe writes when no project is selected",
  );
  assert(
    /reserveForImmediateSave:\s*true/.test(app) && /先新建或打开本地项目，再确认草案/.test(app),
    "new-video confirmation must reserve the newly created project target and use creator-facing fallback copy",
  );
  const openOrInitializeProjectDraft = findFunctionBody(app, "openOrInitializeProjectDraft");
  const bindProjectFileRootSelection = findFunctionBody(app, "bindProjectFileRootSelection");
  assert(
    /applyProjectVibeProjectState\(createEmptyProjectVibeForProjectRoot\([\s\S]*selection\.projectRoot[\s\S]*displayName/.test(bindProjectFileRootSelection),
    "project switching must immediately stage a clean local project shell before async Project.vibe loading",
  );
  assert(
    /setProjectImage2BatchState\(\{\s*status:\s*"unavailable"[\s\S]*正在同步当前项目复核状态/.test(bindProjectFileRootSelection),
    "project switching must clear stale reference review state while loading the selected project",
  );
  assert(
    /createEmptyProjectVibeForProjectRoot\([\s\S]*projectFileSelection\.projectRoot[\s\S]*projectFileSelection\.displayName[\s\S]*\)/.test(openOrInitializeProjectDraft),
    "empty local projects must initialize from a clean project document tied to the selected folder",
  );
  assert(
    !/createProjectVibeFromRuntimeState\(workbenchRuntimeState\)/.test(openOrInitializeProjectDraft),
    "empty local projects must not copy the previous workbench story into the new project.vibe",
  );
  assert(/projectFileRootSelected/.test(currentProjectRuntimeSurface), "current project path must keep project-file selection usable even when runtime sync is unavailable");
  assert(/loadCurrentProjectChoices\(\)/.test(currentProjectRuntimeSurface), "current project hook must load recent project choices through the runtime helper");
  assert(/selectProjectChoice/.test(currentProjectRuntimeSurface), "current project path must route recent project choices through the current selection helper");
  assert(/refreshCurrentProjectPanels\(binding\)/.test(currentProjectRuntimeSurface), "current project hook must refresh current binding and project panels after selection");
  assert(/loadCurrentProjectBindingStatus\(\)/.test(currentProjectRuntimeSurface), "current project hook must load runtime current project binding first");
  assert(/currentProjectBindingIdentity\(runtimeProjectBinding\)/.test(currentProjectRuntimeSurface), "current project hook must derive current project identity from runtime binding");
  assert(!/currentProjectIdentity\(runtimeState\)/.test(currentProjectRuntimeSurface), "current project path must not derive current project identity from runtime-state.json");
  assert(/loadProjectRealChainStatus\(runtimeProjectIdentity\)/.test(currentProjectRuntimeSurface), "current project hook must guard real-chain status by runtime binding identity");
  assert(/loadProjectImage2BatchPlan\(runtimeProjectIdentity\)/.test(currentProjectRuntimeSurface), "current project hook must guard Image2 batch status by runtime binding identity");
  assert(/runProjectRealChainCheck\(runtimeProjectIdentity\)/.test(currentProjectRuntimeSurface), "current project hook run-check must use runtime binding identity");
  assert(/runProjectImage2BatchCheck\(runtimeProjectIdentity\)/.test(currentProjectRuntimeSurface), "current project hook Image2 check must use runtime binding identity");
  assert(/rememberProjectRoot\(runtimeProjectBinding\.projectRoot\)/.test(app), "runtime-selected projects must be registered with the Electron file sandbox before local writes");
  assert(/Failed to remember runtime-selected project root/.test(app), "runtime-selected project sandbox registration must fail softly");
  assert(/projectDraftTargetForNewVideoConfirmation[\s\S]*rememberProjectRoot\(prototypeProjectDraftTarget\.projectRoot\)/.test(app), "new-video confirmation must re-register selected project folders before writing Project.vibe");
  assert(/buildCurrentProjectWorkbenchProjection\(\{[\s\S]*binding:\s*effectiveRuntimeProjectBinding[\s\S]*realChainState:\s*projectRealChainState[\s\S]*image2BatchState:\s*projectImage2BatchState/.test(app), "App must derive the main workbench from current project runtime projection");
  assert(/applyCurrentProjectWorkbenchProjectionToRuntimeState\(runtimeState,\s*currentProjectProjectionForRuntime\)/.test(app), "App must bind Story Flow to the sanitized current project workbench projection");
  assert(/useCurrentProjectWorkbenchProjection\s*=\s*currentProjectWorkbenchProjection\.available/.test(app), "App must gate current-project projection so opened Project.vibe can remain the main state");
  assert(/currentProjectHasOnlyPlaceholder[\s\S]*CURRENT_PROJECT[\s\S]*current_project_story_pending/.test(app), "App must recognize the current-project placeholder shot as an empty project shell");
  assert(/currentProjectProjectionForRuntime[\s\S]*shots:\s*\[\][\s\S]*sections:\s*\[\]/.test(app), "Empty current-project placeholders must clear stale story and section state before rendering");
  assert(/normalizeProjectRootForUiCompare/.test(appSource), "App must normalize project roots before comparing current-project projections");
  assert(/\/\.vibe-runtime\//.test(appSource), "App project-root comparison must collapse absolute and repo-relative .vibe-runtime roots");
  assert(!/const\s+currentProjectProjectionMatchesSelectedRoot\s*=\s*runtimeCurrentProjectIsBound/.test(app), "App must not let a bound runtime projection bypass selected project-root matching");
  assert(/const\s+currentProjectProjectionMatchesSelectedRoot\s*=\s*!normalizedSelectedProjectRoot[\s\S]*normalizedProjectionProjectRoot\s*===\s*normalizedSelectedProjectRoot/.test(app), "App must only use current-project projection when it matches the selected project root");
  assert(/setProjectRealChainState\(\{\s*status:\s*"running"[\s\S]*正在连接当前项目/.test(currentProjectRuntimeHookSource), "project switching must clear stale real-chain summaries instead of spreading previous state");
  assert(!/setProjectRealChainState\(\(current\)\s*=>\s*\(\{\s*\.\.\.current[\s\S]*正在连接当前项目/.test(currentProjectRuntimeHookSource), "project switching must not preserve previous real-chain summary while connecting");
  assert(!/useCurrentProjectWorkbenchProjection[\s\S]{0,260}currentProjectProjectionHasStoryContent/.test(app), "Empty current projects must still use the current-project projection to clear stale story and asset state");
  assert(/const\s+isEmptyFallbackWorkbench\s*=\s*selectedProjectHasNoContent/.test(app), "Selected empty projects must return to the new-video entry instead of showing a fake story shot");
  assert(/assetLibraryNode=\{\s*<MinimalAssetLibrary[\s\S]*readOnlyDetail=\{workbenchAssetReadOnlyDetail\}/.test(app), "App must bind Asset Library fallback copy through the effective workbench detail");
  assert(/projectScopeLabel=\{workbenchProjectScopeLabel\}/.test(app), "App must bind Agent scope through the effective workbench label");
  assert(/runtimeState=\{workbenchRuntimeState\}/.test(app), "DirectorMode must receive the current project workbench runtime state");
  assert(/buildCreatorDeskProjection\(\{[\s\S]*runtimeState:\s*workbenchRuntimeState[\s\S]*previewItems:\s*directorPreviewQueue[\s\S]*image2BatchState:\s*projectImage2BatchState[\s\S]*selectedShotIds:\s*workbenchSelectedShotIds/.test(app), "App must derive the creator desk from current project workbench projection");
  assert(/creatorDesk=\{creatorDeskProjection\}/.test(app), "DirectorMode must receive the creator desk projection");
  assert(/pendingReferenceReviewCount/.test(appSource), "App must block video submit while references still need review");
  assert(/pendingReferenceReviewCount\s*=\s*workbenchRuntimeState\.visualMemory\.assets\.filter/.test(appSource), "Video submit gate must derive reference blockers from visual memory assets");
  assert(!/pendingReferenceReviewCount[\s\S]{0,260}framePlan\.(?:reviewCount|missingCount)/.test(appSource), "Video submit gate must not treat missing video/shot outputs as reference review blockers");
  assert(/先复核参考素材，再提交视频/.test(appSource), "Video submit gate should use creator-facing review copy");
  assert(/videoSendAction=\{gatedVideoSubmitAction\}/.test(appSource), "DirectorMode must receive the gated video submit action");
  assert(/onRetryMissingBatch=\{runProjectImage2Batch\}/.test(app), "DirectorMode must route Retry Missing through the batch check handler");
  assert(/onRetryReviewItem=\{\(item\)\s*=>\s*applyCreatorReviewDecision\(item,\s*"retry"\)\}/.test(app), "DirectorMode must route per-item retry through Project.vibe review decisions");
  assert(/onRejectReviewItem=\{\(item\)\s*=>\s*applyCreatorReviewDecision\(item,\s*"reject"\)\}/.test(app), "DirectorMode must route reject through Project.vibe review decisions");
  assert(/submitCurrentProjectReviewDecision\(effectiveRuntimeProjectIdentity,\s*\{/.test(app), "review decisions must use the current project runtime route when a project folder is bound");
  assert(/onRunProjectRealChain=\{runProjectRealChain\}/.test(appSource), "DirectorMode must pass runtime status run-check handler to the project panel");
  assert(/onRunProjectImage2Batch=\{runProjectImage2Batch\}/.test(appSource), "DirectorMode must pass Image2 batch run-check handler to the project panel");
  assert(/scopeCopy\s*=\s*"整个项目"/.test(image2AssetGenerationActionSource), "Project reference completion must be project-scoped, not current-shot scoped");
  assert(/selectedShotId:\s*undefined/.test(image2AssetGenerationActionSource), "Project reference completion must not submit only the selected shot");
  assert(/车灯、手部、雨雾这类细小画面会写进对应说明里/.test(image2AssetGenerationActionSource), "reference completion copy should explain generic detail folding");
  assert(/convenience_store/.test(workbenchProjectionSource), "workbench projection should understand convenience-store scenes");
  assert(/convenience_store/.test(minimalStoryFlowSource), "story flow reference matching should understand convenience-store scenes");
  assert(/convenience_store[\s\S]*mountain_road/.test(workbenchProjectionSource), "workbench scene matching should prefer convenience-store before mountain-road");
  assert(/convenience_store[\s\S]*mountain_road/.test(minimalStoryFlowSource), "story flow scene matching should prefer convenience-store before mountain-road");
  assert(/function\s+isReferenceAssetPath/.test(minimalStoryFlowSource), "story flow must distinguish reusable reference assets from actual shot media");
  assert(/actualShotFramePath\(shot\.startFrame\)/.test(minimalStoryFlowSource), "story flow must not treat reference assets as real shot frames");
  assert(/missingLabel:\s*"待生成故事板"/.test(minimalStoryFlowSource), "storyboard-mode reference bundles must reserve image 1 when the storyboard is not generated yet");
  assert(/statusLabel:\s*item\.asset\?\.path[\s\S]*item\.missingLabel/.test(minimalStoryFlowSource), "storyboard placeholder references must surface a user-facing missing state");
  assert(/storyboardStatusTone[\s\S]*strategy === "omni_reference" \? "ok" : "warn"/.test(minimalStoryFlowSource), "storyboard reference UI should not mark missing storyboard images as ready");
  assert(/没有拿到结果图，可以再次生成重试/.test(p6RealImage2ActionSource), "real Image2 UI action should tell the creator a failed result can be retried");
  assert(/如果网络中断，可以稍后再次生成/.test(p6RealImage2ActionSource), "real Image2 running copy should set retry expectation for long network requests");
  assert(/import\s+\{\s*DirectorMode\s*\}\s+from\s+"\.\/ui\/director\/DirectorModeShell"/.test(appSource), "App must mount the extracted DirectorModeShell");
  assert(/import\s+\{\s*MinimalAgentPanel\s*\}\s+from\s+"\.\/MinimalAgentPanel"/.test(directorModeSource), "DirectorMode must mount the extracted MinimalAgentPanel");
  assert(/import\s+\{\s*CreatorDeskPanels\s*\}\s+from\s+"\.\/CreatorDeskPanels"/.test(directorModeSource), "DirectorMode must mount the creator desk panels");
  const creatorDeskPanelCopy = extractStringLiterals(creatorDeskPanelsSource);
  assert(/故事计划[\s\S]*画面准备[\s\S]*复核列表/.test(creatorDeskPanelsSource), "Creator desk must expose planner, preparation, and review panels in product copy");
  assert(/视频生成/.test(creatorDeskPanelsSource), "Creator desk must expose the video generation panel");
  for (const statusLabel of ["未生成", "已提交", "排队中", "生成中", "已完成", "可稍后恢复"]) {
    assert(new RegExp(statusLabel).test(creatorDeskPanelsSource), `Creator desk must expose ${statusLabel} video status`);
  }
  assert(/即梦常见约[\s\S]*分钟[\s\S]*可以离开后恢复查询/.test(creatorDeskPanelsSource), "Creator desk must describe long Jimeng waits with resume copy");
  for (const statusLabel of ["待复核", "待补齐", "可重试", "已通过", "已锁定"]) {
    assert(new RegExp(statusLabel).test(creatorDeskPanelCopy), `Creator desk must expose ${statusLabel}`);
  }
  for (const actionLabel of ["通过", "重试", "拒绝", "锁定", "绑定为", "查看生成说明"]) {
    assert(new RegExp(actionLabel).test(creatorDeskPanelsSource), `Creator desk must expose ${actionLabel} action`);
  }
  for (const lockLabel of ["角色参考", "场景参考", "道具参考", "本镜头参考"]) {
    assert(new RegExp(lockLabel).test(creatorDeskPanelsSource), `Creator desk must expose ${lockLabel} lock target`);
  }
  assert(/onLockReviewItem=\{\(item,\s*target\)\s*=>\s*applyCreatorReviewDecision\(item,\s*"lock",\s*target\)\}/.test(app), "DirectorMode must route lock target through Project.vibe review decisions");
  assert(/assetKind:\s*promotionMode\s*\?\s*lockAssetKind\s*:\s*"reference"[\s\S]*assetLabel[\s\S]*usedByShotIds/.test(app), "App must promote Review Tray locks with selected asset kind, label, and shot usage");
  assert(/cleanReviewItemProjectLabel\(item\.label\)/.test(app), "Review Tray promotion must strip transient UI status copy before writing Project.vibe asset labels");
  assert(/loadProjectRealChainStatus\(effectiveRuntimeProjectIdentity\)[\s\S]*setProjectRealChainState\(refreshed\)/.test(app), "Review Tray promotion must refresh the current-project workbench projection after writing Project.vibe");
  assert(!/Script Planner|Batch Generation|Review Tray|Needs review|Missing|Approved|Locked|Approve/.test(creatorDeskPanelCopy), "Creator desk panels must not expose English planner/review copy");
  assert(/concurrencyLabel:\s*"Concurrency 10"[\s\S]*retryLabel:\s*"Retry Missing"/.test(creatorDeskProjectionSource), "Creator batch projection must show concurrency 10 and Retry Missing");
  assert(/safetyLabel[\s\S]*Retry downshifts to/.test(creatorDeskProjectionSource), "Creator batch projection must expose retry downshift copy");
  assert(/videoGeneration[\s\S]*buildCreatorVideoGenerationProjection/.test(creatorDeskProjectionSource), "Creator desk projection must include Jimeng video status");
  assert(!/provider|schema|task[-\s]*envelope/i.test(creatorDeskPanelsSource), "Creator desk panels must not expose engineering terms");
  assert(/确认/.test(agentPanelContractSource), "Agent Panel confirmation action should use creator-facing confirmation copy");
  assert(/创作者路径/.test(agentPanelSource), "Agent Panel should label the default creator path");
  assert(/描述修改[\s\S]*生成计划[\s\S]*确认应用/.test(agentPanelSource), "Agent Panel should expose the simplified creator path");
  assert(/修改计划详情/.test(agentPanelSource), "Agent Panel should keep staged plan details behind disclosure");
  assert(/故事 \/ 镜头 \/ 复核记录/.test(agentPanelSource), "Agent Panel should name staged plan write targets in user copy");
  assert(
    /等待写入项目事实|已加入项目计划|已记录到项目/.test(agentPanelContractSource),
    "Agent Panel confirmation receipt should expose pending project plan write status",
  );
  assert(
    /已准备写入|已加入项目计划|已记录到项目/.test(agentPanelContractSource),
    "Agent Panel staged commit receipt should expose creator-facing ready-to-write copy",
  );
  assert(/stageProjectFactsForCommit/.test(agentPanelContractSource), "Agent Panel confirmation should use staged project facts commit API");
  assert(/providerCalled\s*===\s*false/.test(agentPanelContractSource) || /providerCalled/.test(agentPanelContractSource), "Agent Panel source should preserve provider-called false contract in runtime projections");
  assert(!/real-demo-005/.test(`${appSource}\n${stylesSource}`), "app/styles should not retain 005 demo class names");
}


assertCreatorPanelContract();

const currentEndpoint = "/api/runtime/projects/current/real-chain/status";
const round5StrictEditReturnEndpoint = "/api/runtime/projects/current/round5/strict-edit/return";
assert(
  projectRound5StrictEditReturnEndpoint === round5StrictEditReturnEndpoint,
  "formal runtime client must expose the Round 5 strict-edit return endpoint",
);
const queryPath = projectRuntimeRequestPath(currentEndpoint, {
  projectId: "最后一班星图",
  projectRoot: "/Users/lichenhao/Desktop/Vibe Director/runtime-tests/full_generation_10shot_two_act_20260429",
});
assert(queryPath === currentEndpoint, "current project requests must not carry project id/root query params");
assert(
  projectRuntimeRequestPath(projectRound5StrictEditReturnEndpoint, {
    projectId: "round5_zero_planning_anime_signal",
    projectRoot: "real-test-sandbox/round5-zero-project-planning-anime/runs/run-2026-05-09T11-09-28-642Z",
  }) === round5StrictEditReturnEndpoint,
  "Round 5 strict-edit return requests must use the current-project endpoint without 005 sample query params",
);

function currentProjectBindingResponse(project) {
  return {
    ok: true,
    status: "bound",
    currentProject: {
      bound: true,
      bindingPath: ".vibe/current-project-binding.json",
      binding: {
        schemaVersion: "vibe_core_current_project_binding_v1",
        projectRoot: project.projectRoot,
        projectRootRelativePath: project.projectRoot,
        projectVibeRelativePath: `${project.projectRoot}/project/project.vibe`,
        projectId: project.projectId,
        displayName: project.title,
        selectedAt: "2026-05-08T00:00:00.000Z",
      },
      project: {
        projectId: project.projectId,
        projectRoot: project.projectRoot,
        projectVibePath: `${project.projectRoot}/project/project.vibe`,
        title: project.title,
      },
      projectRoot: project.projectRoot,
      projectRootRelativePath: project.projectRoot,
      projectVibeRelativePath: `${project.projectRoot}/project/project.vibe`,
    },
  };
}

const boundBinding = deriveCurrentProjectBindingStatus({
  ...currentProjectBindingResponse({
    projectId: "real-demo-e2e-004",
    projectRoot: "/Users/lichenhao/Desktop/vibe core/runtime-tests/004",
    title: "004 当前项目",
  }),
});
assert(boundBinding.status === "bound", "bound current project status should parse");
assert(boundBinding.projectTitle === "004 当前项目", "bound current project title should parse");
assert(currentProjectBindingIdentity(boundBinding)?.projectId === "real-demo-e2e-004", "bound identity should include project id from currentProject.project");
assert(currentProjectBindingIdentity(boundBinding)?.projectRoot?.endsWith("/004"), "bound identity should come from current binding");

const binding005 = deriveCurrentProjectBindingStatus({
  ...currentProjectBindingResponse({
    projectId: "real-demo-e2e-005",
    projectRoot: "/Users/lichenhao/Desktop/vibe core/runtime-tests/005",
    title: "005 当前项目",
  }),
});

const unboundBinding = deriveCurrentProjectBindingStatus({ status: "unbound" });
assert(unboundBinding.status === "unbound", "unbound current project status should parse");
assert(!currentProjectBindingIdentity(unboundBinding), "unbound current project must not produce an identity");
assertProductCopy(unboundBinding.message);

const currentChoices = deriveCurrentProjectChoices({
  ok: true,
  choices: [
    { projectRoot: "real-test-sandbox/real-demo-e2e/004-image2-start-frames", displayName: "项目 004", projectId: "real_demo_e2e_004_image2_start_frames", status: "当前" },
    { projectRoot: "/Users/lichenhao/Desktop/vibe core/absolute-leak", displayName: "不应显示" },
  ],
});
assert(currentChoices.length === 1, "recent project choices should hide absolute paths");
assert(currentChoices[0].displayName === "项目 004", "recent project choices should preserve product display names");
assert(currentChoices[0].projectRoot.includes("004-image2-start-frames"), "recent project choices should remain selectable");

const stale005Payload = {
  schemaVersion: "current_project_real_chain_status.v1",
  project: {
    projectId: "real-demo-e2e-005",
    runId: "real_demo_e2e_005",
    projectRoot: "/Users/lichenhao/Desktop/vibe core/runtime-tests/005",
  },
  status: "preview_ready_with_review",
  previewStatus: "preview_ready_with_review",
  productionStatus: "needs_review",
  returnedImageCount: 8,
  totalPlannedImages: 8,
  needsReviewCount: 2,
  reviewShotIds: ["S07", "S08"],
  previewItems: [
    { shotId: "S07", order: 7, imageUrl: "/files/S07.png", reviewRequired: true },
    { shotId: "S08", order: 8, imageUrl: "/files/S08.png", reviewRequired: true },
  ],
  providerCalled: false,
  prepareRan: false,
};

const workbenchFacts004 = {
  schemaVersion: "vibe_core_current_project_workbench_facts_v1",
  source: "current_project_files",
  project: {
    projectId: "real-demo-e2e-004",
    projectRoot: "/Users/lichenhao/Desktop/vibe core/runtime-tests/004",
    projectVibePath: "/Users/lichenhao/Desktop/vibe core/runtime-tests/004/project/project.vibe",
  },
  projectRoot: "/Users/lichenhao/Desktop/vibe core/runtime-tests/004",
  projectVibePath: "/Users/lichenhao/Desktop/vibe core/runtime-tests/004/project/project.vibe",
  sourceIndex: {
    present: true,
    readable: true,
    path: "/Users/lichenhao/Desktop/vibe core/runtime-tests/004/project/source_index.json",
    sourceIndexHash: "sha256:004",
    refs: ["story_flow.json", "visual_memory.json"],
  },
  storyFlow: {
    present: true,
    readable: true,
    path: "/Users/lichenhao/Desktop/vibe core/runtime-tests/004/project/story_flow.json",
    shotCount: 2,
    sectionCount: 1,
    sections: [{ id: "scene_observatory_archive", label: "Old observatory archive", shotIds: ["S01", "S02"] }],
    shots: [
      { id: "S01", sceneId: "scene_observatory_archive", sectionId: "scene_observatory_archive", title: "Naya enters", storyFunction: "Naya enters the archive." },
      { id: "S02", sceneId: "scene_observatory_archive", sectionId: "scene_observatory_archive", title: "Naya reads", storyFunction: "Naya reads the coordinate note." },
    ],
  },
  visualMemory: {
    present: true,
    readable: true,
    path: "/Users/lichenhao/Desktop/vibe core/runtime-tests/004/project/visual_memory.json",
    assetCount: 4,
    assets: [
      { id: "char_naya", type: "character", name: "Naya Chen", status: "locked", path: "/Users/lichenhao/Desktop/vibe core/runtime-tests/004/assets/generated/naya.png", textConstraints: ["short black bob"], usedByShotIds: ["S01", "S02"], sourceRefs: ["visual_memory.roles:0"] },
      { id: "char_ivo", type: "character", name: "Ivo Mark", status: "candidate", path: "/Users/lichenhao/Desktop/vibe core/runtime-tests/004/assets/generated/ivo.png", textConstraints: ["dark green raincoat"], usedByShotIds: [], sourceRefs: ["visual_memory.roles:1"] },
      { id: "scene_archive", type: "scene", name: "Old archive", status: "needs_review", path: "/Users/lichenhao/Desktop/vibe core/runtime-tests/004/assets/generated/archive.png", textConstraints: ["brass star map table"], usedByShotIds: ["S01"], sourceRefs: ["visual_memory.scenes:0"] },
      { id: "style_quiet", type: "style", name: "Quiet sci-fi", status: "rejected", path: "/Users/lichenhao/Desktop/vibe core/runtime-tests/004/assets/generated/quiet.png", textConstraints: ["low texture"], usedByShotIds: [], sourceRefs: ["visual_memory.style"], rejectedReason: "old style" },
    ],
    summary: { locked: 1, candidate: 1, needsReview: 1, rejected: 1, missing: 0 },
  },
  providerCalled: false,
  prepareRan: false,
  projectVibeWritten: false,
};

const workbenchFacts005 = {
  ...workbenchFacts004,
  project: {
    projectId: "real-demo-e2e-005",
    projectRoot: "/Users/lichenhao/Desktop/vibe core/runtime-tests/005",
    projectVibePath: "/Users/lichenhao/Desktop/vibe core/runtime-tests/005/project/project.vibe",
  },
  projectRoot: "/Users/lichenhao/Desktop/vibe core/runtime-tests/005",
  projectVibePath: "/Users/lichenhao/Desktop/vibe core/runtime-tests/005/project/project.vibe",
  storyFlow: {
    ...workbenchFacts004.storyFlow,
    shots: [
      { id: "S07", sceneId: "scene_service_tunnel", sectionId: "scene_service_tunnel", title: "Door opens", storyFunction: "Mika and Ren stop at the cold stairwell." },
      { id: "S08", sceneId: "scene_rooftop_array", sectionId: "scene_rooftop_array", title: "Signal", storyFunction: "Mika and Ren face the first signal." },
    ],
    sections: [{ id: "scene_service_tunnel", label: "Rainy tunnel", shotIds: ["S07"] }, { id: "scene_rooftop_array", label: "Rooftop", shotIds: ["S08"] }],
  },
  visualMemory: {
    ...workbenchFacts004.visualMemory,
    assets: [
      { id: "char_mika", type: "character", name: "Mika Aoyama", status: "locked", textConstraints: ["red star hairpin"], usedByShotIds: ["S07", "S08"], sourceRefs: ["visual_memory.roles:0"] },
      { id: "char_ren", type: "character", name: "Ren Kisaragi", status: "locked", textConstraints: ["olive hooded parka"], usedByShotIds: ["S07", "S08"], sourceRefs: ["visual_memory.roles:1"] },
    ],
    assetCount: 2,
    summary: { locked: 2, candidate: 0, needsReview: 0, rejected: 0, missing: 0 },
  },
};

const realChain = deriveProjectRealChainStatus(stale005Payload, "runtime_endpoint");
assert(realChain.uiStatus === "production_needs_review", `real-chain UI status drifted: ${realChain.uiStatus}`);
assert(realChain.returnedImageCount === 8, "real-chain should report returned images");
assert(realChain.needsReviewCount === 2, "real-chain should report review count");
assert(realChain.providerCalled === false, "real-chain status must not imply provider call");
assert(realChain.prepareRan === false, "real-chain status must not imply prepare run");

const jimengQueuedRealChain = deriveProjectRealChainStatus({
  projectId: "jimeng-current",
  projectRoot: "/Users/lichenhao/Desktop/new vibe directing/real-test-sandbox/jimeng-current",
  previewStatus: "preview_ready_with_review",
  productionStatus: "needs_review",
  reviewShotIds: ["MS01"],
  previewItems: [{
    id: "jimeng_video_MS01",
    shotId: "MS01",
    order: 1,
    status: "waiting_for_video",
    videoStatus: "queued",
    submitId: "e2ebfcfa3c6c77d4",
    queuePosition: 2085,
    reviewRequired: true,
    reviewOverlay: true,
  }],
}, "runtime_endpoint");
const jimengPreview = buildCurrentProjectPreviewProjection({
  summary: jimengQueuedRealChain,
  previewItems: jimengQueuedRealChain.previewItems,
});
assert(jimengPreview.queue[0].videoGeneration.status === "queued", "Jimeng preview item should expose queued video status");
assert(jimengPreview.queue[0].videoGeneration.shortSubmitId === "e2ebfcfa", "Jimeng preview item should expose short submit id");
assert(jimengPreview.queue[0].videoGeneration.queuePosition === 2085, "Jimeng preview item should preserve visible position");
assert(/恢复查询/.test(jimengPreview.queue[0].videoGeneration.detail), "Jimeng queued copy should explain resume query");

const realChainMatched = guardProjectRealChainUiStateForCurrentProject(
  { status: realChain.uiStatus, summary: realChain },
  { projectId: "real-demo-e2e-005", projectRoot: "/Users/lichenhao/Desktop/vibe core/runtime-tests/005" },
);
assert(realChainMatched.status === "production_needs_review", "matching real-chain identity should pass through");

for (const [label, identity] of [
  ["004 current identity", { projectId: "real-demo-e2e-004", projectRoot: "/Users/lichenhao/Desktop/vibe core/runtime-tests/004" }],
  ["same id different root", { projectId: "real-demo-e2e-005", projectRoot: "/Users/lichenhao/Desktop/vibe core/runtime-tests/004" }],
  ["same root different id", { projectId: "real-demo-e2e-004", projectRoot: "/Users/lichenhao/Desktop/vibe core/runtime-tests/005" }],
  ["id-only weak fallback", { projectId: "real-demo-e2e-005" }],
  ["other current identity", { projectId: "actual-current-project", projectRoot: "/Users/lichenhao/Desktop/some-other-project-root" }],
  ["repo-outside suffix 005 identity", { projectId: "external-005", projectRoot: "/tmp/repo-outside/005" }],
  ["unbound identity", undefined],
]) {
  const guarded = guardProjectRealChainUiStateForCurrentProject(
    { status: realChain.uiStatus, summary: realChain },
    identity,
  );
  assert(guarded.status === "unavailable", `${label} should not receive stale 005 real-chain summary`);
  assert(!guarded.summary, `${label} must not leak stale 005 real-chain summary`);
  assertProductCopy(guarded.message);
}

const image2Payload = {
  schemaVersion: "current_project_image2_batch_prepare_plan.v1",
  projectionKind: "current_project_image2_batch_prepare_plan",
  project: {
    projectId: "real-demo-e2e-005",
    runId: "real_demo_e2e_005",
    projectRoot: "/Users/lichenhao/Desktop/vibe core/runtime-tests/005",
  },
  items: [
    { shotId: "S07", queueOrder: 7, blocked: false, referencePaths: [] },
    { shotId: "S08", queueOrder: 8, blocked: false, referencePaths: [] },
  ],
  summary: {
    plannedCount: 2,
    readyCount: 2,
    blockedCount: 0,
    selectedShotIds: ["S07", "S08"],
    nextAction: "复核当前项目状态。",
  },
  ledgerProjection: {
    summary: {
      queued: 2,
      blocked: 0,
      parked: 0,
      completeVerified: 0,
      providerSubmissionForbidden: true,
      liveSubmitAllowed: false,
      noFileMutation: true,
      workerSpawnForbidden: true,
      providerCalled: false,
    },
    projections: [],
  },
  providerCalled: false,
  prepareRan: false,
  liveSubmitAllowed: false,
};

const image2Batch = deriveProjectImage2BatchPlanStatus(image2Payload);
assert(image2Batch.uiStatus === "ready_for_review", `image2 batch UI status drifted: ${image2Batch.uiStatus}`);
assert(image2Batch.plannedCount === 2, "image2 batch should preserve planned item count");
assert(image2Batch.providerSubmissionForbidden === true, "image2 batch must forbid provider submission");
assert(image2Batch.noFileMutation === true, "image2 batch must not mutate files");
assert(image2Batch.workerSpawnForbidden === true, "image2 batch must forbid worker spawn");
assert(image2Batch.providerCalled === false, "image2 batch must not call provider");
assert(image2Batch.prepareRan === false, "image2 batch must not run prepare");
assert(image2Batch.liveSubmitAllowed === false, "image2 batch must not allow live submit");

const image2Matched = guardProjectImage2BatchUiStateForCurrentProject(
  { status: image2Batch.uiStatus, summary: image2Batch },
  { projectId: "real-demo-e2e-005", projectRoot: "/Users/lichenhao/Desktop/vibe core/runtime-tests/005" },
);
assert(image2Matched.status === "ready_for_review", "matching Image2 batch identity should pass through");

const image2Mismatch = guardProjectImage2BatchUiStateForCurrentProject(
  { status: image2Batch.uiStatus, summary: image2Batch },
  { projectId: "real-demo-e2e-004", projectRoot: "/Users/lichenhao/Desktop/vibe core/runtime-tests/004" },
);
assert(image2Mismatch.status === "unavailable", "stale 005 Image2 batch summary must be blocked under 004 identity");
assert(!image2Mismatch.summary, "stale 005 Image2 batch summary must not leak under 004 identity");
assertProductCopy(image2Mismatch.message);

const oneShotReadyPayload = {
  status: "ready_to_prepare",
  uiStatus: "ready_to_prepare",
  userLabel: "准备小样包",
  project: {
    projectId: "real-demo-e2e-005",
    projectRoot: "/Users/lichenhao/Desktop/vibe core/runtime-tests/005",
  },
  selectedShotId: "S07",
  expectedOutputPath: "/Users/lichenhao/Desktop/vibe core/runtime-tests/005/real-trigger-one-shot/S07/image2-start.png",
  providerObservationPath: "/Users/lichenhao/Desktop/vibe core/runtime-tests/005/real-trigger-one-shot/S07/provider_observations/image2-start-provider-observation.json",
  semanticQaPath: "/Users/lichenhao/Desktop/vibe core/runtime-tests/005/real-trigger-one-shot/S07/semantic_qa/image2-start-semantic-qa.json",
  receipt: undefined,
  watcherProjection: { outputExists: false },
  providerCalled: false,
  liveSubmitAllowed: false,
  projectVibeWritten: false,
  workerSpawnForbidden: true,
  blockers: [],
};

const oneShotPreparePayload = {
  ...oneShotReadyPayload,
  status: "prepared",
  uiStatus: "prepared",
  userLabel: "确认 handoff",
  statePaths: {
    receiptStatePath: "/Users/lichenhao/Desktop/vibe core/runtime-tests/005/real-trigger-one-shot/S07/state/prepare-receipt.json",
    handoffStatePath: "/Users/lichenhao/Desktop/vibe core/runtime-tests/005/real-trigger-one-shot/S07/state/handoff-packet.json",
  },
  persistedState: {
    receiptPresent: true,
    handoffPresent: false,
  },
  receipt: {
    receiptId: "image2_one_shot_prepare_real-demo-e2e-005_S07",
    status: "prepared",
    selectedShotId: "S07",
    selectedShotIds: ["S07"],
    imageCount: 1,
    expectedOutputPath: oneShotReadyPayload.expectedOutputPath,
    providerObservationPath: oneShotReadyPayload.providerObservationPath,
    semanticQaPath: oneShotReadyPayload.semanticQaPath,
  },
};

const oneShotConfirmPayload = {
  ...oneShotPreparePayload,
  status: "handoff_prepared",
  uiStatus: "handoff_prepared",
  userLabel: "等待文件",
  persistedState: {
    receiptPresent: true,
    handoffPresent: true,
  },
  handoffPacket: {
    packetId: "handoff_image2_one_shot_prepare_real-demo-e2e-005_S07",
    receiptId: "image2_one_shot_prepare_real-demo-e2e-005_S07",
    status: "ready_for_manual_transport",
    requiresExternalAction: true,
    transportPlan: {
      mode: "manual",
      actualExecutionAllowed: false,
      providerCalled: false,
      liveSubmitAllowed: false,
    },
  },
};

const oneShotTriggerPayload = {
  ...oneShotConfirmPayload,
  status: "trigger_plan_prepared",
  uiStatus: "trigger_plan_prepared",
  userLabel: "等待回流",
  returnSource: "dry_run_projection_only",
  persistedState: {
    receiptPresent: true,
    handoffPresent: true,
    triggerPlanPresent: true,
  },
};

const oneShotPermissionTriggerPayload = {
  ...oneShotTriggerPayload,
  submitPermissionReceiptRequested: true,
  submitPermissionReceiptStatePath: "/Users/lichenhao/Desktop/vibe core/runtime-tests/005/real-trigger-one-shot/S07/state/submit-permission-receipt.json",
  persistedState: {
    ...oneShotTriggerPayload.persistedState,
    submitPermissionReceiptPresent: true,
    submitPermissionReceiptStatePath: "/Users/lichenhao/Desktop/vibe core/runtime-tests/005/real-trigger-one-shot/S07/state/submit-permission-receipt.json",
  },
  submitPermissionReceipt: {
    receiptId: "submit_permission_image2_one_shot_prepare_real-demo-e2e-005_S07",
    handoffId: "handoff_image2_one_shot_prepare_real-demo-e2e-005_S07",
    status: "pending_action_time_confirmation",
    blockers: [],
    credential: {
      credentialRef: "secret-store://providers/openai-image2/default",
      authorizedReferenceOnly: true,
      secretMaterialPresent: false,
      credentialMaterialStored: false,
      credentialMaterialRead: false,
    },
    submitIntent: {
      maxProviderCallsPerReceipt: 1,
      providerSubmitAllowed: 0,
      providerSubmitRequestState: "pending_action_time_confirmation",
    },
    actionTimeConfirmation: {
      required: true,
      userConfirmedAtActionTime: false,
    },
    maxProviderCallsPerReceipt: 1,
  },
};

const oneShotReturnedPayload = {
  ...oneShotConfirmPayload,
  status: "real_provider_returned_needs_review",
  uiStatus: "needs_review",
  userLabel: "需要复核",
  providerRequestId: "provider-request-s07",
  outputSha256: "sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  hashBoundActual: true,
  providerObservationMode: "actual_provider_call_observed",
  semanticQaStatus: "needs_review",
  returnSource: "actual_provider_return_ingest",
  formalPromotionBlocked: true,
  formalPromotionBlockedReason: "Formal promotion remains blocked until human QA approval after hash-bound provider return.",
  formalPromotionBlockedReasons: ["Formal promotion remains blocked until human QA approval after hash-bound provider return."],
  providerReturnIngested: true,
  externalProviderCallObserved: true,
  actualImage2Triggered: true,
  providerCalled: true,
  watcherProjection: {
    outputExists: true,
    providerRequestId: "provider-request-s07",
    outputSha256: "sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    hashBoundActual: true,
    providerObservationMode: "actual_provider_call_observed",
    semanticQaStatus: "needs_review",
    returnSource: "actual_provider_return_ingest",
  },
  previewProjection: {
    status: "needs_review",
    reviewRequired: true,
    imageUrl: "/api/runtime/files?path=runtime-tests/005/real-trigger-one-shot/S07/image2-start.png",
    providerCalled: true,
  },
};

const persistedOneShotPrepareSummary = deriveProjectImage2OneShotStatus(oneShotPreparePayload);
assert(persistedOneShotPrepareSummary.uiStatus === "prepared", "persisted one-shot receipt status should display prepared");
assert(persistedOneShotPrepareSummary.userLabel === "确认 handoff", "persisted one-shot receipt should keep confirm copy");
assert(persistedOneShotPrepareSummary.receipt?.selectedShotId === "S07", "persisted one-shot receipt should remain available to helpers");

const persistedOneShotHandoffSummary = deriveProjectImage2OneShotStatus(oneShotConfirmPayload);
assert(persistedOneShotHandoffSummary.uiStatus === "handoff_prepared", "persisted one-shot handoff status should display handoff prepared");
assert(persistedOneShotHandoffSummary.userLabel === "等待文件", "persisted one-shot handoff should keep waiting-file copy");

const persistedOneShotPermissionSummary = deriveProjectImage2OneShotStatus(oneShotPermissionTriggerPayload);
assert(persistedOneShotPermissionSummary.submitPermissionReceiptRequested === true, "persisted one-shot permission receipt should keep requested flag");
assert(persistedOneShotPermissionSummary.submitPermissionReceiptPresent === true, "persisted one-shot permission receipt should keep present flag");
assert(persistedOneShotPermissionSummary.submitPermissionReceipt?.status === "pending_action_time_confirmation", "persisted one-shot permission receipt should keep status");
assert(persistedOneShotPermissionSummary.submitPermissionReceiptStatePath?.endsWith("submit-permission-receipt.json"), "persisted one-shot permission receipt should keep state path");
assert(persistedOneShotPermissionSummary.credentialRef === "secret-store://providers/openai-image2/default", "persisted one-shot permission receipt should keep credentialRef");
assert(persistedOneShotPermissionSummary.maxProviderCallsPerReceipt === 1, "persisted one-shot permission receipt should keep max call cap");

const persistedOneShotReturnedSummary = deriveProjectImage2OneShotStatus(oneShotReturnedPayload);
assert(persistedOneShotReturnedSummary.uiStatus === "needs_review", "persisted one-shot return should display needs_review");
assert(persistedOneShotReturnedSummary.providerRequestId === "provider-request-s07", "persisted one-shot return should keep providerRequestId");
assert(persistedOneShotReturnedSummary.outputSha256 === oneShotReturnedPayload.outputSha256, "persisted one-shot return should keep output hash");
assert(persistedOneShotReturnedSummary.hashBoundActual === true, "persisted one-shot return should keep hash-bound fact");
assert(persistedOneShotReturnedSummary.providerObservationMode === "actual_provider_call_observed", "persisted one-shot return should keep observation mode");
assert(persistedOneShotReturnedSummary.semanticQaStatus === "needs_review", "persisted one-shot return should keep semantic QA status");
assert(persistedOneShotReturnedSummary.returnSource === "actual_provider_return_ingest", "persisted one-shot return should keep return source");
assert(persistedOneShotReturnedSummary.formalPromotionBlockedReason, "persisted one-shot return should keep promotion blocker reason");

const persistedOneShotHandoffGuard = guardProjectImage2OneShotUiStateForCurrentProject(
  { status: persistedOneShotHandoffSummary.uiStatus, summary: persistedOneShotHandoffSummary, receipt: persistedOneShotHandoffSummary.receipt },
  { projectId: "real-demo-e2e-005", projectRoot: "/Users/lichenhao/Desktop/vibe core/runtime-tests/005" },
);
assert(persistedOneShotHandoffGuard.status === "handoff_prepared", "persisted one-shot handoff should pass current-project guard");

const runtimeFetchCalls = [];
const previousWindow = globalThis.window;
const previousFetch = globalThis.fetch;
const project005RuntimeIdentity = {
  projectId: "real-demo-e2e-005",
  projectRoot: "/Users/lichenhao/Desktop/vibe core/runtime-tests/005",
};
const runtimeEndpointPayloads = new Map([
  [`GET ${projectCurrentBindingEndpoint}`, currentProjectBindingResponse({
    projectId: project005RuntimeIdentity.projectId,
    projectRoot: project005RuntimeIdentity.projectRoot,
    title: "005 当前项目",
  })],
  [`GET ${projectCurrentChoicesEndpoint}`, {
    ok: true,
    choices: [
      {
        projectRoot: "real-test-sandbox/real-demo-e2e/005-anime-image2-start-frames",
        displayName: "005 当前项目",
        projectId: project005RuntimeIdentity.projectId,
        status: "当前",
      },
    ],
    providerCalled: false,
    prepareRan: false,
    projectVibeWritten: false,
  }],
  [`POST ${projectCurrentSelectEndpoint}`, currentProjectBindingResponse({
    projectId: project005RuntimeIdentity.projectId,
    projectRoot: project005RuntimeIdentity.projectRoot,
    title: "005 当前项目",
  })],
  [`GET ${projectRealChainStatusEndpoint}`, {
    ...stale005Payload,
    workbenchFacts: workbenchFacts005,
    projectVibeWritten: false,
  }],
  [`POST ${projectRealChainRunCheckEndpoint}`, {
    ...stale005Payload,
    workbenchFacts: workbenchFacts005,
    projectVibeWritten: false,
    command: {
      mode: "read_only_projection_check",
      providerCalled: false,
      prepareRan: false,
      projectVibeWritten: false,
      liveSubmitAllowed: false,
      workerSpawnForbidden: true,
    },
  }],
  [`GET ${projectImage2BatchPlanEndpoint}`, {
    ...image2Payload,
    projectVibeWritten: false,
  }],
  [`POST ${projectImage2BatchRunCheckEndpoint}`, {
    ...image2Payload,
    projectVibeWritten: false,
    command: {
      mode: "read_only_image2_batch_plan_check",
      providerCalled: false,
      prepareRan: false,
      projectVibeWritten: false,
      liveSubmitAllowed: false,
      workerSpawnForbidden: true,
    },
  }],
  [`GET ${projectImage2OneShotStatusEndpoint}`, oneShotReadyPayload],
  [`POST ${projectImage2OneShotPrepareEndpoint}`, oneShotPreparePayload],
  [`POST ${projectImage2OneShotConfirmEndpoint}`, oneShotConfirmPayload],
  [`POST ${projectImage2OneShotExecuteReturnEndpoint}`, oneShotReturnedPayload],
]);

try {
  globalThis.window = {
    __VIBE_RUNTIME_API_BASE_URL__: "http://runtime.test",
    location: { hostname: "127.0.0.1", port: "5173" },
  };
  globalThis.fetch = async (url, init = {}) => {
    const requestUrl = new URL(String(url), "http://runtime.test");
    const method = init.method || "GET";
    runtimeFetchCalls.push({ method, path: requestUrl.pathname, search: requestUrl.search, body: init.body });
    const payload = method === "POST" && requestUrl.pathname === projectImage2OneShotPrepareTriggerEndpoint
      ? (JSON.parse(String(init.body || "{}")).submitPermissionReceiptRequired === true ? oneShotPermissionTriggerPayload : oneShotTriggerPayload)
      : runtimeEndpointPayloads.get(`${method} ${requestUrl.pathname}`);
    assert(payload, `unexpected runtime request ${method} ${requestUrl.pathname}`);
    return {
      ok: true,
      status: 200,
      json: async () => payload,
    };
  };

  const loadedBinding = await loadCurrentProjectBindingStatus();
  assert(loadedBinding.status === "bound", "frontend should load current project binding from runtime");
  const loadedChoices = await loadCurrentProjectChoices();
  assert(loadedChoices[0]?.displayName === "005 当前项目", "frontend should load recent project choices");
  const selectedBinding = await selectCurrentProjectBinding({
    projectRoot: project005RuntimeIdentity.projectRoot,
    projectId: project005RuntimeIdentity.projectId,
    displayName: "005 当前项目",
  });
  assert(selectedBinding.status === "bound", "frontend should connect project through runtime select");

  const loadedStatus = await loadProjectRealChainStatus(project005RuntimeIdentity);
  assert(loadedStatus.status === "production_needs_review", "sync status should load preview/production state");
  assert(loadedStatus.summary?.returnedImageCount === 8, "sync status should show returned image count");
  assert(loadedStatus.summary?.needsReviewCount === 2, "sync status should show needs-review count");
  assert(loadedStatus.summary?.providerCalled === false, "sync status must preserve providerCalled=false");
  assert(loadedStatus.summary?.prepareRan === false, "sync status must preserve prepareRan=false");
  assert(loadedStatus.summary?.workbenchFacts?.projectVibeWritten === false, "sync status must preserve projectVibeWritten=false");

  const checkedStatus = await runProjectRealChainCheck(project005RuntimeIdentity);
  assert(checkedStatus.status === "production_needs_review", "sync status button should call real-chain run-check");
  assert(checkedStatus.summary?.providerCalled === false, "real-chain run-check must not call provider");
  assert(checkedStatus.summary?.prepareRan === false, "real-chain run-check must not run prepare");
  assert(checkedStatus.summary?.workbenchFacts?.projectVibeWritten === false, "real-chain run-check must not write project.vibe");

  const loadedPlan = await loadProjectImage2BatchPlan(project005RuntimeIdentity);
  assert(loadedPlan.status === "ready_for_review", "review panel should load Image2 batch plan");
  assert(loadedPlan.summary?.providerCalled === false, "Image2 batch plan must preserve providerCalled=false");
  assert(loadedPlan.summary?.prepareRan === false, "Image2 batch plan must preserve prepareRan=false");
  assert(loadedPlan.summary?.liveSubmitAllowed === false, "Image2 batch plan must preserve liveSubmitAllowed=false");
  assert(loadedPlan.summary?.workerSpawnForbidden === true, "Image2 batch plan must preserve workerSpawnForbidden=true");

  const checkedPlan = await runProjectImage2BatchCheck(project005RuntimeIdentity);
  assert(checkedPlan.status === "ready_for_review", "review check button should call Image2 batch run-check");
  assert(checkedPlan.summary?.providerCalled === false, "Image2 batch run-check must not call provider");
  assert(checkedPlan.summary?.prepareRan === false, "Image2 batch run-check must not run prepare");
  assert(checkedPlan.summary?.liveSubmitAllowed === false, "Image2 batch run-check must preserve liveSubmitAllowed=false");
  assert(checkedPlan.summary?.workerSpawnForbidden === true, "Image2 batch run-check must preserve workerSpawnForbidden=true");

  const oneShotStatus = await loadProjectImage2OneShotStatus(project005RuntimeIdentity, "S07");
  assert(oneShotStatus.status === "ready_to_prepare", "one-shot status should expose sample entry");
  assert(oneShotStatus.summary?.userLabel === "准备小样包", "one-shot status should use creator-facing prepare copy");
  assert(oneShotStatus.summary?.providerCalled === false, "one-shot status must not call provider");
  assert(oneShotStatus.summary?.projectVibeWritten === false, "one-shot status must not write project.vibe");
  assert(oneShotStatus.summary?.workerSpawnForbidden === true, "one-shot status must forbid worker spawn");

  const preparedOneShot = await prepareProjectImage2OneShot(project005RuntimeIdentity, "S07");
  assert(preparedOneShot.status === "prepared", "one-shot prepare should create a pending confirmation receipt");
  assert(preparedOneShot.receipt?.selectedShotId === "S07", "one-shot prepare should preserve selected shot");
  assert(preparedOneShot.summary?.userLabel === "确认 handoff", "one-shot prepare should use creator-facing confirm copy");
  assert(preparedOneShot.summary?.providerCalled === false, "one-shot prepare must not call provider");
  assert(preparedOneShot.summary?.liveSubmitAllowed === false, "one-shot prepare must not allow live submit");
  assert(preparedOneShot.summary?.projectVibeWritten === false, "one-shot prepare must not write project.vibe");
  assert(preparedOneShot.summary?.workerSpawnForbidden === true, "one-shot prepare must forbid worker spawn");

  const confirmedOneShot = await confirmProjectImage2OneShot(project005RuntimeIdentity, preparedOneShot.receipt);
  assert(confirmedOneShot.status === "handoff_prepared", "one-shot confirm should prepare external handoff only");
  assert(confirmedOneShot.summary?.userLabel === "等待文件", "one-shot confirm should use waiting-file copy");
  assert(confirmedOneShot.summary?.providerCalled === false, "one-shot confirm must not call provider");
  assert(confirmedOneShot.summary?.liveSubmitAllowed === false, "one-shot confirm must not allow live submit");
  assert(confirmedOneShot.summary?.projectVibeWritten === false, "one-shot confirm must not write project.vibe");
  assert(confirmedOneShot.summary?.workerSpawnForbidden === true, "one-shot confirm must forbid worker spawn");

  const triggerPreparedOneShot = await prepareProjectImage2OneShotTrigger(project005RuntimeIdentity, confirmedOneShot.receipt);
  assert(triggerPreparedOneShot.status === "trigger_plan_prepared", "one-shot trigger helper should prepare app-server handoff");
  assert(triggerPreparedOneShot.summary?.userLabel === "等待回流", "one-shot trigger helper should use waiting return copy");
  assert(triggerPreparedOneShot.summary?.providerCalled === false, "one-shot trigger helper must not call provider");
  const defaultTriggerCall = runtimeFetchCalls
    .filter((item) => item.method === "POST" && item.path === projectImage2OneShotPrepareTriggerEndpoint)
    .at(-1);
  const defaultTriggerBody = JSON.parse(String(defaultTriggerCall?.body || "{}"));
  assert(!Object.prototype.hasOwnProperty.call(defaultTriggerBody, "submitPermissionReceiptRequired"), "default trigger helper must not request permission receipt");
  assert(!Object.prototype.hasOwnProperty.call(defaultTriggerBody, "credentialRef"), "default trigger helper must not send credentialRef");

  const permissionPreparedOneShot = await prepareProjectImage2OneShotPermissionReceipt(
    project005RuntimeIdentity,
    confirmedOneShot.receipt,
    "secret-store://providers/openai-image2/default",
  );
  assert(permissionPreparedOneShot.status === "trigger_plan_prepared", "permission receipt helper should prepare trigger plan");
  assert(permissionPreparedOneShot.summary?.submitPermissionReceiptPresent === true, "permission receipt helper should surface persisted receipt");
  assert(permissionPreparedOneShot.summary?.submitPermissionReceipt?.status === "pending_action_time_confirmation", "permission receipt helper should surface pending action confirmation");
  const permissionTriggerCall = runtimeFetchCalls
    .filter((item) => item.method === "POST" && item.path === projectImage2OneShotPrepareTriggerEndpoint)
    .at(-1);
  const permissionTriggerBody = JSON.parse(String(permissionTriggerCall?.body || "{}"));
  assert(permissionTriggerBody.submitPermissionReceiptRequired === true, "permission helper body should request permission receipt");
  assert(permissionTriggerBody.credentialRef === "secret-store://providers/openai-image2/default", "permission helper body should carry opaque credentialRef");
  assert(permissionTriggerBody.maxProviderCallsPerReceipt === 1, "permission helper body should pin maxProviderCallsPerReceipt");
  assert(permissionTriggerBody.actionTimeConfirmation?.required === true, "permission helper body should require action-time confirmation");
  assert(permissionTriggerBody.actionTimeConfirmation?.userConfirmedAtActionTime === false, "permission helper body should not mark action-time confirmation done");
  assert(Array.isArray(permissionTriggerBody.expectedOutputs) && permissionTriggerBody.expectedOutputs.length === 1, "permission helper body should include one expected output");
  assert(permissionTriggerBody.expectedOutputs[0].shotId === "S07", "permission helper expected output should keep shotId");
  assert(permissionTriggerBody.expectedOutputs[0].expectedOutputPath === confirmedOneShot.receipt.expectedOutputPath, "permission helper expected output should keep output path");
  assert(permissionTriggerBody.expectedOutputs[0].providerObservationPath === confirmedOneShot.receipt.providerObservationPath, "permission helper expected output should keep observation path");
  assert(permissionTriggerBody.expectedOutputs[0].semanticQaPath === confirmedOneShot.receipt.semanticQaPath, "permission helper expected output should keep QA path");

  const returnedOneShot = await executeReturnedProjectImage2OneShot(project005RuntimeIdentity, triggerPreparedOneShot.receipt);
  assert(returnedOneShot.status === "needs_review", "one-shot execute-return helper should surface needs_review");
  assert(returnedOneShot.summary?.providerRequestId === "provider-request-s07", "one-shot execute-return should preserve providerRequestId");
  assert(returnedOneShot.summary?.outputSha256 === oneShotReturnedPayload.outputSha256, "one-shot execute-return should preserve output hash");
  assert(returnedOneShot.summary?.hashBoundActual === true, "one-shot execute-return should preserve hash-bound fact");
  assert(returnedOneShot.summary?.semanticQaStatus === "needs_review", "one-shot execute-return should preserve semantic QA status");
  assert(returnedOneShot.summary?.returnSource === "actual_provider_return_ingest", "one-shot execute-return should preserve return source");

  for (const [method, endpoint] of [
    ["GET", projectCurrentBindingEndpoint],
    ["GET", projectCurrentChoicesEndpoint],
    ["POST", projectCurrentSelectEndpoint],
    ["GET", projectRealChainStatusEndpoint],
    ["POST", projectRealChainRunCheckEndpoint],
    ["GET", projectImage2BatchPlanEndpoint],
    ["POST", projectImage2BatchRunCheckEndpoint],
    ["GET", projectImage2OneShotStatusEndpoint],
    ["POST", projectImage2OneShotPrepareEndpoint],
    ["POST", projectImage2OneShotConfirmEndpoint],
    ["POST", projectImage2OneShotPrepareTriggerEndpoint],
    ["POST", projectImage2OneShotExecuteReturnEndpoint],
  ]) {
    const call = runtimeFetchCalls.find((item) => item.method === method && item.path === endpoint);
    assert(call, `frontend should call ${method} ${endpoint}`);
    assert(!call.search.includes("projectRoot=") && !call.search.includes("projectId="), `${method} ${endpoint} should not carry project query params`);
  }
  const selectCall = runtimeFetchCalls.find((item) => item.method === "POST" && item.path === projectCurrentSelectEndpoint);
  assert(selectCall?.body && JSON.parse(String(selectCall.body)).projectRoot === project005RuntimeIdentity.projectRoot, "connect project should send selected projectRoot");
} finally {
  globalThis.window = previousWindow;
  globalThis.fetch = previousFetch;
}

const current004RealChainPayload = {
  ...stale005Payload,
  project: {
    projectId: "real-demo-e2e-004",
    runId: "real_demo_e2e_004",
    projectRoot: "/Users/lichenhao/Desktop/vibe core/runtime-tests/004",
  },
  returnedImageCount: 1,
  totalPlannedImages: 1,
  reviewShotIds: ["S01"],
  previewItems: [
    { shotId: "S01", order: 1, imageUrl: "/files/004-S01.png", reviewRequired: false },
  ],
};
const current004RealChain = deriveProjectRealChainStatus(current004RealChainPayload, "runtime_endpoint");
const guarded004RealChain = guardProjectRealChainUiStateForCurrentProject(
  { status: current004RealChain.uiStatus, summary: current004RealChain },
  { projectId: "real-demo-e2e-004", projectRoot: "/Users/lichenhao/Desktop/vibe core/runtime-tests/004" },
);
const workbench004 = buildCurrentProjectWorkbenchProjection({
  binding: boundBinding,
  realChainState: guarded004RealChain,
  image2BatchState: image2Mismatch,
  selectedShotId: "S07",
  selectedShotIds: ["S07"],
});
assert(workbench004.source === currentProjectWorkbenchProjectionSource, "workbench projection source should be explicit");
assert(workbench004.identity.projectId === "real-demo-e2e-004", "workbench identity should bind to selected 004");
assert(workbench004.identity.projectRoot.endsWith("/004"), "workbench root should bind to selected 004");
assert(workbench004.shots.map((shot) => shot.id).join(",") === "S01", "Story Flow should come from selected 004 preview items");
assert(workbench004.selectedScope.defaultShotId === "S01", "selected scope should fail closed to the current 004 shot when stale S07 is selected");
assert(workbench004.assets.readOnlyProjection === true, "Asset Library should be a read-only current project projection until visual memory is present");
assert(/当前项目资产待补齐|等待生成或锁定|等待生成或复核/.test(workbench004.assets.detail), "Asset Library should show current-project pending asset copy");
assert(!JSON.stringify(workbench004).includes("/005"), "004 workbench projection must not include stale 005 root");

const current004FactsRealChain = deriveProjectRealChainStatus({
  ...current004RealChainPayload,
  workbenchFacts: workbenchFacts004,
}, "runtime_endpoint");
const guarded004FactsRealChain = guardProjectRealChainUiStateForCurrentProject(
  { status: current004FactsRealChain.uiStatus, summary: current004FactsRealChain },
  { projectId: "real-demo-e2e-004", projectRoot: "/Users/lichenhao/Desktop/vibe core/runtime-tests/004" },
);
const workbench004Facts = buildCurrentProjectWorkbenchProjection({
  binding: boundBinding,
  realChainState: guarded004FactsRealChain,
  image2BatchState: image2Mismatch,
  selectedShotId: "S07",
});
assert(workbench004Facts.shots.map((shot) => shot.id).join(",") === "S01,S02", "Story Flow should prefer 004 story_flow facts over preview fallback");
assert(workbench004Facts.story.fallbackUsed === false, "story_flow facts should not be marked as fallback");
assert(workbench004Facts.story.sectionCount === 1, "story_flow sections should be preserved");
assert(workbench004Facts.assets.readOnlyProjection === false, "visual_memory facts should unlock a populated Asset Library projection");
assert(workbench004Facts.assetFacts.map((asset) => asset.id).join(",") === "char_naya,char_ivo,scene_archive,style_quiet", "Asset Library should prefer 004 visual_memory facts");
assert(workbench004Facts.assets.lockedCount === 1, "locked asset count should come from visual_memory");
assert(workbench004Facts.assets.candidateCount === 1, "candidate asset count should be preserved");
const relativeRoot = ".vibe-runtime/projects/current-ui-path-test";
const rootPrefixedFacts = {
  ...workbenchFacts004,
  project: {
    ...workbenchFacts004.project,
    projectRoot: relativeRoot,
  },
  projectRoot: relativeRoot,
  visualMemory: {
    ...workbenchFacts004.visualMemory,
    assets: [
      {
        id: "char_naya",
        type: "character",
        name: "Naya Chen",
        status: "needs_review",
        path: `${relativeRoot}/assets/generated/naya.png`,
        textConstraints: ["short black bob"],
        usedByShotIds: ["S01"],
        sourceRefs: ["visual_memory.roles:0"],
      },
    ],
    assetCount: 1,
    summary: { locked: 0, candidate: 0, needsReview: 1, rejected: 0, missing: 0 },
  },
  storyFlow: {
    ...workbenchFacts004.storyFlow,
    shots: [{
      ...workbenchFacts004.storyFlow.shots[0],
      characterGuidance: ["Naya Chen"],
    }],
  },
};
const rootPrefixedProjection = buildCurrentProjectWorkbenchProjection({
  binding: { status: "bound", projectId: "current-ui-path-test", projectRoot: relativeRoot },
  realChainState: {
    status: "preview_ready_with_review",
    summary: deriveProjectRealChainStatus({ status: "unavailable", workbenchFacts: rootPrefixedFacts }, "runtime_endpoint"),
  },
  image2BatchState: image2Mismatch,
  selectedShotId: "S01",
});
const projectedRootPrefix = applyCurrentProjectWorkbenchProjectionToRuntimeState({
  generatedAt: "2026-05-25T00:00:00.000Z",
  project: { title: "", root: "", sourceTask: "", importedAt: "", state: "", metrics: {} },
  sourceIndex: { projectId: "", projectVersion: "", sourceIndexHash: "", currentProductionBibleId: "", currentStoryFlowId: "", currentVisualMemoryId: "", currentPromptHashes: {}, lockedReferenceIds: [], candidateReferenceIds: [], rejectedReferenceIds: [], failedReferenceIds: [], confirmedDecisionIds: [], staleArtifactIds: [], updatedAt: "" },
  sourceIndexSummary: { projectId: "", lockedReferenceCount: 0, candidateReferenceCount: 0, rejectedReferenceCount: 0, failedReferenceCount: 0, staleArtifactCount: 0, blockingReferenceCount: 0, isProductionReady: false, updatedAt: "" },
  storyFlow: { sections: [], shots: [] },
  visualMemory: { summary: { total: 0, existing: 0, locked: 0, needsReview: 0, missing: 0, byType: [] }, assets: [] },
  taskRuns: { jobs: [], runs: [], taskViews: [], queueSummary: { total: 0, ready: 0, blocked: 0, parked: 0, succeeded: 0, missingOutputs: 0 }, preflightSummary: { blocked: 0, warnings: 0, blockers: [] } },
  manifestMatches: { summary: { complete: 0, present: 0, missing: 0, recoverable: 0 }, reports: [] },
  imagePipeline: { promptPlans: [], promptConflictReports: [], assetReadinessReports: [], imageTaskPlans: [], image2AdapterRequests: [], watcherEvents: [], generationHealthReports: [], qaPromotionReports: [], imageReferenceTransports: [], imageReferenceDeliveryReceipts: [] },
  previewEvents: [],
}, rootPrefixedProjection);
assert(projectedRootPrefix.visualMemory.assets[0]?.path === `${relativeRoot}/assets/generated/naya.png`, "root-prefixed visual memory media paths must not be prefixed twice");
assert(projectedRootPrefix.storyFlow.shots[0]?.startFrame === `${relativeRoot}/assets/generated/naya.png`, "root-prefixed shot references should resolve to loadable media paths");
assert(!JSON.stringify(projectedRootPrefix).includes(`${relativeRoot}/${relativeRoot}`), "current project media projection must never duplicate project root segments");
const focusPropFacts = {
  ...rootPrefixedFacts,
  visualMemory: {
    ...rootPrefixedFacts.visualMemory,
    assets: [
      {
        id: "old_book",
        type: "prop",
        name: "旧书",
        status: "locked",
        path: `${relativeRoot}/assets/generated/old_book.png`,
        usedByShotIds: ["S02"],
        sourceRefs: ["visual_memory.props:0"],
      },
      {
        id: "glowing_ticket",
        type: "prop",
        name: "发光车票",
        status: "locked",
        path: `${relativeRoot}/assets/generated/glowing_ticket.png`,
        usedByShotIds: ["S02"],
        sourceRefs: ["visual_memory.props:1"],
      },
    ],
    assetCount: 2,
    summary: { locked: 2, candidate: 0, needsReview: 0, rejected: 0, missing: 0 },
  },
  storyFlow: {
    ...rootPrefixedFacts.storyFlow,
    shots: [{
      ...rootPrefixedFacts.storyFlow.shots[0],
      id: "S02",
      title: "发光车票",
      executionMode: "action_insert",
      primaryAction: "她发现发光车票",
      propGuidance: ["旧书", "发光车票"],
    }],
  },
};
const focusPropProjection = buildCurrentProjectWorkbenchProjection({
  binding: { status: "bound", projectId: "current-ui-focus-prop-test", projectRoot: relativeRoot },
  realChainState: {
    status: "preview_ready_with_review",
    summary: deriveProjectRealChainStatus({ status: "unavailable", workbenchFacts: focusPropFacts }, "runtime_endpoint"),
  },
  image2BatchState: image2Mismatch,
  selectedShotId: "S02",
});
const focusPropRuntimeState = applyCurrentProjectWorkbenchProjectionToRuntimeState({
  generatedAt: "2026-05-25T00:00:00.000Z",
  project: { title: "", root: "", sourceTask: "", importedAt: "", state: "", metrics: {} },
  sourceIndex: { projectId: "", projectVersion: "", sourceIndexHash: "", currentProductionBibleId: "", currentStoryFlowId: "", currentVisualMemoryId: "", currentPromptHashes: {}, lockedReferenceIds: [], candidateReferenceIds: [], rejectedReferenceIds: [], failedReferenceIds: [], confirmedDecisionIds: [], staleArtifactIds: [], updatedAt: "" },
  sourceIndexSummary: { projectId: "", lockedReferenceCount: 0, candidateReferenceCount: 0, rejectedReferenceCount: 0, failedReferenceCount: 0, staleArtifactCount: 0, blockingReferenceCount: 0, isProductionReady: false, updatedAt: "" },
  storyFlow: { sections: [], shots: [] },
  visualMemory: { summary: { total: 0, existing: 0, locked: 0, needsReview: 0, missing: 0, byType: [] }, assets: [] },
  taskRuns: { jobs: [], runs: [], taskViews: [], queueSummary: { total: 0, ready: 0, blocked: 0, parked: 0, succeeded: 0, missingOutputs: 0 }, preflightSummary: { blocked: 0, warnings: 0, blockers: [] } },
  manifestMatches: { summary: { complete: 0, present: 0, missing: 0, recoverable: 0 }, reports: [] },
  imagePipeline: { promptPlans: [], promptConflictReports: [], assetReadinessReports: [], imageTaskPlans: [], image2AdapterRequests: [], watcherEvents: [], generationHealthReports: [], qaPromotionReports: [], imageReferenceTransports: [], imageReferenceDeliveryReceipts: [] },
  previewEvents: [],
}, focusPropProjection);
assert(
  focusPropRuntimeState.storyFlow.shots[0]?.startFrame === `${relativeRoot}/assets/generated/glowing_ticket.png`,
  "action-insert shots should choose the focused prop named by the shot title/action, not the first prop guidance item",
);
const workbench004AssetLibrary = createAssetLibraryFromCurrentProjectWorkbench(workbench004Facts);
const nayaAssetRecord = assetLibraryAssetToRecord(workbench004AssetLibrary.assets.find((asset) => asset.id === "char_naya"));
assert(nayaAssetRecord.path === "assets/generated/naya.png", "current project Asset Library should preserve project-relative media paths");
assert(toMediaSrc(nayaAssetRecord.path)?.includes("/api/runtime/files?path=assets%2Fgenerated%2Fnaya.png"), "current project Asset Library media should load through the runtime file endpoint");
assert(!JSON.stringify(workbench004AssetLibrary).includes("user_selected_import/char_naya"), "current project generated assets must not be redacted as user-selected imports");

const current004FactsOnlyRealChain = deriveProjectRealChainStatus({
  schemaVersion: "current_project_real_chain_status.v1",
  status: "unavailable",
  message: "No video run manifest yet, but workbench facts are available.",
  workbenchFacts: workbenchFacts004,
}, "runtime_endpoint");
assert(current004FactsOnlyRealChain.workbenchFacts?.visualMemory?.assetCount === 4, "workbench-only status should preserve visual_memory facts");
assert(current004FactsOnlyRealChain.projectRoot?.endsWith("/004"), "workbench-only status should derive project root from facts");
const guarded004FactsOnlyRealChain = guardProjectRealChainUiStateForCurrentProject(
  { status: current004FactsOnlyRealChain.uiStatus, summary: current004FactsOnlyRealChain },
  { projectId: "real-demo-e2e-004", projectRoot: "/Users/lichenhao/Desktop/vibe core/runtime-tests/004" },
);
const workbench004FactsOnly = buildCurrentProjectWorkbenchProjection({
  binding: boundBinding,
  realChainState: guarded004FactsOnlyRealChain,
  image2BatchState: image2Mismatch,
  selectedShotId: "S07",
});
assert(workbench004FactsOnly.assets.readOnlyProjection === false, "workbench-only facts should populate Asset Library even before a video run");
assert(workbench004FactsOnly.assetFacts.map((asset) => asset.id).join(",") === "char_naya,char_ivo,scene_archive,style_quiet", "workbench-only facts should preserve asset projection");
assert(workbench004Facts.assets.needsReviewCount === 1, "needs_review asset count should be preserved");
assert(workbench004Facts.assets.rejectedCount === 1, "rejected asset count should be preserved");
assert(!JSON.stringify(workbench004Facts).includes("char_mika"), "004 visual_memory facts must not leak 005 assets");

const storyMissingFacts = {
  ...workbenchFacts004,
  storyFlow: { present: false, readable: false, path: "/missing/story_flow.json", shotCount: 0, sectionCount: 0, sections: [], shots: [] },
};
const storyMissingProjection = buildCurrentProjectWorkbenchProjection({
  binding: boundBinding,
  realChainState: {
    status: guarded004FactsRealChain.status,
    summary: { ...current004FactsRealChain, workbenchFacts: storyMissingFacts },
  },
});
assert(storyMissingProjection.shots.map((shot) => shot.id).join(",") === "S01", "missing story_flow should safely fall back to current preview items");
assert(/待补齐故事流/.test(storyMissingProjection.story.detail), "missing story_flow should show safe pending copy");

const storyUnreadableFacts = {
  ...workbenchFacts004,
  storyFlow: { present: true, readable: false, path: "/bad/story_flow.json", shotCount: 0, sectionCount: 0, sections: [], shots: [] },
};
const storyUnreadableProjection = buildCurrentProjectWorkbenchProjection({
  binding: boundBinding,
  realChainState: {
    status: guarded004FactsRealChain.status,
    summary: { ...current004FactsRealChain, workbenchFacts: storyUnreadableFacts },
  },
});
assert(storyUnreadableProjection.shots[0].id === "CURRENT_PROJECT", "unreadable story_flow should fail closed instead of using preview items");
assert(/故事流读取失败/.test(storyUnreadableProjection.story.detail), "unreadable story_flow should expose product-safe failure copy");

const visualMissingFacts = {
  ...workbenchFacts004,
  visualMemory: { present: false, readable: false, path: "/missing/visual_memory.json", assetCount: 0, assets: [], summary: { locked: 0, candidate: 0, needsReview: 0, rejected: 0, missing: 0 } },
};
const visualMissingProjection = buildCurrentProjectWorkbenchProjection({
  binding: boundBinding,
  realChainState: {
    status: guarded004FactsRealChain.status,
    summary: { ...current004FactsRealChain, workbenchFacts: visualMissingFacts },
  },
});
assert(visualMissingProjection.assets.readOnlyProjection === true, "missing visual_memory should keep read-only fallback");
assert(/当前项目资产待补齐/.test(visualMissingProjection.assets.detail), "missing visual_memory should show safe asset fallback copy");

const emptyCurrentProjectFacts = {
  ...workbenchFacts004,
  project: {
    ...workbenchFacts004.project,
    title: "empty-current-project",
    projectRoot: relativeRoot,
  },
  projectRoot: relativeRoot,
  storyFlow: {
    present: false,
    readable: true,
    path: `${relativeRoot}/project/story_flow.json`,
    fallbackFromProjectVibe: true,
    shotCount: 0,
    sectionCount: 0,
    sections: [],
    shots: [],
  },
  visualMemory: {
    present: false,
    readable: true,
    path: `${relativeRoot}/project/visual_memory.json`,
    fallbackFromProjectVibe: true,
    assetCount: 0,
    assets: [],
    summary: { locked: 0, candidate: 0, needsReview: 0, rejected: 0, missing: 0 },
  },
};
const emptyCurrentProjectProjection = buildCurrentProjectWorkbenchProjection({
  binding: { status: "bound", projectId: "empty-current-project", projectRoot: relativeRoot },
  realChainState: {
    status: "unavailable",
    summary: deriveProjectRealChainStatus({ status: "unavailable", workbenchFacts: emptyCurrentProjectFacts }, "runtime_endpoint"),
  },
});
assert(emptyCurrentProjectProjection.shots.length === 0, "empty readable current projects must not create a fake current-project shot");
assert(emptyCurrentProjectProjection.sections.length === 0, "empty readable current projects must not create a fake story section");
const emptyCurrentRuntimeState = applyCurrentProjectWorkbenchProjectionToRuntimeState(projectedRootPrefix, emptyCurrentProjectProjection);
assert(emptyCurrentRuntimeState.storyFlow.shots.length === 0, "empty current-project projection must clear stale story shots");
assert(emptyCurrentRuntimeState.visualMemory.assets.length === 0, "empty current-project projection must clear stale visual memory assets");

const staleRealChainUnder004 = guardProjectRealChainUiStateForCurrentProject(
  { status: realChain.uiStatus, summary: realChain },
  { projectId: "real-demo-e2e-004", projectRoot: "/Users/lichenhao/Desktop/vibe core/runtime-tests/004" },
);
const staleImage2Under004 = guardProjectImage2BatchUiStateForCurrentProject(
  { status: image2Batch.uiStatus, summary: image2Batch },
  { projectId: "real-demo-e2e-004", projectRoot: "/Users/lichenhao/Desktop/vibe core/runtime-tests/004" },
);
const stale005Under004 = buildCurrentProjectWorkbenchProjection({
  binding: boundBinding,
  realChainState: staleRealChainUnder004,
  image2BatchState: staleImage2Under004,
  selectedShotId: "S07",
});
assert(stale005Under004.identity.projectId === "real-demo-e2e-004", "stale status must not override selected 004 identity");
assert(stale005Under004.shots[0].id === "CURRENT_PROJECT", "mismatched summaries should fall back to current project placeholder");
assert(/待补齐故事流/.test(stale005Under004.shots[0].storyFunction), "Story Flow fallback should be current-project safe copy");
assert(!JSON.stringify(stale005Under004).includes("/005"), "mismatched 005 data must not leak into the current 004 workbench");

const workbench005 = buildCurrentProjectWorkbenchProjection({
  binding: binding005,
  realChainState: realChainMatched,
  image2BatchState: image2Matched,
  selectedShotId: "S01",
});
assert(workbench005.identity.projectId === "real-demo-e2e-005", "workbench should switch back to selected 005 identity");
assert(workbench005.shots.map((shot) => shot.id).join(",") === "S07,S08", "Story Flow should switch back to 005 shots when 005 is current");
assert(workbench005.selectedScope.defaultShotId === "S07", "Agent selected scope should default to the current 005 shot, not stale 004");

const realChain005Facts = deriveProjectRealChainStatus({
  ...stale005Payload,
  workbenchFacts: workbenchFacts005,
}, "runtime_endpoint");
const realChain005FactsMatched = guardProjectRealChainUiStateForCurrentProject(
  { status: realChain005Facts.uiStatus, summary: realChain005Facts },
  { projectId: "real-demo-e2e-005", projectRoot: "/Users/lichenhao/Desktop/vibe core/runtime-tests/005" },
);
const workbench005Facts = buildCurrentProjectWorkbenchProjection({
  binding: binding005,
  realChainState: realChain005FactsMatched,
  image2BatchState: image2Matched,
});
assert(workbench005Facts.shots.map((shot) => shot.storyFunction).join(" ").includes("Mika"), "005 Story Flow should use 005 story_flow facts");
assert(workbench005Facts.assetFacts.map((asset) => asset.id).join(",") === "char_mika,char_ren", "005 Asset Library should use 005 visual_memory facts");
assert(workbench005Facts.assets.readOnlyProjection === false, "005 visual_memory should avoid empty read-only fallback");
assert(!JSON.stringify(workbench005Facts).includes("char_naya"), "005 workbench facts must not leak 004 visual memory");

const unboundWorkbench = buildCurrentProjectWorkbenchProjection({
  binding: unboundBinding,
  realChainState: { status: "unavailable", message: unboundBinding.message },
});
assert(unboundWorkbench.available === false, "unbound workbench must fail closed");
assert(unboundWorkbench.identity.displayTitle === "未选择项目", "unbound workbench should not show fallback project identity");
assert(unboundWorkbench.shots[0].id === "CURRENT_PROJECT", "unbound workbench should not show fallback story shots");
assert(!JSON.stringify(unboundWorkbench).includes("005"), "unbound workbench must not include demo 005 state");

console.log("Current project UI closed-loop test passed. Binding-first UI blocks unbound/stale summaries without provider calls.");
