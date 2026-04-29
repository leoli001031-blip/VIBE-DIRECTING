import { buildContextBudget } from "./contextBudgeter";
import { validateTaskEnvelope, type EnvelopeValidationResult } from "./envelopeValidator";
import { selectAvailableKnowledgePacks } from "./knowledgeLibrary";
import { normalizeKnowledgeManifest, validateKnowledgeManifest } from "./knowledgeManifest";
import { routeKnowledge } from "./knowledgeRouter";
import type { ContextBudgetResult, KnowledgePack, KnowledgePackManifest, KnowledgeRouteResult, KnowledgeTaskPurpose } from "./knowledgeTypes";
import { matchTaskRunOutputs, type ManifestMatchReport } from "./manifestMatcher";
import { summarizeSourceIndex, computeSourceIndexHash } from "./sourceIndex";
import { buildTaskEnvelope } from "./taskEnvelope";
import { canEnterReadyToSubmit, createTaskRunFromEnvelope, type QueueGateResult } from "./taskQueue";
import type {
  GenerationJob,
  GateStatus,
  KeyframePairDerivation,
  PreflightBlocker,
  PreviewEvent,
  ProjectAudit,
  ProjectSourceIndex,
  ProviderSlot,
  ReferenceAuthority,
  ShotRecord,
  TaskEnvelope,
  TaskRun,
} from "./types";

export interface StorySectionView {
  id: string;
  label: string;
  shotCount: number;
  blockedCount: number;
  readyCount: number;
  shotIds: string[];
}

export interface VisualMemorySummary {
  total: number;
  existing: number;
  locked: number;
  needsReview: number;
  missing: number;
  byType: Array<{ type: string; total: number; existing: number; missing: number }>;
}

export interface TaskRuntimeView {
  job: GenerationJob;
  shot?: ShotRecord;
  envelope: TaskEnvelope;
  taskRun: TaskRun;
  queueGate: QueueGateResult;
  manifestMatch: ManifestMatchReport;
  validator: EnvelopeValidationResult;
  routeResult: KnowledgeRouteResult;
  contextBudget: ContextBudgetResult;
  nextStep: string;
}

export interface KnowledgeRouteTestView {
  intent: string;
  routeResult: KnowledgeRouteResult;
  contextBudget: ContextBudgetResult;
}

export interface RuntimeKnowledgeSummary {
  packCount: number;
  enabledCount: number;
  categories: Array<{ category: string; count: number; enabled: number }>;
  manifestHash: string;
  manifestVersion: string;
  validationIssues: string[];
  routeTest?: KnowledgeRouteTestView;
}

export interface RuntimeView {
  audit: ProjectAudit;
  sourceIndex: ProjectSourceIndex;
  sourceIndexSummary: ReturnType<typeof summarizeSourceIndex>;
  storySections: StorySectionView[];
  visualMemory: VisualMemorySummary;
  taskViews: TaskRuntimeView[];
  queueSummary: {
    total: number;
    ready: number;
    blocked: number;
    parked: number;
    succeeded: number;
    missingOutputs: number;
  };
  preflightSummary: {
    blocked: number;
    warnings: number;
    blockers: PreflightBlocker[];
  };
  previewEvents: PreviewEvent[];
  manifestSummary: {
    complete: number;
    present: number;
    missing: number;
    recoverable: number;
  };
  knowledge: RuntimeKnowledgeSummary;
  nextStep: string;
  stateSource?: {
    kind: string;
    label: string;
    path?: string;
    sourceAuditPath?: string;
    sourceImportedAt?: string;
    note?: string;
  };
}

interface RuntimeViewOptions {
  selectedShotId?: string;
  knowledgeTestIntent?: string;
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) => left.localeCompare(right));
}

function actLabel(actId: string) {
  const match = /^A(\d+)$/i.exec(actId);
  if (!match) return actId === "unknown" ? "Unknown Act" : actId;
  const roman = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"][Number(match[1]) - 1];
  return roman ? `Act ${roman}` : `Act ${match[1]}`;
}

function sectionKey(shot: ShotRecord) {
  return shot.sectionId || shot.actId || "unknown";
}

