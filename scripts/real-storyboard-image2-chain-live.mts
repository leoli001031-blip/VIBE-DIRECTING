import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { ensureMinimumDefaultKnowledgePacks } from "../src/core/knowledgeDefaults.ts";
import { estimateKnowledgeTokens, stableKnowledgeHash } from "../src/core/knowledgeManifest.ts";
import type { KnowledgePack } from "../src/core/knowledgeTypes.ts";
import {
  buildScriptStoryboardPromptPack,
  type ScriptStoryboardShotInput,
} from "../src/core/scriptStoryboardPromptPack.ts";
import { buildStyleResearchPreflight } from "../src/core/styleResearchPreflight.ts";
import { fetchLanyiImageViaResponsesStream } from "./lanyi-responses-stream-transport.mts";
import { getProviderApiKey, getProviderConfigStatuses } from "./runtime-api-credentials.mts";

type GeneratedStoryboard = {
  shotId: string;
  title: string;
  ok: boolean;
  outputPath?: string;
  receiptPath: string;
  promptPath: string;
  outputSha256?: string;
  attempts: Array<Record<string, unknown>>;
  errorMessage?: string;
};

type AssetPlan = {
  id: string;
  role: "character_identity" | "scene_baseline" | "prop_reference";
  label: string;
  prompt: string;
  outputPath: string;
};

type GeneratedAsset = {
  id: string;
  role: AssetPlan["role"];
  label: string;
  ok: boolean;
  outputPath?: string;
  outputSha256?: string;
  receiptPath: string;
  promptPath: string;
  errorMessage?: string;
  attempts: Array<Record<string, unknown>>;
};

