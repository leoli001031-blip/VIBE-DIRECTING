import type { ProjectRuntimeState } from "./projectState";
import type { AudioPlan, AudioPlanningState, PreviewEvent } from "./types";
import { buildTtsProviderPlanningState } from "./ttsProviderPlanning";
import { buildVoiceAudioSettingsState } from "./voiceAudioSettings";
import { hashProjectVibeFacts, isPortableProjectPath } from "../project/projectVibe";
import type {
  ProjectVibeAsset,
  ProjectVibeDocument,
  ProjectVibeRunReceipt,
  ProjectVibeTransaction,
} from "../project/types";

export const dialogueAudioMaterialSchemaVersion = "0.1.0";

export type DialogueAudioMaterialAssetStatus = "needs_review" | "locked";

export interface DialogueAudioMaterialInput {
  runtimeState: ProjectRuntimeState;
  shotId: string;
  outputRelativePath: string;
  providerId?: string;
  receiptRelativePath?: string;
  outputSha256?: string;
  outputSizeBytes?: number;
  linkedTtsJobId?: string;
  generatedAt?: string;
}

export interface DialogueAudioMaterialRuntimeResult {
  runtimeState: ProjectRuntimeState;
  updated: boolean;
  audioPlan?: AudioPlan;
  previewEventIds: string[];
  warnings: string[];
}

export interface DialogueAudioProjectVibeTransactionInput {
  project: ProjectVibeDocument;
  shotId: string;
  outputRelativePath: string;
  providerId?: string;
  receiptRelativePath?: string;
  outputSha256?: string;
  outputSizeBytes?: number;
  transcript?: string;
  assetStatus?: DialogueAudioMaterialAssetStatus;
  generatedAt?: string;
}

export interface DialogueAudioProjectVibeTransactionResult {
  status: "ready" | "blocked";
  transaction?: ProjectVibeTransaction;
  asset?: ProjectVibeAsset;
  runReceipt?: ProjectVibeRunReceipt;
  blockedReasons: string[];
}

function clean(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function safeId(value: string): string {
  return value.trim().replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/^_+|_+$/g, "") || "audio";
}

function stableHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function normalizeProjectRelativePath(path: string): string {
  return path.trim().replace(/\\/g, "/").replace(/^\.?\//, "");
}

function outputHash(input: Pick<DialogueAudioMaterialInput, "outputRelativePath" | "outputSha256">): string {
  return clean(input.outputSha256) || stableHash(input.outputRelativePath);
}

function linkedJobId(input: DialogueAudioMaterialInput): string {
  return clean(input.linkedTtsJobId)
    || `${safeId(input.providerId || "local-qwen3-tts-clone")}_${safeId(input.shotId)}_${outputHash(input).slice(0, 12)}`;
}

function hasSpokenAudioEvent(event: PreviewEvent, shotId: string): boolean {
  return event.shotId === shotId && (event.type === "dialogue_audio" || event.type === "narration_audio");
}

function buildGeneratedAudioPreviewEvent(plan: AudioPlan, sourceTaskId: string, mediaPath: string): PreviewEvent {
  return {
    id: `audio_${safeId(plan.shotId)}_dialogue_generated`,
    mode: "draft_preview",
    type: "dialogue_audio",
    shotId: plan.shotId,
    startSeconds: 0,
    durationSeconds: plan.targetDurationSeconds,
    mediaPath,
    qaStatus: "PASS",
    sourceTaskId,
  };
}

function updatePreviewEvents(input: {
  audioPlanning: AudioPlanningState;
  plan: AudioPlan;
  outputPath: string;
  sourceTaskId: string;
}): { events: PreviewEvent[]; updatedIds: string[] } {
  const updatedIds: string[] = [];
  const events = input.audioPlanning.previewMix.events.map((event) => {
    if (!hasSpokenAudioEvent(event, input.plan.shotId)) return event;
    updatedIds.push(event.id);
    return {
      ...event,
      mediaPath: input.outputPath,
      qaStatus: "PASS" as const,
      sourceTaskId: input.sourceTaskId,
    };
  });

  if (updatedIds.length) return { events, updatedIds };

  const event = buildGeneratedAudioPreviewEvent(input.plan, input.sourceTaskId, input.outputPath);
  return { events: [...events, event], updatedIds: [event.id] };
}

function withUniquePath(paths: string[], path: string): string[] {
  return Array.from(new Set([...paths, path].filter(Boolean)));
}

export function applyDialogueAudioMaterialToRuntimeState(
  input: DialogueAudioMaterialInput,
): DialogueAudioMaterialRuntimeResult {
  const outputRelativePath = normalizeProjectRelativePath(input.outputRelativePath);
  const warnings: string[] = [];
  if (!outputRelativePath) {
    return {
      runtimeState: input.runtimeState,
      updated: false,
      previewEventIds: [],
      warnings: ["dialogue_audio_output_path_missing"],
    };
  }

  const generatedAt = input.generatedAt || new Date().toISOString();
  const sourceTaskId = linkedJobId(input);
  const existingPlan = input.runtimeState.audioPlanning.shotPlans.find((plan) => plan.shotId === input.shotId);
  if (!existingPlan) {
    return {
      runtimeState: input.runtimeState,
      updated: false,
      previewEventIds: [],
      warnings: [`audio_plan_missing:${input.shotId}`],
    };
  }

  const shotPlans = input.runtimeState.audioPlanning.shotPlans.map((plan) => {
    if (plan.shotId !== input.shotId) return plan;
    return {
      ...plan,
      outputPath: outputRelativePath,
      linkedTtsJobId: sourceTaskId,
      audioQaStatus: "PASS" as const,
      deliveryNotes: [
        plan.deliveryNotes,
        "Generated dialogue audio is available as project material and can be attached to video generation as dialogue timing/performance reference.",
      ].filter(Boolean).join(" "),
    };
  });
  const audioPlan = shotPlans.find((plan) => plan.shotId === input.shotId);
  if (!audioPlan) {
    warnings.push(`audio_plan_update_failed:${input.shotId}`);
    return {
      runtimeState: input.runtimeState,
      updated: false,
      previewEventIds: [],
      warnings,
    };
  }

  const preview = updatePreviewEvents({
    audioPlanning: input.runtimeState.audioPlanning,
    plan: audioPlan,
    outputPath: outputRelativePath,
    sourceTaskId,
  });
  const ttsProviderPlanning = buildTtsProviderPlanningState({
    generatedAt,
    shotPlans,
    preferredRoute: input.runtimeState.audioPlanning.ttsProviderPlanning?.preferredRoute,
  });
  const audioPlanning: AudioPlanningState = {
    ...input.runtimeState.audioPlanning,
    generatedAt,
    shotPlans,
    previewMix: {
      ...input.runtimeState.audioPlanning.previewMix,
      eventCount: preview.events.length,
      missingOutputPathCount: shotPlans.filter((plan) => !plan.outputPath).length,
      events: preview.events,
      notes: [
        ...input.runtimeState.audioPlanning.previewMix.notes,
        `Generated dialogue audio linked for ${input.shotId}: ${outputRelativePath}`,
      ],
    },
    ttsProviderPlanning,
    exportPackageSummary: {
      ...input.runtimeState.audioPlanning.exportPackageSummary,
      plannedPaths: withUniquePath(input.runtimeState.audioPlanning.exportPackageSummary.plannedPaths, outputRelativePath),
      notes: [
        ...input.runtimeState.audioPlanning.exportPackageSummary.notes,
        `Generated dialogue audio should be copied into export packages: ${outputRelativePath}`,
      ],
    },
  };
  const voiceAudioSettings = buildVoiceAudioSettingsState({
    generatedAt,
    voiceSourceLibrary: input.runtimeState.voiceSourceLibrary,
    audioPlanning,
  });

  return {
    runtimeState: {
      ...input.runtimeState,
      generatedAt,
      audioPlanning,
      voiceAudioSettings,
    },
    updated: true,
    audioPlan,
    previewEventIds: preview.updatedIds,
    warnings,
  };
}

function textConstraintLines(input: DialogueAudioProjectVibeTransactionInput): string[] {
  return [
    "role:dialogue_audio",
    `provider:${clean(input.providerId) || "local-qwen3-tts-clone"}`,
    clean(input.transcript) ? `transcript:${clean(input.transcript)}` : "",
    clean(input.outputSha256) ? `sha256:${clean(input.outputSha256)}` : "",
    typeof input.outputSizeBytes === "number" ? `bytes:${input.outputSizeBytes}` : "",
    "use_for:dialogue timing, performance rhythm, mouth timing",
    "ignore_for:visual identity, style, BGM, music",
  ].filter(Boolean);
}

function sourceRefsFor(input: DialogueAudioProjectVibeTransactionInput): string[] {
  return [
    `project.vibe#shots/${input.shotId}`,
    clean(input.receiptRelativePath) ? `receipt:${normalizeProjectRelativePath(input.receiptRelativePath || "")}` : "",
    clean(input.outputSha256) ? `sha256:${clean(input.outputSha256)}` : "",
  ].filter(Boolean);
}

export function buildDialogueAudioMaterialProjectVibeTransaction(
  input: DialogueAudioProjectVibeTransactionInput,
): DialogueAudioProjectVibeTransactionResult {
  const outputRelativePath = normalizeProjectRelativePath(input.outputRelativePath);
  const generatedAt = input.generatedAt || new Date().toISOString();
  const providerId = clean(input.providerId) || "local-qwen3-tts-clone";
  const blockedReasons = [
    input.project.shots.some((shot) => shot.id === input.shotId) ? "" : `shot_missing:${input.shotId}`,
    outputRelativePath ? "" : "dialogue_audio_output_path_missing",
    outputRelativePath && !isPortableProjectPath(outputRelativePath) ? "dialogue_audio_output_path_not_project_relative" : "",
  ].filter(Boolean);

  if (blockedReasons.length) {
    return { status: "blocked", blockedReasons };
  }

  const hash = clean(input.outputSha256) || stableHash(outputRelativePath);
  const assetId = `audio_${safeId(input.shotId)}_dialogue_${hash.slice(0, 12)}`;
  const asset: ProjectVibeAsset = {
    id: assetId,
    kind: "reference",
    label: `${input.shotId} 对白音频`,
    status: input.assetStatus || "needs_review",
    path: outputRelativePath,
    textConstraints: textConstraintLines(input),
    usedByShotIds: [input.shotId],
    sourceRefs: sourceRefsFor(input),
    roleBinding: {
      role: "dialogue_audio",
      useFor: ["dialogue timing", "performance rhythm", "mouth timing"],
      ignoreFor: ["visual identity", "visual style", "music", "BGM"],
      priority: 70,
      conflictRule: "Dialogue audio guides timing and performance only; it must not override storyboard, character, scene, or prop references.",
    },
  };
  const runReceipt: ProjectVibeRunReceipt = {
    id: `run_tts_${safeId(input.shotId)}_${hash.slice(0, 12)}`,
    runKind: "provider",
    status: "succeeded",
    createdAt: generatedAt,
    summary: `Generated dialogue audio for ${input.shotId} using ${providerId}.`,
    sourceFactHash: hashProjectVibeFacts(input.project),
    affectedShotIds: [input.shotId],
    producedAssetIds: [asset.id],
    evidenceRefs: [
      outputRelativePath,
      ...sourceRefsFor(input),
    ],
    projectFactsMutated: true,
    runtimeFixtureUsed: false,
  };
  const transaction: ProjectVibeTransaction = {
    id: `txn_dialogue_audio_${safeId(input.shotId)}_${hash.slice(0, 12)}`,
    actor: "system",
    reason: "Register generated dialogue TTS output as Project.vibe material.",
    createdAt: generatedAt,
    operations: [
      { op: "upsert_asset", asset },
      { op: "append_run_receipt", run: runReceipt },
    ],
  };

  return {
    status: "ready",
    transaction,
    asset,
    runReceipt,
    blockedReasons: [],
  };
}