function buildStorySections(shots: ShotRecord[]): StorySectionView[] {
  const groups = new Map<string, ShotRecord[]>();
  for (const shot of shots) {
    const key = sectionKey(shot);
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

function buildVisualMemorySummary(audit: ProjectAudit): VisualMemorySummary {
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

function pathSnapshotFromAudit(audit: ProjectAudit): string[] {
  const assetPaths = audit.assets.filter((asset) => asset.status !== "missing").map((asset) => asset.path);
  const shotPaths = audit.shots.flatMap((shot) => {
    const paths: string[] = [];
    if (shot.startFrame && !shot.issues.includes("missing_start_frame")) paths.push(shot.startFrame);
    if (shot.endFrame && !shot.issues.includes("missing_end_frame")) paths.push(shot.endFrame);
    if (shot.videoPath) paths.push(shot.videoPath);
    return paths;
  });

  return uniqueSorted([...(audit.fileSnapshot || []), ...assetPaths, ...shotPaths]);
}

function createSourceIndexFromAudit(audit: ProjectAudit, manifest: KnowledgePackManifest): ProjectSourceIndex {
  if (audit.sourceIndex) return { ...audit.sourceIndex, sourceIndexHash: computeSourceIndexHash(audit.sourceIndex) };

  const lockedReferenceIds = audit.assets
    .filter((asset) => asset.status !== "missing" && asset.lockedStatus === "locked" && asset.safeForFutureReference)
    .map((asset) => asset.path);
  const candidateReferenceIds = [
    ...audit.assets.filter((asset) => asset.status !== "missing" && !lockedReferenceIds.includes(asset.path)).map((asset) => asset.path),
    ...audit.shots.flatMap((shot) => [shot.startFrame, shot.endFrame].filter((path): path is string => Boolean(path))),
  ];
  const failedReferenceIds = audit.assets.filter((asset) => asset.status === "missing").map((asset) => asset.path);
  const packVersionBindings = Object.fromEntries(manifest.packs.map((pack) => [pack.id, { version: pack.version, hash: pack.hash }]));
  const index: ProjectSourceIndex = {
    projectId: audit.projectTitle.replace(/\s+/g, "-").toLowerCase() || "runtime-project",
    projectVersion: audit.importedAt,
    sourceIndexHash: "",
    currentProductionBibleId: audit.sourceTask || undefined,
    currentStoryFlowId: `${audit.projectRoot}/00_task/shot_spec.yaml`,
    currentVisualMemoryId: `${audit.projectRoot}/visual_memory`,
    currentPromptHashes: Object.fromEntries(audit.jobs.filter((job) => job.promptPath).map((job) => [job.id, job.promptPath || ""])),
    lockedReferenceIds: uniqueSorted(lockedReferenceIds),
    candidateReferenceIds: uniqueSorted(candidateReferenceIds),
    rejectedReferenceIds: [],
    failedReferenceIds: uniqueSorted(failedReferenceIds),
    confirmedDecisionIds: [],
    staleArtifactIds: [],
    knowledgeLibraryRoot: manifest.knowledgeLibraryRoot,
    activeKnowledgePackIds: manifest.packs.filter((pack) => pack.enabled).map((pack) => pack.id),
    disabledKnowledgePackIds: manifest.packs.filter((pack) => !pack.enabled).map((pack) => pack.id),
    knowledgeManifestHash: manifest.manifestHash,
    packVersionBindings,
    updatedAt: audit.importedAt,
  };

  return { ...index, sourceIndexHash: computeSourceIndexHash(index) };
}

function referenceFromPath(path: string, sourceIndex: ProjectSourceIndex): ReferenceAuthority {
  const locked = sourceIndex.lockedReferenceIds.includes(path);
  const rejected = sourceIndex.rejectedReferenceIds.includes(path);
  const failed = sourceIndex.failedReferenceIds.includes(path);

  return {
    id: path,
    path,
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

function jobPurpose(job: GenerationJob): KnowledgeTaskPurpose {
  if (job.slot === "image.reference_asset") return "asset";
  if (job.slot === "image.generate") return "keyframe";
  if (job.slot === "image.edit") return "edit";
  if (job.slot === "video.i2v" || job.slot === "video.t2v.experimental" || job.slot === "video.extend" || job.slot === "video.edit") return "i2v";
  if (job.slot === "audio.tts" || job.slot === "audio.music") return "audio";
  return "unknown";
}

function inferRoutePurpose(intent: string): { purpose: KnowledgeTaskPurpose; slot?: ProviderSlot } {
  const lowered = intent.toLowerCase();
  if (/qa|验收|检查|审计|连续性/.test(lowered)) return { purpose: "qa" };
  if (/脚本|剧本|story|storyflow|分镜|对白/.test(lowered)) return { purpose: "script" };
  if (/视频|i2v|seedance|即梦|运镜|motion|镜头运动/.test(lowered)) return { purpose: "i2v", slot: "video.i2v" };
  if (/关键帧|image|prompt|构图|光|色彩|风格/.test(lowered)) return { purpose: "keyframe", slot: "image.edit" };
  if (/旁白|音乐|声音|tts|voice|audio/.test(lowered)) return { purpose: "audio", slot: "audio.tts" };
  return { purpose: "unknown" };
}

function buildKeyframePairDerivation(job: GenerationJob, shot?: ShotRecord): KeyframePairDerivation | undefined {
  if (job.slot !== "video.i2v" || !shot) return undefined;
  const pairGate: GateStatus = shot.gates.pair;
  const hasFrames = Boolean(shot.startFrame && shot.endFrame && !shot.issues.includes("missing_start_frame") && !shot.issues.includes("missing_end_frame"));

  return {
    shotId: shot.id,
    startFrameId: shot.startFrame || `${shot.id}:start`,
    endFrameId: shot.endFrame || `${shot.id}:end`,
    endDerivationSource: hasFrames ? "start_frame" : "unknown",
    validForI2vPair: hasFrames && (pairGate === "PASS" || pairGate === "PARTIAL"),
    exceptionReason: hasFrames ? undefined : "Start or end keyframe is missing from runtime audit.",
    allowedDelta: ["motion", "micro-expression", "camera movement"],
    mustPreserve: ["character identity", "scene layout", "style capsule"],
    mustNotAdd: ["new characters", "unapproved props", "text-to-video fallback"],
  };
}

function deriveNextStep(task: Pick<TaskRuntimeView, "queueGate" | "envelope" | "manifestMatch" | "validator">) {
  if (!task.validator.valid) return `Fix envelope schema: ${task.validator.issues[0]}`;
  if (task.envelope.preflight.blockers.some((blocker) => blocker.code.includes("provider") || blocker.code.includes("fallback"))) {
    return "Blocked by provider policy";
  }
  if (task.envelope.preflight.blockers.some((blocker) => blocker.code === "missing_source_index")) {
    return "Needs source index binding";
  }
  if (task.queueGate.status === "parked") return "Provider parked; keep as dry-run envelope";
  if (task.queueGate.status === "blocked") return task.queueGate.blockers[0] || "Blocked by preflight";
  if (task.manifestMatch.status === "missing_expected_output") return "Ready for dry check; expected output not present";
  if (task.queueGate.status === "ready") return "Ready dry check";
  return "Monitor queue state";
}

function buildTaskViews(audit: ProjectAudit, sourceIndex: ProjectSourceIndex, manifest: KnowledgePackManifest): TaskRuntimeView[] {
  const availablePacks = selectAvailableKnowledgePacks(manifest, sourceIndex);
  const fsSnapshot = pathSnapshotFromAudit(audit);

  return audit.jobs.map((job) => {
    const shot = audit.shots.find((item) => job.id.includes(item.id));
    const routeResult = routeKnowledge({
      taskId: job.id,
      userIntent: `${shot?.storyFunction || job.id} ${job.slot} ${job.requiredMode}`,
      taskPurpose: jobPurpose(job),
      providerSlot: job.slot,
      contextLevel: "L1",
      availablePacks,
    });
    const contextBudget = buildContextBudget({ routeResult, availablePacks, maxInjectionTokens: 900 });
    const envelope = buildTaskEnvelope(job, shot, audit.issues, {
      sourceIndex,
      references: job.references.map((path) => referenceFromPath(path, sourceIndex)),
      keyframePairDerivation: buildKeyframePairDerivation(job, shot),
      knowledgeRouteResult: routeResult,
      contextBudget,
      preflightScope: "formal_execution",
    });
    const queueGate = canEnterReadyToSubmit(envelope);
    const taskRun = createTaskRunFromEnvelope(envelope);
    const manifestMatch = matchTaskRunOutputs(taskRun, fsSnapshot);
    const validator = validateTaskEnvelope(envelope);
    const taskView = {
      job,
      shot,
      envelope,
      taskRun,
      queueGate,
      manifestMatch,
      validator,
      routeResult,
      contextBudget,
      nextStep: "",
    };

    return {
      ...taskView,
      nextStep: deriveNextStep(taskView),
    };
  });
}

function buildPreviewEvents(audit: ProjectAudit, taskViews: TaskRuntimeView[]): PreviewEvent[] {
  let cursor = 0;

  return audit.shots.map((shot, index) => {
    const videoTask = taskViews.find((task) => task.shot?.id === shot.id && task.job.slot === "video.i2v");
    const keyframeTask = taskViews.find((task) => task.shot?.id === shot.id && (task.job.slot === "image.generate" || task.job.slot === "image.edit"));
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

function buildKnowledgeSummary(
  manifest: KnowledgePackManifest,
  availablePacks: KnowledgePack[],
  intent?: string,
): RuntimeKnowledgeSummary {
  const categories = Array.from(new Set(manifest.packs.map((pack) => pack.category))).sort().map((category) => {
    const packs = manifest.packs.filter((pack) => pack.category === category);
    return {
      category,
      count: packs.length,
      enabled: packs.filter((pack) => pack.enabled).length,
    };
  });
  const trimmedIntent = intent?.trim();
  const inferred = trimmedIntent ? inferRoutePurpose(trimmedIntent) : undefined;
  const routeResult = trimmedIntent && inferred
    ? routeKnowledge({
        userIntent: trimmedIntent,
        taskPurpose: inferred.purpose,
        providerSlot: inferred.slot,
        contextLevel: "L1",
        availablePacks,
        consumers: ["diagnostics", "prompt_compiler", "qa_gate"],
      })
    : undefined;
  const contextBudget = routeResult ? buildContextBudget({ routeResult, availablePacks, maxInjectionTokens: 700 }) : undefined;

  return {
    packCount: manifest.packs.length,
    enabledCount: manifest.packs.filter((pack) => pack.enabled).length,
    categories,
    manifestHash: manifest.manifestHash,
    manifestVersion: manifest.manifestVersion,
    validationIssues: validateKnowledgeManifest(manifest),
    routeTest: trimmedIntent && routeResult && contextBudget ? { intent: trimmedIntent, routeResult, contextBudget } : undefined,
  };
}

function queueSummary(taskViews: TaskRuntimeView[]): RuntimeView["queueSummary"] {
  return {
    total: taskViews.length,
    ready: taskViews.filter((task) => task.queueGate.status === "ready").length,
    blocked: taskViews.filter((task) => task.queueGate.status === "blocked").length,
    parked: taskViews.filter((task) => task.queueGate.status === "parked").length,
    succeeded: taskViews.filter((task) => task.job.status === "success").length,
    missingOutputs: taskViews.filter((task) => task.manifestMatch.status === "missing_expected_output").length,
  };
}

function manifestSummary(taskViews: TaskRuntimeView[]): RuntimeView["manifestSummary"] {
  return {
    complete: taskViews.filter((task) => task.manifestMatch.status === "complete").length,
    present: taskViews.filter((task) => task.manifestMatch.status === "actual_output_present").length,
    missing: taskViews.filter((task) => task.manifestMatch.status === "missing_expected_output").length,
    recoverable: taskViews.filter((task) => task.manifestMatch.status === "postprocess_recoverable").length,
  };
}

function preflightSummary(taskViews: TaskRuntimeView[]): RuntimeView["preflightSummary"] {
  const blockers = taskViews.flatMap((task) => task.envelope.preflight.blockers);
  return {
    blocked: taskViews.filter((task) => task.envelope.preflight.status === "blocked").length,
    warnings: taskViews.reduce((count, task) => count + task.envelope.preflight.warnings.length, 0),
    blockers,
  };
}

function deriveRuntimeNextStep(taskViews: TaskRuntimeView[]) {
  const firstBlocked = taskViews.find((task) => task.queueGate.status === "blocked");
  if (firstBlocked) return firstBlocked.nextStep;
  const firstParked = taskViews.find((task) => task.queueGate.status === "parked");
  if (firstParked) return firstParked.nextStep;
  const firstReady = taskViews.find((task) => task.queueGate.status === "ready");
  if (firstReady) return firstReady.nextStep;
  return "Import a runtime audit or select a shot";
}

export function buildRuntimeView(
  audit: ProjectAudit,
  knowledgeManifestInput: KnowledgePackManifest,
  options: RuntimeViewOptions = {},
): RuntimeView {
  const manifest = normalizeKnowledgeManifest(knowledgeManifestInput);
  const sourceIndex = createSourceIndexFromAudit(audit, manifest);
  const taskViews = buildTaskViews(audit, sourceIndex, manifest);
  const selectedTasks = options.selectedShotId ? taskViews.filter((task) => task.shot?.id === options.selectedShotId) : taskViews;
  const availablePacks = selectAvailableKnowledgePacks(manifest, sourceIndex);

  return {
    audit,
    sourceIndex,
    sourceIndexSummary: summarizeSourceIndex(sourceIndex),
    storySections: buildStorySections(audit.shots),
    visualMemory: buildVisualMemorySummary(audit),
    taskViews,
    queueSummary: queueSummary(taskViews),
    preflightSummary: preflightSummary(taskViews),
    previewEvents: buildPreviewEvents(audit, taskViews),
    manifestSummary: manifestSummary(taskViews),
    knowledge: buildKnowledgeSummary(manifest, availablePacks, options.knowledgeTestIntent),
    nextStep: deriveRuntimeNextStep(selectedTasks.length ? selectedTasks : taskViews),
  };
}