function argValue(name: string, fallback = ""): string {
  const exactIndex = process.argv.indexOf(name);
  if (exactIndex >= 0) return process.argv[exactIndex + 1] || fallback;
  const prefix = `${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) || fallback;
}

function argFlag(name: string): boolean {
  return process.argv.includes(name);
}

function safeInteger(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.floor(parsed) : fallback;
}

function clampInteger(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.floor(value)));
}

function safeId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 100) || "item";
}

function writeJson(filePath: string, payload: unknown): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function writeText(filePath: string, value: string | Buffer): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, value);
}

function inferMime(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  return "image/png";
}

function sha256(value: Buffer | string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function packageRelative(root: string, filePath: string | undefined): string | undefined {
  if (!filePath) return undefined;
  return path.relative(root, path.resolve(filePath)).replace(/\\/g, "/");
}

function retryableImage2Result(result: any): boolean {
  if (result?.ok) return false;
  if (result?.providerResponseMetadata?.retryable === true) return true;
  if (["timeout", "network_error", "rate_limit", "provider_missing", "server_error"].includes(result?.errorType)) return true;
  return typeof result?.statusCode === "number" && result.statusCode >= 500;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  let nextIndex = 0;
  async function runNext(): Promise<void> {
    const index = nextIndex;
    nextIndex += 1;
    if (index >= items.length) return;
    results[index] = await worker(items[index], index);
    await runNext();
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => runNext()));
  return results;
}

function buildStoryboardKnowledgePack(createdAt: string): KnowledgePack {
  const content = [
    "90s Japanese TV anime storyboard method for original homage:",
    "Start from space and relationship, then cut into eyes, hands, objects, and listener reaction.",
    "A useful storyboard reference is not a poster. It should show one strong main composition, clear blocking, action direction, camera movement, and only a small number of timing insets when they help video generation.",
    "For emotional scenes, put the body slightly before the action: hand not yet touching, eyes not fully meeting, mouth before speech, shoulder before turning.",
    "For multi-character scenes, lock screen direction and who acts first, then show the reactor's face or hand. Do not make everyone perform equally in the same frame.",
    "Borrow grammar only. Do not copy protected characters, logos, machines, organizations, exact compositions, dialogue, or plot points from any existing anime.",
  ].join("\n");
  const hash = stableKnowledgeHash(content);
  return {
    id: "project/internalized-90s-anime-storyboard-method",
    version: "live-smoke/1.0.0",
    hash,
    path: "runtime-generated/project/internalized-90s-anime-storyboard-method.md",
    type: "project_local",
    category: "style",
    title: "Internalized 90s Anime Storyboard Method",
    summary: "Original-use rules for 90s Japanese TV anime-like storyboard pacing, emotional inserts, and reference boundaries.",
    tags: ["日漫", "90s anime", "分镜", "EVA-like method", "眼神", "手部", "关系远景", "动作前一拍"],
    applicableTaskPurposes: ["script", "story_audit", "keyframe", "visual_generation", "video_generation"],
    applicableProviderSlots: ["image.generate", "video.i2v"],
    dependencies: [],
    conflicts: [],
    maxInjectionTokens: 900,
    trustLevel: "verified",
    verificationStatus: "verified",
    enabled: true,
    defaultEnabled: true,
    createdAt,
    updatedAt: createdAt,
    sourcePath: "live-smoke/generated",
    snippets: [
      {
        id: "storyboard-method",
        title: "90s anime storyboard method",
        summary: "Use relationship wide shots, reaction closeups, hand/object inserts, and action-before-action poses; do not copy existing anime IP.",
        content,
        keywords: ["日漫", "anime", "分镜", "EVA", "storyboard", "reaction close-up", "hand insert", "multi-character"],
        hash: stableKnowledgeHash(`${hash}:storyboard-method`),
        tokenEstimate: estimateKnowledgeTokens(content),
        sourceHeading: "Storyboard Method",
      },
    ],
  };
}

function buildShots(): ScriptStoryboardShotInput[] {
  return [
    {
      shotId: "SB01",
      title: "雨后的通信塔",
      durationSeconds: 4,
      executionMode: "relationship_wide",
      sceneId: "asset_scene_rooftop_tower",
      characterIds: ["asset_character_mio"],
      propIds: ["asset_prop_blue_cassette"],
      shotSize: "远景到中远景",
      camera: "高位远景，缓慢下压到人物背影，建立空间压迫感",
      frameDescription: "雨后的废弃通信塔外，女主澪站在画面下方偏左，背对镜头，塔身占据画面右侧大面积负空间；天空低垂，积水反光，远处城市像静止的噪点。",
      primaryAction: "澪停在塔门前，没有立刻进去",
      actionTrigger: "塔顶忽然亮起一格旧信号灯",
      microReaction: "她肩膀微微绷紧，手指压住书包里的旧磁带",
      actionBeats: ["信号灯亮起", "澪停住", "手指压住磁带", "她没有回头"],
      dialogue: "-",
      sound: "细雨后水滴声、远处电车低频、塔内微弱电流声",
      animeShotGrammar: ["关系远景先交代孤独尺度", "人物很小，建筑压迫人物", "动作前一拍，先停住再进入"],
    },
    {
      shotId: "SB02",
      title: "门缝里的少年",
      durationSeconds: 5,
      executionMode: "reaction_closeup",
      sceneId: "asset_scene_rooftop_tower",
      characterIds: ["asset_character_mio", "asset_character_ren"],
      propIds: ["asset_prop_blue_cassette"],
      shotSize: "近景 / 过肩",
      camera: "从澪肩后看向门缝，轻微推近，门缝形成竖向遮挡",
      frameDescription: "塔门只开一条缝，少年律站在室内阴影里，右半张脸被冷光切开；澪在前景左侧虚化，只露出肩线和湿发尾，二人左右站位清楚。",
      primaryAction: "律从门缝里看见澪",
      actionTrigger: "澪的鞋尖踩进门槛内侧",
      microReaction: "律的视线先落到她书包，再移到她眼睛",
      actionBeats: ["鞋尖踏入门槛", "律抬眼", "视线扫过书包", "门缝的冷光扩大一点"],
      dialogue: "你还是来了。",
      sound: "旧门轴轻响、室内电流嗡鸣",
      animeShotGrammar: ["遮挡制造心理距离", "先看道具再看人", "对白用眼神承接"],
    },
    {
      shotId: "SB03",
      title: "第七封未发送",
      durationSeconds: 4,
      executionMode: "action_insert",
      sceneId: "asset_scene_control_room",
      characterIds: ["asset_character_mio", "asset_character_ren"],
      propIds: ["asset_prop_blue_cassette"],
      shotSize: "手部特写",
      camera: "极近手部特写，固定镜头，画面只保留手、磁带、旧控制台边缘",
      frameDescription: "澪把一盘蓝色透明磁带放在生锈控制台上，磁带标签写着模糊的第七封；她的手指还没有松开，律的手停在画面右侧边缘，没有碰到她。",
      primaryAction: "澪把磁带放到控制台上",
      actionTrigger: "律说出那句她不该来的话",
      microReaction: "她的指尖迟疑一拍，没有完全松开磁带",
      actionBeats: ["磁带贴近台面", "指尖迟疑", "律的手停住", "控制台灯反射在磁带壳上"],
      dialogue: "-",
      sound: "塑料磁带壳轻碰金属台面、很轻的呼吸",
      animeShotGrammar: ["手部插入镜头承接情绪", "动作前一拍，不让手完全松开", "道具是关系压力中心"],
    },
    {
      shotId: "SB04",
      title: "旧屏幕亮起",
      durationSeconds: 5,
      executionMode: "single_continuous_shot",
      sceneId: "asset_scene_control_room",
      characterIds: ["asset_character_mio", "asset_character_ren"],
      propIds: ["asset_prop_blue_cassette"],
      shotSize: "中景",
      camera: "正面中景，低机位微推，CRT 屏幕作为中间光源",
      frameDescription: "控制室里，澪站左、律站右，中间是一台亮起的旧 CRT；屏幕冷光照亮两人的侧脸，身后铺满电缆和纸质记录。两人没有对视，都看向屏幕。",
      primaryAction: "旧屏幕显示第七封信号正在解码",
      actionTrigger: "磁带被控制台读取",
      microReaction: "澪屏住呼吸，律把手从停止按钮旁移开",
      actionBeats: ["CRT 闪烁", "两人同时看屏幕", "律的手离开停止按钮", "澪屏住呼吸"],
      dialogue: "它还在等我们。",
      sound: "磁带转动、CRT 高频声、纸张被风吹动",
      animeShotGrammar: ["双人同看一个物件形成关系", "角色不对视，压力转移到屏幕", "机械光源塑造心理空间"],
    },
    {
      shotId: "SB05",
      title: "楼梯间的争执",
      durationSeconds: 6,
      executionMode: "planned_cut_sequence",
      sceneId: "asset_scene_control_room",
      characterIds: ["asset_character_mio", "asset_character_ren"],
      propIds: ["asset_prop_blue_cassette"],
      shotSize: "关系远景 + 反应特写提示",
      camera: "倾斜楼梯构图，先远一点看二人上下站位，再给眼神和手部小格提示",
      frameDescription: "塔内狭窄楼梯，澪在下方台阶仰头，律在上方台阶挡住通向天线层的路；铁栏杆斜线把画面切成三块，澪握着磁带，律的手扶住栏杆。",
      primaryAction: "律挡住澪上楼",
      actionTrigger: "广播里传来信号只剩三分钟的倒计时",
      microReaction: "澪先低头看磁带，再抬眼直视律",
      actorAction: "律侧身挡在楼梯上方，不让澪通过",
      reactorResponse: "澪没有后退，只把磁带握得更紧",
      actionBeats: ["倒计时响起", "律挡住楼梯", "澪低头看磁带", "她抬眼直视他"],
      dialogue: "让开。现在只有它能证明她来过。",
      sound: "广播倒计时、楼梯空响、栏杆震动",
      animeShotGrammar: ["多人场景锁上下站位", "先远景再切眼神/手部", "轴线明确，不让两人漂移"],
    },
    {
      shotId: "SB06",
      title: "断电的塔心",
      durationSeconds: 5,
      executionMode: "relationship_wide",
      sceneId: "asset_scene_tower_core",
      characterIds: ["asset_character_mio", "asset_character_ren"],
      shotSize: "全景",
      camera: "宽画幅全景，慢慢横移，人物进入巨大机械空间",
      frameDescription: "塔心机房巨大而空旷，圆形发射核心停在中央，澪和律从画面左下角进入，二人很小；地面电缆像黑色河流，顶灯一排排熄灭。",
      primaryAction: "两人进入断电机房",
      actionTrigger: "楼梯间灯光突然全部熄灭",
      microReaction: "律下意识伸手护住澪前方，澪没有躲开",
      actionBeats: ["灯光熄灭", "二人进入机房", "律伸手挡一下", "澪继续向核心走"],
      dialogue: "-",
      sound: "电闸坠落、巨大空间回声、远处金属收缩声",
      animeShotGrammar: ["机械空间远景体现人物渺小", "保护动作要小，不做英雄姿势", "空间线条引向发射核心"],
    },
    {
      shotId: "SB07",
      title: "启动前一拍",
      durationSeconds: 4,
      executionMode: "action_insert",
      sceneId: "asset_scene_control_room",
      characterIds: ["asset_character_mio", "asset_character_ren"],
      propIds: ["asset_prop_blue_cassette"],
      shotSize: "手与脸的近景",
      camera: "从按钮侧面拍，前景是澪的手，后景是她半张脸，浅景深但线稿清楚",
      frameDescription: "澪的手悬在红色启动键上方一厘米，按钮边缘沾着灰；她的脸在后景偏左，眼睛看向按钮但没有按下。律的影子停在画面边缘。",
      primaryAction: "澪准备按下启动键",
      actionTrigger: "倒计时进入最后十秒",
      microReaction: "她的食指轻轻颤了一下，嘴唇张开但没说话",
      actionBeats: ["倒计时十秒", "食指悬在按钮上", "指尖颤动", "嘴唇微张"],
      dialogue: "-",
      sound: "倒计时变近、指尖摩擦塑料、呼吸声放大",
      animeShotGrammar: ["起始帧就是动作前一拍", "手部和半张脸同框", "不要让按钮已经被按下"],
    },
    {
      shotId: "SB08",
      title: "律的迟到道歉",
      durationSeconds: 6,
      executionMode: "single_continuous_shot",
      sceneId: "asset_scene_control_room",
      characterIds: ["asset_character_mio", "asset_character_ren"],
      propIds: ["asset_prop_blue_cassette"],
      shotSize: "近景正反打提示",
      camera: "先保持双人侧面近景，再用小格提示律的眼神和澪的听者反应",
      frameDescription: "澪停在按钮前，律站在她右后方半步，二人侧面对镜头；律没有拉她，只把手停在半空。画面需要清楚显示他说话的人和听的人。",
      primaryAction: "律终于说出道歉",
      actionTrigger: "澪没有立刻按下按钮",
      microReaction: "澪没有回头，只是眼神微微向右侧移动",
      actorAction: "律把手停在半空，说出迟来的道歉",
      reactorResponse: "澪不回头，眼神轻微偏向他",
      actionBeats: ["澪停住", "律手停在半空", "律开口", "澪眼神向右偏移"],
      dialogue: "那天我不是不相信你。我只是害怕它是真的。",
      sound: "倒计时被压低、很近的人声、机器低鸣",
      animeShotGrammar: ["对白靠听者反应成立", "不要让角色大幅转身", "用眼神微偏表达动摇"],
    },
    {
      shotId: "SB09",
      title: "发送而不是复活",
      durationSeconds: 5,
      executionMode: "action_insert",
      sceneId: "asset_scene_control_room",
      characterIds: ["asset_character_mio", "asset_character_ren"],
      propIds: ["asset_prop_blue_cassette"],
      shotSize: "按钮特写 / 反应近景",
      camera: "俯拍控制面板，按钮、磁带、两只手形成三角构图；随后提示澪眼神放松的一格",
      frameDescription: "控制面板上有两个选项：启动核心和发送信号；澪的手避开红色启动键，按向旁边较小的白色发送键。律的手没有阻拦，只停在旁边。",
      primaryAction: "澪按下发送键",
      actionTrigger: "她听完律的道歉",
      microReaction: "按下后她终于松开磁带，眼角放松",
      actionBeats: ["手避开红色按钮", "按下白色发送键", "律没有阻拦", "澪松开磁带"],
      dialogue: "那就让她知道，我们收到了。",
      sound: "白色按键轻响、磁带停止转动、信号音变得稳定",
      animeShotGrammar: ["动作选择要清楚：不是启动，是发送", "按钮关系必须可读", "手部决定剧情转向"],
    },
    {
      shotId: "SB10",
      title: "天线下的黎明",
      durationSeconds: 6,
      executionMode: "relationship_wide",
      sceneId: "asset_scene_rooftop_tower",
      characterIds: ["asset_character_mio", "asset_character_ren"],
      shotSize: "大全景",
      camera: "从塔顶背后大全景缓慢后拉，二人剪影不动，天线向天空发送一条很细的白线",
      frameDescription: "黎明前的塔顶，澪和律并肩站在画面下方中央，二人之间留出很小的距离；巨大天线从他们身后伸向天空，一道细白信号线穿过云层。城市远处出现第一点晨光。",
      primaryAction: "信号从天线发出",
      actionTrigger: "发送键被按下后塔顶重新通电",
      microReaction: "澪低头笑了一下，律终于看向远处而不是看她",
      actionBeats: ["塔顶通电", "白色信号线升起", "澪低头微笑", "律看向远方"],
      dialogue: "-",
      sound: "风声、稳定信号音、远处第一班电车",
      animeShotGrammar: ["结尾用大全景释放压力", "人物不拥抱，保留距离", "用细小动作收情绪"],
    },
  ];
}

function buildShotPrompt(basePrompt: string, shot: ScriptStoryboardShotInput): string {
  return [
    basePrompt,
    "",
    "LIVE SMOKE EXTRA RULES:",
    "Create ONE professional 16:9 storyboard reference image for this exact shot, not a poster and not final color key art.",
    "The image should feel like an original 1990s Japanese TV anime storyboard sheet: black-and-white pencil/ink line art, cel-animation planning marks, clear camera arrows if useful, clean panel borders only if useful.",
    "Use one dominant main composition that Seedance can read first. Add at most two tiny timing insets only if they clarify eye/hand/reaction beats. Do not pack the whole story into one page.",
    "Keep the start-frame logic: show the moment just before the main action fully happens. Avoid stiff neutral standing; show weight shift, hand tension, gaze direction, breath, and reaction.",
    "No dialogue text, captions, logos, watermarks, UI labels, brand marks, speech bubbles, or readable copyrighted names. Do not copy any existing anime character, robot, logo, organization, scene, or exact shot.",
    `Shot-specific camera grammar: ${shot.camera}`,
    `Shot-specific anime grammar: ${(shot.animeShotGrammar || []).join(" / ")}`,
  ].join("\n");
}

function buildAssetPlans(outputRoot: string): AssetPlan[] {
  const assetRoot = path.join(outputRoot, "assets", "locked-baselines");
  return [
    {
      id: "asset_character_mio",
      role: "character_identity",
      label: "澪 / Mio locked character reference",
      outputPath: path.join(assetRoot, "asset_character_mio.png"),
      prompt: [
        "Create a clean locked character reference sheet for an original 1990s Japanese TV anime heroine named Mio.",
        "2D hand-drawn cel anime design, not photorealistic, not 3D, not cosplay.",
        "Mio is a 16-year-old Japanese high-school girl with short straight black bob hair ending at the jawline, soft side bangs, expressive dark eyes, slim build, navy sailor uniform with white blouse, navy skirt, small red ribbon, black knee socks, simple school loafers.",
        "Show one full-body front view and one small side head/shoulder view on a plain light background. Keep identity clear and reusable for storyboard generation.",
        "No text, no labels, no logos, no watermarks, no speech bubbles, no copyrighted character resemblance.",
      ].join("\n"),
    },
    {
      id: "asset_character_ren",
      role: "character_identity",
      label: "律 / Ren locked character reference",
      outputPath: path.join(assetRoot, "asset_character_ren.png"),
      prompt: [
        "Create a clean locked character reference sheet for an original 1990s Japanese TV anime boy named Ren.",
        "2D hand-drawn cel anime design, not photorealistic, not 3D, not cosplay.",
        "Ren is a 17-year-old Japanese high-school boy with short messy black hair, narrow thoughtful eyes, lean build, slightly oversized white school shirt, loosened dark tie, dark trousers, worn sneakers.",
        "Show one full-body front view and one small side head/shoulder view on a plain light background. Keep identity clear and reusable for storyboard generation.",
        "No text, no labels, no logos, no watermarks, no speech bubbles, no copyrighted character resemblance.",
      ].join("\n"),
    },
    {
      id: "asset_scene_rooftop_tower",
      role: "scene_baseline",
      label: "雨后通信塔屋顶 / locked scene baseline",
      outputPath: path.join(assetRoot, "asset_scene_rooftop_tower.png"),
      prompt: [
        "Create a locked scene baseline image for an original 1990s Japanese TV anime setting: an abandoned rooftop communication tower after rain at blue hour.",
        "16:9 environmental reference, 2D hand-drawn anime background art, grayscale-blue rainy atmosphere, wet concrete, puddle reflections, metal fences, large old communication tower, distant Japanese city lights, low clouds.",
        "No characters. No text, labels, logos, signs, watermarks, UI marks, or readable writing. This image is only for environment, weather, time of day, and spatial anchors.",
      ].join("\n"),
    },
    {
      id: "asset_scene_control_room",
      role: "scene_baseline",
      label: "通信塔旧控制室 / locked scene baseline",
      outputPath: path.join(assetRoot, "asset_scene_control_room.png"),
      prompt: [
        "Create a locked scene baseline image for an original 1990s Japanese TV anime setting: an old communication tower control room after rain.",
        "16:9 environmental reference, 2D hand-drawn anime background art, CRT monitor, rusted control panels, cassette deck slot, cables, damp windows, rainy city and tower structure visible outside, cold screen glow mixed with dim sunset light.",
        "No characters. No text, labels, logos, signs, watermarks, UI marks, or readable writing. This image is only for environment, weather, time of day, and spatial anchors.",
      ].join("\n"),
    },
    {
      id: "asset_scene_tower_core",
      role: "scene_baseline",
      label: "塔心机房 / locked scene baseline",
      outputPath: path.join(assetRoot, "asset_scene_tower_core.png"),
      prompt: [
        "Create a locked scene baseline image for an original 1990s Japanese TV anime setting: the huge machine core hall inside an abandoned communication tower.",
        "16:9 environmental reference, 2D hand-drawn anime background art, enormous circular transmitter core in the center, wet industrial floor, thick black cables like rivers, high ceiling, weak emergency lights, deep shadows, quiet mechanical scale.",
        "No characters. No text, labels, logos, signs, watermarks, UI marks, or readable writing. This image is only for environment, weather, time of day, and spatial anchors.",
      ].join("\n"),
    },
    {
      id: "asset_prop_blue_cassette",
      role: "prop_reference",
      label: "蓝色透明旧磁带 / locked prop reference",
      outputPath: path.join(assetRoot, "asset_prop_blue_cassette.png"),
      prompt: [
        "Create a locked prop reference image for an original 1990s Japanese TV anime object: a transparent blue compact cassette tape.",
        "Clean hand-drawn anime prop reference, slightly worn plastic case, visible reels, small blank label with no readable writing, scale appropriate for a hand-held cassette.",
        "Plain light background. No text, no logos, no watermarks, no UI marks, no brand resemblance.",
      ].join("\n"),
    },
  ];
}

function referenceImageFor(filePath: string) {
  const bytes = readFileSync(filePath);
  return {
    name: path.basename(filePath),
    path: filePath,
    mimeType: inferMime(filePath),
    bytes,
    sha256: sha256(bytes),
  };
}

async function generateAsset(input: {
  plan: AssetPlan;
  outputRoot: string;
  runId: string;
  apiKey: string;
  baseUrl: string;
  model: string;
  size: string;
  quality: string;
  maxAutoRetries: number;
  timeoutMs: number;
}): Promise<GeneratedAsset> {
  const promptPath = path.join(input.outputRoot, "prompts", "assets", `${input.plan.id}.md`);
  const receiptPath = path.join(input.outputRoot, "receipts", "assets", `${input.plan.id}.json`);
  writeText(promptPath, input.plan.prompt);

  const attempts: Array<Record<string, unknown>> = [];
  let result: any;
  for (let attemptNumber = 1; attemptNumber <= input.maxAutoRetries + 1; attemptNumber += 1) {
    result = await fetchLanyiImageViaResponsesStream({
      apiKey: input.apiKey,
      baseUrl: input.baseUrl,
      model: input.model,
      prompt: input.plan.prompt,
      size: input.size,
      quality: input.quality,
      providerOperation: "responses.image_generation_real_storyboard_baseline_asset",
      timeoutMs: input.timeoutMs,
      referenceImages: [],
    });
    const rawSsePath = result.rawSseBytes
      ? path.join(input.outputRoot, "receipts", "sse", `${input.plan.id}-attempt-${attemptNumber}.sse.txt`)
      : "";
    if (result.rawSseBytes) writeText(rawSsePath, result.rawSseBytes);
    const retryable = retryableImage2Result(result);
    attempts.push({
      attemptNumber,
      ok: Boolean(result.ok),
      statusCode: result.statusCode,
      errorType: result.errorType,
      failureKind: result.failureKind,
      retryable,
      rawSsePath: packageRelative(input.outputRoot, rawSsePath),
      elapsedMs: result.providerResponseMetadata?.elapsedMs,
      returnedCount: result.providerResponseMetadata?.returnedCount,
    });
    if (result.ok || !retryable || attemptNumber === input.maxAutoRetries + 1) break;
    await sleep(5_000 * attemptNumber);
  }

  if (result?.ok) writeText(input.plan.outputPath, result.bytes);
  const outputSha256 = result?.ok ? sha256(result.bytes) : undefined;
  writeJson(receiptPath, {
    schemaVersion: "real_storyboard_baseline_asset_receipt_v1",
    runId: input.runId,
    assetId: input.plan.id,
    role: input.plan.role,
    label: input.plan.label,
    ok: Boolean(result?.ok),
    providerCalled: true,
    rawApiKeyStored: false,
    baseUrl: input.baseUrl,
    model: input.model,
    size: input.size,
    quality: input.quality,
    promptPath: packageRelative(input.outputRoot, promptPath),
    outputPath: result?.ok ? packageRelative(input.outputRoot, input.plan.outputPath) : undefined,
    outputSha256,
    attempts,
    providerRequestId: result?.providerRequestId,
    providerResponseMetadata: result?.providerResponseMetadata,
    failure: result?.ok ? undefined : {
      statusCode: result?.statusCode,
      errorType: result?.errorType,
      failureKind: result?.failureKind,
      message: result?.message,
      diagnostic: result?.diagnostic,
    },
  });
  return {
    id: input.plan.id,
    role: input.plan.role,
    label: input.plan.label,
    ok: Boolean(result?.ok),
    outputPath: result?.ok ? input.plan.outputPath : undefined,
    outputSha256,
    receiptPath,
    promptPath,
    errorMessage: result?.ok ? undefined : result?.message || result?.failureKind || "asset generation failed",
    attempts,
  };
}

function storyboardTableMarkdown(pack: ReturnType<typeof buildScriptStoryboardPromptPack>): string {
  const header = `| ${pack.tableColumns.join(" | ")} |`;
  const divider = `| ${pack.tableColumns.map(() => "---").join(" | ")} |`;
  const rows = pack.directorRows.map((row) => {
    return `| ${pack.tableColumns.map((column) => String(row[column]).replace(/\n/g, "<br>").replace(/\|/g, "｜")).join(" | ")} |`;
  });
  return [`# ${pack.title} 分镜表`, "", header, divider, ...rows, ""].join("\n");
}

