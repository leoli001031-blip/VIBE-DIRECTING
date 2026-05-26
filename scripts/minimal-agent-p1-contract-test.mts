import fs from "node:fs";

function readText(path: string) {
  return fs.readFileSync(path, "utf8");
}

function assert(condition: unknown, message: string): asserts condition {
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

const minimalAgentPanelSource = stripComments(readText("src/ui/director/MinimalAgentPanel.tsx"));
const agentPanelProjectionSource = stripComments(readText("src/ui/director/agentPanelProjection.ts"));
const directorModeSource = stripComments(readText("src/ui/director/DirectorModeShell.tsx"));
const stylesSource = stripComments(readText("src/styles/director.css"));

const prepareChange = findFunctionBody(minimalAgentPanelSource, "prepareChange");
const updateVideoPermissionContract = findFunctionBody(minimalAgentPanelSource, "updateVideoPermissionContract");
const detectVideoContract = findFunctionBody(agentPanelProjectionSource, "detectAgentVideoSubmitContract");
const labelVideoContract = findFunctionBody(agentPanelProjectionSource, "agentVideoSubmitContractLabel");
const detailVideoContract = findFunctionBody(agentPanelProjectionSource, "agentVideoSubmitContractDetail");
const directorMode = findFunctionBody(directorModeSource, "DirectorMode");

assert(/setText\(""\)/.test(prepareChange), "MinimalAgentPanel must clear text after sending");
assert(/setAttachments\(\[\]\)/.test(prepareChange), "MinimalAgentPanel must clear attachments after sending");
assert(/detectAgentVideoPermissionContract\(userIntent,\s*activeVideoPermissionContract\)/.test(prepareChange), "send must detect the video submit contract from creator input");
assert(/updateVideoPermissionContract\(nextVideoPermissionContract\)/.test(prepareChange), "send must write the session video submit contract");
assert(/videoPermissionContract:\s*nextVideoPermissionContract/.test(prepareChange), "prepared context must carry the video submit contract");
assert(/videoPermissionContract:\s*confirmedVideoPermissionContract/.test(minimalAgentPanelSource), "preview handoff must carry the video submit contract");
assert(/onVideoPermissionContractChange\?\.\(nextContract\)/.test(updateVideoPermissionContract), "MinimalAgentPanel must expose contract updates to the session owner");

assert(/export type AgentVideoSubmitContract/.test(agentPanelProjectionSource), "agentPanelProjection must define the session contract type");
assert(/videoSubmitAllowed:\s*false/.test(detectVideoContract), "plan-only detection must write videoSubmitAllowed=false");
assert(/referenceGenerationAllowed:\s*false/.test(detectVideoContract), "plan-only detection must lock reference generation too");
for (const phrase of ["先不要提交视频", "不要生视频", "只规划", "先别提交"]) {
  assert(agentPanelProjectionSource.includes(phrase), `plan-only phrases must include ${phrase}`);
}
assert(/可生成参考[\s\S]*可提交视频/.test(labelVideoContract), "mode labels must include reference and video states");
assert(/不会提交视频/.test(detailVideoContract), "plan-only detail must say video will not be submitted");

assert(/minimal-agent-permission-mode/.test(minimalAgentPanelSource), "MinimalAgentPanel must render the three-mode status");
assert(/只规划[\s\S]*可生成参考[\s\S]*可提交视频/.test(minimalAgentPanelSource), "MinimalAgentPanel must show the three creator-facing modes");
assert(/disabled=\{videoPermissionBlockedByContract/.test(minimalAgentPanelSource), "video button must be disabled by the session contract");
assert(/if\s*\(videoPermissionBlockedByContract\)\s*return/.test(minimalAgentPanelSource), "video click handler must guard the session contract");
assert(/\.minimal-agent-permission-mode/.test(stylesSource), "three-mode status needs styling");

assert(/useState<AgentVideoPermissionContract>\(defaultAgentVideoPermissionContract\)/.test(directorMode), "DirectorMode must own the session video submit contract");
assert(/sessionVideoSendAction[\s\S]*disabled:\s*true[\s\S]*ready:\s*false/.test(directorMode), "DirectorMode must turn the contract into a disabled video action");
assert(/videoSendAction=\{sessionVideoSendAction\}/.test(directorMode), "CreatorDeskPanels must receive the contract-aware video action");
assert(/videoSendAction=\{directorView === "story" \? sessionVideoSendAction : undefined\}/.test(directorMode), "MinimalAgentPanel must receive the contract-aware video action");
assert(/onSendVideo=\{sessionSendSeedanceVideo\}/.test(directorMode), "CreatorDeskPanels must use the contract-aware submit callback");
assert(/onSendSeedanceVideo=\{sessionSendSeedanceVideo\}/.test(directorMode), "MinimalAgentPanel must use the contract-aware submit callback");
assert(/onVideoPermissionContractChange=\{setVideoPermissionContract\}/.test(directorMode), "MinimalAgentPanel must write back to the DirectorMode session");

console.log("minimal-agent-p1-contract-test passed");
