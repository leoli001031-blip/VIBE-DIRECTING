import fs from "node:fs";
import { buildExportWorkerState, executeExportWorkerPlan } from "../src/core/exportWorker.ts";
import { runExportAction } from "../src/core/exportAction.ts";
import { EXPORT_DELIVERY_CONFIRMATION_SCHEMA_VERSION } from "../src/core/exportDeliveryGate.ts";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, "utf8"));
}

function stableStringify(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
    .join(",")}}`;
}

function stableHash(value) {
  const input = stableStringify(value);
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `vck_${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

class MemoryExportAdapter {
  constructor() {
    this.files = new Map();
    this.copies = new Map();
    this.directories = new Set();
  }

  mkdir(path) {
    this.directories.add(path);
  }

  writeFile(path, content) {
    this.files.set(path, content);
  }

  copyFile(sourcePath, destinationPath) {
    this.copies.set(destinationPath, sourcePath);
  }
}

class MemoryExportBridge {
  constructor(sourceHashes = {}) {
    this.sourceHashes = sourceHashes;
    this.writes = new Map();
    this.copies = new Map();
  }

  async sandboxHashFile(filePath) {
    const hash = this.sourceHashes[filePath];
    if (!hash) throw new Error(`missing fixture hash: ${filePath}`);
    return { path: filePath, hash, size: 1 };
  }

  async sandboxWriteFile(filePath, data) {
    this.writes.set(filePath, data);
    return { written: true, path: filePath, hash: stableHash(data) };
  }

  async sandboxCopyFile(sourcePath, destinationPath) {
    this.copies.set(destinationPath, sourcePath);
    return {
      copied: true,
      sourcePath,
      path: destinationPath,
      hash: this.sourceHashes[sourcePath],
      size: 1,
    };
  }
}

function previewEvent(id, shotId, startSeconds, durationSeconds, mediaPath) {
  return {
    id,
    mode: "formal_preview",
    type: "video_clip",
    shotId,
    startSeconds,
    durationSeconds,
    mediaPath,
    qaStatus: "PASS",
  };
}

function profile(kind, readiness = "ready", includedPaths = []) {
  return {
    schemaVersion: "0.1.0",
    profileId: `export_builder_${kind}`,
    kind,
    label: kind,
    readiness,
    includedCategories: [kind],
    includedPaths,
    blockedReasons: [],
    notes: [],
    dryRunOnly: true,
    providerSubmissionForbidden: true,
  };
}

const generatedAt = "2026-05-01T00:00:00.000Z";
const events = [
  previewEvent("formal_s01", "S01", 0, 4, "outputs/videos/S01.mp4"),
  previewEvent("formal_s02", "S02", 4, 5, "outputs/videos/S02.mp4"),
];
const source = {
  schemaVersion: "0.1.0",
  generatedAt,
  draftPreview: {
    schemaVersion: "0.1.0",
    planId: "draft_preview",
    mode: "draft_preview",
    status: "draft_only",
    summary: {
      mode: "draft_preview",
      status: "draft_only",
      eventCount: events.length,
      videoClipCount: events.length,
      imageHoldCount: 0,
      blockedPlaceholderCount: 0,
      totalDurationSeconds: 9,
      blockedShotIds: [],
      blockedReasons: [],
    },
    events: events.map((event) => ({ ...event, mode: "draft_preview", id: event.id.replace("formal", "draft") })),
    blockedReasons: [],
    dryRunOnly: true,
    providerSubmissionForbidden: true,
  },
  formalPreview: {
    schemaVersion: "0.1.0",
    planId: "formal_preview",
    mode: "formal_preview",
    status: "ready",
    summary: {
      mode: "formal_preview",
      status: "ready",
      eventCount: events.length,
      videoClipCount: events.length,
      imageHoldCount: 0,
      blockedPlaceholderCount: 0,
      totalDurationSeconds: 9,
      blockedShotIds: [],
      blockedReasons: [],
    },
    events,
    blockedReasons: [],
    dryRunOnly: true,
    providerSubmissionForbidden: true,
  },
  formalPreviewGate: {
    status: "pass",
    requiredChecks: {
      noBlockedMaterial: true,
      pairQaPass: true,
      videoQaPass: true,
      manifestMatched: true,
      promotionPassed: true,
      noP0Issues: true,
      noUnknownGate: true,
      videoPresent: true,
    },
    blockedReasons: [],
  },
  roughCutProxy: {
    status: "ready",
    sourcePreviewPlanId: "formal_preview",
    totalDurationSeconds: 9,
    eventCount: 2,
    proxyOnly: true,
    notes: [],
  },
  demoPackageFacts: {
    storyboardRows: [
      {
        shotId: "S01",
        actId: "A1",
        sectionId: "opening",
        title: "Shot S01",
        storyFunction: "Open the demo",
        shotStatus: "ready",
        previewEventId: "formal_s01",
        previewEventType: "video_clip",
        durationSeconds: 4,
        mediaPath: "outputs/videos/S01.mp4",
        mediaStatus: "video",
        gateSummary: { identity: "PASS", scene: "PASS", pair: "PASS", story: "PASS", prop: "N/A", style: "PASS" },
      },
      {
        shotId: "S02",
        actId: "A1",
        sectionId: "opening",
        title: "Shot S02",
        storyFunction: "Close the demo",
        shotStatus: "ready",
        previewEventId: "formal_s02",
        previewEventType: "video_clip",
        durationSeconds: 5,
        mediaPath: "outputs/videos/S02.mp4",
        mediaStatus: "video",
        gateSummary: { identity: "PASS", scene: "PASS", pair: "PASS", story: "PASS", prop: "N/A", style: "PASS" },
      },
    ],
    selectedKeyframes: [
      {
        shotId: "S02",
        startFrame: "outputs/keyframes/S02_start.png",
        endFrame: "outputs/keyframes/S02_end.png",
        selected: true,
        reason: "selected_shot",
      },
    ],
    promptRequestPreviews: [
      {
        id: "job_prompt_S02",
        shotId: "S02",
        jobId: "job_prompt_S02",
        taskId: "job_prompt_S02",
        slot: "image.edit",
        providerId: "openai-image2-api",
        requiredMode: "image2image",
        promptPath: "prompts/S02.md",
        expectedOutputs: ["outputs/keyframes/S02_end.png"],
        actualOutputs: ["outputs/keyframes/S02_end.png"],
        dryRunOnly: true,
        providerSubmissionForbidden: true,
      },
    ],
    videoResults: [
      {
        id: "video_result_S01",
        shotId: "S01",
        sourceTaskId: "job_video_S01",
        taskId: "job_video_S01",
        submitId: "submit_s01",
        providerTaskId: "jimeng_task_s01",
        sourceReceiptId: "provider_receipt_s01",
        reviewStatus: "needs_review",
        videoPath: "outputs/videos/S01.mp4",
        firstFrameProtectedVideoPath: "outputs/videos/S01_firstframe-hold.mp4",
        outputHash: `sha256:${"1".repeat(64)}`,
        receiptPaths: ["receipts/video/S01_submit.json"],
        queueLogPaths: ["receipts/video/S01_query.jsonl"],
        resumeCommand: "dreamina query_result --submit_id=submit_s01 --download_dir=outputs/videos",
        queueAttempts: 2,
        durationSeconds: 4,
        referenceEvidence: {
          referencePolicyVersion: "storyboard_reference_scene_baseline_v1",
          storyboardReferencePath: "outputs/storyboards/S01-storyboard.png",
          sceneReferencePath: "assets/scenes/rainy-rooftop.png",
          characterReferencePaths: ["assets/characters/hina.png", "assets/characters/ren.png"],
          propReferencePaths: ["assets/props/cassette.png"],
          dialogueAudioPath: "audio/dialogue/S01.wav",
          seedanceInputRoleOrder: [
            "storyboard_reference",
            "scene_baseline",
            "character_identity",
            "prop_reference",
            "dialogue_audio",
          ],
          userFacingSummary: "分镜图只管构图和走位；视频生成再合并场景、角色、道具和对白音频。",
          directorStrategy: {
            rhythmProfile: "anime_emotion",
            rhythmLabel: "日漫情绪特写",
            rhythmReason: "情绪主要藏在眼神、手部和短暂停顿里，适合用日漫式近景/特写承接。",
            splitPolicy: "split_for_reaction",
            splitLabel: "动作后留反应",
            actionSummary: "日奈把磁带慢慢递向莲",
            modificationSummary: ["已确认：第三个镜头节奏慢一点", "已确认：最后加一个清晨空镜"],
            storyboardPromptPlanSummary: "分镜参考图负责构图、走位和动作承接。",
            videoPromptPlanSummary: "视频计划按分镜、场景、角色、道具、对白音频的职责合并。",
          },
        },
        autoPromoted: false,
        notes: ["fixture video remains review candidate"],
      },
      {
        id: "video_result_S02",
        shotId: "S02",
        sourceTaskId: "job_video_S02",
        taskId: "job_video_S02",
        submitId: "submit_s02",
        providerTaskId: "jimeng_task_s02",
        sourceReceiptId: "provider_receipt_s02",
        reviewStatus: "needs_review",
        videoPath: "outputs/videos/S02.mp4",
        outputHash: `sha256:${"2".repeat(64)}`,
        receiptPaths: ["receipts/video/S02_submit.json"],
        queueLogPaths: ["receipts/video/S02_query.jsonl"],
        durationSeconds: 5,
        autoPromoted: false,
        notes: ["fixture video remains review candidate"],
      },
    ],
    qaReports: [
      {
        id: "health_S02",
        kind: "generation_health",
        shotId: "S02",
        status: "formal_ready",
        blockers: [],
        warnings: [],
      },
      {
        id: "promotion_S02",
        kind: "qa_promotion",
        shotId: "S02",
        status: "promoted",
        blockers: [],
        warnings: [],
      },
    ],
    projectFactsSnapshot: {
      generatedAt,
      projectRoot: "project_root",
      shotCount: 2,
      selectedShotId: "S02",
      shotIds: ["S01", "S02"],
      storySectionIds: ["opening"],
    },
    naturalLanguagePlanSummary: { selectedShotId: "S02", planId: "director_plan_S02" },
    oneShotResultSummary: { taskId: "job_prompt_S02", outputPath: "outputs/keyframes/S02_end.png", providerSubmitted: false },
    roughCutProxyPlanIncluded: true,
    dryRunOnly: true,
    providerSubmissionForbidden: true,
  },
  exportProfiles: [
    profile("rough_cut", "ready", ["outputs/videos/S01.mp4", "outputs/videos/S02.mp4"]),
    profile("asset_package", "ready", ["outputs/keyframes/S01_start.png", "outputs/videos/S01.mp4"]),
    profile("storyboard_table", "ready"),
    profile("developer_archive", "ready", ["prompts/S01.md", "qa/S01.json"]),
  ],
  exportPackagePlan: {
    schemaVersion: "0.1.0",
    planId: "export_builder_package_plan",
    status: "ready",
    profiles: [],
    futureTargets: ["fcpxml_future_slot", "edl_future_slot", "premiere_pro_future_slot", "jianying_future_slot", "davinci_resolve_future_slot"],
    blockedReasons: [],
    notes: [],
    dryRunOnly: true,
    providerSubmissionForbidden: true,
  },
  phase: "phase_12_preview_export_builder",
  futureTargets: [
    { target: "fcpxml", status: "future_placeholder", enabled: false, writesFile: false, notes: [] },
    { target: "edl", status: "future_placeholder", enabled: false, writesFile: false, notes: [] },
    { target: "premiere_pro", status: "future_placeholder", enabled: false, writesFile: false, notes: [] },
    { target: "jianying", status: "future_placeholder", enabled: false, writesFile: false, notes: [] },
    { target: "davinci_resolve", status: "future_placeholder", enabled: false, writesFile: false, notes: [] },
  ],
};
source.exportPackagePlan.profiles = source.exportProfiles;

const projectLocalKnowledgePack = {
  id: "project/demo_project/research/style001",
  version: "1.0.0",
  hash: "knowledge_hash_style001",
  path: "project-knowledge/demo-project/style001.json",
  type: "project_local",
  category: "style",
  title: "本片参考方法：雨夜霓虹对白",
  summary: "用户确认后的本片参考方法，只作为原创脚本、分镜、画面提示词和 QA 的方法参考。",
  tags: ["style", "reference", "本片参考"],
  applicableTaskPurposes: ["script", "keyframe", "qa"],
  applicableProviderSlots: ["image.generate", "image.edit"],
  dependencies: [],
  conflicts: [],
  maxInjectionTokens: 760,
  trustLevel: "verified",
  verificationStatus: "verified",
  verificationReportId: "web_search#research/web_search_001.json",
  conflictAcknowledged: false,
  enabled: true,
  defaultEnabled: true,
  createdAt: generatedAt,
  updatedAt: generatedAt,
  sourcePath: "/Users/lichenhao/Desktop/new vibe directing/.vibe-runtime/research/web_search_001.json",
  snippets: [
    {
      id: "creative-method",
      title: "本片参考方法",
      summary: "method-only",
      content: "Non-linear chapters, casual dialogue under pressure, and a deliberately long source excerpt must not be exported as project facts.",
      keywords: ["dialogue", "pressure"],
      hash: "snippet_hash_creative_method",
      tokenEstimate: 32,
      sourceHeading: "本片参考方法",
    },
  ],
};

const projectVibe = {
  kind: "project_vibe_document",
  modelVersion: "project_vibe_minimal_v1",
  manifest: {
    projectId: "demo_project",
    title: "Demo Project",
    version: "0.1.0",
    createdAt: generatedAt,
    updatedAt: generatedAt,
    sourceOfTruth: "project_vibe",
    portableRoot: "project_root",
    runtimeFixtureAuthority: false,
  },
  storyFlow: {
    id: "story_flow_current",
    updatedAt: generatedAt,
    sourceOfTruth: "project_vibe",
    sections: [
      { id: "opening", title: "Opening", summary: "Demo opening", sequenceIndex: 0, shotIds: ["S01", "S02"] },
    ],
    shotOrder: ["S01", "S02"],
  },
  visualMemory: {
    id: "visual_memory_current",
    updatedAt: generatedAt,
    sourceOfTruth: "project_vibe",
    referencePolicy: {
      temporaryOutputsMayBecomeAuthority: false,
      runtimeFixturesMayBecomeAuthority: false,
      lockedAssetsRequiredForGeneration: true,
    },
    entries: [
      {
        id: "vm_asset_scene_beach",
        assetId: "asset_scene_beach",
        kind: "scene",
        label: "Beach",
        status: "locked",
        textConstraints: ["golden sunrise beach"],
        usedByShotIds: ["S01"],
        canUseAsFutureReference: true,
        sourceRefs: ["user:locked"],
      },
    ],
  },
  shots: [
    {
      id: "S01",
      sectionId: "opening",
      title: "Shot S01",
      intent: "Open the demo",
      sceneAssetIds: ["asset_scene_beach"],
      characterAssetIds: [],
      propAssetIds: [],
      durationSeconds: 4,
      status: "generated",
      sourceRefs: ["story:S01"],
    },
    {
      id: "S02",
      sectionId: "opening",
      title: "Shot S02",
      intent: "Close the demo",
      sceneAssetIds: [],
      characterAssetIds: [],
      propAssetIds: [],
      durationSeconds: 5,
      status: "generated",
      sourceRefs: ["story:S02"],
    },
  ],
  assets: [
    {
      id: "asset_scene_beach",
      kind: "scene",
      label: "Beach",
      status: "locked",
      path: "assets/scene/beach.png",
      textConstraints: ["golden sunrise beach"],
      usedByShotIds: ["S01"],
      sourceRefs: ["user:locked"],
      lockedBy: "user",
    },
    {
      id: "asset_prop_sign",
      kind: "prop",
      label: "Sign",
      status: "candidate",
      path: "assets/props/sign.png",
      textConstraints: ["small sign"],
      usedByShotIds: ["S02"],
      sourceRefs: ["agent:candidate"],
    },
    {
      id: "style_research_style001",
      kind: "style",
      label: "本片参考方法：雨夜霓虹对白",
      status: "locked",
      textConstraints: [
        "本片参考：雨夜霓虹对白节奏",
        "来源已确认：2 个外部来源；只作为原创脚本、分镜、画面提示词和复核的方法参考。",
        "致敬边界：不复制角色、台词、剧情、世界观、标志、镜头表或分镜顺序。",
        "提示词边界：使用抽象方法词和原创画面元素，不把网页摘要直接写成正式任务。",
      ],
      usedByShotIds: [],
      sourceRefs: [
        "knowledge_pack#project/demo_project/research/style001",
        "knowledge_pack_hash#knowledge_hash_style001",
        "knowledge_pack_path#project-knowledge/demo-project/style001.json",
        "web_search_evidence#web_search#research/web_search_001.json",
        "web_search_evidence_path#research/web_search_001.json",
        "web_citation#analysis.example#web_source_11111111",
        "web_citation#cinema.example#web_source_22222222",
      ],
      lockedBy: "user",
    },
  ],
  runs: [
    {
      id: "run_preview_s01",
      runKind: "agent_loop",
      status: "succeeded",
      createdAt: generatedAt,
      summary: "Preview prepared",
      sourceFactHash: "fact_hash_demo",
      affectedShotIds: ["S01"],
      producedAssetIds: [],
      evidenceRefs: ["receipts/run_preview_s01.json"],
      projectFactsMutated: true,
      runtimeFixtureUsed: false,
    },
    {
      id: "run_research_style001_20260519000000",
      runKind: "agent_loop",
      status: "succeeded",
      createdAt: generatedAt,
      summary: "用户确认本片参考：雨夜霓虹对白",
      sourceFactHash: "knowledge_hash_style001",
      affectedShotIds: [],
      producedAssetIds: ["style_research_style001"],
      evidenceRefs: [
        "knowledge_pack#project/demo_project/research/style001",
        "knowledge_pack_hash#knowledge_hash_style001",
        "web_search_evidence_path#/Users/lichenhao/Desktop/new vibe directing/.vibe-runtime/research/web_search_001.json",
        "web_citation#analysis.example#web_source_11111111",
        "Bearer tvly-test-secret",
      ],
      projectFactsMutated: true,
      runtimeFixtureUsed: false,
    },
  ],
  receipts: {
    scriptPlanningReceipts: [],
    promptKeyframePlanningReceipts: [],
    batchReceipts: [],
    reviewReceipts: [
      {
        id: "review_s01_exact",
        createdAt: "2026-05-01T00:01:00.000Z",
        status: "approved",
        reviewerId: "human_reviewer",
        humanReviewed: true,
        shotId: "S01",
        sourceReceiptId: "provider_receipt_s01",
        outputPath: "outputs/videos/S01.mp4",
        outputHash: `sha256:${"1".repeat(64)}`,
        retryRequested: false,
        lateOutput: false,
        providerSelfReportIgnored: true,
        promotionAuthorized: false,
        evidenceRefs: ["receipt#provider_receipt_s01"],
        blockers: [],
      },
      {
        id: "review_s02_exact",
        createdAt: "2026-05-01T00:02:00.000Z",
        status: "approved",
        reviewerId: "human_reviewer",
        humanReviewed: true,
        shotId: "S02",
        sourceReceiptId: "provider_receipt_s02",
        outputPath: "outputs/videos/S02.mp4",
        outputHash: `sha256:${"2".repeat(64)}`,
        retryRequested: false,
        lateOutput: false,
        providerSelfReportIgnored: true,
        promotionAuthorized: false,
        evidenceRefs: ["receipt#provider_receipt_s02"],
        blockers: [],
      },
    ],
  },
  sourceIndex: {
    id: "source_index_current",
    updatedAt: generatedAt,
    sourceOfTruth: "project_vibe",
    manifestRef: "project.vibe#manifest",
    storyFlowRef: "project.vibe#storyFlow",
    visualMemoryRef: "project.vibe#visualMemory",
    shotRefs: ["project.vibe#shots/S01", "project.vibe#shots/S02"],
    assetRefs: ["project.vibe#assets/asset_scene_beach", "project.vibe#assets/asset_prop_sign", "project.vibe#assets/style_research_style001"],
    runReceiptRefs: ["project.vibe#runs/run_preview_s01", "project.vibe#runs/run_research_style001_20260519000000"],
  },
};

const deliveryIdentity = {
  projectId: "demo_project",
  projectRoot: "/tmp/demo_project",
  projectFactHash: "fact_hash_demo_current",
};

const deliveryConfirmation = {
  schemaVersion: EXPORT_DELIVERY_CONFIRMATION_SCHEMA_VERSION,
  confirmationId: "confirm_export_demo_current",
  actionId: "export_demo_current",
  ...deliveryIdentity,
  confirmedAt: "2026-05-01T00:03:00.000Z",
};

const audioPlanning = {
  schemaVersion: "0.1.0",
  generatedAt,
  shotPlans: [
    {
      shotId: "S01",
      narrationText: "Opening narration",
      dialogueLines: [],
      voiceSourceId: "voice_father_locked",
      deliveryNotes: "Use the locked father reference.",
      ambienceBrief: "Quiet room tone.",
      bgmProfile: "No BGM for video provider.",
      musicAllowed: false,
      targetDurationSeconds: 4,
      fadeInSeconds: 0,
      fadeOutSeconds: 0,
      outputPath: "audio/narration/S01.wav",
      linkedTtsJobId: "tts_s01",
      linkedMusicJobId: null,
      audioQaStatus: "PASS",
    },
    {
      shotId: "S02",
      narrationText: "Closing narration",
      dialogueLines: [],
      voiceSourceId: "voice_father_locked",
      deliveryNotes: "Unsafe local reference paths must be redacted before export.",
      ambienceBrief: "Quiet room tone.",
      bgmProfile: "No BGM for video provider.",
      musicAllowed: false,
      targetDurationSeconds: 5,
      fadeInSeconds: 0,
      fadeOutSeconds: 0,
      outputPath: "/Users/lichenhao/Desktop/private-audio/father-reference.wav",
      linkedTtsJobId: "tts_s02",
      linkedMusicJobId: null,
      audioQaStatus: "UNKNOWN",
    },
  ],
  voiceSourceRegistry: {
    sourceCount: 1,
    placeholderCount: 0,
    plannedCount: 1,
    unavailableCount: 0,
    sources: [{ id: "voice_father_locked", label: "Father", status: "planned", kind: "tts_voice", notes: [] }],
    storesSecrets: false,
    changeTransactionRequired: true,
    liveSubmitAllowed: false,
    providerSubmissionForbidden: true,
    notes: [],
  },
  previewMix: {
    planId: "audio_preview_mix",
    generatedFromAudioPlan: true,
    eventCount: 0,
    missingOutputPathCount: 0,
    events: [],
    notes: [],
    dryRunOnly: true,
    providerSubmissionForbidden: true,
  },
  videoProviderPolicy: {
    musicAllowed: false,
    noBgmForVideoProvider: true,
    ambienceSfxPlaceholderAllowed: true,
    bgmHandledBy: "audio_plan_or_post_import",
    summary: "No BGM enters video prompts.",
  },
  providerSlots: [],
  exportPackageSummary: {
    status: "planned",
    includedInExportProfiles: ["asset_package", "developer_archive"],
    plannedCategories: ["voice_reference"],
    plannedPaths: [
      "audio/voice-reference/father.wav",
      "referenceAudioPath=/Users/lichenhao/Desktop/private-audio/father-reference.wav",
      "Bearer tvly-export-secret",
      "sk-exportsecret123456",
    ],
    blockedReasons: [],
    notes: [],
    dryRunOnly: true,
    providerSubmissionForbidden: true,
  },
  dryRunOnly: true,
  providerSubmissionForbidden: true,
  notes: [],
};

const unreviewedProjectVibe = structuredClone(projectVibe);
unreviewedProjectVibe.receipts.reviewReceipts = [];
const unreviewedPlan = buildExportWorkerState({
  source,
  projectVibe: unreviewedProjectVibe,
  projectTitle: "Demo Project",
  exportRoot: "exports/unreviewed",
  generatedAt,
  profileSelection: "all",
  delivery: { identity: deliveryIdentity },
});
assert(unreviewedPlan.deliveryGate.status === "blocked", "needs_review media must block the Delivery Gate");
assert(unreviewedPlan.deliveryGate.blockers.some((blocker) => blocker.code === "delivery_review_required"), "needs_review blocker code missing");

const legacyBooleanConfirmation = buildExportWorkerState({
  source,
  projectVibe: unreviewedProjectVibe,
  projectTitle: "Demo Project",
  exportRoot: "exports/unreviewed",
  generatedAt,
  profileSelection: "all",
  executionMode: "adapter_execution",
  confirmation: true,
  delivery: { identity: deliveryIdentity },
});
const legacyBooleanAdapter = new MemoryExportAdapter();
const legacyBooleanResult = await executeExportWorkerPlan(legacyBooleanConfirmation, legacyBooleanAdapter);
assert(!legacyBooleanResult.ok, "legacy boolean confirmation must not bypass the Delivery Gate");
assert(legacyBooleanAdapter.files.size === 0 && legacyBooleanAdapter.copies.size === 0, "blocked needs_review export must perform zero writes and copies");

const projectVibeBeforeGate = JSON.stringify(projectVibe);
const plannedState = buildExportWorkerState({
  source,
  projectVibe,
  projectLocalKnowledgePacks: [projectLocalKnowledgePack],
  audioPlanning,
  projectTitle: "Demo Project",
  exportRoot: "exports/current",
  generatedAt,
  profileSelection: "all",
  delivery: { identity: deliveryIdentity },
});

assert(plannedState.phase === "phase_27_export_worker_mvp", "phase id drifted");
assert(plannedState.scope === "export_project_io_contract", "scope must be export/project IO contract");
assert(plannedState.readiness === "planned", "plan-only ready source should produce planned state");
assert(plannedState.canExecute === false, "plan-only state must not execute");
assert(plannedState.deliveryGate.status === "ready_for_confirmation", "exact human approvals should only advance to an independent export confirmation");
assert(plannedState.deliveryGate.canPrepare === true && plannedState.deliveryGate.canExecute === false, "review approval may prepare export but cannot execute it");
assert(plannedState.deliveryGate.media.every((item) => item.reviewStatus === "approved" && item.promotionAuthorized === false), "review approval must remain separate from project-fact promotion");
assert(JSON.stringify(projectVibe) === projectVibeBeforeGate, "building the Delivery Gate must not promote or mutate Project.vibe facts");
for (const key of [
  "projectRootRelativeOnly",
  "exportScopeOnly",
  "noAbsolutePath",
  "noParentTraversal",
  "noDelete",
  "noMove",
  "noMediaRender",
  "noProviderSubmit",
  "noCredentialRead",
  "noCredentialWrite",
  "noArbitraryShell",
  "noUserFileOverwriteOutsideExport",
]) {
  assert(plannedState.hardLocks[key] === true, `hard lock ${key} must be true`);
}
assert(plannedState.hardLocks.liveSubmitAllowed === false, "live submit must remain false");

const writePaths = plannedState.entries.filter((entry) => entry.operation === "write_file").map((entry) => entry.path).sort();
assert(writePaths.includes("exports/current/export_manifest.json"), "export manifest write missing");
assert(writePaths.includes("exports/current/Project.vibe"), "Project.vibe write missing");
assert(writePaths.includes("exports/current/locked_assets.json"), "locked assets manifest write missing");
assert(writePaths.includes("exports/current/preview_media.json"), "preview media manifest write missing");
assert(writePaths.includes("exports/current/videos/video_manifest.json"), "video manifest write missing");
assert(writePaths.includes("exports/current/receipts/video/video_receipts.json"), "video receipts write missing");
assert(writePaths.includes("exports/current/video-report/summary.md"), "video report write missing");
assert(writePaths.includes("exports/current/final-video/composition_manifest.json"), "final video composition manifest write missing");
assert(writePaths.includes("exports/current/audio/manifest.json"), "audio manifest write missing");
assert(writePaths.includes("exports/current/receipts.json"), "receipts manifest write missing");
assert(writePaths.includes("exports/current/knowledge_references.json"), "project reference manifest write missing");
assert(writePaths.includes("exports/current/report.md"), "export report write missing");
assert(writePaths.includes("exports/current/storyboard_table.tsv"), "storyboard table write missing");
assert(writePaths.includes("exports/current/developer_archive.json"), "developer archive write missing");
assert(writePaths.includes("exports/current/rough_cut_timeline.json"), "rough cut timeline write missing");
assert(writePaths.includes("exports/current/asset_package_manifest.json"), "asset package manifest write missing");
assert(plannedState.entries.every((entry) => entry.path === "exports" || entry.path.startsWith("exports/")), "planned entries must stay inside exports/");
assert(plannedState.entries.every((entry) => entry.operation === "create_directory" || entry.operation === "write_file" || entry.operation === "copy_file"), "only mkdir/write/copy entries are allowed");

const executableState = buildExportWorkerState({
  source,
  projectVibe,
  projectLocalKnowledgePacks: [projectLocalKnowledgePack],
  audioPlanning,
  projectTitle: "Demo Project",
  exportRoot: "reports/exports/current",
  generatedAt,
  profileSelection: "all",
  executionMode: "adapter_execution",
  delivery: {
    identity: deliveryIdentity,
    confirmation: deliveryConfirmation,
  },
});
assert(executableState.readiness === "ready", `executable state should be ready: ${executableState.blockers.join("; ")}`);
assert(executableState.canExecute === true, "confirmed adapter execution should be executable");
assert(executableState.deliveryGate.status === "authorized", "independent export confirmation should authorize the exact current media set");

const adapter = new MemoryExportAdapter();
const result = await executeExportWorkerPlan(executableState, adapter);
assert(result.ok, `execution should pass: ${result.errors.join("; ")}`);
assert(result.executed.length === executableState.entries.length, "every planned entry should execute");
assert(adapter.directories.has("reports/exports/current"), "export directory should be created through adapter");
for (const entry of executableState.entries.filter((item) => item.operation === "write_file")) {
  assert(adapter.files.has(entry.path), `${entry.path} should be written through adapter`);
  assert(stableHash(adapter.files.get(entry.path)) === entry.contentHash, `${entry.path} contentHash must align with written content`);
  assert(entry.path.startsWith("reports/exports/current/"), `${entry.path} must stay in allowlisted export root`);
}
assert(adapter.files.size === 16, "MVP export should write Project.vibe, video records, final video/audio manifests, package manifests, project references, report, and profile manifests");
assert(adapter.copies.size === 2, "MVP export should copy existing project-relative videos into final-video");
assert(adapter.copies.get("reports/exports/current/final-video/01_S01.mp4") === "outputs/videos/S01.mp4", "S01 exact reviewed video should be copied to the stable final-video path");
assert(adapter.copies.get("reports/exports/current/final-video/02_S02.mp4") === "outputs/videos/S02.mp4", "S02 video should be copied to stable final-video path");

const noExportConfirmation = await runExportAction({ worker: plannedState });
assert(noExportConfirmation.status === "blocked", "review approval must not double as export approval");
assert(noExportConfirmation.executedCount === 0 && noExportConfirmation.writes?.length === 0, "missing export confirmation must perform zero writes");
assert(noExportConfirmation.errors?.some((error) => error.includes("delivery_confirmation_required")), "missing independent export confirmation blocker missing");

function projectWithReviewMutation(mutate) {
  const next = structuredClone(projectVibe);
  mutate(next.receipts.reviewReceipts, next);
  return next;
}

function gateForProject(nextProject, nextSource = source) {
  return buildExportWorkerState({
    source: nextSource,
    projectVibe: nextProject,
    projectTitle: "Demo Project",
    exportRoot: "exports/gate-matrix",
    generatedAt,
    profileSelection: "all",
    delivery: { identity: deliveryIdentity },
  }).deliveryGate;
}

for (const [label, mutate] of [
  ["outputHash", (receipts) => { receipts[0].outputHash = `sha256:${"9".repeat(64)}`; }],
  ["sourceReceiptId", (receipts) => { receipts[0].sourceReceiptId = "provider_receipt_other"; }],
  ["shotId", (receipts) => { receipts[0].shotId = "S99"; }],
  ["outputPath", (receipts) => { receipts[0].outputPath = "outputs/videos/S01_replaced.mp4"; }],
]) {
  const mismatchedGate = gateForProject(projectWithReviewMutation(mutate));
  assert(mismatchedGate.status === "blocked", `${label} mismatch must invalidate the old approval`);
  assert(mismatchedGate.blockers.some((blocker) => blocker.code === "delivery_review_identity_mismatch"), `${label} mismatch blocker code missing`);
}

const nonHumanGate = gateForProject(projectWithReviewMutation((receipts) => {
  receipts[0].humanReviewed = false;
}));
assert(nonHumanGate.status === "blocked", "provider or automated approval must not authorize delivery");
assert(nonHumanGate.blockers.some((blocker) => blocker.code === "delivery_review_not_human"), "non-human review blocker missing");

for (const [status, blockerCode] of [
  ["rejected", "delivery_review_rejected"],
  ["retry_requested", "delivery_review_retry_requested"],
  ["needs_review", "delivery_review_required"],
]) {
  const decisionGate = gateForProject(projectWithReviewMutation((receipts) => {
    receipts.push({
      ...receipts[0],
      id: `review_s01_${status}_latest`,
      createdAt: "2026-05-01T00:04:00.000Z",
      status,
      humanReviewed: true,
      retryRequested: status === "retry_requested",
      promotionAuthorized: false,
    });
  }));
  assert(decisionGate.status === "blocked", `latest ${status} decision must block delivery`);
  assert(decisionGate.blockers.some((blocker) => blocker.code === blockerCode), `${status} blocker code missing`);
}

const missingVideoSource = structuredClone(source);
missingVideoSource.demoPackageFacts.videoResults[0].videoPath = undefined;
const missingVideoGate = gateForProject(projectVibe, missingVideoSource);
assert(missingVideoGate.status === "blocked", "missing video must block formal delivery");
assert(missingVideoGate.blockers.some((blocker) => blocker.code === "delivery_media_missing"), "missing video blocker code missing");

const staleConfirmation = {
  ...deliveryConfirmation,
  projectFactHash: "fact_hash_before_edit",
};
const staleConfirmationAction = await runExportAction({
  worker: plannedState,
  deliveryConfirmation: staleConfirmation,
});
assert(staleConfirmationAction.status === "blocked", "a stale project-fact confirmation must not authorize export");
assert(staleConfirmationAction.executedCount === 0, "stale confirmation must perform zero operations");
assert(staleConfirmationAction.errors?.some((error) => error.includes("delivery_confirmation_fact_hash_mismatch")), "stale fact blocker code missing");

const projectRoot = deliveryIdentity.projectRoot;
const exactSourceHashes = {
  [`${projectRoot}/outputs/videos/S01.mp4`]: "1".repeat(64),
  [`${projectRoot}/outputs/videos/S02.mp4`]: "2".repeat(64),
};
const mismatchedMediaBridge = new MemoryExportBridge({
  ...exactSourceHashes,
  [`${projectRoot}/outputs/videos/S01.mp4`]: "9".repeat(64),
});
const mismatchedMediaAction = await runExportAction({
  worker: plannedState,
  projectRoot,
  bridge: mismatchedMediaBridge,
  deliveryConfirmation,
});
assert(mismatchedMediaAction.status === "blocked", "a replaced media file must fail hash preflight");
assert(mismatchedMediaBridge.writes.size === 0 && mismatchedMediaBridge.copies.size === 0, "media hash mismatch must fail before any write or copy");
assert(mismatchedMediaAction.errors?.some((error) => error.includes("delivery_media_hash_mismatch")), "physical media hash mismatch blocker missing");

const liveBridge = new MemoryExportBridge(exactSourceHashes);
const liveExportAction = await runExportAction({
  worker: plannedState,
  projectRoot,
  bridge: liveBridge,
  deliveryConfirmation,
});
assert(liveExportAction.status === "ready", `exact confirmed export should succeed: ${(liveExportAction.errors || []).join("; ")}`);
assert(liveExportAction.deliveryReceipt?.executionMode === "live", "filesystem export receipt must declare live local execution");
assert(liveExportAction.deliveryReceipt?.projectId === deliveryIdentity.projectId, "delivery receipt projectId drifted");
assert(liveExportAction.deliveryReceipt?.projectRoot === deliveryIdentity.projectRoot, "delivery receipt projectRoot drifted");
assert(liveExportAction.deliveryReceipt?.projectFactHash === deliveryIdentity.projectFactHash, "delivery receipt fact hash drifted");
assert(liveExportAction.deliveryReceipt?.actionId === deliveryConfirmation.actionId, "delivery receipt actionId drifted");
assert(liveExportAction.deliveryReceipt?.confirmationId === deliveryConfirmation.confirmationId, "delivery receipt confirmationId drifted");
assert(liveExportAction.deliveryReceipt?.reviewBindings.length === 2, "delivery receipt must bind every approved review receipt and media identity");
assert(liveExportAction.deliveryReceipt?.reviewBindings.every((binding) => binding.reviewReceiptId && binding.shotId && binding.sourceReceiptId && binding.outputHash), "delivery receipt review identity is incomplete");
assert(liveExportAction.deliveryReceipt?.outputs.length === liveBridge.writes.size + liveBridge.copies.size, "delivery receipt must list only actual written and copied outputs");

const duplicateBridge = new MemoryExportBridge(exactSourceHashes);
const duplicateAction = await runExportAction({
  worker: plannedState,
  projectRoot,
  bridge: duplicateBridge,
  deliveryConfirmation,
  completedDeliveryReceipts: [liveExportAction.deliveryReceipt],
});
assert(duplicateAction.status === "blocked", "the same terminal export action must not execute twice");
assert(duplicateBridge.writes.size === 0 && duplicateBridge.copies.size === 0, "duplicate terminal action must perform zero writes and copies");
assert(duplicateAction.errors?.some((error) => error.includes("delivery_action_already_completed")), "duplicate action blocker missing");

const corruptReceiptBridge = new MemoryExportBridge(exactSourceHashes);
const corruptReceiptAction = await runExportAction({
  worker: plannedState,
  projectRoot,
  bridge: corruptReceiptBridge,
  deliveryConfirmation,
  completedDeliveryReceipts: [{ schemaVersion: "export_delivery_receipt/0.1.0", actionId: deliveryConfirmation.actionId }],
});
assert(corruptReceiptAction.status === "blocked", "corrupt delivery receipt must fail closed");
assert(corruptReceiptBridge.writes.size === 0 && corruptReceiptBridge.copies.size === 0, "corrupt receipt must fail before adapter mutation");
assert(corruptReceiptAction.errors?.some((error) => error.includes("delivery_receipt_invalid")), "corrupt receipt blocker missing");

const exportedProject = JSON.parse(adapter.files.get("reports/exports/current/Project.vibe"));
assert(exportedProject.manifest.title === "Demo Project", "Project.vibe must be included in the MVP package");
assert(JSON.stringify(exportedProject).includes("style_research_style001"), "Project.vibe export must include the locked project reference asset");
assert(!JSON.stringify(exportedProject).includes("/Users/lichenhao"), "Project.vibe export must not leak local absolute paths");
assert(!/tvly-test-secret|bearer\s+tvly/i.test(JSON.stringify(exportedProject)), "Project.vibe export must not leak web-search credentials");
const lockedAssets = JSON.parse(adapter.files.get("reports/exports/current/locked_assets.json"));
assert(lockedAssets.lockedAssets.length === 2, "locked asset manifest must include locked assets and user-saved project references");
assert(lockedAssets.lockedAssets[0].path === "assets/scene/beach.png", "locked asset path must be preserved as project-root-relative");
const previewMedia = JSON.parse(adapter.files.get("reports/exports/current/preview_media.json"));
assert(previewMedia.media.length === 2, "preview media manifest must include active preview media");
const videoManifest = JSON.parse(adapter.files.get("reports/exports/current/videos/video_manifest.json"));
assert(videoManifest.summary.total === 2, "video manifest must include two video rows");
assert(videoManifest.summary.needsReview === 0 && videoManifest.summary.approved === 2, "video manifest must expose only exact human-approved review receipts");
assert(videoManifest.videos.every((video) => video.reviewLabel === "已通过" && video.autoPromoted === false), "approved videos must remain non-promoted project candidates");
assert(videoManifest.videos[0].referenceEvidence.storyboardReferencePath === "outputs/storyboards/S01-storyboard.png", "video manifest must export storyboard reference evidence");
assert(videoManifest.videos[0].referenceEvidence.sceneReferencePath === "assets/scenes/rainy-rooftop.png", "video manifest must export scene/weather reference evidence");
assert(videoManifest.videos[0].referenceEvidence.characterReferencePaths.length === 2, "video manifest must export character reference evidence");
assert(videoManifest.videos[0].referenceEvidence.propReferencePaths[0] === "assets/props/cassette.png", "video manifest must export prop reference evidence");
assert(videoManifest.videos[0].referenceEvidence.dialogueAudioPath === "audio/dialogue/S01.wav", "video manifest must export dialogue audio reference evidence");
assert(videoManifest.videos[0].referenceEvidence.seedanceInputRoleOrder.join(",") === "storyboard_reference,scene_baseline,character_identity,prop_reference,dialogue_audio", "video manifest must preserve Seedance input role order evidence");
assert(videoManifest.videos[0].referenceEvidence.directorStrategy.rhythmLabel === "日漫情绪特写", "video manifest must export user-facing rhythm label");
assert(videoManifest.videos[0].referenceEvidence.directorStrategy.rhythmReason.includes("眼神"), "video manifest must export rhythm reason");
assert(videoManifest.videos[0].referenceEvidence.directorStrategy.modificationSummary.length === 2, "video manifest must export confirmed director modification summary");
assert(videoManifest.videos[1].referenceEvidence === undefined, "old video rows without reference evidence must remain compatible");
const videoReceipts = JSON.parse(adapter.files.get("reports/exports/current/receipts/video/video_receipts.json"));
assert(videoReceipts.queuePolicy.defaultConcurrentSubmissions === 1, "video receipts must document Jimeng single-concurrency default");
assert(videoReceipts.items.length === 2, "video receipts must mirror video result rows");
const videoReport = adapter.files.get("reports/exports/current/video-report/summary.md");
assert(videoReport.includes("待复核: 0") && videoReport.includes("已通过: 2") && videoReport.includes("缺失: 0"), "video report must summarize review states");
assert(videoReport.includes("分镜参考：outputs/storyboards/S01-storyboard.png"), "video report must explain storyboard reference in user language");
assert(videoReport.includes("场景/天气参考：assets/scenes/rainy-rooftop.png"), "video report must explain scene/weather reference in user language");
assert(videoReport.includes("角色参考：assets/characters/hina.png, assets/characters/ren.png"), "video report must explain character references in user language");
assert(videoReport.includes("道具参考：assets/props/cassette.png"), "video report must explain prop references in user language");
assert(videoReport.includes("声音参考：audio/dialogue/S01.wav"), "video report must explain audio reference in current user-facing language");
assert(videoReport.includes("节奏：日漫情绪特写"), "video report must include rhythm label in user language");
assert(videoReport.includes("已确认修改：") && videoReport.includes("第三个镜头节奏慢一点") && videoReport.includes("最后加一个清晨空镜"), "video report must include confirmed director modifications");
const finalVideoManifest = JSON.parse(adapter.files.get("reports/exports/current/final-video/composition_manifest.json"));
assert(finalVideoManifest.renderedFinalVideo === false, "final video manifest must not pretend a stitched final render exists");
assert(finalVideoManifest.copyItems.length === 2, "final video manifest must include copy items");
assert(finalVideoManifest.copyItems[0].stablePath === "final-video/01_S01.mp4", "final video manifest must use stable final-video paths");
assert(finalVideoManifest.copyItems[0].sourceHash === `sha256:${"1".repeat(64)}`, "final video manifest must record source hash");
assert(!JSON.stringify(finalVideoManifest).includes("/Users/lichenhao"), "final video manifest must not leak local absolute paths");
assert(!/Bearer|tvly-|sk-exportsecret/i.test(JSON.stringify(finalVideoManifest)), "final video manifest must not leak audio secret-like refs");
const audioManifest = JSON.parse(adapter.files.get("reports/exports/current/audio/manifest.json"));
assert(audioManifest.narrationDirectory === "audio/narration", "audio manifest must reserve narration directory");
assert(audioManifest.voiceReferenceDirectory === "audio/voice-reference", "audio manifest must reserve voice-reference directory");
assert(audioManifest.localTtsEndpointPlanned === true && audioManifest.cloudTtsDependency === false, "audio manifest must reserve local IndexTTS without cloud TTS dependency");
assert(audioManifest.plannedNarrationPaths.includes("audio/narration/S01.wav"), "audio manifest must preserve safe narration paths");
assert(audioManifest.plannedVoiceReferencePaths.includes("audio/voice-reference/father.wav"), "audio manifest must preserve safe voice-reference paths");
assert(!JSON.stringify(audioManifest).includes("/Users/lichenhao"), "audio manifest must not leak local reference audio paths");
assert(!/Bearer|tvly-|sk-exportsecret/i.test(JSON.stringify(audioManifest)), "audio manifest must not leak raw secret-like audio refs");
const receipts = JSON.parse(adapter.files.get("reports/exports/current/receipts.json"));
assert(receipts.projectRuns.length === 2, "receipts manifest must include Project.vibe run receipts");
assert(receipts.receiptCount >= 5, "receipts manifest must count runs, QA reports, and request previews");
const knowledgeReferences = JSON.parse(adapter.files.get("reports/exports/current/knowledge_references.json"));
assert(knowledgeReferences.kind === "project_local_knowledge_references", "project reference manifest kind missing");
assert(knowledgeReferences.summary.referenceCount === 1, "project reference manifest must include one saved project reference");
assert(knowledgeReferences.references[0].assetId === "style_research_style001", "project reference manifest must bind to the style research asset");
assert(knowledgeReferences.references[0].runReceiptIds.includes("run_research_style001_20260519000000"), "project reference manifest must include research run receipt");
assert(knowledgeReferences.references[0].knowledgePacks[0].id === "project/demo_project/research/style001", "project reference manifest must include pack source refs");
assert(knowledgeReferences.references[0].citationHashes.some((item) => item.hash === "web_source_11111111"), "project reference manifest must include web-search citation hashes");
assert(knowledgeReferences.references[0].evidenceRefs.length >= 1, "project reference manifest must include web-search evidence refs");
assert(knowledgeReferences.projectLocalPacks[0].snippetHashes[0].hash === "snippet_hash_creative_method", "project reference manifest must include pack snippet hashes");
const knowledgeReferencesText = JSON.stringify(knowledgeReferences);
assert(!knowledgeReferencesText.includes("Non-linear chapters"), "project reference manifest must not export raw web snippets");
assert(!knowledgeReferencesText.includes("/Users/lichenhao"), "project reference manifest must not leak local absolute paths");
assert(!/tvly-test-secret|bearer\s+tvly/i.test(knowledgeReferencesText), "project reference manifest must not leak API keys");
assert(knowledgeReferences.localAbsolutePathsIncluded === false && knowledgeReferences.credentialMaterialIncluded === false, "project reference manifest must declare redaction policy");
const report = adapter.files.get("reports/exports/current/report.md");
assert(report.includes("MVP Export Report") && report.includes("Locked assets: 2") && report.includes("Project references: 1"), "MVP export report must summarize package contents");
assert(report.includes("Video review: 待复核 0 / 已通过 2 / 缺失 0"), "MVP export report must summarize video review state");
assert(report.includes("参考证据: 1"), "MVP export report must count reference evidence rows in user language");
assert(report.includes("分镜参考：outputs/storyboards/S01-storyboard.png"), "MVP export report must include readable reference evidence");
assert(report.includes("导演策略:") && report.includes("节奏：日漫情绪特写"), "MVP export report must include readable director strategy");
const exportManifest = JSON.parse(adapter.files.get("reports/exports/current/export_manifest.json"));
assert(exportManifest.mvpPackage.projectVibeIncluded === true, "export manifest must declare Project.vibe inclusion");
assert(exportManifest.mvpPackage.lockedAssetCount === 2, "export manifest must summarize locked assets");
assert(exportManifest.mvpPackage.previewMediaCount === 2, "export manifest must summarize preview media");
assert(exportManifest.mvpPackage.videoResultCount === 2, "export manifest must summarize videos");
assert(exportManifest.mvpPackage.videoNeedsReviewCount === 0 && exportManifest.mvpPackage.videoApprovedCount === 2, "export manifest must count exact approved videos");
assert(exportManifest.mvpPackage.finalVideoCopyCount === 2, "export manifest must summarize final-video copies");
assert(exportManifest.mvpPackage.referenceEvidenceCount === 1, "export manifest must summarize reference evidence rows");
assert(exportManifest.mvpPackage.videoReportIncluded === true, "export manifest must declare video report inclusion");
assert(exportManifest.mvpPackage.finalVideoManifestIncluded === true, "export manifest must declare final video manifest inclusion");
assert(exportManifest.mvpPackage.audioManifestIncluded === true, "export manifest must declare audio manifest inclusion");
assert(exportManifest.mvpPackage.knowledgeReferenceCount === 1, "export manifest must summarize project references");
const storyboardText = adapter.files.get("reports/exports/current/storyboard_table.tsv");
assert(storyboardText.includes("story_function") && storyboardText.includes("Open the demo"), "storyboard table must include demo storyboard facts");
const assetManifest = JSON.parse(adapter.files.get("reports/exports/current/asset_package_manifest.json"));
assert(assetManifest.selectedKeyframes[0].shotId === "S02", "asset package manifest must include selected keyframes");
assert(assetManifest.projectFactsSnapshot.selectedShotId === "S02", "asset package manifest must include project facts snapshot");
const developerManifest = JSON.parse(adapter.files.get("reports/exports/current/developer_archive.json"));
assert(developerManifest.promptRequestPreviews[0].promptPath === "prompts/S02.md", "developer archive must include prompt/request previews");
assert(developerManifest.qaReports.length === 2, "developer archive must include QA reports");
assert(developerManifest.naturalLanguagePlanSummary.planId === "director_plan_S02", "developer archive must include natural-language plan summary");
assert(developerManifest.oneShotResultSummary.providerSubmitted === false, "developer archive must preserve one-shot dry-run result summary");

const absoluteRoot = buildExportWorkerState({ source, exportRoot: "/tmp/exports/current", generatedAt, executionMode: "adapter_execution", confirmation: true });
assert(absoluteRoot.readiness === "blocked", "absolute export root must be blocked");
assert(absoluteRoot.blockers.some((blocker) => blocker.includes("project-root-relative")), "absolute path blocker missing");
assert(!(await executeExportWorkerPlan(absoluteRoot, new MemoryExportAdapter())).ok, "absolute path execution must fail closed");

const traversalRoot = buildExportWorkerState({ source, exportRoot: "exports/../outside", generatedAt, executionMode: "adapter_execution", confirmation: true });
assert(traversalRoot.readiness === "blocked", "parent traversal export root must be blocked");
assert(traversalRoot.blockers.some((blocker) => blocker.includes("project-root-relative")), "parent traversal blocker missing");

const outsideRoot = buildExportWorkerState({ source, exportRoot: "artifacts/current", generatedAt, executionMode: "adapter_execution", confirmation: true });
assert(outsideRoot.readiness === "blocked", "outside export scope root must be blocked");
assert(outsideRoot.blockers.some((blocker) => blocker.includes("exports/ or reports/exports/")), "outside export scope blocker missing");

const tamperedEntry = structuredClone(executableState);
const storyboardWrite = tamperedEntry.entries.find((entry) => entry.path.endsWith("storyboard_table.tsv"));
storyboardWrite.content = `${storyboardWrite.content}tampered\n`;
const tamperedEntryResult = await executeExportWorkerPlan(tamperedEntry, new MemoryExportAdapter());
assert(!tamperedEntryResult.ok, "tampered content must fail closed");
assert(tamperedEntryResult.errors.some((error) => error.includes("contentHash does not match")), "tampered content hash error missing");

const tamperedPath = structuredClone(executableState);
tamperedPath.entries.push({
  id: "write_outside",
  kind: "developer_archive",
  operation: "write_file",
  path: "exports/current/not_allowed.txt",
  content: "not allowed\n",
  contentHash: stableHash("not allowed\n"),
  mimeType: "application/json",
  canExecute: true,
  projectRootRelative: true,
  notes: [],
});
const tamperedPathAdapter = new MemoryExportAdapter();
const tamperedPathResult = await executeExportWorkerPlan(tamperedPath, tamperedPathAdapter);
assert(!tamperedPathResult.ok, "tampered extra path must fail closed");
assert(!tamperedPathAdapter.files.has("exports/current/not_allowed.txt"), "tampered path must not reach adapter");
assert(tamperedPathResult.errors.some((error) => error.includes("allowlisted") || error.includes("allowed")), "tampered path allowlist error missing");

const tamperedHardLock = structuredClone(executableState);
tamperedHardLock.hardLocks.noProviderSubmit = false;
const tamperedHardLockResult = await executeExportWorkerPlan(tamperedHardLock, new MemoryExportAdapter());
assert(!tamperedHardLockResult.ok, "tampered hard lock must fail closed");
assert(tamperedHardLockResult.errors.some((error) => error.includes("hard lock noProviderSubmit")), "tampered hard lock error missing");

const providerSubmit = buildExportWorkerState({ source, exportRoot: "exports/current", generatedAt, providerSubmitRequested: true });
assert(providerSubmit.readiness === "blocked", "provider submit request must block");
const credentialRead = buildExportWorkerState({ source, exportRoot: "exports/current", generatedAt, credentialReadRequested: true });
assert(credentialRead.readiness === "blocked", "credential read request must block");
const credentialWrite = buildExportWorkerState({ source, exportRoot: "exports/current", generatedAt, credentialWriteRequested: true });
assert(credentialWrite.readiness === "blocked", "credential write request must block");
const credentialSource = buildExportWorkerState({ source: { ...source, apiKey: "blocked" }, exportRoot: "exports/current", generatedAt });
assert(credentialSource.readiness === "blocked", "credential key in source must block");
const shell = buildExportWorkerState({ source, exportRoot: "exports/current", generatedAt, arbitraryShellRequested: true });
assert(shell.readiness === "blocked", "arbitrary shell request must block");
const render = buildExportWorkerState({ source, exportRoot: "exports/current", generatedAt, mediaRenderRequested: true });
assert(render.readiness === "blocked", "media render request must block");
const copyMoveDelete = buildExportWorkerState({ source, exportRoot: "exports/current", generatedAt, requestedOperations: ["copy_file", "move_file", "delete_file", "render_media"] });
assert(copyMoveDelete.readiness === "blocked", "copy/move/delete/render operations must block");
const liveSubmit = buildExportWorkerState({ source, exportRoot: "exports/current", generatedAt, liveSubmitRequested: true });
assert(liveSubmit.readiness === "blocked", "live submit request must block");
const futureNle = buildExportWorkerState({ source, exportRoot: "exports/current", generatedAt, futureNleTargetRequested: true });
assert(futureNle.readiness === "blocked", "future NLE generation request must block");
const enabledFutureTarget = structuredClone(source);
enabledFutureTarget.futureTargets[0].enabled = true;
const enabledFutureState = buildExportWorkerState({ source: enabledFutureTarget, exportRoot: "exports/current", generatedAt });
assert(enabledFutureState.readiness === "blocked", "enabled future NLE target must block");
const absoluteReferenceSource = structuredClone(source);
absoluteReferenceSource.exportProfiles[1].includedPaths.push("/tmp/outside.png");
const absoluteReferenceState = buildExportWorkerState({ source: absoluteReferenceSource, exportRoot: "exports/current", generatedAt });
assert(absoluteReferenceState.readiness === "blocked", "absolute package reference paths must block export planning");
assert(absoluteReferenceState.blockers.some((blocker) => blocker.includes("project-root-relative")), "absolute reference path blocker missing");
const absoluteVideoSource = structuredClone(source);
absoluteVideoSource.demoPackageFacts.videoResults[0].videoPath = "/Users/lichenhao/Desktop/raw-provider/S01.mp4";
absoluteVideoSource.demoPackageFacts.videoResults[0].firstFrameProtectedVideoPath = undefined;
const absoluteVideoState = buildExportWorkerState({
  source: absoluteVideoSource,
  projectVibe,
  exportRoot: "exports/current",
  generatedAt,
  executionMode: "adapter_execution",
  confirmation: true,
});
const absoluteVideoManifest = absoluteVideoState.entries.find((entry) => entry.path.endsWith("final-video/composition_manifest.json"));
assert(absoluteVideoManifest?.content && !absoluteVideoManifest.content.includes("/Users/lichenhao"), "absolute source video path must be redacted from final-video manifest");
assert(absoluteVideoState.manifest.mediaFiles.length === 1, "absolute source video must not produce a copy entry");
assert(!executableState.entries.some((entry) => /\.(fcpxml|edl|prproj|drp|xml)$/i.test(entry.path)), "future NLE files must not be generated");

const schema = readJson("schemas/export_worker.schema.json");
assert(schema.properties.phase.const === "phase_27_export_worker_mvp", "schema phase const missing");
assert(schema.properties.scope.const === "export_project_io_contract", "schema scope const missing");
assert(schema.required.includes("deliveryGate"), "schema must require the structured Delivery Gate");
assert(schema.$defs.operation.enum.length === 3, "schema must allow only create_directory/write_file/copy_file");
for (const [key, expected] of Object.entries(executableState.hardLocks)) {
  assert(schema.$defs.hardLocks.required.includes(key), `schema hard lock ${key} must be required`);
  assert(schema.$defs.hardLocks.properties[key].const === expected, `schema hard lock ${key} drifted`);
}

const sourceText = fs.readFileSync("src/core/exportWorker.ts", "utf8");
const localProjectionSource = fs.readFileSync("src/core/localPreviewExportProjection.ts", "utf8");
const exportActionSource = fs.readFileSync("src/core/exportAction.ts", "utf8");
assert(!/previewApprovalReceipt|projectVibeWithPreviewApprovals|approved\|已通过/.test(localProjectionSource), "local export projection must not synthesize review receipts from display copy");
assert(/sourceReceiptId: item\.sourceReceiptId[\s\S]*outputHash: item\.outputHash[\s\S]*reviewReceiptId: item\.reviewReceiptId/.test(localProjectionSource), "local export projection must preserve exact media review identity");
assert(/sandboxHashFile[\s\S]*delivery_media_hash_mismatch[\s\S]*executeExportWorkerPlan/.test(exportActionSource), "real export must hash reviewed media before adapter writes");
for (const forbidden of [
  /from\s+["']node:fs["']/,
  /from\s+["']fs["']/,
  /child_process/,
  /\bspawn\s*\(/,
  /\bexec(?:File|Sync)?\s*\(/,
  /\bfetch\s*\(/,
  /fs\.(?:writeFile|writeFileSync|mkdir|mkdirSync)\s*\(/,
]) {
  assert(!forbidden.test(sourceText), `exportWorker source contains forbidden runtime primitive: ${forbidden}`);
}

console.log(
  `Export Worker tests passed: ${executableState.entries.length} entries, ${result.executed.length} executed, ${adapter.files.size} text manifest(s).`,
);
