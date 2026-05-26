import type {
  AuditIssue,
  AudioPlanningState,
  ExportPackagePlan,
  ExportProfile,
  ExportReadinessStatus,
  FormalPreviewGate,
  GenerationHealthReport,
  GenerationJob,
  GateSet,
  PreviewEvent,
  PreviewPlan,
  PreviewPlanStatus,
  ProjectPreviewExportState,
  QaPromotionReport,
  RoughCutProxyPlan,
  ShotRecord,
  TaskRun,
  DemoPackageFacts,
  DemoPackageMediaStatus,
  DemoPackageDirectorStrategyEvidence,
  DemoPackageReferenceEvidence,
  DemoPackageVideoResult,
} from "./types";
import { SEEDANCE_ALL_AROUND_REFERENCE_ORDER, STORYBOARD_REFERENCE_PIPELINE_VERSION } from "./storyboardReferencePipeline";

export const exportBuilderSchemaVersion = "0.1.0";

export type ExportBuilderFutureTargetKind =
  | "fcpxml"
  | "edl"
  | "premiere_pro"
  | "jianying"
  | "davinci_resolve";

export interface ExportBuilderShotMedia {
  shotId: string;
  imagePath?: string;
  videoPath?: string;
  durationSeconds?: number;
  manifestMatched?: boolean;
  promotionPassed?: boolean;
  videoQaPass?: boolean;
  blockedReason?: string;
}

export interface ExportBuilderFutureTarget {
  target: ExportBuilderFutureTargetKind;
  status: "future_placeholder";
  enabled: false;
  writesFile: false;
  notes: string[];
}

export interface ExportBuilderFileMutationPlan {
  copyFiles: false;
  moveFiles: false;
  writeFiles: false;
  renderMedia: false;
  createDirectories: false;
  plannedMutations: [];
  notes: string[];
}

export interface ExportBuilderAudioPolicy {
  videoProviderBgmAllowed: false;
  bgmHandledBy: "audio_plan_or_export_plan";
  bgmIncludedInVideoPrompt: false;
  exportCategories: string[];
  plannedAudioPaths: string[];
  notes: string[];
}

export interface ExportBuilderState extends ProjectPreviewExportState {
  phase: "phase_12_preview_export_builder";
  futureTargets: ExportBuilderFutureTarget[];
  fileMutationPlan: ExportBuilderFileMutationPlan;
  audioPolicy: ExportBuilderAudioPolicy;
  dryRunOnly: true;
  noFileMutation: true;
  providerSubmissionForbidden: true;
  liveSubmitAllowed: false;
  notes: string[];
}

export interface BuildExportBuilderStateInput {
  generatedAt: string;
  shots: ShotRecord[];
  shotMedia?: ExportBuilderShotMedia[];
  previewEvents?: PreviewEvent[];
  jobs?: GenerationJob[];
  taskRuns?: TaskRun[];
  generationHealthReports?: GenerationHealthReport[];
  qaPromotionReports?: QaPromotionReport[];
  audioPlanning?: AudioPlanningState;
  issues?: AuditIssue[];
  defaultImageHoldSeconds?: number;
  selectedShotId?: string;
  projectRoot?: string;
  naturalLanguagePlanSummary?: unknown;
  oneShotResultSummary?: unknown;
}

function safeId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]+/g, "_");
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) => left.localeCompare(right));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function totalDuration(events: PreviewEvent[]): number {
  return events.reduce((max, event) => Math.max(max, event.startSeconds + event.durationSeconds), 0);
}

function gateValues(gates: GateSet): string[] {
  return [gates.identity, gates.scene, gates.pair, gates.story, gates.prop, gates.style];
}

function allVideoQaGatesPass(gates: GateSet): boolean {
  return gateValues(gates).every((gate) => gate === "PASS" || gate === "N/A");
}

function hasUnknownGate(gates: GateSet): boolean {
  return gateValues(gates).some((gate) => gate === "UNKNOWN");
}

function hasP0Issue(issues: AuditIssue[], shotId?: string): boolean {
  return issues.some((issue) => {
    const looksP0 = issue.severity === "blocker" || /\bP0\b/i.test(`${issue.id} ${issue.title} ${issue.detail}`);
    return looksP0 && (!shotId || issue.target === shotId || Boolean(issue.target?.includes(shotId)));
  });
}

function durationForShot(
  shot: ShotRecord,
  media: ExportBuilderShotMedia | undefined,
  previewEvents: PreviewEvent[],
  defaultImageHoldSeconds: number,
): number {
  const existingEvent = previewEvents.find((event) => event.shotId === shot.id && event.mode === "draft_preview");
  return media?.durationSeconds || existingEvent?.durationSeconds || defaultImageHoldSeconds;
}

function imagePathForShot(shot: ShotRecord, media: ExportBuilderShotMedia | undefined, previewEvents: PreviewEvent[]): string | undefined {
  return (
    media?.imagePath ||
    previewEvents.find((event) => event.shotId === shot.id && event.type === "image_hold")?.mediaPath ||
    shot.startFrame ||
    shot.endFrame
  );
}

function videoPathForShot(shot: ShotRecord, media: ExportBuilderShotMedia | undefined, previewEvents: PreviewEvent[]): string | undefined {
  return (
    media?.videoPath ||
    shot.videoPath ||
    previewEvents.find((event) => event.shotId === shot.id && event.type === "video_clip")?.mediaPath
  );
}

