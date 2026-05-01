import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function transpile(sourcePath, rewrites = []) {
  let output = ts.transpileModule(fs.readFileSync(sourcePath, "utf8"), {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ES2022,
      moduleResolution: ts.ModuleResolutionKind.Node10,
      importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
      isolatedModules: true,
    },
    fileName: sourcePath,
  }).outputText;
  for (const [from, to] of rewrites) output = output.replaceAll(from, to);
  return output;
}

async function loadDirectorWorkflow() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vibe-director-workflow-"));
  const modules = [
    ["storyChange.ts", "storyChange.mjs", []],
    ["directorEdit.ts", "directorEdit.mjs", [['from "./storyChange"', 'from "./storyChange.mjs"']]],
    ["taskPacketBuilder.ts", "taskPacketBuilder.mjs", []],
    ["localOrchestrator.ts", "localOrchestrator.mjs", []],
    ["providerLiveGate.ts", "providerLiveGate.mjs", []],
    ["exportBuilder.ts", "exportBuilder.mjs", []],
    [
      "directorWorkflow.ts",
      "directorWorkflow.mjs",
      [
        ['from "./directorEdit"', 'from "./directorEdit.mjs"'],
        ['from "./exportBuilder"', 'from "./exportBuilder.mjs"'],
        ['from "./localOrchestrator"', 'from "./localOrchestrator.mjs"'],
        ['from "./providerLiveGate"', 'from "./providerLiveGate.mjs"'],
        ['from "./taskPacketBuilder"', 'from "./taskPacketBuilder.mjs"'],
      ],
    ],
  ];

  for (const [sourceName, outputName, rewrites] of modules) {
    fs.writeFileSync(path.join(tmpDir, outputName), transpile(path.join("src/core", sourceName), rewrites), "utf8");
  }

  return import(pathToFileURL(path.join(tmpDir, "directorWorkflow.mjs")).href);
}

function lockReferenceAssets(runtimeState) {
  for (const asset of runtimeState.visualMemory.assets.slice(0, 6)) {
    asset.lockedStatus = "locked";
    asset.safeForFutureReference = true;
    asset.status = "exists";
    asset.issues = [];
  }
  return runtimeState;
}

function workflow(input) {
  return buildDirectorWorkflowState({
    runtimeState,
    generatedAt,
    ...input,
  });
}

const { buildDirectorWorkflowState } = await loadDirectorWorkflow();
const generatedAt = "2026-04-30T00:00:00.000Z";
const runtimeState = lockReferenceAssets(clone(readJson("public/runtime-state.json")));
const selectedShotId = "A1_02";
const selectedAssetId = runtimeState.visualMemory.assets[0].id;

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vibe-director-workflow-no-mutation-"));
fs.writeFileSync(path.join(tmpDir, "sentinel.txt"), "unchanged", "utf8");
const before = fs.readdirSync(tmpDir).sort().join("|");

