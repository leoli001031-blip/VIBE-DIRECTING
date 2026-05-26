import fs from "node:fs";
import { buildImageReferenceDeliveryReceipt, imageReferenceDeliveryReceiptSchemaVersion } from "../src/core/imageReferenceDeliveryReceipt.ts";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(pathname) {
  return fs.readFileSync(pathname, "utf8");
}

const generatedAt = "2026-05-07T00:00:00.000Z";
const sandboxRoot = "real-provider-executor/project_1/batch_A";
const sourcePath = `${sandboxRoot}/shots/S01/start.png`;
const sourceSha256 = "sha256:source-start-frame";

function transport(overrides = {}) {
  return {
    status: "dispatch_ready",
    requestId: "image2_request_S01",
    taskPlanId: "image_task_plan_S01",
    operation: "image2image",
    frameRole: "end_frame",
    requiredSourceStartFrame: true,
    sourceStartFrame: {
      inputId: "source_start_frame_S01",
      path: sourcePath,
      hash: sourceSha256,
      mime: "image/png",
      dimensions: { width: 1280, height: 720 },
      role: "source_start_frame",
      transportRole: "explicit_local_image_reference",
    },
    transportPolicy: {
      handoffOnly: true,
      dispatchSideEffectAllowed: false,
      providerSubmitAllowed: 0,
      canSubmitProvider: false,
      liveSubmitAllowed: false,
      externalNetworkIoAllowed: false,
      providerSelfReportCanComplete: false,
      promptOnlyImageEditAllowed: false,
      seedanceOrJimengAllowed: false,
      videoAllowed: false,
      fastOrVipAllowed: false,
      textToVideoAllowed: false,
    },
    blockers: [],
    ...overrides,
  };
}

function sourceFacts(overrides = {}) {
  return {
    inputId: "source_start_frame_S01",
    path: sourcePath,
    sha256: sourceSha256,
    mime: "image/png",
    byteLength: 1024,
    dimensions: { width: 1280, height: 720 },
    exists: true,
    readable: true,
    pathScope: "sandbox",
    ...overrides,
  };
}

function delivery(overrides = {}) {
  return {
    receiptId: "delivery_receipt_S01",
    requestId: "image2_request_S01",
    taskPlanId: "image_task_plan_S01",
    operation: "image2image",
    frameRole: "end_frame",
    deliveredInputKind: "app_server_localImage",
    actionSchemaParamName: "input_image",
    acceptedByActionSchema: true,
    deliveredSha256: sourceSha256,
    promptOnly: false,
    protocol: {
      threadId: "thread_S01",
      turnId: "turn_S01",
      toolCallId: "tool_call_S01",
      actionId: "agent_app_server_image_action",
    },
    toolSchemaHash: "sha256:tool-schema",
    generatedSchemaVersion: "agent-app-server-schema-2026-05-07",
    ...overrides,
  };
}

function build(overrides = {}) {
  return buildImageReferenceDeliveryReceipt({
    generatedAt,
    transport: transport(),
    sourceStartFrameFileFacts: sourceFacts(),
    delivery: delivery(),
    ...overrides,
  });
}