function summarizePreview(
  mode: PreviewPlan["mode"],
  status: PreviewPlanStatus,
  events: PreviewEvent[],
  blockedReasons: string[],
): PreviewPlan["summary"] {
  return {
    mode,
    status,
    eventCount: events.length,
    videoClipCount: events.filter((event) => event.type === "video_clip").length,
    imageHoldCount: events.filter((event) => event.type === "image_hold").length,
    blockedPlaceholderCount: events.filter((event) => event.type === "blocked_placeholder").length,
    totalDurationSeconds: totalDuration(events),
    blockedShotIds: uniqueSorted(events.filter((event) => event.type === "blocked_placeholder").map((event) => event.shotId || "")),
    blockedReasons: uniqueSorted(blockedReasons),
  };
}

function buildPreviewPlan(
  planId: string,
  mode: PreviewPlan["mode"],
  status: PreviewPlanStatus,
  events: PreviewEvent[],
  blockedReasons: string[],
): PreviewPlan {
  return {
    schemaVersion: exportBuilderSchemaVersion,
    planId,
    mode,
    status,
    summary: summarizePreview(mode, status, events, blockedReasons),
    events,
    blockedReasons: uniqueSorted(blockedReasons),
    dryRunOnly: true,
    providerSubmissionForbidden: true,
  };
}

function buildDraftPreview(input: BuildExportBuilderStateInput): PreviewPlan {
  const mediaByShot = new Map((input.shotMedia || []).map((media) => [media.shotId, media]));
  const events: PreviewEvent[] = [];
  const blockedReasons: string[] = [];
  let cursor = 0;

  for (const shot of input.shots) {
    const media = mediaByShot.get(shot.id);
    const durationSeconds = durationForShot(shot, media, input.previewEvents || [], input.defaultImageHoldSeconds || 3);
    const imagePath = imagePathForShot(shot, media, input.previewEvents || []);
    const videoPath = videoPathForShot(shot, media, input.previewEvents || []);

    if (media?.blockedReason) {
      const reason = `${shot.id}: ${media.blockedReason}`;
      blockedReasons.push(reason);
      events.push({
        id: `draft_${safeId(shot.id)}_blocked_placeholder`,
        mode: "draft_preview",
        type: "blocked_placeholder",
        shotId: shot.id,
        startSeconds: cursor,
        durationSeconds,
        qaStatus: "UNKNOWN",
      });
    } else if (videoPath) {
      events.push({
        id: `draft_${safeId(shot.id)}_video_clip`,
        mode: "draft_preview",
        type: "video_clip",
        shotId: shot.id,
        startSeconds: cursor,
        durationSeconds,
        mediaPath: videoPath,
        qaStatus: media?.videoQaPass === false ? "FAIL" : "UNKNOWN",
      });
    } else if (imagePath) {
      events.push({
        id: `draft_${safeId(shot.id)}_image_hold`,
        mode: "draft_preview",
        type: "image_hold",
        shotId: shot.id,
        startSeconds: cursor,
        durationSeconds,
        mediaPath: imagePath,
        qaStatus: "UNKNOWN",
      });
    } else {
      const reason = `${shot.id}: missing image hold and video clip.`;
      blockedReasons.push(reason);
      events.push({
        id: `draft_${safeId(shot.id)}_missing_placeholder`,
        mode: "draft_preview",
        type: "blocked_placeholder",
        shotId: shot.id,
        startSeconds: cursor,
        durationSeconds,
        qaStatus: "UNKNOWN",
      });
    }

    cursor += durationSeconds;
  }

  return buildPreviewPlan(
    "export_builder_draft_preview",
    "draft_preview",
    events.length && blockedReasons.length === 0 ? "draft_only" : events.length ? "draft_only" : "blocked",
    events,
    events.length ? blockedReasons : ["No shots are available for draft preview planning."],
  );
}

function relatedPromotionPassed(shotId: string, media: ExportBuilderShotMedia | undefined, reports: QaPromotionReport[]): boolean {
  if (media?.promotionPassed !== undefined) return media.promotionPassed;
  const related = reports.filter((report) => report.shotId === shotId);
  return related.length > 0 && related.every((report) => report.canPromoteToFormal || report.promotionStatus === "promoted");
}

function relatedManifestMatched(
  shotId: string,
  media: ExportBuilderShotMedia | undefined,
  healthReports: GenerationHealthReport[],
): boolean {
  if (media?.manifestMatched !== undefined) return media.manifestMatched;
  const related = healthReports.filter((report) => report.shotId === shotId);
  return related.length > 0 && related.every((report) => ["matched", "complete", "actual_output_present"].includes(report.manifestStatus));
}

function relatedVideoQaPass(shot: ShotRecord, media: ExportBuilderShotMedia | undefined): boolean {
  if (media?.videoQaPass !== undefined) return media.videoQaPass;
  return allVideoQaGatesPass(shot.gates);
}

function formalShotReasons(
  shot: ShotRecord,
  media: ExportBuilderShotMedia | undefined,
  videoPath: string | undefined,
  input: BuildExportBuilderStateInput,
): string[] {
  const reasons: string[] = [];
  if (!videoPath) reasons.push(`${shot.id}: video clip is missing.`);
  if (media?.blockedReason) reasons.push(`${shot.id}: ${media.blockedReason}`);
  if (shot.gates.pair !== "PASS") reasons.push(`${shot.id}: pair QA must be PASS.`);
  if (!relatedVideoQaPass(shot, media)) reasons.push(`${shot.id}: video QA gates must be PASS or N/A.`);
  if (hasUnknownGate(shot.gates)) reasons.push(`${shot.id}: formal preview cannot include UNKNOWN gates.`);
  if (hasP0Issue(input.issues || [], shot.id)) reasons.push(`${shot.id}: P0/blocker issue blocks formal preview.`);
  if (!relatedManifestMatched(shot.id, media, input.generationHealthReports || [])) {
    reasons.push(`${shot.id}: manifest matcher has not verified the video clip.`);
  }
  if (!relatedPromotionPassed(shot.id, media, input.qaPromotionReports || [])) {
    reasons.push(`${shot.id}: QA promotion has not passed.`);
  }
  return uniqueSorted(reasons);
}

