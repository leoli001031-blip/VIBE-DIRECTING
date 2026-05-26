import fs from "node:fs";
import {
  assertProviderBoundaryTransition,
  buildProviderInputHash,
  createImage2Provider,
  createMockProviderAdapters,
  isProviderBoundaryStatus,
  providerBoundaryStatuses,
  type Image2ProviderInput,
} from "../src/providers/index.ts";
import {
  ingestMockProviderReturnForReview,
  mockSubmitProviderToolRequest,
  prepareProviderToolRequest,
  promoteMockProviderReturn,
  providerToolDescriptors,
} from "../src/tools/index.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

const expectedStatuses = [
  "planned",
  "ready_to_submit",
  "submitted",
  "return_ingested",
  "needs_review",
  "promoted",
  "failed",
];

assert(
  JSON.stringify(providerBoundaryStatuses) === JSON.stringify(expectedStatuses),
  "provider boundary statuses drifted",
);
for (const status of expectedStatuses) {
  assert(isProviderBoundaryStatus(status), `${status} should be accepted as provider boundary status`);
}
assert(!isProviderBoundaryStatus("ready"), "unknown provider boundary status should be rejected");

let invalidTransitionFailed = false;
try {
  assertProviderBoundaryTransition("planned", "submitted");
} catch {
  invalidTransitionFailed = true;
}
assert(invalidTransitionFailed, "planned -> submitted should require ready_to_submit first");

const createdAt = "2026-05-15T00:00:00.000Z";
const imageInput: Image2ProviderInput = {
  prompt: "single cinematic frame, soft window light",
  negativePrompt: "blur",
  outputPath: "real-test-sandbox/provider-tools-boundary/image2/S01.png",
  width: 1024,
  height: 768,
  metadata: {
    shotId: "S01",
    purpose: "boundary-test",
  },
};
const sameInputDifferentKeyOrder: Image2ProviderInput = {
  height: 768,
  width: 1024,
  outputPath: "real-test-sandbox/provider-tools-boundary/image2/S01.png",
  negativePrompt: "blur",
  metadata: {
    purpose: "boundary-test",
    shotId: "S01",
  },
  prompt: "single cinematic frame, soft window light",
};
assert(
  buildProviderInputHash(imageInput) === buildProviderInputHash(sameInputDifferentKeyOrder),
  "input hash should be stable across object key order",
);

const image2 = createImage2Provider();
assert(image2.mode === "mock_only", "Image2 adapter must be mock-only");
assert(image2.supportedTaskKinds.includes("image.generate"), "Image2 adapter should expose image generation");

const planned = image2.prepareRequest(imageInput, {
  requestId: "req_image2_boundary_S01",
  createdAt,
  fastTest: true,
});
assert(planned.status === "planned", "prepared Image2 request should start as planned");
assert(planned.submitPolicy.liveSubmitAllowed === false, "planned request must forbid live submit");
assert(planned.submitPolicy.credentialsAllowed === false, "planned request must forbid credential access");

const ready = image2.markReady(planned, "2026-05-15T00:00:01.000Z");
assert(ready.status === "ready_to_submit", "ready marker should produce ready_to_submit");

const submitted = image2.mockSubmit(ready, "2026-05-15T00:00:02.000Z");
assert(submitted.status === "submitted", "mock submit should produce submitted");
assert(submitted.receipt?.liveSubmit === false, "mock receipt must not represent a live submit");
assert(submitted.receipt?.adapterMode === "mock_only", "mock receipt should preserve mock-only mode");
assert(submitted.receipt?.inputHash === planned.inputHash, "mock receipt should carry request input hash");

const returnIngested = image2.ingestMockReturn(submitted, {
  headline: "Mocked Image2 output landed at the expected path.",
  outputPath: imageInput.outputPath,
  artifactCount: 1,
  mimeType: "image/png",
  width: 1024,
  height: 768,
  receivedAt: "2026-05-15T00:00:03.000Z",
});
assert(returnIngested.status === "return_ingested", "mock return should first produce return_ingested");
assert(returnIngested.reviewStatus === "pending_human_review", "ingested return should wait for review");
assert(returnIngested.responseSummary?.outputPath === imageInput.outputPath, "response summary should carry output path");
assert(returnIngested.responseSummary?.liveSubmit === false, "response summary must not claim live submit");

const reviewReady = image2.requestReview(returnIngested, "2026-05-15T00:00:04.000Z");
assert(reviewReady.status === "needs_review", "review marker should produce needs_review");

const promoted = image2.promote(reviewReady, "2026-05-15T00:00:05.000Z");
assert(promoted.status === "promoted", "reviewed return should be promotable");
assert(promoted.reviewStatus === "approved", "promoted request should carry approved review status");

