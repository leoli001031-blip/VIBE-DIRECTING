import fs from "node:fs";
import { buildKnowledgePackManagerState, knowledgePackManagerHardLocks } from "../src/core/knowledgePackManager.ts";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function stableKnowledgeHash(value) {
  let hash = 0x811c9dc5;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return `vck_${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function pack(overrides) {
  const id = overrides.id;
  const summary = overrides.summary || `${id} concise summary`;

  return {
    id,
    version: "1.0.0",
    hash: stableKnowledgeHash(`${id}@1.0.0`),
    path: `resources/knowledge/${id}.md`,
    type: "project_local",
    category: "style",
    title: `${id} title`,
    summary,
    tags: ["style"],
    applicableTaskPurposes: ["keyframe"],
    applicableProviderSlots: ["image.generate"],
    dependencies: [],
    conflicts: [],
    maxInjectionTokens: 120,
    trustLevel: "verified",
    verificationStatus: "verified",
    conflictAcknowledged: false,
    enabled: true,
    defaultEnabled: true,
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-01T00:00:00.000Z",
    snippets: [
      {
        id: `${id}-snip`,
        title: `${id} snippet`,
        summary: `${id} safe snippet summary`,
        content: `${id} full body should never appear in manager output`,
        keywords: ["style"],
        hash: stableKnowledgeHash(`${id}-snip`),
        tokenEstimate: 18,
      },
    ],
    ...overrides,
  };
}

function minimalFixture() {
  const verified = pack({
    id: "verified_style",
    type: "external_imported",
    trustLevel: "verified",
    verificationStatus: "verified",
    verificationReportId: "verify_report_001",
    summary: "Verified external style pack summary.",
  });
  const blockedExternal = pack({
    id: "blocked_external",
    type: "external_imported",
    trustLevel: "unverified",
    verificationStatus: "pending",
    enabled: false,
    defaultEnabled: false,
  });
  const enabledUnverifiedExternal = pack({
    id: "enabled_unverified_external",
    type: "external_imported",
    trustLevel: "trusted",
    verificationStatus: "pending",
    summary: "Enabled external pack without verified status.",
  });
  const missingDependency = pack({
    id: "dependency_missing_pack",
    dependencies: [{ packId: "missing_base", version: "1.0.0", reason: "required base style" }],
  });
  const conflictA = pack({
    id: "conflict_a",
    conflicts: [{ packId: "conflict_b", reason: "opposite color rule" }],
    conflictAcknowledged: false,
  });
  const conflictB = pack({ id: "conflict_b" });
  const packs = [verified, blockedExternal, enabledUnverifiedExternal, missingDependency, conflictA, conflictB];

  const manifest = {
    schemaVersion: "0.1.0",
    manifestVersion: "phase25-test",
    generatedAt: "2026-05-01T00:00:00.000Z",
    knowledgeLibraryRoot: "resources/knowledge",
    manifestHash: stableKnowledgeHash(packs.map((item) => item.id).join("|")),
    packs,
  };
  const routeResult = {
    routeId: "kr_manager_test",
    taskId: "task_manager_test",
    taskPurpose: "keyframe",
    providerSlot: "image.generate",
    contextLevel: "L1",
    inputHash: stableKnowledgeHash("manager route input"),
    matches: packs
      .filter((item) => item.enabled)
      .map((item, index) => ({
        packId: item.id,
        version: item.version,
        hash: item.hash,
        category: item.category,
        reason: "task_purpose+provider_slot",
        consumer: "prompt_compiler",
        score: 100 - index,
        matchedTerms: ["style"],
        matchedSnippetIds: [`${item.id}-snip`],
      })),
    injectedKnowledgePacks: [],
    injectedKnowledgeSnippetIds: [],
    notInjected: [{ packId: blockedExternal.id, reason: "pack_disabled" }],
    warnings: [],
    createdAt: "2026-05-01T00:00:00.000Z",
  };
  const contextBudget = {
    budgetId: "kb_manager_test",
    routeId: routeResult.routeId,
    contextLevel: "L1",
    maxInjectionTokens: 300,
    usedTokens: 72,
    injectedKnowledgePacks: routeResult.matches.map((match) => ({
      packId: match.packId,
      version: match.version,
      hash: match.hash,
      category: match.category,
      reason: match.reason,
      consumer: match.consumer,
      injectedSnippetIds: match.matchedSnippetIds,
      summaryHash: stableKnowledgeHash(manifest.packs.find((item) => item.id === match.packId).summary),
      truncated: false,
    })),
    injectedSnippets: routeResult.matches.map((match) => ({
      packId: match.packId,
      snippetId: `${match.packId}-snip`,
      title: `${match.packId} snippet`,
      content: `${match.packId} full body should never appear in manager output`,
      tokenEstimate: 18,
      hash: stableKnowledgeHash(`${match.packId}-snip`),
    })),
    warnings: [],
    createdAt: "2026-05-01T00:00:00.000Z",
  };

  return { manifest, routeResult, contextBudget };
}

function findBlocked(state, packId) {
  const blocked = state.blockedPacks.find((item) => item.packId === packId);
  assert(blocked, `${packId} should be blocked`);
  return blocked;
}

function assertNoCapabilityFields(value) {
  const forbiddenKeys = new Set([
    "canSubmitProvider",
    "providerSubmitAllowed",
    "liveSubmitAllowed",
    "credentialAccessAllowed",
    "credentialStorage",
    "canUseShell",
    "arbitraryShellAllowed",
    "canMutateFiles",
    "fileMutationAllowed",
    "submitProvider",
    "readCredentials",
    "writeCredentials",
    "runShell",
    "shellCommand",
    "providerPolicyOverrideAllowed",
    "preflightOverrideAllowed",
    "referenceAuthorityOverrideAllowed",
    "qaGateOverrideAllowed",
    "freeTextWorkerPrompt",
    "workerFreeTextRoute",
    "providerSubmitRoute",
    "credentialRoute",
    "shellRoute",
    "fileMutationRoute",
  ]);

  function visit(node, path = []) {
    if (!node || typeof node !== "object") return;
    for (const [key, child] of Object.entries(node)) {
      // hardLocks subtree contains intentionally false locks like liveSubmitAllowed; skip entire subtree
      if (key === "hardLocks") continue;
      assert(!forbiddenKeys.has(key), `manager emitted forbidden capability field ${[...path, key].join(".")}`);
      visit(child, [...path, key]);
    }
  }

  visit(value);
}

function assertAllValuesTrue(value, label) {
  for (const [key, child] of Object.entries(value)) {
    if (child && typeof child === "object" && !Array.isArray(child)) {
      assertAllValuesTrue(child, `${label}.${key}`);
    } else {
      assert(child === true, `${label}.${key} must be true`);
    }
  }
}

const { manifest, routeResult, contextBudget } = minimalFixture();
const state = buildKnowledgePackManagerState({
  manifest,
  routeResult,
  contextBudget,
  generatedAt: "2026-05-01T00:00:00.000Z",
});

assert(state.schemaVersion === "0.1.0", "schema version drifted");
assert(state.summary.packCount === 6, "pack count should include all manifest packs");
assert(state.summary.enabledCount === 5, "enabled count should include enabled manifest packs");
assert(state.summary.disabledCount === 1, "disabled count should include disabled manifest packs");

const verifiedReady = state.injectionReady.find((item) => item.packId === "verified_style");
assert(verifiedReady, "verified external pack should enter injection-ready receipt");
assert(verifiedReady.injectedSnippetIds.includes("verified_style-snip"), "verified pack snippet id should be recorded");
assert(!JSON.stringify(verifiedReady).includes("full body should never appear"), "manager must not emit full snippet content");
assert(!JSON.stringify(state).includes("full body should never appear"), "manager output must not emit any full snippet body");

const blockedExternal = findBlocked(state, "blocked_external");
assert(blockedExternal.reasons.includes("pack_disabled"), "disabled pack must be blocked");
assert(blockedExternal.reasons.includes("external_pack_untrusted"), "untrusted external pack must be blocked");
assert(blockedExternal.reasons.includes("external_pack_unverified"), "unverified external pack must be blocked");

const enabledUnverifiedExternal = findBlocked(state, "enabled_unverified_external");
assert(enabledUnverifiedExternal.reasons.includes("external_pack_unverified"), "enabled but unverified external pack must be blocked");
assert(
  !state.injectionReady.some((item) => item.packId === "enabled_unverified_external"),
  "enabled unverified external pack must not enter injection-ready receipt",
);

const dependencyMissing = findBlocked(state, "dependency_missing_pack");
assert(dependencyMissing.reasons.includes("missing_required_dependency"), "missing required dependency must block");
assert(
  state.missingDependencies.some((item) => item.packId === "dependency_missing_pack" && item.blocking),
  "missing dependency report must acknowledge blocking dependency",
);

const conflict = findBlocked(state, "conflict_a");
assert(conflict.reasons.includes("conflict_unacknowledged"), "unacknowledged conflict must block");
assert(
  state.conflicts.some((item) => item.packId === "conflict_a" && item.acknowledged === false && item.blocking === true),
  "conflict report must acknowledge false conflictAcknowledged as blocking",
);
assert(state.warnings.some((warning) => warning.includes("missing_required_dependency")), "missing dependency warning missing");
assert(state.warnings.some((warning) => warning.includes("conflict_unacknowledged")), "conflict warning missing");

assert(state.hardLocks, "hardLocks field missing");
assert(JSON.stringify(state.hardLocks) === JSON.stringify(knowledgePackManagerHardLocks), "state hardLocks must use exported hard lock constants");
for (const [key, expected] of Object.entries(knowledgePackManagerHardLocks)) {
  assert(state.hardLocks[key] === expected, `state hard lock ${key} drifted`);
}
assert(state.hardLocks.providerPolicyOverrideForbidden === true, "provider policy override must be forbidden");
assert(state.hardLocks.preflightOverrideForbidden === true, "preflight override must be forbidden");
assert(state.hardLocks.referenceAuthorityOverrideForbidden === true, "reference authority override must be forbidden");
assert(state.hardLocks.keyframePairDerivationOverrideForbidden === true, "keyframe pair derivation override must be forbidden");
assert(state.hardLocks.qaGateOverrideForbidden === true, "QA gate override must be forbidden");
assert(state.hardLocks.phase24ValidatedEnvelopeRequired === true, "Phase 24 validated envelope must be required");
assert(state.hardLocks.providerSubmissionForbidden === true, "provider submission must be forbidden");
assert(state.hardLocks.credentialReadForbidden === true, "credential read must be forbidden");
assert(state.hardLocks.credentialWriteForbidden === true, "credential write must be forbidden");
assert(state.hardLocks.arbitraryShellExecutionForbidden === true, "arbitrary shell execution must be forbidden");
assert(state.hardLocks.parkedProviderPolicyBypassForbidden === true, "parked provider policy bypass must be forbidden");
assert(state.hardLocks.phase38ValidatedPacketRequired === true, "Phase 38 validated packet must be required");
assert(state.hardLocks.tempRejectedAssetPromotionForbidden === true, "temp/rejected asset promotion must be forbidden");
assert(state.hardLocks.candidateAssetPromotionForbidden === true, "candidate asset promotion must be forbidden");
assert(state.hardLocks.shotOutputAssetPromotionForbidden === true, "shot output asset promotion must be forbidden");
assert(state.hardLocks.freeTextWorkerForbidden === true, "free-text worker must be forbidden");
assert(state.hardLocks.parkedProviderEnableForbidden === true, "parked provider enable must be forbidden");
assert(state.hardLocks.providerSubmitRouteForbidden === true, "provider submit route must be forbidden");
assert(state.hardLocks.credentialRouteForbidden === true, "credential route must be forbidden");
assert(state.hardLocks.shellRouteForbidden === true, "shell route must be forbidden");
assert(state.hardLocks.fileMutationRouteForbidden === true, "file mutation route must be forbidden");
assert(state.hardLocks.fullBodyOutputForbidden === true, "full body output must be forbidden");

assert(state.userManagement, "userManagement receipt missing");
assert(state.userManagement.summary.ready === true, "user management summary must be ready");
assert(state.userManagement.summary.receiptOnly === true, "user management must be receipt-only");
assert(
  state.userManagement.summary.outputScope === "pack_snippet_summary_hash_token_id_only",
  "user management output scope must forbid full library body output",
);
assert(state.userManagement.managementReceipt.receiptId.startsWith("kpum_"), "management receipt id missing");
assertAllValuesTrue(state.userManagement.managementReceipt.capabilities, "userManagement.capabilities");
assertAllValuesTrue(state.userManagement.managementReceipt.statuses, "userManagement.statuses");
assertAllValuesTrue(state.userManagement.managementReceipt.checks, "userManagement.checks");
assert(
  state.userManagement.managementReceipt.capabilities.importPackDefined === true
    && state.userManagement.managementReceipt.capabilities.createPackDefined === true
    && state.userManagement.managementReceipt.capabilities.enablePackDefined === true
    && state.userManagement.managementReceipt.capabilities.disablePackDefined === true
    && state.userManagement.managementReceipt.capabilities.routeTestDefined === true
    && state.userManagement.managementReceipt.capabilities.conflictTestDefined === true
    && state.userManagement.managementReceipt.capabilities.versionHashDependencyChecksDefined === true
    && state.userManagement.managementReceipt.capabilities.hardGateOverrideForbidden === true,
  "management receipt must define all Phase 39 user management capabilities",
);

assertNoCapabilityFields(state);

const schema = JSON.parse(fs.readFileSync("schemas/knowledge_pack_manager.schema.json", "utf8"));
assert(schema.required.includes("schemaVersion"), "knowledge pack manager schema must require schemaVersion");

const registrySource = fs.readFileSync("src/core/schemaRegistry.ts", "utf8");
assert(registrySource.includes("knowledge_pack_manager.schema.json"), "schema registry must include knowledge_pack_manager.schema.json");
assert(registrySource.includes("KnowledgePackManagerState"), "schema registry must include KnowledgePackManagerState type");

console.log(
  `Knowledge pack manager test passed: ${state.summary.packCount} packs, ${state.summary.injectionReadyCount} injection-ready, ${state.summary.blockedCount} blocked.`,
);
