import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRuntimeApiEndpoints } from "./runtime-api-endpoints.mts";
import { createRuntimeApiCurrentProjectReviewDecision } from "./runtime-api-current-project-review-decision.mts";
import {
  createProjectVibe,
  hashProjectVibeFacts,
  parseProjectVibeText,
  serializeProjectVibe,
  type ProjectVibeDocument,
} from "../src/project/index.ts";
import { AGENT_VIDEO_GENERATION_JOB_LEDGER_SCHEMA_VERSION } from "../src/core/agentVideoProductionContract.ts";
import {
  agentDirectorReviewReceiptId,
  normalizeAgentDirectorReviewProjectRoot,
} from "../src/core/agentDirectorReviewDecision.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function response() {
  return {
    statusCode: 0,
    payload: undefined as any,
  };
}

function loadProject(projectVibePath: string): ProjectVibeDocument {
  const opened = parseProjectVibeText(readFileSync(projectVibePath, "utf8"));
  assert(opened.ok && opened.project, `Project.vibe should parse: ${opened.errors.join("; ")}`);
  return opened.project;
}

const workingRoot = mkdtempSync(path.join(tmpdir(), "runtime-review-decision-"));
try {
  const projectRoot = path.join(workingRoot, "project-root");
  const projectVibePath = path.join(projectRoot, "project.vibe");
  mkdirSync(projectRoot, { recursive: true });
  const project = createProjectVibe({
    projectId: "runtime_review_decision",
    title: "Runtime Review Decision",
    storyFlow: {
      id: "story_flow_runtime_review",
      sections: [{
        id: "section_intro",
        title: "Intro",
        summary: "One shot.",
        sequenceIndex: 0,
        shotIds: ["S01"],
      }],
      shotOrder: ["S01"],
    },
    shots: [{
      id: "S01",
      sectionId: "section_intro",
      title: "Opening frame",
      intent: "Show the opening frame.",
      sceneAssetIds: [],
      characterAssetIds: [],
      propAssetIds: [],
      durationSeconds: 4,
      status: "planned",
      sourceRefs: [],
    }],
  });
  writeFileSync(projectVibePath, serializeProjectVibe(project));
  const projectFactHash = hashProjectVibeFacts(project);
  const returnedResult = {
    status: "needs_review" as const,
    projectId: project.manifest.projectId,
    projectRoot,
    projectFactHash,
    jobId: "job_runtime_review_p6s01",
    actionId: "action_runtime_review_p6s01",
    shotId: "S01",
    sourceReceiptId: "seedance_submit_external_task_s01",
    outputPath: path.join(projectRoot, "video", "seedance", "P6S01.mp4"),
    outputHash: `sha256:${"a".repeat(64)}`,
    receivedAt: "2026-07-18T10:03:00.000Z",
  };
  const generationLedgerPath = path.join(projectRoot, ".vibe-runtime", "agent-generation-job-ledger.json");
  mkdirSync(path.dirname(generationLedgerPath), { recursive: true });
  writeFileSync(generationLedgerPath, `${JSON.stringify({
    schemaVersion: AGENT_VIDEO_GENERATION_JOB_LEDGER_SCHEMA_VERSION,
    ledgerId: "runtime_review_ledger",
    projectId: project.manifest.projectId,
    projectRoot,
    projectFactHash,
    createdAt: "2026-07-18T10:00:00.000Z",
    updatedAt: returnedResult.receivedAt,
    jobs: [{
      jobId: returnedResult.jobId,
      projectId: project.manifest.projectId,
      projectRoot,
      projectFactHash,
      actionId: returnedResult.actionId,
      operation: "execute",
      executionMode: "dry_run",
      providerCalled: false,
      kind: "video_submit",
      providerId: "vibe-director-dry-run-video",
      modelId: "dry-run-video",
      capability: "video_submit",
      pipelineStep: "submit_video",
      status: "succeeded",
      sourceConfirmationId: "confirm_runtime_review_p6s01",
      prompt: "P6S01",
      inputAssets: [],
      outputAssets: [returnedResult.outputPath],
      reviewResult: returnedResult,
      blockers: [],
      statusHistory: [
        { status: "staged", at: "2026-07-18T10:00:00.000Z" },
        { status: "confirmed", at: "2026-07-18T10:01:00.000Z" },
        { status: "running", at: "2026-07-18T10:02:00.000Z" },
        { status: "succeeded", at: returnedResult.receivedAt },
      ],
      createdAt: "2026-07-18T10:00:00.000Z",
      updatedAt: returnedResult.receivedAt,
    }],
  }, null, 2)}\n`);

  const endpoints = createRuntimeApiEndpoints();
  const source = {
    runRootPath: projectRoot,
    projectVibePath,
    projectVibeRelativePath: projectVibePath,
    runRootRelativePath: projectRoot,
  };
  const api = createRuntimeApiCurrentProjectReviewDecision({
    currentProjectReviewDecisionEndpoint: endpoints.currentProjectReviewDecisionEndpoint,
    currentProjectRouteContext: async (req: any, _res: any, _url: URL, endpoint: string) => ({
      requestContext: { endpoint },
      source,
      body: req.body,
    }),
    writeJson: (res: any, statusCode: number, payload: any) => {
      res.statusCode = statusCode;
      res.payload = payload;
    },
    requestOverrideDiagnostics: (requestContext: any) => ({ endpoint: requestContext.endpoint }),
    runtimePolicy: () => ({ runtimeApi: "local" }),
    readFileSync,
    existsSync,
    writeFileSync,
    mkdirSync,
    running: () => false,
  });

  const beforePreviewApproval = loadProject(projectVibePath);
  const textBeforePreviewApproval = readFileSync(projectVibePath, "utf8");
  const stalePreviewApproval = api.currentProjectReviewDecisionResponse(api.reviewDecisionRequestInput(
    new URL(`http://127.0.0.1${endpoints.currentProjectReviewDecisionEndpoint}?action=approve`),
    {
      action: "approve",
      reviewIdentity: { ...returnedResult, projectFactHash: "stale-project-facts" },
      candidate: {
        shotId: returnedResult.shotId,
        outputPath: "video/seedance/P6S01.mp4",
        sourceReceiptId: returnedResult.sourceReceiptId,
        outputHash: returnedResult.outputHash,
      },
    },
  ), { running: false }, source);
  assert(stalePreviewApproval.ok === false && stalePreviewApproval.blockers.includes("review_project_fact_hash_mismatch"), "preview approval from stale project facts must fail closed");

  const wrongActionPreviewApproval = api.currentProjectReviewDecisionResponse(api.reviewDecisionRequestInput(
    new URL(`http://127.0.0.1${endpoints.currentProjectReviewDecisionEndpoint}?action=approve`),
    {
      action: "approve",
      reviewerId: "local_user",
      reviewIdentity: { ...returnedResult, actionId: "action_from_another_generation" },
    },
  ), { running: false }, source);
  assert(wrongActionPreviewApproval.ok === false && wrongActionPreviewApproval.blockers.includes("review_job_identity_mismatch"), "preview approval must match the exact generation job action");
  assert(readFileSync(projectVibePath, "utf8") === textBeforePreviewApproval, "blocked review identities must not mutate Project.vibe");

  const previewApproveInput = api.reviewDecisionRequestInput(
    new URL(`http://127.0.0.1${endpoints.currentProjectReviewDecisionEndpoint}?action=approve`),
    {
      action: "approve",
      reviewerId: "local_user",
      reviewIdentity: { ...returnedResult, projectRoot: `/private${projectRoot}` },
      item: {
        id: "preview_video_s01",
        shotId: "S01",
        label: "P6S01 returned video",
        mediaPath: returnedResult.outputPath,
        sourceReceiptId: returnedResult.sourceReceiptId,
        outputHash: returnedResult.outputHash,
      },
    },
  );
  const previewApprovePayload = api.currentProjectReviewDecisionResponse(previewApproveInput, { running: false }, source);
  assert(previewApprovePayload.ok === true && previewApprovePayload.status === "approved", "approve should persist a preview review receipt");
  assert(previewApprovePayload.promotionOperationCount === 0, "preview approval must not stage asset or visual-memory promotion operations");
  const previewApprovedProject = loadProject(projectVibePath);
  const expectedReviewReceiptId = agentDirectorReviewReceiptId(returnedResult);
  const previewReceipt = previewApprovedProject.receipts?.reviewReceipts.find((receipt) => receipt.id === expectedReviewReceiptId);
  assert(previewReceipt?.outputPath === "video/seedance/P6S01.mp4", "preview approval should persist a project-relative media path");
  assert(
    previewReceipt?.projectId === returnedResult.projectId
      && normalizeAgentDirectorReviewProjectRoot(previewReceipt.projectRoot || "") === normalizeAgentDirectorReviewProjectRoot(returnedResult.projectRoot),
    "preview approval should bind the canonical project id and root",
  );
  assert(previewReceipt?.projectFactHash === returnedResult.projectFactHash, "preview approval should bind the source project fact hash");
  assert(previewReceipt?.jobId === returnedResult.jobId && previewReceipt.actionId === returnedResult.actionId, "preview approval should bind the generation job and action");
  assert(previewReceipt?.shotId === returnedResult.shotId, "preview approval should bind the exact shot");
  assert(previewReceipt?.sourceReceiptId === returnedResult.sourceReceiptId, "preview approval should remain bound to the provider receipt");
  assert(previewReceipt?.outputHash === returnedResult.outputHash, "preview approval should remain bound to the exact output hash");
  assert(previewReceipt?.promotionAuthorized === false, "preview approval must not authorize project-fact promotion");
  assert(previewApprovedProject.assets.length === beforePreviewApproval.assets.length, "preview approval must not add an asset");
  assert(previewApprovedProject.visualMemory.entries.length === beforePreviewApproval.visualMemory.entries.length, "preview approval must not add visual memory");
  assert(JSON.stringify(previewApprovedProject.shots) === JSON.stringify(beforePreviewApproval.shots), "preview approval must not mutate shot facts");
  const approvedText = readFileSync(projectVibePath, "utf8");
  const replayPayload = api.currentProjectReviewDecisionResponse(api.reviewDecisionRequestInput(
    new URL(`http://127.0.0.1${endpoints.currentProjectReviewDecisionEndpoint}?action=approve`),
    {
      action: "approve",
      reviewedAt: "2026-07-18T11:00:00.000Z",
      reviewerId: "local_user",
      reviewIdentity: returnedResult,
      candidate: {
        shotId: returnedResult.shotId,
        outputPath: "video/seedance/P6S01.mp4",
        sourceReceiptId: returnedResult.sourceReceiptId,
        outputHash: returnedResult.outputHash,
      },
    },
  ), { running: false }, source);
  assert(replayPayload.ok === true && replayPayload.idempotent === true, "replaying the same preview approval should return the existing receipt");
  assert(replayPayload.reviewReceipt?.id === expectedReviewReceiptId, "idempotent replay should return the same Review Receipt identity");
  assert(readFileSync(projectVibePath, "utf8") === approvedText, "idempotent replay must not rewrite Project.vibe");

  const alternateReceiptReplayInput = api.reviewDecisionRequestInput(
    new URL(`http://127.0.0.1${endpoints.currentProjectReviewDecisionEndpoint}?action=approve`),
    {
      action: "approve",
      receiptId: "caller_selected_duplicate_receipt",
      reviewerId: "local_user",
      reviewIdentity: returnedResult,
    },
  );
  assert(alternateReceiptReplayInput.receiptId === expectedReviewReceiptId, "strict Agent video approval must derive its receipt id from result identity");
  const alternateReceiptReplay = api.currentProjectReviewDecisionResponse(alternateReceiptReplayInput, { running: false }, source);
  assert(alternateReceiptReplay.ok === true && alternateReceiptReplay.idempotent === true, "a replay with an alternate caller receipt id must still resolve to the existing receipt");
  assert(readFileSync(projectVibePath, "utf8") === approvedText, "an alternate receipt-id replay must not append or rewrite Project.vibe");

  const lockInput = api.reviewDecisionRequestInput(
    new URL(`http://127.0.0.1${endpoints.currentProjectReviewDecisionEndpoint}?action=lock`),
    {
      receiptId: "review_lock_s01",
      reviewerId: "local_user",
      item: {
        id: "preview_s01",
        shotId: "S01",
        label: "Ticket insert",
        mediaPath: path.join(projectRoot, "runs", "demo", "S01", "output.png"),
        sourceReceiptId: "provider_receipt_s01",
        outputHash: "sha256-lock",
      },
      candidate: {
        shotId: "S01",
        assetId: "旧书",
        assetKind: "prop",
        label: "Ticket insert",
        outputPath: path.join(projectRoot, "runs", "demo", "S01", "output.png"),
        sourceReceiptId: "provider_receipt_s01",
        outputHash: "sha256-lock",
      },
      decision: {
        assetKind: "prop",
        assetLabel: "道具参考：发光车票",
        usedByShotIds: ["S01"],
      },
    },
  );
  const lockPayload = api.currentProjectReviewDecisionResponse(lockInput, { running: false }, source);
  assert(lockPayload.ok === true, "lock review decision should write Project.vibe");
  assert(lockPayload.status === "locked", "lock review decision status mismatch");
  assert(lockPayload.projectVibeWritten === true, "lock should persist Project.vibe");
  const lockedProject = loadProject(projectVibePath);
  assert(lockedProject.receipts?.reviewReceipts.some((receipt) => receipt.id === "review_lock_s01" && receipt.status === "approved"), "lock should append approved review receipt");
  assert(lockedProject.assets.some((asset) => asset.id === "旧书" && asset.kind === "prop" && asset.status === "locked"), "lock should upsert locked prop asset");
  assert(lockedProject.assets.some((asset) => asset.id === "旧书" && asset.path === "runs/demo/S01/output.png"), "lock should persist project-relative output paths");
  assert(lockedProject.visualMemory.entries.some((entry) => entry.assetId === "旧书" && entry.canUseAsFutureReference), "lock should update visual memory");
  assert(lockedProject.shots.some((shot) => shot.id === "S01" && shot.status === "ready" && shot.propAssetIds?.includes("旧书")), "lock should attach the asset back to the source shot");

  const secondChineseLockPayload = api.currentProjectReviewDecisionResponse(api.reviewDecisionRequestInput(
    new URL(`http://127.0.0.1${endpoints.currentProjectReviewDecisionEndpoint}?action=lock`),
    {
      receiptId: "review_lock_ticket_s01",
      reviewerId: "local_user",
      candidate: {
        shotId: "S01",
        assetId: "发光车票",
        assetKind: "prop",
        label: "Glowing ticket",
        outputPath: "runs/demo/S01/ticket.png",
        sourceReceiptId: "provider_receipt_ticket",
        outputHash: "sha256-ticket",
      },
      decision: {
        assetKind: "prop",
        assetLabel: "道具参考：发光车票",
        usedByShotIds: ["S01"],
      },
    },
  ), { running: false }, source);
  assert(secondChineseLockPayload.ok === true, "locking multiple non-ASCII assets should not collide in visual memory ids");
  const secondLockedProject = loadProject(projectVibePath);
  const visualMemoryIds = secondLockedProject.visualMemory.entries.map((entry) => entry.id);
  assert(new Set(visualMemoryIds).size === visualMemoryIds.length, "visual memory ids must stay unique for non-ASCII asset ids");
  assert(secondLockedProject.shots.some((shot) => shot.id === "S01" && shot.propAssetIds?.includes("发光车票")), "second locked prop should attach to the source shot");

  const retryRes = response();
  const handled = await api.handleCurrentProjectReviewDecisionRoute(
    {
      method: "POST",
      body: {
        action: "retry",
        receiptId: "review_retry_s01",
        reviewerId: "local_user",
        item: { id: "preview_s01_retry", shotId: "S01", label: "Opening frame retry" },
      },
    },
    retryRes,
    new URL(`http://127.0.0.1${endpoints.currentProjectReviewDecisionEndpoint}`),
  );
  assert(handled === true, "route should handle review decision endpoint");
  assert(retryRes.statusCode === 200, "retry route should return 200");
  assert(retryRes.payload.status === "retry_requested", "retry route should return retry_requested");
  const retriedProject = loadProject(projectVibePath);
  assert(retriedProject.receipts?.reviewReceipts.some((receipt) => receipt.id === "review_retry_s01" && receipt.status === "retry_requested" && receipt.retryRequested === true), "retry should append retry_requested receipt");

  const rejectPayload = api.currentProjectReviewDecisionResponse(api.reviewDecisionRequestInput(
    new URL(`http://127.0.0.1${endpoints.currentProjectReviewDecisionEndpoint}?action=reject`),
    {
      receiptId: "review_reject_s01",
      reviewerId: "local_user",
      item: { id: "preview_s01_reject", shotId: "S01", label: "Opening frame reject" },
    },
  ), { running: false }, source);
  assert(rejectPayload.ok === true && rejectPayload.status === "rejected", "reject should stage and persist a rejected review receipt");
  const rejectedProject = loadProject(projectVibePath);
  assert(rejectedProject.receipts?.reviewReceipts.some((receipt) => receipt.id === "review_reject_s01" && receipt.status === "rejected"), "reject should append rejected receipt");

  const invalidPayload = api.currentProjectReviewDecisionResponse(api.reviewDecisionRequestInput(
    new URL(`http://127.0.0.1${endpoints.currentProjectReviewDecisionEndpoint}`),
    { receiptId: "review_invalid_s01", item: { shotId: "S01" } },
  ), { running: false }, source);
  assert(invalidPayload.ok === false && invalidPayload.blockers.includes("review_action_required"), "missing action should block");

  const ignoredRes = response();
  const ignored = await api.handleCurrentProjectReviewDecisionRoute({ method: "GET", body: {} }, ignoredRes, new URL("http://127.0.0.1/api/runtime/projects/current"));
  assert(ignored === false, "non review decision route should not be handled");
  assert(existsSync(projectVibePath), "project.vibe should remain on disk");

  console.log("runtime-api-current-project-review-decision-test: ok");
} finally {
  rmSync(workingRoot, { recursive: true, force: true });
}