function buildFormalPreview(input: BuildExportBuilderStateInput, draftPreview: PreviewPlan): { preview: PreviewPlan; gate: FormalPreviewGate } {
  const mediaByShot = new Map((input.shotMedia || []).map((media) => [media.shotId, media]));
  const events: PreviewEvent[] = [];
  const blockedReasons: string[] = [];
  let cursor = 0;

  for (const shot of input.shots) {
    const media = mediaByShot.get(shot.id);
    const durationSeconds = durationForShot(shot, media, draftPreview.events, input.defaultImageHoldSeconds || 3);
    const videoPath = videoPathForShot(shot, media, draftPreview.events);
    const reasons = formalShotReasons(shot, media, videoPath, input);

    if (reasons.length === 0 && videoPath) {
      events.push({
        id: `formal_${safeId(shot.id)}_video_clip`,
        mode: "formal_preview",
        type: "video_clip",
        shotId: shot.id,
        startSeconds: cursor,
        durationSeconds,
        mediaPath: videoPath,
        qaStatus: "PASS",
      });
    } else {
      blockedReasons.push(...reasons);
    }

    cursor += durationSeconds;
  }

  const requiredChecks = {
    noBlockedMaterial: draftPreview.events.every((event) => event.type !== "blocked_placeholder"),
    pairQaPass: input.shots.every((shot) => shot.gates.pair === "PASS"),
    videoQaPass: input.shots.every((shot) => allVideoQaGatesPass(shot.gates)),
    manifestMatched: input.shots.every((shot) => relatedManifestMatched(shot.id, mediaByShot.get(shot.id), input.generationHealthReports || [])),
    promotionPassed: input.shots.every((shot) => relatedPromotionPassed(shot.id, mediaByShot.get(shot.id), input.qaPromotionReports || [])),
    noP0Issues: !hasP0Issue(input.issues || []),
    noUnknownGate: input.shots.every((shot) => !hasUnknownGate(shot.gates)),
    videoPresent: input.shots.length > 0 && input.shots.every((shot) => Boolean(videoPathForShot(shot, mediaByShot.get(shot.id), draftPreview.events))),
  };
  const failedChecks = Object.entries(requiredChecks)
    .filter(([, passed]) => !passed)
    .map(([checkName]) => `Formal preview check failed: ${checkName}.`);
  const gateReasons = uniqueSorted([...blockedReasons, ...failedChecks]);
  const gate: FormalPreviewGate = {
    status: gateReasons.length === 0 ? "pass" : "blocked",
    requiredChecks,
    blockedReasons: gateReasons,
  };

  return {
    preview: buildPreviewPlan(
      "export_builder_formal_preview",
      "formal_preview",
      gate.status === "pass" ? "ready" : "blocked",
      events,
      gate.blockedReasons,
    ),
    gate,
  };
}

function makeProfile(input: {
  kind: ExportProfile["kind"];
  label: string;
  readiness: ExportReadinessStatus;
  includedCategories: string[];
  includedPaths: string[];
  blockedReasons: string[];
  notes: string[];
  futureTargets?: string[];
}): ExportProfile {
  return {
    schemaVersion: exportBuilderSchemaVersion,
    profileId: `export_builder_${input.kind}`,
    kind: input.kind,
    label: input.label,
    readiness: input.readiness,
    includedCategories: uniqueSorted(input.includedCategories),
    includedPaths: uniqueSorted(input.includedPaths),
    blockedReasons: uniqueSorted(input.blockedReasons),
    notes: input.notes,
    futureTargets: input.futureTargets,
    dryRunOnly: true,
    providerSubmissionForbidden: true,
  };
}

function buildFutureTargets(): ExportBuilderFutureTarget[] {
  return [
    {
      target: "fcpxml",
      status: "future_placeholder",
      enabled: false,
      writesFile: false,
      notes: ["FCPXML is reserved as a future target; no XML file is generated."],
    },
    {
      target: "edl",
      status: "future_placeholder",
      enabled: false,
      writesFile: false,
      notes: ["EDL is reserved as a future target; no EDL file is generated."],
    },
    {
      target: "premiere_pro",
      status: "future_placeholder",
      enabled: false,
      writesFile: false,
      notes: ["Premiere Pro friendly package layout is reserved for later; no directories are created."],
    },
    {
      target: "jianying",
      status: "future_placeholder",
      enabled: false,
      writesFile: false,
      notes: ["Jianying export is a future placeholder only."],
    },
    {
      target: "davinci_resolve",
      status: "future_placeholder",
      enabled: false,
      writesFile: false,
      notes: ["DaVinci Resolve export is a future placeholder only."],
    },
  ];
}

function audioOutputPaths(audioPlanning?: AudioPlanningState): string[] {
  return uniqueSorted([
    ...(audioPlanning?.shotPlans || []).map((plan) => plan.outputPath || ""),
    ...(audioPlanning?.exportPackageSummary.plannedPaths || []),
    ...(audioPlanning?.musicReferences || []).flatMap((reference) => [reference.analysisPath || "", reference.finalMixPath || ""]),
  ]);
}

