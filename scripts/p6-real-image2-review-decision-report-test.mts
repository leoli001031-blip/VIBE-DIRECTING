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

function argValue(name: string) {
  const prefix = `${name}=`;
  const exactIndex = process.argv.indexOf(name);
  if (exactIndex >= 0) return process.argv[exactIndex + 1];
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown, label: string): string {
  assert(typeof value === "string" && value.trim(), `${label} must be a non-empty string`);
  return value.trim();
}

function loadProject(projectVibePath: string): ProjectVibeDocument {
  const opened = parseProjectVibeText(readFileSync(projectVibePath, "utf8"));
  assert(opened.ok && opened.project, `Project.vibe should parse: ${opened.errors.join("; ")}`);
  return opened.project;
}

function providerObservationReceipt(reportDir: string, shotId: string) {
  const observationPath = path.join(reportDir, "provider_observations", `${shotId}.json`);
  if (!existsSync(observationPath)) return `provider_observation_${shotId}`;
  const observation = JSON.parse(readFileSync(observationPath, "utf8"));
  return typeof observation.receiptId === "string" && observation.receiptId.trim()
    ? observation.receiptId.trim()
    : `provider_observation_${shotId}`;
}

const reportPath = argValue("--report");
assert(reportPath, "Usage: tsx scripts/p6-real-image2-review-decision-report-test.mts --report=<p6-live-report.json>");

const report = JSON.parse(readFileSync(reportPath, "utf8"));
assert(report.liveRequested === true && report.providerCalled === true, "review decision report test requires a live provider report");
assert(report.providerRequestStrategy === "scheduler_one_shot_with_retry", "live report should use retry scheduler strategy");
assert(report.maxConcurrency >= 3 && report.maxConcurrency <= 10, "live report should prove bounded 3-10 concurrency");
assert(report.providerReturnedCount >= 3, "live report should include at least 3 returned outputs");
const outputs = Array.isArray(report.outputs) ? report.outputs.filter(isRecord).slice(0, 3) : [];
assert(outputs.length === 3, "live report must include 3 output facts");

const reportDir = path.dirname(reportPath);
const projectRoot = mkdtempSync(path.join(tmpdir(), "p6-review-decision-report-"));
try {
  const projectVibePath = path.join(projectRoot, "project.vibe");
  const shotIds = outputs.map((output) => stringValue(output.shotId, "output.shotId"));
  const project = createProjectVibe({
    projectId: `p6_review_${String(report.runId || "live").replace(/[^a-zA-Z0-9_-]+/g, "_")}`,
    title: "P6 Live Review Decision Test",
    storyFlow: {
      id: "story_flow_p6_review",
      sections: [{
        id: "section_live_review",
        title: "Live Review",
        summary: "Review live Image2 returns.",
        sequenceIndex: 0,
        shotIds,
      }],
      shotOrder: shotIds,
    },
    shots: shotIds.map((shotId, index) => ({
      id: shotId,
      sectionId: "section_live_review",
      title: `Live return ${index + 1}`,
      intent: "Review a real Image2 returned frame.",
      sceneAssetIds: [],
      characterAssetIds: [],
      propAssetIds: [],
      durationSeconds: 4,
      status: "planned",
      sourceRefs: [`p6-report#${shotId}`],
    })),
  });
  writeFileSync(projectVibePath, serializeProjectVibe(project));

  const endpoints = createRuntimeApiEndpoints();
  const source = {
    projectVibePath,
    projectVibeRelativePath: "project.vibe",
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
    writeFileSync,
    mkdirSync,
    running: () => false,
  });

  const [lockOutput, retryOutput, rejectOutput] = outputs;
  const actions = [
    ["lock", lockOutput],
    ["retry", retryOutput],
    ["reject", rejectOutput],
  ] as const;

  for (const [action, output] of actions) {
    const shotId = stringValue(output.shotId, "output.shotId");
    const payload = api.currentProjectReviewDecisionResponse(api.reviewDecisionRequestInput(
      new URL(`http://127.0.0.1${endpoints.currentProjectReviewDecisionEndpoint}?action=${action}`),
      {
        receiptId: `review_${action}_${shotId}`,
        reviewerId: "local_user",
        item: {
          id: `review_item_${shotId}`,
          shotId,
          label: `Live return ${shotId}`,
          mediaPath: stringValue(output.outputPath, "output.outputPath"),
          sourceReceiptId: providerObservationReceipt(reportDir, shotId),
          outputHash: stringValue(output.outputSha256, "output.outputSha256"),
        },
      },
    ), { running: false, reportPath }, source);
    assert(payload.ok === true, `${action} should write Project.vibe`);
  }

  const reviewedProject = loadProject(projectVibePath);
  const receipts = reviewedProject.receipts?.reviewReceipts || [];
  assert(receipts.some((receipt) => receipt.id === `review_lock_${shotIds[0]}` && receipt.status === "approved"), "lock should append approved receipt");
  assert(receipts.some((receipt) => receipt.id === `review_retry_${shotIds[1]}` && receipt.status === "retry_requested" && receipt.retryRequested === true), "retry should append retry_requested receipt");
  assert(receipts.some((receipt) => receipt.id === `review_reject_${shotIds[2]}` && receipt.status === "rejected"), "reject should append rejected receipt");
  assert(reviewedProject.assets.some((asset) => asset.id === `asset_${shotIds[0]}` && asset.status === "locked"), "lock should upsert locked asset");
  assert(reviewedProject.visualMemory.entries.some((entry) => entry.assetId === `asset_${shotIds[0]}` && entry.canUseAsFutureReference), "lock should promote to locked visual memory");
  assert(!reviewedProject.visualMemory.entries.some((entry) => entry.assetId === `asset_${shotIds[1]}` || entry.assetId === `asset_${shotIds[2]}`), "retry/reject must not enter locked visual memory");

  console.log(`p6-real-image2-review-decision-report-test: ok (${shotIds.join(", ")})`);
} finally {
  rmSync(projectRoot, { recursive: true, force: true });
}
