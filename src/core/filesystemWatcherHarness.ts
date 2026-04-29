import type { FileSnapshot, ManifestMatchReport } from "./manifestMatcher";
import type {
  FilesystemWatcherArtifactClass,
  FilesystemWatcherHarnessState,
  FilesystemWatcherMonitoredKind,
  GenerationHarnessState,
  GenerationHealthReport,
  Image2AdapterRequest,
  ImageTaskPlan,
  QaPromotionReport,
  WatcherEvent,
  WatcherEventType,
} from "./types";

export interface BuildFilesystemWatcherHarnessInput {
  generatedAt: string;
  projectRoot: string;
  fileSnapshot: FileSnapshot;
  manifestMatches: ManifestMatchReport[];
  imageTaskPlans: ImageTaskPlan[];
  image2AdapterRequests: Image2AdapterRequest[];
  watcherEvents: WatcherEvent[];
  generationHealthReports: GenerationHealthReport[];
  qaPromotionReports: QaPromotionReport[];
  generationHarness: GenerationHarnessState;
}

export const filesystemWatcherMonitoredKinds: FilesystemWatcherMonitoredKind[] = [
  "codex_temp_generated_images",
  "project_outputs",
  "reports",
  "videos",
  "audio",
];

export const filesystemWatcherHardLocks: FilesystemWatcherHarnessState["hardLocks"] = {
  watcherCannotPromoteFormal: true,
  workerSelfReportCannotComplete: true,
  tempOutputDraftOnly: true,
  semanticPostprocessForbidden: true,
  liveSubmitAllowed: false,
  providerSubmissionForbidden: true,
};

function normalizePath(path: string): string {
  return path.replace(/\\/g, "/");
}

function snapshotPathCount(snapshot: FileSnapshot): number {
  return Array.isArray(snapshot) ? snapshot.length : Object.keys(snapshot).length;
}

function artifactClassFor(eventType: WatcherEventType): FilesystemWatcherArtifactClass {
  if (eventType === "temp_output_detected") return "temp_candidate";
  if (eventType === "expected_output_detected") return "expected_output";
  if (eventType === "provider_ready_derivative_detected") return "provider_ready_derivative";
  if (eventType === "qa_report_detected") return "qa_report";
  if (eventType === "manifest_mismatch_detected") return "manifest_mismatch";
  if (eventType === "formal_output_promoted") return "formal_output";
  if (eventType === "worker_exit_without_expected_output") return "worker_exit_without_expected_output";
  if (eventType === "postprocess_recoverable") return "postprocess_recoverable";
  if (eventType === "stall_timeout_reached") return "stall_timeout";
  if (eventType === "blocked") return "blocked";
  return "unknown";
}

function monitoredKindFor(path: string | undefined, artifactClass: FilesystemWatcherArtifactClass): FilesystemWatcherMonitoredKind {
  const normalized = normalizePath(path || "").toLowerCase();
  if (artifactClass === "temp_candidate" || /(^|\/)(tmp|temp|cache|candidates?|drafts?)(\/|$)/.test(normalized)) {
    return "codex_temp_generated_images";
  }
  if (artifactClass === "qa_report" || artifactClass === "manifest_mismatch" || /(^|\/)reports?(\/|$)/.test(normalized)) return "reports";
  if (/\.(mp4|mov|m4v|webm)$/i.test(normalized) || /(^|\/)videos?(\/|$)/.test(normalized)) return "videos";
  if (/\.(wav|mp3|m4a|aac|flac|ogg)$/i.test(normalized) || /(^|\/)audio(\/|$)/.test(normalized)) return "audio";
  return "project_outputs";
}

function manifestReportFor(taskPlan?: ImageTaskPlan, reports: ManifestMatchReport[] = []): ManifestMatchReport | undefined {
  if (!taskPlan) return undefined;
  return reports.find((report) => report.taskId === taskPlan.jobId || report.taskId === taskPlan.taskPlanId);
}

function requiresManifestMatch(artifactClass: FilesystemWatcherArtifactClass): boolean {
  return !["qa_report", "blocked", "stall_timeout"].includes(artifactClass);
}

