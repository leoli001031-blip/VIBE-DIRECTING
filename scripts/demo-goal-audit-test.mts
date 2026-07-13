import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function read(path: string) {
  return readFileSync(path, "utf8");
}

function assertIncludes(source: string, value: string, message: string) {
  assert(source.includes(value), message);
}

function assertMatches(source: string, pattern: RegExp, message: string) {
  assert(pattern.test(source), message);
}

const packageJson = JSON.parse(read("package.json")) as { scripts?: Record<string, string> };
const scripts = packageJson.scripts || {};
const demoReady = scripts["demo:ready:test"] || "";

const readme = read("README.md");
const indexHtml = read("index.html");
const demoHandoff = read("DEMO_HANDOFF.md");
const architectureDoc = read("docs/current-demo-architecture.md");
const agentFirstGoalAudit = read("docs/agent-first-demo-completion-audit.md");
const agentKernelDemoStatus = read("docs/agent-kernel-v1-demo-status.md");
const recordingRunbook = read("docs/demo-recording-runbook.md");
const finalRehearsalChecklist = read("docs/demo-final-rehearsal-checklist.md");
const frontendRehearsalRecord = read("docs/demo-frontend-rehearsal-record.md");
const directorModeShell = read("src/ui/director/DirectorModeShell.tsx");
const agentCoreTypes = read("src/agent-core/types.ts");
const agentCoreRunner = read("src/agent-core/runAgentTurn.ts");
const agentActionRegistry = read("src/agent-core/actionRegistry.ts");
const vibeAgentCoreTest = read("scripts/vibe-agent-core-test.mts");
const projectStatusViewModel = read("src/ui/app/projectStatusViewModel.ts");
const newVideoStart = read("src/ui/director/NewVideoStart.tsx");
const minimalAgentPanel = read("src/ui/director/MinimalAgentPanel.tsx");
const creatorDeskPanels = read("src/ui/director/CreatorDeskPanels.tsx");
const minimalTopNav = read("src/ui/director/MinimalTopNav.tsx");
const agentPanelProjection = read("src/ui/director/agentPanelProjection.ts");
const assetReconciliation = read("src/core/assetReconciliation.ts");
const audioPlanning = read("src/core/audioPlanning.ts");
const newVideoAudioReferenceBinding = read("src/core/newVideoAudioReferenceBinding.ts");
const voiceSourceLibrary = read("src/core/voiceSourceLibrary.ts");
const storyboardReferencePipeline = read("src/core/storyboardReferencePipeline.ts");
const newVideoProjectVibePlanner = read("src/core/newVideoProjectVibePlanner.ts");
const projectVideoClient = read("src/core/projectVideoClient.ts");
const currentProjectPreviewProjection = read("src/core/currentProjectPreviewProjection.ts");
const scriptsGroup = read("scripts/list-npm-scripts-by-group.mts");
const pruneTest = read("scripts/prune-runtime-artifacts-test.mts");
const projectFolderScanner = read("src/core/projectFolderScannerNode.ts");
const projectFolderScannerTest = read("scripts/project-folder-scanner-test.mts");
const runtimeWorkbenchProjection = read("scripts/runtime-api-workbench-projection.mts");
const devFullScript = read("scripts/dev-full.mts");
const mainEntry = read("src/main-agent-kernel.tsx");

