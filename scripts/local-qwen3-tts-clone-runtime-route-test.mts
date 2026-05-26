import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  buildLocalQwen3TtsClonePlan,
  createRuntimeApiLocalQwen3TtsCloneRoute,
} from "./runtime-routes/local-qwen3-tts-clone.mts";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function makeRes() {
  return {
    writes: [],
    writeHead(status, headers) {
      this.status = status;
      this.headers = headers;
    },
    end(body) {
      this.body = body;
      this.writes.push(JSON.parse(body));
    },
  };
}

async function hit(route, body, method = "POST") {
  const res = makeRes();
  const handled = await route.handleRuntimeApiLocalQwen3TtsCloneRoute(
    { method, body },
    res,
    new URL("http://127.0.0.1/api/runtime/audio/local-qwen3-tts-clone/generate"),
  );
  return { handled, res, payload: res.writes[0] };
}

const tempRoot = mkdtempSync(path.join(tmpdir(), "vibe-local-qwen3-tts-"));
const qwen3Root = path.join(tempRoot, "qwen3-runtime");
const modelDir = path.join(tempRoot, "Qwen3-TTS-12Hz-1.7B-Base");
const tokenizerDir = path.join(modelDir, "speech_tokenizer");
const referenceAudioPath = path.join(tempRoot, "reference.wav");
const lfsPointerPath = path.join(tempRoot, "lfs-pointer.wav");
mkdirSync(tokenizerDir, { recursive: true });
writeFileSync(path.join(modelDir, "config.json"), "{\"model_type\":\"qwen3_tts\"}\n", "utf8");
writeFileSync(path.join(modelDir, "model.safetensors"), Buffer.alloc(2048, 1));
writeFileSync(path.join(tokenizerDir, "model.safetensors"), Buffer.alloc(2048, 2));
writeFileSync(referenceAudioPath, Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4096, 1)]));
writeFileSync(lfsPointerPath, "version https://git-lfs.github.com/spec/v1\noid sha256:abc\nsize 123\n", "utf8");
delete process.env.VIBE_QWEN3_TTS_SPEAKER_WAV;

const route = createRuntimeApiLocalQwen3TtsCloneRoute({
  endpoint: "/api/runtime/audio/local-qwen3-tts-clone/generate",
  readRequestJsonBody: async (req) => ({ ok: true, body: req.body }),
  runtimePolicy: () => ({ providerCalled: false }),
  runtimeRoot: tempRoot,
  runtimeFileUrl: (relativePath) => `/api/runtime/files?path=${encodeURIComponent(relativePath)}`,
  writeJson: (res, status, payload) => {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(`${JSON.stringify(payload)}\n`);
  },
  running: () => false,
  setRunning: (value) => { route.runningValue = value; },
  runPlan: async (plan) => {
    assert(plan.command === "uv", "default command should be uv");
    assert(plan.args.includes("--ref-audio"), "runner args should include reference audio internally");
    assert(plan.args.includes("--ref-text"), "runner args should include reference transcript internally");
    writeFileSync(plan.outputPath, Buffer.from("mock qwen3 wav output"));
    return {
      ok: true,
      status: "created",
      stdout: "local-qwen3-tts-clone-runner: wrote output",
      stderr: "",
      outputSha256: sha256(readFileSync(plan.outputPath)),
      outputSizeBytes: readFileSync(plan.outputPath).length,
    };
  },
});

const goodBody = {
  text: "ねえ、見て。物語はここから始まるんだ。",
  language: "Japanese",
  shotId: "JP01",
  referenceAudioPath,
  referenceText: "これは声のクローン用の短い参考音声です。",
  qwen3TtsRoot: qwen3Root,
  modelDir,
  confirmationToken: "submit-local-qwen3-tts-clone",
  permissionReceiptId: "receipt_local_qwen3_tts_1",
  outputRelativePath: ".vibe-runtime/tts/local-qwen3-tts-clone/JP01.wav",
};
const plan = buildLocalQwen3TtsClonePlan(goodBody, { runtimeRoot: tempRoot });
assert(plan.outputRelativePath === ".vibe-runtime/tts/local-qwen3-tts-clone/JP01.wav", "plan should preserve safe project-relative output path");
assert(plan.referenceAudioHash === sha256(readFileSync(referenceAudioPath)), "plan should hash reference audio");
assert(plan.referenceTextHash?.startsWith("sha256:"), "plan should hash reference text");
assert(plan.textHash.startsWith("sha256:"), "plan should hash target text");

