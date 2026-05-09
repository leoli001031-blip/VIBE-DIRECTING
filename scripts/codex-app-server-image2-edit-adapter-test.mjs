import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(pathname) {
  return fs.readFileSync(pathname, "utf8");
}

async function loadModule(sourcePath, exportPath) {
  const resolved = path.resolve(sourcePath);
  const output = ts.transpileModule(read(resolved), {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ES2022,
      moduleResolution: ts.ModuleResolutionKind.Node10,
      isolatedModules: true,
      importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
    },
    fileName: resolved,
  });
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vibe-codex-app-server-image2-edit-"));
  const outPath = path.join(tmpDir, exportPath);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, output.outputText, "utf8");
  return import(pathToFileURL(outPath).href);
}

const {
  buildCodexAppServerImage2EditAdapterState,
  codexAppServerImage2EditAdapterSchemaVersion,
} = await loadModule("src/core/codexAppServerImage2EditAdapter.ts", "codexAppServerImage2EditAdapter.mjs");

const generatedAt = "2026-05-10T00:00:00.000Z";
const runRoot = "real-test-sandbox/round5-zero-project-planning-anime/runs/run-test";
const shotId = "ZP05";
const startSha = "sha256:round5-zp05-start";
const attachmentId = "attachment_round5_ZP05_start_round5";
const editableSha = "sha256:editable-region-zp05";

function sidecars(overrides = {}) {
  const approvedStartFrameRef = {
    schemaVersion: "round5_approved_start_frame_ref_v1",
    shotId,
    startFramePath: "shots/ZP05/start.png",
    sha256: startSha,
    sourceStartFrameSha256: startSha,
    providerAttachmentId: attachmentId,
    approvalStatus: "approved",
    providerCalled: false,
    ...(overrides.approvedStartFrameRef || {}),
  };
  const editableRegionEvidence = {
    schemaVersion: "round5_editable_region_mask_or_bbox_v1",
    shotId,
    sourceStartFrameSha256: startSha,
    evidencePath: "shots/ZP05/editable_region_mask_or_bbox.json",
    evidenceSha256: editableSha,
    bboxNormalized: { x: 0.42, y: 0.34, width: 0.22, height: 0.2 },
    qaStatus: "pass",
    status: "ready",
    providerCalled: false,
    ...(overrides.editableRegionEvidence || {}),
  };
  const providerEditReceipt = {
    schemaVersion: "round5_provider_edit_receipt_v1",
    shotId,
    receiptId: "round5_ZP05_strict_edit_preflight_round5",
    receiptPath: "shots/ZP05/provider_edit_receipt.json",
    status: "ready_for_provider_edit",
    operation: "image.edit",
    sourceStartFramePath: "shots/ZP05/start.png",
    sourceStartFrameSha256: startSha,
    sourceStartFrameAttachmentId: attachmentId,
    editableRegionEvidencePath: "shots/ZP05/editable_region_mask_or_bbox.json",
    editableRegionEvidenceSha256: editableSha,
    noFallbackUsed: true,
    providerCalled: false,
    liveSubmitAllowed: false,
    videoSubmitted: false,
    workerSpawnForbidden: true,
    ...(overrides.providerEditReceipt || {}),
  };
  return {
    approvedStartFrameRef,
    editableRegionEvidence,
    providerEditReceipt,
  };
}

function build(overrides = {}) {
  const baseSidecars = sidecars(overrides.sidecars || {});
  return buildCodexAppServerImage2EditAdapterState({
    generatedAt,
    shotId,
    runRoot,
    ...baseSidecars,
    expectedOutputPath: `${runRoot}/shots/ZP05/end.png`,
    ...overrides.input,
  });
}

const good = build();
assert(good.schemaVersion === codexAppServerImage2EditAdapterSchemaVersion, "schema version drifted");
assert(good.status === "prepared", "good sidecars should produce a prepared packet");
assert(good.requestPacket?.status === "prepared", "request packet must be prepared");
assert(good.requestPacket?.operation === "image.edit", "operation must stay image.edit");
assert(good.requestPacket?.sourceStartFrame.sourceStartFrameSha256 === startSha, "source sha missing from packet");
assert(good.requestPacket?.sourceStartFrame.sourceStartFrameAttachmentId === attachmentId, "attachment id missing from packet");
assert(good.requestPacket?.sourceStartFrame.referenceImageInputs[0]?.mustUseAsVisualInput === true, "source must be a visual input");
assert(good.requestPacket?.sourceStartFrame.referenceImageInputs[0]?.path === `${runRoot}/shots/ZP05/start.png`, "source path mismatch");
assert(good.requestPacket?.editableEvidence.evidenceSha256 === editableSha, "editable evidence sha missing");
assert(good.requestPacket?.expectedOutputPath === `${runRoot}/shots/ZP05/end.png`, "expected output path mismatch");
assert(good.requestPacket?.submitPolicy.dryRunOnly === true, "packet must be dry-run only");
assert(good.requestPacket?.submitPolicy.liveSubmitAllowed === false, "packet must not allow live submit");
assert(good.requestPacket?.outputContract.providerSelfReportCanComplete === false, "provider self-report cannot complete output");
assert(good.referenceAttachmentReceipt?.status === "prepared", "reference receipt skeleton should be prepared");
assert(good.referenceAttachmentReceipt?.receiptSource === "prepared_skeleton_from_preflight_sidecars", "good fixture should use a skeleton receipt");
assert(good.referenceAttachmentReceipt?.deliveredInputKind === "local_file", "skeleton must use a visual local file input kind");
assert(good.referenceAttachmentReceipt?.promptOnly === false, "skeleton promptOnly must be false");
assert(good.referenceAttachmentReceipt?.acceptedByActionSchema === true, "skeleton schema acceptance must be explicit");
assert(good.referenceAttachmentReceipt?.deliveredSha256 === startSha, "skeleton delivered sha must match source");
assert(good.policy.providerCalled === false, "adapter must not call provider");
assert(good.policy.externalNetworkIoAllowed === false, "adapter must not allow network I/O");
assert(good.policy.statusMayOnlyBePreparedOrBlocked === true, "adapter status vocabulary must stay narrow");

