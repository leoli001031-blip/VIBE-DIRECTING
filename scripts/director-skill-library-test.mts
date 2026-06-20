import {
  buildDirectorSkillCardFromShot,
  createDirectorSkillStackIndex,
  DIRECTOR_SKILL_CARD_SCHEMA_VERSION,
  DIRECTOR_SKILL_STACK_INDEX_PATH,
  DIRECTOR_SKILL_STACK_INDEX_SCHEMA_VERSION,
  directorSkillCardMarkdown,
  directorSkillFileName,
  parseDirectorSkillStackIndex,
  serializeDirectorSkillStackIndex,
  upsertDirectorSkillStackIndex,
  type DirectorSkillCategory,
} from "../src/core/directorSkillLibrary.ts";
import type { ShotRecord } from "../src/core/types.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function shot(input: Partial<ShotRecord> & Pick<ShotRecord, "id" | "title" | "storyFunction">): ShotRecord {
  return {
    id: input.id,
    actId: "act_1",
    title: input.title,
    storyFunction: input.storyFunction,
    status: "queued",
    gates: { identity: "UNKNOWN", scene: "UNKNOWN", pair: "UNKNOWN", story: "UNKNOWN", prop: "UNKNOWN", style: "UNKNOWN" },
    issues: [],
    ...input,
  };
}

const narrative = buildDirectorSkillCardFromShot(shot({
  id: "S01",
  title: "雨夜走廊停顿",
  storyFunction: "两个人在旧校舍走廊尽头沉默对视，情绪靠站位和停顿阅读。",
  referenceStrategy: "storyboard_narrative",
  durationSeconds: 6,
  executionMode: "relationship_wide",
  primaryAction: "女生停在门口没有继续走",
  actionTrigger: "男生问出迟来的道歉",
  microReaction: "她的手指松开伞柄",
  camera: "中远景建立两人距离，再轻微推近。",
  sceneGuidance: ["旧校舍雨夜走廊"],
  characterGuidance: ["两个高中生"],
}), { projectTitle: "雨夜短片" });

const rapid = buildDirectorSkillCardFromShot(shot({
  id: "S02",
  title: "山路双车启动",
  storyFunction: "便利店霓虹闪烁，两台车同时启动，轮胎溅水，车灯划过湿路。",
  referenceStrategy: "storyboard_rapid_cut",
  durationSeconds: 4,
  executionMode: "planned_cut_sequence",
  actionBeats: ["霓虹闪烁", "驾驶员踩下踏板", "轮胎溅水", "车灯划过弯道"],
  primaryAction: "两台车同时启动",
  actionTrigger: "霓虹灯闪了一下",
  microReaction: "车身下沉，雨雾被撕开",
  camera: "快切：霓虹、脚踏、轮胎、车灯。",
  sceneGuidance: ["山脚便利店雨夜"],
  propGuidance: ["两台整车"],
}));

const omni = buildDirectorSkillCardFromShot(shot({
  id: "S03",
  title: "发光车票",
  storyFunction: "旧书摊开的书页里露出一张发光车票，少女的指尖停住。",
  referenceStrategy: "omni_reference",
  durationSeconds: 4,
  executionMode: "action_insert",
  primaryAction: "少女发现车票",
  actionTrigger: "书页滑开",
  microReaction: "指尖收紧",
  camera: "俯拍书页，轻微推近。",
  sceneGuidance: ["清晨旧书店"],
  characterGuidance: ["戴耳机的高中女生"],
  propGuidance: ["旧书", "发光车票"],
}));

const cards = [narrative, rapid, omni];
const expectedCategories: Record<string, DirectorSkillCategory> = {
  故事板叙事: "镜头",
  故事板快切: "节奏",
  全能参考: "模型约束",
};