assertIncludes(architectureDoc, "/Users/lichenhao/Desktop/new vibe directing", "P0 doc must name the canonical development root");
assertMatches(architectureDoc, /P0 project entry[\s\S]*P7 debt cleanup/, "architecture doc must preserve the P0-P7 demo closeout line");
assertIncludes(architectureDoc, "Project.vibe", "project-folder concept must stay anchored by Project.vibe");
assertIncludes(readme, "docs/demo-recording-runbook.md", "README must link the recording runbook");
assertIncludes(readme, "docs/demo-final-rehearsal-checklist.md", "README must link the final rehearsal checklist");
assertIncludes(readme, "docs/agent-kernel-v1-demo-status.md", "README must link the Agent Kernel demo status");
assertIncludes(demoHandoff, "docs/demo-recording-runbook.md", "demo handoff must point recordings to the runbook");
assertIncludes(demoHandoff, "docs/demo-final-rehearsal-checklist.md", "demo handoff must point recordings to the final rehearsal checklist");
assertIncludes(demoHandoff, "docs/agent-kernel-v1-demo-status.md", "demo handoff must point to the Agent Kernel demo status");
assertIncludes(architectureDoc, "docs/demo-recording-runbook.md", "architecture doc must name the recording runbook");
assertIncludes(recordingRunbook, "docs/demo-final-rehearsal-checklist.md", "recording runbook must point operators to the final rehearsal checklist");
assertIncludes(recordingRunbook, "Recording Flow", "recording runbook must include a recording flow");
assertIncludes(recordingRunbook, "Talk Track", "recording runbook must include a talk track");
assertIncludes(recordingRunbook, "What Not To Claim", "recording runbook must preserve demo boundaries");
assertIncludes(recordingRunbook, "seedance-two-video-evidence:test", "recording runbook must include returned-video fallback evidence");
assertIncludes(recordingRunbook, "npm run dev:full", "recording runbook must use the runtime-adopting dev launcher");
assertIncludes(recordingRunbook, "http://127.0.0.1:5174/", "recording runbook must point to the canonical dev URL");
assertIncludes(recordingRunbook, "reuse an already-running local runtime API", "recording runbook must explain dev:full runtime adoption");
assertIncludes(recordingRunbook, "demo:artifact-freshness:test", "recording runbook must require a live frontend freshness check");
assertIncludes(recordingRunbook, "Activity Monitor", "recording runbook must explain how to recover when kill is blocked by the shell");
assertIncludes(recordingRunbook, "The confirmation card should", "recording runbook must tell recorders to show the Agent-style confirmation card");
assertIncludes(recordingRunbook, "the right rail shows the three Skill groups first", "recording runbook must keep Skill explanation compact during recording");
assertIncludes(devFullScript, "isPortOpen(8790)", "dev:full must detect an already-running runtime API instead of crashing on EADDRINUSE");
assertIncludes(devFullScript, "checkExistingViteFreshness", "dev:full must verify an adopted frontend before demo setup");
assertIncludes(devFullScript, "existing Vite dev server looks stale", "dev:full must fail loudly instead of adopting a stale frontend");
assertIncludes(devFullScript, "listPortPids(5174)", "dev:full must help operators identify the stale frontend process");
assertIncludes(devFullScript, "Stop command: kill", "dev:full stale-frontend guidance must provide a concrete stop command");
assertIncludes(devFullScript, "demo:artifact-freshness:test", "dev:full stale-frontend guidance must point to the same freshness gate");
assertIncludes(devFullScript, "Runtime API      → ${runtimeUrl}", "dev:full must keep the runtime API URL visible for demo setup");
assertIncludes(devFullScript, "(already running, fresh)", "dev:full must clearly report adopted fresh frontend services during demo setup");
assertIncludes(devFullScript, "Press Ctrl+C to stop servers started by this command.", "dev:full must not imply it will kill services it only adopted");
assertIncludes(agentFirstGoalAudit, "Left: project navigation.", "agent-first audit must preserve the three-column product contract");
assertIncludes(agentFirstGoalAudit, "Phase 1: Agent Shell", "agent-first audit must cover phase 1");
assertIncludes(agentFirstGoalAudit, "Phase 2: Selection Context And Skills", "agent-first audit must cover phase 2");
assertIncludes(agentFirstGoalAudit, "Phase 3: Demo Loop And Showcase Package", "agent-first audit must cover phase 3");
assertIncludes(agentFirstGoalAudit, "Agent Kernel v1 Completion Matrix", "agent-first audit must include a three-phase completion matrix");
assertIncludes(agentFirstGoalAudit, "Phase 1: Agent Kernel and message flow", "completion matrix must summarize phase 1");
assertIncludes(agentFirstGoalAudit, "Phase 2: project intelligence and material matching", "completion matrix must summarize phase 2");
assertIncludes(agentFirstGoalAudit, "Phase 3: Skills and real demo loop", "completion matrix must summarize phase 3");
assertIncludes(agentFirstGoalAudit, "Demo claim in one sentence", "agent-first audit must preserve a concise demo claim");
assertIncludes(agentFirstGoalAudit, "not a fully autonomous background operator", "completion matrix must not overclaim full autonomy");
assertIncludes(agentFirstGoalAudit, "not yet a complete long-drama asset database", "completion matrix must keep long-project continuity future-scoped");
assertIncludes(agentFirstGoalAudit, "Requirement Checklist", "agent-first audit must include a requirement checklist");
assertIncludes(agentFirstGoalAudit, "demo-ready", "agent-first audit must distinguish demo-ready requirements");
assertIncludes(agentFirstGoalAudit, "bounded", "agent-first audit must distinguish bounded short-project coverage");
assertIncludes(agentFirstGoalAudit, "future lane", "agent-first audit must not overclaim parked lanes");
assertIncludes(agentFirstGoalAudit, "Full autonomous long-drama Agent", "agent-first audit must keep long-project autonomy outside the current demo closeout");
assertIncludes(agentFirstGoalAudit, "src/ui/director/MinimalAgentPanel.tsx", "agent-first audit must cite the Agent composer");
assertIncludes(agentFirstGoalAudit, "src/core/directorSkillLibrary.ts", "agent-first audit must cite the Skill library");
assertIncludes(agentFirstGoalAudit, "showcase-package/DEMO_INDEX.md", "agent-first audit must cite the showcase index");
assertIncludes(agentFirstGoalAudit, "docs/demo-final-rehearsal-checklist.md", "agent-first audit must cite the final rehearsal checklist");
assertIncludes(agentFirstGoalAudit, "deeper autonomous Agent kernel", "agent-first audit must not overclaim full autonomy");
assertIncludes(agentFirstGoalAudit, "npm run showcase-package-audit:test", "agent-first audit must include the showcase gate");
assertIncludes(agentFirstGoalAudit, "not as \"Agent 正在执行\"", "agent-first audit must record the waiting-draft status fix");
assertIncludes(agentFirstGoalAudit, "docs/demo-recording-runbook.md", "agent-first audit must record the recording runbook startup path");
assertIncludes(agentKernelDemoStatus, "Right: talk to the Agent.", "Agent Kernel status must preserve the three-column product contract");
assertIncludes(agentKernelDemoStatus, "Demo-Ready Claims", "Agent Kernel status must summarize current claims");
assertIncludes(agentKernelDemoStatus, "Bounded Claims", "Agent Kernel status must separate bounded claims");
assertIncludes(agentKernelDemoStatus, "Final Canonical Browser Check", "Agent Kernel status must record the final live-browser verification");
assertIncludes(agentKernelDemoStatus, "codex-browser-final-smoke-5174", "Agent Kernel status must cite the canonical final browser smoke URL");
assertIncludes(agentKernelDemoStatus, "demo:artifact-freshness:test", "Agent Kernel status must preserve the live freshness gate");
assertIncludes(agentKernelDemoStatus, "docs/demo-frontend-rehearsal-record.md", "Agent Kernel status must point to the frontend rehearsal record");
assertIncludes(agentKernelDemoStatus, "Do Not Claim Yet", "Agent Kernel status must preserve demo boundaries");
assertIncludes(agentKernelDemoStatus, "docs/agent-first-demo-completion-audit.md", "Agent Kernel status must point to the detailed audit");
assertIncludes(agentKernelDemoStatus, "showcase-package/DEMO_INDEX.md", "Agent Kernel status must point to showcase evidence");
assertIncludes(agentKernelDemoStatus, "No music, no BGM, no subtitles.", "Agent Kernel status must preserve final no-BGM prompt policy");
assertIncludes(agentKernelDemoStatus, "git diff --check", "Agent Kernel status must include final handoff gates");
assertIncludes(agentFirstGoalAudit, "结果已经写进上面的消息流", "agent-first audit must record completed Agent replies in the message flow");
assertIncludes(agentFirstGoalAudit, "videoResultCount = 1", "agent-first audit must record returned-video Agent message dedupe evidence");
assertIncludes(agentFirstGoalAudit, "bodyVideoProcessingCount = 0", "agent-first audit must record unified returned-video status evidence");
assertIncludes(agentFirstGoalAudit, "agent-kernel-v1-final-rehearsal", "agent-first audit must record the final fresh-project Agent rehearsal");
assertIncludes(agentFirstGoalAudit, "no references or videos would be generated automatically", "agent-first audit must record the read-only planning boundary");
assertIncludes(agentFirstGoalAudit, "only entered the story flow", "agent-first audit must record confirmation did not submit provider work");
assertIncludes(agentFirstGoalAudit, "素材识别摘要", "agent-first audit must record the visible material-scan summary");
assertIncludes(agentFirstGoalAudit, "agent-asset-summary-check", "agent-first audit must record the live material-summary UI check");
assertIncludes(agentFirstGoalAudit, "agent-copy-check", "agent-first audit must record the no-direct-video-copy UI check");
assertIncludes(agentFirstGoalAudit, "no longer describes `全能参考` as directly", "agent-first audit must record the omni-reference copy fix");
assertIncludes(agentFirstGoalAudit, "参考结果和运行记录", "agent-first audit must record creator-facing Agent write destinations");
assertIncludes(agentFirstGoalAudit, "Internal files remain traceable", "agent-first audit must record hidden internal project paths");
assertIncludes(agentFirstGoalAudit, "agent-write-wording-recheck", "agent-first audit must record the project-write wording live check");
assertIncludes(agentFirstGoalAudit, "`修改项目`, `只保存项目修改`, and `项目草案`", "agent-first audit must record creator-facing project-write wording");
assertIncludes(agentFirstGoalAudit, "会生成参考图", "agent-first audit must record creator-facing execution-boundary wording");
assertIncludes(agentFirstGoalAudit, "会提交 Seedance 视频任务", "agent-first audit must record creator-facing Seedance boundary wording");
assertIncludes(agentFirstGoalAudit, "compacts duplicate internal tool returns", "agent-first audit must record visible Agent thread result-card compaction");
assertIncludes(agentFirstGoalAudit, "agent-message-compaction-check", "agent-first audit must record the message compaction browser check");
assertIncludes(agentFirstGoalAudit, "selection-footer-context", "agent-first audit must record the selected-context footer browser check");
assertIncludes(agentFirstGoalAudit, "这句话会引用：正在看 镜头 1-1", "agent-first audit must record the composer reference cue");
assertIncludes(agentFirstGoalAudit, "我准备修改，范围是镜头 1-1", "agent-first audit must record the creator-facing confirmation-card copy");
assertIncludes(agentFirstGoalAudit, "不会提交视频，确认后才执行", "agent-first audit must record the confirmation execution boundary copy");
assertIncludes(agentFirstGoalAudit, "Skill block height", "agent-first audit must record the compact Skill rail browser check");
assertIncludes(agentFirstGoalAudit, "Agent thread moved up", "agent-first audit must record the right rail message-flow priority check");
assertIncludes(agentFirstGoalAudit, "Seedance VIP 720p serial submit", "agent-first audit must record the final rehearsal provider boundary");
assertIncludes(agentFirstGoalAudit, "final-rehearsal-check", "agent-first audit must record the final rehearsal live UI check");
assertIncludes(agentFirstGoalAudit, "`先整理 / 可补参考 / 可发视频`", "agent-first audit must record the visible permission modes in the final rehearsal");
assertIncludes(agentFirstGoalAudit, "stale workflow/engineering copy", "agent-first audit must record the final rehearsal copy check");
assertIncludes(agentFirstGoalAudit, "Entry Freshness Recheck", "agent-first audit must record the stale-entry live UI check");
assertIncludes(agentFirstGoalAudit, "no longer exposes `对象：/成本：/写入：/外部：`", "agent-first audit must record the confirmation boundary wording fix");
assertIncludes(agentFirstGoalAudit, "selected-shot handoff recheck", "agent-first audit must record the non-first-shot selected-context browser check");
assertIncludes(agentFirstGoalAudit, "镜头 1-2 发光的车票", "agent-first audit must record that selected-context follow-up can target shot 1-2");
assertIncludes(agentFirstGoalAudit, "stable accessible name `发送`", "agent-first audit must record the stable send-button accessibility fix");
assertIncludes(agentFirstGoalAudit, "final canonical `5174` Codex in-app browser check", "agent-first audit must record the final canonical browser check");
assertIncludes(agentFirstGoalAudit, "codex-browser-final-smoke-5174", "agent-first audit must record the final browser smoke URL");
assertIncludes(agentFirstGoalAudit, "`不写文件`,", "agent-first audit must record explain-only no-write evidence");
assert(!/\?agent-kernel-v\d+/.test(indexHtml), "index.html must not pin the browser entry module with a fixed Agent kernel query string");
assert(!/\?agent-kernel-v\d+/.test(mainEntry), "browser entry must not import App through a fixed query string");
assert(!/\?agent-kernel-v\d+/.test(directorModeShell), "Director shell must not import Agent UI through a fixed query string");