const live = argFlag("--live");
const confirmLive = argValue("--confirm-live");
if (!live || confirmLive !== "submit-real-storyboard-image2-chain") {
  throw new Error("This script performs live Image2 calls. Pass --live --confirm-live=submit-real-storyboard-image2-chain.");
}

const createdAt = new Date().toISOString();
const runId = argValue("--run-id", `real-storyboard-image2-chain-${createdAt.replace(/[:.]/g, "-")}`);
const outputRoot = path.resolve(argValue("--output-root", path.join("real-test-sandbox", runId)));
const size = argValue("--size", "1280x720");
const quality = argValue("--quality", "standard");
const withBaselines = argFlag("--with-baselines");
const maxConcurrency = clampInteger(safeInteger(argValue("--max-concurrency", "3"), 3), 1, 10);
const maxAutoRetries = clampInteger(safeInteger(argValue("--max-auto-retries", "2"), 2), 0, 4);
const timeoutMs = clampInteger(safeInteger(argValue("--timeout-ms", String(10 * 60 * 1000)), 10 * 60 * 1000), 60_000, 30 * 60 * 1000);
const providerStatus = getProviderConfigStatuses().find((provider) => provider.providerId === "lanyi-image2");
const apiKey = getProviderApiKey("lanyi-image2");
if (!apiKey) throw new Error("Lanyi Image2 API key is not configured in local credentials or VIBE_IMAGE2_API_KEY.");
const baseUrl = argValue("--base-url", providerStatus?.baseUrl || "https://lanyiapi.com");
const model = argValue("--model", providerStatus?.imageModel || "gpt-image-2");

