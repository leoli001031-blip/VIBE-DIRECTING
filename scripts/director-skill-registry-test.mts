import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import {
  activeDirectorSkillRegistryContracts,
  createDirectorSkillRegistry,
  deprecateDirectorSkill,
  evaluateDirectorSkillPromotion,
  parseDirectorSkillRegistry,
  pinDirectorSkillVersion,
  promoteDirectorSkillToGlobal,
  rollbackDirectorSkillVersion,
  serializeDirectorSkillRegistry,
  setDirectorSkillEnabled,
  unpinDirectorSkillVersion,
  validateDirectorSkillRegistry,
  type DirectorSkillRegistryConfirmation,
} from "../src/core/directorSkillRegistry.ts";
import { createDirectorSkillCase } from "../src/core/directorSkillEvidence.ts";
import { migrateLegacyDirectorSkillCard } from "../src/core/directorSkillContract.ts";
import { buildDirectorSkillCardFromShot } from "../src/core/directorSkillLibrary.ts";
import type { DirectorSkillDefinition, DirectorSkillRecipe } from "../src/core/directorSkillContract.ts";
import type { ShotRecord } from "../src/core/types.ts";
import {
  loadDirectorSkillGlobalRegistry,
  saveDirectorSkillGlobalRegistry,
} from "../src/core/directorSkillRegistryStore.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const shot: ShotRecord = {
  id: "P10S01", actId: "act_1", title: "关系停顿", storyFunction: "用站位和停顿表达关系。", status: "queued",
  gates: { identity: "UNKNOWN", scene: "UNKNOWN", pair: "UNKNOWN", story: "UNKNOWN", prop: "UNKNOWN", style: "UNKNOWN" }, issues: [],
  referenceStrategy: "storyboard_narrative", executionMode: "relationship_wide", durationSeconds: 6,
  primaryAction: "人物停住", actionTrigger: "对方叫住她", microReaction: "她松开手指",
};
const migrated = migrateLegacyDirectorSkillCard(buildDirectorSkillCardFromShot(shot));
assert(migrated.ok && migrated.definition && migrated.recipe, "candidate fixture must migrate");
const candidate = migrated.definition;
const candidateRecipe = migrated.recipe;
const at = "2026-07-16T05:00:00.000Z";

function acceptedCase(definition: DirectorSkillDefinition, projectId: string, index: number) {
  const createdAt = `2026-07-16T05:${String(index).padStart(2, "0")}:00.000Z`;
  return createDirectorSkillCase({
    projectId,
    projectRoot: `/tmp/p10-s-registry/${projectId}`,
    projectFactHash: `fact_${projectId}`,
    shotId: `S${index}`,
    actionId: `action_${projectId}_${index}`,
    jobId: `job_${projectId}_${index}`,
    skillId: definition.id,
    skillVersion: definition.version,
    skillContentHash: definition.contentHash,
    routeId: `route_${projectId}_${index}`,
    inputHash: `input_${projectId}_${index}`,
    outputHash: `output_${projectId}_${index}`,
    knowledgePacks: [],
    provider: { executionMode: "dry_run" },
    qa: { status: "pass", checkedSkillHash: definition.contentHash, checkedKnowledgePackHashes: [], findings: [] },
    humanDecision: { decision: "accepted", decidedBy: "user", decidedAt: createdAt, confirmationId: `confirm_case_${projectId}_${index}` },
    outcome: "accepted",
    summary: "Human accepted dry-run Case",
    createdAt,
  });
}

function confirmation(
  operation: DirectorSkillRegistryConfirmation["operation"],
  skillId: string,
  targetVersion?: string,
  targetMaturity?: DirectorSkillRegistryConfirmation["targetMaturity"],
  confirmedAt = at,
): DirectorSkillRegistryConfirmation {
  return { confirmationId: `confirm_${operation}_${targetVersion || skillId}`, confirmedBy: "user", confirmedAt, operation, skillId, targetVersion, targetMaturity };
}