assertIncludes(finalRehearsalChecklist, "new local project -> Agent plan -> Skill recommendation", "final rehearsal checklist must preserve the end-to-end demo chain");
assertIncludes(finalRehearsalChecklist, "Confirm the right composer has a visible `发送` button", "final rehearsal checklist must protect the visible send button");
assertIncludes(finalRehearsalChecklist, "send button is still named `发送`", "final rehearsal checklist must protect the stable send-button name");
assertIncludes(finalRehearsalChecklist, "The first message should clear after sending", "final rehearsal checklist must protect composer clearing after send");
assertIncludes(finalRehearsalChecklist, "If an action will spend generation cost", "final rehearsal checklist must protect provider-cost confirmation boundaries");
assertIncludes(finalRehearsalChecklist, "这句话会引用：...", "final rehearsal checklist must protect selected-context feedback");
assertIncludes(finalRehearsalChecklist, "non-first shot such as `镜头 1-2`", "final rehearsal checklist must protect non-first-shot selected-context feedback");
assertIncludes(finalRehearsalChecklist, "`先整理`, `可补参考`, `可发视频`", "final rehearsal checklist must protect the three permission modes");
assertIncludes(finalRehearsalChecklist, "`当前项目已加载`", "final rehearsal checklist must protect the current-project Skills group");
assertIncludes(finalRehearsalChecklist, "`Agent 推荐`", "final rehearsal checklist must protect the recommended Skills group");
assertIncludes(finalRehearsalChecklist, "`我的 Skills`", "final rehearsal checklist must protect the user Skills group");
assertIncludes(finalRehearsalChecklist, "headlights, wheels, hands, eye direction, rain", "final rehearsal checklist must protect generalized asset granularity rules");
assertIncludes(finalRehearsalChecklist, "Submit serially", "final rehearsal checklist must protect serial video submission");
assertIncludes(finalRehearsalChecklist, "Seedance VIP 720p", "final rehearsal checklist must protect the demo live-provider profile");
assertIncludes(finalRehearsalChecklist, "No music, no BGM, no subtitles.", "final rehearsal checklist must protect the final no-BGM prompt boundary");
assertIncludes(finalRehearsalChecklist, "show submit id, queue/running/returned state", "final rehearsal checklist must protect video state visibility");
assertIncludes(finalRehearsalChecklist, "showcase package should include project data, prompts, references", "final rehearsal checklist must protect export evidence coverage");
assertIncludes(finalRehearsalChecklist, "Do not retry-subscribe or submit duplicate jobs", "final rehearsal checklist must protect slow provider queue behavior");
assertIncludes(finalRehearsalChecklist, "docs/demo-frontend-rehearsal-record.md", "final rehearsal checklist must require a visible-app rehearsal record");
assertIncludes(frontendRehearsalRecord, "Required Evidence", "frontend rehearsal record must define the evidence checklist");
assertIncludes(frontendRehearsalRecord, "Composer cleared after send", "frontend rehearsal record must track composer clearing");
assertIncludes(frontendRehearsalRecord, "Visible send button stayed present", "frontend rehearsal record must track the send button");
assertIncludes(frontendRehearsalRecord, "`先整理`, `可补参考`, or `可发视频`", "frontend rehearsal record must track visible permission modes");
assertIncludes(frontendRehearsalRecord, "这句话会引用：...", "frontend rehearsal record must track selected-context feedback");
assertIncludes(frontendRehearsalRecord, "Codex in-app browser rejected read access", "frontend rehearsal record must capture the current browser-policy blocker honestly");
assertIncludes(frontendRehearsalRecord, "do not work around this with raw CDP", "frontend rehearsal record must preserve the no-workaround browser-policy boundary");
assertIncludes(frontendRehearsalRecord, "npm run demo:ready:test", "frontend rehearsal record must cite the engineering gate that still passed");

