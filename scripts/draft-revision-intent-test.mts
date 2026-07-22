import assert from "node:assert/strict";
import {
  buildDraftRevisionPreview,
  parseDraftRevisionIntent,
} from "../src/core/draftRevisionIntent";

const selectedAction = parseDraftRevisionIntent({
  text: "这个镜头只改动作：他擦完窗后停一下，不要让倒影立刻消失。先形成修改确认。",
  shotCount: 2,
  selectedShotNumber: 1,
});
assert(selectedAction, "selected-shot action revision should parse");
assert.equal(selectedAction.items.length, 1);
assert.equal(selectedAction.items[0]?.targetKind, "selected");
assert.equal(selectedAction.items[0]?.shotNumber, 1);
assert.equal(selectedAction.items[0]?.operation, "revise");
assert.equal(selectedAction.items[0]?.actionOnly, true);
assert.deepEqual(selectedAction.items[0]?.removalTargets, []);
assert.equal(selectedAction.items[0]?.revisionText, "他擦完窗后停一下，不要让倒影立刻消失");
assert.equal(
  buildDraftRevisionPreview(selectedAction).changeFact,
  "他擦完窗后停一下，不要让倒影立刻消失",
  "temporal negative wording must not be previewed as content deletion",
);

const visibilityConstraint = parseDraftRevisionIntent({
  text: "最后一镜月亮不要完整出现，只留一点冷光。",
  shotCount: 2,
});
assert(visibilityConstraint, "visibility constraint should parse as a revision");
assert.equal(visibilityConstraint.items[0]?.operation, "revise");
assert.deepEqual(visibilityConstraint.items[0]?.removalTargets, []);

const removal = parseDraftRevisionIntent({
  text: "最后一镜不要怀表。",
  shotCount: 3,
});
assert(removal, "known content removal should parse");
assert.equal(removal.items[0]?.operation, "remove_content");
assert.deepEqual(removal.items[0]?.removalTargets, ["怀表"]);
assert.equal(buildDraftRevisionPreview(removal).changeFact, "去掉怀表");

const mixedRemoval = parseDraftRevisionIntent({
  text: "最后一镜去掉月亮，动作改成海浪拍过空站台。",
  shotCount: 3,
});
assert(mixedRemoval, "mixed removal and replacement should parse");
assert.equal(mixedRemoval.items[0]?.operation, "revise");
assert.deepEqual(mixedRemoval.items[0]?.removalTargets, ["月亮"]);
assert.equal(mixedRemoval.items[0]?.revisionText, "动作改成海浪拍过空站台");
assert.equal(buildDraftRevisionPreview(mixedRemoval).changeFact, "去掉月亮，并动作改成海浪拍过空站台");

const sceneMove = parseDraftRevisionIntent({
  text: "这个镜头只改场景不要改动作，场景改到雨夜公交站。",
  shotCount: 2,
  selectedShotNumber: 2,
});
assert(sceneMove, "selected-shot scene revision should parse");
assert.equal(sceneMove.items[0]?.operation, "move_scene");
assert.equal(sceneMove.items[0]?.preserveAction, true);
assert.equal(sceneMove.items[0]?.revisionText, "雨夜公交站");

const multiTarget = parseDraftRevisionIntent({
  text: "海边不要完整出现，只在第二镜以蓝色反光扫过衣服；最后保留她把火柴收回口袋，不加旁白。先形成修改确认。",
  shotCount: 3,
});
assert(multiTarget, "two-target revision should parse");
assert.equal(multiTarget.multiTarget, true);
assert.deepEqual(multiTarget.items.map((item) => item.shotNumber), [2, 3]);
assert.equal(multiTarget.items[0]?.operation, "revise");
assert.deepEqual(multiTarget.items[0]?.removalTargets, []);
assert.match(multiTarget.items[0]?.revisionText || "", /海边不要完整出现/);
assert.equal(multiTarget.items[1]?.operation, "preserve_target");

const protectedEnding = parseDraftRevisionIntent({
  text: "保留老人、透明鱼和用菜篮挡光的动作；不要新增童年闪回，结尾停在水洼只剩天空倒影。仍然不保存也不生成。",
  shotCount: 2,
});
assert(protectedEnding, "tail ending with a protected action should parse");
assert.equal(protectedEnding.items[0]?.targetKind, "tail");
assert.equal(protectedEnding.items[0]?.protectedAction, "用菜篮挡光");
assert.equal(protectedEnding.items[0]?.revisionText, "水洼只剩天空倒影");

assert.equal(parseDraftRevisionIntent({ text: "整体更克制一点", shotCount: 2 }), undefined);

console.log("draft-revision-intent-test: preview and execution semantics share one structured parser.");