function requiresQaPass(artifactClass: FilesystemWatcherArtifactClass): boolean {
  return !["qa_report", "manifest_mismatch", "blocked", "stall_timeout", "worker_exit_without_expected_output"].includes(artifactClass);
}

function isDraftOnly(artifactClass: FilesystemWatcherArtifactClass, canPromoteFormal: boolean): boolean {
  if (artifactClass === "temp_candidate" || artifactClass === "provider_ready_derivative" || artifactClass === "postprocess_recoverable") return true;
  if (artifactClass === "formal_output") return false;
  return !canPromoteFormal;
}

function canBecomeFutureReference(artifactClass: FilesystemWatcherArtifactClass, canPromoteFormal: boolean): boolean {
  if (artifactClass === "temp_candidate" || artifactClass === "provider_ready_derivative" || artifactClass === "postprocess_recoverable") return false;
  return artifactClass === "formal_output" && canPromoteFormal;
}

function buildMonitoredRoots(projectRoot: string): FilesystemWatcherHarnessState["monitoredRoots"] {
  const root = projectRoot || "<project-root>";
  return [
    {
      rootId: "codex-temp-generated-images",
      kind: "codex_temp_generated_images",
      label: "Codex Temp Generated Images",
      pathPolicy: "derived_static_only",
      pathHints: ["<codex-temp>/generated-images", `${root}/tmp`, `${root}/cache`, `${root}/candidates`],
      daemonStarted: false,
      notes: ["Derived from fileSnapshot paths and watcherEvents only; Phase 8.5 does not start fs.watch."],
    },
    {
      rootId: "project-outputs",
      kind: "project_outputs",
      label: "Project Outputs",
      pathPolicy: "derived_static_only",
      pathHints: [`${root}/outputs`, `${root}/02_keyframes`, `${root}/generated`],
      daemonStarted: false,
      notes: ["Expected outputs remain candidate artifacts until manifest and QA promotion gates pass."],
    },
    {
      rootId: "reports",
      kind: "reports",
      label: "Reports",
      pathPolicy: "derived_static_only",
      pathHints: [`${root}/reports`, `${root}/qa`],
      daemonStarted: false,
      notes: ["QA and manifest reports are evidence; they cannot move or promote files."],
    },
    {
      rootId: "videos",
      kind: "videos",
      label: "Videos",
      pathPolicy: "derived_static_only",
      pathHints: [`${root}/videos`, `${root}/renders`],
      daemonStarted: false,
      notes: ["Video paths are monitored as static facts while video providers remain parked."],
    },
    {
      rootId: "audio",
      kind: "audio",
      label: "Audio",
      pathPolicy: "derived_static_only",
      pathHints: [`${root}/audio`, `${root}/voice`],
      daemonStarted: false,
      notes: ["Audio paths are planning facts only; no audio provider or local daemon is started."],
    },
  ];
}

