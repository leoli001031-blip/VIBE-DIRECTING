import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function waitForServer(child) {
  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => {
      reject(new Error(`Timed out waiting for server. stdout=${stdout} stderr=${stderr}`));
    }, 15000);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
      for (const line of stdout.split(/\r?\n/)) {
        if (!line.includes("vibe-core-runtime-api-listening")) continue;
        try {
          const payload = JSON.parse(line);
          clearTimeout(timeout);
          resolve(payload);
          return;
        } catch {
          // Keep waiting for a complete JSON line.
        }
      }
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on("exit", (code) => {
      if (code === 0) return;
      clearTimeout(timeout);
      reject(new Error(`Server exited early with ${code}. stdout=${stdout} stderr=${stderr}`));
    });
  });
}

async function fetchJson(url, init) {
  const response = await fetch(url, init);
  const payload = await response.json();
  return { response, payload };
}

async function selectProject(baseUrl, projectRoot, projectId, displayName, init = {}) {
  const headers = {
    "content-type": "application/json",
    ...(init.headers || {}),
  };
  return fetchJson(`${baseUrl}/api/runtime/projects/select`, {
    ...init,
    method: "POST",
    headers,
    body: JSON.stringify({ projectRoot, projectId, displayName }),
  });
}

function spawnRuntimeServer(env) {
  const tsxCliPath = path.join(process.cwd(), "node_modules", "tsx", "dist", "cli.mjs");
  return spawn(process.execPath, [tsxCliPath, "scripts/local-runtime-api-server.mts"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      VIBE_CORE_REAL_DEMO_005_ROOT: project005Root,
      VIBE_CORE_KNOWN_PROJECT_FIXTURE_ROOTS: [project004Root, project005Root].join(","),
      ...env,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function assert005Payload(payload, label) {
  assert(payload.ok === true, `${label} should be ok`);
  assert(payload.previewStatus === "blocked", `${label} preview status mismatch`);
  assert(payload.productionStatus === "blocked", `${label} production status mismatch`);
  assert(Array.isArray(payload.reviewOverlayShots), `${label} reviewOverlayShots missing`);
  assert(payload.reviewOverlayShots.includes("S07"), `${label} missing S07 overlay`);
  assert(payload.reviewOverlayShots.includes("S08"), `${label} missing S08 overlay`);
  assert(Number(payload.shotCount) === 8, `${label} shot count mismatch`);
  assert(Array.isArray(payload.observations) && payload.observations.length === 8, `${label} observations mismatch`);
}

const localRuntimeFixtureRoot = "real-test-sandbox/generated-local-runtime-api-test-fixtures";
const project004Root = `${localRuntimeFixtureRoot}/004-image2-start-frames`;
const project004Id = "real_demo_e2e_004_image2_start_frames";
const project004TruthPath = `${project004Root}/reports/runtime_truth_layer.json`;
const project004VibePath = `${project004Root}/project/project.vibe`;
const project005Root = `${localRuntimeFixtureRoot}/005-anime-image2-start-frames`;
const project005Id = "real_demo_e2e_005_anime_image2_start_frames";
const project005TruthPath = `${project005Root}/reports/runtime_truth_layer.json`;
const project005VibePath = `${project005Root}/project/project.vibe`;
const project005OneShotRoot = `${project005Root}/real-trigger-one-shot`;
const round5Root = `${localRuntimeFixtureRoot}/round5-artifact-ingest`;
const round5ProjectId = "round5_zero_planning_anime_signal";
const round5ReportPath = `${round5Root}/reports/round5_full_real_chain_report.json`;
const round5VibePath = `${round5Root}/project/project.vibe.json`;

function round5StrictEditSidecars(shotId) {
  return [
    `${round5Root}/shots/${shotId}/approved_start_frame_ref.json`,
    `${round5Root}/shots/${shotId}/editable_region_mask_or_bbox.json`,
    `${round5Root}/shots/${shotId}/provider_edit_receipt.json`,
    `${round5Root}/shots/${shotId}/end_provider_observation.json`,
    `${round5Root}/shots/${shotId}/end_semantic_qa.json`,
    `${round5Root}/shots/${shotId}/end_pair_qa.json`,
    `${round5Root}/shots/${shotId}/end.png`,
  ];
}

const round5Zp05StrictEditSidecars = round5StrictEditSidecars("ZP05");
const round5Zp05StrictEditPreflightSidecars = round5Zp05StrictEditSidecars.slice(0, 3);
const round5Zp05StrictEditReturnSidecars = round5Zp05StrictEditSidecars.slice(3);
const storyFlowFactSourceRoot = path.join(process.cwd(), ".tmp-current-story-flow-fact-source-test");
const storyFlowFactSourceProjectRoot = path.relative(process.cwd(), storyFlowFactSourceRoot);
const storyFlowFactSourceProjectVibePath = path.join(storyFlowFactSourceRoot, "project", "project.vibe");
const storyFlowFactSourceSidecarPath = path.join(storyFlowFactSourceRoot, "project", "story_flow", "story_flow.vibe.json");

function assertNo005Leak(payload, label) {
  const text = JSON.stringify(payload);
  assert(!text.includes(project005Id), `${label} must not leak 005 project id`);
  assert(!text.includes(project005Root), `${label} must not leak 005 project root`);
  assert(!text.includes("S07"), `${label} must not leak 005 review shots`);
  assert(!text.includes("S08"), `${label} must not leak 005 review shots`);
}

function assertUnboundPayload(payload, label) {
  assert(payload.ok === false, `${label} should fail closed`);
  assert(payload.status === "unbound", `${label} status should be unbound`);
  assert(payload.providerCalled === false, `${label} must not call provider`);
  assert(payload.prepareRan === false, `${label} must not run prepare`);
  assert(payload.projectVibeWritten === false, `${label} must not write project.vibe`);
  assert(payload.liveSubmitAllowed === false, `${label} live submit must stay blocked`);
  assert(payload.dryRunOnly === true, `${label} must stay dry-run only`);
  assert(payload.workerSpawnForbidden === true, `${label} worker spawn must stay blocked`);
  assert(payload.previewStatus === "unavailable", `${label} preview status should be unavailable`);
  assert(payload.productionStatus === "blocked", `${label} production status should be blocked`);
  assert(payload.projectRootMode === "unbound_current_project", `${label} project root mode mismatch`);
  assert(Array.isArray(payload.observations) && payload.observations.length === 0, `${label} observations should be empty`);
  assert(Array.isArray(payload.previewItems) && payload.previewItems.length === 0, `${label} previewItems should be empty`);
  assert(payload.ledgerProjection === undefined, `${label} ledger projection should be absent`);
  assertNo005Leak(payload, label);
}

function assertProjectProjectionFacts(payload, label, root, primaryReportPath) {
  assert(payload.projectRootRelativePath === root, `${label} projectRootRelativePath mismatch`);
  assert(payload.projectVibeRelativePath === `${root}/project/project.vibe`, `${label} projectVibeRelativePath mismatch`);
  assert(payload.workbenchFacts?.projectRoot === root, `${label} workbenchFacts project root mismatch`);
  assert(payload.workbenchFacts?.projectVibePath === `${root}/project/project.vibe`, `${label} workbenchFacts project.vibe path mismatch`);
  assert(payload.workbenchFacts?.sourceIndex?.present === true, `${label} source_index should be present`);
  assert(payload.workbenchFacts?.sourceIndex?.readable === true, `${label} source_index should be readable`);
  assert(payload.workbenchFacts?.storyFlow?.present === true, `${label} story_flow should be present`);
  assert(payload.workbenchFacts?.storyFlow?.readable === true, `${label} story_flow should be readable`);
  assert(payload.workbenchFacts?.storyFlow?.shotCount === 8, `${label} story_flow shot count mismatch`);
  assert(payload.workbenchFacts?.visualMemory?.present === true, `${label} visual_memory should be present`);
  assert(payload.workbenchFacts?.visualMemory?.readable === true, `${label} visual_memory should be readable`);
  assert(payload.workbenchFacts?.visualMemory?.assetCount >= 6, `${label} visual_memory asset count mismatch`);
  assert(payload.workbenchFacts?.providerCalled === false, `${label} workbenchFacts must not call provider`);
  assert(payload.workbenchFacts?.prepareRan === false, `${label} workbenchFacts must not run prepare`);
  assert(payload.workbenchFacts?.projectVibeWritten === false, `${label} workbenchFacts must not write project.vibe`);
  assert(payload.projectionSource === "runtime_truth_layer+preview_plan", `${label} should prefer runtime truth + preview plan`);
  assert(payload.ledgerTruthSource === "runtime_truth_layer", `${label} ledger truth source mismatch`);
  assert(Array.isArray(payload.factsUsed), `${label} factsUsed missing`);
  assert(payload.factsUsed.some((item) => item.name === "run_manifest"), `${label} should use run_manifest`);
  assert(payload.factsUsed.some((item) => item.name === "runtime_truth_layer"), `${label} should use runtime_truth_layer`);
  assert(payload.factsUsed.some((item) => item.name === "preview_plan"), `${label} should use preview_plan`);
  assert(payload.reportPath === primaryReportPath, `${label} primary report path mismatch`);
  assert(payload.image2ReportPath === `${root}/reports/image2_start_long_chain_report.json`, `${label} compatibility image2 report path mismatch`);
}

function assertCurrentBindingContext(payload, label, root, projectId) {
  assert(payload.currentProject?.bound === true, `${label} should expose bound current project`);
  assert(payload.providerCalled === false, `${label} must not call provider`);
  assert(payload.prepareRan === false, `${label} must not run prepare`);
  assert(payload.projectVibeWritten === false, `${label} must not write project.vibe`);
  assert(payload.liveSubmitAllowed === false, `${label} live submit must stay blocked`);
  assert(payload.dryRunOnly === true, `${label} must stay dry-run only`);
  assert(payload.workerSpawnForbidden === true, `${label} worker spawn must stay blocked`);
  assert(payload.projectRootMode === "runtime_current_project_binding", `${label} should use runtime binding`);
  assert(payload.requestContext?.projectRoot === root, `${label} request context project root mismatch`);
  assert(payload.requestContext?.projectRootSource === "binding", `${label} request context source mismatch`);
  assert(payload.project?.projectId === projectId, `${label} project id mismatch`);
  assert(payload.projectId === projectId, `${label} top-level project id mismatch`);
  assert(payload.identity?.projectId === projectId, `${label} identity project id mismatch`);
  assert(payload.project?.projectRoot === root, `${label} project root mismatch`);
}

function assertCurrent005(payload, label) {
  assert005Payload(payload, label);
  assertCurrentBindingContext(payload, label, project005Root, project005Id);
  assert(payload.project?.runId === "real_demo_e2e_005_anime_image2_start_frames_run_20260507", `${label} project run id mismatch`);
  assert(payload.plannedImageCount === 8, `${label} planned image count mismatch`);
  assert(payload.returnedImageCount === 8, `${label} returned image count mismatch`);
  assert(payload.needsReviewCount === 2, `${label} needs review count mismatch`);
  assert(Array.isArray(payload.previewItems) && payload.previewItems.length === 8, `${label} preview items mismatch`);
  assert(payload.workbenchFacts?.storyFlow?.shots?.[0]?.storyFunction?.includes("Mika"), `${label} should read 005 story facts`);
  assert(payload.workbenchFacts?.visualMemory?.assets?.some((asset) => asset.id === "char_mika"), `${label} should read 005 visual memory`);
  assert(!JSON.stringify(payload.workbenchFacts).includes("char_naya"), `${label} must not leak 004 visual memory`);
  assertProjectProjectionFacts(payload, label, project005Root, project005TruthPath);
}

function assertCurrent004(payload, label) {
  assert(payload.ok === true, `${label} should be ok`);
  assertCurrentBindingContext(payload, label, project004Root, project004Id);
  assert(payload.previewStatus === "blocked", `${label} should read 004 projection`);
  assert(payload.returnedImageCount === 4, `${label} should count only existing 004 outputs`);
  assert(payload.blockerCount === 8, `${label} should project blocked 004 shots`);
  assert(payload.workbenchFacts?.storyFlow?.shots?.[0]?.storyFunction?.includes("Naya"), `${label} should read 004 story facts`);
  assert(payload.workbenchFacts?.visualMemory?.assets?.some((asset) => asset.id === "char_naya"), `${label} should read 004 visual memory`);
  assert(!JSON.stringify(payload.workbenchFacts).includes("char_mika"), `${label} must not leak 005 visual memory`);
  assertProjectProjectionFacts(payload, label, project004Root, project004TruthPath);
  assert(!JSON.stringify(payload).includes(project005Id), `${label} must not mix in 005 project identity`);
}

function assertCurrentRound5(payload, label) {
  return assertCurrentRound5WithOptions(payload, label, {});
}

function assertCurrentRound5WithOptions(payload, label, options) {
  const strictZp05Ready = options.strictZp05Ready === true;
  const strictZp05Returned = options.strictZp05Returned === true;
  assert(payload.ok === true, `${label} should be ok`);
  assertCurrentBindingContext(payload, label, round5Root, round5ProjectId);
  assert(payload.status === "blocked", `${label} top-level status should follow Round 5 gates`);
  assert(payload.previewStatus === "blocked", `${label} preview status should follow Round 5 gates`);
  assert(payload.productionStatus === "blocked", `${label} production status should follow Round 5 gates`);
  assert(payload.plannedImageCount === 6, `${label} planned image count should come from Round 5 gates`);
  assert(payload.returnedImageCount === 6, `${label} returned image count should come from observed starts`);
  assert(payload.blockerCount >= 3, `${label} blocker count should include Round 5 gate actions`);
  assert(payload.nextAction === "round5_artifact_gates_require_review", `${label} nextAction should point to Round 5 artifact gates`);
  assert(typeof payload.reportPath === "string" && payload.reportPath.length > 0, `${label} should expose a primary report`);
  assert(payload.image2ReportPath === round5ReportPath, `${label} compatibility report path should be Round 5 report`);
  assert(payload.projectionSource === "round5_full_real_chain_report_fallback", `${label} should use Round 5 report fallback without 004/005 truth layers`);
  assert(payload.round5ArtifactIngest?.schemaVersion === "0.1.0", `${label} missing round5ArtifactIngest`);
  assert(Array.isArray(payload.round5ArtifactIngest.shotGateMatrix), `${label} shotGateMatrix missing`);
  assert(payload.round5ArtifactIngest.shotGateMatrix.length === 6, `${label} shotGateMatrix count mismatch`);
  assert(payload.round5ArtifactIngest.ledgerProjection?.completeVerified === 0, `${label} completeVerified must stay 0`);
  assert(payload.round5ArtifactIngest.uiSummary?.providerCalled === strictZp05Returned, `${label} providerCalled projection mismatch`);
  assert(payload.round5ArtifactIngest.uiSummary?.generatedImages === strictZp05Returned, `${label} generatedImages projection mismatch`);
  assert(payload.round5ArtifactIngest.uiSummary?.completeVerified === false, `${label} uiSummary must not mark complete verified`);
  assert(payload.round5ArtifactIngest.isolation?.noProjectVibeMutation === true, `${label} isolation must forbid project.vibe mutation`);
  assert(payload.round5ArtifactIngest.isolation?.sidecarOnlyImageTransport === true, `${label} isolation must require sidecar transport`);
  assert(payload.providerCalled === false, `${label} status read must not call provider`);
  assert(payload.projectVibeWritten === false, `${label} top-level projectVibeWritten must stay false`);

  const byShot = new Map(payload.round5ArtifactIngest.shotGateMatrix.map((shot) => [shot.shotId, shot]));
  const zp04 = byShot.get("ZP04");
  assert(zp04?.nextAction === "regenerate_start_frame", `${label} ZP04 should require start regeneration`);
  assert(zp04?.gateStatus === "start_regeneration_required", `${label} ZP04 gate status mismatch`);
  assert(zp04?.ledgerStatus === "parked", `${label} ZP04 should be parked`);
  assert(zp04?.blockers?.includes("start_motion_affordance_failed"), `${label} ZP04 start regeneration blocker missing`);

  const zp05 = byShot.get("ZP05");
  assert(zp05?.strictEditPilotCandidate === true, `${label} ZP05 should be strict edit pilot candidate`);
  if (strictZp05Returned) {
    assert(zp05?.gateStatus === "end_returned_needs_review", `${label} ZP05 end return status mismatch`);
    assert(zp05?.ledgerStatus === "needs_review", `${label} ZP05 should require end review`);
    assert(zp05?.nextAction === "review_strict_edit_end_frame", `${label} ZP05 nextAction should review returned end`);
    assert(zp05?.endExists === true, `${label} ZP05 end frame should exist`);
  } else if (strictZp05Ready) {
    assert(zp05?.gateStatus === "end_edit_preflight_ready", `${label} ZP05 should be strict edit preflight ready`);
    assert(zp05?.ledgerStatus === "waiting_output", `${label} ZP05 should wait for strict edit output`);
    assert(zp05?.nextAction === "submit_strict_image_edit", `${label} ZP05 nextAction should submit strict image edit`);
    assert(zp05?.approvedStartFrameRef === "shots/ZP05/start.png", `${label} ZP05 approved start ref missing`);
    assert(zp05?.editableRegionEvidenceRef === "shots/ZP05/editable_region_mask_or_bbox.json", `${label} ZP05 editable region ref missing`);
    assert(zp05?.providerEditReceiptRef === "shots/ZP05/provider_edit_receipt.json", `${label} ZP05 provider edit receipt ref missing`);
  } else {
    assert(zp05?.gateStatus === "end_edit_preflight_blocked", `${label} ZP05 end edit preflight should be blocked`);
    assert(zp05?.nextAction === "collect_strict_edit_provenance", `${label} ZP05 nextAction mismatch`);
  }

  const zp02 = byShot.get("ZP02");
  assert(zp02?.gateStatus === "end_edit_preflight_blocked", `${label} ZP02 end edit preflight should be blocked`);
  assert(zp02?.nextAction === "collect_strict_edit_provenance", `${label} ZP02 nextAction mismatch`);
  assert(
    payload.round5ArtifactIngest.ledgerProjection?.endEditPreflightBlocked === (strictZp05Ready || strictZp05Returned ? 1 : 2),
    `${label} end edit preflight blocked count mismatch`,
  );
  assert(
    payload.round5ArtifactIngest.ledgerProjection?.endEditPreflightReady === (strictZp05Ready ? 1 : 0),
    `${label} end edit preflight ready count mismatch`,
  );
  assert(
    (payload.round5ArtifactIngest.ledgerProjection?.endReturnedNeedsReview || 0) === (strictZp05Returned ? 1 : 0),
    `${label} end returned needs_review count mismatch`,
  );
}

function assertRound5Zp05StrictEditSidecarsPrepared(payload, label) {
  const report = JSON.parse(readFileSync(round5ReportPath, "utf8"));
  const startFrame = report.generatedStartFrames.find((item) => item.shotId === "ZP05");
  assert(startFrame?.sha256, "Round 5 ZP05 start sha missing");
  assert(payload.ok === true, `${label} should be ok`);
  assert(payload.status === "prepared", `${label} status mismatch`);
  assert(payload.strictEditPreflightPrepareRan === true, `${label} should record the sidecar prepare`);
  assert(payload.providerCalled === false, `${label} must not call provider`);
  assert(payload.prepareRan === false, `${label} must not run provider prepare`);
  assert(payload.projectVibeWritten === false, `${label} must not write project.vibe`);
  assert(payload.liveSubmitAllowed === false, `${label} must not allow live submit`);
  assert(payload.videoSubmitted === false, `${label} must not submit video`);
  assert(payload.workerSpawnForbidden === true, `${label} must forbid worker spawn`);
  assert(payload.ignoredInputSha256 === "sha256_from_request_ignored", `${label} should ignore request sha`);
  assert(payload.shotGate?.gateStatus === "end_edit_preflight_ready", `${label} response shot gate should be ready`);
  assert(payload.shotGate?.nextAction === "submit_strict_image_edit", `${label} response nextAction mismatch`);
  for (const sidecarPath of round5Zp05StrictEditPreflightSidecars) {
    assert(existsSync(sidecarPath), `${label} missing sidecar ${sidecarPath}`);
  }
  const approved = JSON.parse(readFileSync(round5Zp05StrictEditPreflightSidecars[0], "utf8"));
  const editable = JSON.parse(readFileSync(round5Zp05StrictEditPreflightSidecars[1], "utf8"));
  const receipt = JSON.parse(readFileSync(round5Zp05StrictEditPreflightSidecars[2], "utf8"));
  assert(approved.approvalStatus === "approved", `${label} approved status mismatch`);
  assert(approved.sha256 === startFrame.sha256, `${label} approved sha should come from report`);
  assert(approved.sourceStartFrameSha256 === startFrame.sha256, `${label} approved source sha should come from report`);
  assert(approved.providerAttachmentId, `${label} provider attachment id missing`);
  assert(editable.sourceStartFrameSha256 === startFrame.sha256, `${label} editable sha should come from report`);
  assert(editable.qaStatus === "pass", `${label} editable QA status mismatch`);
  assert(editable.status === "ready", `${label} editable status mismatch`);
  assert(editable.bboxNormalized?.x === 0.42, `${label} default bbox should be written`);
  assert(receipt.operation === "image.edit", `${label} receipt operation mismatch`);
  assert(receipt.status === "ready_for_provider_edit", `${label} receipt status mismatch`);
  assert(receipt.sourceStartFrameSha256 === startFrame.sha256, `${label} receipt sha should come from report`);
  assert(receipt.sourceStartFrameAttachmentId === approved.providerAttachmentId, `${label} receipt attachment should match approved start`);
  assert(receipt.noFallbackUsed === true, `${label} receipt noFallbackUsed mismatch`);
  assert(receipt.providerCalled === false, `${label} receipt must not call provider`);
}

function writeStoryFlowFactSourceFixture() {
  rmSync(storyFlowFactSourceRoot, { recursive: true, force: true });
  mkdirSync(path.join(storyFlowFactSourceRoot, "project", "story_flow"), { recursive: true });
  const canonicalStoryFlow = {
    schemaVersion: "story_flow_fact_source_sidecar_v1",
    shots: [
      {
        id: "SF01",
        sceneId: "scene_fact_source",
        roleIds: ["char_fact_source"],
        action: "Canonical sidecar Story Flow wins over legacy and runtime cache traps.",
      },
    ],
  };
  const legacyStoryFlow = {
    schemaVersion: "story_flow_legacy_compat_v1",
    shots: [
      {
        id: "LEGACY_SHOULD_ONLY_WIN_AFTER_SIDECAR_REMOVAL",
        sceneId: "scene_legacy",
        action: "Legacy project/story_flow.json is compatibility fallback only.",
      },
    ],
  };
  const runtimeTrap = {
    storyFlow: {
      shots: [
        {
          id: "RUNTIME_SHOULD_NOT_WIN",
          action: "runtime-state.json is a derived cache and must not authorize current-project Story Flow.",
        },
      ],
    },
  };
  writeFileSync(storyFlowFactSourceProjectVibePath, `${JSON.stringify({
    schemaVersion: "project_vibe_story_flow_fact_source_test",
    projectId: "story_flow_fact_source_test",
    runId: "story_flow_fact_source_test_run",
    factFiles: [
      {
        id: "story_flow",
        role: "story_flow",
        path: "story_flow/story_flow.vibe.json",
        sourceOfTruth: "project_file",
        hash: "fixture_hash_not_validated_by_runtime_read_projection",
      },
    ],
    runtimeStateRole: "derived_cache",
  }, null, 2)}\n`, "utf8");
  writeFileSync(storyFlowFactSourceSidecarPath, `${JSON.stringify(canonicalStoryFlow, null, 2)}\n`, "utf8");
  writeFileSync(path.join(storyFlowFactSourceRoot, "project", "story_flow.json"), `${JSON.stringify(legacyStoryFlow, null, 2)}\n`, "utf8");
  writeFileSync(path.join(storyFlowFactSourceRoot, "runtime-state.json"), `${JSON.stringify(runtimeTrap, null, 2)}\n`, "utf8");
  writeFileSync(path.join(storyFlowFactSourceRoot, "project", "runtime-state.json"), `${JSON.stringify(runtimeTrap, null, 2)}\n`, "utf8");
  writeFileSync(path.join(storyFlowFactSourceRoot, "project", "source_index.json"), `${JSON.stringify({
    sourceIndexHash: "story_flow_fact_source_hash",
    refs: ["story_flow/story_flow.vibe.json", "story_flow.json"],
  }, null, 2)}\n`, "utf8");
  writeFileSync(path.join(storyFlowFactSourceRoot, "project", "visual_memory.json"), `${JSON.stringify({
    assets: [
      { id: "char_fact_source", type: "character", name: "Fact Source Character", status: "locked" },
    ],
  }, null, 2)}\n`, "utf8");
  writeFileSync(path.join(storyFlowFactSourceRoot, "run_manifest.json"), `${JSON.stringify({
    projectId: "story_flow_fact_source_test",
    runId: "story_flow_fact_source_test_run",
    status: "ready",
    shotPlans: [],
  }, null, 2)}\n`, "utf8");
}

async function assertStoryFlowFactSourceProjection(baseUrl) {
  writeStoryFlowFactSourceFixture();
  const projectVibeBefore = statSync(storyFlowFactSourceProjectVibePath).mtimeMs;
  const selected = await selectProject(baseUrl, storyFlowFactSourceProjectRoot, "story_flow_fact_source_test", "Story Flow fact source");
  assert(selected.response.status === 200, "Story Flow fact source project should bind");
  assert(selected.payload.projectVibeWritten === false, "Story Flow fact source select must not write project.vibe");

  const sidecarStatus = await fetchJson(`${baseUrl}/api/runtime/projects/current/real-chain/status`);
  assert(sidecarStatus.response.status === 200, "Story Flow sidecar status should return 200");
  const sidecarStory = sidecarStatus.payload.workbenchFacts?.storyFlow;
  assert(sidecarStory?.shots?.[0]?.id === "SF01", "project.vibe-declared Story Flow sidecar must win");
  assert(sidecarStory?.sourceRole === "canonical_project_store_sidecar", "Story Flow sidecar source role mismatch");
  assert(sidecarStory?.factSourceRole === "project_vibe_declared_story_flow", "Story Flow fact source role mismatch");
  assert(sidecarStory?.sourceOfTruth === "project_file", "Story Flow source of truth must be project_file");
  assert(sidecarStory?.runtimeStateRole === "derived_cache", "runtime-state role must remain derived_cache");
  assert(sidecarStory?.runtimeStateUsed === false, "Story Flow projection must not read runtime-state");
  assert(sidecarStory?.runtimeStateMayOverride === false, "runtime-state must not override Story Flow facts");
  assert(sidecarStory?.compatibilityFallbackUsed === false, "sidecar path must not report compatibility fallback");
  assert(sidecarStory?.path === `${storyFlowFactSourceProjectRoot}/project/story_flow/story_flow.vibe.json`, "Story Flow sidecar path mismatch");
  assert(!JSON.stringify(sidecarStory).includes("RUNTIME_SHOULD_NOT_WIN"), "runtime-state Story Flow trap must not appear in sidecar projection");
  assert(!JSON.stringify(sidecarStory).includes("LEGACY_SHOULD_ONLY_WIN"), "legacy Story Flow trap must not appear while sidecar exists");
  assert(statSync(storyFlowFactSourceProjectVibePath).mtimeMs === projectVibeBefore, "Story Flow sidecar read must not mutate project.vibe");

  rmSync(storyFlowFactSourceSidecarPath, { force: true });
  const fallbackStatus = await fetchJson(`${baseUrl}/api/runtime/projects/current/real-chain/status`);
  assert(fallbackStatus.response.status === 200, "Story Flow fallback status should return 200");
  const fallbackStory = fallbackStatus.payload.workbenchFacts?.storyFlow;
  assert(fallbackStory?.shots?.[0]?.id === "LEGACY_SHOULD_ONLY_WIN_AFTER_SIDECAR_REMOVAL", "legacy story_flow.json must be compatibility fallback");
  assert(fallbackStory?.sourceRole === "compatibility_fallback", "legacy Story Flow source role mismatch");
  assert(fallbackStory?.factSourceRole === "legacy_project_story_flow_json", "legacy Story Flow fact role mismatch");
  assert(fallbackStory?.compatibilityFallbackUsed === true, "legacy Story Flow path must report compatibility fallback");
  assert(fallbackStory?.runtimeStateUsed === false, "legacy fallback must still ignore runtime-state");
  assert(!JSON.stringify(fallbackStory).includes("RUNTIME_SHOULD_NOT_WIN"), "runtime-state Story Flow trap must not appear in fallback projection");
  assert(statSync(storyFlowFactSourceProjectVibePath).mtimeMs === projectVibeBefore, "Story Flow fallback read must not mutate project.vibe");
}

function assertRound5Zp05StrictEditReturned(payload, label) {
  assert(payload.ok === true, `${label} should be ok`);
  assert(payload.status === "strict_edit_end_returned_needs_review", `${label} status mismatch`);
  assert(payload.providerCalled === true, `${label} should preserve actual provider return`);
  assert(payload.actualImage2Triggered === true, `${label} should preserve actual Image2 trigger`);
  assert(payload.prepareRan === false, `${label} must not run provider prepare`);
  assert(payload.projectVibeWritten === false, `${label} must not write project.vibe`);
  assert(payload.liveSubmitAllowed === false, `${label} must not allow live submit`);
  assert(payload.videoSubmitted === false, `${label} must not submit video`);
  assert(payload.workerSpawnForbidden === true, `${label} must forbid worker spawn`);
  assert(payload.shotGate?.gateStatus === "end_returned_needs_review", `${label} shot gate should show returned end`);
  assert(payload.shotGate?.nextAction === "review_strict_edit_end_frame", `${label} nextAction should be review`);
  for (const sidecarPath of round5Zp05StrictEditReturnSidecars) {
    assert(existsSync(sidecarPath), `${label} missing return artifact ${sidecarPath}`);
  }
  const providerObservation = JSON.parse(readFileSync(round5Zp05StrictEditReturnSidecars[0], "utf8"));
  const semanticQa = JSON.parse(readFileSync(round5Zp05StrictEditReturnSidecars[1], "utf8"));
  const pairQa = JSON.parse(readFileSync(round5Zp05StrictEditReturnSidecars[2], "utf8"));
  assert(providerObservation.providerObservationMode === "actual_provider_call_observed", `${label} provider observation mode mismatch`);
  assert(providerObservation.operation === "image.edit", `${label} provider observation operation mismatch`);
  assert(providerObservation.providerRequestId === "provider-request-round5-zp05-test", `${label} provider request id missing`);
  assert(providerObservation.providerCalled === true, `${label} provider observation should mark providerCalled`);
  assert(providerObservation.actualImage2Triggered === true, `${label} provider observation should mark actual trigger`);
  assert(semanticQa.semanticReviewMode === "actual_image_semantic_review", `${label} semantic QA mode mismatch`);
  assert(semanticQa.status === "needs_review", `${label} semantic QA status mismatch`);
  assert(pairQa.status === "needs_review", `${label} pair QA status mismatch`);
  assert(pairQa.completeVerified === false, `${label} pair QA must not complete verify`);
}

function writeRound5Zp05LooseStatusTrapSidecars() {
  const approved = JSON.parse(readFileSync(round5Zp05StrictEditPreflightSidecars[0], "utf8"));
  const editable = JSON.parse(readFileSync(round5Zp05StrictEditPreflightSidecars[1], "utf8"));
  const receipt = JSON.parse(readFileSync(round5Zp05StrictEditPreflightSidecars[2], "utf8"));
  writeFileSync(round5Zp05StrictEditPreflightSidecars[0], JSON.stringify({
    ...approved,
    approvalStatus: "unapproved",
  }, null, 2), "utf8");
  writeFileSync(round5Zp05StrictEditPreflightSidecars[1], JSON.stringify({
    ...editable,
    qaStatus: "not_ready",
    status: "not_ready",
  }, null, 2), "utf8");
  writeFileSync(round5Zp05StrictEditPreflightSidecars[2], JSON.stringify({
    ...receipt,
    status: "not_ready",
    operation: "fake_image.edit_wrapper",
  }, null, 2), "utf8");
}

function cleanupRound5Zp05StrictEditSidecars() {
  for (const filePath of round5Zp05StrictEditSidecars) rmSync(filePath, { force: true });
  rmSync(`${round5Root}/external_provider_returns/ZP05/end.png`, { force: true });
}

function assertImage2Batch005(payload, label) {
  assert(payload.ok === true, `${label} should be ok`);
  assert(payload.projectionKind === "current_project_image2_batch_prepare_plan", `${label} projection kind mismatch`);
  assertCurrentBindingContext(payload, label, project005Root, project005Id);
  assert(payload.submitPolicy?.providerCallAllowed === false, `${label} provider calls must be disallowed`);
  assert(payload.submitPolicy?.dryRunOnly === true, `${label} should be dry-run only`);
  assert(payload.providerCalled === false, `${label} must not call provider`);
  assert(payload.prepareRan === false, `${label} must not run prepare`);
  assert(payload.liveSubmitAllowed === false, `${label} live submit must not be allowed`);
  assert(Array.isArray(payload.items) && payload.items.length === 8, `${label} items mismatch`);
  assert(payload.summary?.plannedCount === 8, `${label} planned count mismatch`);
  assert(payload.summary?.returnedCount === 8, `${label} returned count mismatch`);
  assert(payload.summary?.reviewCount === 2, `${label} review count mismatch`);
  assert(payload.ledgerProjection?.summary?.completeVerified === 0, `${label} ledger must not complete verify from read-only batch plan`);
  assert(payload.ledgerProjection?.summary?.reviewNeeded === 0, `${label} ledger must keep review promotion out of read-only batch plan`);
  assert(payload.ledgerProjection?.summary?.parked === 8, `${label} ledger should park current batch items until promotion evidence exists`);
  assert(payload.items.every((item) => item.taskRunId.includes("real_demo_005")), `${label} must use 005 task ids`);
}

function assertImage2Batch004(payload, label) {
  assert(payload.ok === true, `${label} should be ok`);
  assert(payload.projectionKind === "current_project_image2_batch_prepare_plan", `${label} projection kind mismatch`);
  assertCurrentBindingContext(payload, label, project004Root, project004Id);
  assert(payload.summary?.plannedCount === 8, `${label} planned count mismatch`);
  assert(payload.summary?.returnedCount === 4, `${label} returned count mismatch`);
  assert(payload.summary?.blockedCount === 8, `${label} blocked count mismatch`);
  assert(payload.ledgerProjection?.summary?.parked === 8, `${label} should park blocked 004 ledger items`);
  assert(payload.items.every((item) => item.taskRunId.includes("real_demo_004")), `${label} must use 004 task ids`);
  assert(!JSON.stringify(payload).includes(project005Id), `${label} must not mix in 005 project identity`);
}

const tempRoot = mkdtempSync(path.join(tmpdir(), "vibe-runtime-api-test-"));
const bindingPath = path.join(tempRoot, "current-project.local.json");
const outsideRoot = path.join(tempRoot, "outside-project");
const outsideFile = path.join(tempRoot, "outside-file.txt");
const repoSymlinkRoot = "real-test-sandbox/current-project-runtime-boundary-link";
const repoSymlinkFile = `${project004Root}/runtime-boundary-file-link.txt`;
const missingRefsRoot = "real-test-sandbox/current-project-one-shot-missing-refs-test";
const missingRefsVibePath = `${missingRefsRoot}/project/project.vibe`;

function writeJson(filePath, payload) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function fixtureShotIds(count) {
  return Array.from({ length: count }, (_, index) => `S${String(index + 1).padStart(2, "0")}`);
}

function writeFixtureBytes(filePath, label) {
  const bytes = Buffer.from(label);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, bytes);
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function demoExpectedOutputPath(root, shotId) {
  return `${root}/generated/${shotId}/start.png`;
}

function writeDemoProjectFixture({
  root,
  projectId,
  runId,
  leadCharacterId,
  leadCharacterName,
  supportCharacterId,
  sceneId,
  styleId,
  taskPrefix,
  returnedCount,
  reviewShotIds,
  storyKeyword,
}) {
  const shotIds = fixtureShotIds(8);
  const reviewSet = new Set(reviewShotIds);
  rmSync(root, { recursive: true, force: true });
  mkdirSync(`${root}/project`, { recursive: true });

  writeJson(`${root}/project/project.vibe`, {
    schemaVersion: "project_vibe_local_runtime_fixture_v1",
    projectId,
    runId,
    title: projectId.replace(/_/g, " "),
    roleIds: [leadCharacterId, supportCharacterId],
    sceneIds: [sceneId, `${sceneId}_alt`],
    styleId,
  });
  writeJson(`${root}/project/source_index.json`, {
    schemaVersion: "source_index_local_runtime_fixture_v1",
    sourceIndexHash: `fixture-${projectId}`,
    refs: [
      "project/project.vibe",
      "project/story_flow.json",
      "project/visual_memory.json",
      "run_manifest.json",
      "reports/runtime_truth_layer.json",
      "reports/preview_plan.json",
    ],
  });
  writeJson(`${root}/project/story_flow.json`, {
    schemaVersion: "story_flow_local_runtime_fixture_v1",
    shots: shotIds.map((shotId, index) => ({
      id: shotId,
      sceneId,
      roleIds: [leadCharacterId],
      title: `${storyKeyword} ${shotId}`,
      storyFunction: `${storyKeyword} keeps the creator-facing fixture stable for ${shotId}.`,
      action: `${storyKeyword} performs fixture action ${index + 1}.`,
    })),
  });
  writeJson(`${root}/project/visual_memory.json`, {
    schemaVersion: "visual_memory_local_runtime_fixture_v1",
    roles: [
      {
        id: leadCharacterId,
        displayName: leadCharacterName,
        status: "locked",
        path: `${root}/references/${leadCharacterId}.png`,
        usedByShotIds: shotIds,
      },
      {
        id: supportCharacterId,
        displayName: "Support fixture role",
        status: "locked",
        path: `${root}/references/${supportCharacterId}.png`,
        usedByShotIds: ["S03", "S04"],
      },
    ],
    scenes: [
      {
        id: sceneId,
        displayName: "Primary fixture scene",
        status: "locked",
        path: `${root}/references/${sceneId}.png`,
        usedByShotIds: shotIds,
      },
      {
        id: `${sceneId}_alt`,
        displayName: "Secondary fixture scene",
        status: "candidate",
        path: `${root}/references/${sceneId}_alt.png`,
      },
    ],
    props: [
      {
        id: `${projectId}_prop_a`,
        displayName: "Fixture prop A",
        status: "locked",
        path: `${root}/references/${projectId}_prop_a.png`,
      },
      {
        id: `${projectId}_prop_b`,
        displayName: "Fixture prop B",
        status: "needs_review",
        path: `${root}/references/${projectId}_prop_b.png`,
      },
    ],
    style: {
      id: styleId,
      displayName: "Locked fixture style",
      status: "locked",
      path: `${root}/references/${styleId}.png`,
    },
  });

  const shotPlans = shotIds.map((shotId, index) => {
    const expectedOutputPath = demoExpectedOutputPath(root, shotId);
    const providerObservationPath = `${root}/provider_observations/${shotId}_start_provider_observation.json`;
    const semanticQaPath = `${root}/semantic_qa/${shotId}_start_semantic_qa.json`;
    const promptPath = `${root}/prompt_requests/${shotId}_start_frame_prompt.md`;
    mkdirSync(path.dirname(promptPath), { recursive: true });
    writeFileSync(promptPath, `${storyKeyword} start-frame prompt for ${shotId}.\n`, "utf8");
    return {
      shotId,
      taskRunId: `task_run_${taskPrefix}_${shotId.toLowerCase()}`,
      taskPacketId: `task_packet_${taskPrefix}_${shotId.toLowerCase()}`,
      envelopeId: `subagent_envelope_${taskPrefix}_${shotId.toLowerCase()}`,
      expectedOutputPath,
      providerObservationPath,
      semanticQaPath,
      promptPath,
      queueOrder: index + 1,
    };
  });

  writeJson(`${root}/run_manifest.json`, {
    schemaVersion: "run_manifest_local_runtime_fixture_v1",
    projectId,
    runId,
    status: "blocked",
    shotPlans,
  });

  const returnedShotIds = new Set(shotIds.slice(0, returnedCount));
  for (const shotPlan of shotPlans) {
    if (!returnedShotIds.has(shotPlan.shotId)) continue;
    const outputSha256 = writeFixtureBytes(shotPlan.expectedOutputPath, `${projectId} ${shotPlan.shotId} returned start`);
    writeJson(shotPlan.providerObservationPath, {
      schemaVersion: "provider_observation_local_runtime_fixture_v1",
      provider: "openai-image2-api",
      providerObservationMode: "actual_provider_call_observed",
      outputPath: shotPlan.expectedOutputPath,
      outputSha256,
      providerCalled: true,
      actualImage2Triggered: true,
    });
    writeJson(shotPlan.semanticQaPath, {
      schemaVersion: "semantic_qa_local_runtime_fixture_v1",
      semanticReviewMode: "actual_image_semantic_review",
      status: reviewSet.has(shotPlan.shotId) ? "needs_review" : "pass",
      finalAssessment: {
        status: reviewSet.has(shotPlan.shotId) ? "needs_review" : "pass",
      },
    });
  }

  const reportObservations = shotPlans.map((shotPlan, index) => {
    const returned = returnedShotIds.has(shotPlan.shotId);
    const needsReview = reviewSet.has(shotPlan.shotId);
    return {
      order: index + 1,
      shotId: shotPlan.shotId,
      sceneId,
      roleIds: [leadCharacterId],
      expectedOutputPath: shotPlan.expectedOutputPath,
      providerObservationPath: shotPlan.providerObservationPath,
      semanticQaPath: shotPlan.semanticQaPath,
      previewQaStatus: needsReview ? "needs_review" : returned ? "pass" : "missing",
      productionQaStatus: needsReview ? "needs_review" : "blocked",
      reviewOverlay: needsReview,
      blockers: [`${shotPlan.shotId}: manual promotion evidence still required`],
    };
  });
  writeJson(`${root}/reports/image2_start_long_chain_report.json`, {
    schemaVersion: "image2_start_long_chain_report_local_runtime_fixture_v1",
    status: "blocked",
    previewStatus: "blocked",
    productionStatus: "blocked",
    reviewOverlayShots: reviewShotIds,
    productionNeedsReviewShots: reviewShotIds,
    observations: reportObservations,
  });
  writeJson(`${root}/reports/runtime_truth_layer.json`, {
    schemaVersion: "runtime_truth_layer_local_runtime_fixture_v1",
    status: "blocked",
    items: shotPlans.map((shotPlan) => ({
      shotId: shotPlan.shotId,
      status: "blocked",
      expectedOutputPath: shotPlan.expectedOutputPath,
      providerObservationPath: shotPlan.providerObservationPath,
      semanticQaPath: shotPlan.semanticQaPath,
      blockers: [`${shotPlan.shotId}: promotion gate locked for fixture`],
    })),
  });
  writeJson(`${root}/reports/preview_plan.json`, {
    schemaVersion: "preview_plan_local_runtime_fixture_v1",
    status: "blocked",
    previewStatus: "blocked",
    productionStatus: "blocked",
    reviewOverlayShots: reviewShotIds,
    clips: shotPlans.map((shotPlan, index) => {
      const returned = returnedShotIds.has(shotPlan.shotId);
      const needsReview = reviewSet.has(shotPlan.shotId);
      return {
        shotId: shotPlan.shotId,
        order: index + 1,
        mediaPath: shotPlan.expectedOutputPath,
        status: needsReview ? "returned_with_review_overlay" : returned ? "returned" : "blocked",
        previewQaStatus: needsReview ? "needs_review" : returned ? "pass" : "missing",
        productionQaStatus: needsReview ? "needs_review" : "blocked",
      };
    }),
  });
}

function prepareLocalRuntimeApiFixtures() {
  rmSync(localRuntimeFixtureRoot, { recursive: true, force: true });
  writeDemoProjectFixture({
    root: project004Root,
    projectId: project004Id,
    runId: "real_demo_e2e_004_image2_start_frames_run_20260507",
    leadCharacterId: "char_naya",
    leadCharacterName: "Naya",
    supportCharacterId: "char_004_support",
    sceneId: "scene_004_studio",
    styleId: "style_004_locked",
    taskPrefix: "real_demo_004",
    returnedCount: 4,
    reviewShotIds: [],
    storyKeyword: "Naya",
  });
  writeDemoProjectFixture({
    root: project005Root,
    projectId: project005Id,
    runId: "real_demo_e2e_005_anime_image2_start_frames_run_20260507",
    leadCharacterId: "char_mika",
    leadCharacterName: "Mika",
    supportCharacterId: "char_005_support",
    sceneId: "scene_005_arcade",
    styleId: "style_005_locked",
    taskPrefix: "real_demo_005",
    returnedCount: 8,
    reviewShotIds: ["S07", "S08"],
    storyKeyword: "Mika",
  });
}

function writeRound5FixtureStart(shotId) {
  const startPath = `${round5Root}/shots/${shotId}/start.png`;
  const bytes = Buffer.from(`local runtime round5 fixture start ${shotId}`);
  mkdirSync(path.dirname(startPath), { recursive: true });
  writeFileSync(startPath, bytes);
  return {
    shotId,
    startFramePath: `shots/${shotId}/start.png`,
    exists: true,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    status: "generated",
  };
}

function prepareRound5LocalRuntimeFixture() {
  rmSync(round5Root, { recursive: true, force: true });
  mkdirSync(`${round5Root}/project`, { recursive: true });
  writeJson(round5VibePath, {
    schemaVersion: "project_vibe_local_runtime_round5_fixture_v1",
    projectId: round5ProjectId,
    runId: "run-2026-05-13T14-12-42-615Z",
    title: "Round 5 artifact ingest fixture",
  });
  writeJson(`${round5Root}/project/source_index.json`, {
    schemaVersion: "source_index_local_runtime_round5_fixture_v1",
    sourceIndexHash: "fixture-round5-local-runtime",
    refs: ["project/project.vibe.json", "reports/round5_full_real_chain_report.json"],
  });
  writeJson(`${round5Root}/project/story_flow.json`, {
    schemaVersion: "story_flow_local_runtime_round5_fixture_v1",
    shots: ["ZP01", "ZP02", "ZP03", "ZP04", "ZP05", "ZP06"].map((shotId) => ({
      id: shotId,
      sceneId: "round5_scene",
      roleIds: ["round5_signal_box"],
      storyFunction: `Round 5 strict artifact gate fixture for ${shotId}.`,
    })),
  });
  writeJson(`${round5Root}/project/visual_memory.json`, {
    schemaVersion: "visual_memory_local_runtime_round5_fixture_v1",
    roles: [{ id: "round5_signal_box", displayName: "Signal box", status: "locked" }],
    scenes: [{ id: "round5_scene", displayName: "Signal room", status: "locked" }],
    style: { id: "round5_style", displayName: "Round 5 style", status: "locked" },
  });
  writeJson(round5ReportPath, {
    schemaVersion: "round5_full_real_chain_report_v1",
    generatedAt: "2026-05-13T14:12:42.615Z",
    generatedStartFrames: ["ZP01", "ZP02", "ZP03", "ZP04", "ZP05", "ZP06"].map((shotId) => writeRound5FixtureStart(shotId)),
    shotQa: [
      { shotId: "ZP01", path: "shots/ZP01/start.png", qaStatus: "pass", startStatus: "generated", endStatus: "not_required" },
      { shotId: "ZP02", path: "shots/ZP02/start.png", qaStatus: "pass", startStatus: "generated", endStatus: "required" },
      { shotId: "ZP03", path: "shots/ZP03/start.png", qaStatus: "pass", startStatus: "generated", endStatus: "not_required" },
      { shotId: "ZP04", path: "shots/ZP04/start.png", qaStatus: "blocked", startStatus: "motion_affordance_failed", endStatus: "required" },
      {
        shotId: "ZP05",
        path: "shots/ZP05/start.png",
        qaStatus: "pass",
        startStatus: "generated",
        endStatus: "required",
        issues: ["end_frame_blocked_until_approved_start_attachment_and_edit_provenance"],
      },
      { shotId: "ZP06", path: "shots/ZP06/start.png", qaStatus: "pass", startStatus: "generated", endStatus: "not_required" },
    ],
    endFrameStage: {
      status: "blocked",
      appliesTo: ["ZP02", "ZP04", "ZP05"],
      blockers: [
        "approved_start_attachment_missing",
        "strict_image_edit_provenance_missing",
        "provider_edit_receipt_missing",
        "source_start_frame_attachment_id_missing",
        "source_start_frame_sha_not_provider_confirmed",
        "editable_region_mask_or_bbox_missing",
      ],
      verifiedAbsent: ["shots/ZP02/end.png", "shots/ZP04/end.png", "shots/ZP05/end.png"],
    },
  });
}

prepareLocalRuntimeApiFixtures();
prepareRound5LocalRuntimeFixture();
writeFileSync(outsideFile, "outside runtime boundary\n", "utf8");
rmSync(project005OneShotRoot, { recursive: true, force: true });
rmSync(missingRefsRoot, { recursive: true, force: true });
cleanupRound5Zp05StrictEditSidecars();
mkdirSync(`${missingRefsRoot}/project`, { recursive: true });
writeFileSync(missingRefsVibePath, JSON.stringify({
  schemaVersion: "project_vibe_test_v1",
  projectId: "one_shot_missing_refs",
  runId: "one_shot_missing_refs_run",
}, null, 2), "utf8");
writeFileSync(`${missingRefsRoot}/project/story_flow.json`, JSON.stringify({
  shots: [
    {
      id: "S01",
      sceneId: "scene_missing",
      roleIds: ["char_missing"],
      action: "A deliberately blocked one-shot fixture.",
    },
  ],
}, null, 2), "utf8");
writeFileSync(`${missingRefsRoot}/project/visual_memory.json`, JSON.stringify({
  roles: [
    {
      id: "char_candidate",
      displayName: "Candidate only",
      status: "candidate",
    },
  ],
  scenes: [],
  style: {
    id: "style_rejected",
    displayName: "Rejected style",
    status: "rejected",
  },
}, null, 2), "utf8");

const child = spawnRuntimeServer({
    VIBE_CORE_RUNTIME_API_PORT: "0",
    VIBE_CORE_CURRENT_PROJECT_BINDING_PATH: bindingPath,
    VIBE_CORE_CURRENT_PROJECT_ROOT: project005Root,
    VIBE_CORE_PROJECT_ROOT: project005Root,
});

try {
  const { baseUrl } = await waitForServer(child);
  const runtimeStatus = await fetchJson(`${baseUrl}/api/runtime/status`);
  assert(runtimeStatus.response.status === 200, "GET runtime status should return 200");
  assert(runtimeStatus.response.headers.get("access-control-allow-origin") !== "*", "runtime status must not use wildcard CORS");
  assert(runtimeStatus.payload.security?.originPolicy === "localhost_or_no_origin_only", "runtime status should expose local origin policy");
  assert(runtimeStatus.payload.security?.tokenRequired === false, "runtime status should expose tokenRequired=false without token env");
  assert(runtimeStatus.payload.endpoints?.currentProjectBindingEndpoint === "/api/runtime/projects/current", "runtime status should expose current project binding endpoint");
  assert(runtimeStatus.payload.endpoints?.currentProjectSelectEndpoint === "/api/runtime/projects/select", "runtime status should expose current project select endpoint");
  assert(runtimeStatus.payload.endpoints?.currentProjectRecentEndpoint === "/api/runtime/projects/recent", "runtime status should expose recent projects endpoint");
  assert(runtimeStatus.payload.endpoints?.currentProjectImage2OneShotStatusEndpoint === "/api/runtime/projects/current/image2-one-shot/status", "runtime status should expose one-shot status endpoint");
  assert(runtimeStatus.payload.endpoints?.currentProjectImage2OneShotPrepareEndpoint === "/api/runtime/projects/current/image2-one-shot/prepare", "runtime status should expose one-shot prepare endpoint");
  assert(runtimeStatus.payload.endpoints?.currentProjectImage2OneShotConfirmEndpoint === "/api/runtime/projects/current/image2-one-shot/confirm", "runtime status should expose one-shot confirm endpoint");
  assert(runtimeStatus.payload.endpoints?.currentProjectImage2OneShotPrepareTriggerEndpoint === "/api/runtime/projects/current/image2-one-shot/prepare-trigger", "runtime status should expose one-shot trigger endpoint");
  assert(runtimeStatus.payload.endpoints?.currentProjectImage2OneShotReturnEndpoint === "/api/runtime/projects/current/image2-one-shot/return", "runtime status should expose one-shot return endpoint");
  assert(runtimeStatus.payload.endpoints?.currentProjectImage2OneShotExecuteReturnEndpoint === "/api/runtime/projects/current/image2-one-shot/execute-return", "runtime status should expose one-shot execute-return endpoint");
  assert(runtimeStatus.payload.endpoints?.currentProjectRound5StrictEditPrepareEndpoint === "/api/runtime/projects/current/round5/strict-edit/prepare", "runtime status should expose Round 5 strict edit prepare endpoint");
  assert(runtimeStatus.payload.endpoints?.currentProjectRound5StrictEditReturnEndpoint === "/api/runtime/projects/current/round5/strict-edit/return", "runtime status should expose Round 5 strict edit return endpoint");

  const trustedOrigin = "http://127.0.0.1:5176";
  const trustedStatus = await fetchJson(`${baseUrl}/api/runtime/status`, {
    headers: { origin: trustedOrigin },
  });
  assert(trustedStatus.response.status === 200, "trusted localhost origin should read runtime status");
  assert(trustedStatus.response.headers.get("access-control-allow-origin") === trustedOrigin, "trusted localhost origin should be echoed");
  assert(trustedStatus.response.headers.get("access-control-allow-origin") !== "*", "trusted localhost origin must not use wildcard CORS");

  const hostileStatus = await fetchJson(`${baseUrl}/api/runtime/status`, {
    headers: { origin: "https://evil.example" },
  });
  assert(hostileStatus.response.status === 403, "hostile origin should be blocked");
  assert(hostileStatus.payload.status === "forbidden", "hostile origin status mismatch");
  assert(hostileStatus.response.headers.get("access-control-allow-origin") !== "*", "hostile origin must not receive wildcard CORS");

  const currentUnbound = await fetchJson(`${baseUrl}/api/runtime/projects/current`);
  assert(currentUnbound.response.status === 200, "GET current project binding should return 200");
  assert(currentUnbound.payload.status === "unbound", "current project should start unbound");
  assert(!existsSync(bindingPath), "test binding file should not be created before select");

  const project004VibeBeforeRecent = statSync(project004VibePath).mtimeMs;
  const project005VibeBeforeRecent = statSync(project005VibePath).mtimeMs;
  const recentUnbound = await fetchJson(`${baseUrl}/api/runtime/projects/recent`);
  assert(recentUnbound.response.status === 200, "GET recent projects should return 200");
  assert(recentUnbound.payload.ok === true, "GET recent projects should be ok");
  assert(recentUnbound.payload.providerCalled === false, "GET recent projects must not call provider");
  assert(recentUnbound.payload.prepareRan === false, "GET recent projects must not run prepare");
  assert(recentUnbound.payload.projectVibeWritten === false, "GET recent projects must not write project.vibe");
  assert(!existsSync(bindingPath), "GET recent projects must not create the runtime-local binding");
  assert(statSync(project004VibePath).mtimeMs === project004VibeBeforeRecent, "GET recent projects must not mutate 004 project.vibe");
  assert(statSync(project005VibePath).mtimeMs === project005VibeBeforeRecent, "GET recent projects must not mutate 005 project.vibe");
  assert(Array.isArray(recentUnbound.payload.choices), "GET recent projects choices missing");
  assert(recentUnbound.payload.choices.some((choice) => choice.projectRoot === project004Root), "GET recent projects should include 004");
  assert(recentUnbound.payload.choices.some((choice) => choice.projectRoot === project005Root), "GET recent projects should include 005");
  assert(recentUnbound.payload.choices.every((choice) => typeof choice.displayName === "string" && choice.displayName.length > 0), "GET recent projects choices need display names");
  assert(recentUnbound.payload.choices.every((choice) => !String(choice.projectRoot).startsWith("/")), "GET recent projects must not expose absolute project roots");
  assert(!JSON.stringify(recentUnbound.payload).includes("/Users/"), "GET recent projects must not expose sensitive absolute paths");

  for (const [label, url, init] of [
    ["GET current real-chain status", `${baseUrl}/api/runtime/projects/current/real-chain/status`, undefined],
    ["POST current real-chain run-check", `${baseUrl}/api/runtime/projects/current/real-chain/run-check`, { method: "POST" }],
    ["GET current image2 batch plan", `${baseUrl}/api/runtime/projects/current/image2-batch/plan`, undefined],
    ["POST current image2 batch run-check", `${baseUrl}/api/runtime/projects/current/image2-batch/run-check`, { method: "POST" }],
    ["GET current image2 one-shot status", `${baseUrl}/api/runtime/projects/current/image2-one-shot/status?selectedShotId=S01`, undefined],
    ["POST current image2 one-shot prepare", `${baseUrl}/api/runtime/projects/current/image2-one-shot/prepare`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ selectedShotId: "S01", selectedShotIds: ["S01"], imageCount: 1 }) }],
    ["POST current image2 one-shot confirm", `${baseUrl}/api/runtime/projects/current/image2-one-shot/confirm`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ selectedShotId: "S01", selectedShotIds: ["S01"], imageCount: 1 }) }],
    ["POST current Round 5 strict edit prepare", `${baseUrl}/api/runtime/projects/current/round5/strict-edit/prepare`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ shotId: "ZP05" }) }],
    ["POST current Round 5 strict edit return", `${baseUrl}/api/runtime/projects/current/round5/strict-edit/return`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ shotId: "ZP05" }) }],
  ]) {
    const result = await fetchJson(url, init);
    assert(result.response.status === 409, `${label} should return 409 while unbound`);
    assertUnboundPayload(result.payload, label);
  }

  const project005VibeBefore = statSync(project005VibePath).mtimeMs;
  const select005 = await selectProject(baseUrl, project005Root, project005Id, "005 anime image2");
  assert(select005.response.status === 200, "POST select 005 should return 200");
  assert(select005.payload.status === "bound", "POST select 005 should bind");
  assert(select005.payload.providerCalled === false, "POST select 005 must not call provider");
  assert(select005.payload.prepareRan === false, "POST select 005 must not run prepare");
  assert(select005.payload.projectVibeWritten === false, "POST select must not write project.vibe");
  assert(statSync(project005VibePath).mtimeMs === project005VibeBefore, "POST select 005 must not mutate project.vibe");
  assert(existsSync(bindingPath), "POST select should write runtime-local binding");
  assert(JSON.parse(readFileSync(bindingPath, "utf8")).projectRoot === project005Root, "binding file should store 005 root");

  const project005VibeBeforeStatusRead = statSync(project005VibePath).mtimeMs;
  const project005Status = await fetchJson(`${baseUrl}/api/runtime/projects/current/real-chain/status`);
  assert(project005Status.response.status === 200, "GET current status after select 005 should return 200");
  assertCurrent005(project005Status.payload, "GET current status after select 005");
  assert(statSync(project005VibePath).mtimeMs === project005VibeBeforeStatusRead, "GET current status with workbenchFacts must not mutate 005 project.vibe");

  const round5VibeBefore = statSync(round5VibePath).mtimeMs;
  const selectRound5 = await selectProject(baseUrl, round5Root, round5ProjectId, "Round 5 artifact ingest");
  assert(selectRound5.response.status === 200, "POST select Round 5 should return 200");
  assert(selectRound5.payload.status === "bound", "POST select Round 5 should bind");
  assert(selectRound5.payload.providerCalled === false, "POST select Round 5 must not call provider");
  assert(selectRound5.payload.prepareRan === false, "POST select Round 5 must not run prepare");
  assert(selectRound5.payload.projectVibeWritten === false, "POST select Round 5 must not write project.vibe");
  assert(statSync(round5VibePath).mtimeMs === round5VibeBefore, "POST select Round 5 must not mutate project.vibe");

  const round5VibeBeforeStatusRead = statSync(round5VibePath).mtimeMs;
  const round5Status = await fetchJson(`${baseUrl}/api/runtime/projects/current/real-chain/status`);
  assert(round5Status.response.status === 200, "GET current status after select Round 5 should return 200");
  assertCurrentRound5(round5Status.payload, "GET current status after select Round 5");
  assert(statSync(round5VibePath).mtimeMs === round5VibeBeforeStatusRead, "GET Round 5 status must not mutate project.vibe");

  try {
    const blockedZp04Prepare = await fetchJson(`${baseUrl}/api/runtime/projects/current/round5/strict-edit/prepare`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ shotId: "ZP04" }),
    });
    assert(blockedZp04Prepare.response.status === 409, "ZP04 strict edit prepare should fail closed");
    assert(blockedZp04Prepare.payload.status === "blocked", "ZP04 strict edit prepare status mismatch");
    assert(blockedZp04Prepare.payload.blockers.includes("start_qa_not_pass"), "ZP04 strict edit prepare should block on start QA");
    assert(blockedZp04Prepare.payload.providerCalled === false, "ZP04 strict edit prepare must not call provider");
    assert(blockedZp04Prepare.payload.projectVibeWritten === false, "ZP04 strict edit prepare must not write project.vibe");
    for (const sidecarPath of round5StrictEditSidecars("ZP04")) {
      assert(!existsSync(sidecarPath), "ZP04 strict edit prepare must not write sidecars");
    }

    const unknownShotPrepare = await fetchJson(`${baseUrl}/api/runtime/projects/current/round5/strict-edit/prepare`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ shotId: "ZP99" }),
    });
    assert(unknownShotPrepare.response.status === 409, "unknown shot strict edit prepare should fail closed");
    assert(unknownShotPrepare.payload.blockers.includes("shot_not_found"), "unknown shot blocker missing");
    assert(unknownShotPrepare.payload.providerCalled === false, "unknown shot prepare must not call provider");
    assert(unknownShotPrepare.payload.strictEditPreflightPrepareRan === false, "unknown shot prepare must not run");

    const invalidBboxPrepare = await fetchJson(`${baseUrl}/api/runtime/projects/current/round5/strict-edit/prepare`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ shotId: "ZP05", bboxNormalized: { x: 0.9, y: 0.2, width: 0.4, height: 0.2 } }),
    });
    assert(invalidBboxPrepare.response.status === 409, "invalid bbox strict edit prepare should fail closed");
    assert(invalidBboxPrepare.payload.blockers.includes("editable_bbox_invalid"), "invalid bbox blocker missing");
    assert(invalidBboxPrepare.payload.providerCalled === false, "invalid bbox prepare must not call provider");
    for (const sidecarPath of round5Zp05StrictEditPreflightSidecars) {
      assert(!existsSync(sidecarPath), "invalid bbox prepare must not write ZP05 sidecars");
    }

    const prepareStrictEdit = await fetchJson(`${baseUrl}/api/runtime/projects/current/round5/strict-edit/prepare`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ shotId: "ZP05", sourceStartFrameSha256: "request-sha-must-be-ignored" }),
    });
    assert(prepareStrictEdit.response.status === 200, "ZP05 strict edit prepare should return 200");
    assertRound5Zp05StrictEditSidecarsPrepared(prepareStrictEdit.payload, "POST ZP05 strict edit prepare");
    assert(statSync(round5VibePath).mtimeMs === round5VibeBeforeStatusRead, "ZP05 strict edit prepare must not mutate project.vibe");

    const round5StrictEditStatus = await fetchJson(`${baseUrl}/api/runtime/projects/current/real-chain/status`);
    assert(round5StrictEditStatus.response.status === 200, "GET Round 5 status with strict edit sidecars should return 200");
    assertCurrentRound5WithOptions(round5StrictEditStatus.payload, "GET Round 5 status with strict edit sidecars", {
      strictZp05Ready: true,
    });
    assert(statSync(round5VibePath).mtimeMs === round5VibeBeforeStatusRead, "GET Round 5 strict edit status must not mutate project.vibe");

    const promptOnlyStrictEdit = await fetchJson(`${baseUrl}/api/runtime/projects/current/round5/strict-edit/return`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        shotId: "ZP05",
        actualProviderReturned: false,
        providerRequestId: "prompt-only-provider-request-must-not-promote",
        providerObservation: {
          provider: "prompt-only-fixture",
          prompt: "A textual end-frame description without a returned Image2 edit artifact.",
        },
      }),
    });
    assert(promptOnlyStrictEdit.response.status === 409, "prompt-only strict edit return should fail closed");
    assert(promptOnlyStrictEdit.payload.blockers.includes("actual_provider_return_required"), "prompt-only strict edit return should require actual provider return");
    assert(promptOnlyStrictEdit.payload.blockers.includes("returned_output_missing"), "prompt-only strict edit return should require a returned output file");
    assert(promptOnlyStrictEdit.payload.providerCalled === false, "prompt-only strict edit return must not mark providerCalled");
    assert(promptOnlyStrictEdit.payload.strictEditReturnIngestRan === false, "prompt-only strict edit return must not ingest artifacts");
    for (const sidecarPath of round5Zp05StrictEditReturnSidecars) {
      assert(!existsSync(sidecarPath), `prompt-only strict edit return must not write ${sidecarPath}`);
    }
    assert(statSync(round5VibePath).mtimeMs === round5VibeBeforeStatusRead, "prompt-only strict edit return must not mutate project.vibe");

    const externalReturnedEndPath = `${round5Root}/external_provider_returns/ZP05/end.png`;
    mkdirSync(path.dirname(externalReturnedEndPath), { recursive: true });
    writeFileSync(externalReturnedEndPath, readFileSync(`${round5Root}/shots/ZP05/start.png`));
    const pathOnlyStrictEdit = await fetchJson(`${baseUrl}/api/runtime/projects/current/round5/strict-edit/return`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        shotId: "ZP05",
        actualProviderReturned: true,
        returnedOutputPath: externalReturnedEndPath,
        providerRequestId: "provider-request-round5-zp05-path-only-test",
        providerObservation: {
          provider: "openai-image2-api",
          providerObservationMode: "actual_provider_call_observed",
          operation: "image.edit",
          providerRequestId: "provider-request-round5-zp05-path-only-test",
          prompt: `Use ${round5Root}/shots/ZP05/start.png as the source image and open the control-box lid.`,
          promptOnly: true,
        },
        semanticQa: {
          finalAssessment: { status: "needs_review" },
        },
      }),
    });
    assert(pathOnlyStrictEdit.response.status === 409, "path-in-prompt strict edit return should fail closed");
    assert(pathOnlyStrictEdit.payload.blockers.includes("path_in_prompt_without_reference_attachment"), "path-in-prompt strict edit return should require an attachment receipt");
    assert(pathOnlyStrictEdit.payload.blockers.includes("prompt_only_image_edit_forbidden"), "path-in-prompt strict edit return should reject prompt-only delivery");
    assert(pathOnlyStrictEdit.payload.blockers.includes("source_reference_attachment_receipt_missing"), "path-in-prompt strict edit return should require source reference attachment receipt");
    assert(pathOnlyStrictEdit.payload.providerCalled === false, "path-in-prompt strict edit return must not mark providerCalled");
    for (const sidecarPath of round5Zp05StrictEditReturnSidecars) {
      assert(!existsSync(sidecarPath), `path-in-prompt strict edit return must not write ${sidecarPath}`);
    }

    const approved = JSON.parse(readFileSync(round5Zp05StrictEditPreflightSidecars[0], "utf8"));
    const editable = JSON.parse(readFileSync(round5Zp05StrictEditPreflightSidecars[1], "utf8"));
    const receipt = JSON.parse(readFileSync(round5Zp05StrictEditPreflightSidecars[2], "utf8"));
    const returnedEndSha256 = `sha256:${createHash("sha256").update(readFileSync(externalReturnedEndPath)).digest("hex")}`;
    const returnedStrictEdit = await fetchJson(`${baseUrl}/api/runtime/projects/current/round5/strict-edit/return`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        shotId: "ZP05",
        actualProviderReturned: true,
        returnedOutputPath: externalReturnedEndPath,
        providerRequestId: "provider-request-round5-zp05-test",
        providerObservation: {
          provider: "openai-image2-api",
          providerId: "openai-image2-api",
          providerObservationMode: "actual_provider_call_observed",
          operation: "image.edit",
          providerRequestId: "provider-request-round5-zp05-test",
          preflightReceiptId: receipt.receiptId,
          receiptId: receipt.receiptId,
          sourceStartFrameSha256: approved.sourceStartFrameSha256,
          sourceStartFrameAttachmentId: approved.providerAttachmentId,
          editableRegionEvidenceSha256: editable.evidenceSha256,
          outputSha256: returnedEndSha256,
          noFallbackUsed: true,
          promptOnly: false,
          deliveredInputKind: "input_image",
          referenceAttachmentReceipt: {
            status: "delivered",
            deliveredInputKind: "input_image",
            sourceStartFrameSha256: approved.sourceStartFrameSha256,
            sourceStartFrameAttachmentId: approved.providerAttachmentId,
            deliveredSha256: approved.sourceStartFrameSha256,
            promptOnly: false,
            acceptedByActionSchema: true,
          },
        },
        semanticQa: {
          finalAssessment: { status: "needs_review" },
        },
      }),
    });
    assert(returnedStrictEdit.response.status === 200, "ZP05 strict edit return should return 200");
    assertRound5Zp05StrictEditReturned(returnedStrictEdit.payload, "POST ZP05 strict edit return");
    assert(statSync(round5VibePath).mtimeMs === round5VibeBeforeStatusRead, "ZP05 strict edit return must not mutate project.vibe");

    const round5ReturnedStatus = await fetchJson(`${baseUrl}/api/runtime/projects/current/real-chain/status`);
    assert(round5ReturnedStatus.response.status === 200, "GET Round 5 status with strict edit return should return 200");
    assertCurrentRound5WithOptions(round5ReturnedStatus.payload, "GET Round 5 status with strict edit return", {
      strictZp05Returned: true,
    });
    assert(statSync(round5VibePath).mtimeMs === round5VibeBeforeStatusRead, "GET Round 5 returned status must not mutate project.vibe");

    writeRound5Zp05LooseStatusTrapSidecars();
    const round5LooseTrapStatus = await fetchJson(`${baseUrl}/api/runtime/projects/current/real-chain/status`);
    assert(round5LooseTrapStatus.response.status === 200, "GET Round 5 status with loose status traps should return 200");
    const looseTrapByShot = new Map(round5LooseTrapStatus.payload.round5ArtifactIngest.shotGateMatrix.map((shot) => [shot.shotId, shot]));
    const looseTrapZp05 = looseTrapByShot.get("ZP05");
    assert(looseTrapZp05?.gateStatus === "end_edit_preflight_blocked", "loose status traps must not make ZP05 ready");
    assert(looseTrapZp05?.nextAction === "collect_strict_edit_provenance", "loose status traps should keep ZP05 collecting provenance");
    for (const blocker of ["approved_start_attachment_missing", "editable_region_mask_or_bbox_missing", "provider_edit_receipt_missing", "strict_image_edit_provenance_missing"]) {
      assert(looseTrapZp05?.blockers?.includes(blocker), `loose status trap missing blocker ${blocker}`);
    }
    assert(round5LooseTrapStatus.payload.round5ArtifactIngest.ledgerProjection?.endEditPreflightReady === 0, "loose status traps must clear ready count");
    assert(statSync(round5VibePath).mtimeMs === round5VibeBeforeStatusRead, "GET Round 5 loose trap status must not mutate project.vibe");
  } finally {
    cleanupRound5Zp05StrictEditSidecars();
  }

  const reselect005 = await selectProject(baseUrl, project005Root, project005Id, "005 anime image2");
  assert(reselect005.response.status === 200, "POST reselect 005 should return 200");
  assert(reselect005.payload.status === "bound", "POST reselect 005 should bind");
  assert(reselect005.payload.providerCalled === false, "POST reselect 005 must not call provider");

  const oneShot005Status = await fetchJson(`${baseUrl}/api/runtime/projects/current/image2-one-shot/status?selectedShotId=S01`);
  assert(oneShot005Status.response.status === 200, "GET one-shot status after select 005 should return 200");
  assert(oneShot005Status.payload.status === "ready_to_prepare", "one-shot status should be ready to prepare");
  assert(oneShot005Status.payload.userLabel === "准备小样包", "one-shot status should expose creator-facing sample copy");
  assert(oneShot005Status.payload.project?.projectId === project005Id, "one-shot status should use bound 005 identity");
  assert(oneShot005Status.payload.selectedShotId === "S01", "one-shot status should preserve selected shot");
  assert(oneShot005Status.payload.expectedOutputPath.startsWith(`${project005Root}/real-trigger-one-shot/S01/`), "one-shot expected output should stay under current project sandbox");
  assert(oneShot005Status.payload.providerObservationPath.startsWith(`${project005Root}/real-trigger-one-shot/S01/`), "one-shot provider observation sidecar should stay under sandbox");
  assert(oneShot005Status.payload.semanticQaPath.startsWith(`${project005Root}/real-trigger-one-shot/S01/`), "one-shot semantic QA path should stay under sandbox");
  assert(oneShot005Status.payload.providerCalled === false, "one-shot status must not call provider");
  assert(oneShot005Status.payload.liveSubmitAllowed === false, "one-shot status must not allow live submit");
  assert(oneShot005Status.payload.projectVibeWritten === false, "one-shot status must not write project.vibe");
  assert(oneShot005Status.payload.workerSpawnForbidden === true, "one-shot status must forbid worker spawn");

  const unsupportedTransportOneShot = await fetchJson(`${baseUrl}/api/runtime/projects/current/image2-one-shot/prepare`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ selectedShotId: "S01", selectedShotIds: ["S01"], imageCount: 1, transportMode: "fast_provider_escape" }),
  });
  assert(unsupportedTransportOneShot.response.status === 200, "unsupported one-shot transport should downgrade to manual");
  assert(unsupportedTransportOneShot.payload.transportPlan?.mode === "manual", "unsupported transport must not enter the plan");
  assert(unsupportedTransportOneShot.payload.transportPlan?.transportModeAllowed === false, "unsupported transport should be recorded as not allowlisted");
  assert(unsupportedTransportOneShot.payload.transportPlan?.actualExecutionAllowed === false, "downgraded transport must stay locked");
  assert(unsupportedTransportOneShot.payload.providerCalled === false, "unsupported transport must not call provider");

  const appServerPlanOneShot = await fetchJson(`${baseUrl}/api/runtime/projects/current/image2-one-shot/prepare`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ selectedShotId: "S02", selectedShotIds: ["S02"], imageCount: 1, transportMode: "agent_app_server" }),
  });
  assert(appServerPlanOneShot.response.status === 200, "agent app-server transport plan should be selectable");
  assert(appServerPlanOneShot.payload.transportPlan?.mode === "agent_app_server", "agent app-server transport mode mismatch");
  assert(appServerPlanOneShot.payload.transportPlan?.actualExecutionAllowed === false, "agent app-server transport must stay locked");
  assert(appServerPlanOneShot.payload.providerCalled === false, "agent app-server transport plan must not call provider");

  const missingShotOneShot = await fetchJson(`${baseUrl}/api/runtime/projects/current/image2-one-shot/prepare`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ selectedShotIds: [], imageCount: 1 }),
  });
  assert(missingShotOneShot.response.status === 409, "one-shot prepare without selectedShotId should fail closed");
  assert(missingShotOneShot.payload.status === "blocked", "missing selectedShotId one-shot status should be blocked");
  assert(missingShotOneShot.payload.providerCalled === false, "missing selectedShotId must not call provider");
  assert(missingShotOneShot.payload.projectVibeWritten === false, "missing selectedShotId must not write project.vibe");
  assert(missingShotOneShot.payload.workerSpawnForbidden === true, "missing selectedShotId must not spawn worker");

  const multiShotOneShot = await fetchJson(`${baseUrl}/api/runtime/projects/current/image2-one-shot/prepare`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ selectedShotId: "S01", selectedShotIds: ["S01", "S02"], imageCount: 1 }),
  });
  assert(multiShotOneShot.response.status === 409, "one-shot prepare with multiple shots should fail closed");
  assert(multiShotOneShot.payload.blockers.some((blocker) => /exactly one selected shot/i.test(blocker)), "multi-shot blocker missing");

  const unsafePathOneShot = await fetchJson(`${baseUrl}/api/runtime/projects/current/image2-one-shot/prepare`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ selectedShotId: "S01", selectedShotIds: ["S01"], imageCount: 1, expectedOutputPath: "../outside.png" }),
  });
  assert(unsafePathOneShot.response.status === 409, "one-shot prepare with unsafe path should fail closed");
  assert(unsafePathOneShot.payload.blockers.some((blocker) => /sandbox paths?/.test(blocker) || /output path/i.test(blocker)), "unsafe path blocker missing");

  const project005VibeBeforeOneShot = statSync(project005VibePath).mtimeMs;
  const prepareOneShot = await fetchJson(`${baseUrl}/api/runtime/projects/current/image2-one-shot/prepare`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ selectedShotId: "S01", selectedShotIds: ["S01"], imageCount: 1 }),
  });
  assert(prepareOneShot.response.status === 200, "one-shot prepare should return 200 when scoped");
  assert(prepareOneShot.payload.status === "prepared", "one-shot prepare status mismatch");
  assert(prepareOneShot.payload.userLabel === "确认 handoff", "one-shot prepare should expose confirmation copy");
  assert(prepareOneShot.payload.receipt?.status === "prepared", "one-shot prepare receipt missing");
  assert(prepareOneShot.payload.receipt?.policy?.providerCalled === false, "one-shot receipt must not call provider");
  assert(prepareOneShot.payload.receipt?.policy?.liveSubmitAllowed === false, "one-shot receipt must not allow live submit");
  assert(prepareOneShot.payload.receipt?.policy?.projectVibeWritten === false, "one-shot receipt must not write project.vibe");
  assert(prepareOneShot.payload.receipt?.policy?.workerSpawnForbidden === true, "one-shot receipt must forbid worker spawn");
  assert(prepareOneShot.payload.receipt?.qaChecklist?.length >= 4, "one-shot prepare should include QA checklist");
  assert(prepareOneShot.payload.receipt?.lockedReferences?.characters?.length >= 1, "one-shot prepare should include locked character reference");
  assert(prepareOneShot.payload.receipt?.lockedReferences?.scenes?.length >= 1, "one-shot prepare should include locked scene reference");
  assert(prepareOneShot.payload.receipt?.lockedReferences?.styles?.length >= 1, "one-shot prepare should include locked style reference");
  assert(prepareOneShot.payload.persistedState?.receiptPresent === true, "one-shot prepare should persist receipt state");
  assert(existsSync(path.resolve(prepareOneShot.payload.statePaths.receiptStatePath)), "one-shot prepare receipt state file should exist");
  assert(statSync(project005VibePath).mtimeMs === project005VibeBeforeOneShot, "one-shot prepare must not mutate 005 project.vibe");

  const statusAfterPrepare = await fetchJson(`${baseUrl}/api/runtime/projects/current/image2-one-shot/status?selectedShotId=S01`);
  assert(statusAfterPrepare.response.status === 200, "one-shot status after prepare should return 200");
  assert(statusAfterPrepare.payload.status === "prepared", "one-shot status should keep persisted prepared state after refresh");
  assert(statusAfterPrepare.payload.receipt?.receiptId === prepareOneShot.payload.receipt.receiptId, "one-shot status should reload persisted receipt");

  const confirmWithoutReceipt = await fetchJson(`${baseUrl}/api/runtime/projects/current/image2-one-shot/confirm`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ selectedShotId: "S01", selectedShotIds: ["S01"], imageCount: 1 }),
  });
  assert(confirmWithoutReceipt.response.status === 409, "one-shot confirm without receipt should fail closed");
  assert(confirmWithoutReceipt.payload.blockers.some((blocker) => /receipt/i.test(blocker)), "confirm without receipt blocker missing");

  const confirmOneShot = await fetchJson(`${baseUrl}/api/runtime/projects/current/image2-one-shot/confirm`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      selectedShotId: "S01",
      selectedShotIds: ["S01"],
      imageCount: 1,
      expectedOutputPath: prepareOneShot.payload.receipt.expectedOutputPath,
      receipt: prepareOneShot.payload.receipt,
    }),
  });
  assert(confirmOneShot.response.status === 200, "one-shot confirm should return 200 with matching receipt");
  assert(confirmOneShot.payload.status === "handoff_prepared", "one-shot confirm should prepare handoff only");
  assert(confirmOneShot.payload.userLabel === "等待文件", "one-shot confirm should expose waiting file copy");
  assert(confirmOneShot.payload.handoffPacket?.status === "ready_for_manual_transport", "one-shot confirm should prepare manual transport packet");
  assert(confirmOneShot.payload.handoffPacket?.providerCalled === false, "one-shot handoff must not call provider");
  assert(confirmOneShot.payload.handoffPacket?.liveSubmitAllowed === false, "one-shot handoff must not allow live submit");
  assert(confirmOneShot.payload.handoffPacket?.workerSpawnForbidden === true, "one-shot handoff must forbid worker spawn");
  assert(confirmOneShot.payload.watcherProjection?.watcherStarted === false, "one-shot confirm must not start watcher");
  assert(confirmOneShot.payload.watcherProjection?.daemonStarted === false, "one-shot confirm must not start daemon");
  assert(confirmOneShot.payload.persistedState?.handoffPresent === true, "one-shot confirm should persist handoff state");
  assert(existsSync(path.resolve(confirmOneShot.payload.statePaths.handoffStatePath)), "one-shot handoff state file should exist");
  assert(statSync(project005VibePath).mtimeMs === project005VibeBeforeOneShot, "one-shot confirm must not mutate 005 project.vibe");

  const statusAfterConfirm = await fetchJson(`${baseUrl}/api/runtime/projects/current/image2-one-shot/status?selectedShotId=S01`);
  assert(statusAfterConfirm.response.status === 200, "one-shot status after confirm should return 200");
  assert(statusAfterConfirm.payload.status === "handoff_prepared", "one-shot status should keep persisted handoff state after refresh");
  assert(statusAfterConfirm.payload.handoffPacket?.receiptId === confirmOneShot.payload.handoffPacket.receiptId, "one-shot status should reload persisted handoff packet");

  const query004Status = await fetchJson(
    `${baseUrl}/api/runtime/projects/current/real-chain/status?projectRoot=${encodeURIComponent(project004Root)}&projectId=${encodeURIComponent(project004Id)}`,
  );
  assert(query004Status.response.status === 200, "GET current status with query override should return 200");
  assertCurrent005(query004Status.payload, "GET current status with ignored query override");
  assert(query004Status.payload.ignoredRequestContext?.ignoredProjectRootProvided === true, "query override should be recorded as ignored");
  assert(query004Status.payload.ignoredRequestContext?.ignoredProjectRootSource === "query", "query override source should be recorded");

  const body004Run = await fetchJson(`${baseUrl}/api/runtime/projects/current/real-chain/run-check`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ projectRoot: project004Root, projectId: project004Id }),
  });
  assert(body004Run.response.status === 200, "POST current run-check with body override should return 200");
  assertCurrent005(body004Run.payload, "POST current run-check with ignored body override");
  assert(body004Run.payload.command?.verifyScriptRan === false, "current run-check must not run verify script");

  const header004Plan = await fetchJson(`${baseUrl}/api/runtime/projects/current/image2-batch/plan`, {
    headers: {
      "x-vibe-project-root": project004Root,
      "x-vibe-project-id": project004Id,
    },
  });
  assert(header004Plan.response.status === 200, "GET image2 batch plan with header override should return 200");
  assertImage2Batch005(header004Plan.payload, "GET image2 batch plan with ignored header override");
  assert(header004Plan.payload.ignoredRequestContext?.ignoredProjectRootProvided === true, "header override should be recorded as ignored");
  assert(header004Plan.payload.ignoredRequestContext?.ignoredProjectRootSource === "header", "header override source should be recorded");

  const project004VibeBefore = statSync(project004VibePath).mtimeMs;
  const select004 = await selectProject(baseUrl, project004Root, project004Id, "004 image2");
  assert(select004.response.status === 200, "POST select 004 should return 200");
  assert(select004.payload.providerCalled === false, "POST select 004 must not call provider");
  assert(select004.payload.prepareRan === false, "POST select 004 must not run prepare");
  assert(select004.payload.projectVibeWritten === false, "POST select 004 must not write project.vibe");
  assert(statSync(project004VibePath).mtimeMs === project004VibeBefore, "POST select 004 must not mutate project.vibe");
  assert(JSON.parse(readFileSync(bindingPath, "utf8")).projectRoot === project004Root, "binding file should store 004 root");

  const recentAfterSelect004 = await fetchJson(`${baseUrl}/api/runtime/projects/recent`);
  assert(recentAfterSelect004.response.status === 200, "GET recent projects after select 004 should return 200");
  assert(recentAfterSelect004.payload.choices[0]?.projectRoot === project004Root, "recent projects should put the bound project first");
  assert(recentAfterSelect004.payload.choices[0]?.status === "当前", "recent projects should label the bound project as current");
  assert(recentAfterSelect004.payload.choices.filter((choice) => choice.projectRoot === project004Root).length === 1, "recent projects should de-duplicate the bound fixture");

  const project004VibeBeforeStatusRead = statSync(project004VibePath).mtimeMs;
  const project004Status = await fetchJson(`${baseUrl}/api/runtime/projects/current/real-chain/status`);
  assert(project004Status.response.status === 200, "GET current status after select 004 should return 200");
  assertCurrent004(project004Status.payload, "GET current status after select 004");
  assert(statSync(project004VibePath).mtimeMs === project004VibeBeforeStatusRead, "GET current status with workbenchFacts must not mutate 004 project.vibe");

  const query005Status = await fetchJson(
    `${baseUrl}/api/runtime/projects/current/real-chain/status?projectRoot=${encodeURIComponent(project005Root)}&projectId=${encodeURIComponent(project005Id)}`,
  );
  assert(query005Status.response.status === 200, "GET current status with 005 query override should return 200");
  assertCurrent004(query005Status.payload, "GET current status with ignored 005 query override");

  const image2Batch004 = await fetchJson(`${baseUrl}/api/runtime/projects/current/image2-batch/run-check`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ projectRoot: project005Root, projectId: project005Id }),
  });
  assert(image2Batch004.response.status === 200, "POST image2 batch run-check after select 004 should return 200");
  assertImage2Batch004(image2Batch004.payload, "POST image2 batch run-check with ignored 005 body override");
  assert(image2Batch004.payload.command?.providerCalled === false, "image2 run-check must not call provider");
  assert(image2Batch004.payload.command?.prepareRan === false, "image2 run-check must not run prepare");
  assert(image2Batch004.payload.command?.workerSpawnForbidden === true, "image2 run-check must forbid worker spawn");

  const legacyStatus = await fetchJson(`${baseUrl}/api/runtime/real-demo-e2e/005/status`);
  assert(legacyStatus.response.status === 200, "legacy 005 status should return 200");
  assert005Payload(legacyStatus.payload, "legacy 005 status");
  assert(legacyStatus.payload.observations[0]?.imageUrl.includes("scope=real-demo-e2e-005"), "legacy file URLs should use explicit 005 scope");

  const legacyRunDisabled = await fetchJson(`${baseUrl}/api/runtime/real-demo-e2e/005/run`, {
    method: "POST",
  });
  assert(legacyRunDisabled.response.status === 403, "legacy 005 run should be disabled by default");
  assert(legacyRunDisabled.payload.status === "disabled", "legacy 005 run disabled status mismatch");
  assert(legacyRunDisabled.payload.command?.verifyScriptRan === false, "legacy 005 run must not spawn verify script while disabled");

  const legacyFile = await fetch(legacyStatus.payload.observations[0].imageUrl.replace("/api/runtime/files", `${baseUrl}/api/runtime/files`));
  assert(legacyFile.status === 200, "legacy scoped file should be readable");

  const current004OutputPath = image2Batch004.payload.items.find((item) => item.outputExists)?.expectedOutputPath;
  assert(current004OutputPath.endsWith("/start.png"), "current project preview output should be a start.png thumbnail");
  const project004VibeBeforeFileRead = statSync(project004VibePath).mtimeMs;
  const current004File = await fetch(`${baseUrl}/api/runtime/files?path=${encodeURIComponent(current004OutputPath)}`);
  assert(current004File.status === 200, "current project file inside bound 004 should be readable");
  assert(current004File.headers.get("content-type") === "image/png", "current project start.png should be served as image/png");
  assert(current004File.headers.get("access-control-allow-origin") !== "*", "current project start.png must not use wildcard CORS");
  assert(current004File.headers.get("x-content-type-options") === "nosniff", "current project start.png should use nosniff with the correct MIME");
  assert(current004File.headers.get("cache-control") === "no-store", "current project start.png should retain no-store cache policy");
  await current004File.arrayBuffer();
  assert(statSync(project004VibePath).mtimeMs === project004VibeBeforeFileRead, "runtime file read must not mutate project.vibe");

  const current004TrustedFile = await fetch(`${baseUrl}/api/runtime/files?path=${encodeURIComponent(current004OutputPath)}`, {
    headers: { origin: trustedOrigin },
  });
  assert(current004TrustedFile.status === 200, "trusted localhost origin should read current project file");
  assert(current004TrustedFile.headers.get("access-control-allow-origin") === trustedOrigin, "trusted current project file request should echo origin");
  await current004TrustedFile.arrayBuffer();

  const missingImageAsMedia = await fetch(`${baseUrl}/api/runtime/files?path=${encodeURIComponent(`${project004Root}/outputs/shots/S01/start.png`)}`, {
    headers: { accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8" },
  });
  assert(missingImageAsMedia.status === 404, "missing current project start.png media request should return 404");
  assert(missingImageAsMedia.headers.get("content-type") === "image/png", "missing current project start.png media request should keep image/png");
  assert(missingImageAsMedia.headers.get("access-control-allow-origin") !== "*", "missing current project start.png media request must not use wildcard CORS");
  assert(missingImageAsMedia.headers.get("x-content-type-options") === "nosniff", "missing current project start.png media request should use nosniff");
  assert((await missingImageAsMedia.text()) === "", "missing current project start.png media request should not return JSON to image loads");

  const currentCannotRead005 = await fetchJson(`${baseUrl}/api/runtime/files?path=${encodeURIComponent(`${project005Root}/outputs/shots/S01/start.png`)}`);
  assert(currentCannotRead005.response.status === 403, "current project file route must not read outside bound project");
  assert(currentCannotRead005.payload.status === "forbidden", "outside bound project file status mismatch");

  const parentTraversal = await fetchJson(`${baseUrl}/api/runtime/files?path=${encodeURIComponent("../package.json")}`);
  assert(parentTraversal.response.status === 403, "runtime files should block parent traversal");

  const externalAbsoluteFile = await fetchJson(`${baseUrl}/api/runtime/files?path=${encodeURIComponent(outsideFile)}`);
  assert(externalAbsoluteFile.response.status === 403, "runtime files should block absolute outside paths");

  rmSync(repoSymlinkFile, { force: true });
  symlinkSync(outsideFile, repoSymlinkFile);
  const symlinkFile = await fetchJson(`${baseUrl}/api/runtime/files?path=${encodeURIComponent(repoSymlinkFile)}`);
  assert(symlinkFile.response.status === 403, "runtime files should block symlink escape inside bound project");

  const escapingSelect = await selectProject(baseUrl, "../outside", "blocked_project", "blocked");
  assert(escapingSelect.response.status === 403, "select should block parent traversal roots");
  assert(escapingSelect.payload.status === "blocked", "escaping select status mismatch");

  const externalSelect = await selectProject(baseUrl, outsideRoot, "external_project", "external");
  assert(externalSelect.response.status === 403, "select should fail closed for absolute external roots");
  assert(/External user project roots/.test(externalSelect.payload.todo || ""), "external select should expose fail-closed diagnostic");

  const missingRefsSelect = await selectProject(baseUrl, missingRefsRoot, "one_shot_missing_refs", "missing refs");
  assert(missingRefsSelect.response.status === 200, "missing refs fixture should be selectable inside sandbox");
  const missingRefsOneShot = await fetchJson(`${baseUrl}/api/runtime/projects/current/image2-one-shot/prepare`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ selectedShotId: "S01", selectedShotIds: ["S01"], imageCount: 1 }),
  });
  assert(missingRefsOneShot.response.status === 409, "one-shot prepare with missing locked refs should fail closed");
  assert(missingRefsOneShot.payload.status === "blocked", "missing locked refs one-shot status should be blocked");
  assert(missingRefsOneShot.payload.blockers.some((blocker) => /locked character/i.test(blocker)), "missing locked character blocker missing");
  assert(missingRefsOneShot.payload.blockers.some((blocker) => /locked scene/i.test(blocker)), "missing locked scene blocker missing");
  assert(missingRefsOneShot.payload.blockers.some((blocker) => /locked style/i.test(blocker)), "missing locked style blocker missing");
  assert(missingRefsOneShot.payload.providerCalled === false, "missing refs one-shot must not call provider");
  assert(missingRefsOneShot.payload.projectVibeWritten === false, "missing refs one-shot must not write project.vibe");
  assert(missingRefsOneShot.payload.workerSpawnForbidden === true, "missing refs one-shot must not spawn worker");

  await assertStoryFlowFactSourceProjection(baseUrl);

  rmSync(repoSymlinkRoot, { recursive: true, force: true });
  symlinkSync(tempRoot, repoSymlinkRoot, "dir");
  const symlinkSelect = await selectProject(baseUrl, repoSymlinkRoot, "symlink_project", "symlink");
  assert(symlinkSelect.response.status === 403, "select should block repo symlink roots pointing outside");

  console.log("Local runtime API current project binding test passed. No provider was called.");
} finally {
  child.kill("SIGTERM");
  rmSync(repoSymlinkFile, { force: true });
  rmSync(repoSymlinkRoot, { recursive: true, force: true });
  rmSync(project005OneShotRoot, { recursive: true, force: true });
  rmSync(missingRefsRoot, { recursive: true, force: true });
  rmSync(storyFlowFactSourceRoot, { recursive: true, force: true });
  cleanupRound5Zp05StrictEditSidecars();
  rmSync(round5Root, { recursive: true, force: true });
  rmSync(tempRoot, { recursive: true, force: true });
}