assertMatches(projectStatusViewModel, /export interface ProjectStatusViewModel[\s\S]*stage: string[\s\S]*doing: string[\s\S]*waitingFor: string[\s\S]*nextAction: string[\s\S]*issue\?: string/, "P2 status model must expose one human-readable state shape");
assertMatches(agentCoreTypes, /export interface VibeAgentExecutionBoundary[\s\S]*mutatesProject: boolean[\s\S]*callsProvider: boolean[\s\S]*submitsExternalTask: boolean[\s\S]*requiresConfirmation: boolean[\s\S]*costRisk: VibeAgentExecutionCostRisk[\s\S]*summary: string/, "Agent Kernel v1 must expose a structured execution boundary");
assertMatches(agentCoreTypes, /export interface VibeAgentExecutionResultSummary[\s\S]*lifecycle: VibeAgentActionLifecycleStatus[\s\S]*status: "blocked" \| "awaiting_confirmation" \| "ready_to_run" \| "running"[\s\S]*summary: string[\s\S]*next: string/, "Agent Kernel v1 must expose a structured execution result");
assertMatches(agentCoreTypes, /export interface VibeAgentKernelTurn[\s\S]*userMessage: string[\s\S]*agentUnderstanding: string[\s\S]*projectStateSummary: string[\s\S]*projectDiagnostics: string\[\][\s\S]*selectedContext: VibeAgentSelectedContext[\s\S]*proposedActions: VibeAgentKernelAction\[\][\s\S]*executionBoundary: VibeAgentExecutionBoundary[\s\S]*executionResult: VibeAgentExecutionResultSummary[\s\S]*requiredConfirmation: boolean[\s\S]*executionCost: string[\s\S]*externalSubmissionRisk: string[\s\S]*nextSuggestion: string[\s\S]*relatedShots: string\[\][\s\S]*relatedAssets: string\[\][\s\S]*relatedSkills: string\[\][\s\S]*createdOrUpdatedFiles: string\[\][\s\S]*errors: string\[\]/, "Agent Kernel v1 must expose the full Agent turn contract");
assertMatches(agentCoreTypes, /export type VibeAgentActionLifecycleStatus[\s\S]*"proposed"[\s\S]*"waiting_for_confirmation"[\s\S]*"running"[\s\S]*"succeeded"[\s\S]*"failed"[\s\S]*"cancelled"[\s\S]*"needs_user_input"/, "Agent Kernel v1 must expose the action lifecycle states");
for (const actionName of ["inspect_project", "classify_assets", "plan_story", "revise_shot", "generate_references", "compile_video_request", "submit_video", "query_video", "export_showcase", "save_skill"]) {
  assertIncludes(agentActionRegistry, `${actionName}:`, `Agent action registry must expose ${actionName}`);
}
assertMatches(agentActionRegistry, /filter\(\(name\) => name !== "scan_assets"\)/, "legacy scan_assets must not appear in the visible Agent action list");
assertIncludes(agentActionRegistry, "新 Agent Turn 使用 classify_assets", "legacy scan_assets descriptor must point readers to classify_assets");
assertIncludes(agentCoreRunner, "kernelTurn", "Agent turn results must include the Kernel turn contract");
assertIncludes(agentCoreRunner, "projectDiagnostics", "Agent turns must surface project diagnostics in the Kernel contract");
assertIncludes(vibeAgentCoreTest, "assertVisibleAgentTurnChain", "Agent core test must enforce a visible message-flow chain");
assertIncludes(vibeAgentCoreTest, "project inspection start", "visible Agent turn chain must include project inspection");
assertIncludes(vibeAgentCoreTest, "asset classification result", "visible Agent turn chain must include asset classification result");
assertIncludes(vibeAgentCoreTest, "execution boundary", "visible Agent turn chain must include execution boundary");
assertIncludes(vibeAgentCoreTest, "confirmation request card", "visible Agent turn chain must include confirmation card");
assertIncludes(directorModeShell, "buildProjectStatusViewModel", "DirectorModeShell must render the unified project status projection");
assertMatches(directorModeShell, /function ProjectStatusSummary[\s\S]*status\.stage[\s\S]*status\.doing[\s\S]*status\.nextAction[\s\S]*status\.waitingFor[\s\S]*status\.issue/, "project status summary must show stage, work, waiting, next action, and errors");
assertIncludes(projectStatusViewModel, "videoWaitingLabel", "P2 status model must absorb video queue/return state");
assertIncludes(projectStatusViewModel, "assetWaitingLabel", "P2 status model must absorb reference-generation state");

