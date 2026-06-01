import fs from "node:fs";
import path from "node:path";

import { buildMotionEndpointContract } from "../src/core/motionPlanning.ts";
import { validateMotionEndpointHardContracts } from "../src/core/visualConsistency.ts";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function shot(overrides = {}) {
  return {
    id: overrides.id || "R41",
    actId: "round4_1",
    title: overrides.title || "Round 4.1 test shot",
    storyFunction: overrides.storyFunction || "Round 4.1 endpoint planning test.",
    status: "assets_ready",
    gates: {
      identity: "PASS",
      scene: "PASS",
      pair: "PASS",
      story: "PASS",
      prop: "PASS",
      style: "PASS",
    },
    issues: overrides.issues || [],
    ...overrides,
  };
}

function keyframePair(overrides = {}) {
  const shotId = overrides.shotId || "R41";
  return {
    shotId,
    startFrameId: `outputs/keyframes/${shotId}_start.png`,
    endFrameId: `outputs/keyframes/${shotId}_end.png`,
    endDerivationSource: "start_frame",
    validForI2vPair: true,
    allowedDelta: ["planned endpoint motion"],
    mustPreserve: ["character identity", "scene layout", "anime style"],
    mustNotAdd: ["new character", "new location", "unplanned prop"],
    ...overrides,
  };
}

const generatedAt = "2026-05-09T00:00:00.000Z";
const round4RunRoot = "real-test-sandbox/round4-start-end-motion-contract-anime/runs/run-2026-05-08T21-01-17-000Z";
const reportDir = path.join(round4RunRoot, "reports");
const reportJsonPath = path.join(reportDir, "round4_1_motion_endpoint_planning_2026-05-09.json");
const reportMdPath = path.join(reportDir, "round4_1_motion_endpoint_planning_2026-05-09.md");

function evaluateCase(testCase) {
  const pair = keyframePair(testCase.keyframePair || { shotId: testCase.id });
  const contract = buildMotionEndpointContract({
    generatedAt,
    shot: shot({
      id: testCase.id,
      title: testCase.title,
      storyFunction: testCase.storyFunction,
      issues: testCase.issues || [],
    }),
    keyframePair: pair,
  });
  const hardIssues = validateMotionEndpointHardContracts({
    motionEndpointContracts: [contract],
    keyframePairs: [pair],
  });
  const passedHardGate = hardIssues.length === 0;
  return {
    id: testCase.id,
    label: testCase.label,
    expectation: testCase.expectation,
    motionType: contract.motionType,
    contractStatus: contract.status,
    hardGateStatus: passedHardGate ? "pass" : "blocked",
    blockers: contract.blockers,
    warnings: contract.warnings,
    hardIssues: hardIssues.map((issue) => issue.detail),
    bodyMechanics: contract.bodyMechanics,
    gateInputs: contract.gateInputs,
  };
}

const cases = [
  {
    id: "R41_WALK_OK",
    label: "small locomotion with real body mechanics",
    expectation: "pass",
    title: "Character takes two small steps to camera right",
    storyFunction:
      "Small locomotion endpoint: left foot plants on the floor contact point, center of mass shifts over the planted foot, right foot follows and settles without sliding the bbox.",
  },
  {
    id: "R41_WALK_MISSING_CONTACT",
    label: "locomotion missing explicit contact point",
    expectation: "blocked",
    title: "Character walks to camera right",
    storyFunction: "The shot plans visible steps and center of mass transfer, but without a ground contact point.",
  },
  {
    id: "R41_BBOX_ONLY",
    label: "bbox-only translation is not real walking",
    expectation: "blocked",
    title: "Both characters walk across the frame",
    storyFunction: "The characters walk by bbox translation only, with no footwork, no center of mass, and no ground contact point.",
  },
  {
    id: "R41_HEAD_GAZE",
    label: "in-place head and gaze shift",
    expectation: "pass",
    title: "Seated character lifts chin toward the rainy window reflection",
    storyFunction: "Head and eye-line shift while the seated torso remains anchored to the chair; no walking and no prop interaction.",
  },
  {
    id: "R41_HAND_PROP",
    label: "hand and prop interaction without forced footwork",
    expectation: "pass",
    title: "Character points at the folded map with one finger",
    storyFunction: "Hand prop interaction: the index finger touches the approved map contact point while the body stays planted; no step is required.",
  },
  {
    id: "R41_PROMPT_ONLY_END",
    label: "prompt-only or unknown end-frame derivation",
    expectation: "blocked",
    title: "Character opens the archive drawer",
    storyFunction: "Hand opens the drawer handle from the approved start frame, but the end frame derivation is unknown and prompt-only.",
    keyframePair: {
      shotId: "R41_PROMPT_ONLY_END",
      endDerivationSource: "unknown",
      validForI2vPair: true,
    },
  },
];