const ready = build();
assert(ready.schemaVersion === imageReferenceDeliveryReceiptSchemaVersion, "schema version drifted");
assert(ready.phase === "image_reference_delivery_receipt", "phase drifted");
assert(ready.status === "delivered", "valid app-server image receipt should be delivered");
assert(ready.requestId === "image2_request_S01", "requestId should come from transport");
assert(ready.requiredSourceStartFrame === true, "delivery receipt must keep required source start-frame flag");
assert(ready.sourceStartFrame.sha256 === sourceSha256, "source sha should be retained");
assert(ready.delivery.deliveredInputKind === "app_server_localImage", "delivery kind drifted");
assert(ready.delivery.protocol.toolSchemaHash === "sha256:tool-schema", "tool schema hash should be copied to protocol binding");
assert(ready.delivery.protocol.generatedSchemaVersion === "agent-app-server-schema-2026-05-07", "generated schema version should be copied to protocol binding");
assert(ready.verification.dispatchReady === true, "dispatch-ready evidence missing");
assert(ready.verification.requestMatchedTransport === true, "request/task/operation should match transport");
assert(ready.verification.sourceReceiptMatchedTransport === true, "source receipt should match transport");
assert(ready.verification.deliveredBytesMatchedSource === true, "delivered sha should match source");
assert(ready.verification.acceptedByActionSchema === true, "schema acceptance should be true");
assert(ready.verification.protocolBindingPresent === true, "protocol binding should be present");
assert(ready.verification.explicitImageInput === true, "explicit image input should be true");
assert(ready.verification.promptOnly === false, "prompt-only must be false");
assert(ready.transportPolicy.providerSubmitAllowed === 0, "receipt must not allow provider submit");
assert(ready.transportPolicy.externalNetworkIoAllowed === false, "receipt must not allow network I/O");
assert(ready.transportPolicy.seedanceOrJimengAllowed === false, "receipt must forbid Seedance/Jimeng");
assert(ready.deliveryPolicy.providerSubmitAllowed === 0, "delivery policy must not allow provider submit");
assert(ready.deliveryPolicy.sideEffectAllowed === false, "delivery policy must not allow side effects");

const generatedSchemaOnly = build({
  delivery: delivery({
    toolSchemaHash: "",
  }),
});
assert(generatedSchemaOnly.status === "delivered", "generated schema version alone should satisfy schema evidence");

const requestMismatch = build({
  delivery: delivery({
    requestId: "other_request",
    taskPlanId: "other_task",
    operation: "text2image",
  }),
});
assert(requestMismatch.status === "blocked", "request/task/operation mismatch must block");
assert(
  requestMismatch.blockers.includes("image_reference_delivery_request_task_operation_must_match_transport"),
  "request/task/operation mismatch blocker missing",
);

const missingDelivery = build({
  delivery: undefined,
});
assert(missingDelivery.status === "blocked", "missing delivery facts must block");
assert(missingDelivery.blockers.includes("image_reference_delivery_facts_missing"), "missing delivery blocker missing");

const promptOnly = build({
  delivery: delivery({
    deliveredInputKind: "prompt",
    promptOnly: true,
    deliveredSha256: sourceSha256,
  }),
});
assert(promptOnly.status === "blocked", "prompt-only delivery must block");
assert(promptOnly.blockers.includes("image_reference_delivery_input_kind_must_be_explicit_image"), "prompt-only explicit image blocker missing");
assert(promptOnly.blockers.includes("prompt_only_delivery_forbidden"), "prompt-only delivery blocker missing");
assert(promptOnly.blockers.includes("image_reference_delivery_prompt_only_must_be_false"), "prompt-only false blocker missing");

const textOnly = build({
  delivery: delivery({
    deliveredInputKind: "text_only",
    promptOnly: false,
  }),
});
assert(textOnly.status === "blocked", "text-only delivery kind must block");
assert(textOnly.blockers.includes("image_reference_delivery_input_kind_must_be_explicit_image"), "text-only blocker missing");
assert(textOnly.blockers.includes("prompt_only_delivery_forbidden"), "text-only prompt blocker missing");

const hashMismatch = build({
  delivery: delivery({
    deliveredSha256: "sha256:other",
  }),
});
assert(hashMismatch.status === "blocked", "delivered sha mismatch must block");
assert(hashMismatch.blockers.includes("image_reference_delivery_sha256_must_match_source"), "sha mismatch blocker missing");

const schemaRejected = build({
  delivery: delivery({
    acceptedByActionSchema: false,
  }),
});
assert(schemaRejected.status === "blocked", "schema rejection must block");
assert(schemaRejected.blockers.includes("image_reference_delivery_must_be_accepted_by_action_schema"), "schema rejection blocker missing");

const missingProtocol = build({
  delivery: delivery({
    protocol: {
      threadId: "thread_S01",
      turnId: "",
      toolCallId: "tool_call_S01",
    },
  }),
});
assert(missingProtocol.status === "blocked", "missing protocol binding must block");
assert(missingProtocol.blockers.includes("image_reference_delivery_turn_id_missing"), "turnId blocker missing");