const visibleUiSources = [
  ["NewVideoStart", newVideoStart],
  ["MinimalAgentPanel", minimalAgentPanel],
  ["CreatorDeskPanels", creatorDeskPanels],
  ["MinimalTopNav", minimalTopNav],
  ["DirectorModeShell", directorModeShell],
  ["agentPanelProjection", agentPanelProjection],
].map(([name, source]) => ({ name, source }));

for (const { name, source } of visibleUiSources) {
  for (const forbidden of ["补齐画面", "用底部主按钮", "看主按钮", "底部按钮", "点底部发送", "底部主按钮", "当前是只规划模式", "不能补参考"]) {
    assert(!source.includes(forbidden), `${name} should not expose old workflow copy: ${forbidden}`);
  }
}
assert(!newVideoStart.includes("整理草案"), "NewVideoStart should not restore the old draft-organize button copy");

assertIncludes(newVideoStart, "添加脚本、图片或声音", "P1 new-video entry must expose add-file as one main input action");
assertIncludes(newVideoStart, "发送给 AI 导演", "P1 new-video entry must expose a clear send action");
assertIncludes(minimalAgentPanel, "minimal-agent-send-button", "P1 Agent panel must keep a fixed bottom send button");
assertIncludes(minimalAgentPanel, "minimal-agent-footer-target", "P1 Agent panel must show the selected target in the input footer before sending");
assertIncludes(minimalAgentPanel, "agentNextActionAvailable", "P1 Agent panel must keep next actions in Agent task cards, separate from the send button");
assert(!minimalAgentPanel.includes("minimal-agent-suggested-button"), "P1 Agent panel must not reintroduce a second suggested-action button");
assertIncludes(minimalAgentPanel, "minimal-agent-asset-inbox-summary", "P1 Agent panel must explain material scanning in the message flow");
assertMatches(minimalAgentPanel, /totalCount <= 0 && needsReviewCount <= 0/, "P1 material-scan summary must not render misleading empty-state cards");
assertIncludes(agentPanelProjection, "先整理", "P1 visible mode copy should use creator language");
assertIncludes(agentPanelProjection, "可补参考", "P1 visible mode copy should use reference permission language");
assertIncludes(agentPanelProjection, "可发视频", "P1 visible mode copy should use video permission language");

