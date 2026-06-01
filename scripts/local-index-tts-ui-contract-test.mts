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
const hookPath = "src/ui/director/useLocalIndexTtsAction.ts";
const componentSource = stripComments(readText(componentPath));
const hookSource = stripComments(readText(hookPath));
const componentCopy = extractStringLiterals(componentSource);
const hookCopy = extractStringLiterals([
  findFunctionBody(hookSource, "defaultConfirmAction"),
  findFunctionBody(hookSource, "completedMessage"),
  findFunctionBody(hookSource, "useLocalIndexTtsAction"),
].join("\n"));

assert(!componentSource.includes("useLocalIndexTtsAction"), "Audio Plan UI should not expose the IndexTTS fallback while Qwen is fixed as the primary TTS route");
assert(!componentSource.includes("runLocalIndexTts"), "Audio Plan UI should not expose an IndexTTS generate action");
assert(!componentSource.includes("备用本机配音"), "Audio Plan UI should not show a secondary TTS chooser");

assert(hookSource.includes("permissionReceiptId"), "local TTS request must include permissionReceiptId");
assert(hookSource.includes("confirmationToken"), "local TTS request must include confirmationToken");
assert(hookSource.includes("submit-local-index-tts"), "local TTS request must use the required confirmation token");
assert(hookSource.includes("window.confirm"), "local TTS action must ask for a final confirmation");

const hookBody = findFunctionBody(hookSource, "useLocalIndexTtsAction");
const beforeRunBody = hookBody.slice(0, hookBody.indexOf("const runLocalIndexTts"));
assert(!beforeRunBody.includes("generateLocalIndexTts("), "local TTS must not auto-submit before the user action is created");
assert(!/useEffect\s*\(/.test(hookSource), "local TTS hook should not use an effect to submit work");

for (const requiredCopy of ["待授权", "可生成", "生成中", "完成", "失败"]) {
  assert(hookSource.includes(requiredCopy), `missing fallback hook status copy: ${requiredCopy}`);
}

for (const forbiddenCopy of [
  "provider",
  "schema",
  "queue",
  "receipt",
  "permissionReceiptId",
  "confirmationToken",
  "speakerWavPath",
  "speakerAudioPath",
  "local-index-tts",
]) {
  assert(!componentCopy.includes(forbiddenCopy), `Audio Plan UI copy must not expose engineering term: ${forbiddenCopy}`);
  assert(!hookCopy.includes(forbiddenCopy), `local TTS user copy must not expose engineering term: ${forbiddenCopy}`);
}

console.log("local-index-tts-ui-contract-test: ok");
