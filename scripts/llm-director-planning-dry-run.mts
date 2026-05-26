import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import {
  buildDirectorAiStoryboardPrompt,
  type DirectorAiStoryboardPlan,
} from "../src/core/directorAiStoryboardPlanner.ts";
import {
  classifyReferenceAssetText,
  isStandalonePropReference,
} from "../src/core/referenceAssetStrategy.ts";
import { createRuntimeApiDirectorStoryboardPlanRoute } from "./runtime-routes/director-storyboard-plan.mts";
import { createRuntimeApiCurrentProjectSeedanceSubmit } from "./runtime-routes/current-project-seedance-submit.mts";
import { getProviderApiKey, getProviderConfigStatuses } from "./runtime-api-credentials.mts";
import { APIKEY_FUN_RESPONSES_IMAGE_PROVIDER_ID } from "./apikey-fun-responses-image-transport.mts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function writeFile(filePath: string, value: string | Buffer): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, value);
}

function writeJson(filePath: string, payload: unknown): void {
  writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

function sha256Bytes(bytes: Buffer | Uint8Array): string {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function clean(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function splitList(value: unknown): string[] {
  return clean(value)
    .split(/[、,，/|]/u)
    .map((item) => clean(item))
    .filter((item) => item && item !== "-" && item !== "无" && item !== "待确认");
}

function safeId(value: string): string {
  return value.replace(/[^A-Za-z0-9\u4e00-\u9fa5_-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 60) || "item";
}

function markdownTable(headers: string[], rows: string[][]): string {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map((cell) => clean(cell).replace(/\|/g, "/") || "-").join(" | ")} |`),
  ].join("\n");
}

function storyboardShotToProjectShot(shot: DirectorAiStoryboardPlan["shots"][number], index: number) {
  const id = `shot_${String(index + 1).padStart(2, "0")}`;
  return {
    id,
    sectionId: `section_${String(index + 1).padStart(2, "0")}`,
    title: shot.title,
    durationSeconds: shot.durationSeconds,
    intent: [
      `镜号：${shot.shotNo}`,
      `时长：${shot.durationSeconds} 秒`,
      `景别：${shot.shotSize}`,
      `镜头：${shot.camera}`,
      `画面：${shot.visualDescription}`,
      `主动作：${shot.primaryAction}`,
      `触发：${shot.actionTrigger}`,
      `微反应：${shot.microReaction}`,
      `visibleClips：${shot.visibleClips}`,
      `storyboardPanels：${shot.storyboardPanels}`,
      `actionBeats：${shot.actionBeats.join(" / ")}`,
      shot.subtitle && shot.subtitle !== "-" ? `字幕：${shot.subtitle}` : "",
      `声音：${shot.sound}`,
      `角色：${shot.characters}`,
      `场景：${shot.scene}`,
      `道具：${shot.props}`,
    ].filter(Boolean).join("。"),
    camera: shot.camera,
    primaryAction: shot.primaryAction,
    actionTrigger: shot.actionTrigger,
    microReaction: shot.microReaction,
    executionMode: shot.executionMode,
    rhythmProfile: shot.rhythmProfile,
    splitPolicy: `visibleClips=${shot.visibleClips}; storyboardPanels=${shot.storyboardPanels}; ${shot.visibleCutBudget}`,
    visibleClips: shot.visibleClips,
    storyboardPanels: shot.storyboardPanels,
    referenceStrategy: shot.referenceStrategy,
    seedanceDirection: shot.rhythmReason,
    sound: shot.sound,
    subtitle: shot.subtitle === "-" ? undefined : shot.subtitle,
    characterGuidance: splitList(shot.characters),
    sceneGuidance: splitList(shot.scene),
    propGuidance: splitList(shot.props),
    actionBeats: shot.actionBeats.length ? shot.actionBeats : [shot.primaryAction, shot.actionTrigger, shot.microReaction].map(clean).filter(Boolean),
    sceneAssetIds: [],
    characterAssetIds: [],
    propAssetIds: [],
    status: "planned",
    sourceRefs: [`llm_director_plan:${shot.shotNo}`],
  };
}

function referenceCandidatesForPlan(plan: DirectorAiStoryboardPlan) {
  const candidates = new Map<string, {
    kind: "character" | "scene" | "prop";
    label: string;
    usedByShotIds: string[];
    classification: string;
    reason: string;
  }>();
  const add = (kind: "character" | "scene" | "prop", label: string, shotId: string) => {
    const key = `${kind}:${label}`;
    const current = candidates.get(key);
    const classification = classifyReferenceAssetText(label, kind);
    if (current) {
      current.usedByShotIds = [...new Set([...current.usedByShotIds, shotId])];
      return;
    }
    candidates.set(key, {
      kind,
      label,
      usedByShotIds: [shotId],
      classification: classification.bucket,
      reason: classification.reason,
    });
  };
  plan.shots.forEach((shot, index) => {
    const shotId = `shot_${String(index + 1).padStart(2, "0")}`;
    splitList(shot.characters).forEach((item) => add("character", item, shotId));
    splitList(shot.scene).forEach((item) => add("scene", item, shotId));
    splitList(shot.props).forEach((item) => add("prop", item, shotId));
  });
  return [...candidates.values()];
}

function issuesForPlan(input: {
  plan: DirectorAiStoryboardPlan;
  references: ReturnType<typeof referenceCandidatesForPlan>;
  fullCompilerManifest?: any;
  seedancePrompts: Array<{ shotId: string; prompt: string; compilerMode?: string }>;
}) {
  const issues: string[] = [];
  const durationSum = input.plan.shots.reduce((sum, shot) => sum + Number(shot.durationSeconds || 0), 0);
  if (Math.abs(durationSum - Number(input.plan.totalDurationSeconds || 0)) > 1) {
    issues.push(`总时长不一致：LLM totalDurationSeconds=${input.plan.totalDurationSeconds}，镜头相加=${durationSum}。`);
  }
  if (input.fullCompilerManifest?.segmentPlan?.length && input.plan.shots.length > input.fullCompilerManifest.segmentPlan.length) {
    issues.push(`真实视频编译入口当前只看到 ${input.fullCompilerManifest.segmentPlan.length}/${input.plan.shots.length} 个镜头，可能仍受 allShots.slice(0,4) 或分段策略限制。`);
  }
  const weakRapid = input.plan.shots
    .filter((shot) => shot.referenceStrategy === "storyboard_rapid_cut")
    .filter((shot) => !shot.visibleClips || !shot.storyboardPanels);
  if (weakRapid.length) {
    issues.push(`快切镜头缺少 visibleClips/storyboardPanels 合同：${weakRapid.map((shot) => shot.shotNo).join(", ")}。`);
  }
  const overDetailedProps = input.references
    .filter((ref) => ref.kind === "prop" && !isStandalonePropReference(ref.label));
  if (overDetailedProps.length) {
    issues.push(`参考物仍把部件/细节当候选道具：${overDetailedProps.map((ref) => ref.label).join("、")}。这些应收回到父对象约束。`);
  }
  const promptCollapses = input.seedancePrompts
    .filter((entry) => /故事板快切/.test(entry.prompt) && /Create exactly 1 visible clip\(s\)/.test(entry.prompt) && !/actionBeats only/.test(entry.prompt));
  if (promptCollapses.length) {
    issues.push(`快切 Seedance prompt 仍塌成 1 个可见剪辑且没有说明 storyboardPanels/actionBeats：${promptCollapses.map((entry) => entry.shotId).join(", ")}。`);
  }
  const missingCompiledPrompts = input.seedancePrompts
    .filter((entry) => !entry.prompt || !entry.compilerMode);
  if (missingCompiledPrompts.length) {
    issues.push(`部分镜头没有成功编译出 Seedance prompt：${missingCompiledPrompts.map((entry) => entry.shotId).join(", ")}。`);
  }
  const promptMentionsBgm = input.seedancePrompts
    .filter((entry) => /\bBGM\b|music|配乐|背景音乐/i.test(entry.prompt) && !/No music, no BGM|无BGM|无音乐/.test(entry.prompt));
  if (promptMentionsBgm.length) {
    issues.push(`视频提示词可能把配乐带进 Seedance：${promptMentionsBgm.map((entry) => entry.shotId).join(", ")}。`);
  }
  const missingReferenceStrategy = input.plan.shots.filter((shot) => !shot.referenceStrategy);
  if (missingReferenceStrategy.length) {
    issues.push(`镜头缺少 referenceStrategy：${missingReferenceStrategy.map((shot) => shot.shotNo).join(", ")}。`);
  }
  const uncertainCharacters = input.plan.shots.filter((shot) => /待确认/.test(shot.characters));
  if (uncertainCharacters.length && input.references.some((ref) => ref.kind === "character")) {
    issues.push(`部分镜头角色仍是待确认：${uncertainCharacters.map((shot) => shot.shotNo).join(", ")}。如果脚本有明确主角，应进入角色资产。`);
  }
  return issues;
}

const repoRoot = process.cwd();
const generatedAt = new Date().toISOString();
const defaultScriptText = [
  "项目想法：做一个 24 秒左右的 90 年代日本 TV 动画感山路悬疑短片，6 个镜头左右。",
  "深夜雨后的山脚便利店外，一辆白色双门车和一辆黑色双门车并排停在湿亮弯道前。",
  "便利店霓虹忽然闪烁，车灯亮起；女主在白车里看见副驾上的旧磁带盒发出蓝光。",
  "两车同时启动，启动段希望有日漫快切：霓虹、手、仪表、轮胎水花、车灯线。",
  "进入第一个弯时，黑车在雾里短暂消失；最后只剩白车驶过山脊，天空微微泛白。",
  "不是激烈飙车，要悬疑、克制、干净赛璐璐、柔和手绘背景。不要真人写实，不要 3D，不要 BGM，音乐和环境声后期再处理。",
].join("\n");
const scriptText = clean(process.env.DIRECTOR_DRY_RUN_SCRIPT_TEXT) || defaultScriptText;
const styleText = clean(process.env.DIRECTOR_DRY_RUN_STYLE_TEXT)
  || "参考 1990 年代日本 TV 动画、山路赛车悬疑、克制分镜。启动段可以故事板快切，其他段尽量让场景图+人物/车辆参考+提示词发挥。";
const userPreference = clean(process.env.DIRECTOR_DRY_RUN_USER_PREFERENCE)
  || "希望 AI 自己判断哪段需要故事板叙事、哪段需要故事板快切、哪段只要全能参考；不要把车灯、轮胎、手这种部件单独做成参考资产。";
const parsedTargetDuration = Number(process.env.DIRECTOR_DRY_RUN_TARGET_DURATION_SECONDS);
const targetDurationSeconds = Number.isFinite(parsedTargetDuration) && parsedTargetDuration > 0
  ? parsedTargetDuration
  : 24;
const caseName = safeId(clean(process.env.DIRECTOR_DRY_RUN_CASE_NAME) || "default");
const runId = `${caseName}-${generatedAt.replace(/[:.]/g, "-")}`;
const runRootRelativePath = `.vibe-runtime/llm-director-planning-dry-run/${runId}`;
const runRootPath = path.resolve(repoRoot, runRootRelativePath);
rmSync(runRootPath, { recursive: true, force: true });
mkdirSync(runRootPath, { recursive: true });
const structuralRows = [{
  id: "idea_1",
  title: clean(process.env.DIRECTOR_DRY_RUN_TITLE) || "山雾便利店",
  text: scriptText,
  durationSeconds: targetDurationSeconds,
  timeRange: `0:00-0:${String(Math.round(targetDurationSeconds)).padStart(2, "0")}`,
  characters: clean(process.env.DIRECTOR_DRY_RUN_STRUCTURAL_CHARACTERS) || "女主、白色双门车、黑色双门车",
  scene: clean(process.env.DIRECTOR_DRY_RUN_STRUCTURAL_SCENE) || "雨后山脚便利店外山路",
  props: clean(process.env.DIRECTOR_DRY_RUN_STRUCTURAL_PROPS) || "旧磁带盒、车灯、轮胎、便利店霓虹",
}];

writeJson(path.join(runRootPath, "input.json"), {
  generatedAt,
  scriptText,
  styleText,
  userPreference,
  targetDurationSeconds,
  structuralRows,
});
const fullPrompt = buildDirectorAiStoryboardPrompt({
  scriptText,
  styleText,
  userPreference,
  targetDurationSeconds,
  structuralRows,
});
writeFile(path.join(runRootPath, "llm_prompt.md"), fullPrompt);

let storyboardRoutePayload: any;
const storyboardRoute = createRuntimeApiDirectorStoryboardPlanRoute({
  endpoint: "/api/runtime/director/storyboard-plan",
  getProviderApiKey,
  getProviderConfigStatuses,
  readRequestJsonBody: async () => ({
    scriptText,
    styleText,
    userPreference,
    targetDurationSeconds,
    structuralRows,
  }),
  runtimePolicy: (extra = {}) => ({
    providerPolicyVersion: "dry-run",
    runMode: "llm_director_planning_dry_run",
    ...extra,
  }),
  runtimeRoot: repoRoot,
  writeJson: (_res: any, statusCode: number, payload: unknown) => {
    storyboardRoutePayload = { statusCode, payload };
  },
});

await storyboardRoute.handleRuntimeApiDirectorStoryboardPlanRoute(
  { method: "POST" } as any,
  {} as any,
  new URL("http://localhost/api/runtime/director/storyboard-plan"),
);

writeJson(path.join(runRootPath, "storyboard_route_response.json"), storyboardRoutePayload);
assert(storyboardRoutePayload?.payload?.ok === true, `LLM storyboard route failed: ${JSON.stringify(storyboardRoutePayload?.payload || storyboardRoutePayload)}`);
const plan = storyboardRoutePayload.payload.plan as DirectorAiStoryboardPlan;
writeJson(path.join(runRootPath, "llm_plan.normalized.json"), plan);

const projectShots = plan.shots.map(storyboardShotToProjectShot);
const references = referenceCandidatesForPlan(plan);
writeJson(path.join(runRootPath, "reference_candidates.json"), references);

const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
  "base64",
);
const workbenchAssets = references
  .filter((ref) => ref.kind !== "prop" || ref.classification === "standalone")
  .filter((ref) => ref.kind !== "scene" || ref.classification === "standalone")
  .map((ref, index) => {
    const relativePath = `${runRootRelativePath}/assets/${String(index + 1).padStart(2, "0")}-${ref.kind}-${safeId(ref.label)}.png`;
    writeFile(path.resolve(repoRoot, relativePath), tinyPng);
    return {
      type: ref.kind,
      name: ref.label,
      path: relativePath,
      usedByShotIds: ref.usedByShotIds,
      textConstraints: [
        `dry-run reference candidate: ${ref.label}`,
        `classification: ${ref.classification}`,
        `reason: ${ref.reason}`,
      ],
    };
  });

const projectFacts = { projectVibe: { shots: projectShots } };
const workbenchFacts = { visualMemory: { assets: workbenchAssets } };
writeJson(path.join(runRootPath, "project_shots_for_compiler.json"), projectFacts);
writeJson(path.join(runRootPath, "workbench_references_for_compiler.json"), workbenchFacts);

function createSeedanceRouteForSource(source: any, facts: any) {
  return createRuntimeApiCurrentProjectSeedanceSubmit({
    endpoint: "/api/runtime/projects/current/seedance/submit",
    repoRoot,
    currentProjectRouteContext: async () => undefined,
    readProjectFacts: () => facts,
    currentProjectWorkbenchFacts: () => workbenchFacts,
    getProviderApiKey: () => "sk-dry-run-not-used",
    getProviderConfigStatuses: () => [{
      providerId: APIKEY_FUN_RESPONSES_IMAGE_PROVIDER_ID,
      baseUrl: "https://api.apikey.fun/v1/responses",
      imageModel: "gpt-5.5",
      credential: { keyStatus: "configured" },
    }],
    requestOverrideDiagnostics: () => ({}),
    runtimePolicy: (extra = {}) => ({
      providerPolicyVersion: "dry-run",
      runMode: "llm_director_planning_dry_run",
      ...extra,
    }),
    scopedRepoPath(relativePath: string): string {
      return path.resolve(repoRoot, relativePath);
    },
    sha256Bytes,
    writeCurrentProjectRuntimeBytes(relativePath: string, bytes: Buffer, routeSource: typeof source): string {
      assert(relativePath.startsWith(routeSource.runRootRelativePath), `write escaped source root: ${relativePath}`);
      const filePath = path.resolve(repoRoot, relativePath);
      writeFile(filePath, bytes);
      return filePath;
    },
    writeCurrentProjectRuntimeJson(relativePath: string, payload: unknown, routeSource: typeof source): void {
      assert(relativePath.startsWith(routeSource.runRootRelativePath), `write escaped source root: ${relativePath}`);
      writeJson(path.resolve(repoRoot, relativePath), payload);
    },
    writeJson: () => undefined,
    running: false,
    setRunning: () => undefined,
  });
}

const fullCompileSource = {
  runRootPath: path.join(runRootPath, "compiler-full"),
  runRootRelativePath: `${runRootRelativePath}/compiler-full`,
  projectVibePath: path.join(runRootPath, "compiler-full/project/project.vibe"),
  projectVibeRelativePath: `${runRootRelativePath}/compiler-full/project/project.vibe`,
  previewPlanPath: path.join(runRootPath, "compiler-full/reports/preview_plan.json"),
  previewPlanRelativePath: `${runRootRelativePath}/compiler-full/reports/preview_plan.json`,
};
mkdirSync(fullCompileSource.runRootPath, { recursive: true });
const fullCompileRoute = createSeedanceRouteForSource(fullCompileSource, projectFacts);
const fullCompile = await fullCompileRoute.currentProjectSeedanceSubmitResponse({
  confirmation: {
    confirmed: true,
    phrase: "submit-seedance-video",
    receiptId: "dry_run_full",
    confirmedAt: generatedAt,
  },
  modelVersion: "seedance2.0",
  videoResolution: "720p",
  ratio: "16:9",
  durationSeconds: targetDurationSeconds,
  pollSeconds: 30,
  providerId: APIKEY_FUN_RESPONSES_IMAGE_PROVIDER_ID,
  mockProviderResult: true,
  cliPath: "/bin/echo",
}, {}, fullCompileSource);
writeJson(path.join(runRootPath, "seedance_full_project_compile_response.json"), fullCompile);

let fullCompilerManifest: any;
if (fullCompile?.promptPath) {
  const manifestPath = path.join(path.dirname(path.resolve(repoRoot, fullCompile.promptPath)), "input-manifest.json");
  if (existsSync(manifestPath)) {
    fullCompilerManifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    writeJson(path.join(runRootPath, "seedance_full_project_input_manifest.json"), fullCompilerManifest);
  }
}

const seedancePrompts: Array<{ shotId: string; promptPath?: string; compilerMode?: string; prompt: string }> = [];
for (const shot of projectShots) {
  const singleSource = {
    runRootPath: path.join(runRootPath, `compiler-${shot.id}`),
    runRootRelativePath: `${runRootRelativePath}/compiler-${shot.id}`,
    projectVibePath: path.join(runRootPath, `compiler-${shot.id}/project/project.vibe`),
    projectVibeRelativePath: `${runRootRelativePath}/compiler-${shot.id}/project/project.vibe`,
    previewPlanPath: path.join(runRootPath, `compiler-${shot.id}/reports/preview_plan.json`),
    previewPlanRelativePath: `${runRootRelativePath}/compiler-${shot.id}/reports/preview_plan.json`,
  };
  mkdirSync(singleSource.runRootPath, { recursive: true });
  const singleFacts = { projectVibe: { shots: [shot] } };
  const route = createSeedanceRouteForSource(singleSource, singleFacts);
  const response = await route.currentProjectSeedanceSubmitResponse({
    confirmation: {
      confirmed: true,
      phrase: "submit-seedance-video",
      receiptId: `dry_run_${shot.id}`,
      confirmedAt: generatedAt,
    },
    selectedShotIds: [shot.id],
    modelVersion: "seedance2.0",
    videoResolution: "720p",
    ratio: "16:9",
    durationSeconds: shot.durationSeconds,
    pollSeconds: 30,
    providerId: APIKEY_FUN_RESPONSES_IMAGE_PROVIDER_ID,
    mockProviderResult: true,
    cliPath: "/bin/echo",
  }, {}, singleSource);
  writeJson(path.join(runRootPath, `seedance_${shot.id}_compile_response.json`), response);
  const prompt = response?.promptPath && existsSync(path.resolve(repoRoot, response.promptPath))
    ? readFileSync(path.resolve(repoRoot, response.promptPath), "utf8")
    : "";
  seedancePrompts.push({
    shotId: shot.id,
    promptPath: response?.promptPath,
    compilerMode: response?.compilerMode,
    prompt,
  });
}
writeJson(path.join(runRootPath, "seedance_prompt_previews.json"), seedancePrompts.map((entry) => ({
  shotId: entry.shotId,
  promptPath: entry.promptPath,
  compilerMode: entry.compilerMode,
  promptPreview: entry.prompt.slice(0, 2400),
})));

const issues = issuesForPlan({
  plan,
  references,
  fullCompilerManifest,
  seedancePrompts,
});
writeJson(path.join(runRootPath, "audit_issues.json"), issues);

const shotRows = plan.shots.map((shot, index) => [
  shot.shotNo || String(index + 1),
  `${shot.durationSeconds}s`,
  shot.title,
  shot.executionMode,
  shot.referenceStrategy,
  shot.visibleCutBudget,
  `visibleClips=${shot.visibleClips}`,
  `storyboardPanels=${shot.storyboardPanels}`,
  shot.characters,
  shot.scene,
  shot.props,
]);
const refRows = references.map((ref) => [
  ref.kind,
  ref.label,
  ref.classification,
  ref.usedByShotIds.join(", "),
  ref.reason,
]);
const promptRows = seedancePrompts.map((entry) => [
  entry.shotId,
  entry.compilerMode || "-",
  entry.promptPath || "-",
  entry.prompt.match(/Create exactly \d+ visible clip\(s\)/)?.[0]
    || entry.prompt.match(/Use the \d+ storyboard panel\(s\)/)?.[0]
    || entry.prompt.match(/Follow exactly \d+ primary storyboard panel\(s\)/)?.[0]
    || "-",
]);

const summary = [
  "# LLM Director Planning Dry Run",
  "",
  `Generated: ${generatedAt}`,
  `Run root: ${runRootRelativePath}`,
  "",
  "## Input Idea",
  scriptText,
  "",
  "## LLM Shot Plan",
  markdownTable(
    ["镜号", "时长", "标题", "executionMode", "referenceStrategy", "visibleCutBudget", "visibleClips", "storyboardPanels", "角色", "场景", "道具"],
    shotRows,
  ),
  "",
  "## Reference Candidates",
  markdownTable(["kind", "label", "classification", "usedByShotIds", "reason"], refRows),
  "",
  "## Prompt Compile Preview",
  markdownTable(["shotId", "compilerMode", "promptPath", "visible cut contract"], promptRows),
  "",
  "## Findings",
  ...(issues.length ? issues.map((issue) => `- ${issue}`) : ["- 没有发现阻断级 dry-run 问题。"]),
  "",
  "## Evidence Files",
  "- input.json",
  "- llm_prompt.md",
  "- llm_plan.normalized.json",
  "- reference_candidates.json",
  "- seedance_full_project_compile_response.json",
  "- seedance_full_project_input_manifest.json",
  "- seedance_prompt_previews.json",
  "- audit_issues.json",
].join("\n");
writeFile(path.join(runRootPath, "summary.md"), summary);

console.log(`llm-director-planning-dry-run: ok`);
console.log(`runRoot=${runRootRelativePath}`);
console.log(`shots=${plan.shots.length}`);
console.log(`references=${references.length}`);
console.log(`issues=${issues.length}`);
for (const issue of issues) console.log(`issue: ${issue}`);