const cases = [acceptedCase(candidate, "project-a", 1), acceptedCase(candidate, "project-b", 2)];
const evaluation = evaluateDirectorSkillPromotion({ definition: candidate, cases, requestedMaturity: "verified", evaluatedAt: at });
assert(evaluation.eligible && evaluation.acceptedProjectCount === 2, "two accepted Cases from different projects should qualify");
assert(!evaluateDirectorSkillPromotion({ definition: candidate, cases: [acceptedCase(candidate, "project-a", 3), acceptedCase(candidate, "project-a", 4)], requestedMaturity: "verified", evaluatedAt: at }).eligible, "same-project Cases must not qualify");

const rejected = createDirectorSkillCase({
  ...cases[0],
  caseId: undefined,
  actionId: "action_rejected",
  jobId: "job_rejected",
  humanDecision: { decision: "rejected", decidedBy: "user", decidedAt: "2026-07-16T05:59:00.000Z", confirmationId: "confirm_rejected" },
  outcome: "rejected",
  summary: "Rejected latest evidence",
  createdAt: "2026-07-16T05:59:00.000Z",
});
assert(!evaluateDirectorSkillPromotion({ definition: candidate, cases: [...cases, rejected], requestedMaturity: "verified", evaluatedAt: at }).eligible, "unresolved rejection must block promotion");

const emptyRegistry = createDirectorSkillRegistry("p10-s-isolated-library", at);
const noConfirmation = promoteDirectorSkillToGlobal({ registry: emptyRegistry, definition: candidate, recipes: [candidateRecipe], cases, requestedMaturity: "verified", promotedAt: at });
assert(!noConfirmation.ok && noConfirmation.status === "blocked", "global promotion must require a separate confirmation");

const verifiedResult = promoteDirectorSkillToGlobal({
  registry: emptyRegistry,
  definition: candidate,
  recipes: [candidateRecipe],
  cases,
  requestedMaturity: "verified",
  confirmation: confirmation("promote", candidate.id, "1.1.0", "verified"),
  promotedAt: at,
});
assert(verifiedResult.ok, `verified promotion should apply: ${verifiedResult.errors.join("; ")}`);
assert(verifiedResult.registry.entries[0]?.activeVersion === "1.1.0", "promotion must create a new version");
assert(verifiedResult.registry.entries[0]?.versions[0]?.definition.scope === "user_global", "promoted Skill must use global scope");
assert(!serializeDirectorSkillRegistry(verifiedResult.registry).includes("/tmp/"), "global registry must not retain project absolute paths");

const verifiedVersion = verifiedResult.registry.entries[0]!.versions[0]!;
const verifiedCases = [acceptedCase(verifiedVersion.definition, "project-c", 3), acceptedCase(verifiedVersion.definition, "project-d", 4)];
const trustedResult = promoteDirectorSkillToGlobal({
  registry: verifiedResult.registry,
  definition: verifiedVersion.definition,
  recipes: verifiedVersion.recipes,
  cases: verifiedCases,
  requestedMaturity: "trusted",
  confirmation: confirmation("promote", candidate.id, "1.2.0", "trusted", "2026-07-16T06:00:00.000Z"),
  promotedAt: "2026-07-16T06:00:00.000Z",
});
assert(trustedResult.ok, `trusted promotion should apply: ${trustedResult.errors.join("; ")}`);
assert(trustedResult.registry.entries[0]?.versions.length === 2, "trusted update must preserve verified version history");
assert(activeDirectorSkillRegistryContracts(trustedResult.registry).definitions[0]?.maturity === "trusted", "active global contract should be trusted");

