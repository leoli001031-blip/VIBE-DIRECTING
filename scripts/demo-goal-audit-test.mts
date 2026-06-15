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
const demoHandoff = read("DEMO_HANDOFF.md");
const architectureDoc = read("docs/current-demo-architecture.md");
const recordingRunbook = read("docs/demo-recording-runbook.md");
const directorModeShell = read("src/ui/director/DirectorModeShell.tsx");
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

assertIncludes(architectureDoc, "/Users/lichenhao/Desktop/new vibe directing", "P0 doc must name the canonical development root");
assertMatches(architectureDoc, /P0 project entry[\s\S]*P7 debt cleanup/, "architecture doc must preserve the P0-P7 demo closeout line");
assertIncludes(architectureDoc, "Project.vibe", "project-folder concept must stay anchored by Project.vibe");
assertIncludes(readme, "docs/demo-recording-runbook.md", "README must link the recording runbook");
assertIncludes(demoHandoff, "docs/demo-recording-runbook.md", "demo handoff must point recordings to the runbook");
assertIncludes(architectureDoc, "docs/demo-recording-runbook.md", "architecture doc must name the recording runbook");
assertIncludes(recordingRunbook, "Recording Flow", "recording runbook must include a recording flow");
assertIncludes(recordingRunbook, "Talk Track", "recording runbook must include a talk track");
assertIncludes(recordingRunbook, "What Not To Claim", "recording runbook must preserve demo boundaries");
assertIncludes(recordingRunbook, "seedance-two-video-evidence:test", "recording runbook must include returned-video fallback evidence");

assertMatches(projectStatusViewModel, /export interface ProjectStatusViewModel[\s\S]*stage: string[\s\S]*doing: string[\s\S]*waitingFor: string[\s\S]*nextAction: string[\s\S]*issue\?: string/, "P2 status model must expose one human-readable state shape");
assertIncludes(directorModeShell, "buildProjectStatusViewModel", "DirectorModeShell must render the unified project status projection");
assertMatches(directorModeShell, /function ProjectStatusSummary[\s\S]*status\.stage[\s\S]*status\.doing[\s\S]*status\.waitingFor[\s\S]*status\.nextAction[\s\S]*status\.issue/, "project status summary must show stage, work, waiting, next action, and errors");
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
  for (const forbidden of ["整理草案", "补齐画面", "用底部主按钮", "看主按钮", "底部按钮", "点底部发送", "底部主按钮", "当前是只规划模式", "不能补参考"]) {
    assert(!source.includes(forbidden), `${name} should not expose old workflow copy: ${forbidden}`);
  }
}

assertIncludes(newVideoStart, "添加脚本、图片或声音", "P1 new-video entry must expose add-file as one main input action");
assertIncludes(newVideoStart, "发送给 AI 导演", "P1 new-video entry must expose a clear send action");
assertIncludes(minimalAgentPanel, "minimal-agent-send-button", "P1 Agent panel must keep a fixed bottom send button");
assertIncludes(minimalAgentPanel, "footerPrimaryUsesAgentNext", "P1 next actions must fold into the single bottom primary button");
assert(!minimalAgentPanel.includes("minimal-agent-suggested-button"), "P1 Agent panel must not reintroduce a second suggested-action button");
assertIncludes(agentPanelProjection, "先整理", "P1 visible mode copy should use creator language");
assertIncludes(agentPanelProjection, "可做参考", "P1 visible mode copy should use reference-generation language");

assertIncludes(assetReconciliation, "hasVoiceReferenceSignal", "P3 asset binding must classify voice references");
assertIncludes(assetReconciliation, "hasMusicReferenceSignal", "P3 asset binding must keep obvious music out of voice references");
assertIncludes(assetReconciliation, "propBuckets.objectConstraints", "P3 object details must be merged into parent prop/action guidance");
assertIncludes(assetReconciliation, "propBuckets.characterConstraints", "P3 body/performance details must be merged into parent character guidance");
assertIncludes(assetReconciliation, "propBuckets.sceneConstraints", "P3 weather/location details must be merged into parent scene guidance");
assertIncludes(assetReconciliation, "不单独生成参考", "P3 merged details must explain why small parts do not become standalone assets");

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
assert(demoReady.includes("mvp-full-chain-local:smoke"), "demo:ready must include the local full-chain smoke gate");
assert(!demoReady.includes("music-rhythm-analysis:test"), "demo:ready must not include parked music rhythm analysis");
assert(!demoReady.includes("tts-provider-planning:test"), "demo:ready must not include parked local/cloud TTS planning");

console.log("demo-goal-audit-test: P0-P7 demo invariants verified.");
