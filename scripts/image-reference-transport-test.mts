import fs from "node:fs";
import { buildImageReferenceTransport, imageReferenceTransportSchemaVersion } from "../src/core/imageReferenceTransport.ts";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(pathname) {
  return fs.readFileSync(pathname, "utf8");
}

const generatedAt = "2026-05-07T00:00:00.000Z";
const sandboxRoot = "real-provider-executor/project_1/batch_A";
const outputPath = `${sandboxRoot}/shots/S01/end.png`;
const startPath = `${sandboxRoot}/shots/S01/start.png`;

function image2Request(overrides = {}) {
  return {
    requestId: "image2_request_S01",
    taskPlanId: "image_task_plan_S01",
    adapterId: "openai-image2-api-dry-run",
    operation: "image2image",
    frameRole: "end_frame",
    payload: {
      sourceIntent: ["derive the end frame from the approved start frame"],
      mustPreserve: ["character identity", "scene geometry"],
      mustAvoid: ["independent redraw", "style drift"],
      references: [{ referenceId: "hero_locked", source: "prompt_plan" }],
      referenceImageInputs: [
        {
          inputId: "source_start_frame_S01",
          role: "source_start_frame",
          path: startPath,
          source: "approved_start_frame",
          required: true,
          mustUseAsVisualInput: true,
          status: "available",
          notes: ["Must be carried as explicit visual input, not text."],
        },
      ],
      sourceStartFrameId: startPath,
      outputPath,
    },
    submitPolicy: {
      dry_run_only: true,
      manual_submit_required: true,
      live_submit_forbidden: true,
    },
    forbiddenFallbacks: ["provider_or_mode_fallback", "image2image_to_text2image", "independent_end_frame_generation"],
    ...overrides,
  };
}

function sandbox(overrides = {}) {
  return {
    root: sandboxRoot,
    allowedPrefixes: [sandboxRoot],
    expectedOutputPath: outputPath,
    manifestPath: `${sandboxRoot}/manifest.json`,
    qaReportPath: `${sandboxRoot}/qa/qa-report.json`,
    outsideRootWriteAllowed: false,
    ...overrides,
  };
}

function explicitImageAction(overrides = {}) {
  return {
    actionId: "agent_image2_explicit_local_input",
    providerId: "openai-image2-api",
    providerSlot: "image.edit",
    requiredMode: "image2image",
    interfaceKind: "explicit_image_input",
    inputKinds: ["text", "local_image", "reference_image"],
    supportsExplicitImageInput: true,
    supportsLocalImageInput: true,
    supportsFileReferenceInput: true,
    referenceImageInputRoles: ["source_start_frame"],
    ...overrides,
  };
}

function appServerCapability(overrides = {}) {
  return {
    runtimeKind: "agent_app_server",
    readiness: "ready",
    canUseImageRuntime: true,
    imageRuntimeAvailable: true,
    imageRuntimeSupportsExplicitInputs: true,
    imageRuntimeSupportsLocalFiles: true,
    imageRuntimeInputKinds: ["text", "local_image", "reference_image"],
    generatedSchemaAvailable: true,
    providerSubmitAllowed: 0,
    liveSubmitAllowed: false,
    ...overrides,
  };
}

function fileFacts(overrides = {}) {
  return {
    path: startPath,
    hash: "sha256:source-start-frame",
    mime: "image/png",
    dimensions: { width: 1280, height: 720 },
    status: "available",
    ...overrides,
  };
}

function build(overrides = {}) {
  return buildImageReferenceTransport({
    generatedAt,
    request: image2Request(),
    actionCapability: explicitImageAction(),
    appServerCapability: appServerCapability(),
    outputSandbox: sandbox(),
    sourceStartFrameFileFacts: fileFacts(),
    ...overrides,
  });
}

const promptOnly = build({
  actionCapability: {
    actionId: "prompt_only_image_edit",
    providerId: "openai-image2-api",
    providerSlot: "image.edit",
    requiredMode: "image2image",
    interfaceKind: "prompt_only",
    inputKinds: ["text"],
    supportsPromptOnly: true,
    supportsExplicitImageInput: false,
    supportsLocalImageInput: false,
  },
});
assert(promptOnly.status === "blocked", "prompt-only action must block");
assert(promptOnly.blockers.includes("prompt_only_image_edit_forbidden"), "prompt-only blocker missing");
assert(promptOnly.blockers.includes("image_reference_transport_unavailable"), "image reference transport blocker missing");
assert(promptOnly.transportPolicy.canSubmitProvider === false, "blocked prompt-only state must not submit provider");

const idWithoutVisualInput = build({
  request: image2Request({
    payload: {
      ...image2Request().payload,
      referenceImageInputs: [],
      sourceStartFrameId: startPath,
    },
  }),
});
assert(idWithoutVisualInput.status === "blocked", "sourceStartFrameId without visual input must block");
assert(idWithoutVisualInput.blockers.includes("source_start_frame_id_without_visual_input"), "sourceStartFrameId-only blocker missing");
assert(idWithoutVisualInput.blockers.includes("source_start_frame_visual_input_required"), "visual input blocker missing");

