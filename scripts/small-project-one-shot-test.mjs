import { assert, assertCleanSmallProjectRuntimeState, buildSmallProjectDemoRuntime, loadCore, smallProjectFixture } from "./demo-runtime-fixture.mjs";

const { audit, runtimeState } = await buildSmallProjectDemoRuntime();
const { summary } = assertCleanSmallProjectRuntimeState(runtimeState, audit);
const { preRealTestClosure } = await loadCore();
const { applyPreRealTestClosure } = preRealTestClosure;

const waitingClosure = applyPreRealTestClosure(runtimeState, {
  generatedAt: smallProjectFixture.generatedAt,
});
assert(waitingClosure.actionConfirmation.oneUseReceipt === true, "closure must create a one-use action confirmation");
assert(waitingClosure.oneShotRealCallState.status === "ready_to_submit", "confirmed closure should compile a ready one-shot call state");
assert(waitingClosure.realProviderTransport.plan.status === "mock_submit_ready", "closure must default to mock transport plan");
assert(waitingClosure.realProviderTransport.receipt.status === "mock_submitted", "closure must create a mock receipt after confirmation");
assert(waitingClosure.realProviderTransport.result.status === "waiting_for_file", "receipt-only closure should wait for file return");
assert(waitingClosure.runtimeState.realProviderTransport.receipt.status === "mock_submitted", "runtime must carry transport receipt as first-class state");
assert(waitingClosure.runtimeState.imagePipeline.imageReferenceTransports.length === 1, "runtime must retain image reference transport evidence");
assert(waitingClosure.runtimeState.imagePipeline.imageReferenceDeliveryReceipts.length === 0, "text2image runtime must not invent image reference delivery receipt evidence");
assert(waitingClosure.runtimeState.providerHandoffStatus.status === "waiting_file", "confirmed runtime should bridge to waiting_file");
assert(waitingClosure.runtimeState.providerHandoffStatus.machineFacts.watcherExpectedOutputDetected === false, "waiting_file must not invent watcher evidence");

const selfReportOnly = applyPreRealTestClosure(runtimeState, {
  generatedAt: smallProjectFixture.generatedAt,
  providerSelfReportedComplete: true,
});
assert(selfReportOnly.realProviderTransport.result.status === "output_missing", "self-report-only result should remain missing output");
assert(selfReportOnly.runtimeState.providerHandoffStatus.status === "waiting_file", "self-report-only handoff must still wait for file evidence");
assert(selfReportOnly.runtimeState.providerHandoffStatus.machineFacts.providerSelfReportedComplete === true, "self-report fact should be retained");

const returnedClosure = applyPreRealTestClosure(runtimeState, {
  generatedAt: smallProjectFixture.generatedAt,
  returnEvidence: {
    outputPath: smallProjectFixture.outputPath,
    watcherExpectedOutputDetected: true,
    manifestMatched: true,
    qaPassed: true,
  },
});
assert(returnedClosure.realProviderTransport.result.status === "needs_review", "returned output should stop at needs_review");
assert(returnedClosure.runtimeState.providerHandoffStatus.status === "needs_review", "runtime handoff should need review after watcher/manifest/QA");
assert(returnedClosure.runtimeState.providerHandoffStatus.machineFacts.watcherExpectedOutputDetected === true, "returned runtime missing watcher fact");
assert(returnedClosure.runtimeState.providerHandoffStatus.machineFacts.manifestMatched === true, "returned runtime missing manifest fact");
assert(returnedClosure.runtimeState.providerHandoffStatus.machineFacts.qaPassed === true, "returned runtime missing QA fact");
assert(
  returnedClosure.runtimeState.previewExport.draftPreview.events.some(
    (event) => event.type === "image_hold" && event.mediaPath === smallProjectFixture.outputPath,
  ),
  "returned output should be visible as a draft preview image hold",
);
assert(returnedClosure.runtimeState.previewExport.formalPreview.status === "blocked", "returned sample must not auto-promote to formal preview");

console.log("Small project one-shot runtime test passed.");
console.log(JSON.stringify(summary, null, 2));
