import {
  classifyReferenceAssetText,
  isHeroObjectReference,
  isParentObjectReference,
  isStandalonePropReference,
  isVehicleControllerLabel,
  isVehicleObjectReference,
  referenceAssetCandidates,
  referenceConstraintBuckets,
} from "../src/core/referenceAssetStrategy.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function bucket(value: string): string {
  return classifyReferenceAssetText(value).bucket;
}

assert(bucket("白色跑车") === "standalone", "whole car should stay a standalone prop/reference subject");
assert(bucket("发光车票") === "standalone", "ticket should stay a standalone prop/reference subject");
assert(bucket("蓝色磁带盒") === "standalone", "cassette case should stay a standalone prop/reference subject");
assert(bucket("旧书") === "standalone", "book should stay a standalone prop/reference subject");
assert(bucket("云南红色咖啡果") === "standalone", "Yunnan coffee fruit should not be misread as cloud/weather just because it contains 云");
assert(bucket("霓虹招牌") === "standalone", "neon sign should stay a reusable parent prop, not collapse into neon lighting");

assert(bucket("车灯") === "object_constraint", "headlights should become parent-object constraints");
assert(bucket("轮胎") === "object_constraint", "tires should become parent-object constraints");
assert(bucket("书页") === "object_constraint", "book pages should become parent-object constraints");
assert(bucket("手机屏幕") === "object_constraint", "screens should become parent-object constraints");
assert(bucket("手套") === "object_constraint", "gloves should stay a character/action detail unless explicitly promoted");
assert(bucket("书架") === "object_constraint", "bookshelves should stay as scene/object constraints instead of standalone prop assets");
assert(bucket("门把") === "object_constraint", "door handles should belong to the parent door/scene");
assert(bucket("琴键") === "object_constraint", "piano keys should belong to the parent piano");
assert(bucket("琴槌") === "object_constraint", "piano hammers should belong to the parent piano");
assert(bucket("烘焙机观察窗") === "object_constraint", "machine windows should belong to the parent machine");
assert(bucket("梯子") === "object_constraint", "repair ladder should stay an action/object constraint");
assert(bucket("钳子") === "object_constraint", "repair pliers should stay an action/object constraint");
assert(bucket("电线") === "object_constraint", "wires should stay an action/object constraint");
assert(bucket("检修盒") === "object_constraint", "repair hatch/box should stay part of the sign/action setup");

assert(bucket("湿路") === "scene_constraint", "wet road should belong to scene baseline");
assert(bucket("雨雾") === "scene_constraint", "mist/rain should belong to scene baseline");
assert(bucket("天空") === "scene_constraint", "sky should belong to scene baseline");
assert(bucket("霓虹反光") === "scene_constraint", "neon reflection should belong to scene baseline");
assert(bucket("积水") === "scene_constraint", "puddles should belong to scene baseline");
assert(bucket("天光") === "scene_constraint", "sky glow should belong to scene baseline");
assert(bucket("天色微白") === "scene_constraint", "sky brightness state should belong to scene baseline");
assert(bucket("远山轮廓") === "scene_constraint", "distant mountain silhouette should belong to scene baseline");
assert(bucket("路肩") === "scene_constraint", "road shoulder should belong to scene baseline, not a body shoulder");

assert(bucket("手指") === "character_constraint", "fingers should not become a standalone prop image");
assert(bucket("眼神") === "character_constraint", "gaze should not become a standalone prop image");
assert(bucket("嘴唇") === "character_constraint", "lips should not become a standalone prop image");

assert(isStandalonePropReference("白色跑车"), "whole object should be uploadable as prop reference");
assert(!isStandalonePropReference("车灯"), "object component should not be uploadable as standalone prop reference");
assert(!isStandalonePropReference("梯子"), "action repair detail should not be uploadable as standalone prop reference");
assert(!isStandalonePropReference("电线"), "wire detail should not be uploadable as standalone prop reference");
assert(!isStandalonePropReference("检修盒"), "repair hatch should not be uploadable as standalone prop reference");
assert(!isStandalonePropReference("湿路"), "scene detail should not be uploadable as standalone prop reference");
assert(!isStandalonePropReference("手"), "body detail should not be uploadable as standalone prop reference");
assert(isParentObjectReference("白色跑车"), "car should be recognized as parent object");
assert(isParentObjectReference("旧书"), "book should be recognized as parent object");
assert(isHeroObjectReference("白色双门车"), "whole vehicles should be recognized as hero objects");
assert(isHeroObjectReference("云南红色咖啡果"), "mascot-like object protagonists should be recognized as hero objects");
assert(!isHeroObjectReference("车灯"), "vehicle components should not become hero objects");