const title = "第七封未发送的信";
const logline = "雨后通信塔里，两个少年把失去的告白从“复活执念”改写成一次真正的告别。";
const completeScript = [
  "雨后黄昏，澪带着一盘旧磁带来到废弃通信塔。",
  "律在门后等她，试图阻止她启动塔心，因为第七封信可能会唤醒她一直不肯放下的人。",
  "两人在控制室、楼梯间和机房里争执。倒计时逼近时，澪终于明白自己不需要复活过去，只需要让那个人知道：他们收到了。",
  "她避开危险的启动键，按下发送键。黎明前，信号穿过云层，二人并肩看着城市亮起来。",
].join("\n");
const styleIntent = "原创 1990 年代日本 TV 动画心理科幻分镜感，借鉴早期日漫的留白、机械空间压迫、眼神/手部插入、关系远景和有限动画节奏；不复刻任何现成 IP。";
const storyboardKnowledgePack = buildStoryboardKnowledgePack(createdAt);
const availablePacks = ensureMinimumDefaultKnowledgePacks([storyboardKnowledgePack]);
const styleResearchPreflight = buildStyleResearchPreflight({
  projectId: safeId(runId),
  projectTitle: title,
  userIntent: "生成一个完整故事的十张分镜图，风格希望接近早期日本 TV 动画心理科幻分镜的感觉，但必须原创。",
  scriptText: completeScript,
  styleIntent,
  availablePacks,
  createdAt,
});