const good = await hit(route, goodBody);
assert(good.handled === true, "local Qwen3 TTS clone route should handle the endpoint");
assert(good.res.status === 200, "good local Qwen3 TTS clone request should succeed");
assert(good.payload.status === "created", "good local Qwen3 TTS clone payload status mismatch");
assert(good.payload.userMessage === "本镜头克隆配音已生成。", "success payload should include safe user copy");
assert(good.payload.outputRelativePath === ".vibe-runtime/tts/local-qwen3-tts-clone/JP01.wav", "output path mismatch");
assert(good.payload.receiptRelativePath?.endsWith(".json"), "success payload should expose a project-relative receipt path");
const qwenReceipt = readFileSync(path.join(tempRoot, good.payload.receiptRelativePath), "utf8");
assert(qwenReceipt.includes("\"kind\": \"local_qwen3_tts_clone_receipt\""), "Qwen3 TTS receipt should be written");
assert(qwenReceipt.includes("\"providerId\": \"local-qwen3-tts-clone\""), "Qwen3 TTS receipt should record provider id");
assert(qwenReceipt.includes("\"rawReferencePathRedacted\": true"), "Qwen3 TTS receipt should redact raw reference path");
assert(!qwenReceipt.includes(referenceAudioPath), "Qwen3 TTS receipt must not leak raw reference path");
assert(good.payload.rawReferencePathRedacted === true, "raw reference path must be redacted");
assert(good.payload.localRuntimeCalled === true, "local runtime should be marked called");
assert(good.payload.providerCalledExternal === false, "local Qwen3 TTS clone must not be external provider call");
assert(good.payload.runtimeExternalNetworkCallMade === false, "local Qwen3 TTS clone must not mark network usage");
assert(!JSON.stringify(good.payload).includes(referenceAudioPath), "response must not leak raw reference path");

const noReference = await hit(route, { ...goodBody, referenceAudioPath: "", refAudioPath: "", speakerWavPath: "" });
assert(noReference.res.status === 400, "missing reference audio should block before runtime");
assert(noReference.payload.message === "请先选择或配置一段已授权的声音参考，再生成克隆配音。", "missing reference audio should return safe user copy");
assert(noReference.payload.rawReferencePathRedacted === true, "missing reference audio payload should mark raw path redaction");

const noPermission = await hit(route, { ...goodBody, permissionReceiptId: "", confirmationToken: "" });
assert(noPermission.res.status === 400, "missing permission should block");
assert(noPermission.payload.localRuntimeCalled === false, "blocked permission must not call local runtime");
assert(!/permissionReceiptId|confirmationToken/.test(noPermission.payload.message), "permission blocker should not expose runtime field names");

const missingTranscript = await hit(route, { ...goodBody, referenceText: "" });
assert(missingTranscript.res.status === 400, "missing reference transcript should block by default");
assert(!/referenceText/.test(missingTranscript.payload.message), "reference transcript blocker should use user copy");

const lfsPointer = await hit(route, { ...goodBody, referenceAudioPath: lfsPointerPath });
assert(lfsPointer.res.status === 400, "Git LFS pointer reference should block");
assert(/完整音频/.test(lfsPointer.payload.message), "LFS blocker user message missing");
assert(!JSON.stringify(lfsPointer.payload).includes(lfsPointerPath), "LFS blocker must not leak raw path");

const traversal = await hit(route, { ...goodBody, outputRelativePath: "../escape.wav" });
assert(traversal.res.status === 400, "parent traversal output should block");

rmSync(tempRoot, { recursive: true, force: true });
console.log("local-qwen3-tts-clone-runtime-route-test: ok");
