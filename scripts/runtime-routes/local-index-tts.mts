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
  if (path.isAbsolute(raw)) throw new Error("TTS output path must be project-relative.");
  const parts = raw.split("/").filter(Boolean);
  if (!parts.length || parts.some((part) => part === "." || part === "..")) {
    throw new Error("TTS output path cannot contain parent traversal.");
  }
  const joined = parts.join("/");
  if (!joined.toLowerCase().endsWith(".wav")) throw new Error("Local IndexTTS output must be a .wav file.");
  return joined;
}

function readBody(parsedBody) {
  if (isRecord(parsedBody) && parsedBody.ok === true && "body" in parsedBody) return parsedBody.body;
  return parsedBody;
}

function defaultIndexTtsRoot() {
  return process.env.VIBE_INDEX_TTS_ROOT || path.join(homedir(), "index-tts");
}

function resolveIndexTtsConfig(body = {}) {
  const indexTtsRoot = path.resolve(asString(body.indexTtsRoot) || defaultIndexTtsRoot());
  const modelDir = path.resolve(asString(body.modelDir) || process.env.VIBE_INDEX_TTS_MODEL_DIR || path.join(indexTtsRoot, "checkpoints"));
  const cfgPath = path.resolve(asString(body.cfgPath) || path.join(modelDir, "config.yaml"));
  const uvCommand = process.env.VIBE_INDEX_TTS_COMMAND || "uv";
  return {
    indexTtsRoot,
    modelDir,
    cfgPath,
    uvCommand,
    runnerPath: path.join(repoRoot, "scripts/local-index-tts-runner.py"),
  };
}

function looksLikeGitLfsPointer(filePath) {
  const size = statSync(filePath).size;
  if (size > 512) return false;
  const head = readFileSync(filePath, "utf8");
  return head.startsWith("version https://git-lfs.github.com/spec/");
}

function validateSpeakerPath(filePath, rootPath) {
  if (!filePath) throw new Error("speakerWavPath is required.");
  const absolute = path.resolve(filePath);
  if (!existsSync(absolute)) throw new Error("Speaker audio was not found.");
  const resolved = realpathSync(absolute);
  const resolvedRoot = rootPath && existsSync(rootPath) ? realpathSync(rootPath) : rootPath;
  if (resolvedRoot && !isPathInside(resolved, resolvedRoot)) throw new Error("Speaker audio path is outside the allowed project root.");
  if (looksLikeGitLfsPointer(resolved)) throw new Error("Speaker audio is still a Git LFS pointer, not a real audio file.");
  if (statSync(resolved).size <= 1024) throw new Error("Speaker audio is too small to be a usable reference.");
  return resolved;
}

function createReceipt(input) {
  return {
    receiptKind: "local_index_tts_execution",
    schemaVersion: "0.1.0",
    generatedAt: new Date().toISOString(),
    providerId: "local-index-tts",
    providerSlot: "audio.tts",
    requiredMode: "tts",
    permissionReceiptId: input.permissionReceiptId,
    textHash: input.textHash,
    speakerAudioHash: input.speakerAudioHash,
    outputRelativePath: input.outputRelativePath,
    outputSha256: input.outputSha256,
    localRuntimeCalled: true,
    providerCalledExternal: false,
    runtimeExternalNetworkCallMade: false,
    rawSpeakerPathRedacted: true,
    command: {
      executable: input.commandExecutable,
      cwd: "local-index-tts-root",
      shell: false,
      rawArgsRedacted: true,
    },
    notes: [
      "Local IndexTTS execution ran in the runtime process, not the browser.",
      "Raw speaker audio path is intentionally excluded from this receipt.",
    ],
  };
}

export function buildLocalIndexTtsPlan(body, deps = {}) {
  const runtimeRoot = path.resolve(deps.runtimeRoot || process.cwd());
  const text = asString(body.text);
  if (!text) throw new Error("text is required.");
  if (text.length > 2000) throw new Error("text is too long for one local TTS job.");

  const permissionReceiptId = asString(body.permissionReceiptId);
  const confirmationToken = asString(body.confirmationToken || body.confirm);
  if (!permissionReceiptId || confirmationToken !== "submit-local-index-tts") {
    throw new Error("Local TTS requires permissionReceiptId and confirmationToken=submit-local-index-tts.");
  }

  const config = resolveIndexTtsConfig(body);
  if (!existsSync(config.indexTtsRoot)) throw new Error("IndexTTS root was not found.");
  if (!existsSync(config.runnerPath)) throw new Error("Local IndexTTS runner script was not found.");
  if (!existsSync(config.modelDir)) throw new Error("IndexTTS model directory was not found.");
  if (!existsSync(config.cfgPath)) throw new Error("IndexTTS config.yaml was not found.");

  const speakerPath = validateSpeakerPath(asString(body.speakerWavPath || body.speakerAudioPath || process.env.VIBE_INDEX_TTS_SPEAKER_WAV), runtimeRoot);
  const shotId = safeId(body.shotId || "tts");
  const outputRelativePath = normalizeOutputRelativePath(
    body.outputRelativePath,
    `.vibe-runtime/tts/local-index-tts/${shotId}_${stableHash(`${shotId}:${text}`).slice(0, 10)}.wav`,
  );
  const outputPath = path.resolve(runtimeRoot, outputRelativePath);
  if (!isPathInside(outputPath, runtimeRoot)) throw new Error("TTS output path must stay inside the runtime root.");
  mkdirSync(path.dirname(outputPath), { recursive: true });

  const args = [
    "run",
    "python",
    config.runnerPath,
    "--text",
    text,
    "--speaker-wav",
    speakerPath,
    "--output",
    outputPath,
    "--model-dir",
    config.modelDir,
    "--cfg-path",
    config.cfgPath,
  ];
  if (body.fp16 === true) args.push("--fp16");
  if (body.verbose === true) args.push("--verbose");

  return {
    providerId: "local-index-tts",
    route: "local_index_tts",
    command: config.uvCommand,
    args,
    cwd: config.indexTtsRoot,
    env: {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      PYTHONPATH: [config.indexTtsRoot, process.env.PYTHONPATH].filter(Boolean).join(path.delimiter),
    },
    timeoutMs: Math.max(30_000, Math.min(Number(body.timeoutMs || 600_000), 900_000)),
    text,
    textHash: `sha256:${stableHash(text)}`,
    speakerPath,
    speakerAudioHash: sha256File(speakerPath),
    outputPath,
    outputRelativePath,
    permissionReceiptId,
  };
}

