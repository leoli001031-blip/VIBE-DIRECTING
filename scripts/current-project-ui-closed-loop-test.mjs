import fs from "node:fs";
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";
import ts from "typescript";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readText(path) {
  return fs.readFileSync(path, "utf8");
}

function dataUrl(path, output) {
  return `data:text/javascript;base64,${Buffer.from(`${output}\n//# sourceURL=${pathToFileURL(path).href}`).toString("base64")}`;
}

function findFunctionBody(source, functionName) {
  const signature = `function ${functionName}`;
  const start = source.indexOf(signature);
  assert(start >= 0, `${functionName} is missing`);
  const paramsOpen = source.indexOf("(", start);
  assert(paramsOpen >= 0, `${functionName} has no params`);
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
  const open = source.indexOf("{", paramsClose);
  assert(open >= 0, `${functionName} has no body`);
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth === 0) return source.slice(open + 1, index);
  }
  throw new Error(`${functionName} body was not closed`);
}

async function importProjectRealChainStatus() {
  const sourcePath = "src/core/projectRealChainStatus.ts";
  const output = ts.transpileModule(readText(sourcePath), {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ES2022,
      moduleResolution: ts.ModuleResolutionKind.Node10,
      importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
      isolatedModules: true,
    },
    fileName: sourcePath,
  });
  return import(dataUrl(sourcePath, output.outputText));
}

function waitForServer(child) {
  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => {
      reject(new Error(`Timed out waiting for server. stdout=${stdout} stderr=${stderr}`));
    }, 15000);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
      for (const line of stdout.split(/\r?\n/)) {
        if (!line.includes("vibe-core-runtime-api-listening")) continue;
        try {
          const payload = JSON.parse(line);
          clearTimeout(timeout);
          resolve(payload);
          return;
        } catch {
          // Keep waiting for a complete JSON line.
        }
      }
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on("exit", (code) => {
      if (code === 0) return;
      clearTimeout(timeout);
      reject(new Error(`Server exited early with ${code}. stdout=${stdout} stderr=${stderr}`));
    });
  });
}

async function fetchJson(url, init) {
  const response = await fetch(url, init);
  const payload = await response.json();
  assert(response.status === 200, `${url} returned ${response.status}`);
  return payload;
}

function assertCreatorPanelContract() {
  const appSource = readText("src/App.tsx");
  const stylesSource = readText("src/styles.css");
  const app = findFunctionBody(appSource, "App");
  const panel = findFunctionBody(appSource, "ProjectRealChainPanel");
  const surface = `${panel}\n${findFunctionBody(appSource, "projectRealChainStatusLabel")}\n${findFunctionBody(appSource, "projectImage2BatchStatusLabel")}\n${findFunctionBody(appSource, "projectImage2BatchLedgerLabel")}`;

  for (const [label, pattern] of [
    ["runtime endpoint", /runtime\s+endpoint/i],
    ["fallback report", /fallback\s+report/i],
    ["005 sandbox", /005\s+sandbox/i],
    ["real demo id", /real_demo_e2e_005/i],
    ["provider submit", /provider\s+submit|provider\s+未提交/i],
    ["prepare ran", /prepare\s+ran|prepareRan|prepare\s+未执行/i],
    ["live submit", /live\s+submit/i],
    ["ledger", /\bledger\b/i],
    ["needs review English", /needs\s+review/i],
  ]) {
    assert(!pattern.test(surface), `ProjectRealChainPanel exposed ${label}`);
  }

  assert(/项目状态/.test(surface), "ProjectRealChainPanel should expose creator-facing project status copy");
  assert(/图片生成/.test(surface), "ProjectRealChainPanel should expose creator-facing image generation copy");
  assert(/projectTitle[\s\S]*状态已回流/.test(surface), "ProjectRealChainPanel should show project title for returned status");
  assert(/currentProjectIdentity\(runtimeState\)/.test(app), "App must derive current project identity from runtime state");
  assert(/loadProjectRealChainStatus\(runtimeProjectIdentity\)/.test(app), "App must guard real-chain status by current project identity");
  assert(/loadProjectImage2BatchPlan\(runtimeProjectIdentity\)/.test(app), "App must guard Image2 batch status by current project identity");
  assert(/runProjectRealChainCheck\(runtimeProjectIdentity\)/.test(app), "App run-check must carry current project identity");
  assert(/runProjectImage2BatchCheck\(runtimeProjectIdentity\)/.test(app), "App Image2 check must carry current project identity");
  assert(!/real-demo-005/.test(`${appSource}\n${stylesSource}`), "app/styles should not retain 005 demo class names");
}

const {
  deriveProjectRealChainStatus,
  deriveProjectImage2BatchPlanStatus,
  guardProjectRealChainUiStateForCurrentProject,
  guardProjectImage2BatchUiStateForCurrentProject,
  projectRuntimeRequestPath,
} = await importProjectRealChainStatus();

const child = spawn(process.execPath, ["scripts/local-runtime-api-server.mjs"], {
  cwd: process.cwd(),
  env: { ...process.env, VIBE_CORE_RUNTIME_API_PORT: "0" },
  stdio: ["ignore", "pipe", "pipe"],
});

