import type { AudioPlanningState, DemoPackageVideoResult, PreviewEvent, PreviewPlan } from "./types";

export const finalVideoPlanSchemaVersion = "0.1.0";

export type FinalVideoPlanStatus = "ready_with_existing_videos" | "manifest_only" | "blocked";
export type FinalVideoCopyStatus = "copy_ready" | "hash_unverified" | "missing_source";

export interface FinalVideoTimelineItem {
  id: string;
  shotId?: string;
  type: PreviewEvent["type"] | "missing_video";
  startSeconds: number;
  durationSeconds: number;
  sourcePath?: string;
  stablePath?: string;
  reviewStatus?: DemoPackageVideoResult["reviewStatus"];
  notes: string[];
}

export interface FinalVideoCopyItem {
  id: string;
  shotId?: string;
  sourcePath?: string;
  stablePath: string;
  sourceHash?: string;
  durationSeconds?: number;
  reviewStatus: DemoPackageVideoResult["reviewStatus"];
  status: FinalVideoCopyStatus;
  notes: string[];
}

export interface FinalVideoAudioPlan {
  manifestPath: "audio/manifest.json";
  narrationDirectory: "audio/narration";
  voiceReferenceDirectory: "audio/voice-reference";
  localTtsEndpointPlanned: true;
  localQwen3VoiceClonePlanned: true;
  cloudTtsDependency: false;
  plannedNarrationPaths: string[];
  plannedVoiceReferencePaths: string[];
  notes: string[];
}

export interface FinalVideoCompositionPlan {
  schemaVersion: typeof finalVideoPlanSchemaVersion;
  kind: "final_video_composition_manifest";
  generatedAt: string;
  status: FinalVideoPlanStatus;
  finalVideoDirectory: "final-video";
  renderedFinalVideo: false;
  compositionManifestOnly: true;
  sourcePreviewPlanId: string;
  sourcePreviewStatus: PreviewPlan["status"];
  timeline: FinalVideoTimelineItem[];
  copyItems: FinalVideoCopyItem[];
  missingShotIds: string[];
  blockedReasons: string[];
  audio: FinalVideoAudioPlan;
  notes: string[];
}

function safeId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]+/g, "_");
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) => left.localeCompare(right));
}

function extensionFor(path?: string): string {
  const match = (path || "").match(/\.(mp4|mov|webm)$/i);
  return match ? `.${match[1].toLowerCase()}` : ".mp4";
}

function sourceIsUsable(path?: string): boolean {
  return Boolean(path) && !path!.startsWith("redacted_ref#") && !path!.startsWith("redacted_path#");
}

function stableVideoPath(result: DemoPackageVideoResult, index: number): string {
  const id = safeId(result.shotId || result.id || `clip_${index + 1}`);
  return `final-video/${String(index + 1).padStart(2, "0")}_${id}${extensionFor(result.firstFrameProtectedVideoPath || result.videoPath)}`;
}

function audioOutputPaths(audioPlanning?: AudioPlanningState): string[] {
  return uniqueSorted([
    ...(audioPlanning?.shotPlans || []).map((plan) => plan.outputPath || ""),
    ...(audioPlanning?.exportPackageSummary.plannedPaths || []),
    ...(audioPlanning?.musicReferences || []).flatMap((reference) => [reference.analysisPath || "", reference.finalMixPath || ""]),
  ]);
}

export function buildFinalVideoAudioPlan(audioPlanning?: AudioPlanningState): FinalVideoAudioPlan {
  return {
    manifestPath: "audio/manifest.json",
    narrationDirectory: "audio/narration",
    voiceReferenceDirectory: "audio/voice-reference",
    localTtsEndpointPlanned: true,
    localQwen3VoiceClonePlanned: true,
    cloudTtsDependency: false,
    plannedNarrationPaths: audioOutputPaths(audioPlanning).filter((item) => /narration|dialogue|voice/i.test(item)),
    plannedVoiceReferencePaths: audioOutputPaths(audioPlanning).filter((item) => /voice[-_/]?reference|reference[-_/]?voice|speaker/i.test(item)),
    notes: [
      "Audio export structure defaults to local Qwen3 voice-clone outputs or imported narration assets.",
      "Imported music references are preserved for rhythm documentation and local final-video mixing.",
      "IndexTTS can remain as a local fallback, but Qwen3 is the demo default for Japanese dialogue.",
      "No cloud TTS provider is called or required by this export contract.",
    ],
  };
}