const storyboardOutputDir = path.join(outputRoot, "storyboards");
const videoOutputDir = path.join(outputRoot, "video-plans");
const assetPlans = withBaselines ? buildAssetPlans(outputRoot) : [];
const generatedAssets = withBaselines
  ? await runWithConcurrency(assetPlans, maxConcurrency, (plan) => generateAsset({
      plan,
      outputRoot,
      runId,
      apiKey,
      baseUrl,
      model,
      size,
      quality,
      maxAutoRetries,
      timeoutMs,
    }))
  : [];
const missingAssets = generatedAssets.filter((asset) => !asset.ok);
writeJson(path.join(outputRoot, "assets", "baseline-manifest.json"), {
  schemaVersion: "real_storyboard_baseline_manifest_v1",
  withBaselines,
  generatedAt: new Date().toISOString(),
  assets: generatedAssets.map((asset) => ({
    id: asset.id,
    role: asset.role,
    label: asset.label,
    ok: asset.ok,
    outputPath: packageRelative(outputRoot, asset.outputPath),
    outputSha256: asset.outputSha256,
    receiptPath: packageRelative(outputRoot, asset.receiptPath),
    promptPath: packageRelative(outputRoot, asset.promptPath),
    errorMessage: asset.errorMessage,
  })),
});
if (missingAssets.length) {
  throw new Error(`Baseline asset generation failed for ${missingAssets.map((asset) => asset.id).join(", ")}; refusing to generate storyboard references without locked baselines.`);
}
const lockedReferenceAssets = generatedAssets
  .filter((asset) => asset.ok && asset.outputPath)
  .map((asset) => ({
    id: asset.id,
    role: asset.role,
    path: asset.outputPath!,
    label: asset.label,
  }));