const schemaEvidenceMissing = build({
  delivery: delivery({
    toolSchemaHash: "",
    generatedSchemaVersion: "",
    protocol: {
      ...delivery().protocol,
      toolSchemaHash: "",
      generatedSchemaVersion: "",
    },
  }),
});
assert(schemaEvidenceMissing.status === "blocked", "schema evidence missing must block");
assert(schemaEvidenceMissing.blockers.includes("image_reference_delivery_schema_evidence_missing"), "schema evidence blocker missing");

const sourceMissing = build({
  sourceStartFrameFileFacts: sourceFacts({
    exists: false,
  }),
});
assert(sourceMissing.status === "blocked", "missing source file must block");
assert(sourceMissing.blockers.includes("source_start_frame_delivery_file_must_exist"), "file exists blocker missing");

const sourceOutsideScope = build({
  sourceStartFrameFileFacts: sourceFacts({
    pathScope: "outside_scope",
  }),
});
assert(sourceOutsideScope.status === "blocked", "outside-scope source must block");
assert(sourceOutsideScope.blockers.includes("source_start_frame_delivery_path_scope_invalid"), "path scope blocker missing");

const sourceTransportMismatch = build({
  sourceStartFrameFileFacts: sourceFacts({
    sha256: "sha256:changed",
  }),
});
assert(sourceTransportMismatch.status === "blocked", "source/transport mismatch must block");
assert(sourceTransportMismatch.blockers.includes("source_start_frame_delivery_must_match_transport_receipt"), "source/transport mismatch blocker missing");
assert(sourceTransportMismatch.blockers.includes("image_reference_delivery_sha256_must_match_source"), "source/delivery mismatch blocker missing");

const blockedTransport = build({
  transport: transport({
    status: "blocked",
    blockers: ["prompt_only_image_edit_forbidden"],
  }),
});
assert(blockedTransport.status === "blocked", "blocked transport must block delivery receipt");
assert(blockedTransport.blockers.includes("image_reference_transport_must_be_dispatch_ready"), "dispatch ready blocker missing");
assert(blockedTransport.blockers.includes("image_reference_transport_blocker:prompt_only_image_edit_forbidden"), "transport blocker passthrough missing");

const missingTransportPolicy = build({
  transport: transport({
    transportPolicy: undefined,
  }),
});
assert(missingTransportPolicy.status === "blocked", "missing transport policy must block without throwing");
assert(missingTransportPolicy.blockers.includes("image_reference_transport_handoff_policy_missing"), "missing policy blocker missing");

const schema = JSON.parse(read("schemas/image_reference_delivery_receipt.schema.json"));
assert(schema.$schema === "https://json-schema.org/draft/2020-12/schema", "image reference delivery receipt schema $schema missing");

const registrySource = read("src/core/schemaRegistry.ts");
assert(registrySource.includes("image_reference_delivery_receipt.schema.json"), "schema registry entry missing");

const packageJson = JSON.parse(read("package.json"));
assert(
  packageJson.scripts["image-reference-delivery-receipt:test"] === "tsx scripts/image-reference-delivery-receipt-test.mts",
  "package script missing",
);

const source = read("src/core/imageReferenceDeliveryReceipt.ts");
for (const [pattern, label] of [
  [/from\s+["']node:child_process["']|from\s+["']child_process["']/, "child_process import"],
  [/\bfetch\s*\(/, "fetch call"],
  [/\bWebSocket\s*\(/, "WebSocket call"],
  [/\bspawn\s*\(/, "spawn call"],
  [/\bexec(?:File)?\s*\(/, "exec call"],
  [/\bwriteFile(?:Sync)?\s*\(/, "writeFile call"],
  [/\breadFile(?:Sync)?\s*\(/, "readFile call"],
]) {
  assert(!pattern.test(source), `image reference delivery receipt module must not contain ${label}`);
}

console.log("Image reference delivery receipt tests passed: explicit image delivery accepted, prompt/text-only and mismatched receipts blocked.");
