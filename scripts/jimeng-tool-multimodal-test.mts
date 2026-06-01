import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { createJimengTool } from "../src/agent/jimengTool.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const tempRoot = mkdtempSync(path.join(tmpdir(), "jimeng-tool-multimodal-test-"));
try {
  const argsPath = path.join(tempRoot, "args.json");
  const fakeCliPath = path.join(tempRoot, "fake-dreamina.mjs");
  writeFileSync(fakeCliPath, [
    "#!/usr/bin/env node",
    "import { writeFileSync } from 'node:fs';",
    `writeFileSync(${JSON.stringify(argsPath)}, JSON.stringify(process.argv.slice(2), null, 2));`,
    "console.log(JSON.stringify({ submit_id: 'multi123', gen_status: 'queueing', queue_info: { queue_idx: 7, queue_status: 'Queueing', queue_length: 8 } }));",
  ].join("\n"));
  chmodSync(fakeCliPath, 0o755);

  const tool = createJimengTool({ cliPath: fakeCliPath, cwd: tempRoot, timeoutMs: 10_000 });
  const result = await tool.execute({
    mode: "multimodal",
    prompt: "雨后学校天台，少女握着蓝色磁带盒说出台词，轻微推进。",
    storyboardReferencePath: "/project/storyboard/AN01.png",
    sceneBaselinePath: "/project/assets/scenes/rooftop-rain.png",
    characterReferencePaths: ["/project/assets/characters/hina.png"],
    propReferencePaths: ["/project/assets/props/cassette.png"],
    audioPath: "/project/audio/dialogue/AN01.wav",
    dialogueTranscript: "「第一、あんた今日なんで。」",
    duration: 5,
    ratio: "16:9",
    width: 1280,
    height: 720,
    fps: 24,
    modelVersion: "seedance2.0",
    videoResolution: "720p",
    shortPollSeconds: 20,
    queueWaitSeconds: 3600,
    outputPath: `${tempRoot}/outputs/AN01.mp4`,
  }, {
    taskEnvelope: { id: "task_AN01", shotId: "AN01" },
    sandboxRoot: tempRoot,
    sessionId: "session_multimodal",
  });

  const args = JSON.parse(readFileSync(argsPath, "utf8")) as string[];
  assert(result.submitId === "multi123", "submit id should be parsed from fake CLI");
  assert(result.status === "queued", "queued status should be normalized from fake CLI");
  assert(result.resumeCommand?.includes("query_result --submit_id=multi123"), "resume command missing submit id");
  assert(args[0] === "multimodal2video", "multimodal tool must call Dreamina multimodal2video");
  assert(args.includes("--image") && args.includes("/project/storyboard/AN01.png"), "storyboard image missing");
  assert(args.includes("/project/assets/scenes/rooftop-rain.png"), "scene baseline image missing");
  assert(args.includes("/project/assets/characters/hina.png"), "character reference image missing");
  assert(args.includes("/project/assets/props/cassette.png"), "prop reference image missing");
  assert(args.includes("--audio") && args.includes("/project/audio/dialogue/AN01.wav"), "dialogue audio missing");
  assert(args.includes("--ratio") && args.includes("16:9"), "ratio arg missing");
  assert(args.includes("--model_version") && args.includes("seedance2.0"), "model version arg missing");
  assert(args.includes("--video_resolution") && args.includes("720p"), "video resolution arg missing");
  const prompt = args[args.indexOf("--prompt") + 1] || "";
  assert(prompt.includes("Image 1 is the black-and-white storyboard reference"), "prompt must explain storyboard role");
  assert(prompt.includes("Image 2 is the scene baseline"), "prompt must explain scene baseline role");
  assert(prompt.includes("dialogue timing and performance"), "prompt must explain audio role");
  assert(!args.includes("--negative-prompt"), "unsupported negative prompt flag should not be added for multimodal");
  assert(!args.includes("--seed"), "unsupported seed flag should not be added for multimodal");

  console.log("jimeng-tool-multimodal-test: ok");
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}