assertIncludes(assetReconciliation, "hasVoiceReferenceSignal", "P3 asset binding must classify voice references");
assertIncludes(assetReconciliation, "hasMusicReferenceSignal", "P3 asset binding must keep obvious music out of voice references");
assertIncludes(assetReconciliation, "propBuckets.objectConstraints", "P3 object details must be merged into parent prop/action guidance");
assertIncludes(assetReconciliation, "propBuckets.characterConstraints", "P3 body/performance details must be merged into parent character guidance");
assertIncludes(assetReconciliation, "propBuckets.sceneConstraints", "P3 weather/location details must be merged into parent scene guidance");
assertIncludes(assetReconciliation, "不单独生成参考", "P3 merged details must explain why small parts do not become standalone assets");
assertIncludes(projectFolderScanner, "scanProjectFolderFiles", "Agent Kernel v1 must have a project folder scanner");
assertIncludes(projectFolderScanner, ".vibe-runtime", "folder scanner must skip internal runtime sidecars");
assertIncludes(projectFolderScannerTest, "prompts/shot-01.md", "folder scanner test must cover prompt files");
assertIncludes(projectFolderScannerTest, "receipts/shot-01-submit.json", "folder scanner test must cover submit receipts");
assertIncludes(runtimeWorkbenchProjection, "\"prompts\"", "runtime workbench scanner must expose prompt folders to the UI path");
assertIncludes(runtimeWorkbenchProjection, "\"receipts\"", "runtime workbench scanner must expose receipt folders to the UI path");
assertIncludes(runtimeWorkbenchProjection, "\"提交证据\"", "runtime workbench scanner must expose Chinese receipt folders to the UI path");