const missingFileFacts = build({
  sourceStartFrameFileFacts: undefined,
});
assert(missingFileFacts.status === "blocked", "missing source file facts must block");
assert(missingFileFacts.blockers.includes("source_start_frame_file_facts_missing"), "missing file facts blocker missing");

const missingHash = build({
  sourceStartFrameFileFacts: fileFacts({ hash: "" }),
});
assert(missingHash.status === "blocked", "missing source hash must block");
assert(missingHash.blockers.includes("source_start_frame_hash_missing"), "missing hash blocker missing");

const ready = build();
assert(ready.schemaVersion === imageReferenceTransportSchemaVersion, "schema version drifted");
assert(ready.phase === "image_reference_transport_handoff", "phase drifted");
assert(ready.status === "dispatch_ready", "explicit local image support and file facts should be dispatch-ready");
assert(ready.requiredSourceStartFrame === true, "image2image end frame must require source start frame");
assert(ready.sourceStartFrame.path === startPath, "ready state must carry explicit source start frame path");
assert(ready.sourceStartFrame.hash === "sha256:source-start-frame", "ready state must carry source hash");
assert(ready.sourceStartFrame.transportRole === "explicit_local_image_reference", "ready state must use explicit local image reference transport");
assert(ready.capabilityEvidence.actionSupportsExplicitImageInput === true, "action support evidence missing");
assert(ready.capabilityEvidence.appServerSupportsExplicitImageInput === true, "app-server explicit image support evidence missing");
assert(ready.transportPolicy.providerSubmitAllowed === 0, "dispatch-ready handoff must still forbid provider submit");
assert(ready.transportPolicy.externalNetworkIoAllowed === false, "dispatch-ready handoff must not allow network I/O");
assert(ready.transportPolicy.providerSelfReportCanComplete === false, "provider self-report must not complete");
assert(ready.transportPolicy.seedanceOrJimengAllowed === false, "Seedance/Jimeng must remain forbidden");
assert(ready.transportPolicy.videoAllowed === false, "video transport must remain forbidden");
assert(ready.transportPolicy.fastOrVipAllowed === false, "Fast/VIP must remain forbidden");
assert(ready.transportPolicy.textToVideoAllowed === false, "text-to-video must remain forbidden");

const text2imageStartFrame = build({
  request: image2Request({
    operation: "text2image",
    frameRole: "start_frame",
    payload: {
      ...image2Request().payload,
      referenceImageInputs: [],
      sourceStartFrameId: undefined,
      sourceIntent: ["generate the start frame from source intent"],
    },
    forbiddenFallbacks: ["provider_or_mode_fallback", "text2image_to_image2image"],
  }),
  actionCapability: {
    actionId: "structured_text2image_handoff",
    providerId: "openai-image2-api",
    providerSlot: "image.generate",
    requiredMode: "text2image",
    interfaceKind: "structured_handoff",
    inputKinds: ["text"],
    supportsExplicitImageInput: false,
    supportsLocalImageInput: false,
  },
  sourceStartFrameFileFacts: undefined,
});
assert(text2imageStartFrame.status === "dispatch_ready", "text2image start frame should not require source_start_frame");
assert(text2imageStartFrame.requiredSourceStartFrame === false, "text2image start frame source requirement drifted");
assert(!text2imageStartFrame.sourceStartFrame, "text2image start frame must not fabricate source start frame");
assert(text2imageStartFrame.transportPolicy.providerSubmitAllowed === 0, "text2image handoff still must not submit provider");
assert(text2imageStartFrame.transportPolicy.canSubmitProvider === false, "text2image handoff still must not expose provider submit");

const seedanceAttempt = build({
  actionCapability: explicitImageAction({ providerId: "seedance", providerSlot: "video.i2v", requiredMode: "frames2video" }),
});
assert(seedanceAttempt.status === "blocked", "Seedance/video action must block");
assert(seedanceAttempt.blockers.includes("seedance_or_jimeng_transport_forbidden"), "Seedance blocker missing");
assert(seedanceAttempt.blockers.includes("video_transport_forbidden"), "video blocker missing");

const schema = JSON.parse(read("schemas/image_reference_transport.schema.json"));
assert(schema.$schema === "https://json-schema.org/draft/2020-12/schema", "image reference transport schema $schema missing");

const registrySource = read("src/core/schemaRegistry.ts");
assert(registrySource.includes("image_reference_transport.schema.json"), "schema registry entry missing");

const packageJson = JSON.parse(read("package.json"));
assert(
  packageJson.scripts["image-reference-transport:test"] === "tsx scripts/image-reference-transport-test.mts",
  "package script missing",
);

const source = read("src/core/imageReferenceTransport.ts");
for (const [pattern, label] of [
  [/from\s+["']node:child_process["']|from\s+["']child_process["']/, "child_process import"],
  [/\bfetch\s*\(/, "fetch call"],
  [/\bWebSocket\s*\(/, "WebSocket call"],
  [/\bspawn\s*\(/, "spawn call"],
  [/\bexec(?:File)?\s*\(/, "exec call"],
  [/\bwriteFile(?:Sync)?\s*\(/, "writeFile call"],
]) {
  assert(!pattern.test(source), `image reference transport module must not contain ${label}`);
}

console.log("Image reference transport tests passed: prompt-only blocked, explicit local image input dispatch-ready, text2image stays handoff-only.");