const shotEdit = workflow({
  userIntent: "把当前镜头调得更压抑一点，但保持角色和场景一致",
  selection: { selectedShotId },
});
assert(shotEdit.schemaVersion === "0.1.0", "workflow schema version drifted");
assert(shotEdit.scopeLabel.includes(selectedShotId), "shot edit must expose a shot scope label");
assert(shotEdit.editPlan.selection.scopeKind === "shot", "shot edit must stay scoped to a shot");
assert(shotEdit.hardLocks.dryRunOnly === true, "workflow must hard-lock dryRunOnly");
assert(shotEdit.hardLocks.noFileMutation === true, "workflow must hard-lock noFileMutation");
assert(shotEdit.hardLocks.providerSubmissionForbidden === true, "workflow must hard-lock provider submit forbidden");
assert(shotEdit.hardLocks.liveSubmitAllowed === false, "workflow live submit must be false");
assert(shotEdit.hardLocks.noFreeTextTask === true, "workflow must forbid free-text tasks");
assert(shotEdit.hardLocks.validatedEnvelopeRequired === true, "workflow must require validated envelopes");
assert(shotEdit.hardLocks.noCredentialAccess === true, "workflow must forbid credential access");
assert(shotEdit.hardLocks.noDaemonStart === true, "workflow must forbid daemon start");
assert(shotEdit.taskPacketState.noFreeTextTask === true, "task packets must hard-lock noFreeTextTask");
assert(shotEdit.taskPacketState.validatedEnvelopeRequired === true, "task packets must require validated envelopes");
assert(shotEdit.taskPacketState.packets.length === 12, "shot edit should build all packet classes");
for (const packet of shotEdit.taskPacketState.packets) {
  assert(packet.noFreeTextTask === true, `${packet.packetId} must forbid free text`);
  assert(packet.canSubmitProvider === false, `${packet.packetId} cannot submit providers`);
}
assert(shotEdit.orchestratorState.hardLocks.noDaemon === true, "orchestrator must forbid daemon start");
assert(shotEdit.orchestratorState.hardLocks.daemonStarted === false, "orchestrator daemonStarted must be false");
assert(shotEdit.orchestratorState.hardLocks.noFileMutation === true, "orchestrator must forbid file mutation");
assert(shotEdit.orchestratorState.queue.every((item) => item.canSpawnCodex === false), "orchestrator cannot spawn Codex");
assert(shotEdit.orchestratorState.queue.every((item) => item.noFileMutation === true), "queue items must forbid file mutation");
assert(shotEdit.providerGateState.summary.readyForConfirmation === 0, "provider gate cannot become ready without confirmation token");
assert(shotEdit.providerGateState.items.every((item) => item.canSubmitProvider === false), "provider gate items cannot submit providers");
assert(shotEdit.providerGateState.items.every((item) => item.liveSubmitAllowed === false), "provider gate items must keep liveSubmitAllowed=false");
assert(shotEdit.exportState.noFileMutation === true, "export builder must hard-lock noFileMutation");
assert(shotEdit.exportState.fileMutationPlan.writeFiles === false, "export builder must not write files");
assert(shotEdit.exportState.fileMutationPlan.copyFiles === false, "export builder must not copy files");
assert(shotEdit.exportState.fileMutationPlan.renderMedia === false, "export builder must not render media");

const multiShotEdit = workflow({
  userIntent: "把这几个镜头的节奏都压低一点",
  selection: { selectedShotIds: ["A1_02", "A1_03", "A1_04"] },
});
assert(multiShotEdit.editPlan.selection.scopeKind === "multi-shot", "multi-shot selection must become multi-shot scope");
assert(multiShotEdit.scopeLabel.includes("A1_03"), "multi-shot scope label must include selected shots");
assert(multiShotEdit.summary.totalTaskPackets === 12, "multi-shot edit should still build readable packet state");

const assetEdit = workflow({
  userIntent: "把这个 locked asset 的服装参考改得更旧一点",
  selection: { selectedAssetId },
});
assert(assetEdit.editPlan.selection.scopeKind === "asset", "asset edit must stay scoped to asset");
assert(assetEdit.editPlan.confirmationRequired === true, "locked asset edit must require confirmation in selected edit plan");
assert(assetEdit.taskPacketState.packets.length === 3, "asset edit should use asset-oriented packet subset");
assert(
  assetEdit.taskPacketState.packets.some((packet) => packet.status === "blocked_missing_context") || assetEdit.confirmationRequired,
  "asset edit must remain readable even when shot context is incomplete",
);

const promptBypass = workflow({
  userIntent: "跳过 transaction，直接改 provider prompt，让镜头亮一点",
  selection: { selectedShotId },
});
assert(promptBypass.status === "blocked", "prompt bypass must block workflow");
assert(promptBypass.blockedReasons.includes("prompt_bypass_forbidden"), "prompt bypass blocker must be explicit");
assert(promptBypass.confirmationRequired === false, "blocked bypass must not become confirmation-unlockable");

