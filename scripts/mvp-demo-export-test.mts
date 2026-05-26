import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { buildExportWorkerState, executeExportWorkerPlan } from "../src/core/exportWorker.ts";
import { buildPreviewExportState } from "../src/core/previewExport.ts";
import { openLocalProjectVibe, saveLocalProjectVibe } from "../src/project/localProjectVibeStorage.ts";
import type { ProjectVibeDocument } from "../src/project/types.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`FAIL: ${message}`);
}

class DiskExportAdapter {
  constructor(private readonly projectRoot: string) {}

  async mkdir(relativePath: string) {
    await import("node:fs/promises").then(({ mkdir }) => mkdir(path.join(this.projectRoot, relativePath), { recursive: true }));
  }

  async writeFile(relativePath: string, content: string) {
    const target = path.join(this.projectRoot, relativePath);
    const scoped = path.relative(this.projectRoot, target);
    if (scoped.startsWith("..") || path.isAbsolute(scoped)) throw new Error(`outside project root: ${relativePath}`);
    await import("node:fs/promises").then(async ({ mkdir, writeFile }) => {
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, content, "utf8");
    });
  }
}

const generatedAt = "2026-05-16T00:00:00.000Z";
const sampleRoot = "sample-projects/mvp-demo";

async function assertProjectFileExists(projectRoot: string, relativePath: string, label: string) {
  await access(path.join(projectRoot, relativePath)).catch((error) => {
    throw new Error(`FAIL: ${label} should exist at ${relativePath}: ${error instanceof Error ? error.message : String(error)}`);
  });
}

async function assertSampleProjectContract(projectRoot: string, project: ProjectVibeDocument) {
  assert(project.manifest.projectId === "mvp_demo_sample", "sample Project.vibe should preserve project id");
  assert(project.manifest.title === "Morning Market MVP Demo", "sample Project.vibe should have demo title");
  assert(project.manifest.sourceOfTruth === "project_vibe", "sample source of truth should be Project.vibe");
  assert(project.manifest.runtimeFixtureAuthority === false, "sample should not promote runtime fixtures");
  assert(project.storyFlow.shotOrder.length === 3, "sample should include a three-shot MVP path");
  assert(project.assets.filter((asset) => asset.status === "locked").length === 3, "sample should include three locked demo assets");
  assert(project.runs.some((run) => run.runKind === "agent_loop" && run.runtimeFixtureUsed === false), "sample should include local Agent Loop receipt evidence");

  for (const asset of project.assets) {
    assert(asset.path, `asset ${asset.id} should have a project-relative path`);
    await assertProjectFileExists(projectRoot, asset.path, `asset ${asset.id}`);
  }
  for (const run of project.runs) {
    for (const evidenceRef of run.evidenceRefs) {
      await assertProjectFileExists(projectRoot, evidenceRef, `receipt ${run.id}`);
    }
  }

  const readme = await readFile(path.join(projectRoot, "README.md"), "utf8");
  assert(!/account|sign[- ]?in|login|hosted workspace/i.test(readme), "sample README should stay local-file focused");
}

const projectRoot = await mkdtemp(path.join(tmpdir(), "vibe-mvp-demo-"));

try {
  const sampleOpenResult = await openLocalProjectVibe(sampleRoot);
  assert(sampleOpenResult.ok && sampleOpenResult.project, `sample Project.vibe should open: ${sampleOpenResult.errors.join("; ")}`);
  await assertSampleProjectContract(sampleRoot, sampleOpenResult.project);

  const saveResult = await saveLocalProjectVibe(projectRoot, sampleOpenResult.project);
  assert(saveResult.ok, `Project.vibe save failed: ${saveResult.errors.join("; ")}`);
  const openResult = await openLocalProjectVibe(projectRoot);
  assert(openResult.ok && openResult.project, `Project.vibe open failed: ${openResult.errors.join("; ")}`);
  assert(openResult.project.manifest.title === sampleOpenResult.project.manifest.title, "opened project should restore sample title");

  const previewExport = buildPreviewExportState({
    generatedAt,
    projectRoot,
    selectedShotId: "S01",
    previewEvents: [],
    shots: [
      {
        id: "S01",
        actId: "A1",
        sectionId: "opening",
        title: "Open on the street",
        storyFunction: "Establish the location.",
        startFrame: "outputs/previews/S01.png",
        status: "ready",
        gates: { identity: "PASS", scene: "PASS", pair: "PASS", story: "PASS", prop: "N/A", style: "PASS" },
        issues: [],
      },
      {
        id: "S02",
        actId: "A1",
        sectionId: "opening",
        title: "Move toward the door",
        storyFunction: "Invite the next beat.",
        status: "assets_ready",
        gates: { identity: "PASS", scene: "PASS", pair: "PARTIAL", story: "PASS", prop: "N/A", style: "PARTIAL" },
        issues: [],
      },
      {
        id: "S03",
        actId: "A1",
        sectionId: "opening",
        title: "Offer the first cup",
        storyFunction: "Close the demo beat with a simple human action.",
        status: "planned",
        gates: { identity: "PASS", scene: "PASS", pair: "PARTIAL", story: "PASS", prop: "N/A", style: "PASS" },
        issues: [],
      },
    ],
    jobs: [],
    taskRuns: [],
    taskViews: [],
    manifestMatches: [],
    generationHealthReports: [],
    qaPromotionReports: [],
    issues: [],
  });

  const worker = buildExportWorkerState({
    source: previewExport,
    projectVibe: openResult.project,
    projectTitle: openResult.project.manifest.title,
    exportRoot: "exports/mvp-demo",
    generatedAt,
    profileSelection: ["rough_cut", "asset_package", "storyboard_table"],
    executionMode: "adapter_execution",
    confirmation: true,
  });
  assert(worker.canExecute, `export worker should be executable: ${worker.blockers.join("; ")}`);

  const result = await executeExportWorkerPlan(worker, new DiskExportAdapter(projectRoot));
  assert(result.ok, `export worker execution failed: ${result.errors.join("; ")}`);
  assert(
    result.executed.every((entry) => entry.path === "exports" || entry.path.startsWith("exports/mvp-demo")),
    "executed writes must stay inside export root",
  );

  const manifest = JSON.parse(await readFile(path.join(projectRoot, "exports/mvp-demo/export_manifest.json"), "utf8"));
  assert(manifest.mvpPackage.projectVibeIncluded === true, "MVP export must include Project.vibe");
  assert(manifest.mvpPackage.lockedAssetCount === 3, "MVP export must include locked asset count");
  assert((await readFile(path.join(projectRoot, "exports/mvp-demo/report.md"), "utf8")).includes("MVP Export Report"), "report should be written");
  console.log(`mvp-demo-export-test: ok (${result.executed.length} writes under ${projectRoot})`);
} finally {
  await rm(projectRoot, { recursive: true, force: true });
}
