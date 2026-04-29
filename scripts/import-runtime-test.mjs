import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";

const DEFAULT_ROOT =
  "/Users/lichenhao/Desktop/Vibe Director/runtime-tests/full_generation_10shot_two_act_20260429";
const root = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_ROOT;
const publicDir = path.resolve("public");
const mediaDir = path.join(publicDir, "media");
const outPath = path.join(publicDir, "runtime-audit.json");
const stateOutPath = path.join(publicDir, "runtime-state.json");
const knowledgeManifestPath = path.resolve("resources/knowledge_pack_manifest.json");

const policy = {
  strictImageProvider: "image2_only",
  rules: [
    {
      slot: "image.generate",
      activeProvider: "openai-image2-codex-cli",
      executionState: "active",
      allowedProviders: ["openai-image2-codex-cli", "openai-image2-api"],
      forbiddenProviders: ["dreamina", "jimeng", "seedream"],
      allowedModes: ["text2image"],
      forbiddenFallbacks: ["image2image_to_text2image"],
      concurrency: "adapter",
    },
    {
      slot: "image.edit",
      activeProvider: "openai-image2-api",
      executionState: "active",
      allowedProviders: ["openai-image2-codex-cli", "openai-image2-api"],
      forbiddenProviders: ["dreamina", "jimeng", "seedream"],
      allowedModes: ["image2image"],
      forbiddenFallbacks: ["image2image_to_text2image", "reference_edit_to_text2image"],
      concurrency: "adapter",
    },
    {
      slot: "image.reference_asset",
      activeProvider: "openai-image2-api",
      executionState: "active",
      allowedProviders: ["openai-image2-codex-cli", "openai-image2-api"],
      forbiddenProviders: ["dreamina", "jimeng", "seedream"],
      allowedModes: ["text2image", "image2image"],
      forbiddenFallbacks: ["image2image_to_text2image"],
      concurrency: "adapter",
    },
    {
      slot: "video.i2v",
      activeProvider: "seedance2-provider",
      executionState: "parked",
      allowedProviders: ["seedance2-provider", "dreamina-seedance2"],
      forbiddenProviders: [],
      allowedModes: ["frames2video"],
      forbiddenFallbacks: ["frames2video_to_text2video"],
      concurrency: 1,
    },
  ],
};

function readJson(file, fallback = {}) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function readYaml(file, fallback = {}) {
  try {
    return YAML.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function exists(file) {
  return Boolean(file && fs.existsSync(file));
}

function dimensionsFromGenerated(entry) {
  if (!entry || !entry.dimensions) return undefined;
  return `${entry.dimensions.width}x${entry.dimensions.height}`;
}

function parseJsonl(file) {
  if (!exists(file)) return [];
  return fs
    .readFileSync(file, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return { event: "parse_error", raw: line };
      }
    });
}

function parseQaTable(file) {
  if (!exists(file)) return new Map();
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  const table = lines.filter((line) => line.trim().startsWith("|"));
  if (table.length < 3) return new Map();
  const headers = table[0].split("|").map((cell) => cell.trim()).filter(Boolean);
  const result = new Map();
  for (const line of table.slice(2)) {
    const cells = line.split("|").map((cell) => cell.trim()).filter(Boolean);
    if (cells.length < headers.length) continue;
    const row = Object.fromEntries(headers.map((header, index) => [header, cells[index]]));
    const key = (row.Asset || row.Shot || "").replace(/`/g, "");
    if (key) result.set(key, row);
  }
  return result;
}

function gateValue(value, fallback = "UNKNOWN") {
  const clean = String(value || "").replace(/`/g, "").toUpperCase();
  return ["PASS", "PARTIAL", "FAIL", "N/A"].includes(clean) ? clean : fallback;
}

function gateSet(row = {}) {
  return {
    identity: gateValue(row.identity, "UNKNOWN"),
    scene: gateValue(row.scene, "UNKNOWN"),
    pair: gateValue(row.pair, "N/A"),
    story: gateValue(row.story, "UNKNOWN"),
    prop: gateValue(row.prop, "UNKNOWN"),
    style: gateValue(row.style, "UNKNOWN"),
  };
}

function flattenManifestAssets(manifest) {
  const assets = manifest?.generation_manifest?.assets || {};
  return [
    ...(assets.characters || []).map((item) => ({ ...item, type: "character" })),
    ...(assets.scenes || []).map((item) => ({ ...item, type: "scene" })),
    ...(assets.props || []).map((item) => ({ ...item, type: "prop" })),
  ];
}

function generatedEntryFor(generated, id) {
  return generated?.assets?.[id] || generated?.keyframes?.[id] || generated?.videos?.[id];
}

function providerIdForJob(jobId, events) {
  const event = events.find((item) => item.event === "cmd_start" && Array.isArray(item.cmd) && item.cmd[0] === "dreamina" && item.cmd.join(" ").includes(jobId));
  return event ? "dreamina" : "unknown";
}

function requiredModeForAsset(asset) {
  if (asset.type === "scene" && asset.asset_type === "scene_view") return "image2image";
  if (asset.type === "scene" && asset.asset_type === "master_reference") return "text2image";
  if (asset.type === "character" || asset.type === "prop") return "text2image";
  return "not_applicable";
}

function slotForAsset(asset) {
  if (asset.type === "character" || asset.type === "prop") return "image.reference_asset";
  if (asset.type === "scene" && asset.asset_type === "scene_view") return "image.edit";
  return "image.reference_asset";
}

function actIdForShot(shot) {
  if (shot.act_id) return String(shot.act_id);
  if (shot.actId) return String(shot.actId);
  const match = /^([A-Za-z]+\d+)/.exec(String(shot.shot_id || ""));
  return match?.[1] || "unknown";
}

function sectionIdForShot(shot) {
  return shot.section_id || shot.sectionId || shot.sequence_id || shot.scene_id || actIdForShot(shot);
}

function assetJobId(asset) {
  if (asset.type === "character") return `asset_character_${asset.character_id}`;
  if (asset.type === "prop") return `asset_prop_${asset.prop_id || asset.asset_id?.replace(/_master$/, "")}`;
  if (asset.type === "scene") {
    if (asset.asset_type === "master_reference") return `asset_scene_${asset.scene_id}_master`;
    return `asset_scene_${asset.scene_id}_${asset.asset_id}`;
  }
  return asset.asset_id;
}

function makeIssue(id, severity, type, title, detail, recommendation, target) {
  return { id, severity, type, title, detail, recommendation, target };
}

function uniqueSorted(values) {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) => left.localeCompare(right));
}

