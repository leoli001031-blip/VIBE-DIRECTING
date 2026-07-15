import fs from "node:fs";
import {
  createDirectorSkillCase,
  createDirectorSkillInvocationLedger,
  createDirectorSkillInvocationReceipt,
  directorSkillCaseSupportsPromotion,
  parseDirectorSkillInvocationLedger,
  serializeDirectorSkillEvidence,
  validateDirectorSkillCase,
  validateDirectorSkillInvocationReceipt,
  type DirectorSkillCaseDecision,
  type DirectorSkillProjectIdentity,
} from "../src/core/directorSkillEvidence.ts";
import { migrateLegacyDirectorSkillCard } from "../src/core/directorSkillContract.ts";
import { buildDirectorSkillCardFromShot } from "../src/core/directorSkillLibrary.ts";
import {
  appendProjectDirectorSkillInvocationReceipt,
  openProjectDirectorSkillInvocationLedger,
  projectDirectorSkillInvocationLedgerPath,
} from "../src/project/projectDirectorSkillInvocationStore.ts";
import type { ShotRecord } from "../src/core/types.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function installWindowShim(windowShim: unknown) {
  (globalThis as { window?: unknown }).window = windowShim;
}

function createLocalStorageShim() {
  const values = new Map<string, string>();
  return {
    values,
    storage: {
      getItem(key: string) { return values.get(key) ?? null; },
      setItem(key: string, value: string) { values.set(key, value); },
      removeItem(key: string) { values.delete(key); },
    },
  };
}

const shot: ShotRecord = {
  id: "P10S01",
  actId: "act_1",
  title: "雨夜门口停顿",
  storyFunction: "人物关系通过站位和停顿被读懂。",
  status: "queued",
  gates: { identity: "UNKNOWN", scene: "UNKNOWN", pair: "UNKNOWN", story: "UNKNOWN", prop: "UNKNOWN", style: "UNKNOWN" },
  issues: [],
  referenceStrategy: "storyboard_narrative",
  durationSeconds: 6,
  executionMode: "relationship_wide",
  primaryAction: "女孩停在门口",
  actionTrigger: "机器人叫住她",
  microReaction: "她松开纸飞机",
};
const migrated = migrateLegacyDirectorSkillCard(buildDirectorSkillCardFromShot(shot));
assert(migrated.ok && migrated.definition, "fixture Skill must migrate");
const skill = migrated.definition;
const identity: DirectorSkillProjectIdentity = {
  projectId: "p10-s-evidence",
  projectRoot: "/tmp/vibe-director-p10-s-evidence/project",
  projectFactHash: "fact_current_001",
};
const createdAt = "2026-07-16T02:00:00.000Z";
const qa = {
  status: "pass" as const,
  checkedSkillHash: skill.contentHash,
  checkedKnowledgePackHashes: ["kp_hash_001"],
  reportHash: "qa_hash_001",
  findings: [],
};
const receipt = createDirectorSkillInvocationReceipt({
  ...identity,
  shotId: shot.id,
  actionId: "action_plan_p10s01",
  jobId: "job_dry_run_p10s01",
  skillId: skill.id,
  skillVersion: skill.version,
  skillContentHash: skill.contentHash,
  status: "validated",
  routeId: "dsr_route_001",
  routingReasons: ["strategy_match", "task_purpose_match"],
  inputHash: "input_hash_001",
  outputHash: "output_hash_001",
  knowledgePacks: [{ packId: "camera/core", version: "1.0.0", hash: "kp_hash_001" }],
  provider: { slot: "video.i2v", providerId: "none", modelId: "dry-run", executionMode: "dry_run" },
  qa,
  createdAt,
});
assert(validateDirectorSkillInvocationReceipt(receipt).length === 0, "valid receipt should pass");
assert(receipt.projectRoot === identity.projectRoot, "receipt must bind normalized projectRoot");

