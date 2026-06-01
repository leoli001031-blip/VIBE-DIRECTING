import type { ManifestMatchReport } from "./manifestMatcher";
import type {
  AuditIssue,
  ExportPackagePlan,
  ExportProfile,
  ExportReadinessStatus,
  FormalPreviewRequiredChecks,
  GenerationHealthReport,
  GateSet,
  PreviewEvent,
  PreviewPlan,
  PreviewPlanStatus,
  ProjectPreviewExportState,
  QaPromotionReport,
  ShotRecord,
  TaskRun,
  GenerationJob,
  DemoPackageFacts,
  DemoPackageMediaStatus,
} from "./types";

export const previewExportSchemaVersion = "0.1.0";

export interface PreviewExportTaskViewFacts {
  job: GenerationJob;
  shotId?: string;
  taskRun: TaskRun;
  manifestMatch: ManifestMatchReport;
}

export interface BuildPreviewExportStateInput {
  generatedAt: string;
  projectRoot: string;
  previewEvents: PreviewEvent[];
  shots: ShotRecord[];
  jobs: GenerationJob[];
  taskRuns: TaskRun[];
  taskViews: PreviewExportTaskViewFacts[];
  manifestMatches: ManifestMatchReport[];
  generationHealthReports: GenerationHealthReport[];
  qaPromotionReports: QaPromotionReport[];
  issues: AuditIssue[];
  selectedShotId?: string;
  naturalLanguagePlanSummary?: unknown;
  oneShotResultSummary?: unknown;
  defaultImageHoldSeconds?: number;
  preferPreviewEvents?: boolean;
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) => left.localeCompare(right));
}

function totalDuration(events: PreviewEvent[]): number {
  return events.reduce((max, event) => Math.max(max, event.startSeconds + event.durationSeconds), 0);
}

function hasManifestMatch(status?: string): boolean {
  return status === "actual_output_present" || status === "complete" || status === "matched";
}

function safeId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]+/g, "_");
}

function firstPath(values: Array<string | undefined>): string | undefined {
  return values.find((value) => Boolean(value));
}

function taskOutputPath(task?: PreviewExportTaskViewFacts): string | undefined {
  return firstPath([...(task?.taskRun.actualOutputs || []), task?.job.outputPath, ...(task?.taskRun.expectedOutputs || [])]);
}

function durationForShot(input: BuildPreviewExportStateInput, shot: ShotRecord, fallbackEvents: PreviewEvent[]): number {
  const event = fallbackEvents.find((item) => item.shotId === shot.id);
  const duration = event?.durationSeconds || input.defaultImageHoldSeconds || 3;
  return Number.isFinite(duration) && duration > 0 ? duration : 3;
}

function imageTaskForShot(input: BuildPreviewExportStateInput, shotId: string): PreviewExportTaskViewFacts | undefined {
  return input.taskViews.find((task) => task.shotId === shotId && task.job.slot.startsWith("image."));
}

function videoTaskForShot(input: BuildPreviewExportStateInput, shotId: string): PreviewExportTaskViewFacts | undefined {
  return input.taskViews.find((task) => task.shotId === shotId && task.job.slot.startsWith("video."));
}

function imagePathForShot(input: BuildPreviewExportStateInput, shot: ShotRecord, fallbackEvents: PreviewEvent[]): string | undefined {
  const imageTask = imageTaskForShot(input, shot.id);
  return firstPath([
    fallbackEvents.find((event) => event.shotId === shot.id && event.type === "image_hold")?.mediaPath,
    shot.startFrame,
    shot.endFrame,
    taskOutputPath(imageTask),
  ]);
}

function videoPathForShot(input: BuildPreviewExportStateInput, shot: ShotRecord, fallbackEvents: PreviewEvent[]): string | undefined {
  const videoTask = videoTaskForShot(input, shot.id);
  return firstPath([
    shot.videoPath,
    fallbackEvents.find((event) => event.shotId === shot.id && event.type === "video_clip")?.mediaPath,
    taskOutputPath(videoTask),
  ]);
}

