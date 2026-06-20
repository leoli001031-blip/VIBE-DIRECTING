import { spawn } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

import { createProjectVibe, hashProjectVibeFacts } from "../src/project/index.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function waitForServer(child: ReturnType<typeof spawn>) {
  return new Promise<void>((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => {
      reject(new Error(`Timed out waiting for runtime server. stdout=${stdout} stderr=${stderr}`));
    }, 15000);

    child.stdout?.on("data", (chunk) => {
      stdout += chunk.toString();
      for (const line of stdout.split(/\r?\n/)) {
        if (!line.includes("vibe-director-runtime-api-listening")) continue;
        clearTimeout(timeout);
        resolve();
        return;
      }
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on("exit", (code) => {
      if (code === 0) return;
      clearTimeout(timeout);
      reject(new Error(`Runtime server exited early with ${code}. stdout=${stdout} stderr=${stderr}`));
    });
  });
}

async function postJson(url: string, body: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json();
  return { response, payload };
}

const port = 8890 + Math.floor(Math.random() * 200);
const baseUrl = `http://127.0.0.1:${port}`;
const tsxCliPath = join(process.cwd(), "node_modules", "tsx", "dist", "cli.mjs");
const projectRoot = `.vibe-runtime/browser-projects/runtime-save-sanitize-${Date.now()}`;
const bindingPath = `.vibe-runtime/runtime-save-sanitize-binding-${Date.now()}.json`;
const projectId = "runtime_save_sanitize";

const child = spawn(process.execPath, [tsxCliPath, "scripts/local-runtime-api-server.mts"], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    VIBE_DIRECTOR_RUNTIME_API_PORT: String(port),
    VIBE_DIRECTOR_CURRENT_PROJECT_BINDING_PATH: bindingPath,
  },
  stdio: ["ignore", "pipe", "pipe"],
});

try {
  await waitForServer(child);
  const select = await postJson(`${baseUrl}/api/runtime/projects/select`, {
    projectRoot,
    projectId,
    displayName: "Runtime Save Sanitize",
    createIfMissing: true,
  });
  assert(select.response.ok && select.payload.ok === true, `select should succeed: ${JSON.stringify(select.payload)}`);

  const project = createProjectVibe({
    projectId,
    title: "Runtime Save Sanitize",
    createdAt: "2026-06-19T00:00:00.000Z",
    updatedAt: "2026-06-19T00:00:00.000Z",
    storyFlow: {
      id: "story_flow_runtime_save",
      sections: [{ id: "section_runtime_save", title: "Runtime Save", summary: "Runtime save sanitizer.", sequenceIndex: 0, shotIds: ["shot_runtime_save"] }],
      shotOrder: ["shot_runtime_save"],
    },
    shots: [{
      id: "shot_runtime_save",
      sectionId: "section_runtime_save",
      title: "Runtime Save Shot",
      intent: "Validate runtime save sanitizer.",
      sceneAssetIds: [],
      characterAssetIds: [],
      propAssetIds: [],
      durationSeconds: 4,
      status: "planned",
      sourceRefs: ["fixture:runtime_save"],
    }],
    receipts: {
      scriptPlanningReceipts: [{
        id: "script_receipt_runtime_save",
        kind: "script_planning",
        createdAt: "2026-06-19T00:00:01.000Z",
        plannerId: "script_planner",
        sourceFactHash: "before-save",
        scriptBriefId: "brief_runtime_save",
        sectionIds: ["section_runtime_save"],
        shotIds: ["shot_runtime_save"],
        blockerCount: 0,
        evidenceRefs: [
          "staged_fact:intake_雨夜旧电影院_黑猫叼电影票_引少女_character_candidate_黑猫_1",
          "staged_fact:intake_雨夜旧电影院_黑猫叼电影票_引少女_character_candidate_引少女_2",
          "staged_fact:intake_雨夜旧电影院_黑猫叼电影票_引少女_character_candidate_望月_3",
        ],
        providerSelfReportUsed: false,
        runtimeFixtureUsed: false,
      }],
      promptKeyframePlanningReceipts: [],
      batchReceipts: [],
      reviewReceipts: [],
    },
  });

  const save = await postJson(`${baseUrl}/api/runtime/projects/current/project-vibe/save?projectRoot=${encodeURIComponent(projectRoot)}`, {
    projectRoot,
    project,
  });
  assert(save.response.ok && save.payload.ok === true, `runtime save should succeed: ${JSON.stringify(save.payload)}`);
  assert(save.payload.factHash && save.payload.factHash !== hashProjectVibeFacts(project), "runtime save should return the sanitized fact hash");

  const savedPath = join(process.cwd(), projectRoot, "project.vibe");
  assert(existsSync(savedPath), "runtime save should write project.vibe");
  const savedText = readFileSync(savedPath, "utf8");
  assert(savedText.includes("character_candidate_黑猫"), "runtime save should keep clean character candidate evidence");
  assert(savedText.includes("character_candidate_望月"), "runtime save should keep name-like character candidate evidence");
  assert(!savedText.includes("character_candidate_引少女"), "runtime save should sanitize action-prefixed character candidate evidence");
} finally {
  child.kill("SIGTERM");
  rmSync(join(process.cwd(), projectRoot), { recursive: true, force: true });
  rmSync(join(process.cwd(), bindingPath), { force: true });
}

console.log("runtime-api-current-project-save-project-vibe-test: runtime save sanitizes Project.vibe receipts.");
