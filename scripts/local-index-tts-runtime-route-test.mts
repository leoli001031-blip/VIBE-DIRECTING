import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  buildLocalIndexTtsPlan,
  createRuntimeApiLocalIndexTtsRoute,
} from "./runtime-routes/local-index-tts.mts";

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
  const handled = await route.handleRuntimeApiLocalIndexTtsRoute(
    { method, body },
    res,
    new URL("http://127.0.0.1/api/runtime/audio/local-index-tts/generate"),
  );
  return { handled, res, payload: res.writes[0] };
}

const tempRoot = mkdtempSync(path.join(tmpdir(), "vibe-local-index-tts-"));
const indexRoot = path.join(tempRoot, "index-tts");
const modelDir = path.join(indexRoot, "checkpoints");
const speakerPath = path.join(tempRoot, "speaker.wav");
const lfsPointerPath = path.join(tempRoot, "lfs-pointer.wav");
mkdirSync(modelDir, { recursive: true });
writeFileSync(path.join(modelDir, "config.yaml"), "model: test\n", "utf8");
writeFileSync(speakerPath, Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4096, 1)]));
writeFileSync(lfsPointerPath, "version https://git-lfs.github.com/spec/v1\noid sha256:abc\nsize 123\n", "utf8");

const route = createRuntimeApiLocalIndexTtsRoute({
  endpoint: "/api/runtime/audio/local-index-tts/generate",
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
    assert(plan.args.includes("--speaker-wav"), "runner args should include speaker wav internally");
    writeFileSync(plan.outputPath, Buffer.from("mock wav output"));
    return {
      ok: true,
      status: "created",
      stdout: "local-index-tts-runner: wrote output",
      stderr: "",
      outputSha256: sha256(readFileSync(plan.outputPath)),
      outputSizeBytes: readFileSync(plan.outputPath).length,
    };
  },
});

const goodBody = {
  text: "测试本地配音接入。",
  shotId: "S01",
  speakerWavPath: speakerPath,
  indexTtsRoot: indexRoot,
  modelDir,
  confirmationToken: "submit-local-index-tts",
  permissionReceiptId: "receipt_local_tts_1",
  outputRelativePath: ".vibe-runtime/tts/local-index-tts/S01.wav",
};
const plan = buildLocalIndexTtsPlan(goodBody, { runtimeRoot: tempRoot });
assert(plan.outputRelativePath === ".vibe-runtime/tts/local-index-tts/S01.wav", "plan should preserve safe project-relative output path");
assert(plan.speakerAudioHash === sha256(readFileSync(speakerPath)), "plan should hash speaker audio");
assert(plan.textHash.startsWith("sha256:"), "plan should hash text");

const good = await hit(route, goodBody);
assert(good.handled === true, "local IndexTTS route should handle the endpoint");
assert(good.res.status === 200, "good local IndexTTS request should succeed");
assert(good.payload.status === "created", "good local IndexTTS payload status mismatch");
assert(good.payload.outputRelativePath === ".vibe-runtime/tts/local-index-tts/S01.wav", "output path mismatch");
assert(good.payload.rawSpeakerPathRedacted === true, "raw speaker path must be redacted");
assert(good.payload.localRuntimeCalled === true, "local runtime should be marked called");
assert(good.payload.providerCalledExternal === false, "local IndexTTS must not be external provider call");
assert(good.payload.runtimeExternalNetworkCallMade === false, "local IndexTTS must not mark network usage");
assert(!JSON.stringify(good.payload).includes(speakerPath), "response must not leak raw speaker path");

const noPermission = await hit(route, { ...goodBody, permissionReceiptId: "", confirmationToken: "" });
assert(noPermission.res.status === 400, "missing permission should block");
assert(noPermission.payload.localRuntimeCalled === false, "blocked permission must not call local runtime");

const lfsPointer = await hit(route, { ...goodBody, speakerWavPath: lfsPointerPath });
assert(lfsPointer.res.status === 400, "Git LFS pointer speaker should block");
assert(/Git LFS pointer/i.test(lfsPointer.payload.message), "LFS blocker message missing");
assert(!JSON.stringify(lfsPointer.payload).includes(lfsPointerPath), "LFS blocker must not leak raw path");

const traversal = await hit(route, { ...goodBody, outputRelativePath: "../escape.wav" });
assert(traversal.res.status === 400, "parent traversal output should block");

rmSync(tempRoot, { recursive: true, force: true });
console.log("local-index-tts-runtime-route-test: ok");