try {
  assertCreatorPanelContract();
  const queryPath = projectRuntimeRequestPath("/api/runtime/projects/current/real-chain/status", {
    projectId: "最后一班星图",
    projectRoot: "/Users/lichenhao/Desktop/Vibe Director/runtime-tests/full_generation_10shot_two_act_20260429",
  });
  const queryParams = new URLSearchParams(queryPath.split("?")[1] || "");
  assert(queryPath.includes("projectId="), "runtime request path should carry project id");
  assert(queryPath.includes("projectRoot="), "runtime request path should carry project root");
  assert(queryParams.get("projectId") === "最后一班星图", "runtime request path should preserve non-ASCII project id");
  assert(queryParams.get("projectRoot") === "/Users/lichenhao/Desktop/Vibe Director/runtime-tests/full_generation_10shot_two_act_20260429", "runtime request path should preserve absolute project root");
  const { baseUrl } = await waitForServer(child);
  const realChainPayload = await fetchJson(`${baseUrl}/api/runtime/projects/current/real-chain/status`);
  const image2Payload = await fetchJson(`${baseUrl}/api/runtime/projects/current/image2-batch/plan`);
  assert(/compatibility fallback/.test(realChainPayload.sourceLabel || ""), "default current-project runtime source should be marked as compatibility fallback");
  assert(/compatibility fallback/.test(image2Payload.sourceLabel || ""), "default Image2 batch runtime source should be marked as compatibility fallback");

  const realChain = deriveProjectRealChainStatus(realChainPayload, "runtime_endpoint");
  assert(realChain.uiStatus === "production_needs_review", `real-chain UI status drifted: ${realChain.uiStatus}`);
  assert(realChain.returnedImageCount === 8, "real-chain should report returned images");
  assert(realChain.totalPlannedImages === 8, "real-chain should report planned images");
  assert(realChain.needsReviewCount === 2, "real-chain should report review count");
  assert(realChain.reviewShotIds.includes("S07"), "real-chain should keep S07 review shot");
  assert(realChain.reviewShotIds.includes("S08"), "real-chain should keep S08 review shot");
  assert(realChain.previewItems.length === 8, "real-chain should expose preview items");
  assert(realChain.previewItems.every((item) => item.imageUrl || item.expectedOutputPath), "preview items should have media refs");
  assert(realChain.providerCalled === false, "real-chain status must not imply provider call");
  assert(realChain.prepareRan === false, "real-chain status must not imply prepare run");
  const realChainMatched = guardProjectRealChainUiStateForCurrentProject(
    { status: realChain.uiStatus, summary: realChain },
    { projectId: realChain.projectId, projectRoot: realChain.projectRoot },
  );
  assert(realChainMatched.status === "production_needs_review", "matching real-chain identity should pass through");
  const realChainMismatch = guardProjectRealChainUiStateForCurrentProject(
    { status: realChain.uiStatus, summary: realChain },
    { projectId: "small-project-one-shot", projectRoot: "fixtures/small-project-one-shot" },
  );
  assert(realChainMismatch.status === "unavailable", "mismatched real-chain identity should be blocked from current project UI");
  assert(!realChainMismatch.summary, "mismatched real-chain identity must not leak another project's summary");

  const image2Batch = deriveProjectImage2BatchPlanStatus(image2Payload);
  assert(image2Batch.uiStatus === "ready_for_review", `image2 batch UI status drifted: ${image2Batch.uiStatus}`);
  assert(image2Batch.plannedCount === 8, "image2 batch should plan eight items");
  assert(image2Batch.readyCount === 8, "image2 batch should expose eight reviewable items");
  assert(image2Batch.blockedCount === 0, "image2 batch should have no blocked items in current fixture");
  assert(image2Batch.queuedCount === 8, "image2 batch should project queued ledger items");
  assert(image2Batch.ledgerProjections.length === 8, "image2 batch should carry ledger projections");
  assert(image2Batch.providerSubmissionForbidden === true, "image2 batch must forbid provider submission");
  assert(image2Batch.noFileMutation === true, "image2 batch must not mutate files");
  assert(image2Batch.workerSpawnForbidden === true, "image2 batch must forbid worker spawn");
  assert(image2Batch.providerCalled === false, "image2 batch must not call provider");
  assert(image2Batch.prepareRan === false, "image2 batch must not run prepare");
  assert(image2Batch.liveSubmitAllowed === false, "image2 batch must not allow live submit");
  const image2Matched = guardProjectImage2BatchUiStateForCurrentProject(
    { status: image2Batch.uiStatus, summary: image2Batch },
    { projectId: image2Batch.projectId, projectRoot: image2Batch.projectRoot },
  );
  assert(image2Matched.status === "ready_for_review", "matching Image2 batch identity should pass through");
  const image2Mismatch = guardProjectImage2BatchUiStateForCurrentProject(
    { status: image2Batch.uiStatus, summary: image2Batch },
    { projectId: "small-project-one-shot", projectRoot: "fixtures/small-project-one-shot" },
  );
  assert(image2Mismatch.status === "unavailable", "mismatched Image2 batch identity should be blocked from current project UI");
  assert(!image2Mismatch.summary, "mismatched Image2 batch identity must not leak another project's summary");

  console.log("Current project UI closed-loop test passed. runtime -> report/preview -> UI projection is creator-facing; no provider was called.");
} finally {
  child.kill("SIGTERM");
}