function buildAudioPolicy(audioPlanning?: AudioPlanningState): ExportBuilderAudioPolicy {
  return {
    videoProviderBgmAllowed: false,
    bgmHandledBy: "audio_plan_or_export_plan",
    bgmIncludedInVideoPrompt: false,
    exportCategories: uniqueSorted([
      "audio_plan",
      "preview_mix_placeholder",
      "bgm_export_plan",
      ...(audioPlanning?.exportPackageSummary.plannedCategories || []),
    ]),
    plannedAudioPaths: audioOutputPaths(audioPlanning),
    notes: [
      "Video provider prompts default to no BGM.",
      "BGM is represented only in audio planning or export package planning.",
    ],
  };
}

function buildProfiles(input: BuildExportBuilderStateInput, draftPreview: PreviewPlan, formalPreview: PreviewPlan): ExportProfile[] {
  const activePreview = formalPreview.status === "ready" ? formalPreview : draftPreview;
  const roughPaths = activePreview.events.map((event) => event.mediaPath || "").filter(Boolean);
  const assetPaths = uniqueSorted([
    ...input.shots.flatMap((shot) => [shot.startFrame, shot.endFrame, shot.videoPath].filter((path): path is string => Boolean(path))),
    ...(input.shotMedia || []).flatMap((media) => [media.imagePath, media.videoPath].filter((path): path is string => Boolean(path))),
    ...(input.taskRuns || []).flatMap((run) => [...run.expectedOutputs, ...run.actualOutputs]),
    ...audioOutputPaths(input.audioPlanning),
  ]);
  const archivePaths = uniqueSorted([
    ...(input.jobs || []).map((job) => job.promptPath || "").filter(Boolean),
    ...(input.taskRuns || []).flatMap((run) => [...run.expectedOutputs, ...run.actualOutputs]),
    ...(input.qaPromotionReports || []).flatMap((report) => [report.candidatePath, report.formalPath]),
  ]);

  return [
    makeProfile({
      kind: "rough_cut",
      label: "Rough Cut Proxy",
      readiness: roughPaths.length ? (formalPreview.status === "ready" ? "ready" : "draft_only") : "blocked",
      includedCategories: ["preview_timeline", "image_holds", "video_clips", "missing_placeholders_when_draft", "rough_cut_proxy_plan"],
      includedPaths: roughPaths,
      blockedReasons: roughPaths.length ? [] : ["No preview media paths are available for rough cut planning."],
      notes: ["Dry-run rough cut package plan only; no timeline or media file is rendered."],
      futureTargets: ["fcpxml_future_slot", "edl_future_slot", "premiere_pro_future_slot", "jianying_future_slot", "davinci_resolve_future_slot"],
    }),
    makeProfile({
      kind: "asset_package",
      label: "Asset Package",
      readiness: assetPaths.length ? (formalPreview.status === "ready" ? "ready" : "draft_only") : "blocked",
      includedCategories: ["selected_keyframes", "keyframes", "videos", "reference_assets", "audio_plan", "bgm_export_plan"],
      includedPaths: assetPaths,
      blockedReasons: assetPaths.length ? [] : ["No assets are available for package planning."],
      notes: ["Asset package is a reference list only; the builder does not copy, move, or create files."],
      futureTargets: ["premiere_pro_directory_future_slot", "jianying_directory_future_slot", "davinci_resolve_directory_future_slot"],
    }),
    makeProfile({
      kind: "storyboard_table",
      label: "Storyboard Table",
      readiness: input.shots.length ? "ready" : "blocked",
      includedCategories: ["storyboard_table", "shot_order", "story_function", "duration", "media_status", "gate_summary", "project_facts_snapshot"],
      includedPaths: [],
      blockedReasons: input.shots.length ? [] : ["No shots are available for storyboard table planning."],
      notes: ["Storyboard table is a dry-run table plan; no CSV, XLSX, or document is written."],
    }),
    makeProfile({
      kind: "developer_archive",
      label: "Prompt and QA Developer Archive",
      readiness: archivePaths.length ? "ready" : "blocked",
      includedCategories: ["prompt_request_previews", "prompts", "qa_promotion", "generation_health", "qa_reports", "task_runs", "prompt_qa_trace", "project_facts_snapshot"],
      includedPaths: archivePaths,
      blockedReasons: archivePaths.length ? [] : ["No prompt, task output, or QA paths are available for archive planning."],
      notes: ["Developer archive is a dry-run path manifest and preserves prompt/QA traceability without provider submission."],
    }),
  ];
}

function packageStatus(profiles: ExportProfile[]): ExportReadinessStatus {
  if (profiles.some((profile) => profile.readiness === "blocked")) return "blocked";
  if (profiles.some((profile) => profile.readiness === "draft_only")) return "draft_only";
  if (profiles.some((profile) => profile.readiness === "planned")) return "planned";
  return "ready";
}

function buildPackagePlan(profiles: ExportProfile[]): ExportPackagePlan {
  return {
    schemaVersion: exportBuilderSchemaVersion,
    planId: "export_builder_package_plan",
    status: packageStatus(profiles),
    profiles,
    futureTargets: uniqueSorted(profiles.flatMap((profile) => profile.futureTargets || [])),
    blockedReasons: uniqueSorted(profiles.flatMap((profile) => profile.blockedReasons)),
    notes: [
      "Export Builder is dry-run only.",
      "FCPXML, EDL, Premiere Pro, Jianying, and DaVinci Resolve targets are placeholders only.",
    ],
    dryRunOnly: true,
    providerSubmissionForbidden: true,
  };
}

function roughCutProxy(sourcePreview: PreviewPlan): RoughCutProxyPlan {
  return {
    status: sourcePreview.status,
    sourcePreviewPlanId: sourcePreview.planId,
    totalDurationSeconds: sourcePreview.summary.totalDurationSeconds,
    eventCount: sourcePreview.summary.eventCount,
    proxyOnly: true,
    notes: ["Rough cut proxy is a timeline plan only; no preview media is rendered."],
  };
}