const tokenTempRoot = mkdtempSync(path.join(tmpdir(), "vibe-runtime-api-token-test-"));
const tokenBindingPath = path.join(tokenTempRoot, "current-project.local.json");
const tokenChild = spawnRuntimeServer({
  VIBE_CORE_RUNTIME_API_PORT: "0",
  VIBE_CORE_CURRENT_PROJECT_BINDING_PATH: tokenBindingPath,
  VIBE_CORE_RUNTIME_API_TOKEN: "test-runtime-token",
});

try {
  const { baseUrl: tokenBaseUrl } = await waitForServer(tokenChild);
  const tokenStatus = await fetchJson(`${tokenBaseUrl}/api/runtime/status`, {
    headers: { origin: "http://localhost:5176" },
  });
  assert(tokenStatus.response.status === 200, "trusted localhost origin should read token-protected status");
  assert(tokenStatus.response.headers.get("access-control-allow-origin") === "http://localhost:5176", "token-protected status should echo trusted origin");
  assert(tokenStatus.payload.security?.tokenRequired === true, "token-protected status should expose tokenRequired=true");

  const project004VibeBeforeTokenTests = statSync(project004VibePath).mtimeMs;
  const missingTokenSelect = await selectProject(tokenBaseUrl, project004Root, project004Id, "004 token missing", {
    headers: { origin: "http://localhost:5176" },
  });
  assert(missingTokenSelect.response.status === 403, "POST select should require token when token env is set");
  assert(missingTokenSelect.payload.status === "forbidden", "missing token select status mismatch");
  assert(!existsSync(tokenBindingPath), "missing token select must not write binding");

  const wrongTokenSelect = await selectProject(tokenBaseUrl, project004Root, project004Id, "004 token wrong", {
    headers: {
      origin: "http://localhost:5176",
      "x-vibe-runtime-token": "wrong-token",
    },
  });
  assert(wrongTokenSelect.response.status === 403, "POST select should reject wrong token");
  assert(wrongTokenSelect.payload.status === "forbidden", "wrong token select status mismatch");
  assert(!existsSync(tokenBindingPath), "wrong token select must not write binding");

  const hostileTokenSelect = await selectProject(tokenBaseUrl, project004Root, project004Id, "004 hostile origin", {
    headers: {
      origin: "https://evil.example",
      "x-vibe-runtime-token": "test-runtime-token",
    },
  });
  assert(hostileTokenSelect.response.status === 403, "POST select should reject hostile origin even with a correct token");
  assert(!existsSync(tokenBindingPath), "hostile origin select must not write binding");

  const correctTokenSelect = await selectProject(tokenBaseUrl, project004Root, project004Id, "004 token ok", {
    headers: {
      origin: "http://localhost:5176",
      "x-vibe-runtime-token": "test-runtime-token",
    },
  });
  assert(correctTokenSelect.response.status === 200, "POST select should accept correct token from trusted origin");
  assert(correctTokenSelect.response.headers.get("access-control-allow-origin") === "http://localhost:5176", "POST select should echo trusted origin");
  assert(correctTokenSelect.payload.status === "bound", "correct token select should bind");
  assert(correctTokenSelect.payload.projectVibeWritten === false, "correct token select must not write project.vibe");
  assert(existsSync(tokenBindingPath), "correct token select should write runtime-local binding");
  assert(statSync(project004VibePath).mtimeMs === project004VibeBeforeTokenTests, "token checks must not mutate project.vibe");

  console.log("Local runtime API token/origin security test passed.");
} finally {
  tokenChild.kill("SIGTERM");
  rmSync(tokenTempRoot, { recursive: true, force: true });
  rmSync(localRuntimeFixtureRoot, { recursive: true, force: true });
}
