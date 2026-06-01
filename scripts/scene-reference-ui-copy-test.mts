import fs from "node:fs";

function readText(path: string) {
  return fs.readFileSync(path, "utf8");
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`FAIL: ${message}`);
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
  assert(paramsOpen >= 0, `${functionName} has no parameter list`);

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
  assert(open >= 0, `${functionName} has no function body`);

  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth === 0) return source.slice(open + 1, index);
  }

  throw new Error(`${functionName} body was not closed`);
}

function visibleCopyFrom(source: string, functionNames: string[]) {
  return functionNames.map((name) => findFunctionBody(source, name)).join("\n");
}

function extractStringLiterals(source: string) {
  return Array.from(source.matchAll(/(["'`])((?:\\.|(?!\1)[\s\S])*?)\1/g))
    .map((match) => match[2])
    .join("\n");
}

const storyFlowSource = stripComments(readText("src/ui/director/MinimalStoryFlow.tsx"));
const assetLibrarySource = stripComments(readText("src/ui/director/MinimalAssetLibrary.tsx"));
const assetLibraryUiSource = stripComments(readText("src/ui/director/assetLibraryUi.ts"));

const visibleCopySource = [
  visibleCopyFrom(storyFlowSource, [
    "MinimalStoryFlow",
    "shotSceneReferenceStatus",
    "sceneReferenceStatusLabel",
  ]),
  visibleCopyFrom(assetLibrarySource, ["MinimalAssetLibrary"]),
  visibleCopyFrom(assetLibraryUiSource, [
    "assetLibraryTypeLabel",
    "assetLibraryStatusLabel",
    "defaultAssetConstraints",
    "assetLibraryUserBlockers",
  ]),
].join("\n");
const visibleCopyStrings = extractStringLiterals(visibleCopySource);

for (const label of [
  "场景/天气参考",
  "已锁定",
  "待复核",
  "待补齐",
  "天气、空间和环境一致",
  "后续视频会继续使用",
]) {
  assert(visibleCopySource.includes(label), `UI copy must include ${label}`);
}

for (const [label, pattern] of [
  ["scene_baseline", /scene_baseline/i],
  ["referenceAuthority", /referenceAuthority/],
  ["provider", /\bprovider\b/i],
  ["queue", /\bqueue\b/i],
  ["schema", /\bschema\b/i],
] as const) {
  assert(!pattern.test(visibleCopyStrings), `default scene reference UI copy must not expose ${label}`);
}

console.log("scene-reference-ui-copy-test: creator-facing scene reference copy checks completed.");
