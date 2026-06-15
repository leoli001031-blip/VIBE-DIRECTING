import fs from "node:fs";

function readText(path: string) {
  return fs.readFileSync(path, "utf8");
}

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

function stripComments(source: string) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function findFunctionBody(source: string, functionName: string) {
  const signature = `function ${functionName}`;
  const start = source.indexOf(signature);
  assert(start >= 0, `${functionName} is missing`);
  const paramsOpen = source.indexOf("(", start);
  assert(paramsOpen >= 0, `${functionName} parameter list is missing`);
  let paramDepth = 0;
  let paramsClose = -1;
  for (let index = paramsOpen; index < source.length; index += 1) {
    const char = source[index];
    if (char === "(") paramDepth += 1;
    if (char === ")") paramDepth -= 1;
    if (paramDepth === 0) {
      paramsClose = index;
      break;
    }
  }
  assert(paramsClose >= 0, `${functionName} parameter list was not closed`);
  const open = source.indexOf("{", paramsClose);
  assert(open >= 0, `${functionName} body is missing`);
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth === 0) return source.slice(open + 1, index);
  }
  throw new Error(`${functionName} body was not closed`);
}

function extractStringLiterals(source: string) {
  return Array.from(source.matchAll(/(["'`])((?:\\.|(?!\1)[\s\S])*?)\1/g))
    .map((match) => match[2])
    .join("\n");
}

const componentPath = "src/ui/director/MinimalAudioPlan.tsx";
const hookPath = "src/ui/director/useLocalQwen3TtsCloneAction.ts";
const componentSource = stripComments(readText(componentPath));
const hookSource = stripComments(readText(hookPath));
const componentCopy = extractStringLiterals(componentSource);
const hookCopy = extractStringLiterals([
  findFunctionBody(hookSource, "defaultConfirmAction"),
  findFunctionBody(hookSource, "completedMessage"),
  findFunctionBody(hookSource, "useLocalQwen3TtsCloneAction"),
].join("\n"));

assert(!componentSource.includes("useLocalQwen3TtsCloneAction"), "Demo Audio Plan UI should not expose the local voice-clone action");
assert(!componentSource.includes("checked={voiceCloneAction.authorized}"), "Demo Audio Plan UI should not show a voice-clone authorization checkbox");
assert(!componentSource.includes("disabled={voiceCloneAction.disabled}"), "Demo Audio Plan UI should not show a local voice-clone button");
assert(!componentSource.includes("runLocalQwen3TtsClone"), "Demo Audio Plan UI should not run local Qwen TTS from the main path");
assert(componentSource.includes("声音参考会随 Seedance 请求一起用于锁定角色声线"), "Demo Audio Plan UI should explain voice references are sent to the video model");
assert(componentSource.includes("当前 demo 不在本地生成配音"), "Demo Audio Plan UI should park local TTS in user-facing copy");

assert(hookSource.includes("permissionReceiptId"), "voice clone request must include permissionReceiptId");
assert(hookSource.includes("confirmationToken"), "voice clone request must include confirmationToken");
assert(hookSource.includes("submit-local-qwen3-tts-clone"), "voice clone request must use the required confirmation token");
assert(hookSource.includes("xVectorOnlyMode: input.xVectorOnlyMode ?? true"), "voice clone UI path should work without storing a reference transcript");
assert(hookSource.includes("hasReferenceAudio"), "voice clone action must preflight reference audio before runtime submission");
assert(hookSource.includes("window.confirm"), "voice clone action must ask for a final confirmation");

const hookBody = findFunctionBody(hookSource, "useLocalQwen3TtsCloneAction");
const beforeRunBody = hookBody.slice(0, hookBody.indexOf("const runLocalQwen3TtsClone"));
assert(!beforeRunBody.includes("generateLocalQwen3TtsClone("), "voice clone must not auto-submit before the user action is created");
assert(!/useEffect\s*\(/.test(hookSource), "voice clone hook should not use an effect to submit work");

for (const requiredCopy of ["待设置", "待授权", "可生成", "生成中", "完成", "失败", "请先选择或配置一段已授权的声音参考"]) {
  assert(hookSource.includes(requiredCopy), `missing parked voice clone hook copy: ${requiredCopy}`);
}

for (const forbiddenMainPathCopy of ["声音克隆", "生成克隆配音", "克隆配音"]) {
  assert(!componentCopy.includes(forbiddenMainPathCopy), `Demo Audio Plan UI must not expose local TTS copy: ${forbiddenMainPathCopy}`);
}

for (const forbiddenCopy of [
  "provider",
  "schema",
  "queue",
  "receipt",
  "permissionReceiptId",
  "confirmationToken",
  "referenceAudioPath",
  "speakerWavPath",
  "local-qwen3-tts-clone",
]) {
  assert(!componentCopy.includes(forbiddenCopy), `Audio Plan UI copy must not expose engineering term: ${forbiddenCopy}`);
  assert(!hookCopy.includes(forbiddenCopy), `voice clone user copy must not expose engineering term: ${forbiddenCopy}`);
}

console.log("local-qwen3-tts-clone-ui-contract-test: ok");