const results = cases.map(evaluateCase);

for (const result of results) {
  if (result.expectation === "pass") {
    assert(result.hardGateStatus === "pass", `${result.id} should pass hard gate: ${result.hardIssues.join("; ")}`);
    assert(result.contractStatus !== "blocked", `${result.id} should not have blocked contract status`);
  } else {
    assert(result.hardGateStatus === "blocked", `${result.id} should be blocked`);
  }
}

const byId = Object.fromEntries(results.map((result) => [result.id, result]));
assert(byId.R41_WALK_OK.motionType === "locomotion", "planned walking must classify as locomotion");
assert(byId.R41_WALK_OK.bodyMechanics.footwork.length > 0, "planned walking must include footwork");
assert(byId.R41_WALK_OK.bodyMechanics.centerOfMass === "specified", "planned walking must include center of mass");
assert(byId.R41_WALK_OK.bodyMechanics.contactPoints.length > 0, "planned walking must include contact points");
assert(
  byId.R41_WALK_MISSING_CONTACT.hardIssues.some((detail) => detail.includes("contactPoints")),
  "missing-contact walk must be blocked by contactPoints gate",
);
assert(byId.R41_HEAD_GAZE.motionType === "pose_change_in_place", "head/gaze shift must remain pose_change_in_place");
assert(byId.R41_HAND_PROP.motionType === "object_interaction", "hand/prop interaction must classify as object_interaction");
assert(byId.R41_HAND_PROP.bodyMechanics.footwork.length === 0, "hand/prop interaction must not force footwork");
assert(
  byId.R41_PROMPT_ONLY_END.hardIssues.some((detail) => detail.includes("keyframePairDerivesFromStart") || detail.includes("approved start frame")),
  "prompt-only or unknown end-frame derivation must be blocked",
);

const report = {
  reportKind: "round4_1_motion_endpoint_planning_test",
  generatedAt,
  sourceRound4Run: round4RunRoot,
  realProviderCalls: 0,
  purpose:
    "Verify that start/end-frame video pre-planning requires explicit motion endpoints before Image2 end-frame generation.",
  summary: {
    caseCount: results.length,
    passedAsExpected: results.length,
    blockedCases: results.filter((result) => result.hardGateStatus === "blocked").map((result) => result.id),
    passedCases: results.filter((result) => result.hardGateStatus === "pass").map((result) => result.id),
  },
  results,
  unresolvedRealImage2Risks: [
    "Software gates cannot prove pixel-level identity, hand anatomy, or background continuity without visual pair QA after Image2 returns.",
    "Passing motion endpoint planning does not guarantee Image2 performs a true local edit; pair QA still must compare start/end images.",
    "Large multi-person locomotion remains high risk and should be split into smaller endpoints or video-only motion when pair QA flags restaging.",
  ],
};

const md = [
  "# Round 4.1 Motion Endpoint Planning Test",
  "",
  `- Generated at: ${generatedAt}`,
  `- Source Round 4 run: \`${round4RunRoot}\``,
  "- Real Image2 calls: 0",
  "",
  "## Result",
  "",
  "| Case | Expected | Motion Type | Contract | Hard Gate | Notes |",
  "| --- | --- | --- | --- | --- | --- |",
  ...results.map((result) => {
    const notes = [...result.blockers, ...result.hardIssues, ...result.warnings].join("; ") || "ok";
    return `| ${result.id} | ${result.expectation} | ${result.motionType} | ${result.contractStatus} | ${result.hardGateStatus} | ${notes.replaceAll("|", "\\|")} |`;
  }),
  "",
  "## What This Covers",
  "",
  "- Small walking/translation must include footwork, center-of-mass transfer, and an explicit foot/ground contact point.",
  "- Head and eye-line change stays as in-place pose change, not object interaction or walking.",
  "- Hand/prop interaction requires hand/prop contact but does not force footwork.",
  "- Prompt-only or unknown end-frame derivation is blocked before provider submission.",
  "",
  "## Remaining Real Image2 Risk",
  "",
  ...report.unresolvedRealImage2Risks.map((item) => `- ${item}`),
  "",
].join("\n");

fs.mkdirSync(reportDir, { recursive: true });
fs.writeFileSync(reportJsonPath, `${JSON.stringify(report, null, 2)}\n`);
fs.writeFileSync(reportMdPath, md);

console.log(`Round 4.1 motion endpoint planning tests passed. Report: ${reportMdPath}`);