assertIncludes(audioPlanning, "defaultTtsRoute: \"parked_in_demo\"", "P4 demo audio path must park local TTS");
assertIncludes(audioPlanning, "finalMixMusicAllowed: false", "P4 demo audio path must not enable music mixing");
assertIncludes(newVideoAudioReferenceBinding, "samplePath: \"redacted_user_audio_reference\"", "P4 voice reference binding must not store raw local audio paths");
assertIncludes(voiceSourceLibrary, "rawPathRedacted: true", "P4 voice source library must mark user-selected paths as redacted");
assertIncludes(storyboardReferencePipeline, "The uploaded audio is the speaking character voice reference", "P4 Seedance prompt must treat uploaded audio as voice reference");
assertIncludes(storyboardReferencePipeline, "do not use it as BGM", "P4 Seedance prompt must forbid voice audio becoming BGM");

assertMatches(newVideoProjectVibePlanner, /function storyboardDurationSeconds[\s\S]*Math\.round\(parsed\)/, "P5 planned durations must be rounded to executable integer seconds");
assertIncludes(newVideoProjectVibePlanner, "visibleClips", "P5 planner must preserve visibleClips");
assertIncludes(newVideoProjectVibePlanner, "storyboardPanels", "P5 planner must preserve storyboardPanels");
assertIncludes(newVideoProjectVibePlanner, "actionBeats", "P5 planner must preserve actionBeats");
assertMatches(storyboardReferencePipeline, /Target visible video cuts[\s\S]*must not create extra visible cuts/, "P5 Seedance prompt must bind visible cuts to timing plan");
assertMatches(storyboardReferencePipeline, /Reference priority rule[\s\S]*storyboard controls motion and layout/, "P5 prompt must keep reference roles separated instead of blending images");