function canonicalize(value) {
  if (Array.isArray(value)) {
    const items = value.map(canonicalize);
    if (items.every((item) => ["string", "number", "boolean"].includes(typeof item))) return [...items].sort();
    return items;
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => key !== "sourceIndexHash" && key !== "updatedAt")
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)]),
    );
  }

  return value;
}

function hashString(value, prefix = "vci") {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `${prefix}_${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function computeSourceIndexHash(index) {
  return hashString(JSON.stringify(canonicalize(index)));
}

function actLabel(actId) {
  const match = /^A(\d+)$/i.exec(actId);
  if (!match) return actId === "unknown" ? "Unknown Act" : actId;
  const roman = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"][Number(match[1]) - 1];
  return roman ? `Act ${roman}` : `Act ${match[1]}`;
}

function buildStorySections(shots) {
  const groups = new Map();
  for (const shot of shots) {
    const key = shot.sectionId || shot.actId || "unknown";
    groups.set(key, [...(groups.get(key) || []), shot]);
  }

  return Array.from(groups.entries()).map(([id, sectionShots]) => ({
    id,
    label: id === sectionShots[0]?.actId ? actLabel(id) : `${actLabel(sectionShots[0]?.actId || "unknown")} / ${id}`,
    shotCount: sectionShots.length,
    blockedCount: sectionShots.filter((shot) => shot.status === "blocked" || shot.status === "video_missing").length,
    readyCount: sectionShots.filter((shot) => shot.status === "ready" || shot.status === "keyframe_pair_ready").length,
    shotIds: sectionShots.map((shot) => shot.id),
  }));
}

function buildVisualMemorySummary(audit) {
  const byType = Array.from(new Set(audit.assets.map((asset) => asset.type))).sort().map((type) => {
    const assets = audit.assets.filter((asset) => asset.type === type);
    return {
      type,
      total: assets.length,
      existing: assets.filter((asset) => asset.status !== "missing").length,
      missing: assets.filter((asset) => asset.status === "missing").length,
    };
  });

  return {
    total: audit.assets.length,
    existing: audit.assets.filter((asset) => asset.status !== "missing").length,
    locked: audit.assets.filter((asset) => asset.lockedStatus === "locked").length,
    needsReview: audit.assets.filter((asset) => asset.lockedStatus === "needs_review" || asset.lockedStatus === "candidate").length,
    missing: audit.assets.filter((asset) => asset.status === "missing").length,
    byType,
  };
}

function buildSourceIndex(audit, knowledgeManifest) {
  const lockedReferenceIds = audit.assets
    .filter((asset) => asset.status !== "missing" && asset.lockedStatus === "locked" && asset.safeForFutureReference)
    .map((asset) => asset.path);
  const candidateReferenceIds = [
    ...audit.assets.filter((asset) => asset.status !== "missing" && !lockedReferenceIds.includes(asset.path)).map((asset) => asset.path),
    ...audit.shots.flatMap((shot) => [shot.startFrame, shot.endFrame].filter(Boolean)),
  ];
  const index = {
    projectId: audit.projectTitle.replace(/\s+/g, "-").toLowerCase() || "runtime-project",
    projectVersion: audit.importedAt,
    sourceIndexHash: "",
    currentProductionBibleId: audit.sourceTask || undefined,
    currentStoryFlowId: `${audit.projectRoot}/00_task/shot_spec.yaml`,
    currentVisualMemoryId: `${audit.projectRoot}/visual_memory`,
    currentPromptHashes: Object.fromEntries(audit.jobs.filter((job) => job.promptPath).map((job) => [job.id, job.promptPath])),
    lockedReferenceIds: uniqueSorted(lockedReferenceIds),
    candidateReferenceIds: uniqueSorted(candidateReferenceIds),
    rejectedReferenceIds: [],
    failedReferenceIds: uniqueSorted(audit.assets.filter((asset) => asset.status === "missing").map((asset) => asset.path)),
    confirmedDecisionIds: [],
    staleArtifactIds: [],
    knowledgeLibraryRoot: knowledgeManifest.knowledgeLibraryRoot,
    activeKnowledgePackIds: (knowledgeManifest.packs || []).filter((pack) => pack.enabled).map((pack) => pack.id),
    disabledKnowledgePackIds: (knowledgeManifest.packs || []).filter((pack) => !pack.enabled).map((pack) => pack.id),
    knowledgeManifestHash: knowledgeManifest.manifestHash,
    packVersionBindings: Object.fromEntries((knowledgeManifest.packs || []).map((pack) => [pack.id, { version: pack.version, hash: pack.hash }])),
    updatedAt: audit.importedAt,
  };

  return { ...index, sourceIndexHash: computeSourceIndexHash(index) };
}

function summarizeSourceIndex(index) {
  const currentSourceIds = [
    index.currentProductionBibleId,
    index.currentStoryFlowId,
    index.currentShotSpecId,
    index.currentVisualMemoryId,
    index.currentSpatialMemoryId,
    index.currentStyleCapsuleId,
    index.currentVoiceMemoryId,
  ].filter(Boolean);
  const blockingReferenceCount = index.rejectedReferenceIds.length + index.failedReferenceIds.length + index.staleArtifactIds.length;

  return {
    projectId: index.projectId,
    projectVersion: index.projectVersion,
    sourceIndexHash: computeSourceIndexHash(index),
    currentSourceCount: currentSourceIds.length,
    promptHashCount: Object.keys(index.currentPromptHashes).length,
    lockedReferenceCount: index.lockedReferenceIds.length,
    candidateReferenceCount: index.candidateReferenceIds.length,
    rejectedReferenceCount: index.rejectedReferenceIds.length,
    failedReferenceCount: index.failedReferenceIds.length,
    confirmedDecisionCount: index.confirmedDecisionIds.length,
    staleArtifactCount: index.staleArtifactIds.length,
    updatedAt: index.updatedAt,
    isProductionReady: blockingReferenceCount === 0 && index.lockedReferenceIds.length > 0,
    blockingReferenceCount,
  };
}

function purposeFromSlot(slot) {
  if (slot === "image.reference_asset") return "asset";
  if (slot === "image.generate" || slot === "image.edit") return "keyframe";
  if (slot === "video.i2v") return "video";
  return "unknown";
}

function knowledgePurposeFromSlot(slot) {
  if (slot === "image.reference_asset") return "asset";
  if (slot === "image.generate") return "keyframe";
  if (slot === "image.edit") return "edit";
  if (slot === "video.i2v") return "i2v";
  if (slot === "audio.tts" || slot === "audio.music") return "audio";
  return "unknown";
}

function referenceFromPath(pathValue, sourceIndex) {
  const locked = sourceIndex.lockedReferenceIds.includes(pathValue);
  const rejected = sourceIndex.rejectedReferenceIds.includes(pathValue);
  const failed = sourceIndex.failedReferenceIds.includes(pathValue);
  return {
    id: pathValue,
    path: pathValue,
    referenceRole: rejected || failed ? "rejected_case" : locked ? "identity_authority" : "temp_candidate",
    authorityScope: locked ? ["prompt_reference", "future_reference"] : ["draft_preview"],
    polarity: rejected || failed ? "negative" : "positive",
    lockedStatus: rejected || failed ? "rejected" : locked ? "locked" : "candidate",
    allowedUse: locked ? ["prompt_reference", "future_reference", "draft_preview"] : ["draft_preview"],
    canPromoteToFormal: locked,
    canUseAsFutureReference: locked,
    contaminationReason: locked ? undefined : "Reference has not passed formal authority lock.",
  };
}

function buildKeyframePairDerivation(job, shot) {
  if (job.slot !== "video.i2v" || !shot) return undefined;
  const hasFrames = Boolean(shot.startFrame && shot.endFrame && !shot.issues.includes("missing_start_frame") && !shot.issues.includes("missing_end_frame"));
  return {
    shotId: shot.id,
    startFrameId: shot.startFrame || `${shot.id}:start`,
    endFrameId: shot.endFrame || `${shot.id}:end`,
    endDerivationSource: hasFrames ? "start_frame" : "unknown",
    validForI2vPair: hasFrames && (shot.gates.pair === "PASS" || shot.gates.pair === "PARTIAL"),
    exceptionReason: hasFrames ? undefined : "Start or end keyframe is missing from runtime audit.",
    allowedDelta: ["motion", "micro-expression", "camera movement"],
    mustPreserve: ["character identity", "scene layout", "style capsule"],
    mustNotAdd: ["new characters", "unapproved props", "text-to-video fallback"],
  };
}

function buildKnowledgeSummary(knowledgeManifest) {
  const packs = knowledgeManifest.packs || [];
  const categories = Array.from(new Set(packs.map((pack) => pack.category))).sort().map((category) => {
    const categoryPacks = packs.filter((pack) => pack.category === category);
    return {
      category,
      count: categoryPacks.length,
      enabled: categoryPacks.filter((pack) => pack.enabled).length,
    };
  });

  return {
    packCount: packs.length,
    enabledCount: packs.filter((pack) => pack.enabled).length,
    categories,
    manifestHash: knowledgeManifest.manifestHash || "",
    manifestVersion: knowledgeManifest.manifestVersion || "",
    validationIssues: [],
    bindings: packs.map((pack) => ({
      packId: pack.id,
      version: pack.version,
      hash: pack.hash,
      category: pack.category,
      title: pack.title,
      summary: pack.summary,
      tags: pack.tags || [],
      enabled: pack.enabled,
      maxInjectionTokens: pack.maxInjectionTokens || 600,
    })),
  };
}

function matchKnowledgeBindings(job, knowledgeSummary) {
  const purpose = knowledgePurposeFromSlot(job.slot);
  const preferredCategories = {
    asset: ["style", "prompt", "qa", "provider"],
    keyframe: ["composition", "camera", "lighting", "color", "style", "prompt", "qa"],
    edit: ["composition", "camera", "lighting", "color", "style", "prompt", "qa"],
    i2v: ["camera", "performance", "provider", "qa", "prompt"],
    audio: ["audio", "qa"],
    unknown: ["agent", "qa"],
  }[purpose] || ["qa"];

  return knowledgeSummary.bindings
    .filter((binding) => binding.enabled && preferredCategories.includes(binding.category))
    .slice(0, 4)
    .map((binding, index) => ({
      packId: binding.packId,
      version: binding.version,
      hash: binding.hash,
      category: binding.category,
      reason: `Bound through ProjectRuntimeState for ${purpose} task.`,
      consumer: index % 2 === 0 ? "prompt_compiler" : "qa_gate",
      score: Math.max(1, preferredCategories.length - index),
      matchedTerms: [purpose, binding.category].filter(Boolean),
      matchedSnippetIds: [],
    }));
}

function buildRouteAndBudget(job, knowledgeSummary, generatedAt) {
  const matches = matchKnowledgeBindings(job, knowledgeSummary);
  const routeId = `route_${hashString(job.id, "vck")}`;
  const routeResult = {
    routeId,
    taskId: job.id,
    taskPurpose: knowledgePurposeFromSlot(job.slot),
    providerSlot: job.slot,
    contextLevel: "L1",
    inputHash: hashString(`${job.id}:${job.slot}`, "vck"),
    matches,
    warnings: matches.length ? [] : ["No enabled knowledge pack matched this imported task."],
    createdAt: generatedAt,
  };
  const contextBudget = {
    budgetId: `${routeId}_budget`,
    routeId,
    contextLevel: "L1",
    maxInjectionTokens: 900,
    usedTokens: 0,
    injectedKnowledgePacks: matches.map((match) => ({
      packId: match.packId,
      version: match.version,
      hash: match.hash,
      category: match.category,
      reason: match.reason,
      consumer: match.consumer,
      injectedSnippetIds: [],
      summaryHash: match.hash,
      truncated: false,
    })),
    injectedSnippets: [],
    warnings: routeResult.warnings,
    createdAt: generatedAt,
  };

  return { routeResult, contextBudget };
}

function buildPreflight(job, shot, references, sourceIndex, expectedOutputs, keyframePairDerivation, generatedAt) {
  const blockers = [];
  const warnings = [];
  if (!sourceIndex?.sourceIndexHash) {
    blockers.push({
      code: "missing_source_index",
      messageForUser: "Needs source index binding.",
      technicalDetail: "ProjectRuntimeState sourceIndex is missing.",
      target: job.id,
    });
  }
  if (job.providerId === "unknown") {
    blockers.push({
      code: "unknown_provider",
      messageForUser: "任务没有解析出明确 provider，不能提交执行。",
      technicalDetail: `${job.id} providerId is unknown.`,
      target: job.id,
    });
  }
  if (!expectedOutputs.length) {
    blockers.push({
      code: "missing_expected_output",
      messageForUser: "任务没有声明 expected outputs，不能提交执行。",
      technicalDetail: `${job.id} has no outputPath.`,
      target: job.id,
    });
  }
  if (job.slot === "video.i2v" && !keyframePairDerivation?.validForI2vPair) {
    blockers.push({
      code: "invalid_keyframe_pair",
      messageForUser: "Video task needs a valid start/end keyframe pair.",
      technicalDetail: `${shot?.id || job.id} does not have a complete I2V pair.`,
      target: job.id,
    });
  }
  for (const reference of references) {
    if (reference.lockedStatus !== "locked") {
      warnings.push({
        code: "candidate_reference",
        messageForUser: "Reference is a draft candidate, not formal authority.",
        technicalDetail: `${reference.id} is only allowed for draft preview.`,
        target: reference.id,
      });
    }
  }

  return {
    taskId: job.id,
    preflightScope: "formal_execution",
    status: blockers.length ? "blocked" : warnings.length ? "warning" : "pass",
    blockers,
    warnings,
    checkedAt: generatedAt,
  };
}

function buildEnvelope(job, shot, auditIssues, sourceIndex, knowledgeSummary, generatedAt) {
  const rule = policy.rules.find((item) => item.slot === job.slot);
  const expectedOutputs = job.outputPath ? [job.outputPath] : [];
  const references = (job.references || []).map((referencePath) => referenceFromPath(referencePath, sourceIndex));
  const keyframePairDerivation = buildKeyframePairDerivation(job, shot);
  const { routeResult, contextBudget } = buildRouteAndBudget(job, knowledgeSummary, generatedAt);
  const preflight = buildPreflight(job, shot, references, sourceIndex, expectedOutputs, keyframePairDerivation, generatedAt);
  const blockingReasons = [
    ...auditIssues.filter((issue) => issue.severity === "blocker" && (!issue.target || issue.target === job.id || String(issue.target).includes(job.id))).map((issue) => issue.title),
    ...preflight.blockers.map((item) => item.messageForUser),
  ];
  const hardRules = [
    "Use the declared provider slot only.",
    "Do not silently fall back to another model or mode.",
    "Only use locked or approved references as authority.",
  ];
  if (job.slot === "image.edit") hardRules.push("End frame must derive from the start frame unless the shot explicitly crosses location or time.");
  if (job.slot === "video.i2v") {
    hardRules.push("No text-to-video fallback. Use start/end frames only.");
    hardRules.push("No BGM in generated video; sound effects may be handled later.");
  }

  return {
    envelope: {
      id: job.id,
      purpose: purposeFromSlot(job.slot),
      providerSlot: job.slot,
      providerId: job.providerId || rule?.activeProvider || "unknown",
      executionState: rule?.executionState || "planned",
      requiredMode: job.requiredMode,
      storyFunction: shot?.storyFunction,
      sourceIndexHash: sourceIndex.sourceIndexHash,
      promptHash: job.promptPath,
      dependencies: [],
      contextLevel: "L1",
      expectedOutputs,
      hardRules,
      references,
      qaChecklist: ["identity_gate", "scene_gate", "pair_gate", "story_gate", "prop_gate", "style_gate"],
      preflight,
      keyframePairDerivation,
      knowledgeRouteResultId: routeResult.routeId,
      contextBudgetId: contextBudget.budgetId,
      injectedKnowledgePacks: contextBudget.injectedKnowledgePacks,
      injectedKnowledgeSnippetIds: [],
      injectedKnowledgeSnippets: [],
      knowledgeInputHash: routeResult.inputHash,
      knowledgeManifestHash: sourceIndex.knowledgeManifestHash,
      policyBinding: hashString(`${job.id}:${job.slot}:${job.providerId}`, "policy"),
      routeWarnings: routeResult.warnings,
      nonOverridableGateHashes: {},
      outputPath: job.outputPath,
      blockingReasons,
    },
    routeResult,
    contextBudget,
  };
}

function queueGateForEnvelope(envelope) {
  const blockers = [...envelope.preflight.blockers.map((item) => item.messageForUser)];
  const warnings = envelope.preflight.warnings.map((item) => item.messageForUser);
  const rule = policy.rules.find((item) => item.slot === envelope.providerSlot);
  if (!rule) blockers.push(`Provider slot ${envelope.providerSlot} is not registered.`);
  if (envelope.providerId === "unknown") blockers.push("任务没有解析出明确 provider，不能提交执行。");
  if (rule?.forbiddenProviders.includes(envelope.providerId)) blockers.push(`${envelope.providerId} is forbidden for ${envelope.providerSlot}.`);
  if (rule?.allowedProviders.length && !rule.allowedProviders.includes(envelope.providerId)) blockers.push(`${envelope.providerId} is not allowed for ${envelope.providerSlot}.`);
  if (rule && !rule.allowedModes.includes(envelope.requiredMode)) blockers.push(`${envelope.requiredMode} is not supported by ${envelope.providerSlot}.`);
  if (!envelope.expectedOutputs.length) blockers.push("任务没有声明 expected outputs，不能提交执行。");
  if (blockers.length) return { status: "blocked", canEnter: false, blockers: uniqueSorted(blockers), warnings };
  if (["parked", "planned", "unavailable"].includes(rule?.executionState || envelope.executionState)) {
    return {
      status: "parked",
      canEnter: false,
      blockers,
      warnings: uniqueSorted([...warnings, "当前 provider 只允许生成任务占位，不能提交真实执行。"]),
    };
  }
  return { status: "ready", canEnter: true, blockers, warnings };
}

function buildTaskRun(envelope, queueGate, generatedAt) {
  return {
    taskId: envelope.id,
    localStatus: queueGate.status === "parked" ? "parked" : queueGate.canEnter ? "ready_to_submit" : "pending_local",
    providerStatus: "not_submitted",
    providerId: envelope.providerId || "unknown",
    retryCount: 0,
    stallTimeoutSeconds: 600,
    tempDirs: [],
    expectedOutputs: envelope.expectedOutputs,
    actualOutputs: [],
    lastEventAt: generatedAt,
  };
}

function buildManifestMatch(taskRun, snapshotPaths) {
  const missingExpectedOutputs = [];
  const actualOutputsPresent = [];
  const outputMatches = taskRun.expectedOutputs.map((expectedPath) => {
    if (snapshotPaths.has(expectedPath)) {
      actualOutputsPresent.push(expectedPath);
      return {
        expectedPath,
        status: "actual_output_present",
        actualPath: expectedPath,
        recoverableCandidates: [],
        reason: "Expected output is present in the imported runtime snapshot.",
      };
    }
    missingExpectedOutputs.push(expectedPath);
    return {
      expectedPath,
      status: "missing_expected_output",
      recoverableCandidates: [],
      reason: "Expected output is absent from the imported runtime snapshot.",
    };
  });
  const status = missingExpectedOutputs.length || taskRun.expectedOutputs.length === 0 ? "missing_expected_output" : "actual_output_present";

  return {
    taskId: taskRun.taskId,
    status,
    expectedOutputCount: taskRun.expectedOutputs.length,
    presentOutputCount: actualOutputsPresent.length,
    missingExpectedOutputs,
    actualOutputsPresent,
    recoverableOutputs: [],
    outputMatches,
  };
}

function deriveNextStep(task) {
  if (!task.validator.valid) return `Fix envelope schema: ${task.validator.issues[0]}`;
  if (task.envelope.preflight.blockers.some((blocker) => blocker.code.includes("provider") || blocker.code.includes("fallback"))) return "Blocked by provider policy";
  if (task.envelope.preflight.blockers.some((blocker) => blocker.code === "missing_source_index")) return "Needs source index binding";
  if (task.queueGate.status === "parked") return "Provider parked; keep as dry-run envelope";
  if (task.queueGate.status === "blocked") return task.queueGate.blockers[0] || "Blocked by preflight";
  if (task.manifestMatch.status === "missing_expected_output") return "Ready for dry check; expected output not present";
  if (task.queueGate.status === "ready") return "Ready dry check";
  return "Monitor queue state";
}

function isObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function validateEnvelope(envelope) {
  const issues = [];
  if (!isObject(envelope)) {
    return { valid: false, issues: ["envelope_missing"] };
  }

  if (!isNonEmptyString(envelope.id)) issues.push("missing_task_id");
  if (!isNonEmptyString(envelope.providerSlot)) issues.push("missing_provider_slot");
  if (!isNonEmptyString(envelope.providerId)) issues.push("missing_provider_id");
  if (!isNonEmptyString(envelope.requiredMode)) issues.push("missing_required_mode");
  if (!Array.isArray(envelope.expectedOutputs)) issues.push("missing_expected_outputs");
  if (!Array.isArray(envelope.injectedKnowledgePacks)) issues.push("missing_injected_knowledge_packs");

  if (!isObject(envelope.preflight)) {
    issues.push("missing_preflight");
  } else {
    if (!isNonEmptyString(envelope.preflight.taskId)) issues.push("missing_preflight_task_id");
    if (envelope.preflight.taskId && envelope.id && envelope.preflight.taskId !== envelope.id) issues.push("preflight_task_id_mismatch");
    if (!["pass", "warning", "blocked"].includes(envelope.preflight.status)) issues.push("invalid_preflight_status");
    if (!Array.isArray(envelope.preflight.blockers)) issues.push("missing_preflight_blockers");
    if (!Array.isArray(envelope.preflight.warnings)) issues.push("missing_preflight_warnings");
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

function buildTaskStates(audit, sourceIndex, knowledgeSummary, generatedAt) {
  const snapshotPaths = new Set(audit.fileSnapshot || []);
  return audit.jobs.map((job) => {
    const shot = audit.shots.find((item) => job.id.includes(item.id));
    const { envelope, routeResult, contextBudget } = buildEnvelope(job, shot, audit.issues, sourceIndex, knowledgeSummary, generatedAt);
    const queueGate = queueGateForEnvelope(envelope);
    const taskRun = buildTaskRun(envelope, queueGate, generatedAt);
    const manifestMatch = buildManifestMatch(taskRun, snapshotPaths);
    const task = {
      job,
      shotId: shot?.id,
      envelope,
      taskRun,
      queueGate,
      manifestMatch,
      validator: validateEnvelope(envelope),
      routeResult,
      contextBudget,
      nextStep: "",
    };
    return { ...task, nextStep: deriveNextStep(task) };
  });
}

function queueSummary(taskViews) {
  return {
    total: taskViews.length,
    ready: taskViews.filter((task) => task.queueGate.status === "ready").length,
    blocked: taskViews.filter((task) => task.queueGate.status === "blocked").length,
    parked: taskViews.filter((task) => task.queueGate.status === "parked").length,
    succeeded: taskViews.filter((task) => task.job.status === "success").length,
    missingOutputs: taskViews.filter((task) => task.manifestMatch.status === "missing_expected_output").length,
  };
}

function preflightSummary(taskViews) {
  const blockers = taskViews.flatMap((task) => task.envelope.preflight.blockers);
  return {
    blocked: taskViews.filter((task) => task.envelope.preflight.status === "blocked").length,
    warnings: taskViews.reduce((count, task) => count + task.envelope.preflight.warnings.length, 0),
    blockers,
  };
}

function manifestSummary(taskViews) {
  return {
    complete: taskViews.filter((task) => task.manifestMatch.status === "complete").length,
    present: taskViews.filter((task) => task.manifestMatch.status === "actual_output_present").length,
    missing: taskViews.filter((task) => task.manifestMatch.status === "missing_expected_output").length,
    recoverable: taskViews.filter((task) => task.manifestMatch.status === "postprocess_recoverable").length,
  };
}

function buildPreviewEvents(audit, taskViews) {
  let cursor = 0;
  return audit.shots.map((shot, index) => {
    const videoTask = taskViews.find((task) => task.shotId === shot.id && task.job.slot === "video.i2v");
    const keyframeTask = taskViews.find((task) => task.shotId === shot.id && (task.job.slot === "image.generate" || task.job.slot === "image.edit"));
    const pairPassed = shot.gates.pair === "PASS" || shot.gates.pair === "PARTIAL";
    const storyPassed = shot.gates.story === "PASS" || shot.gates.story === "PARTIAL";
    const durationSeconds = shot.videoPath ? 5 : 3;
    const startSeconds = cursor;
    cursor += durationSeconds;

    if (shot.videoPath && videoTask?.manifestMatch.status === "actual_output_present" && pairPassed && storyPassed) {
      return {
        id: `preview_${shot.id}_video`,
        mode: "draft_preview",
        type: "video_clip",
        shotId: shot.id,
        startSeconds,
        durationSeconds,
        mediaPath: shot.videoPath,
        qaStatus: "PARTIAL",
        sourceTaskId: videoTask.job.id,
      };
    }

    if (shot.startFrame && !shot.issues.includes("missing_start_frame")) {
      return {
        id: `preview_${shot.id}_hold`,
        mode: "draft_preview",
        type: pairPassed || storyPassed ? "image_hold" : "blocked_placeholder",
        shotId: shot.id,
        startSeconds,
        durationSeconds,
        mediaPath: shot.startFrame,
        qaStatus: pairPassed && storyPassed ? "PARTIAL" : "FAIL",
        sourceTaskId: keyframeTask?.job.id,
      };
    }

    return {
      id: `preview_${shot.id}_blocked`,
      mode: "draft_preview",
      type: "blocked_placeholder",
      shotId: shot.id,
      startSeconds,
      durationSeconds,
      qaStatus: "FAIL",
      sourceTaskId: videoTask?.job.id || keyframeTask?.job.id || `shot_${index}`,
    };
  });
}

function buildProjectRuntimeState(audit, knowledgeManifest, generatedAt) {
  const sourceIndex = buildSourceIndex(audit, knowledgeManifest);
  const sourceIndexSummary = summarizeSourceIndex(sourceIndex);
  const knowledgeSummary = buildKnowledgeSummary(knowledgeManifest);
  const taskViews = buildTaskStates(audit, sourceIndex, knowledgeSummary, generatedAt);
  const manifestMatches = manifestSummary(taskViews);

  return {
    schemaVersion: "0.1.0",
    coreStateVersion: "project-runtime-state/0.1.0",
    generatedAt,
    project: {
      title: audit.projectTitle,
      root: audit.projectRoot,
      sourceTask: audit.sourceTask,
      state: audit.state,
      importedAt: audit.importedAt,
      metrics: audit.metrics,
      providerPolicy: audit.providerPolicy,
      workflow: audit.workflow,
      contactSheets: audit.contactSheets,
    },
    sourceIndex,
    sourceIndexSummary,
    storyFlow: {
      sections: buildStorySections(audit.shots),
      shots: audit.shots,
    },
    visualMemory: {
      summary: buildVisualMemorySummary(audit),
      assets: audit.assets,
    },
    taskRuns: {
      jobs: audit.jobs,
      runs: taskViews.map((task) => task.taskRun),
      taskViews,
      queueSummary: queueSummary(taskViews),
      preflightSummary: preflightSummary(taskViews),
    },
    manifestMatches: {
      summary: manifestMatches,
      reports: taskViews.map((task) => task.manifestMatch),
    },
    previewEvents: buildPreviewEvents(audit, taskViews),
    diagnostics: {
      issues: audit.issues,
      schemaSummary: audit.schemaSummary,
      generatedBy: "scripts/import-runtime-test.mjs",
    },
    knowledge: knowledgeSummary,
    stateSource: {
      kind: "runtime-state",
      label: "runtime-state",
      path: "/runtime-state.json",
      sourceAuditPath: "/runtime-audit.json",
      sourceImportedAt: audit.importedAt,
      note: "Generated by import-runtime-test without live provider submission.",
    },
  };
}

function parkedExecutionStateForSlot(slot) {
  const executionState = policy.rules.find((item) => item.slot === slot)?.executionState;
  return ["parked", "planned", "unavailable"].includes(executionState) ? executionState : undefined;
}

function stripProviderSubmitTraces(job, traces) {
  const executionState = parkedExecutionStateForSlot(job.slot);
  if (!executionState) return job;

  const strippedFields = Object.entries(traces || {})
    .filter(([, value]) => value !== undefined && value !== null && String(value).trim())
    .map(([field]) => field)
    .sort();
  if (!strippedFields.length) return job;

  return {
    ...job,
    submitId: undefined,
    providerTaskId: undefined,
    issues: uniqueSorted([
      ...(job.issues || []),
      `parked_provider_submit_trace_stripped:${strippedFields.join("+")}`,
    ]),
  };
}

function statusForAsset(pathValue, generatedEntry) {
  if (exists(pathValue)) return generatedEntry?.status === "generated" ? "generated" : "exists";
  return "missing";
}

function collectJobs(manifestAssets, shots, generated, events) {
  const jobs = [];
  for (const asset of manifestAssets) {
    const id = assetJobId(asset);
    const entry = generatedEntryFor(generated, id);
    const requiredMode = requiredModeForAsset(asset);
    jobs.push(stripProviderSubmitTraces({
      id,
      slot: slotForAsset(asset),
      requiredMode,
      providerId: providerIdForJob(id, events),
      status: entry?.status === "generated" || entry?.status === "exists" ? "success" : "planned",
      outputPath: asset.path,
      promptPath: entry?.prompt_path,
      references: entry?.references || [],
      submitId: entry?.submit_id,
      issues: [],
    }, { submitId: entry?.submit_id, providerTaskId: entry?.provider_task_id || entry?.providerTaskId }));
  }

  for (const shot of shots) {
    for (const kind of ["start", "end"]) {
      const id = `keyframe_${shot.shot_id}_${kind}`;
      const entry = generatedEntryFor(generated, id);
      jobs.push(stripProviderSubmitTraces({
        id,
        slot: kind === "start" ? "image.generate" : "image.edit",
        requiredMode: kind === "start" ? "text2image" : "image2image",
        providerId: providerIdForJob(id, events),
        status: entry?.status === "generated" || entry?.status === "exists" ? "success" : "planned",
        outputPath: path.join(root, "02_keyframes", kind, `${shot.shot_id}_${kind}.png`),
        promptPath: entry?.prompt_path,
        references: entry?.references || [],
        submitId: entry?.submit_id,
        issues: [],
      }, { submitId: entry?.submit_id, providerTaskId: entry?.provider_task_id || entry?.providerTaskId }));
    }

    const id = `video_${shot.shot_id}_seedance`;
    const videoPath = path.join(root, "03_videos/clips", `${shot.shot_id}.mp4`);
    const submitId = events.find((event) => JSON.stringify(event).includes(id) && event.response?.submit_id)?.response?.submit_id;
    const providerTaskResponse = events.find((event) => JSON.stringify(event).includes(id) && (event.response?.provider_task_id || event.response?.providerTaskId))?.response;
    const providerTaskId = providerTaskResponse?.provider_task_id || providerTaskResponse?.providerTaskId;
    jobs.push(stripProviderSubmitTraces({
      id,
      slot: "video.i2v",
      requiredMode: "frames2video",
      providerId: "dreamina-seedance2",
      status: exists(videoPath) ? "success" : "parked",
      outputPath: videoPath,
      promptPath: path.join(root, "prompts/video", `${id}.txt`),
      references: [
        path.join(root, "02_keyframes/start", `${shot.shot_id}_start_seedance_720p.png`),
        path.join(root, "02_keyframes/end", `${shot.shot_id}_end_seedance_720p.png`),
      ],
      submitId,
      providerTaskId,
      issues: [],
    }, { submitId, providerTaskId }));
  }
  return jobs;
}

function validateJobs(jobs, events) {
  const issues = [];
  const fallbackEvents = events.filter((event) => String(event.event || "").includes("fallback") || JSON.stringify(event).includes("fallback_text"));

  for (const job of jobs) {
    const rule = policy.rules.find((item) => item.slot === job.slot);
    if (!rule) continue;
    if (["parked", "planned", "unavailable"].includes(rule.executionState)) {
      const submitTraceFields = [
        job.submitId ? "submitId" : undefined,
        job.providerTaskId ? "providerTaskId" : undefined,
      ].filter(Boolean);
      if (submitTraceFields.length) {
        issues.push(
          makeIssue(
            `parked-submit-trace-${job.id}`,
            "blocker",
            "provider_policy",
            "Parked provider submit trace is blocked",
            `${job.id} is bound to ${job.slot} (${rule.executionState}) but still carries ${submitTraceFields.join(", ")}.`,
            "Strip historical/live provider submit identifiers before exporting runtime-state or runtime-audit.",
            job.id,
          ),
        );
        job.issues.push("parked_provider_submit_trace_blocked");
      }
      for (const issueCode of job.issues.filter((issue) => String(issue).startsWith("parked_provider_submit_trace_stripped:"))) {
        issues.push(
          makeIssue(
            `parked-submit-stripped-${job.id}`,
            "warning",
            "provider_policy",
            "Parked provider submit trace was stripped",
            `${job.id} had historical/live provider submit fields removed during import (${String(issueCode).split(":")[1] || "submit trace"}).`,
            "Keep parked/planned/unavailable providers as dry-run envelopes until the adapter is explicitly enabled.",
            job.id,
          ),
        );
      }
      if (["submitted", "querying", "success"].includes(job.status)) {
        issues.push(
          makeIssue(
            `parked-live-${job.id}`,
            "blocker",
            "provider_policy",
            "Parked provider produced a live task",
            `${job.id} is ${job.status}, but ${job.slot} is ${rule.executionState}.`,
            "Do not submit or advance this provider path until Settings explicitly enables the adapter.",
            job.id,
          ),
        );
        job.issues.push("parked_provider_live_task");
      }
      continue;
    }
    if (rule.forbiddenProviders.includes(job.providerId)) {
      issues.push(
        makeIssue(
          `provider-${job.id}`,
          "blocker",
          "provider_policy",
          "Image provider drift",
          `${job.id} used ${job.providerId}, but ${job.slot} is locked to ${rule.activeProvider}.`,
          "Block formal use and rerun through the Image 2 adapter or mark this as an external experiment.",
          job.id,
        ),
      );
      job.issues.push("provider_policy_violation");
    }
    if (!rule.allowedModes.includes(job.requiredMode)) {
      issues.push(
        makeIssue(
          `mode-${job.id}`,
          "blocker",
          "state_gate",
          "Required mode is not allowed",
          `${job.id} requires ${job.requiredMode}; ${job.slot} allows ${rule.allowedModes.join(", ")}.`,
          "Recompile this task through ProviderTaskValidator.",
          job.id,
        ),
      );
      job.issues.push("mode_policy_violation");
    }
  }

  if (fallbackEvents.length) {
    issues.push(
      makeIssue(
        "forbidden-fallback",
        "blocker",
        "fallback",
        "Forbidden text fallback was attempted",
        `${fallbackEvents.length} event(s) show image-to-image failure falling toward text-to-image candidate generation.`,
        "Reject that reference chain. Required image-to-image jobs can only retry image-to-image or stop blocked.",
      ),
    );
  }

  return issues;
}

const manifestPath = path.join(root, "00_task/generation_manifest.json");
const shotSpecPath = path.join(root, "00_task/shot_spec.yaml");
const generatedPath = path.join(root, "manifests/generated_outputs.json");
const eventsPath = path.join(root, "manifests/generation_events.jsonl");
const assetQaPath = path.join(root, "04_reports/asset_qa.md");
const keyframeQaPath = path.join(root, "04_reports/keyframe_pair_qa.md");
const videoQaPath = path.join(root, "04_reports/video_qa.md");

const manifest = readJson(manifestPath);
const knowledgeManifest = readJson(knowledgeManifestPath, {
  schemaVersion: "0.1.0",
  manifestVersion: "empty",
  generatedAt: new Date(0).toISOString(),
  knowledgeLibraryRoot: "resources/knowledge",
  manifestHash: "empty",
  packs: [],
});
const shotSpec = readYaml(shotSpecPath);
const generated = readJson(generatedPath, { assets: {}, keyframes: {}, videos: {} });
const events = parseJsonl(eventsPath);
const assetQa = parseQaTable(assetQaPath);
const pairQa = parseQaTable(keyframeQaPath);
const manifestAssets = flattenManifestAssets(manifest);
const shotsSpec = shotSpec?.shots || [];
const jobs = collectJobs(manifestAssets, shotsSpec, generated, events);

const issues = validateJobs(jobs, events);

const expected = manifest?.generation_manifest?.expected_outputs || {};
const assetRecords = manifestAssets.map((asset) => {
  const id = assetJobId(asset);
  const entry = generatedEntryFor(generated, id);
  const qa = assetQa.get(id);
  const status = statusForAsset(asset.path, entry);
  const localIssues = [];
  if (status === "missing") localIssues.push("missing_file");
  if (qa && String(qa.Notes || "").includes("if visual audit")) localIssues.push("protocol_pass_needs_visual_audit");
  return {
    id,
    type: asset.type || "unknown",
    name: asset.asset_id || id,
    path: asset.path,
    status,
    lockedStatus: qa ? "needs_review" : asset.locked_status || "not_generated",
    providerId: providerIdForJob(id, events),
    requiredMode: requiredModeForAsset(asset),
    safeForFutureReference: false,
    dimensions: dimensionsFromGenerated(entry),
    issues: localIssues,
  };
});

const shotRecords = shotsSpec.map((shot) => {
  const startPath = path.join(root, "02_keyframes/start", `${shot.shot_id}_start.png`);
  const endPath = path.join(root, "02_keyframes/end", `${shot.shot_id}_end.png`);
  const videoPath = path.join(root, "03_videos/clips", `${shot.shot_id}.mp4`);
  const qa = pairQa.get(shot.shot_id);
  const localIssues = [];
  if (!exists(startPath)) localIssues.push("missing_start_frame");
  if (!exists(endPath)) localIssues.push("missing_end_frame");
  if (!exists(videoPath)) localIssues.push("missing_video");
  if (qa && String(qa.Notes || "").includes("auto QA only")) localIssues.push("auto_qa_not_human_approved");
  const gates = gateSet(qa);
  const hasFail = Object.values(gates).includes("FAIL");
  const status = !exists(videoPath)
    ? "video_missing"
    : hasFail
      ? "blocked"
      : "ready";
  return {
    id: shot.shot_id,
    actId: actIdForShot(shot),
    sectionId: sectionIdForShot(shot),
    title: `${shot.scene_id || "Scene"} / ${shot.view_id || "View"}`,
    storyFunction: shot.story_function || "Missing story function",
    startFrame: startPath,
    endFrame: endPath,
    videoPath: exists(videoPath) ? videoPath : undefined,
    status,
    gates,
    issues: localIssues,
  };
});

const existingAssets = assetRecords.filter((asset) => asset.status !== "missing").length;
const existingKeyframes = shotRecords.filter((shot) => exists(shot.startFrame) && exists(shot.endFrame)).length * 2;
const existingVideos = shotRecords.filter((shot) => shot.videoPath && exists(shot.videoPath)).length;
const dreaminaImageEvents = events.filter((event) => Array.isArray(event.cmd) && event.cmd[0] === "dreamina" && ["text2image", "image2image"].includes(event.cmd[1])).length;
const fallbackEvents = events.filter((event) => String(event.event || "").includes("fallback") || JSON.stringify(event).includes("fallback_text"));

if (!exists(videoQaPath)) {
  issues.push(
    makeIssue(
      "missing-video-qa",
      "warning",
      "missing_output",
      "Video QA report is not available yet",
      "The Seedance/Jimeng video adapter is parked, so no live video QA is expected in this build.",
      "Keep preview/export locked, but do not submit real Jimeng tasks during this phase.",
      videoQaPath,
    ),
  );
}

if (existingVideos < (expected.videos || shotRecords.length)) {
  issues.push(
    makeIssue(
      "videos-missing",
      "warning",
      "queue",
      "Video queue is parked",
      `${existingVideos}/${expected.videos || shotRecords.length} video clips exist. No Jimeng/Seedance jobs are submitted in this phase.`,
      "Keep the queue visible for later adapter integration; current implementation should only prepare task envelopes.",
      path.join(root, "03_videos/clips"),
    ),
  );
}

if (assetRecords.some((asset) => asset.issues.includes("protocol_pass_needs_visual_audit"))) {
  issues.push(
    makeIssue(
      "protocol-qa-only",
      "warning",
      "qa_gap",
      "Protocol QA is not visual approval",
      "Asset QA notes say future reference safety depends on later visual audit.",
      "Keep assets as needs_review until subagent or human visual audit approves them.",
    ),
  );
}

const metrics = {
  expectedAssets: (expected.character_assets || 0) + (expected.scene_master_assets || 0) + (expected.scene_view_assets || 0) + (expected.prop_assets_minimum || 0),
  existingAssets,
  expectedKeyframes: expected.keyframes || shotRecords.length * 2,
  existingKeyframes,
  expectedVideos: expected.videos || shotRecords.length,
  existingVideos,
  providerEvents: events.length,
  dreaminaImageEvents,
  forbiddenFallbackEvents: fallbackEvents.length,
};

const workflow = [
  {
    id: "production_bible",
    label: "Production Bible",
    status: exists(path.join(root, "00_task/production_bible.md")) ? "done" : "blocked",
    detail: exists(path.join(root, "00_task/production_bible.md")) ? "Production facts imported." : "Missing production bible.",
  },
  {
    id: "visual_memory",
    label: "Visual Memory",
    status: existingAssets >= metrics.expectedAssets ? "done" : "active",
    detail: `${existingAssets}/${metrics.expectedAssets} assets found.`,
  },
  {
    id: "keyframe_pairs",
    label: "Keyframe Pairs",
    status: existingKeyframes >= metrics.expectedKeyframes ? "done" : "active",
    detail: `${existingKeyframes}/${metrics.expectedKeyframes} keyframes found.`,
  },
  {
    id: "provider_policy",
    label: "Provider Policy",
    status: issues.some((issue) => issue.severity === "blocker" && ["provider_policy", "fallback"].includes(issue.type)) ? "blocked" : "done",
    detail: `${issues.filter((issue) => issue.type === "provider_policy" || issue.type === "fallback").length} policy issue(s).`,
  },
  {
    id: "videos",
    label: "Video Provider",
    status: existingVideos >= metrics.expectedVideos ? "done" : "pending",
    detail: existingVideos >= metrics.expectedVideos ? `${existingVideos}/${metrics.expectedVideos} video clips found.` : "Seedance/Jimeng adapter parked; no live submit.",
  },
  {
    id: "preview",
    label: "Preview Timeline",
    status: existingVideos >= metrics.expectedVideos && !issues.some((issue) => issue.severity === "blocker") ? "done" : "pending",
    detail: "Preview remains locked until videos and video QA pass.",
  },
];

const blocked = workflow.find((stage) => stage.status === "blocked");
const state = blocked ? `blocked_at_${blocked.id}` : "ready";
const generatedAt = new Date().toISOString();

const audit = {
  importedAt: generatedAt,
  projectTitle: manifest?.generation_manifest?.project_title || shotSpec?.project_title || "Untitled",
  projectRoot: root,
  sourceTask: manifest?.generation_manifest?.source_documents?.task || "",
  state,
  fileSnapshot: [
    ...assetRecords.filter((asset) => asset.status !== "missing").map((asset) => asset.path),
    ...shotRecords.flatMap((shot) => [shot.startFrame, shot.endFrame, shot.videoPath].filter(Boolean)),
  ],
  schemaSummary: {
    auditSchemaVersion: "0.3.0",
    coreStateVersion: "runtime-view-derived-from-audit",
    notes: [
      "TaskRun, manifest match, preflight, knowledge route, and preview events are derived by src/core/runtimeView.ts.",
      "Parked provider tasks are never submitted by this importer.",
    ],
  },
  metrics,
  providerPolicy: policy,
  workflow,
  assets: assetRecords,
  shots: shotRecords,
  jobs,
  issues,
  contactSheets: {
    assets: "/media/asset_contact_sheet.png",
    keyframes: "/media/keyframe_pair_contact_sheet.png",
  },
};
const runtimeState = buildProjectRuntimeState(audit, knowledgeManifest, generatedAt);

fs.mkdirSync(publicDir, { recursive: true });
fs.mkdirSync(mediaDir, { recursive: true });
for (const [name, source] of [
  ["asset_contact_sheet.png", path.join(root, "04_reports/contact_sheets/asset_contact_sheet.png")],
  ["keyframe_pair_contact_sheet.png", path.join(root, "04_reports/contact_sheets/keyframe_pair_contact_sheet.png")],
]) {
  if (exists(source)) fs.copyFileSync(source, path.join(mediaDir, name));
}
fs.writeFileSync(outPath, JSON.stringify(audit, null, 2));
fs.writeFileSync(stateOutPath, JSON.stringify(runtimeState, null, 2));
console.log(`Imported runtime audit: ${outPath}`);
console.log(`Imported runtime state: ${stateOutPath}`);
console.log(`State: ${state}`);
console.log(`Issues: ${issues.length}`);
