import type {
  KeyframePairDerivation,
  MotionBodyMechanics,
  MotionEndpointContract,
  MotionEndpointContractStatus,
  MotionEndpointRegion,
  MotionPoseRequirement,
  MotionType,
  ShotRecord,
} from "./types";

export const motionEndpointContractSchemaVersion = "0.1.0";

const endFrameRequiredMotionTypes: ReadonlySet<MotionType> = new Set([
  "locomotion",
  "object_interaction",
  "camera_move",
  "reveal_or_occlusion",
  "transform_or_state_change",
]);

const bodyMechanicsRequiredMotionTypes: ReadonlySet<MotionType> = new Set([
  "locomotion",
  "object_interaction",
  "pose_change_in_place",
]);

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function hasAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

export function classifyMotionType(text: string): MotionType {
  const normalized = normalizeText(text);
  if (!normalized) return "static_hold";

  if (
    hasAny(normalized, [
      /\b(blink|breath(?:e|ing)?|micro[- ]?expression|subtle smile|eye movement|lip tremble)\b/,
      /微表情|呼吸|眨眼|眼神|轻微笑|嘴角|细微/,
    ])
  ) {
    return "micro_expression";
  }

  if (
    hasAny(normalized, [
      /\b(reveal|reveals|occlud(?:e|es|ed|ing)|occlusion|hide|hides|hidden|emerge|emerges|uncover)\b/,
      /揭示|显现|遮挡|遮住|遮蔽|露出|出现|隐藏/,
    ])
  ) {
    return "reveal_or_occlusion";
  }

  if (
    hasAny(normalized, [
      /\b(transform|transforms|morph|morphs|state change|turns into|becomes|melt|melts|break|breaks|shatter)\b/,
      /变形|转变|状态变化|融化|破碎|碎裂|变成/,
    ])
  ) {
    return "transform_or_state_change";
  }

  if (
    hasAny(normalized, [
      /\b(walk|walks|walking|run|runs|running|step|steps|stride|strides|cross|crosses|enter|enters|exit|exits|leave|leaves|locomotion)\b/,
      /走|跑|步行|迈步|跨步|穿过|进入|离开|移动到/,
    ])
  ) {
    return "locomotion";
  }

  if (
    hasAny(normalized, [
      /\b(grab|grabs|pick up|picks up|hold|holds|touch|touches|pour|pours|hand(?:s)? over|point|points|pointing|finger|fingers|interact|prop)\b/,
      /\b(?:open|opens|opened|opening|close|closes|closed|closing)\s+(?:door|gate|handle|lid|box|drawer|window)\b/,
      /\b(?:door|gate|lid|drawer|window)\s+(?:open|opens|opened|opening|close|closes|closed|closing)\b/,
      /拿起|抓住|握住|触碰|打开|关闭|倒入|递给|指向|手指|交互|道具/,
    ])
  ) {
    return "object_interaction";
  }

  if (
    hasAny(normalized, [
      /\b(pose change|changes pose|turn|turns|lean|leans|sit|sits|stand|stands|raise hand|raises hand|head (?:tilt|tilts|turn|turns|lift|lifts|raise|raises)|chin|eye line|gaze shift|gesture)\b/,
      /姿态|转身|倾斜|坐下|站起|举手|抬手|抬头|转头|眼神|视线|动作变化|手势/,
    ])
  ) {
    return "pose_change_in_place";
  }

  if (
    hasAny(normalized, [
      /\b(dolly|pan|tilt|truck|crane|orbit|zoom|push in|pull back|camera move|camera moves|handheld|tracking shot)\b/,
      /运镜|推镜|拉镜|摇镜|移镜|镜头移动|跟拍|环绕|变焦/,
    ])
  ) {
    return "camera_move";
  }

  if (hasAny(normalized, [/\b(reframe|reframes|recompose|recomposes|frame adjustment|crop adjustment)\b/, /重新构图|调整构图|改构图/])) {
    return "camera_reframe";
  }

  return "static_hold";
}

export function endFrameRequiredForMotionType(type: MotionType): boolean {
  return endFrameRequiredMotionTypes.has(type);
}

export interface BuildMotionEndpointContractInput {
  generatedAt: string;
  shot: ShotRecord;
  keyframePair?: KeyframePairDerivation;
}