const missingReferenceReceipt = build({
  input: {
    providerEditReceipt: undefined,
  },
});
assert(missingReferenceReceipt.status === "blocked", "missing provider edit/reference receipt must block");
assert(missingReferenceReceipt.blockers.includes("provider_edit_receipt_missing"), "missing receipt blocker missing");
assert(missingReferenceReceipt.blockers.includes("reference_attachment_receipt_missing"), "missing reference attachment blocker missing");
assert(!missingReferenceReceipt.requestPacket, "blocked state must not produce request packet");

const promptOnly = build({
  sidecars: {
    providerEditReceipt: {
      deliveredInputKind: "prompt",
      referenceAttachmentReceipt: {
        deliveredInputKind: "prompt",
        deliveredSha256: startSha,
        sourceStartFrameAttachmentId: attachmentId,
        promptOnly: true,
        acceptedByActionSchema: true,
      },
    },
  },
});
assert(promptOnly.status === "blocked", "prompt-only delivery must block");
assert(promptOnly.blockers.includes("prompt_only_image_edit_forbidden"), "prompt-only blocker missing");
assert(promptOnly.blockers.includes("reference_attachment_input_kind_not_visual"), "visual input-kind blocker missing");
assert(promptOnly.blockers.includes("reference_attachment_prompt_only_not_false"), "promptOnly=false blocker missing");

const pathInPrompt = build({
  input: {
    requestPrompt: `Edit ${runRoot}/shots/ZP05/start.png and open the control-box lid.`,
  },
});
assert(pathInPrompt.status === "blocked", "path-in-prompt fallback must block");
assert(pathInPrompt.blockers.includes("path_in_prompt_without_reference_attachment"), "path-in-prompt attachment blocker missing");
assert(pathInPrompt.blockers.includes("path_in_prompt_fallback_forbidden"), "path-in-prompt fallback blocker missing");

const shaMismatch = build({
  sidecars: {
    providerEditReceipt: {
      sourceStartFrameSha256: "sha256:other-start",
    },
  },
});
assert(shaMismatch.status === "blocked", "source sha mismatch must block");
assert(shaMismatch.blockers.includes("source_sha_mismatch"), "source sha mismatch blocker missing");

const visualValidatedReceipt = build({
  sidecars: {
    providerEditReceipt: {
      referenceAttachmentReceipt: {
        status: "prepared",
        deliveredInputKind: "input_image",
        sourceStartFrameSha256: startSha,
        sourceStartFrameAttachmentId: attachmentId,
        deliveredSha256: startSha,
        promptOnly: false,
        acceptedByActionSchema: true,
      },
    },
  },
});
assert(visualValidatedReceipt.status === "prepared", "validated visual receipt should prepare");
assert(visualValidatedReceipt.referenceAttachmentReceipt?.receiptSource === "validated_preflight_receipt", "visual receipt should be validated");
assert(visualValidatedReceipt.referenceAttachmentReceipt?.deliveredInputKind === "input_image", "validated visual receipt kind mismatch");

const liveSubmit = build({
  input: {
    liveSubmitRequested: true,
  },
});
assert(liveSubmit.status === "blocked", "live submit without future gate must block");
assert(liveSubmit.blockers.includes("live_submit_requires_explicit_future_gate"), "live submit gate blocker missing");

const providerSelfReport = build({
  input: {
    providerSelfReportedComplete: true,
  },
});
assert(providerSelfReport.status === "blocked", "provider self-report completion must block");
assert(providerSelfReport.blockers.includes("provider_self_report_completion_forbidden"), "provider self-report blocker missing");

const source = read("src/core/codexAppServerImage2EditAdapter.ts");
for (const [pattern, label] of [
  [/from\s+["']node:child_process["']|from\s+["']child_process["']/, "child_process import"],
  [/\bfetch\s*\(/, "fetch call"],
  [/\bWebSocket\s*\(/, "WebSocket call"],
  [/\bspawn\s*\(/, "spawn call"],
  [/\bexec(?:File)?\s*\(/, "exec call"],
  [/\bwriteFile(?:Sync)?\s*\(/, "writeFile call"],
  [/\breadFile(?:Sync)?\s*\(/, "readFile call"],
]) {
  assert(!pattern.test(source), `image2 edit adapter module must not contain ${label}`);
}

const packageJson = JSON.parse(read("package.json"));
assert(
  packageJson.scripts["codex-app-server-image2-edit-adapter:test"] === "node scripts/codex-app-server-image2-edit-adapter-test.mjs",
  "package script missing",
);

console.log("Codex app-server Image2 edit adapter tests passed: prepared packet plus receipt/path/prompt/hash gates.");
