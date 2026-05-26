import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function safeId(value) {
  return asString(value, "tts").replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/^_+|_+$/g, "") || "tts";
}

function stableHash(value) {
  return createHash("sha256").update(value).digest("hex");
}

function sha256File(filePath) {
  return `sha256:${createHash("sha256").update(readFileSync(filePath)).digest("hex")}`;
}

function isPathInside(child, parent) {
  const relative = path.relative(parent, child);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function normalizeOutputRelativePath(value, fallback) {
  const raw = asString(value, fallback).replace(/\\/g, "/");
  if (path.isAbsolute(raw)) throw new Error("Qwen3 TTS output path must be project-relative.");
  const parts = raw.split("/").filter(Boolean);
  if (!parts.length || parts.some((part) => part === "." || part === "..")) {
    throw new Error("Qwen3 TTS output path cannot contain parent traversal.");
  }
  const joined = parts.join("/");
  if (!joined.toLowerCase().endsWith(".wav")) throw new Error("Local Qwen3 TTS output must be a .wav file.");
  return joined;
}

function normalizeReceiptRelativePath(value, fallback) {
  const raw = asString(value, fallback).replace(/\\/g, "/");
  if (path.isAbsolute(raw)) throw new Error("Qwen3 TTS receipt path must be project-relative.");
  const parts = raw.split("/").filter(Boolean);
  if (!parts.length || parts.some((part) => part === "." || part === "..")) {
    throw new Error("Qwen3 TTS receipt path cannot contain parent traversal.");
  }
  const joined = parts.join("/");
  if (!joined.toLowerCase().endsWith(".json")) throw new Error("Local Qwen3 TTS receipt must be a .json file.");
  return joined;
}

function readBody(parsedBody) {
  if (isRecord(parsedBody) && parsedBody.ok === true && "body" in parsedBody) return parsedBody.body;
  return parsedBody;
}

function defaultModelDir() {
  return path.join(homedir(), ".vibe-models/qwen3-tts/Qwen3-TTS-12Hz-1.7B-Base");
}

function defaultRuntimeRoot() {
  return path.join(homedir(), ".vibe-runtimes/qwen3-tts");
}

function resolveQwen3TtsConfig(body = {}) {
  const modelDir = path.resolve(asString(body.modelDir) || process.env.VIBE_QWEN3_TTS_MODEL_DIR || defaultModelDir());
  const runtimeRoot = path.resolve(asString(body.qwen3TtsRoot) || process.env.VIBE_QWEN3_TTS_ROOT || defaultRuntimeRoot());
  const uvCommand = process.env.VIBE_QWEN3_TTS_COMMAND || "uv";
  return {
    runtimeRoot,
    modelDir,
    uvCommand,
    runnerPath: path.join(repoRoot, "scripts/local-qwen3-tts-clone-runner.py"),
  };
}

function looksLikeGitLfsPointer(filePath) {
  const size = statSync(filePath).size;
  if (size > 512) return false;
  const head = readFileSync(filePath, "utf8");
  return head.startsWith("version https://git-lfs.github.com/spec/");
}

function validateReferenceAudioPath(filePath, rootPath) {
  if (!filePath) throw new Error("referenceAudioPath is required.");
  const absolute = path.resolve(filePath);
  if (!existsSync(absolute)) throw new Error("Reference audio was not found.");
  const resolved = realpathSync(absolute);
  const resolvedRoot = rootPath && existsSync(rootPath) ? realpathSync(rootPath) : rootPath;
  if (resolvedRoot && !isPathInside(resolved, resolvedRoot)) throw new Error("Reference audio path is outside the allowed project root.");
  if (looksLikeGitLfsPointer(resolved)) throw new Error("Reference audio is still a Git LFS pointer, not a real audio file.");
  if (statSync(resolved).size <= 1024) throw new Error("Reference audio is too small to be a usable voice clone source.");
  return resolved;
}

function validateModelDir(modelDir) {
  if (!existsSync(modelDir)) throw new Error("Qwen3-TTS Base model directory was not found.");
  for (const relative of ["config.json", "model.safetensors", "speech_tokenizer/model.safetensors"]) {
    if (!existsSync(path.join(modelDir, relative))) throw new Error(`Qwen3-TTS model file is missing: ${relative}`);
  }
}

function safeUserMessageForPlanError(error) {
  const message = error instanceof Error ? error.message : String(error || "");
  if (/referenceAudioPath is required/i.test(message)) {
    return "请先选择或配置一段已授权的声音参考，再生成克隆配音。";
  }
  if (/Reference audio was not found/i.test(message)) {
    return "声音参考不可用，请重新选择或在本机设置里更新。";
  }
  if (/Git LFS pointer/i.test(message)) {
    return "声音参考还不是可用的音频文件，请先下载完整音频后重试。";
  }
  if (/Reference audio is too small/i.test(message)) {
    return "声音参考太短或文件不可用，请换一段清晰的授权音频。";
  }
  if (/referenceText is required/i.test(message)) {
    return "当前模式需要补充声音参考文本，或改用仅音色模式。";
  }
  if (/permissionReceiptId|confirmationToken/i.test(message)) {
    return "请先确认声音克隆授权，再生成克隆配音。";
  }
  if (/model directory|model file|runner script/i.test(message)) {
    return "本机 Qwen3 声音模型还没有配置好，请先完成本机模型设置。";
  }
  if (/output path|parent traversal|runtime root/i.test(message)) {
    return "克隆配音的输出位置不安全，本次已阻断。";
  }
  if (/text is required/i.test(message)) {
    return "这个镜头还没有可生成的旁白或对话。";
  }
  return "声音克隆请求被阻断，请检查本机声音设置后重试。";
}

export function buildLocalQwen3TtsClonePlan(body, deps = {}) {
  const runtimeRoot = path.resolve(deps.runtimeRoot || process.cwd());
  const text = asString(body.text);
  if (!text) throw new Error("text is required.");
  if (text.length > 2000) throw new Error("text is too long for one local Qwen3 TTS job.");

  const permissionReceiptId = asString(body.permissionReceiptId);
  const confirmationToken = asString(body.confirmationToken || body.confirm);
  if (!permissionReceiptId || confirmationToken !== "submit-local-qwen3-tts-clone") {
    throw new Error("Local Qwen3 TTS clone requires permissionReceiptId and confirmationToken=submit-local-qwen3-tts-clone.");
  }

  const config = resolveQwen3TtsConfig(body);
  mkdirSync(config.runtimeRoot, { recursive: true });
  if (!existsSync(config.runnerPath)) throw new Error("Local Qwen3 TTS clone runner script was not found.");
  validateModelDir(config.modelDir);

  const referenceAudioPath = validateReferenceAudioPath(asString(body.referenceAudioPath || body.refAudioPath || body.speakerWavPath || process.env.VIBE_QWEN3_TTS_SPEAKER_WAV), runtimeRoot);
  const referenceText = asString(body.referenceText || body.refText);
  const xVectorOnlyMode = body.xVectorOnlyMode === true;
  if (!referenceText && !xVectorOnlyMode) {
    throw new Error("referenceText is required unless xVectorOnlyMode=true.");
  }

  const shotId = safeId(body.shotId || "qwen3_tts");
  const outputRelativePath = normalizeOutputRelativePath(
    body.outputRelativePath,
    `.vibe-runtime/tts/local-qwen3-tts-clone/${shotId}_${stableHash(`${shotId}:${text}`).slice(0, 10)}.wav`,
  );
  const outputPath = path.resolve(runtimeRoot, outputRelativePath);
  if (!isPathInside(outputPath, runtimeRoot)) throw new Error("Qwen3 TTS output path must stay inside the runtime root.");
  mkdirSync(path.dirname(outputPath), { recursive: true });
  const receiptRelativePath = normalizeReceiptRelativePath(
    body.receiptRelativePath,
    `.vibe-runtime/receipts/audio/local-qwen3-tts-clone/${shotId}_${stableHash(`${permissionReceiptId}:${shotId}:${text}`).slice(0, 10)}.json`,
  );
  const receiptPath = path.resolve(runtimeRoot, receiptRelativePath);
  if (!isPathInside(receiptPath, runtimeRoot)) throw new Error("Qwen3 TTS receipt path must stay inside the runtime root.");
  mkdirSync(path.dirname(receiptPath), { recursive: true });

  const args = [
    "run",
    "--python",
    "3.12",
    "--with",
    "qwen-tts",
    "--with",
    "soundfile",
    "python",
    config.runnerPath,
    "--text",
    text,
    "--language",
    asString(body.language, "Auto"),
    "--ref-audio",
    referenceAudioPath,
    "--output",
    outputPath,
    "--model-dir",
    config.modelDir,
  ];
  if (referenceText) args.push("--ref-text", referenceText);
  if (xVectorOnlyMode) args.push("--x-vector-only-mode");
  if (body.deviceMap) args.push("--device-map", asString(body.deviceMap));
  if (body.dtype) args.push("--dtype", asString(body.dtype));
  if (body.attnImplementation) args.push("--attn-implementation", asString(body.attnImplementation));

  return {
    providerId: "local-qwen3-tts-clone",
    route: "local_qwen3_tts_clone",
    shotId,
    command: config.uvCommand,
    args,
    cwd: config.runtimeRoot,
    env: {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
    },
    timeoutMs: Math.max(60_000, Math.min(Number(body.timeoutMs || 900_000), 1_800_000)),
    text,
    language: asString(body.language, "Auto"),
    textHash: `sha256:${stableHash(text)}`,
    referenceTextHash: referenceText ? `sha256:${stableHash(referenceText)}` : null,
    referenceAudioPath,
    referenceAudioHash: sha256File(referenceAudioPath),
    outputPath,
    outputRelativePath,
    receiptPath,
    receiptRelativePath,
    permissionReceiptId,
  };
}

function writeQwen3TtsReceipt(plan, result) {
  const receipt = {
    kind: "local_qwen3_tts_clone_receipt",
    schemaVersion: "0.1.0",
    createdAt: new Date().toISOString(),
    providerId: plan.providerId,
    route: plan.route,
    status: result.status,
    shotId: plan.shotId,
    language: plan.language,
    textHash: plan.textHash,
    referenceTextHash: plan.referenceTextHash,
    referenceAudioSha256: plan.referenceAudioHash,
    outputRelativePath: plan.outputRelativePath,
    outputSha256: result.outputSha256,
    outputSizeBytes: result.outputSizeBytes,
    permissionReceiptId: plan.permissionReceiptId,
    rawReferencePathRedacted: true,
    localRuntimeCalled: true,
    providerCalledExternal: false,
    runtimeExternalNetworkCallMade: false,
  };
  writeFileSync(plan.receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  return receipt;
}

export function runLocalQwen3TtsClonePlan(plan, deps = {}) {
  const spawnImpl = deps.spawn || spawn;
  return new Promise((resolve) => {
    const child = spawnImpl(plan.command, plan.args, {
      cwd: plan.cwd,
      env: plan.env,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try { child.kill?.("SIGTERM"); } catch {}
      resolve({
        ok: false,
        status: "timeout",
        stdout,
        stderr,
        message: `Local Qwen3 TTS clone timed out after ${plan.timeoutMs}ms.`,
      });
    }, plan.timeoutMs);

    child.stdout?.on?.("data", (chunk) => { stdout += String(chunk).slice(0, 16_000); });
    child.stderr?.on?.("data", (chunk) => { stderr += String(chunk).slice(0, 16_000); });
    child.on?.("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ ok: false, status: "spawn_error", stdout, stderr, message: error.message });
    });
    child.on?.("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code !== 0) {
        resolve({ ok: false, status: "failed", stdout, stderr, exitCode: code, message: "Local Qwen3 TTS clone command failed." });
        return;
      }
      if (!existsSync(plan.outputPath) || statSync(plan.outputPath).size <= 0) {
        resolve({ ok: false, status: "missing_output", stdout, stderr, exitCode: code, message: "Local Qwen3 TTS clone did not create an output file." });
        return;
      }
      resolve({
        ok: true,
        status: "created",
        stdout,
        stderr,
        exitCode: code,
        outputSha256: sha256File(plan.outputPath),
        outputSizeBytes: statSync(plan.outputPath).size,
      });
    });
  });
}