const pack = buildScriptStoryboardPromptPack({
  title,
  logline,
  completeScript,
  style: styleIntent,
  styleResearchPreflight,
  creativeBrief: {
    filmLikes: ["早期日本 TV 动画心理科幻的镜头留白", "雨后城市", "机械空间"],
    rhythmLikes: ["慢铺情绪", "必要处用手部和眼神短切", "不要广告感"],
    expressionLikes: ["动作前一拍", "听者反应", "负空间"],
    style: styleIntent,
    notes: "这次只生成分镜图，不生成最终视频。分镜图要能让后续视频模型读出构图、站位、动作方向和节奏。",
  },
  referenceBundle: {
    scenes: lockedReferenceAssets.filter((asset) => asset.role === "scene_baseline"),
    characters: lockedReferenceAssets.filter((asset) => asset.role === "character_identity"),
    props: lockedReferenceAssets.filter((asset) => asset.role === "prop_reference"),
    audio: [],
  },
  shots: buildShots(),
  storyboardOutputDir,
  videoOutputDir,
  image2OutputSize: size,
  seedanceModelVersion: "seedance-2.0",
  seedanceVideoResolution: "720p",
});

writeJson(path.join(outputRoot, "prompt-pack.json"), pack);
writeText(path.join(outputRoot, "storyboard-table.md"), storyboardTableMarkdown(pack));
writeJson(path.join(outputRoot, "style-research-preflight.json"), styleResearchPreflight);

