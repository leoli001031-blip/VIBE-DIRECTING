export type ReferenceAssetType = "character" | "scene" | "prop";

export type ReferenceAssetBucket =
  | "standalone"
  | "object_constraint"
  | "scene_constraint"
  | "character_constraint"
  | "shot_detail"
  | "ignored";

export interface ReferenceAssetClassification {
  bucket: ReferenceAssetBucket;
  reason: string;
  normalizedText: string;
}

export interface ReferenceConstraintBuckets {
  standalone: string[];
  objectConstraints: string[];
  sceneConstraints: string[];
  characterConstraints: string[];
  shotDetails: string[];
  ignoredDetails: string[];
}

function clean(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function compact(value: unknown): string {
  return clean(value).toLowerCase().replace(/\s+/g, "");
}

function uniqueStrings(values: unknown[]): string[] {
  return [...new Set(values.map(clean).filter(Boolean))];
}

const characterControllerPattern =
  /(?:跑车|汽车|车辆|赛车|车|机甲|机器人|飞船|船|飞机|战机|坦克|SU7|Xiaomi|小米|Porsche|保时捷|GT3|911|car|vehicle|mecha|robot|spaceship|ship|aircraft).{0,8}(?:驾驶者|驾驶员|司机|车手|操作者|操作员|controller|driver|pilot|operator)$/i;

const exactCharacterControllerPattern =
  /^(?:白色|黑色|红色|蓝色|银色|黄色|绿色|圆形|小型|大型)?(?:跑车|汽车|车辆|赛车|车|机甲|机器人|飞船|船|飞机|战机|坦克)(?:驾驶者|驾驶员|司机|车手|操作者|操作员)$/u;

const functionalVehicleCharacterPattern =
  /^(?:白车|黑车|红车|蓝车|银车|黄车|绿车|white\s*car|black\s*car|red\s*car|blue\s*car)\s*(?:车手|司机|驾驶员|驾驶者|racer|driver)$/iu;

const contextPlaceholderPattern =
  /^(?:同上|同前|同场景|同一地点|同一场景|上一镜|上一镜头|前一镜|前一镜头|same|same as above|same scene)$/iu;

const vehicleObjectPattern =
  /跑车|汽车|车辆|赛车|双门车|SU7|Xiaomi|小米|Porsche|保时捷|GT3|911|(?:^|[\s_-])(?:car|vehicle)(?:$|[\s_-])/i;

const bodyOrPerformanceDetailPattern =
  /(?:^|[\s'_-])(?:hand|hands|finger|fingers|fingertips|eyes?|gaze|eyeline|face|facial expression|hair|feet|foot|profile|shoulders?|sleeves?|breath|blink|mouth|lips|posture|gesture)(?:$|[\s'_-])|(?:的)?(?:手|手指|指尖|眼睛|眼神|视线|脸部|面部|脸|表情|头发|发丝|脚|脚步|背影|侧脸|肩|肩膀|衣袖|袖口|呼吸|眨眼|嘴唇|姿态|手势)$/i;

const sceneStateDetailPattern =
  /^(?:清晨|早晨|白天|中午|下午|傍晚|黄昏|深夜|夜晚|黎明)$|积水|水坑|水洼|水迹|湿路|路面|地面|路肩|远山|山体|山林|山影|山轮廓|天空|天光|天色|地平线|云层|云朵|雨雾|雨线|雾|薄雾|烟尘|灰尘|天气|光线|色温|晨光|夕阳|微白|霓虹|灯牌|反光|倒影|水花|水面|护栏|弯道|树影|路灯|阴影|高光|订单高峰感|atmosphere|mist|fog|rain|weather|road surface|reflection|reflections?|sky|cloud|haze|dust|neon|signage|streetlight|shadow|highlight|lighting|color temperature/i;

const standaloneSignObjectPattern =
  /招牌|霓虹招牌|霓虹灯牌|neon\s*sign/i;

const sceneLocationSubjectPattern =
  /咖啡园|咖啡馆|咖啡店|书店|图书馆|学校|天台|屋顶|便利店|山路|山脊|公路|街道|巷|庭院|车内|驾驶席|室内|门口|吧台|舞台|剧院|车站|站台|房间|教室|走廊|rooftop|bookstore|cafe|coffee\s*shop|school|station|platform|courtyard|theater|street|road|room|interior/i;

const objectSpatialScenePattern =
  /(?:竹篮|咖啡豆堆|咖啡豆|拿铁杯|杯|旧书|书页|车票|磁带盒|手机|车|跑车|书桌|桌|道具|物件)(?:里|内|中|旁|边|前|后|附近|周围|上方|下方)|(?:里|内|中|旁|边|前|后|附近|周围|上方|下方).*(?:竹篮|咖啡豆堆|咖啡豆|拿铁杯|杯|旧书|书页|车票|磁带盒|手机|车|跑车|书桌|桌|道具|物件)/i;

const objectComponentDetailPattern =
  /车灯|尾灯|大灯|轮胎|车轮|油门|刹车|踏板|方向盘|仪表|后视镜|车窗|雨刷|引擎|发动机|排气|车门|车牌|书页|封面|书脊|书架|门把|门锁|窗户|橱窗|玻璃窗|楼层灯|电梯镜面|琴键|琴槌|乐谱架|烘焙机观察窗|筛网区域|屏幕|按钮|按键|镜头|表盘|枪口|扳机|刀刃|剑柄|肩带|拉链|手套|杯盖|瓶盖|轮廓边|headlights?|taillights?|tires?|wheels?|steering|dashboard|pedal|doors?|windows?|wipers?|engine|exhaust|license plate|page|cover|spine|bookshelf|shelf|window|display window|door handle|mirror|piano keys?|hammer|screen|button|keypad|lens|dial|trigger|barrel|blade|handle|strap|zipper|gloves?/i;

const parentObjectPattern =
  /跑车|汽车|车辆|赛车|车|SU7|Xiaomi|小米|Porsche|保时捷|GT3|911|书|旧书|车票|票|磁带|盒|箱|招牌|霓虹招牌|手机|相机|枪|刀|剑|扇|伞|包|杯|瓶|钥匙|机器人|机甲|道具|物件|car|vehicle|book|ticket|cassette|phone|camera|gun|sword|fan|umbrella|bag|cup|bottle|key|robot|mecha|sign|toolbox|prop|object/i;

const heroObjectPattern =
  /跑车|汽车|车辆|赛车|双门车|车\b|SU7|Xiaomi|小米|Porsche|保时捷|GT3|911|机器人|机甲|咖啡豆|咖啡果|吉祥物|玩偶|产品|主物件|hero\s*object|mascot|product|robot|mecha|car|vehicle/i;

const actionToolDetailPattern =
  /^(?:梯子|钳子|胶带|电线|电缆|线头|扳手|螺丝刀|螺丝|剪刀|锤子|手电|手电筒|踏板|电火花|检修盒|检修口|配电盒)$/u;

export function isVehicleControllerLabel(value: unknown): boolean {
  const text = clean(value);
  if (functionalVehicleCharacterPattern.test(text)) return false;
  return characterControllerPattern.test(text) || exactCharacterControllerPattern.test(text);
}

export function isVehicleObjectReference(value: unknown): boolean {
  const text = clean(value);
  if (!text || isVehicleControllerLabel(text) || isObjectComponentDetailReference(text)) return false;
  return vehicleObjectPattern.test(` ${text} `);
}

export function isBodyPartOrShotDetailReference(value: unknown): boolean {
  const text = clean(value);
  if (functionalVehicleCharacterPattern.test(text)) return false;
  return bodyOrPerformanceDetailPattern.test(text);
}

export function isSceneDetailReference(value: unknown): boolean {
  const text = clean(value);
  return sceneStateDetailPattern.test(text) && !standaloneSignObjectPattern.test(text);
}

export function isObjectComponentDetailReference(value: unknown): boolean {
  const text = clean(value);
  return objectComponentDetailPattern.test(text) || actionToolDetailPattern.test(text);
}

export function isVehicleDetailReference(value: unknown): boolean {
  return isObjectComponentDetailReference(value);
}

export function isParentObjectReference(value: unknown): boolean {
  const text = clean(value);
  if (!text) return false;
  return parentObjectPattern.test(text) && !isObjectComponentDetailReference(text);
}

export function isHeroObjectReference(value: unknown): boolean {
  const text = clean(value);
  if (!text || isObjectComponentDetailReference(text) || isVehicleControllerLabel(text)) return false;
  return heroObjectPattern.test(text);
}

export function isVehiclePropReference(value: unknown): boolean {
  return isParentObjectReference(value);
}

export function classifyReferenceAssetText(value: unknown, requestedType?: ReferenceAssetType): ReferenceAssetClassification {
  const text = clean(value);
  const normalizedText = compact(text);
  if (!text) return { bucket: "ignored", reason: "empty_reference_text", normalizedText };
  if (contextPlaceholderPattern.test(text)) {
    return { bucket: "ignored", reason: "context_placeholder_not_reference_subject", normalizedText };
  }
  if (isVehicleControllerLabel(text)) {
    return { bucket: "ignored", reason: "controller_label_is_not_character_identity", normalizedText };
  }
  if (requestedType === "character" && isVehicleObjectReference(text)) {
    return { bucket: "object_constraint", reason: "vehicle_object_should_be_prop_reference", normalizedText };
  }
  if (requestedType === "scene" && isVehicleObjectReference(text)) {
    return { bucket: "object_constraint", reason: "vehicle_object_should_not_be_scene_reference", normalizedText };
  }
  if (requestedType === "scene" && standaloneSignObjectPattern.test(text) && /闪|亮|熄|反光|flicker|glow|light/i.test(text)) {
    return { bucket: "scene_constraint", reason: "sign_state_belongs_to_scene_baseline", normalizedText };
  }
  if (requestedType === "scene" && sceneLocationSubjectPattern.test(text)) {
    return { bucket: "standalone", reason: "independent_scene_baseline_subject", normalizedText };
  }
  if (requestedType === "scene" && objectSpatialScenePattern.test(text)) {
    return { bucket: "scene_constraint", reason: "object_relative_area_belongs_to_parent_scene", normalizedText };
  }
  if (isSceneDetailReference(text)) {
    return { bucket: "scene_constraint", reason: "environment_state_belongs_to_scene_baseline", normalizedText };
  }
  if (isBodyPartOrShotDetailReference(text)) {
    return { bucket: "character_constraint", reason: "body_or_performance_detail_belongs_to_character_or_shot", normalizedText };
  }
  if (isObjectComponentDetailReference(text)) {
    return { bucket: "object_constraint", reason: "component_detail_belongs_to_parent_object", normalizedText };
  }
  return { bucket: "standalone", reason: "independent_reference_subject", normalizedText };
}

export function isStandalonePropReference(value: unknown): boolean {
  return classifyReferenceAssetText(value).bucket === "standalone";
}

export function referenceConstraintBuckets(values: unknown[]): ReferenceConstraintBuckets {
  const buckets: ReferenceConstraintBuckets = {
    standalone: [],
    objectConstraints: [],
    sceneConstraints: [],
    characterConstraints: [],
    shotDetails: [],
    ignoredDetails: [],
  };
  for (const value of uniqueStrings(values)) {
    const classification = classifyReferenceAssetText(value);
    if (classification.bucket === "standalone") buckets.standalone.push(value);
    else if (classification.bucket === "object_constraint") buckets.objectConstraints.push(value);
    else if (classification.bucket === "scene_constraint") buckets.sceneConstraints.push(value);
    else if (classification.bucket === "character_constraint") buckets.characterConstraints.push(value);
    else if (classification.bucket === "shot_detail") buckets.shotDetails.push(value);
    else buckets.ignoredDetails.push(value);
  }
  return buckets;
}

export function referenceAssetCandidates(values: unknown[], type: ReferenceAssetType): string[] {
  const candidates = uniqueStrings(values);
  if (type === "scene") {
    return candidates.filter((candidate) => classifyReferenceAssetText(candidate, "scene").bucket === "standalone");
  }
  if (type === "character") {
    return candidates.filter((candidate) => {
      const classification = classifyReferenceAssetText(candidate, "character");
      return classification.bucket !== "character_constraint"
        && classification.bucket !== "scene_constraint"
        && classification.bucket !== "object_constraint"
        && classification.bucket !== "ignored";
    });
  }
  return referenceConstraintBuckets(candidates).standalone;
}