function unique(items: string[]): string[] {
  return Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)));
}

function shotText(shot: ShotRecord, keyframePair?: KeyframePairDerivation): string {
  return unique([
    shot.title,
    shot.storyFunction,
    ...shot.issues,
    ...(keyframePair?.allowedDelta || []),
    ...(keyframePair?.mustPreserve || []),
    ...(keyframePair?.mustNotAdd || []),
  ]).join(" ");
}

function motionEvidence(text: string): string[] {
  const normalized = normalizeText(text);
  const evidence: string[] = [];
  if (hasAny(normalized, [/\b(step|steps|stride|foot|feet|walk|run|center of mass|weight shift|balance)\b/, /脚步|步伐|重心|落脚|支撑|平衡/])) {
    evidence.push("body_mechanics_language");
  }
  if (hasAny(normalized, [/\b(bbox|bounding box|crop|translate|translation|x\/y|xy only)\b/, /边界框|框选|平移|位移/])) {
    evidence.push("bbox_or_translation_language");
  }
  if (hasAny(normalized, [/\b(hand|hands|grab|hold|touch|prop|object)\b/, /手|拿|抓|握|触碰|道具|物体/])) {
    evidence.push("interaction_language");
  }
  if (hasAny(normalized, [/\b(reveal|occlusion|hide|emerge)\b/, /揭示|遮挡|出现|露出/])) {
    evidence.push("reveal_or_occlusion_language");
  }
  if (hasAny(normalized, [/\b(start frame|end frame|derive|derived|source start)\b/, /首帧|尾帧|派生/])) {
    evidence.push("keyframe_derivation_language");
  }
  return evidence;
}

function endFrameReason(type: MotionType): string {
  if (endFrameRequiredForMotionType(type)) {
    return `${type} changes spatial, interaction, camera, reveal, or state facts enough that the end endpoint must be planned before I2V.`;
  }
  if (type === "micro_expression") return "Micro expression, breathing, and blinking can usually be carried by motion prompt without a separate end frame.";
  if (type === "camera_reframe") return "Simple reframing can use a start frame plus camera instructions unless later gates mark the move as large.";
  return "Static or in-place motion does not require an end frame by default.";
}

function buildPoseRequirement(type: MotionType, role: "start" | "end", required: boolean): MotionPoseRequirement {
  const startDescription = endFrameRequiredForMotionType(type)
    ? "Start pose must leave visible action space for the planned end endpoint and avoid cropping future motion."
    : "Start pose should preserve identity, scene layout, and the intended subtle motion surface.";
  const endDescription = required
    ? "End pose must describe the settled endpoint derived from the approved start frame."
    : "End pose is optional unless downstream planning upgrades the motion to a large endpoint change.";
  return {
    required,
    description: role === "start" ? startDescription : endDescription,
    mustPreserve: ["identity", "scene layout", "style", "approved props"],
    reservedForEndPose: role === "start" && endFrameRequiredForMotionType(type),
  };
}

