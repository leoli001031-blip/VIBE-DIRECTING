import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRuntimeApiEndpoints } from "./runtime-api-endpoints.mts";
import { createRuntimeApiCurrentProjectReviewDecision } from "./runtime-api-current-project-review-decision.mts";
import {
  createProjectVibe,
  parseProjectVibeText,
  serializeProjectVibe,
  type ProjectVibeDocument,
} from "../src/project/index.ts";

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

  const endpoints = createRuntimeApiEndpoints();
  const source = {
    projectVibePath,
    projectVibeRelativePath: "project-root/project.vibe",
    runRootRelativePath: "project-root",
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
    writeFileSync,
    mkdirSync,
    running: () => false,
  });

  const lockInput = api.reviewDecisionRequestInput(
    new URL(`http://127.0.0.1${endpoints.currentProjectReviewDecisionEndpoint}?action=lock`),
    {
      receiptId: "review_lock_s01",
      reviewerId: "local_user",
      item: {
        id: "preview_s01",
        shotId: "S01",
        label: "Ticket insert",
        mediaPath: "runs/demo/S01/output.png",
        sourceReceiptId: "provider_receipt_s01",
        outputHash: "sha256-lock",
      },
      candidate: {
        shotId: "S01",
        assetId: "旧书",
        assetKind: "prop",
        label: "Ticket insert",
        outputPath: "runs/demo/S01/output.png",
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