export function buildFilesystemWatcherHarnessState(input: BuildFilesystemWatcherHarnessInput): FilesystemWatcherHarnessState {
  const taskPlanById = new Map(input.imageTaskPlans.map((taskPlan) => [taskPlan.taskPlanId, taskPlan]));
  const taskPlanByJob = new Map(input.imageTaskPlans.map((taskPlan) => [taskPlan.jobId, taskPlan]));
  const healthByTaskPlan = new Map(input.generationHealthReports.map((report) => [report.taskPlanId, report]));
  const promotionByTaskPlan = new Map(input.qaPromotionReports.map((report) => [report.taskPlanId, report]));
  const harnessByTaskPlan = new Map(input.generationHarness.jobs.map((job) => [job.taskPlanId, job]));
  const requestTaskPlanIds = new Set(input.image2AdapterRequests.map((request) => request.taskPlanId));

  const streams = input.watcherEvents.map((event) => {
    const taskPlan = taskPlanById.get(event.taskId) || (event.jobId ? taskPlanByJob.get(event.jobId) : undefined);
    const taskPlanId = taskPlan?.taskPlanId || event.taskId;
    const artifactClass = artifactClassFor(event.eventType);
    const promotion = promotionByTaskPlan.get(taskPlanId);
    const health = healthByTaskPlan.get(taskPlanId);
    const manifestReport = manifestReportFor(taskPlan, input.manifestMatches);
    const harnessJob = harnessByTaskPlan.get(taskPlanId);
    const canPromoteFormal =
      artifactClass !== "temp_candidate" &&
      artifactClass !== "provider_ready_derivative" &&
      artifactClass !== "postprocess_recoverable" &&
      Boolean(promotion?.canPromoteToFormal);
    const artifactPath = event.artifactPath;
    const expectedOutputPath = event.expectedOutputPath || taskPlan?.expectedOutputPath;
    const harnessLinkStatus = harnessJob ? ("linked" as const) : ("missing_harness_link" as const);

    return {
      streamId: `filesystem_watcher_stream_${event.id}`,
      sourceEventId: event.id,
      eventType: event.eventType,
      artifactPath,
      expectedOutputPath,
      taskPlanId,
      jobId: event.jobId || taskPlan?.jobId,
      shotId: event.shotId || taskPlan?.shotId,
      artifactClass,
      monitoredKind: monitoredKindFor(artifactPath || expectedOutputPath, artifactClass),
      draftOnly: isDraftOnly(artifactClass, canPromoteFormal),
      canPromoteFormal,
      canBecomeFutureReference: canBecomeFutureReference(artifactClass, canPromoteFormal),
      requiresManifestMatch: requiresManifestMatch(artifactClass),
      requiresQaPass: requiresQaPass(artifactClass),
      manifestMatchStatus: manifestReport?.status,
      generationHealthReportId: health?.reportId,
      qaPromotionReportId: promotion?.reportId,
      generationHarnessJobId: harnessJob?.harnessJobId,
      harnessLinkStatus,
      missingHarnessLinkReason: harnessJob
        ? undefined
        : `No generationHarness job matched taskPlanId ${taskPlanId}${event.jobId ? ` or jobId ${event.jobId}` : ""}.`,
      notes: [
        ...event.notes,
        "Phase 8.5 watcher harness is derived/static and does not start a filesystem daemon.",
        ...(artifactClass === "worker_exit_without_expected_output" || requestTaskPlanIds.has(taskPlanId)
          ? ["Worker/provider self-report cannot complete or promote a task."]
          : []),
      ],
    };
  });

  return {
    schemaVersion: "0.1.0",
    generatedAt: input.generatedAt,
    monitoredKinds: filesystemWatcherMonitoredKinds,
    monitoredRoots: buildMonitoredRoots(input.projectRoot),
    streams: streams.sort((left, right) => left.streamId.localeCompare(right.streamId)),
    summary: {
      totalStreams: streams.length,
      draftOnly: streams.filter((stream) => stream.draftOnly).length,
      promotableFormal: streams.filter((stream) => stream.canPromoteFormal).length,
      missingHarnessLinks: streams.filter((stream) => stream.harnessLinkStatus === "missing_harness_link").length,
      tempCandidates: streams.filter((stream) => stream.artifactClass === "temp_candidate").length,
      expectedOutputs: streams.filter((stream) => stream.artifactClass === "expected_output").length,
      qaReports: streams.filter((stream) => stream.artifactClass === "qa_report").length,
      manifestMismatches: streams.filter((stream) => stream.artifactClass === "manifest_mismatch").length,
      daemonStarted: false,
      liveSubmitAllowed: false,
    },
    hardLocks: filesystemWatcherHardLocks,
    derivedOnly: true,
    fsWatchDaemonEnabled: false,
    daemonStarted: false,
    providerSubmissionForbidden: true,
    liveSubmitAllowed: false,
    notes: [
      `Derived from ${snapshotPathCount(input.fileSnapshot)} file snapshot entries and ${input.watcherEvents.length} watcher events.`,
      "No fs.watch daemon, file move/copy/delete, provider submit, or formal promotion is performed by this harness.",
      "Formal promotion remains owned by qaPromotionReports.canPromoteToFormal and explicit promotion gates.",
    ],
  };
}