async function generateShot(shot: (typeof pack.shots)[number], index: number): Promise<GeneratedStoryboard> {
  const shotPrompt = buildShotPrompt(String(shot.image2StoryboardPlan.prompt || ""), buildShots()[index]);
  const promptPath = path.join(outputRoot, "prompts", `${shot.shotId}.md`);
  const outputPath = path.join(storyboardOutputDir, `${shot.shotId}-${safeId(shot.title)}.png`);
  const receiptPath = path.join(outputRoot, "receipts", "image2", `${shot.shotId}.json`);
  const referenceImages = (shot.image2StoryboardPlan.references || [])
    .map((reference) => path.resolve(reference.path))
    .filter((filePath) => existsSync(filePath))
    .map((filePath) => ({
      ...referenceImageFor(filePath),
      role: shot.image2StoryboardPlan.references.find((reference) => path.resolve(reference.path) === filePath)?.role,
    }));
  writeText(promptPath, shotPrompt);

  const attempts: Array<Record<string, unknown>> = [];
  let result: any;
  const maxAttempts = maxAutoRetries + 1;
  for (let attemptNumber = 1; attemptNumber <= maxAttempts; attemptNumber += 1) {
    result = await fetchLanyiImageViaResponsesStream({
      apiKey,
      baseUrl,
      model,
      prompt: shotPrompt,
      size,
      quality,
      providerOperation: "responses.image_generation_real_storyboard_chain",
      timeoutMs,
      referenceImages,
    });
    const rawSsePath = result.rawSseBytes
      ? path.join(outputRoot, "receipts", "sse", `${shot.shotId}-attempt-${attemptNumber}.sse.txt`)
      : "";
    if (result.rawSseBytes) writeText(rawSsePath, result.rawSseBytes);
    const retryable = retryableImage2Result(result);
    attempts.push({
      attemptNumber,
      ok: Boolean(result.ok),
      statusCode: result.statusCode,
      errorType: result.errorType,
      failureKind: result.failureKind,
      retryable,
      rawSsePath: packageRelative(outputRoot, rawSsePath),
      elapsedMs: result.providerResponseMetadata?.elapsedMs,
      returnedCount: result.providerResponseMetadata?.returnedCount,
    });
    if (result.ok || !retryable || attemptNumber === maxAttempts) break;
    await sleep(5_000 * attemptNumber);
  }

  if (result?.ok) writeText(outputPath, result.bytes);
  const outputSha256 = result?.ok ? sha256(result.bytes) : undefined;
  const receipt = {
    schemaVersion: "real_storyboard_image2_chain_receipt_v1",
    runId,
    shotId: shot.shotId,
    title: shot.title,
    ok: Boolean(result?.ok),
    providerCalled: true,
    rawApiKeyStored: false,
    baseUrl,
    model,
    size,
    quality,
    maxConcurrency,
    maxAutoRetries,
    promptPath: packageRelative(outputRoot, promptPath),
    outputPath: result?.ok ? packageRelative(outputRoot, outputPath) : undefined,
    outputSha256,
    referenceCount: referenceImages.length,
    references: referenceImages.map((reference) => ({
      role: reference.role,
      path: packageRelative(outputRoot, reference.path),
      sha256: reference.sha256,
    })),
    attempts,
    providerRequestId: result?.providerRequestId,
    providerResponseMetadata: result?.providerResponseMetadata,
    failure: result?.ok ? undefined : {
      statusCode: result?.statusCode,
      errorType: result?.errorType,
      failureKind: result?.failureKind,
      message: result?.message,
      diagnostic: result?.diagnostic,
    },
  };
  writeJson(receiptPath, receipt);
  return {
    shotId: shot.shotId,
    title: shot.title,
    ok: Boolean(result?.ok),
    outputPath: result?.ok ? outputPath : undefined,
    receiptPath,
    promptPath,
    outputSha256,
    attempts,
    errorMessage: result?.ok ? undefined : result?.message || result?.failureKind || "storyboard generation failed",
  };
}