assert(isVehicleControllerLabel("白色跑车驾驶者"), "over-specific vehicle-controller labels should be detected");
assert(!isVehicleControllerLabel("白车车手"), "functional race character labels should remain real character identities");
assert(isVehicleObjectReference("白色双门车"), "whole vehicle object should be moved out of character references");
assert(classifyReferenceAssetText("白色双门车", "character").bucket === "object_constraint", "vehicle in character field should be treated as an object constraint");
assert(classifyReferenceAssetText("白色双门车", "scene").bucket === "object_constraint", "vehicle in scene field should not become a scene reference");
assert(classifyReferenceAssetText("同上", "scene").bucket === "ignored", "context placeholders should never become reference assets");
assert(classifyReferenceAssetText("霓虹灯牌闪烁", "scene").bucket === "scene_constraint", "sign flicker should remain a scene/action constraint when it appears in the scene field");
assert(classifyReferenceAssetText("竹篮内", "scene").bucket === "scene_constraint", "object-relative areas should not become standalone scene references");
assert(classifyReferenceAssetText("拿铁杯旁", "scene").bucket === "scene_constraint", "prop-relative areas should remain scene constraints");
assert(classifyReferenceAssetText("云南高原咖啡园", "scene").bucket === "standalone", "location scenes with 云南 should remain scene baseline subjects");
assert(classifyReferenceAssetText("云南高原咖啡园竹篮里", "scene").bucket === "standalone", "scene labels with a real location plus local prop context should stay usable as scene baselines");
assert(classifyReferenceAssetText("城市咖啡馆内靠窗桌位", "scene").bucket === "standalone", "interior location labels should stay scene baselines even when they mention a table area");
assert(classifyReferenceAssetText("雨后凌晨山脊", "scene").bucket === "standalone", "mountain ridge locations should remain scene baseline subjects");
assert(classifyReferenceAssetText("清晨", "scene").bucket === "scene_constraint", "time of day alone should be a scene constraint, not a scene asset");
assert(!referenceAssetCandidates(["白色跑车驾驶者", "短发少女", "眼神"], "character").includes("白色跑车驾驶者"), "vehicle controller should not become character reference");
assert(referenceAssetCandidates(["白色跑车驾驶者", "白车车手", "黑车车手", "短发少女", "白色双门车", "眼神"], "character").join("|") === "白车车手|黑车车手|短发少女", "functional driver roles and real character identities should remain");
assert(referenceAssetCandidates(["云南高原咖啡园", "清晨", "温暖城市咖啡馆内"], "scene").join("|") === "云南高原咖啡园|温暖城市咖啡馆内", "scene reference candidates should keep locations and drop time-only details");
assert(referenceAssetCandidates(["山脚便利店", "同上", "白色双门车"], "scene").join("|") === "山脚便利店", "scene candidates should drop placeholders and vehicle objects");

const buckets = referenceConstraintBuckets(["车灯", "湿路", "白色跑车", "手指", "发光车票", "天空", "手机屏幕", "梯子", "电线", "检修盒"]);
assert(buckets.standalone.join("|") === "白色跑车|发光车票", "standalone bucket mismatch");
assert(buckets.objectConstraints.join("|") === "车灯|手机屏幕|梯子|电线|检修盒", "object constraint bucket mismatch");
assert(buckets.sceneConstraints.join("|") === "湿路|天空", "scene constraint bucket mismatch");
assert(buckets.characterConstraints.join("|") === "手指", "character constraint bucket mismatch");

console.log("reference-asset-strategy-test: ok");