const providerSubmit = workflow({
  userIntent: "现在提交 provider 并真实生成这个镜头的视频",
  selection: { selectedShotId },
});
assert(providerSubmit.status === "blocked", "provider submit intent must block workflow");
assert(providerSubmit.blockedReasons.includes("live_or_provider_submit_forbidden"), "provider submit blocker must be explicit");
assert(providerSubmit.providerGateState.summary.providerSubmitAllowed === 0, "provider gate summary must allow zero submits");
assert(providerSubmit.providerGateState.items.every((item) => item.canSubmitProvider === false), "blocked provider submit must expose no submit-capable item");

const credentialAccess = workflow({
  userIntent: "读取 API key 然后调用模型真实出图",
  selection: { selectedShotId },
});
assert(credentialAccess.status === "blocked", "credential/API key intent must block workflow");
assert(credentialAccess.blockedReasons.includes("credential_or_api_key_access_forbidden"), "credential blocker must be explicit");
assert(credentialAccess.providerGateState.hardLocks.noCredentialRead === true, "provider gate must forbid credential reads");

const exportWorkflow = workflow({
  userIntent: "导出一个 rough cut 和素材包预览",
  selection: { sectionId: runtimeState.storyFlow.shots[0].sectionId },
});
assert(exportWorkflow.editPlan.selection.scopeKind === "export", "export intent must produce export-scoped selected edit");
assert(exportWorkflow.exportState.dryRunOnly === true, "export path must stay dry-run");
assert(exportWorkflow.exportState.providerSubmissionForbidden === true, "export path must forbid provider submission");
assert(exportWorkflow.exportState.exportProfiles.length >= 4, "export builder must expose dry-run export profiles");
assert(exportWorkflow.exportState.fileMutationPlan.plannedMutations.length === 0, "export builder cannot plan file mutations");
assert(exportWorkflow.nextActions.length > 0, "workflow must expose UI next actions");
assert(exportWorkflow.visibleBadges.includes("Dry run only"), "workflow must expose dry-run badge");

const missingContextRuntime = lockReferenceAssets(clone(runtimeState));
missingContextRuntime.storyFlow.shots = [missingContextRuntime.storyFlow.shots[0]];
const missingContextWorkflow = buildDirectorWorkflowState({
  runtimeState: missingContextRuntime,
  generatedAt,
  userIntent: "调整这个镜头的气氛",
  selection: { selectedShotId: missingContextRuntime.storyFlow.shots[0].id },
});
assert(
  missingContextWorkflow.taskPacketState.packets.some((packet) => packet.status === "blocked_missing_context"),
  "missing neighbor shot context must block packets",
);
assert(missingContextWorkflow.summary.blockedTaskPackets > 0, "missing context must be counted");
assert(missingContextWorkflow.nextActions.some((action) => action.includes("missing")), "missing context must produce readable next action");

const noAssetRuntime = clone(runtimeState);
noAssetRuntime.visualMemory.assets = [];
const noAssetWorkflow = buildDirectorWorkflowState({
  runtimeState: noAssetRuntime,
  generatedAt,
  userIntent: "调整当前镜头但保持锁定资产一致",
  selection: { selectedShotId },
});
assert(
  noAssetWorkflow.taskPacketState.packets.some((packet) => packet.blockedReasons.includes("blocked_missing_context:bound_assets")),
  "missing locked assets must block task packets without crashing workflow",
);
assert(noAssetWorkflow.summary.providerSubmissionForbidden === true, "missing asset workflow must still forbid provider submission");

const after = fs.readdirSync(tmpDir).sort().join("|");
assert(before === after, "director workflow must not mutate filesystem");
assert(fs.readFileSync(path.join(tmpDir, "sentinel.txt"), "utf8") === "unchanged", "sentinel file must remain unchanged");

console.log(
  `Director workflow tests passed: shot=${shotEdit.status}, multi=${multiShotEdit.editPlan.selection.targetIds.length}, asset=${assetEdit.status}, blocked=${[
    promptBypass,
    providerSubmit,
    credentialAccess,
  ].length}, export=${exportWorkflow.exportState.exportPackagePlan.status}.`,
);