assertMatches(projectVideoClient, /ProjectSeedanceRelayQueueItem[\s\S]*shotId\?: string[\s\S]*promptPath\?: string[\s\S]*referencePaths\?: string\[\][\s\S]*submitId\?: string[\s\S]*outputVideoPath\?: string[\s\S]*localMediaPaths\?: string\[\]/, "P6 relay queue items must preserve submit evidence and local return paths");
assertIncludes(currentProjectPreviewProjection, "relayQueuePreviewItems", "P6 preview projection must merge relay queue state");
assertIncludes(currentProjectPreviewProjection, "referencePaths", "P6 preview queue must carry reference evidence");

assertIncludes(scriptsGroup, "\"smoke\"", "P7 script grouping must include smoke group");
assertIncludes(scriptsGroup, "\"ui\"", "P7 script grouping must include ui group");
assertIncludes(scriptsGroup, "\"runtime\"", "P7 script grouping must include runtime group");
assertIncludes(scriptsGroup, "\"provider\"", "P7 script grouping must include provider group");
assertIncludes(scriptsGroup, "\"live\"", "P7 script grouping must include live group");
assert(scripts["scripts:groups"], "P7 package scripts must expose scripts:groups");
assert(scripts["runtime:prune"], "P7 package scripts must expose runtime:prune");
assert(scripts["runtime:prune:apply"], "P7 package scripts must expose runtime:prune:apply");
assertIncludes(pruneTest, "allowedRoots", "P7 runtime prune test must keep cleanup scoped");
assertIncludes(architectureDoc, "npm audit --audit-level=high", "P7 docs must document the dependency security gate");
assertIncludes(architectureDoc, "npm run scripts:groups", "P7 docs must document the script grouping entry");
assertIncludes(architectureDoc, "npm run runtime:prune", "P7 docs must document runtime prune entry");

assert(scripts["demo:goal-audit:test"], "demo goal audit script must be registered");
assert(scripts["demo:main-chain-status-flow:test"], "demo main-chain status flow test must be registered");
assert(demoReady.includes("demo:main-chain-status-flow:test"), "demo:ready must include the main-chain status flow gate");
assert(demoReady.includes("demo:goal-audit:test"), "demo:ready must include the demo goal audit gate");
assert(demoReady.includes("showcase-package-audit:test"), "demo:ready must include the showcase package evidence gate");
assert(demoReady.includes("demo:artifact-freshness:test"), "demo:ready must include the local demo artifact freshness gate");
assert(demoReady.includes("project-folder-scanner:test"), "demo:ready must include the project folder scanner gate");
assert(demoReady.includes("runtime-api-workbench-projection:test"), "demo:ready must include the runtime workbench project-folder projection gate");
assert(demoReady.includes("mvp-full-chain-local:smoke"), "demo:ready must include the local full-chain smoke gate");
assert(!demoReady.includes("music-rhythm-analysis:test"), "demo:ready must not include parked music rhythm analysis");
assert(!demoReady.includes("tts-provider-planning:test"), "demo:ready must not include parked local/cloud TTS planning");

console.log("demo-goal-audit-test: P0-P7 demo invariants verified.");