const pinned = pinDirectorSkillVersion({
  registry: trustedResult.registry, skillId: candidate.id, version: "1.1.0",
  confirmation: confirmation("pin", candidate.id, "1.1.0"), createdAt: "2026-07-16T06:05:00.000Z",
});
assert(pinned.ok && pinned.registry.entries[0]?.pinnedVersion === "1.1.0", "pin should select an existing immutable version");
const disabled = setDirectorSkillEnabled({
  registry: pinned.registry, skillId: candidate.id, enabled: false,
  confirmation: confirmation("disable", candidate.id), createdAt: "2026-07-16T06:06:00.000Z",
});
assert(disabled.ok && activeDirectorSkillRegistryContracts(disabled.registry).definitions.length === 0, "disabled Skill must not route");
const enabled = setDirectorSkillEnabled({
  registry: disabled.registry, skillId: candidate.id, enabled: true,
  confirmation: confirmation("enable", candidate.id), createdAt: "2026-07-16T06:07:00.000Z",
});
const unpinned = unpinDirectorSkillVersion({
  registry: enabled.registry, skillId: candidate.id,
  confirmation: confirmation("unpin", candidate.id), createdAt: "2026-07-16T06:08:00.000Z",
});
assert(unpinned.ok && !unpinned.registry.entries[0]?.pinnedVersion, "unpin should preserve versions and clear only the pointer");
const rolledBack = rollbackDirectorSkillVersion({
  registry: unpinned.registry, skillId: candidate.id, targetVersion: "1.1.0",
  confirmation: confirmation("rollback", candidate.id, "1.1.0"), createdAt: "2026-07-16T06:09:00.000Z",
});
assert(rolledBack.ok && rolledBack.registry.entries[0]?.activeVersion === "1.1.0", "rollback must move the active pointer without deleting history");
assert(rolledBack.registry.entries[0]?.versions.length === 2, "rollback must preserve later version history");

const deprecated = deprecateDirectorSkill({
  registry: trustedResult.registry,
  skillId: candidate.id,
  confirmation: confirmation("deprecate", candidate.id, "1.3.0"),
  createdAt: "2026-07-16T06:10:00.000Z",
});
assert(deprecated.ok && deprecated.registry.entries[0]?.enabled === false, "deprecate must create a disabled deprecated version");
assert(deprecated.registry.entries[0]?.versions.at(-1)?.maturity === "deprecated", "deprecate must append rather than overwrite");

for (const registry of [verifiedResult.registry, trustedResult.registry, rolledBack.registry, deprecated.registry]) {
  assert(validateDirectorSkillRegistry(registry).length === 0, "every applied registry state must validate");
  assert(parseDirectorSkillRegistry(serializeDirectorSkillRegistry(registry)).ok, "registry must round-trip");
}
const tampered = JSON.parse(serializeDirectorSkillRegistry(trustedResult.registry));
tampered.entries[0].activeVersion = "9.9.9";
assert(!parseDirectorSkillRegistry(JSON.stringify(tampered)).ok, "damaged registry must fail closed");

const isolatedAppData = await mkdtemp("/tmp/vibe-director-p10-s-skill-library-");
const adapter = {
  async existsFile(filePath: string) {
    try { await readFile(filePath); return true; } catch { return false; }
  },
  async readFile(filePath: string) { return readFile(filePath, "utf8"); },
  async writeFile(filePath: string, content: string) {
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, content, "utf8");
  },
};
const stored = await saveDirectorSkillGlobalRegistry(adapter, isolatedAppData, trustedResult.registry);
assert(stored.ok && stored.path.startsWith(`${isolatedAppData}/`), "global library test must stay inside isolated App data");
const reloaded = await loadDirectorSkillGlobalRegistry(adapter, isolatedAppData);
assert(reloaded.ok && reloaded.registry?.registryHash === trustedResult.registry.registryHash, "isolated global registry must cold-restore");

console.log(`director-skill-registry-test: verified=1.1.0 trusted=1.2.0 rollback=${rolledBack.registry.entries[0]?.activeVersion} receipts=${rolledBack.registry.operationReceipts.length} appData=${isolatedAppData}`);
