import {
  applyDialogueAudioMaterialToRuntimeState,
  buildDialogueAudioMaterialProjectVibeTransaction,
} from "../src/core/dialogueAudioMaterial.ts";
import {
  buildProjectVibeStoryboardPlannerInput,
} from "../src/core/directorFeedbackProjectVibe.ts";
import {
  buildStoryboardReferenceProjectPlan,
} from "../src/core/storyboardReferenceProjectPlanner.ts";
import {
  applyProjectVibeTransaction,
  buildProjectRuntimeStateFromProjectVibe,
  createProjectVibe,
  type ProjectVibeDocument,
} from "../src/project/index.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`FAIL: ${message}`);
}

function fixtureProject(): ProjectVibeDocument {
  return createProjectVibe({
    projectId: "dialogue_audio_material",
    title: "Dialogue Audio Material",
    createdAt: "2026-05-23T08:00:00.000Z",
    updatedAt: "2026-05-23T08:00:00.000Z",
    storyFlow: {
      id: "story_flow",
      sections: [
        { id: "opening", title: "Opening", summary: "One dialogue shot.", sequenceIndex: 0, shotIds: ["S001"] },
      ],
      shotOrder: ["S001"],
    },
    shots: [
      {
        id: "S001",
        sectionId: "opening",
        title: "Rooftop whisper",
        intent: "A girl turns toward the city lights and whispers a short line.",
        camera: "medium close-up, slow push-in",
        subtitle: "今晚星星很亮。",
        dialogueLines: ["今晚星星很亮。"],
        sound: "quiet night wind",
        sceneAssetIds: [],
        characterAssetIds: [],
        propAssetIds: [],
        durationSeconds: 5,
        status: "ready",
        sourceRefs: ["fixture:shot:S001"],
      },
    ],
  });
}

const generatedAt = "2026-05-23T08:01:00.000Z";
const project = fixtureProject();
const runtimeState = buildProjectRuntimeStateFromProjectVibe({
  project,
  projectRoot: "/tmp/dialogue-audio-material",
  projectPath: "project.vibe",
  generatedAt,
});

const beforePlan = runtimeState.audioPlanning.shotPlans.find((plan) => plan.shotId === "S001");
assert(beforePlan, "fixture should create an audio plan for S001");
assert(beforePlan.outputPath == null, "fixture audio plan should start without generated output");

const runtimeResult = applyDialogueAudioMaterialToRuntimeState({
  runtimeState,
  shotId: "S001",
  outputRelativePath: ".vibe-runtime/tts/local-qwen3-tts-clone/S001_dialogue.wav",
  receiptRelativePath: ".vibe-runtime/receipts/audio/local-qwen3-tts-clone/S001_dialogue.json",
  outputSha256: "a".repeat(64),
  outputSizeBytes: 12345,
  providerId: "local-qwen3-tts-clone",
  generatedAt,
});

assert(runtimeResult.updated, "runtime update should be applied");
assert(runtimeResult.audioPlan?.outputPath === ".vibe-runtime/tts/local-qwen3-tts-clone/S001_dialogue.wav", "audio plan should carry generated wav path");
assert(runtimeResult.audioPlan?.audioQaStatus === "PASS", "generated dialogue audio should become a pass QA audio material");
assert(runtimeResult.runtimeState.voiceAudioSettings.audioSettingSummary.linkedTtsJobCount === 1, "voice/audio settings should count linked TTS output");
assert(
  runtimeResult.runtimeState.audioPlanning.previewMix.events.some((event) =>
    event.shotId === "S001"
    && event.type === "dialogue_audio"
    && event.mediaPath === ".vibe-runtime/tts/local-qwen3-tts-clone/S001_dialogue.wav"
  ),
  "audio preview mix should expose generated dialogue audio media path",
);

const transactionPlan = buildDialogueAudioMaterialProjectVibeTransaction({
  project,
  shotId: "S001",
  outputRelativePath: ".vibe-runtime/tts/local-qwen3-tts-clone/S001_dialogue.wav",
  receiptRelativePath: ".vibe-runtime/receipts/audio/local-qwen3-tts-clone/S001_dialogue.json",
  outputSha256: "a".repeat(64),
  outputSizeBytes: 12345,
  providerId: "local-qwen3-tts-clone",
  transcript: "今晚星星很亮。",
  generatedAt,
});

assert(transactionPlan.status === "ready", `transaction should be ready: ${transactionPlan.blockedReasons.join(",")}`);
assert(transactionPlan.asset?.roleBinding?.role === "dialogue_audio", "Project.vibe asset should be tagged as dialogue_audio");
assert(transactionPlan.asset?.usedByShotIds.includes("S001"), "dialogue audio asset should be bound to the shot");
assert(transactionPlan.transaction, "ready transaction should include operations");

const patch = applyProjectVibeTransaction(project, transactionPlan.transaction);
assert(patch.receipt.status === "applied", `Project.vibe patch should apply: ${patch.receipt.errors.join(",")}`);
assert(
  patch.project.assets.some((asset) =>
    asset.roleBinding?.role === "dialogue_audio"
    && asset.path === ".vibe-runtime/tts/local-qwen3-tts-clone/S001_dialogue.wav"
  ),
  "Project.vibe should persist generated dialogue audio as a material asset",
);

const plannerInput = buildProjectVibeStoryboardPlannerInput(patch.project, {
  storyboardOutputRoot: "storyboards",
  videoOutputRoot: "video",
  outputSize: "16:9",
});
assert(plannerInput.audioReferences?.length === 1, "storyboard planner input should expose one dialogue audio reference");
assert(plannerInput.audioReferences?.[0]?.shotIds?.includes("S001"), "dialogue audio reference should stay shot-scoped");

const projectPlan = buildStoryboardReferenceProjectPlan(plannerInput);
const shotPlan = projectPlan.shotPlans.find((plan) => plan.shotId === "S001");
assert(shotPlan?.selectedReferences.dialogueAudio?.path === ".vibe-runtime/tts/local-qwen3-tts-clone/S001_dialogue.wav", "Seedance project plan should select generated dialogue audio");
assert(shotPlan?.seedanceVideoPlan?.inputs.audio.length === 1, "Seedance video plan should attach one dialogue audio input");

console.log(`dialogue-audio-material-test: linked ${runtimeResult.audioPlan?.shotId} -> ${runtimeResult.audioPlan?.outputPath}, seedanceAudio=${shotPlan?.seedanceVideoPlan?.inputs.audio.length}.`);