function mediaStatusForEvent(event?: PreviewEvent): DemoPackageMediaStatus {
  if (event?.type === "video_clip" && event.mediaPath) return "video";
  if (event?.type === "image_hold" && event.mediaPath) return "image";
  return "missing";
}

function videoOutputPath(path?: string): boolean {
  return /\.(?:mp4|mov|webm)$/i.test(path || "");
}

function firstStringField(value: unknown, keys: string[]): string | undefined {
  const wanted = new Set(keys.map((key) => key.toLowerCase()));
  const seen = new Set<unknown>();
  const visit = (current: unknown): string | undefined => {
    if (!isRecord(current) || seen.has(current)) return undefined;
    seen.add(current);
    for (const [key, child] of Object.entries(current)) {
      if (wanted.has(key.toLowerCase()) && typeof child === "string" && child.trim()) return child.trim();
    }
    for (const child of Object.values(current)) {
      const found = Array.isArray(child)
        ? child.map(visit).find(Boolean)
        : visit(child);
      if (found) return found;
    }
    return undefined;
  };
  return visit(value);
}

function firstNumberField(value: unknown, keys: string[]): number | undefined {
  const wanted = new Set(keys.map((key) => key.toLowerCase()));
  const seen = new Set<unknown>();
  const visit = (current: unknown): number | undefined => {
    if (!isRecord(current) || seen.has(current)) return undefined;
    seen.add(current);
    for (const [key, child] of Object.entries(current)) {
      if (!wanted.has(key.toLowerCase())) continue;
      if (typeof child === "number" && Number.isFinite(child)) return child;
      if (typeof child === "string" && child.trim() && Number.isFinite(Number(child))) return Number(child);
    }
    for (const child of Object.values(current)) {
      const found = Array.isArray(child)
        ? child.map(visit).find((item): item is number => typeof item === "number")
        : visit(child);
      if (typeof found === "number") return found;
    }
    return undefined;
  };
  return visit(value);
}

function firstRecordField(value: unknown, keys: string[]): Record<string, unknown> | undefined {
  const wanted = new Set(keys.map((key) => key.toLowerCase()));
  const seen = new Set<unknown>();
  const visit = (current: unknown): Record<string, unknown> | undefined => {
    if (!isRecord(current) || seen.has(current)) return undefined;
    seen.add(current);
    for (const [key, child] of Object.entries(current)) {
      if (wanted.has(key.toLowerCase()) && isRecord(child)) return child;
    }
    for (const child of Object.values(current)) {
      const found = Array.isArray(child)
        ? child.map(visit).find(Boolean)
        : visit(child);
      if (found) return found;
    }
    return undefined;
  };
  return visit(value);
}

function collectPathFields(value: unknown, keyPattern: RegExp): string[] {
  const paths: string[] = [];
  const seen = new Set<unknown>();
  const visit = (current: unknown): void => {
    if (Array.isArray(current)) {
      current.forEach(visit);
      return;
    }
    if (!isRecord(current) || seen.has(current)) return;
    seen.add(current);
    for (const [key, child] of Object.entries(current)) {
      if (keyPattern.test(key) && typeof child === "string" && child.trim()) paths.push(child.trim());
      visit(child);
    }
  };
  visit(value);
  return uniqueSorted(paths);
}

function normalizePathList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return uniqueSorted(value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())));
  }
  return typeof value === "string" && value.trim() ? [value.trim()] : [];
}

function firstStringArrayField(value: unknown, keys: string[]): string[] {
  const wanted = new Set(keys.map((key) => key.toLowerCase()));
  const seen = new Set<unknown>();
  const visit = (current: unknown): string[] => {
    if (!isRecord(current) || seen.has(current)) return [];
    seen.add(current);
    for (const [key, child] of Object.entries(current)) {
      if (wanted.has(key.toLowerCase())) {
        const values = normalizePathList(child);
        if (values.length) return values;
      }
    }
    for (const child of Object.values(current)) {
      const found = Array.isArray(child)
        ? child.flatMap((item) => visit(item))
        : visit(child);
      if (found.length) return found;
    }
    return [];
  };
  return visit(value);
}

function directorStrategyEvidenceFrom(value: unknown): DemoPackageDirectorStrategyEvidence | undefined {
  const strategy = firstRecordField(value, ["directorStrategy", "director_strategy"]);
  if (!strategy) return undefined;
  const modificationSummary = firstStringArrayField(strategy, ["modificationSummary", "modification_summary"]);
  const evidence: DemoPackageDirectorStrategyEvidence = {
    rhythmProfile: firstStringField(strategy, ["rhythmProfile", "rhythm_profile"]),
    rhythmLabel: firstStringField(strategy, ["rhythmLabel", "rhythm_label"]),
    rhythmReason: firstStringField(strategy, ["rhythmReason", "rhythm_reason"]),
    splitPolicy: firstStringField(strategy, ["splitPolicy", "split_policy"]),
    splitLabel: firstStringField(strategy, ["splitLabel", "split_label"]),
    actionSummary: firstStringField(strategy, ["actionSummary", "action_summary"]),
    modificationSummary,
    storyboardPromptPlanSummary: firstStringField(strategy, ["storyboardPromptPlanSummary", "storyboard_prompt_plan_summary"]),
    videoPromptPlanSummary: firstStringField(strategy, ["videoPromptPlanSummary", "video_prompt_plan_summary"]),
  };
  return Object.values(evidence).some((item) => Array.isArray(item) ? item.length : Boolean(item)) ? evidence : undefined;
}