export function buildFinalVideoCompositionPlan(input: {
  generatedAt: string;
  preview: PreviewPlan;
  videoResults: DemoPackageVideoResult[];
  audioPlanning?: AudioPlanningState;
}): FinalVideoCompositionPlan {
  const copyItems = input.videoResults.map((result, index): FinalVideoCopyItem => {
    const sourcePath = result.firstFrameProtectedVideoPath || result.videoPath;
    const sourceHash = result.outputHash;
    const status: FinalVideoCopyStatus = !sourceIsUsable(sourcePath) ? "missing_source" : sourceHash ? "copy_ready" : "hash_unverified";
    return {
      id: `final_video_copy_${safeId(result.shotId || result.id || String(index + 1))}`,
      shotId: result.shotId,
      sourcePath,
      stablePath: stableVideoPath(result, index),
      sourceHash,
      durationSeconds: result.durationSeconds,
      reviewStatus: result.reviewStatus,
      status,
      notes: [
        sourcePath ? "Existing video can be copied into the stable final-video directory." : "No existing video source is available.",
        sourceHash ? "Source hash is recorded from provider/export receipts." : "Source hash is not available; copy remains hash-unverified.",
      ],
    };
  });
  const copyByShotId = new Map(copyItems.filter((item) => item.shotId).map((item) => [item.shotId || "", item]));
  const timeline = input.preview.events.map((event): FinalVideoTimelineItem => {
    const copy = event.shotId ? copyByShotId.get(event.shotId) : undefined;
    return {
      id: `final_timeline_${safeId(event.id)}`,
      shotId: event.shotId,
      type: event.type === "video_clip" ? "video_clip" : event.type === "blocked_placeholder" ? "missing_video" : event.type,
      startSeconds: event.startSeconds,
      durationSeconds: event.durationSeconds,
      sourcePath: copy?.sourcePath || event.mediaPath,
      stablePath: copy?.stablePath,
      reviewStatus: copy?.reviewStatus,
      notes: [
        copy?.stablePath ? "Uses stable final-video copy when adapter execution is confirmed." : "Uses manifest reference only; no final rendered clip is claimed.",
      ],
    };
  });
  const missingShotIds = uniqueSorted([
    ...copyItems.filter((item) => item.status === "missing_source").map((item) => item.shotId || ""),
    ...input.preview.events.filter((event) => event.type === "blocked_placeholder" || !event.mediaPath).map((event) => event.shotId || ""),
  ]);
  const blockedReasons = uniqueSorted([
    ...input.preview.blockedReasons,
    ...copyItems.filter((item) => item.status === "missing_source").map((item) => `${item.shotId || item.id}: no video source available.`),
  ]);
  const readyCopyCount = copyItems.filter((item) => item.status === "copy_ready").length;
  const status: FinalVideoPlanStatus = blockedReasons.length
    ? readyCopyCount > 0 ? "manifest_only" : "blocked"
    : readyCopyCount > 0 ? "ready_with_existing_videos" : "manifest_only";

  return {
    schemaVersion: finalVideoPlanSchemaVersion,
    kind: "final_video_composition_manifest",
    generatedAt: input.generatedAt,
    status,
    finalVideoDirectory: "final-video",
    renderedFinalVideo: false,
    compositionManifestOnly: true,
    sourcePreviewPlanId: input.preview.planId,
    sourcePreviewStatus: input.preview.status,
    timeline,
    copyItems,
    missingShotIds,
    blockedReasons,
    audio: buildFinalVideoAudioPlan(input.audioPlanning),
    notes: [
      "This manifest describes the final video package contract; it does not claim a stitched final render exists.",
      "Existing reviewed or review-candidate video files are copied into final-video only when the export adapter is confirmed.",
    ],
  };
}