export function createRuntimeApiLocalQwen3TtsCloneRoute(deps) {
  const {
    endpoint,
    readRequestJsonBody,
    runtimePolicy,
    runtimeRoot = process.cwd(),
    runtimeFileUrl = (relativePath) => relativePath,
    writeJson,
    running = () => false,
    setRunning = () => {},
    runPlan = runLocalQwen3TtsClonePlan,
  } = deps;

  async function handleRuntimeApiLocalQwen3TtsCloneRoute(req, res, url) {
    if (url.pathname !== endpoint) return false;
    if (req.method !== "POST") {
      writeJson(res, 405, {
        ok: false,
        ...runtimePolicy(),
        providerId: "local-qwen3-tts-clone",
        status: "method_not_allowed",
        message: "Use POST for local Qwen3 TTS clone generation.",
      });
      return true;
    }
    if (running()) {
      writeJson(res, 409, {
        ok: false,
        ...runtimePolicy(),
        providerId: "local-qwen3-tts-clone",
        status: "busy",
        message: "Runtime is already running another provider job.",
      });
      return true;
    }

    let plan;
    try {
      const parsed = await readRequestJsonBody(req, { signal: AbortSignal.timeout(10_000) });
      const body = readBody(parsed);
      plan = buildLocalQwen3TtsClonePlan(body, { runtimeRoot });
    } catch (error) {
      const userMessage = safeUserMessageForPlanError(error);
      writeJson(res, 400, {
        ok: false,
        ...runtimePolicy(),
        providerId: "local-qwen3-tts-clone",
        status: "blocked",
        message: userMessage,
        userMessage,
        rawReferencePathRedacted: true,
        localRuntimeCalled: false,
        providerCalledExternal: false,
        runtimeExternalNetworkCallMade: false,
      });
      return true;
    }

    setRunning(true);
    try {
      const result = await runPlan(plan);
      if (!result.ok) {
        writeJson(res, 500, {
          ok: false,
          ...runtimePolicy(),
          providerId: "local-qwen3-tts-clone",
          status: result.status,
          message: result.message,
          stdoutTail: String(result.stdout || "").slice(-1200),
          stderrTail: String(result.stderr || "").slice(-1200),
          localRuntimeCalled: true,
          providerCalledExternal: false,
          runtimeExternalNetworkCallMade: false,
        });
        return true;
      }
      const receipt = writeQwen3TtsReceipt(plan, result);
      writeJson(res, 200, {
        ok: true,
        ...runtimePolicy(),
        providerId: "local-qwen3-tts-clone",
        status: "created",
        outputRelativePath: plan.outputRelativePath,
        outputUrl: runtimeFileUrl(plan.outputRelativePath),
        receiptRelativePath: plan.receiptRelativePath,
        receiptUrl: runtimeFileUrl(plan.receiptRelativePath),
        outputSha256: result.outputSha256,
        outputSizeBytes: result.outputSizeBytes,
        userMessage: "本镜头克隆配音已生成。",
        language: plan.language,
        textHash: plan.textHash,
        referenceTextHash: plan.referenceTextHash,
        referenceAudioSha256: plan.referenceAudioHash,
        rawReferencePathRedacted: true,
        permissionReceiptId: plan.permissionReceiptId,
        receiptKind: receipt.kind,
        localRuntimeCalled: true,
        providerCalledExternal: false,
        runtimeExternalNetworkCallMade: false,
      });
      return true;
    } finally {
      setRunning(false);
    }
  }

  return {
    handleRuntimeApiLocalQwen3TtsCloneRoute,
  };
}
