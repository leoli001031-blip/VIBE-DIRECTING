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

assert(componentSource.includes("useLocalQwen3TtsCloneAction"), "Audio Plan UI should use the voice clone action hook");
assert(componentSource.includes("checked={voiceCloneAction.authorized}"), "voice clone authorization checkbox should be bound to action state");
assert(componentSource.includes("disabled={voiceCloneAction.disabled}"), "voice clone button should be disabled until allowed");
assert(componentSource.includes(`voiceCloneAction.status === "needs_reference"`), "voice clone authorization should stay disabled until a safe audio reference is configured");
assert(componentSource.includes("onClick={() => { void runLocalQwen3TtsClone(); }}"), "voice clone should only run from a user click");

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

for (const requiredCopy of ["待设置", "待授权", "可生成", "生成中", "完成", "失败", "声音克隆", "生成克隆配音", "请先选择或配置一段已授权的声音参考"]) {
  assert(`${componentSource}\n${hookSource}`.includes(requiredCopy), `missing user-facing voice clone copy: ${requiredCopy}`);
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