function buildBodyMechanics(type: MotionType, text: string): MotionBodyMechanics {
  const normalized = normalizeText(text);
  const required = bodyMechanicsRequiredMotionTypes.has(type);
  const footworkMentioned = hasAny(normalized, [/\b(step|steps|stride|foot|feet|walk|run|plant|contact)\b/, /脚步|步伐|落脚|支撑脚|接触点/]);
  const centerOfMassMentioned = hasAny(normalized, [/\b(center of mass|centre of mass|weight shift|balance|gravity|hips?)\b/, /重心|平衡|胯|身体重量/]);
  const handPropContactMentioned = hasAny(normalized, [/\b(hand|hands|finger|fingers|grab|hold|touch|point|prop|object|door|handle|map|pen|book)\b/, /手|手指|拿|抓|握|触碰|指向|道具|物体|门|把手|地图|笔|书/]);
  const seatedOrAnchoredMentioned = hasAny(normalized, [
    /\b(seated|sits?|chair|anchored|mostly anchored|body remains|remains seated|table contact|leaning over|chin|eye line|gaze)\b/,
    /坐|椅|锚定|身体保持|身体基本不动|桌面|抬头|视线|眼神/,
  ]);
  const footworkNegated = hasAny(normalized, [/\b(no|without|missing)\s+(footwork|steps?|stride|foot|feet|contact)\b/, /没有脚步|无脚步|缺少脚步|没有落脚/]);
  const centerOfMassNegated = hasAny(normalized, [
    /\b(no|without|missing)\s+(center of mass|centre of mass|weight shift|balance|gravity|hip)\b/,
    /\b(no|without|missing)\b.{0,40}\b(center of mass|centre of mass|weight shift|balance)\b/,
    /没有重心|无重心|缺少重心|没有平衡/,
  ]);
  const hasFootwork = type === "locomotion" ? footworkMentioned && !footworkNegated : false;
  const hasCenterOfMass =
    type === "locomotion"
      ? centerOfMassMentioned && !centerOfMassNegated
      : type === "pose_change_in_place"
        ? (centerOfMassMentioned || seatedOrAnchoredMentioned) && !centerOfMassNegated
        : false;
  const contactPoints = unique([
    hasFootwork || hasCenterOfMass ? "ground_or_body_anchor_specified" : "",
    type === "object_interaction" && handPropContactMentioned ? "hand_or_prop_contact_specified" : "",
    type === "pose_change_in_place" && seatedOrAnchoredMentioned ? "seated_or_body_anchor_specified" : "",
  ]);
  return {
    required,
    description: required
      ? "Motion must explain physical continuity rather than only moving the visible bbox."
      : "No explicit body-mechanics evidence required for this motion type.",
    centerOfMass: hasCenterOfMass ? "specified" : type === "locomotion" || type === "pose_change_in_place" ? "missing" : "not_required",
    footwork: hasFootwork ? ["specified"] : [],
    contactPoints,
    timing: required ? "must be coherent across start and end endpoints" : "not_required",
  };
}

function editableRegionsFor(type: MotionType): MotionEndpointRegion[] {
  const regions: MotionEndpointRegion[] = [
    {
      id: "subject_motion_region",
      label: "Subject motion region",
      kind: type === "micro_expression" ? "face" : "subject",
      frameRole: "both",
      description: type === "micro_expression" ? "Face and breathing surface may animate subtly." : "Primary subject may change within the planned motion envelope.",
      constraints: ["keep identity locked", "avoid unexplained geometry drift"],
    },
  ];
  if (type === "object_interaction") {
    regions.push({
      id: "hands_and_prop_region",
      label: "Hands and prop interaction",
      kind: "hands",
      frameRole: "both",
      description: "Hands and approved prop may move to complete the interaction endpoint.",
      constraints: ["prop must remain approved", "contact point must be explainable"],
    });
  }
  if (type === "camera_move" || type === "camera_reframe") {
    regions.push({
      id: "camera_framing_region",
      label: "Camera framing",
      kind: "camera",
      frameRole: "both",
      description: "Camera framing may change while preserving scene continuity.",
      constraints: ["no unplanned scene replacement", "no text-to-video fallback"],
    });
  }
  if (type === "reveal_or_occlusion") {
    regions.push({
      id: "occluder_region",
      label: "Occluder or reveal region",
      kind: "occluder",
      frameRole: "both",
      description: "Occluder or revealed element may change visibility across endpoints.",
      constraints: ["revealed object must be story-approved"],
    });
  }
  return regions;
}

function protectedRegionsFor(_type: MotionType): MotionEndpointRegion[] {
  return [
    {
      id: "identity_lock_region",
      label: "Identity lock",
      kind: "subject",
      frameRole: "both",
      description: "Character identity and approved visual design are protected across endpoints.",
      constraints: ["no face swap", "no costume drift", "no new character"],
    },
    {
      id: "scene_layout_lock_region",
      label: "Scene layout lock",
      kind: "background",
      frameRole: "both",
      description: "Background layout and continuity anchors are protected unless motion type explicitly edits them.",
      constraints: ["no scene replacement", "no unexplained prop addition"],
    },
  ];
}