const results = await runWithConcurrency(pack.shots, maxConcurrency, generateShot);
const returned = results.filter((result) => result.ok);
const missing = results.filter((result) => !result.ok);
const report = {
  schemaVersion: "real_storyboard_image2_chain_report_v1",
  runId,
  title,
  createdAt,
  outputRoot,
  provider: {
    baseUrl,
    model,
    size,
    quality,
    maxConcurrency,
    maxAutoRetries,
    timeoutMs,
    providerCalled: true,
    rawApiKeyStored: false,
  },
  baselines: {
    enabled: withBaselines,
    total: generatedAssets.length,
    returned: generatedAssets.filter((asset) => asset.ok).length,
    missing: missingAssets.length,
    manifestPath: packageRelative(outputRoot, path.join(outputRoot, "assets", "baseline-manifest.json")),
    assets: generatedAssets.map((asset) => ({
      id: asset.id,
      role: asset.role,
      label: asset.label,
      ok: asset.ok,
      outputPath: packageRelative(outputRoot, asset.outputPath),
      outputSha256: asset.outputSha256,
    })),
  },
  counts: {
    total: results.length,
    returned: returned.length,
    missing: missing.length,
  },
  styleResearch: {
    preflightId: styleResearchPreflight.preflightId,
    status: styleResearchPreflight.status,
    contentCardTitles: styleResearchPreflight.contentCards.map((card) => card.title),
    warnings: styleResearchPreflight.warnings,
  },
  promptPackPath: packageRelative(outputRoot, path.join(outputRoot, "prompt-pack.json")),
  storyboardTablePath: packageRelative(outputRoot, path.join(outputRoot, "storyboard-table.md")),
  results: results.map((result) => ({
    ...result,
    outputPath: packageRelative(outputRoot, result.outputPath),
    receiptPath: packageRelative(outputRoot, result.receiptPath),
    promptPath: packageRelative(outputRoot, result.promptPath),
  })),
};
writeJson(path.join(outputRoot, "report", "report.json"), report);
writeText(path.join(outputRoot, "report", "summary.md"), [
  `# ${title} Image2 Storyboard Chain`,
  "",
  `- ok: ${missing.length === 0}`,
  `- returned: ${returned.length}/${results.length}`,
  `- model: ${model}`,
  `- size: ${size}`,
  `- quality: ${quality}`,
  `- maxConcurrency: ${maxConcurrency}`,
  `- baselines: ${withBaselines ? `${generatedAssets.filter((asset) => asset.ok).length}/${generatedAssets.length}` : "disabled"}`,
  `- raw_api_key_stored: false`,
  "",
  withBaselines ? "## Locked Baselines" : "",
  ...(withBaselines
    ? generatedAssets.map((asset) => `- ${asset.ok ? "OK" : "MISSING"} ${asset.id} ${asset.label}: ${packageRelative(outputRoot, asset.outputPath) || asset.errorMessage}`)
    : []),
  withBaselines ? "" : "",
  "## Storyboards",
  ...results.map((result) => `- ${result.ok ? "OK" : "MISSING"} ${result.shotId} ${result.title}: ${packageRelative(outputRoot, result.outputPath) || result.errorMessage}`),
  "",
].join("\n"));
writeText(path.join(outputRoot, "storyboard-gallery.md"), [
  `# ${title} 分镜图 Gallery`,
  "",
  ...results.flatMap((result) => [
    `## ${result.shotId} ${result.title}`,
    result.outputPath ? `![${result.shotId} ${result.title}](${packageRelative(outputRoot, result.outputPath)})` : `Missing: ${result.errorMessage}`,
    "",
  ]),
].join("\n"));

console.log(JSON.stringify({
  ok: missing.length === 0,
  runId,
  outputRoot,
  baselines: {
    enabled: withBaselines,
    returned: generatedAssets.filter((asset) => asset.ok).length,
    missing: missingAssets.length,
  },
  returned: returned.length,
  missing: missing.length,
  reportPath: path.join(outputRoot, "report", "report.json"),
  galleryPath: path.join(outputRoot, "storyboard-gallery.md"),
  storyboards: returned.map((result) => result.outputPath),
}, null, 2));