const adapters = createMockProviderAdapters();
assert(adapters.image2.mode === "mock_only", "adapter registry Image2 should be mock-only");
assert(adapters.jimeng.mode === "mock_only", "adapter registry Jimeng should be mock-only");
assert(adapters.jimeng.supportedTaskKinds.includes("video.i2v"), "Jimeng adapter should expose i2v");

const blockedTool = prepareProviderToolRequest({
  providerId: "image2",
  prompt: "do not run this",
  outputPath: "real-test-sandbox/provider-tools-boundary/blocked.png",
  liveSubmitRequested: true,
});
assert(blockedTool.ok === false, "tool should block live submit requests");
assert(blockedTool.blockers.some((blocker) => /Live provider submit/.test(blocker)), "live submit blocker missing");
assert(!blockedTool.request, "blocked live submit must not create a request");

const preparedJimeng = prepareProviderToolRequest({
  providerId: "jimeng",
  prompt: "animate start frame into a short camera push",
  outputPath: "real-test-sandbox/provider-tools-boundary/jimeng/S01.mp4",
  startFramePath: "assets/S01-start.png",
  endFramePath: "assets/S01-end.png",
  durationSeconds: 4,
  aspectRatio: "16:9",
  requestId: "req_jimeng_boundary_S01",
  createdAt,
});
assert(preparedJimeng.ok === true, "Jimeng prepare tool should succeed");
assert(preparedJimeng.request?.status === "ready_to_submit", "prepare tool should stop at ready_to_submit");
assert(preparedJimeng.request?.taskKind === "video.i2v", "Jimeng prepare tool should create video.i2v requests");
assert(preparedJimeng.request, "Jimeng prepare tool should return a request");

const toolSubmitted = mockSubmitProviderToolRequest(
  preparedJimeng.request,
  {},
  "2026-05-15T00:00:06.000Z",
);
assert(toolSubmitted.ok === true, "tool mock submit should succeed");
assert(toolSubmitted.request?.status === "submitted", "tool mock submit should produce submitted");
assert(toolSubmitted.request?.receipt?.liveSubmit === false, "tool mock submit receipt must be non-live");
assert(toolSubmitted.request, "tool mock submit should return a request");

const toolReviewReady = ingestMockProviderReturnForReview(
  toolSubmitted.request,
  {
    headline: "Mocked Jimeng video output is ready for human review.",
    outputPath: "real-test-sandbox/provider-tools-boundary/jimeng/S01.mp4",
    artifactCount: 1,
    mimeType: "video/mp4",
    durationSeconds: 4,
    receivedAt: "2026-05-15T00:00:07.000Z",
  },
);
assert(toolReviewReady.ok === true, "tool ingest should succeed");
assert(toolReviewReady.request?.status === "needs_review", "tool ingest should advance to needs_review");
assert(toolReviewReady.request?.reviewStatus === "pending_human_review", "tool ingest should require review");
assert(toolReviewReady.request, "tool ingest should return a request");

const toolPromoted = promoteMockProviderReturn(toolReviewReady.request, {}, "2026-05-15T00:00:08.000Z");
assert(toolPromoted.ok === true, "tool promote should succeed");
assert(toolPromoted.request?.status === "promoted", "tool promote should produce promoted");
assert(toolPromoted.request?.reviewStatus === "approved", "tool promote should mark review approved");

for (const descriptor of providerToolDescriptors) {
  assert(descriptor.fastTestOnly === true, `${descriptor.name} should be fast-test only`);
  assert(descriptor.liveSubmitAllowed === false, `${descriptor.name} should forbid live submit`);
  assert(descriptor.credentialsAllowed === false, `${descriptor.name} should forbid credentials`);
}

for (const sourcePath of [
  "src/providers/providerBoundary.ts",
  "src/providers/mockAdapters.ts",
  "src/tools/providerBoundaryTools.ts",
]) {
  const source = fs.readFileSync(sourcePath, "utf8");
  for (const forbidden of [
    "fetch(",
    "XMLHttpRequest",
    "node:http",
    "node:https",
    "child_process",
    "process.env",
    "writeFile",
  ]) {
    assert(!source.includes(forbidden), `${sourcePath} must not contain ${forbidden}`);
  }
  assert(!source.includes("../agent"), `${sourcePath} must not import src/agent`);
  assert(!source.includes("../core/provider"), `${sourcePath} must not import old provider core files`);
  assert(!source.includes("../core/realProvider"), `${sourcePath} must not import old real provider core files`);
}

console.log(
  `provider/tools boundary tests passed: ${expectedStatuses.length} statuses, ${providerToolDescriptors.length} tools, mock-only adapters.`,
);