function referenceEvidenceFrom(value: unknown): DemoPackageReferenceEvidence | undefined {
  const characterReferencePaths = firstStringArrayField(value, ["characterReferencePaths", "character_reference_paths"]);
  const propReferencePaths = firstStringArrayField(value, ["propReferencePaths", "prop_reference_paths"]);
  const evidence: DemoPackageReferenceEvidence = {
    referencePolicyVersion: firstStringField(value, ["referencePolicyVersion", "schemaVersion", "reference_policy_version"]) || STORYBOARD_REFERENCE_PIPELINE_VERSION,
    storyboardReferencePath: firstStringField(value, ["storyboardReferencePath", "storyboard_reference_path"]),
    sceneReferencePath: firstStringField(value, ["sceneReferencePath", "sceneBaselinePath", "scene_reference_path", "scene_baseline_path"]),
    characterReferencePaths,
    propReferencePaths,
    dialogueAudioPath: firstStringField(value, ["dialogueAudioPath", "dialogue_audio_path"]),
    seedanceInputRoleOrder: firstStringArrayField(value, ["seedanceInputRoleOrder", "inputOrder", "seedance_input_role_order"]),
    userFacingSummary: firstStringField(value, ["userFacingSummary", "user_facing_summary"]),
    directorStrategy: directorStrategyEvidenceFrom(value),
  };
  const hasEvidence = Boolean(
    evidence.storyboardReferencePath ||
    evidence.sceneReferencePath ||
    evidence.dialogueAudioPath ||
    evidence.characterReferencePaths?.length ||
    evidence.propReferencePaths?.length ||
    evidence.seedanceInputRoleOrder?.length ||
    evidence.userFacingSummary ||
    evidence.directorStrategy,
  );
  if (!hasEvidence) return undefined;
  if (!evidence.seedanceInputRoleOrder?.length && (evidence.storyboardReferencePath || evidence.dialogueAudioPath)) {
    evidence.seedanceInputRoleOrder = [...SEEDANCE_ALL_AROUND_REFERENCE_ORDER];
  }
  return evidence;
}

function mergeReferenceEvidence(values: Array<DemoPackageReferenceEvidence | undefined>): DemoPackageReferenceEvidence | undefined {
  const present = values.filter((value): value is DemoPackageReferenceEvidence => Boolean(value));
  if (!present.length) return undefined;
  const evidence: DemoPackageReferenceEvidence = {
    referencePolicyVersion: present.find((item) => item.referencePolicyVersion)?.referencePolicyVersion || STORYBOARD_REFERENCE_PIPELINE_VERSION,
    storyboardReferencePath: present.find((item) => item.storyboardReferencePath)?.storyboardReferencePath,
    sceneReferencePath: present.find((item) => item.sceneReferencePath)?.sceneReferencePath,
    characterReferencePaths: uniqueSorted(present.flatMap((item) => item.characterReferencePaths || [])),
    propReferencePaths: uniqueSorted(present.flatMap((item) => item.propReferencePaths || [])),
    dialogueAudioPath: present.find((item) => item.dialogueAudioPath)?.dialogueAudioPath,
    seedanceInputRoleOrder: present.find((item) => item.seedanceInputRoleOrder?.length)?.seedanceInputRoleOrder,
    userFacingSummary: present.find((item) => item.userFacingSummary)?.userFacingSummary,
    directorStrategy: present.find((item) => item.directorStrategy)?.directorStrategy,
  };
  return evidence;
}

function taskLooksVideo(job: GenerationJob | undefined, run: TaskRun | undefined): boolean {
  return Boolean(
    job?.slot.startsWith("video.") ||
    job?.requiredMode === "frames2video" ||
    run?.expectedOutputs.some(videoOutputPath) ||
    run?.actualOutputs.some(videoOutputPath) ||
    /jimeng|dreamina|seedance|video/i.test(`${job?.providerId || ""} ${run?.providerId || ""}`),
  );
}

function jobRunPairs(input: BuildExportBuilderStateInput): Array<{ job?: GenerationJob; run?: TaskRun }> {
  const jobsById = new Map((input.jobs || []).map((job) => [job.id, job]));
  const pairs: Array<{ job?: GenerationJob; run?: TaskRun }> = (input.taskRuns || []).map((run) => ({
    job: jobsById.get(run.taskId),
    run,
  }));
  const pairedJobIds = new Set(pairs.map((pair) => pair.job?.id).filter(Boolean));
  pairs.push(
    ...(input.jobs || [])
      .filter((job) => !pairedJobIds.has(job.id))
      .map((job) => ({ job, run: undefined })),
  );
  return pairs;
}

function taskPairForVideo(
  input: BuildExportBuilderStateInput,
  shotId: string,
  videoPath: string | undefined,
  event: PreviewEvent | undefined,
): { job?: GenerationJob; run?: TaskRun } | undefined {
  return jobRunPairs(input).find(({ job, run }) => {
    if (!taskLooksVideo(job, run)) return false;
    if (event?.sourceTaskId && (event.sourceTaskId === job?.id || event.sourceTaskId === run?.taskId)) return true;
    const outputs = [...(run?.expectedOutputs || []), ...(run?.actualOutputs || []), job?.outputPath || ""].filter(Boolean);
    return Boolean(videoPath && outputs.includes(videoPath)) || outputs.some((path) => path.includes(`/${shotId}`) || path.includes(`${shotId}_`));
  });
}

function firstFrameProtectedPath(paths: string[], videoPath?: string): string | undefined {
  const candidates = uniqueSorted(paths.filter((path) => videoOutputPath(path) && path !== videoPath));
  return candidates.find((path) => /first[-_]?frame|firstframe|protected|hold/i.test(path));
}