export function buildMotionEndpointContract(input: BuildMotionEndpointContractInput): MotionEndpointContract {
  const text = shotText(input.shot, input.keyframePair);
  const motionType = classifyMotionType(text);
  const whetherEndFrameRequired = endFrameRequiredForMotionType(motionType);
  const evidence = motionEvidence(text);
  const bodyMechanics = buildBodyMechanics(motionType, text);
  const contract: MotionEndpointContract = {
    schemaVersion: motionEndpointContractSchemaVersion,
    generatedAt: input.generatedAt,
    shotId: input.shot.id,
    motionType,
    whetherEndFrameRequired,
    endFrameRequiredReason: endFrameReason(motionType),
    startPoseRequirement: buildPoseRequirement(motionType, "start", true),
    endPoseRequirement: buildPoseRequirement(motionType, "end", whetherEndFrameRequired),
    bodyMechanics,
    editableRegions: editableRegionsFor(motionType),
    protectedRegions: protectedRegionsFor(motionType),
    bboxAnchors: [
      {
        id: "subject_bbox_anchor",
        target: "primary_subject",
        frameRole: "both",
        notes: ["BBox anchors are QA inputs only; they cannot replace pose or body-mechanics evidence."],
      },
    ],
    qaThresholds: {
      identityPreservation: "strict",
      scenePreservation: "strict",
      maxUnexplainedBboxShift: motionType === "static_hold" || motionType === "micro_expression" ? "small" : "none",
      requireDerivedEndFrame: whetherEndFrameRequired,
      requireBodyMechanicsEvidence: bodyMechanics.required,
    },
    gateInputs: {
      shotText: text,
      motionEvidence: evidence,
      keyframePairPresent: Boolean(input.keyframePair),
      keyframePairDerivesFromStart: input.keyframePair?.endDerivationSource === "start_frame",
      bboxOnlyMotionForbidden: true,
    },
    keyframePairDerivation: input.keyframePair,
    status: "pass",
    blockers: [],
    warnings: [],
  };

  const validation = validateMotionEndpointContract(contract);
  return {
    ...contract,
    status: validation.status,
    blockers: validation.blockers,
    warnings: validation.warnings,
  };
}

export function validateMotionEndpointContract(contract: MotionEndpointContract): {
  status: MotionEndpointContractStatus;
  blockers: string[];
  warnings: string[];
} {
  const blockers: string[] = [];
  const warnings: string[] = [];

  if (contract.whetherEndFrameRequired !== endFrameRequiredForMotionType(contract.motionType)) {
    blockers.push(`End-frame requirement does not match motion type ${contract.motionType}.`);
  }

  if (contract.whetherEndFrameRequired && !contract.startPoseRequirement.reservedForEndPose) {
    blockers.push("Start pose must reserve space for the future end pose when an end frame is required.");
  }

  if (contract.whetherEndFrameRequired && !contract.endPoseRequirement.required) {
    blockers.push("End pose requirement must be marked required when an end frame is required.");
  }

  if (contract.whetherEndFrameRequired && contract.gateInputs.keyframePairPresent && !contract.gateInputs.keyframePairDerivesFromStart) {
    blockers.push("Required end frame must derive from the approved start frame unless a later explicit exception gate is added.");
  }

  if (contract.motionType === "object_interaction") {
    if (contract.editableRegions.length === 0) blockers.push("Object interaction must declare editable hands/prop regions.");
    if (contract.protectedRegions.length === 0) blockers.push("Object interaction must declare protected identity/scene regions.");
  }

  if (contract.motionType === "locomotion") {
    const hasFootwork = contract.bodyMechanics.footwork.length > 0;
    const hasCenterOfMass = contract.bodyMechanics.centerOfMass !== "missing";
    const bboxOnly = contract.gateInputs.motionEvidence.includes("bbox_or_translation_language") && !hasFootwork && !hasCenterOfMass;
    if (!hasFootwork || !hasCenterOfMass) {
      warnings.push("Locomotion should specify footwork and center-of-mass transfer before endpoint generation.");
    }
    if (bboxOnly) {
      blockers.push("Locomotion cannot be represented only by bbox translation; add footwork, contact, and center-of-mass mechanics.");
    }
  }

  if (contract.qaThresholds.requireBodyMechanicsEvidence && !contract.bodyMechanics.required) {
    blockers.push("QA requires body-mechanics evidence but bodyMechanics.required is false.");
  }

  return {
    status: blockers.length > 0 ? "blocked" : warnings.length > 0 ? "warning" : "pass",
    blockers,
    warnings,
  };
}