const ledger = createDirectorSkillInvocationLedger(identity, [receipt], createdAt);
const restored = parseDirectorSkillInvocationLedger(serializeDirectorSkillEvidence(ledger), identity);
assert(restored.ok && restored.status === "restored", "current identity should restore receipt ledger");
const staleFact = parseDirectorSkillInvocationLedger(serializeDirectorSkillEvidence(ledger), { ...identity, projectFactHash: "fact_new" });
assert(!staleFact.ok && staleFact.status === "fact_hash_mismatch", "old fact receipt must fail closed");
const wrongProject = parseDirectorSkillInvocationLedger(serializeDirectorSkillEvidence(ledger), { ...identity, projectId: "other" });
assert(!wrongProject.ok && wrongProject.status === "project_mismatch", "another project receipt must fail closed");
const damaged = JSON.parse(serializeDirectorSkillEvidence(ledger));
damaged.receipts[0].outputHash = "tampered";
assert(!parseDirectorSkillInvocationLedger(JSON.stringify(damaged), identity).ok, "tampered receipt hash must fail closed");

function caseFor(outcome: DirectorSkillCaseDecision, withHumanDecision = true) {
  return createDirectorSkillCase({
    ...identity,
    shotId: shot.id,
    actionId: `case_action_${outcome}`,
    jobId: `case_job_${outcome}`,
    skillId: skill.id,
    skillVersion: skill.version,
    skillContentHash: skill.contentHash,
    routeId: receipt.routeId,
    inputHash: receipt.inputHash,
    outputHash: receipt.outputHash,
    knowledgePacks: receipt.knowledgePacks,
    provider: receipt.provider,
    qa,
    humanDecision: withHumanDecision ? {
      decision: outcome,
      decidedBy: "user",
      decidedAt: createdAt,
      confirmationId: `confirm_${outcome}`,
    } : undefined,
    outcome,
    summary: `Structured ${outcome} fixture`,
    createdAt,
  });
}

const accepted = caseFor("accepted");
assert(validateDirectorSkillCase(accepted).length === 0, "accepted Case should validate");
assert(directorSkillCaseSupportsPromotion(accepted), "explicitly accepted and QA-passed Case may support promotion");
for (const outcome of ["modified", "rejected", "retry_requested", "failed", "needs_review"] as const) {
  assert(!directorSkillCaseSupportsPromotion(caseFor(outcome)), `${outcome} Case must not support promotion`);
}
assert(!directorSkillCaseSupportsPromotion(caseFor("accepted", false)), "accepted text without explicit human evidence must not support promotion");

const storageShim = createLocalStorageShim();
installWindowShim({ localStorage: storageShim.storage });
try {
  const target = { storageKey: "p10-s-evidence" };
  const written = await appendProjectDirectorSkillInvocationReceipt(target, identity, receipt);
  assert(written.ok && written.status === "written", "receipt should persist through the existing sidecar storage adapter");
  assert(storageShim.values.has(`p10-s-evidence:${projectDirectorSkillInvocationLedgerPath}`), "receipt should use the project evidence sidecar path");
  const reopened = await openProjectDirectorSkillInvocationLedger(target, identity);
  assert(reopened.ok && reopened.ledger?.receipts[0]?.receiptId === receipt.receiptId, "receipt should cold-restore from sidecar storage");
  const blocked = await openProjectDirectorSkillInvocationLedger(target, { ...identity, projectFactHash: "fact_changed" });
  assert(!blocked.ok && blocked.status === "fact_hash_mismatch", "sidecar restore must reject old project facts");
} finally {
  delete (globalThis as { window?: unknown }).window;
}

for (const fileName of ["director_skill_case.schema.json", "director_skill_invocation_receipt.schema.json", "director_skill_invocation_ledger.schema.json"]) {
  const schema = JSON.parse(fs.readFileSync(`schemas/${fileName}`, "utf8"));
  assert(schema.additionalProperties === false, `${fileName} must reject unknown fields`);
}

console.log(`director-skill-evidence-test: receipt=${receipt.receiptId} case=${accepted.caseId} sidecar=${projectDirectorSkillInvocationLedgerPath}`);