for (const card of cards) {
  assert(card.schemaVersion === DIRECTOR_SKILL_CARD_SCHEMA_VERSION, `${card.name} schema mismatch`);
  assert(card.id.length > 6, `${card.name} should have stable id`);
  assert(card.category === expectedCategories[card.name], `${card.name} category mismatch`);
  assert(card.useWhen.length >= 2, `${card.name} should explain when to use`);
  assert(card.avoidWhen.length >= 2, `${card.name} should explain when to avoid`);
  assert(card.appliesTo.includes("故事规划"), `${card.name} should affect story planning`);
  assert(card.appliesTo.includes("QA"), `${card.name} should affect QA`);
  assert(card.rules.length >= 4, `${card.name} should expose reusable rules`);
  assert(card.example.includes(card.createdFrom?.shotTitle || ""), `${card.name} example should cite source shot`);

  const fileName = directorSkillFileName(card);
  assert(/\.md$/.test(fileName), `${card.name} file name should be markdown`);
  assert(!/[\\/:"*?<>|]/.test(fileName), `${card.name} file name should be safe`);

  const markdown = directorSkillCardMarkdown(card);
  assert(markdown.includes(`schemaVersion: ${DIRECTOR_SKILL_CARD_SCHEMA_VERSION}`), `${card.name} markdown should carry schema`);
  assert(markdown.includes("## 什么时候用"), `${card.name} markdown should include useWhen`);
  assert(markdown.includes("## 什么时候别用"), `${card.name} markdown should include avoidWhen`);
  assert(markdown.includes("## 核心规则"), `${card.name} markdown should include rules`);
}

assert(rapid.rules.some((rule) => /车灯|轮胎|部件|父主体/.test(rule)), "rapid-cut skill should preserve asset granularity rules");
assert(omni.rules.some((rule) => /不生成故事板|直接使用/.test(rule)), "omni skill should say it does not create storyboard noise");
assert(narrative.createdFrom?.projectTitle === "雨夜短片", "skill card should keep project snapshot metadata");
assert(DIRECTOR_SKILL_STACK_INDEX_PATH === "skills/skill-index.json", "Skill stack index should live under project skills folder");

const firstIndex = upsertDirectorSkillStackIndex(createDirectorSkillStackIndex([]), {
  card: narrative,
  fileName: directorSkillFileName(narrative),
  savedAt: "2026-06-18T01:00:00.000Z",
});
const secondIndex = upsertDirectorSkillStackIndex(firstIndex, {
  card: rapid,
  fileName: directorSkillFileName(rapid),
  savedAt: "2026-06-18T02:00:00.000Z",
});
const updatedIndex = upsertDirectorSkillStackIndex(secondIndex, {
  card: narrative,
  fileName: directorSkillFileName(narrative),
  savedAt: "2026-06-18T03:00:00.000Z",
});
assert(updatedIndex.schemaVersion === DIRECTOR_SKILL_STACK_INDEX_SCHEMA_VERSION, "Skill stack index schema mismatch");
assert(updatedIndex.skills.length === 2, "Skill stack index should upsert by skill id");
assert(updatedIndex.skills[0]?.id === narrative.id, "recently saved Skill should sort first");
assert(updatedIndex.skills[0]?.fileName === directorSkillFileName(narrative), "Skill stack item should keep markdown file name");
assert(updatedIndex.skills[0]?.createdFrom?.strategy === "storyboard_narrative", "Skill stack item should keep source strategy");

const parsedIndex = parseDirectorSkillStackIndex(serializeDirectorSkillStackIndex(updatedIndex));
assert(parsedIndex.skills.length === 2, "serialized Skill stack index should parse back");
assert(parsedIndex.skills[1]?.name === rapid.name, "parsed Skill stack index should preserve saved cards");
assert(parseDirectorSkillStackIndex("{bad json").skills.length === 0, "broken Skill stack index should degrade to empty");

console.log(`director-skill-library-test: cards=${cards.map((card) => `${card.name}:${directorSkillFileName(card)}`).join(", ")}`);