export function runLocalIndexTtsPlan(plan, deps = {}) {
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
        message: `Local IndexTTS timed out after ${plan.timeoutMs}ms.`,
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
        resolve({ ok: false, status: "failed", stdout, stderr, exitCode: code, message: "Local IndexTTS command failed." });
        return;
      }
      if (!existsSync(plan.outputPath) || statSync(plan.outputPath).size <= 0) {
        resolve({ ok: false, status: "missing_output", stdout, stderr, exitCode: code, message: "Local IndexTTS did not create an output file." });
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

export function createRuntimeApiLocalIndexTtsRoute(deps) {
  const {
    endpoint,
    readRequestJsonBody,
    runtimePolicy,
    runtimeRoot = process.cwd(),
    runtimeFileUrl = (relativePath) => relativePath,
    writeJson,
    running = () => false,
    setRunning = () => {},
    runPlan = runLocalIndexTtsPlan,
  } = deps;

  async function handleRuntimeApiLocalIndexTtsRoute(req, res, url) {
    if (url.pathname !== endpoint) return false;
    if (req.method !== "POST") {
      writeJson(res, 405, {
        ok: false,
        ...runtimePolicy(),
        status: "method_not_allowed",
        localRuntimeCalled: false,
        providerCalledExternal: false,
      });
      return true;
    }
    if (running()) {
      writeJson(res, 409, {
        ok: false,
        ...runtimePolicy(),
        status: "busy",
        message: "Another local runtime job is already running.",
        localRuntimeCalled: false,
        providerCalledExternal: false,
      });
      return true;
    }

    try {
      const parsedBody = await readRequestJsonBody(req, { signal: AbortSignal.timeout(10_000) });
      if (isRecord(parsedBody) && parsedBody.ok === false) {
        writeJson(res, 400, {
          ok: false,
          ...runtimePolicy(),
          status: "bad_request",
          message: asString(parsedBody.message, "Request body must be valid JSON."),
          localRuntimeCalled: false,
          providerCalledExternal: false,
        });
        return true;
      }
      const body = readBody(parsedBody);
      if (!isRecord(body)) throw new Error("Request body must be a JSON object.");
      const plan = buildLocalIndexTtsPlan(body, { runtimeRoot });

      setRunning(true);
      try {
        const result = await runPlan(plan);
        if (!result.ok) {
          writeJson(res, 500, {
            ok: false,
            ...runtimePolicy(),
            status: result.status || "failed",
            message: result.message || "Local IndexTTS failed.",
            stdoutTail: asString(result.stdout).slice(-1200),
            stderrTail: asString(result.stderr).slice(-1200),
            localRuntimeCalled: true,
            providerCalledExternal: false,
            runtimeExternalNetworkCallMade: false,
          });
          return true;
        }

        const receiptRelativePath = `.vibe-runtime/tts/receipts/${safeId(body.shotId || "tts")}_${Date.now()}.json`;
        const receiptPath = path.join(runtimeRoot, receiptRelativePath);
        mkdirSync(path.dirname(receiptPath), { recursive: true });
        const receipt = createReceipt({
          permissionReceiptId: plan.permissionReceiptId,
          textHash: plan.textHash,
          speakerAudioHash: plan.speakerAudioHash,
          outputRelativePath: plan.outputRelativePath,
          outputSha256: result.outputSha256,
          commandExecutable: path.basename(plan.command),
        });
        writeFileSync(receiptPath, JSON.stringify(receipt, null, 2), "utf8");

        writeJson(res, 200, {
          ok: true,
          ...runtimePolicy(),
          status: "created",
          providerId: "local-index-tts",
          providerSlot: "audio.tts",
          requiredMode: "tts",
          localRuntimeCalled: true,
          providerCalledExternal: false,
          runtimeExternalNetworkCallMade: false,
          permissionReceiptId: plan.permissionReceiptId,
          outputRelativePath: plan.outputRelativePath,
          outputUrl: runtimeFileUrl(plan.outputRelativePath),
          outputSha256: result.outputSha256,
          outputSizeBytes: result.outputSizeBytes,
          speakerAudioSha256: plan.speakerAudioHash,
          rawSpeakerPathRedacted: true,
          receiptRelativePath,
          receiptUrl: runtimeFileUrl(receiptRelativePath),
          stdoutTail: asString(result.stdout).slice(-1200),
          stderrTail: asString(result.stderr).slice(-1200),
          userMessage: "本地配音已生成。",
        });
        return true;
      } finally {
        setRunning(false);
      }
    } catch (error) {
      setRunning(false);
      writeJson(res, 400, {
        ok: false,
        ...runtimePolicy(),
        status: "blocked",
        message: error instanceof Error ? error.message : "Local IndexTTS request was blocked.",
        localRuntimeCalled: false,
        providerCalledExternal: false,
        runtimeExternalNetworkCallMade: false,
      });
      return true;
    }
  }

  return {
    endpoint,
    handleRuntimeApiLocalIndexTtsRoute,
  };
}