function mediaStatusForEvent(event?: PreviewEvent): DemoPackageMediaStatus {
  if (event?.type === "video_clip" && event.mediaPath) return "video";
  if (event?.type === "image_hold" && event.mediaPath) return "image";
  return "missing";
}

function buildDraftEvents(input: BuildPreviewExportStateInput): { events: PreviewEvent[]; blockedReasons: string[] } {
  const explicitDraftEvents = input.previewEvents.filter((event) => event.mode === "draft_preview");
  if (input.preferPreviewEvents && explicitDraftEvents.length) {
    const explicitBlockedReasons = explicitDraftEvents
      .filter((event) => event.type === "blocked_placeholder")
      .map((event) => `${event.shotId || event.id}: draft preview contains blocked placeholder.`);
    return { events: explicitDraftEvents, blockedReasons: uniqueSorted(explicitBlockedReasons) };
  }
  if (!input.shots.length) {
    const explicitBlockedReasons = explicitDraftEvents
      .filter((event) => event.type === "blocked_placeholder")
      .map((event) => `${event.shotId || event.id}: draft preview contains blocked placeholder.`);
    return { events: explicitDraftEvents, blockedReasons: explicitBlockedReasons };
  }

  const events: PreviewEvent[] = [];
  const blockedReasons: string[] = [];
  let cursor = 0;

  for (const shot of input.shots) {
    const durationSeconds = durationForShot(input, shot, explicitDraftEvents);
    const videoTask = videoTaskForShot(input, shot.id);
    const imageTask = imageTaskForShot(input, shot.id);
    const videoPath = videoPathForShot(input, shot, explicitDraftEvents);
    const imagePath = imagePathForShot(input, shot, explicitDraftEvents);

    if (videoPath) {
      events.push({
        id: `draft_${safeId(shot.id)}_video_clip`,
        mode: "draft_preview",
        type: "video_clip",
        shotId: shot.id,
        startSeconds: cursor,
        durationSeconds,
        mediaPath: videoPath,
        qaStatus: "UNKNOWN",
        sourceTaskId: videoTask?.job.id,
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
        sourceTaskId: imageTask?.job.id,
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

  const passthroughEvents = explicitDraftEvents.filter((event) => !event.shotId || !input.shots.some((shot) => shot.id === event.shotId));
  return {
    events: [...events, ...passthroughEvents],
    blockedReasons: uniqueSorted([
      ...blockedReasons,
      ...passthroughEvents
        .filter((event) => event.type === "blocked_placeholder")
        .map((event) => `${event.shotId || event.id}: draft preview contains blocked placeholder.`),
    ]),
  };
}

function summarizePreview(mode: PreviewPlan["mode"], status: PreviewPlanStatus, events: PreviewEvent[], blockedReasons: string[]): PreviewPlan["summary"] {
  return {
    mode,
    status,
    eventCount: events.length,
    videoClipCount: events.filter((event) => event.type === "video_clip").length,
    imageHoldCount: events.filter((event) => event.type === "image_hold").length,
    blockedPlaceholderCount: events.filter((event) => event.type === "blocked_placeholder").length,
    totalDurationSeconds: totalDuration(events),
    blockedShotIds: uniqueSorted(events.filter((event) => event.type === "blocked_placeholder" && event.shotId).map((event) => event.shotId || "")),
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
    schemaVersion: previewExportSchemaVersion,
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

function gateValues(gates: GateSet): string[] {
  return [gates.identity, gates.scene, gates.pair, gates.story, gates.prop, gates.style];
}

function allNonOptionalGatesPass(gates: GateSet): boolean {
  return gateValues(gates).every((gate) => gate === "PASS" || gate === "N/A");
}

function shotHasUnknownGate(shot: ShotRecord): boolean {
  return gateValues(shot.gates).some((gate) => gate === "UNKNOWN");
}

function hasP0Issues(issues: AuditIssue[], shotId?: string): boolean {
  return issues.some((issue) => {
    const severity = String((issue as AuditIssue & { severity?: string }).severity || "");
    return severity === "P0" && (!shotId || issue.target === shotId || issue.target?.includes(shotId));
  });
}

function relatedPromotionsPass(reports: QaPromotionReport[]): boolean {
  return reports.length > 0 && reports.every((report) => report.canPromoteToFormal || report.promotionStatus === "promoted");
}

function relatedImageQaIsClear(reports: GenerationHealthReport[]): boolean {
  return reports.every((report) => report.qaStatus !== "fail" && report.qaStatus !== "unknown" && report.healthStatus !== "failed");
}

function formalShotReasons(input: BuildPreviewExportStateInput, shot: ShotRecord): string[] {
  const reasons: string[] = [];
  const videoTask = input.taskViews.find((task) => task.shotId === shot.id && task.job.slot.startsWith("video."));
  const videoManifest = videoTask?.manifestMatch || input.manifestMatches.find((report) => report.taskId === videoTask?.job.id);
  const videoPath = videoPathForShot(input, shot, input.previewEvents);
  const relatedPromotions = input.qaPromotionReports.filter((report) => report.shotId === shot.id);
  const relatedHealth = input.generationHealthReports.filter((report) => report.shotId === shot.id);
  const draftEvent = input.previewEvents.find((event) => event.shotId === shot.id);

  if (draftEvent?.type === "blocked_placeholder") reasons.push(`${shot.id}: draft preview uses blocked placeholder.`);
  if (shot.gates.pair !== "PASS") reasons.push(`${shot.id}: pair QA must be PASS for formal preview.`);
  if (!allNonOptionalGatesPass(shot.gates)) reasons.push(`${shot.id}: video QA proxy gates must all be PASS or N/A.`);
  if (shotHasUnknownGate(shot)) reasons.push(`${shot.id}: unknown gate is not allowed in formal preview.`);
  if (hasP0Issues(input.issues, shot.id)) reasons.push(`${shot.id}: P0 issue blocks formal preview.`);
  if (!videoPath) reasons.push(`${shot.id}: video output path is missing.`);
  if (!videoTask) reasons.push(`${shot.id}: video task run is missing.`);
  if (!hasManifestMatch(videoManifest?.status)) reasons.push(`${shot.id}: video manifest match is missing or incomplete.`);
  if (!relatedPromotionsPass(relatedPromotions)) reasons.push(`${shot.id}: related QA promotion has not passed.`);
  if (!relatedImageQaIsClear(relatedHealth)) reasons.push(`${shot.id}: related image QA has FAIL or UNKNOWN status.`);

  return uniqueSorted(reasons);
}

function buildFormalEvents(input: BuildPreviewExportStateInput): { events: PreviewEvent[]; blockedReasons: string[] } {
  let cursor = 0;
  const events: PreviewEvent[] = [];
  const blockedReasons: string[] = [];

  for (const shot of input.shots) {
    const draftEvent = input.previewEvents.find((event) => event.shotId === shot.id);
    const durationSeconds = draftEvent?.durationSeconds || (shot.videoPath ? 5 : 3);
    const videoTask = input.taskViews.find((task) => task.shotId === shot.id && task.job.slot.startsWith("video."));
    const videoPath = videoPathForShot(input, shot, input.previewEvents);
    const reasons = formalShotReasons(input, shot);

    if (reasons.length === 0 && videoPath) {
      events.push({
        id: `formal_${shot.id}_video`,
        mode: "formal_preview",
        type: "video_clip",
        shotId: shot.id,
        startSeconds: cursor,
        durationSeconds,
        mediaPath: videoPath,
        qaStatus: "PASS",
        sourceTaskId: videoTask?.job.id,
      });
    } else {
      blockedReasons.push(...reasons);
    }

    cursor += durationSeconds;
  }

  return { events, blockedReasons: uniqueSorted(blockedReasons) };
}

function formalRequiredChecks(input: BuildPreviewExportStateInput, formalEvents: PreviewEvent[], blockedReasons: string[]): FormalPreviewRequiredChecks {
  const shotIdsWithFormalEvents = new Set(formalEvents.map((event) => event.shotId).filter(Boolean));
  const videoTasks = input.taskViews.filter((task) => task.job.slot.startsWith("video."));

  return {
    noBlockedMaterial: formalEvents.every((event) => event.type !== "blocked_placeholder") && !blockedReasons.some((reason) => reason.includes("blocked placeholder")),
    pairQaPass: input.shots.every((shot) => shot.gates.pair === "PASS"),
    videoQaPass: input.shots.every((shot) => allNonOptionalGatesPass(shot.gates)),
    manifestMatched: videoTasks.length > 0 && input.shots.every((shot) => {
      const task = videoTasks.find((item) => item.shotId === shot.id);
      return hasManifestMatch(task?.manifestMatch.status);
    }),
    promotionPassed: input.shots.every((shot) => relatedPromotionsPass(input.qaPromotionReports.filter((report) => report.shotId === shot.id))),
    noP0Issues: !hasP0Issues(input.issues),
    noUnknownGate: input.shots.every((shot) => !shotHasUnknownGate(shot)),
    videoPresent: input.shots.length > 0 && input.shots.every((shot) => Boolean(shot.videoPath) || shotIdsWithFormalEvents.has(shot.id)),
  };
}

function buildFormalGate(input: BuildPreviewExportStateInput, formalEvents: PreviewEvent[], blockedReasons: string[]) {
  const requiredChecks = formalRequiredChecks(input, formalEvents, blockedReasons);
  const failedChecks = Object.entries(requiredChecks)
    .filter(([, passed]) => !passed)
    .map(([check]) => `Formal preview check failed: ${check}.`);
  const reasons = uniqueSorted([...blockedReasons, ...failedChecks]);

  return {
    status: reasons.length === 0 ? "pass" as const : "blocked" as const,
    requiredChecks,
    blockedReasons: reasons,
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
    schemaVersion: previewExportSchemaVersion,
    profileId: `export_${input.kind}`,
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

function buildExportProfiles(input: BuildPreviewExportStateInput, draftPreview: PreviewPlan, formalPreview: PreviewPlan): ExportProfile[] {
  const draftMediaPaths = draftPreview.events.map((event) => event.mediaPath || "").filter(Boolean);
  const formalMediaPaths = formalPreview.events.map((event) => event.mediaPath || "").filter(Boolean);
  const assetPaths = input.shots.flatMap((shot) => [shot.startFrame, shot.endFrame, shot.videoPath].filter((path): path is string => Boolean(path)));
  const promptPaths = input.jobs.map((job) => job.promptPath || "").filter(Boolean);
  const taskOutputPaths = input.taskRuns.flatMap((run) => [...run.expectedOutputs, ...run.actualOutputs]);
  const qaPaths = input.qaPromotionReports.flatMap((report) => [report.candidatePath, report.formalPath]);
  const roughCutPaths = formalMediaPaths.length ? formalMediaPaths : draftMediaPaths;
  const roughCutBlocked = roughCutPaths.length ? [] : ["No preview media paths are available for rough cut export planning."];
  const packagePaths = uniqueSorted([...assetPaths, ...taskOutputPaths]);
  const archivePaths = uniqueSorted([...promptPaths, ...taskOutputPaths, ...qaPaths]);

  return [
    makeProfile({
      kind: "rough_cut",
      label: "Rough Cut Proxy",
      readiness: roughCutBlocked.length ? "blocked" : formalPreview.status === "ready" ? "ready" : "draft_only",
      includedCategories: ["preview_timeline", "video_clips", "image_holds", "blocked_placeholders_when_draft", "rough_cut_proxy_plan"],
      includedPaths: roughCutPaths,
      blockedReasons: roughCutBlocked,
      notes: [
        "Dry-run package plan only; no rough cut file is written.",
        "Uses formal preview media when the formal gate passes, otherwise remains draft-only.",
      ],
      futureTargets: ["premiere_pro_xml_slot", "davinci_resolve_folder_slot", "jianying_folder_slot", "fcpxml_future_slot", "edl_future_slot"],
    }),
    makeProfile({
      kind: "asset_package",
      label: "Asset Package",
      readiness: packagePaths.length ? (formalPreview.status === "ready" ? "ready" : "draft_only") : "blocked",
      includedCategories: ["selected_keyframes", "keyframes", "videos", "task_outputs", "reference_assets"],
      includedPaths: packagePaths,
      blockedReasons: packagePaths.length ? [] : ["No asset or task output paths are available for package planning."],
      notes: [
        "Folder structure is reserved for external editors; the builder does not copy or export files.",
        "Future layout can include PR, DaVinci Resolve, and Jianying friendly folders.",
      ],
      futureTargets: ["pr_friendly_directory_slot", "davinci_resolve_directory_slot", "jianying_directory_slot"],
    }),
    makeProfile({
      kind: "storyboard_table",
      label: "Storyboard Table",
      readiness: input.shots.length ? "ready" : "blocked",
      includedCategories: ["storyboard_table", "shot_order", "story_function", "preview_event_refs", "gate_summary", "project_facts_snapshot"],
      includedPaths: [],
      blockedReasons: input.shots.length ? [] : ["No shots are available for storyboard table planning."],
      notes: ["Structured table plan only; no CSV, XLSX, or document is written."],
    }),
    makeProfile({
      kind: "developer_archive",
      label: "Prompt and QA Developer Archive",
      readiness: archivePaths.length ? "ready" : "blocked",
      includedCategories: ["prompt_request_previews", "prompts", "manifest_matches", "generation_health", "qa_reports", "qa_promotion", "task_runs", "project_facts_snapshot"],
      includedPaths: archivePaths,
      blockedReasons: archivePaths.length ? [] : ["No prompt, task output, or QA paths are available for archive planning."],
      notes: ["Developer archive plan is read-only and preserves prompt/QA traceability without submitting providers."],
    }),
  ];
}

function packageStatus(profiles: ExportProfile[]): ExportReadinessStatus {
  if (profiles.some((profile) => profile.readiness === "blocked")) return "blocked";
  if (profiles.some((profile) => profile.readiness === "draft_only")) return "draft_only";
  if (profiles.some((profile) => profile.readiness === "planned")) return "planned";
  return "ready";
}

function buildExportPackagePlan(profiles: ExportProfile[]): ExportPackagePlan {
  const futureTargets = uniqueSorted(profiles.flatMap((profile) => profile.futureTargets || []));
  const blockedReasons = uniqueSorted(profiles.flatMap((profile) => profile.blockedReasons));

  return {
    schemaVersion: previewExportSchemaVersion,
    planId: "export_package_plan",
    status: packageStatus(profiles),
    profiles,
    futureTargets,
    blockedReasons,
    notes: [
      "Preview/export planning is dry-run/read-only.",
      "NLE slots are placeholders only; no FCPXML, EDL, PR, DaVinci, or Jianying file is generated.",
    ],
    dryRunOnly: true,
    providerSubmissionForbidden: true,
  };
}

function jobRunPairs(input: BuildPreviewExportStateInput): Array<{ job?: GenerationJob; run?: TaskRun; shotId?: string }> {
  const pairs: Array<{ job?: GenerationJob; run?: TaskRun; shotId?: string }> = input.taskViews.map((task) => ({
    job: task.job,
    run: task.taskRun,
    shotId: task.shotId,
  }));
  const pairedJobIds = new Set(pairs.map((pair) => pair.job?.id).filter(Boolean));
  const pairedTaskIds = new Set(pairs.map((pair) => pair.run?.taskId).filter(Boolean));

  pairs.push(
    ...input.jobs
      .filter((job) => !pairedJobIds.has(job.id))
      .map((job) => ({ job, run: input.taskRuns.find((run) => run.taskId === job.id), shotId: undefined })),
  );
  pairs.push(
    ...input.taskRuns
      .filter((run) => !pairedTaskIds.has(run.taskId))
      .map((run) => ({ job: input.jobs.find((job) => job.id === run.taskId), run, shotId: undefined })),
  );
  return pairs;
}

function buildDemoPackageFacts(
  input: BuildPreviewExportStateInput,
  draftPreview: PreviewPlan,
  roughCutProxyIncluded: boolean,
): DemoPackageFacts {
  const eventByShot = new Map(draftPreview.events.filter((event) => event.shotId).map((event) => [event.shotId || "", event]));
  const selectedShotId = input.selectedShotId || input.shots[0]?.id;
  const selectedKeyframes = input.shots
    .filter((shot) => Boolean(shot.startFrame || shot.endFrame))
    .filter((shot) => !selectedShotId || shot.id === selectedShotId || !input.shots.some((item) => item.id === selectedShotId))
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
    promptRequestPreviews: jobRunPairs(input).map((pair, index) => ({
      id: pair.job?.id || pair.run?.taskId || `request_preview_${index + 1}`,
      shotId: pair.shotId,
      jobId: pair.job?.id,
      taskId: pair.run?.taskId,
      slot: pair.job?.slot,
      providerId: pair.job?.providerId || pair.run?.providerId,
      requiredMode: pair.job?.requiredMode,
      promptPath: pair.job?.promptPath,
      expectedOutputs: pair.run?.expectedOutputs || (pair.job?.outputPath ? [pair.job.outputPath] : []),
      actualOutputs: pair.run?.actualOutputs || [],
      dryRunOnly: true,
      providerSubmissionForbidden: true,
    })),
    qaReports: [
      ...input.generationHealthReports.map((report) => ({
        id: report.reportId,
        kind: "generation_health" as const,
        shotId: report.shotId,
        status: report.healthStatus,
        blockers: report.blockers,
        warnings: report.warnings,
      })),
      ...input.qaPromotionReports.map((report) => ({
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
      projectRoot: "project_root",
      shotCount: input.shots.length,
      selectedShotId,
      shotIds: input.shots.map((shot) => shot.id),
      storySectionIds: uniqueSorted(input.shots.map((shot) => shot.sectionId || "")),
    },
    naturalLanguagePlanSummary: input.naturalLanguagePlanSummary,
    oneShotResultSummary: input.oneShotResultSummary,
    roughCutProxyPlanIncluded: roughCutProxyIncluded,
    dryRunOnly: true,
    providerSubmissionForbidden: true,
  };
}

export function buildPreviewExportState(input: BuildPreviewExportStateInput): ProjectPreviewExportState {
  const draftResult = buildDraftEvents(input);
  const draftEvents = draftResult.events;
  const draftBlockedReasons = draftResult.blockedReasons;
  const draftPreview = buildPreviewPlan(
    "draft_preview_plan",
    "draft_preview",
    draftEvents.length ? "draft_only" : "blocked",
    draftEvents,
    draftEvents.length ? draftBlockedReasons : ["No draft preview events are available."],
  );
  const formalResult = buildFormalEvents({ ...input, previewEvents: draftEvents });
  const formalGate = buildFormalGate(input, formalResult.events, formalResult.blockedReasons);
  const formalPreview = buildPreviewPlan(
    "formal_preview_plan",
    "formal_preview",
    formalGate.status === "pass" ? "ready" : "blocked",
    formalResult.events,
    formalGate.blockedReasons,
  );
  const exportProfiles = buildExportProfiles(input, draftPreview, formalPreview);
  const exportPackagePlan = buildExportPackagePlan(exportProfiles);
  const proxySourcePreview = formalPreview.status === "ready" ? formalPreview : draftPreview;
  const roughCutProxy = {
    status: proxySourcePreview.status,
    sourcePreviewPlanId: proxySourcePreview.planId,
    totalDurationSeconds: proxySourcePreview.summary.totalDurationSeconds,
    eventCount: proxySourcePreview.summary.eventCount,
    proxyOnly: true as const,
    notes: [
      "Rough cut proxy is a timeline plan only; no media file is rendered.",
      formalPreview.status === "ready" ? "Formal preview is available for proxy planning." : "Formal preview is blocked; proxy uses draft preview events.",
    ],
  };

  return {
    schemaVersion: previewExportSchemaVersion,
    generatedAt: input.generatedAt,
    draftPreview,
    formalPreview,
    formalPreviewGate: formalGate,
    roughCutProxy,
    exportProfiles,
    exportPackagePlan,
    demoPackageFacts: buildDemoPackageFacts(input, draftPreview, roughCutProxy.eventCount > 0),
  };
}
