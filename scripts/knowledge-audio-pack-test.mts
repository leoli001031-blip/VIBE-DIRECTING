import fs from "node:fs";
import { routeKnowledge } from "../src/core/knowledgeRouter.ts";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const audioPackId = "audio/core-audio-planning";
const manifest = JSON.parse(fs.readFileSync("resources/knowledge_pack_manifest.json", "utf8"));
const audioMarkdown = fs.readFileSync("resources/knowledge/audio/core-audio-planning.md", "utf8");
const audioPack = manifest.packs.find((pack) => pack.id === audioPackId);

assert(audioPack, "audio/core-audio-planning pack must be present in manifest");
assert(audioPack.enabled === true, "audio pack must be enabled");
assert(audioPack.category === "audio", "audio pack category must be audio");
assert(audioPack.applicableTaskPurposes.includes("audio"), "audio pack must apply to taskPurpose=audio");
assert(audioPack.applicableTaskPurposes.includes("video"), "audio pack must apply to taskPurpose=video");
assert(audioPack.applicableProviderSlots.includes("audio.tts"), "audio pack must apply to providerSlot=audio.tts");
assert(audioPack.applicableProviderSlots.includes("audio.music"), "audio pack must apply to providerSlot=audio.music");
assert(audioPack.applicableProviderSlots.includes("video.i2v"), "audio pack must apply to video.i2v no-BGM planning");

for (const phrase of [
  "Narration / 旁白",
  "Dialogue / 对白",
  "Voice Source License / 音源授权与预留",
  "Ambience / 环境音",
  "BGM Brief / 配乐说明",
  "Video Prompt No BGM Default",
  "TTS / BGM Provider Slots",
]) {
  assert(audioMarkdown.includes(phrase), `audio pack missing required section: ${phrase}`);
}

for (const phrase of ["不调用真实 TTS", "不得调用真实音乐生成 API", "视频生成 prompt 默认 no BGM", "audio.tts", "audio.music"]) {
  assert(audioMarkdown.includes(phrase), `audio pack missing provider/no-live guard: ${phrase}`);
}

const routeCases = [
  {
    id: "audio-tts-narration-dialogue",
    userIntent: "给这一镜加旁白和两句对白，先只预留 TTS 音色，不要调用真实 provider",
    taskPurpose: "audio",
    providerSlot: "audio.tts",
    expected: [audioPackId, "provider/model-capability-matrix", "qa/core-qa"],
  },
  {
    id: "audio-music-brief",
    userIntent: "做一个 BGM brief，说明配乐情绪和授权要求，provider slot 只是 audio.music 预留",
    taskPurpose: "audio",
    providerSlot: "audio.music",
    expected: [audioPackId, "provider/model-capability-matrix", "qa/core-qa"],
  },
  {
    id: "video-no-bgm",
    userIntent: "这个视频 prompt 默认 no BGM，不要音乐，只保留画面运动和环境音规划",
    taskPurpose: "video",
    providerSlot: "video.i2v",
    expected: [audioPackId, "camera/core-camera-movement", "prompt/core-prompt-templates", "qa/core-qa"],
  },
  {
    id: "audio-ambience-sfx",
    userIntent: "给镜头加环境音、房间底噪和轻微音效，不要对白",
    taskPurpose: "audio",
    providerSlot: "audio.tts",
    expected: [audioPackId],
  },
];

for (const testCase of routeCases) {
  const result = routeKnowledge({
    taskId: testCase.id,
    userIntent: testCase.userIntent,
    taskPurpose: testCase.taskPurpose,
    providerSlot: testCase.providerSlot,
    contextLevel: "L1",
    availablePacks: manifest.packs,
    consumers: ["prompt_compiler", "subagent_context", "qa_gate", "diagnostics"],
    maxInjectionTokens: 1200,
  });
  const matchedPackIds = new Set(result.matches.map((match) => match.packId));
  const injectedPackIds = new Set((result.injectedKnowledgePacks || []).map((pack) => pack.packId));

  for (const packId of testCase.expected) {
    assert(matchedPackIds.has(packId), `${testCase.id} expected ${packId} to route`);
  }
  assert(injectedPackIds.has(audioPackId), `${testCase.id} must inject audio pack`);
  assert((result.injectedKnowledgeSnippetIds || []).some((id) => id.startsWith(`${audioPackId}:`)), `${testCase.id} must inject audio snippet trace`);
  assert((result.injectedKnowledgePacks || []).length < manifest.packs.filter((pack) => pack.enabled).length, `${testCase.id} injected the whole library`);
}

console.log(`Knowledge audio pack tests passed: ${routeCases.length} audio routes, pack ${audioPack.hash}.`);