function videoSummaryFields(summary: unknown) {
  return {
    submitId: firstStringField(summary, ["submitId", "submit_id"]),
    providerTaskId: firstStringField(summary, ["providerTaskId", "provider_task_id", "taskId", "task_id"]),
    outputVideoPath: firstStringField(summary, ["outputVideoPath", "output_video_path", "videoPath", "video_path"]),
    outputVideoSha256: firstStringField(summary, ["outputVideoSha256", "output_video_sha256", "outputHash", "output_hash"]),
    resumeCommand: firstStringField(summary, ["resumeCommand", "resume_command"]),
    queryAttempts: firstNumberField(summary, ["queryAttempts", "query_attempts"]),
    receiptPaths: collectPathFields(summary, /^(?:planPath|submitLogPath|receiptPath|summaryPath|reportPath)$/i),
    queueLogPaths: collectPathFields(summary, /^(?:queryLogPath|queueLogPath|attemptLogPath)$/i),
  };
}

function buildVideoResults(input: BuildExportBuilderStateInput, draftPreview: PreviewPlan): DemoPackageVideoResult[] {
  const summary = videoSummaryFields(input.oneShotResultSummary);
  const summaryReferenceEvidence = referenceEvidenceFrom(input.oneShotResultSummary);
  const selectedShotId = input.selectedShotId || input.shots[0]?.id;
  const results = input.shots.map((shot) => {
    const event = draftPreview.events.find((item) => item.shotId === shot.id && item.type === "video_clip");
    const summaryVideoPath = shot.id === selectedShotId ? summary.outputVideoPath : undefined;
    const videoPath = videoPathForShot(shot, undefined, draftPreview.events) || summaryVideoPath;
    const pair = taskPairForVideo(input, shot.id, videoPath, event);
    const outputPaths = uniqueSorted([
      ...(pair?.run?.actualOutputs || []),
      ...(pair?.run?.expectedOutputs || []),
      pair?.job?.outputPath || "",
      videoPath || "",
      summary.outputVideoPath || "",
    ]);
    const firstFrameProtectedVideoPath = firstFrameProtectedPath(outputPaths, videoPath);
    const submitId = pair?.run?.submitId || pair?.job?.submitId || summary.submitId;
    const providerTaskId = pair?.run?.providerTaskId || pair?.job?.providerTaskId || summary.providerTaskId;
    const referenceEvidence = mergeReferenceEvidence([
      referenceEvidenceFrom(pair?.job),
      referenceEvidenceFrom(pair?.run),
      shot.id === selectedShotId ? summaryReferenceEvidence : undefined,
    ]);
    const receiptPaths = uniqueSorted([
      ...(pair?.job?.references || []).filter((reference) => /receipt|submit|report|summary|\.jsonl$/i.test(reference)),
      ...(summary.receiptPaths || []),
    ]);
    const queueLogPaths = uniqueSorted([
      ...(pair?.job?.references || []).filter((reference) => /query|queue|attempt|\.jsonl$/i.test(reference)),
      ...(summary.queueLogPaths || []),
    ]);

    return {
      id: `video_result_${safeId(shot.id)}`,
      shotId: shot.id,
      sourceTaskId: event?.sourceTaskId || pair?.job?.id || pair?.run?.taskId,
      taskId: pair?.run?.taskId,
      submitId,
      providerTaskId,
      reviewStatus: videoPath ? "needs_review" as const : "missing" as const,
      videoPath,
      firstFrameProtectedVideoPath,
      outputHash: shot.id === selectedShotId ? summary.outputVideoSha256 : undefined,
      receiptPaths,
      queueLogPaths,
      resumeCommand: shot.id === selectedShotId ? summary.resumeCommand : undefined,
      queueAttempts: shot.id === selectedShotId ? summary.queryAttempts : undefined,
      durationSeconds: event?.durationSeconds,
      referenceEvidence,
      autoPromoted: false as const,
      notes: [
        videoPath ? "Video output is recorded as a review candidate." : "Video output is missing.",
        "Video output is not promoted automatically.",
      ],
    };
  });

  const shotIds = new Set(input.shots.map((shot) => shot.id));
  const extraEvents = draftPreview.events.filter((event) => event.type === "video_clip" && event.mediaPath && (!event.shotId || !shotIds.has(event.shotId)));
  return [
    ...results,
    ...extraEvents.map((event) => ({
      id: `video_result_${safeId(event.id)}`,
      shotId: event.shotId,
      sourceTaskId: event.sourceTaskId,
      reviewStatus: "needs_review" as const,
      videoPath: event.mediaPath,
      receiptPaths: summary.receiptPaths,
      queueLogPaths: summary.queueLogPaths,
      resumeCommand: summary.resumeCommand,
      queueAttempts: summary.queryAttempts,
      durationSeconds: event.durationSeconds,
      referenceEvidence: summaryReferenceEvidence,
      autoPromoted: false as const,
      notes: ["Video output is recorded as a review candidate.", "Video output is not promoted automatically."],
    })),
  ];
}

