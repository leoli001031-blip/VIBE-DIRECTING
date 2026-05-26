import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { buildScriptStoryboardPromptPack } from "../src/core/scriptStoryboardPromptPack.ts";
import {
  DIRECTOR_PRODUCTION_SKILL_VERSION,
  productionSkillImage2PromptBlock,
  productionSkillSeedancePromptBlock,
  type DirectorProductionStrategyId,
} from "../src/core/directorProductionSkill.ts";
import type { StoryboardReferenceAsset } from "../src/core/storyboardReferencePipeline.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function timestampId(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function writeText(filePath: string, text: string): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, text, "utf8");
}

function writeJson(filePath: string, payload: unknown): void {
  writeText(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

function table(rows: Array<Record<string, string>>): string {
  const columns = ["镜号", "标题", "时长", "内部 skill", "Image2 任务", "Seedance 编译", "资产状态", "原因"];
  return [
    `| ${columns.join(" | ")} |`,
    `| ${columns.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${columns.map((column) => row[column] || "-").join(" | ")} |`),
  ].join("\n");
}

const outputRoot = path.resolve("real-test-sandbox", `director-production-skill-flow-${timestampId()}`);
const storyboardDir = path.join(outputRoot, "storyboards");
const videoDir = path.join(outputRoot, "seedance");

const sceneGarden: StoryboardReferenceAsset = {
  id: "scene_mountain_observatory",
  role: "scene_baseline",
  path: "/project/assets/scenes/mountain-observatory.png",
  label: "山顶旧观测站，清晨薄雾",
};
const sceneStation: StoryboardReferenceAsset = {
  id: "scene_night_station",
  role: "scene_baseline",
  path: "/project/assets/scenes/night-station.png",
  label: "夜色旧站台，湿冷灯光",
};
const heroine: StoryboardReferenceAsset = {
  id: "char_mio",
  role: "character_identity",
  path: "/project/assets/characters/mio-short-hair.png",
  label: "短发少女澪",
};
const boy: StoryboardReferenceAsset = {
  id: "char_ren",
  role: "character_identity",
  path: "/project/assets/characters/ren-school-uniform.png",
  label: "少年莲",
};
const ticket: StoryboardReferenceAsset = {
  id: "prop_ticket",
  role: "prop_reference",
  path: "/project/assets/props/old-train-ticket.png",
  label: "旧车票",
};
const ribbon: StoryboardReferenceAsset = {
  id: "prop_blue_ribbon",
  role: "prop_reference",
  path: "/project/assets/props/blue-ribbon.png",
  label: "蓝色长丝带",
};

const pack = buildScriptStoryboardPromptPack({
  title: "蓝色晨雾测试片",
  logline: "短发少女在山顶观测站与夜色站台之间寻找一张旧车票留下的声音。",
  completeScript: [
    "清晨，山顶旧观测站外，薄雾从护栏下方升起。澪安静站着，听见远处广播塔的电流声。",
    "夜色旧站台。澪把旧车票递给莲，莲的手在快碰到车票前停住。",
    "列车灯光扫过站台，两人被迫快步穿过人群，镜头在远景、脚步、手部和回头之间快速切换。",
    "最后，蓝色长丝带被风卷起，像信号波一样在空中展开成一条发光路径，引导两人奔向站台尽头。",
  ].join("\n"),
  style: "restrained Japanese TV anime, early Evangelion-like tension, rough director planning before provider submit",
  creativeBrief: {
    filmLikes: ["early Neon Genesis Evangelion TV anime mood", "quiet pressure before sudden motion"],
    rhythmLikes: ["AI decides pacing by segment", "wide relation shot then close-up inserts when needed"],
    expressionLikes: ["eye-line tension", "hand detail", "not advertisement-like"],
    notes: "Use baseline assets first. Use storyboard only when motion/cuts need a previs board.",
  },
  storyboardOutputDir: storyboardDir,
  videoOutputDir: videoDir,
  image2OutputSize: "1280x720",
  seedanceVideoResolution: "720p",
  referenceBundle: {
    scenes: [sceneGarden, sceneStation],
    characters: [heroine, boy],
    props: [ticket, ribbon],
  },
  shots: [
    {
      shotId: "FT01",
      title: "清晨观测站建立",
      durationSeconds: 6,
      executionMode: "single_continuous_shot",
      sceneId: sceneGarden.id,
      characterIds: [heroine.id],
      propIds: [],
      shotSize: "宽中景建立",
      camera: "远一点的宽中景，轻微推进；澪在画面左侧，旧观测站门和护栏形成纵深。",
      frameDescription: "澪安静站在清晨薄雾里，短发被轻风带动，远处广播塔的电流声让她抬眼。",
      actionBeats: ["薄雾流过护栏", "澪抬眼", "广播塔电流声出现"],
      primaryAction: "澪在薄雾里抬眼看向广播塔",
      actionTrigger: "远处广播塔传来轻微电流声",
      microReaction: "她呼吸停住半拍",
      dialogue: "-",
      sound: "清晨风声，远处电流底噪。",
    },
    {
      shotId: "FT02",
      title: "车票递出前一拍",
      durationSeconds: 4,
      executionMode: "action_insert",
      sceneId: sceneStation.id,
      characterIds: [heroine.id, boy.id],
      propIds: [ticket.id],
      shotSize: "手部特写",
      camera: "低一点的手部插入特写，浅景深；背景保留湿冷站台灯光和校服袖口。",
      frameDescription: "澪把旧车票递向画面右侧，莲的手从右侧伸进来，在快碰到车票前停住。",
      actionBeats: ["澪递出旧车票", "莲的手靠近", "两只手之间停住半拍"],
      primaryAction: "莲的手慢慢靠近旧车票",
      actionTrigger: "澪把旧车票递到两人中间",
      microReaction: "澪的手指轻轻收紧",
      actorAction: "莲的手从右侧伸进来",
      reactorResponse: "澪没有收回车票，只是手指收紧",
      dialogue: "澪：你听见了吗？",
      sound: "远处列车刹车声，纸张轻响。",
    },
    {
      shotId: "FT03",
      title: "站台快切穿行",
      durationSeconds: 10,
      executionMode: "planned_cut_sequence",
      sceneId: sceneStation.id,
      characterIds: [heroine.id, boy.id],
      propIds: [ticket.id],
      shotSize: "动作快切段落",
      camera: "远景建立方向后切脚步、手部、回头和列车灯光扫过；保持澪左、莲右的空间轴线。",
      frameDescription: "列车灯光扫过站台，两人在人群边缘快步穿行，旧车票被握在澪手里作为方向锚点。",
      actionBeats: ["远景交代站台方向", "澪拉住车票冲出", "脚步踩过积水", "莲回头确认追来的灯光", "两人穿过站台柱子"],
      primaryAction: "澪和莲沿站台边缘快步穿行",
      actionTrigger: "列车灯光突然扫过他们身后",
      microReaction: "莲回头确认灯光后立刻跟上",
      actorAction: "澪从左侧带头穿行",
      reactorResponse: "莲在右侧跟上并回头确认",
      dialogue: "-",
      sound: "列车进站低鸣，急促脚步，积水溅起。",
    },
    {
      shotId: "FT04",
      title: "蓝色丝带信号路径",
      durationSeconds: 12,
      executionMode: "planned_cut_sequence",
      sceneId: sceneGarden.id,
      characterIds: [heroine.id],
      propIds: [ribbon.id],
      shotSize: "动态系统段落",
      camera: "低角度跟随丝带抬升，随后环绕澪和空中发光路径。",
      frameDescription: "蓝色长丝带被风卷起，从澪手边爆开，旋成信号波、圆环和通往远处的发光路径。",
      actionBeats: ["丝带被风卷起", "信号波展开", "圆环绕过澪", "路径指向远处", "澪抬头准备奔跑"],
      primaryAction: "蓝色丝带展开成发光路径",
      actionTrigger: "广播塔电流声和风同时增强",
      microReaction: "澪抬头，眼神从犹豫变成决心",
      dialogue: "-",
      sound: "风声增强，电流声变清晰，无配乐。",
    },
  ],
});

const expectedRoutes: Record<string, DirectorProductionStrategyId> = {
  FT02: "omni_reference",
  FT03: "storyboard_rapid_cut",
  FT04: "storyboard_rapid_cut",
};

for (const shot of pack.shots) {
  const strategy = shot.productionSkillPlan.strategyId;
  if (expectedRoutes[shot.shotId]) {
    assert(strategy === expectedRoutes[shot.shotId], `${shot.shotId} routed to ${strategy}, expected ${expectedRoutes[shot.shotId]}`);
  }
  assert(shot.productionSkillPlan.schemaVersion === DIRECTOR_PRODUCTION_SKILL_VERSION, `${shot.shotId} missing production skill version`);
  assert(shot.seedanceVideoPlan.prompt.includes("Internal production skill for Seedance"), `${shot.shotId} missing Seedance skill block`);
}

const ft03 = pack.shots.find((shot) => shot.shotId === "FT03")!;
const ft04 = pack.shots.find((shot) => shot.shotId === "FT04")!;
assert(ft03.image2StoryboardPlan?.prompt.includes("Production annotation mode"), "FT03 should allow storyboard production annotations");
assert(ft03.image2StoryboardPlan?.prompt.includes("RED=camera"), "FT03 should include annotation key");
assert(ft03.seedanceVideoPlan.prompt.includes("Do not render storyboard artifacts"), "FT03 Seedance prompt should strip storyboard artifacts");
assert(ft03.seedanceVideoPlan.prompt.includes("No arrows, colored lines"), "FT03 Seedance prompt should forbid final annotation leakage");
assert(ft04.image2StoryboardPlan?.prompt.includes("motion-system"), "FT04 should carry motion-system storyboard guidance");
assert(ft04.productionSkillPlan.panelCountIntent >= 8, "FT04 should request a multi-panel rapid-cut board");

const productionTasks = pack.shots.map((shot) => {
  const mode = shot.productionSkillPlan.image2Directive.mode;
  const image2Task = mode === "none"
    ? "skip"
    : mode === "narrative_storyboard"
      ? "generate narrative storyboard"
      : "generate rapid-cut storyboard";
  return {
    shotId: shot.shotId,
    title: shot.title,
    strategyId: shot.productionSkillPlan.strategyId,
    strategyLabel: shot.productionSkillPlan.strategyLabel,
    durationSeconds: shot.durationSeconds,
    image2Task,
    seedanceCompilerProfile: shot.productionSkillPlan.seedanceDirective.compilerProfile,
    panelCountIntent: shot.productionSkillPlan.panelCountIntent,
    reasons: shot.productionSkillPlan.reasons,
    warnings: shot.productionSkillPlan.warnings,
    image2PromptPath: mode === "none" ? undefined : `prompts/image2/${shot.shotId}.md`,
    seedancePromptPath: `prompts/seedance/${shot.shotId}.md`,
  };
});

writeJson(path.join(outputRoot, "prompt-pack.json"), pack);
writeJson(path.join(outputRoot, "production-tasks.json"), productionTasks);

for (const shot of pack.shots) {
  const mode = shot.productionSkillPlan.image2Directive.mode;
  if (mode !== "none") {
    writeText(path.join(outputRoot, "prompts", "image2", `${shot.shotId}.md`), `${shot.image2StoryboardPlan.prompt}\n`);
  }
  writeText(path.join(outputRoot, "prompts", "seedance", `${shot.shotId}.md`), `${shot.seedanceVideoPlan.prompt}\n`);
  writeText(path.join(outputRoot, "prompts", "skill", `${shot.shotId}.image2-skill.md`), `${productionSkillImage2PromptBlock(shot.productionSkillPlan)}\n`);
  writeText(path.join(outputRoot, "prompts", "skill", `${shot.shotId}.seedance-skill.md`), `${productionSkillSeedancePromptBlock(shot.productionSkillPlan)}\n`);
}

const reportRows = pack.shots.map((shot) => {
  const task = productionTasks.find((item) => item.shotId === shot.shotId)!;
  return {
    镜号: shot.shotId,
    标题: shot.title,
    时长: `${shot.durationSeconds}s`,
    "内部 skill": `${shot.productionSkillPlan.strategyLabel} (${shot.productionSkillPlan.strategyId})`,
    "Image2 任务": task.image2Task,
    "Seedance 编译": shot.productionSkillPlan.seedanceDirective.compilerProfile,
    "资产状态": shot.productionSkillPlan.assetReadiness.needsBaselineFirst ? shot.productionSkillPlan.assetReadiness.missingOrUnready.join("；") : "locked",
    原因: shot.productionSkillPlan.reasons.join("；"),
  };
});

const report = [
  `# Director Production Skill Flow Smoke`,
  "",
  `输出目录：${outputRoot}`,
  "",
  "## 路由结果",
  "",
  table(reportRows),
  "",
  "## 关键验收",
  "",
  "- FT02 短手部插入镜头走 clean state reference，不走粗故事板。",
  "- FT03 快切站台段走 rough sequence storyboard，Image2 允许生产标注，Seedance 禁止渲染标注。",
  "- FT04 丝带/信号波段走 motion-system storyboard，用多 panel 规划连续形态系统。",
  "- 所有 Seedance prompt 都带 no BGM / no subtitles / no storyboard artifacts 约束。",
  "",
].join("\n");

writeText(path.join(outputRoot, "flow-report.md"), report);

console.log(JSON.stringify({
  ok: true,
  outputRoot,
  taskCount: productionTasks.length,
  routes: Object.fromEntries(pack.shots.map((shot) => [shot.shotId, shot.productionSkillPlan.strategyId])),
  reportPath: path.join(outputRoot, "flow-report.md"),
  productionTasksPath: path.join(outputRoot, "production-tasks.json"),
}, null, 2));