function buildDemoPackageFacts(
  input: BuildExportBuilderStateInput,
  draftPreview: PreviewPlan,
  proxy: RoughCutProxyPlan,
): DemoPackageFacts {
  const eventByShot = new Map(draftPreview.events.filter((event) => event.shotId).map((event) => [event.shotId || "", event]));
  const selectedShotId = input.selectedShotId || input.shots[0]?.id;
  const selectedShotExists = input.shots.some((shot) => shot.id === selectedShotId);
  const selectedKeyframes = input.shots
    .filter((shot) => Boolean(shot.startFrame || shot.endFrame))
    .filter((shot) => !selectedShotId || !selectedShotExists || shot.id === selectedShotId)
    .map((shot) => ({
      shotId: shot.id,
      startFrame: shot.startFrame,
      endFrame: shot.endFrame,
      selected: shot.id === selectedShotId,
      reason: shot.id === selectedShotId ? "selected_shot" as const : "available_keyframe_pair" as const,
    }));

  return {
    storyboardRows: input.shots.map((shot) => {
      const event = eventByShot.get(shot.id);
      return {
        shotId: shot.id,
        actId: shot.actId,
        sectionId: shot.sectionId,
        title: shot.title,
        storyFunction: shot.storyFunction,
        shotStatus: shot.status,
        previewEventId: event?.id,
        previewEventType: event?.type,
        durationSeconds: event?.durationSeconds || 0,
        mediaPath: event?.mediaPath,
        mediaStatus: mediaStatusForEvent(event),
        gateSummary: shot.gates,
      };
    }),
    selectedKeyframes,
    promptRequestPreviews: [
      ...(input.jobs || []).map((job) => {
        const run = (input.taskRuns || []).find((item) => item.taskId === job.id);
        return {
          id: job.id,
          jobId: job.id,
          taskId: run?.taskId,
          slot: job.slot,
          providerId: job.providerId,
          requiredMode: job.requiredMode,
          promptPath: job.promptPath,
          expectedOutputs: run?.expectedOutputs || (job.outputPath ? [job.outputPath] : []),
          actualOutputs: run?.actualOutputs || [],
          submitId: run?.submitId || job.submitId,
          providerTaskId: run?.providerTaskId || job.providerTaskId,
          localStatus: run?.localStatus,
          providerStatus: run?.providerStatus,
          tempDirs: run?.tempDirs,
          receiptPaths: job.references.filter((reference) => /receipt|submit|report|summary|\.jsonl$/i.test(reference)),
          queueLogPaths: job.references.filter((reference) => /query|queue|attempt|\.jsonl$/i.test(reference)),
          referenceEvidence: referenceEvidenceFrom(job),
          lastEventAt: run?.lastEventAt,
          dryRunOnly: true as const,
          providerSubmissionForbidden: true as const,
        };
      }),
      ...(input.taskRuns || [])
        .filter((run) => !(input.jobs || []).some((job) => job.id === run.taskId))
        .map((run) => ({
          id: run.taskId,
          taskId: run.taskId,
          providerId: run.providerId,
          expectedOutputs: run.expectedOutputs,
          actualOutputs: run.actualOutputs,
          submitId: run.submitId,
          providerTaskId: run.providerTaskId,
          localStatus: run.localStatus,
          providerStatus: run.providerStatus,
          tempDirs: run.tempDirs,
          referenceEvidence: referenceEvidenceFrom(run),
          lastEventAt: run.lastEventAt,
          dryRunOnly: true as const,
          providerSubmissionForbidden: true as const,
        })),
    ],
    videoResults: buildVideoResults(input, draftPreview),
    qaReports: [
      ...(input.generationHealthReports || []).map((report) => ({
        id: report.reportId,
        kind: "generation_health" as const,
        shotId: report.shotId,
        status: report.healthStatus,
        blockers: report.blockers,
        warnings: report.warnings,
      })),
      ...(input.qaPromotionReports || []).map((report) => ({
        id: report.reportId,
        kind: "qa_promotion" as const,
        shotId: report.shotId,
        status: report.promotionStatus,
        blockers: report.blockers,
        warnings: report.warnings,
      })),
    ],
    projectFactsSnapshot: {
      generatedAt: input.generatedAt,
      projectRoot: input.projectRoot ? "project_root" : undefined,
      shotCount: input.shots.length,
      selectedShotId,
      shotIds: input.shots.map((shot) => shot.id),
      storySectionIds: uniqueSorted(input.shots.map((shot) => shot.sectionId || "")),
    },
    naturalLanguagePlanSummary: input.naturalLanguagePlanSummary,
    oneShotResultSummary: input.oneShotResultSummary,
    roughCutProxyPlanIncluded: proxy.eventCount > 0,
    dryRunOnly: true,
    providerSubmissionForbidden: true,
  };
}

export function buildExportBuilderState(input: BuildExportBuilderStateInput): ExportBuilderState {
  const draftPreview = buildDraftPreview(input);
  const formalResult = buildFormalPreview(input, draftPreview);
  const exportProfiles = buildProfiles(input, draftPreview, formalResult.preview);
  const exportPackagePlan = buildPackagePlan(exportProfiles);
  const proxySource = formalResult.preview.status === "ready" ? formalResult.preview : draftPreview;
  const proxy = roughCutProxy(proxySource);

  return {
    schemaVersion: exportBuilderSchemaVersion,
    generatedAt: input.generatedAt,
    phase: "phase_12_preview_export_builder",
    draftPreview,
    formalPreview: formalResult.preview,
    formalPreviewGate: formalResult.gate,
    roughCutProxy: proxy,
    exportProfiles,
    exportPackagePlan,
    demoPackageFacts: buildDemoPackageFacts(input, draftPreview, proxy),
    futureTargets: buildFutureTargets(),
    fileMutationPlan: {
      copyFiles: false,
      moveFiles: false,
      writeFiles: false,
      renderMedia: false,
      createDirectories: false,
      plannedMutations: [],
      notes: ["The builder returns a package plan only and never mutates the filesystem."],
    },
    audioPolicy: buildAudioPolicy(input.audioPlanning),
    dryRunOnly: true,
    noFileMutation: true,
    providerSubmissionForbidden: true,
    liveSubmitAllowed: false,
    notes: [
      "Phase 12 builds preview and export dry-run package plans only.",
      "Draft preview can show image holds, video replacements, and blocked/missing placeholders.",
      "Formal preview never includes blocked placeholders and is blocked until every formal gate passes.",
    ],
  };
}
