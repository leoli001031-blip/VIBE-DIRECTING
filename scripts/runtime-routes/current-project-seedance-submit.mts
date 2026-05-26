import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

import {
  extractDreaminaTaskInfo,
  jimengResumeCommand,
  normalizeDreaminaStatus,
} from "../../src/core/jimengVideoCli.ts";
import {
  IMAGE2_GENERATE_DEFAULT_SIZE,
  JIMENG_VIDEO_DEFAULT_RESOLUTION,
} from "../../src/core/providerPolicy.ts";
import {
  APIKEY_FUN_RESPONSES_IMAGE_DEFAULT_BASE_URL,
  APIKEY_FUN_RESPONSES_IMAGE_DEFAULT_MODEL,
  APIKEY_FUN_RESPONSES_IMAGE_PROVIDER_ID,
  fetchApikeyFunImageViaResponses,
} from "../apikey-fun-responses-image-transport.mts";
import {
  buildDirectorProductionSkillPlan,
} from "../../src/core/directorProductionSkill.ts";
import {
  runDirectorRuleQa,
} from "../../src/core/directorRuleQa.ts";
import {
  runDirectorTextQaForRuntime,
} from "./director-text-qa-runtime.mts";
import {
  buildVideoRelayQueueState,
} from "../../src/core/videoRelayQueue.ts";
import {
  isStandalonePropReference,
  isVehicleControllerLabel,
} from "../../src/core/referenceAssetStrategy.ts";

const CONFIRM_PHRASE = "submit-seedance-video";
const DEFAULT_MODEL_VERSION = "seedance2.0";
const DEFAULT_RATIO = "16:9";
const DEFAULT_POLL_SECONDS = 90;
const MAX_REFERENCE_IMAGE_BYTES = 50 * 1024 * 1024; // 50MB

function isTransientStoryboardImageFailure(result) {
  return result?.ok === false && ["network_error", "timeout", "rate_limit", "server_error"].includes(result.errorType);
}

async function fetchStoryboardReferenceImage(input) {
  const first = await fetchApikeyFunImageViaResponses(input);
  if (first.ok || !isTransientStoryboardImageFailure(first) || input.stream === false) return first;

  // Streaming image responses are more likely to be interrupted on long-running
  // provider calls. Retry once with plain JSON so a real video submit is not
  // blocked by a transient SSE disconnect.
  const retry = await fetchApikeyFunImageViaResponses({
    ...input,
    stream: false,
  });
  if (retry.ok) {
    return {
      ...retry,
      metadata: {
        ...retry.metadata,
        firstAttempt: {
          transport: first.transport,
          errorType: first.errorType,
          statusCode: first.statusCode,
          message: first.message,
        },
        retryReason: "storyboard_stream_interrupted",
      },
    };
  }

  return {
    ...retry,
    message: `${first.message || "故事板参考生成失败。"} 已自动重试一次仍未完成。`,
    diagnostic: {
      firstAttempt: {
        transport: first.transport,
        errorType: first.errorType,
        statusCode: first.statusCode,
        diagnostic: first.diagnostic,
      },
      retryAttempt: {
        transport: retry.transport,
        errorType: retry.errorType,
        statusCode: retry.statusCode,
        diagnostic: retry.diagnostic,
      },
    },
  };
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function unwrapRequestJsonBody(parsedBody) {
  if (isRecord(parsedBody) && parsedBody.ok === true && "body" in parsedBody) return parsedBody.body;
  return parsedBody;
}

function asString(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function asNumber(value, fallback) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function textArray(value) {
  return Array.isArray(value)
    ? value.filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim())
    : [];
}

function uniqueStrings(values) {
  return [...new Set(values.filter((value) => typeof value === "string" && value.trim()).map((value) => value.trim()))];
}

function cleanLines(lines) {
  return lines.filter((line) => typeof line === "string" && line.trim()).join("\n");
}

function cleanPublicText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .replace(/行动反应[:：]\s*参考策略[:：][^。]*(。|$)/g, "")
    .replace(/参考策略[:：]\s*(故事板叙事|故事板快切|全能参考|storyboard_narrative|storyboard_rapid_cut|omni_reference)[；;，,。]?/gi, "")
    .replace(/内部导演\s*skill[:：][^。]*(。|$)/gi, "")
    .replace(/Internal production skill[^。]*(。|$)/gi, "")
    .trim();
}

function safePathSegment(value) {
  return String(value || "seedance")
    .trim()
    .replace(/[^A-Za-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 90) || "seedance";
}

function redact(value) {
  return String(value || "")
    .replace(/\b(sk|tvly)-[A-Za-z0-9._-]{12,}\b/g, "$1-REDACTED")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer REDACTED")
    .slice(0, 8000);
}

function sha256Bytes(bytes) {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function sha256File(filePath) {
  return sha256Bytes(readFileSync(filePath));
}

function inferMime(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  return "image/png";
}

function identityKey(value) {
  return String(value || "").toLowerCase().replace(/[\s_-]+/g, "").trim();
}

function assetIdentityKeys(asset) {
  return uniqueStrings([asset?.id, asset?.name, asset?.displayName, asset?.roleId, asset?.sceneId])
    .map(identityKey)
    .filter(Boolean);
}

function providerConfigFor(statuses, providerId) {
  return (Array.isArray(statuses) ? statuses : []).find((item) => item?.providerId === providerId);
}

function storyShots(projectFacts, workbenchFacts) {
  const richShots = Array.isArray(projectFacts?.projectVibe?.shots) ? projectFacts.projectVibe.shots : [];
  const fallbackShots = Array.isArray(workbenchFacts?.storyFlow?.shots) ? workbenchFacts.storyFlow.shots : [];
  const source = richShots.length ? richShots : fallbackShots;
  const characterKeys = new Set(
    (Array.isArray(workbenchFacts?.visualMemory?.assets) ? workbenchFacts.visualMemory.assets : [])
      .filter((asset) => asset?.type === "character")
      .flatMap(assetIdentityKeys),
  );
  return source.filter(isRecord).map((shot, index) => {
    const propAssetIds = textArray(shot.propAssetIds);
    const propGuidance = textArray(shot.propGuidance);
    const propIdsThatAreCharacters = [...propAssetIds, ...propGuidance]
      .filter((id) => characterKeys.has(identityKey(id)));
    return {
      id: asString(shot.id || shot.shotId, `shot_${index + 1}`),
      title: asString(shot.title || shot.name || shot.label, `镜头 ${index + 1}`),
      durationSeconds: asNumber(shot.durationSeconds || shot.duration || shot.seconds, 4),
      intent: asString(shot.intent || shot.storyFunction || shot.description || shot.summary),
      camera: asString(shot.camera || shot.lens || shot.framing),
      primaryAction: asString(shot.primaryAction || shot.action),
      trigger: asString(shot.actionTrigger || shot.trigger),
      microReaction: asString(shot.microReaction || shot.reaction),
      splitPolicy: asString(shot.splitPolicy || shot.rhythmLabel),
      visibleClips: asNumber(shot.visibleClips, undefined),
      storyboardPanels: asNumber(shot.storyboardPanels, undefined),
      executionMode: asString(shot.executionMode),
      referenceStrategy: asString(shot.referenceStrategy),
      rhythmProfile: asString(shot.rhythmProfile),
      actionBeats: Array.isArray(shot.actionBeats) ? shot.actionBeats.filter((item) => typeof item === "string" && item.trim()) : [],
      sceneGuidance: textArray(shot.sceneGuidance),
      characterGuidance: uniqueStrings([...textArray(shot.characterGuidance), ...propIdsThatAreCharacters]),
      propGuidance: propGuidance.filter((id) => !characterKeys.has(identityKey(id))),
      sceneAssetIds: textArray(shot.sceneAssetIds),
      characterAssetIds: uniqueStrings([...textArray(shot.characterAssetIds), ...propIdsThatAreCharacters]),
      propAssetIds: propAssetIds.filter((id) => !characterKeys.has(identityKey(id))),
      seedanceDirection: asString(shot.seedanceDirection),
      sound: asString(shot.sound),
      storyboardGroupId: asString(
        shot.storyboardGroupId
        || shot.videoSegmentId
        || shot.referenceGroupId
        || shot.sequenceGroupId
        || shot.sequenceId
      ),
    };
  });
}

function sceneClusterForText(value) {
  const text = String(value || "").toLowerCase();
  const clusters = [
    { key: "old_bookstore", label: "旧书店", pattern: /旧书店|书店|书架|旧书|bookstore|bookshop|bookshelf|old\s*books?/i },
    { key: "train_station", label: "车站/站台", pattern: /车站|站台|电车站|火车站|地铁站|train\s*station|railway\s*platform|subway\s*platform/i },
    { key: "lighthouse_interior", label: "灯塔内部维修室", pattern: /灯塔内部|灯塔内|维修室|控制台|旧灯塔控制台|灯塔维修|lighthouse\s*(interior|inside|control\s*room)|control\s*room/i },
    { key: "lighthouse_exterior", label: "雨后海雾小镇与灯塔外观", pattern: /海雾小镇|灯塔外观|灯塔门口|灯塔灯束|海边灯塔|海岸灯塔|雨后.*灯塔|lighthouse\s*(exterior|outside)|coastal\s*(town|lighthouse)/i },
    { key: "whale_tram_ocean", label: "海雾中的鲸鱼电车与海面", pattern: /鲸鱼电车|鲸影|海面|海雾中.*电车|whale\s*tram|ocean|sea/i },
    { key: "convenience_store", label: "便利店", pattern: /便利店(?:门口|入口|雨棚|店内|外)?|自动门|convenience\s*store/i },
    { key: "mountain_road", label: "雨夜山路", pattern: /山路|便利店外山路|山脊|跑山|发卡弯|雨夜山路|mountain\s*road|touge|hairpin|convenience\s*store\s*road/i },
    { key: "street", label: "街道", pattern: /街道|街边|路口|巷|雾中街道|湿漉漉的街|湿街|城市湿路|城市道路|城市路面|neon\s*street|city\s*street|street|alley/i },
    { key: "cafe", label: "咖啡馆", pattern: /咖啡馆|咖啡店|cafe|coffee\s*shop/i },
    { key: "rooftop", label: "屋顶/天台", pattern: /屋顶|天台|rooftop/i },
  ];
  return clusters.find((item) => item.pattern.test(text));
}

function shotSceneCluster(shot) {
  return sceneClusterForText([
    ...(shot.sceneGuidance || []),
    shot.title,
    shot.intent,
  ].filter(Boolean).join(" "));
}

function resolvedShotSceneClusters(shots) {
  const resolved = shots.map((shot) => shotSceneCluster(shot));
  let previous;
  for (let index = 0; index < resolved.length; index += 1) {
    if (resolved[index]) previous = resolved[index];
    else if (previous) resolved[index] = previous;
  }
  let next;
  for (let index = resolved.length - 1; index >= 0; index -= 1) {
    if (resolved[index]) next = resolved[index];
    else if (next) resolved[index] = next;
  }
  return resolved.map((cluster, index) => cluster || { key: `scene_${index + 1}`, label: `场景 ${index + 1}` });
}

function contiguousReferenceSegments(shots) {
  const clusters = resolvedShotSceneClusters(shots);
  const segments = [];
  for (const [index, shot] of shots.entries()) {
    const cluster = clusters[index];
    const groupId = asString(shot.storyboardGroupId);
    const previous = segments[segments.length - 1];
    const canAppendToPrevious = Boolean(
      groupId
      && previous
      && previous.storyboardGroupId === groupId
      && previous.sceneClusterKey === cluster.key
    );
    if (!canAppendToPrevious) {
      segments.push({
        id: `segment_${segments.length + 1}`,
        sceneClusterKey: cluster.key,
        sceneLabel: cluster.label,
        storyboardGroupId: groupId || undefined,
        startIndex: index,
        shots: [shot],
      });
    } else {
      previous.shots.push(shot);
    }
  }
  return segments.map((segment) => ({
    ...segment,
    endIndex: segment.startIndex + segment.shots.length - 1,
    durationSeconds: segment.shots.reduce((sum, shot) => sum + shot.durationSeconds, 0),
  }));
}

function selectedSegmentFor(shots, selectedShotIds) {
  const segments = contiguousReferenceSegments(shots);
  if (!segments.length) return { segments, activeSegment: undefined };
  const selected = new Set(selectedShotIds);
  const activeSegment = selected.size
    ? segments.find((segment) => segment.shots.some((shot) => selected.has(shot.id))) || segments[0]
    : segments[0];
  return { segments, activeSegment };
}

function segmentItemId(segment) {
  return `seedance_${segment.id}`;
}

function segmentTitle(segment) {
  const firstTitle = segment.shots[0]?.title || segment.sceneLabel;
  return segment.shots.length > 1
    ? `${segment.sceneLabel} · ${segment.shots.length} 个镜头`
    : firstTitle;
}

function activeRelayStatus(status) {
  return status === "submitted" || status === "generating" || status === "recoverable_queued";
}

function terminalRelayStatus(status) {
  return status === "success" || status === "failed" || status === "blocked";
}

function relayStatusFromSeedance(status, outputVideoPath) {
  if (outputVideoPath || status === "success") return "success";
  if (status === "generating") return "generating";
  if (status === "queued" || status === "submitted") return "submitted";
  if (status === "timed_out" || status === "recoverable_queued") return "recoverable_queued";
  if (status === "submit_failed" || status === "failed" || status === "blocked") return "failed";
  return "submitted";
}

function relayQueueItemsForSegments({
  segments,
  existingQueue,
  input,
  activeSegmentId,
  activeUpdate,
}) {
  const existingBySegment = new Map();
  for (const item of Array.isArray(existingQueue?.items) ? existingQueue.items : []) {
    existingBySegment.set(item.segmentId || item.id, item);
  }
  return segments.map((segment) => {
    const existing = existingBySegment.get(segment.id) || {};
    const update = segment.id === activeSegmentId ? activeUpdate || {} : {};
    const status = update.status || existing.status || "ready";
    return {
      id: segmentItemId(segment),
      segmentId: segment.id,
      shotId: segment.shots[0]?.id || segment.id,
      shotIds: segment.shots.map((shot) => shot.id),
      sceneClusterKey: segment.sceneClusterKey,
      sceneLabel: segment.sceneLabel,
      title: segmentTitle(segment),
      status,
      modelVersion: input.modelVersion,
      videoResolution: input.videoResolution,
      durationSeconds: segment.durationSeconds,
      promptPath: update.promptPath || existing.promptPath,
      referencePaths: update.referencePaths || existing.referencePaths || [],
      submitId: update.submitId || existing.submitId,
      resumeCommand: update.resumeCommand || existing.resumeCommand,
      outputVideoPath: update.outputVideoPath || existing.outputVideoPath,
      outputVideoSha256: update.outputVideoSha256 || existing.outputVideoSha256,
      localMediaPaths: update.localMediaPaths || existing.localMediaPaths || [],
      attemptCount: Number(existing.attemptCount || 0) + (update.attempted ? 1 : 0),
      blockers: update.blockers || existing.blockers || [],
      notes: uniqueStrings([
        ...(existing.notes || []),
        `镜头：${segment.shots.map((shot) => shot.id).join(", ")}`,
        segment.shots.length > 1
          ? "显式故事板组共享一个视频段。"
          : "单镜头视频段；可复用同一场景基准图。",
        update.note,
      ]),
    };
  });
}

function relayQueueForSegments(input) {
  const items = relayQueueItemsForSegments(input);
  return buildVideoRelayQueueState({
    generatedAt: input.generatedAt,
    queueId: "seedance_segment_relay_queue",
    storyboardConfirmed: true,
    paused: false,
    items,
  });
}

function chooseSegmentForSubmission({ segments, existingQueue, selectedShotIds }) {
  const activeItem = (existingQueue?.items || []).find((item) => activeRelayStatus(item.status));
  if (activeItem) {
    return {
      blockedByActive: activeItem,
      activeSegment: segments.find((segment) => segment.id === (activeItem.segmentId || activeItem.id)),
    };
  }
  const existingBySegment = new Map((existingQueue?.items || []).map((item) => [item.segmentId || item.id, item]));
  const selected = selectedSegmentFor(segments.flatMap((segment) => segment.shots), selectedShotIds).activeSegment;
  const selectedItem = selected ? existingBySegment.get(selected.id) : undefined;
  if (selected && (!selectedItem || !terminalRelayStatus(selectedItem.status))) {
    return { activeSegment: selected };
  }
  const next = segments.find((segment) => {
    const item = existingBySegment.get(segment.id);
    return !item || !terminalRelayStatus(item.status);
  });
  return { activeSegment: next || segments[0] };
}

function shotVisualBrief(shot) {
  const visualBase = cleanPublicText(shot.intent).split(/切点[:：]/)[0]?.trim() || "";
  const visibleCharacters = shot.characterGuidance.filter((item) => !isVehicleControllerLabel(item));
  const visibleProps = shot.propGuidance.filter((item) => isStandalonePropReference(item));
  return cleanLines([
    visualBase,
    shot.camera ? `镜头/机位：${shot.camera}` : "",
    shot.primaryAction ? `主动作：${shot.primaryAction}` : "",
    shot.trigger ? `触发：${shot.trigger}` : "",
    shot.microReaction ? `微反应：${shot.microReaction}` : "",
    shot.splitPolicy ? `节奏：${shot.splitPolicy}` : "",
    visibleCharacters.length ? `角色：${visibleCharacters.join("，")}` : "",
    shot.sceneGuidance.length ? `场景：${shot.sceneGuidance.join("，")}` : "",
    visibleProps.length ? `道具：${visibleProps.join("，")}` : "",
  ]);
}

function seedanceContinuousShotText(value, compilePlan) {
  const cleaned = cleanPublicText(value);
  if (!cleaned) return "";
  // The video model tends to treat edit verbs as permission to create extra visible cuts.
  // Keep planning language continuous; the timing table remains the only visible-cut source.
  return safeSeedanceProviderText(cleaned
    .replace(/从([^。；;，,\n]{1,40})切到([^。；;，,\n]{1,40})/g, "从$1连续转向$2")
    .replace(/再切(?:到)?/g, "随后连续转向")
    .replace(/切(?:到|向)/g, "连续转向")
    .replace(/切(近景|特写|远景|中景|全景|反应|手部|眼神|人物|道具|场景)/g, "连续调整到$1")
    .replace(/镜头切换/g, "镜头连续转换")
    .replace(/\bcut\s+to\b/gi, "move continuously to")
    .replace(/\bcutaway\b/gi, "continuous insert detail")
    .replace(/\bsmash\s+cut\b/gi, compilePlan?.strategyId === "storyboard_rapid_cut" ? "hard timed transition" : "fast continuous emphasis"));
}

function safeSeedanceProviderText(value) {
  return cleanPublicText(value)
    .replace(/音乐(?:节奏|节拍)|配乐(?:节奏|节拍)|背景音乐(?:节奏|节拍)/gi, "剪辑节奏")
    .replace(/\b(?:bgm|music|soundtrack|song|songs)\b/gi, "post-production audio reference")
    .replace(/背景音乐|配乐|歌曲|音乐/gi, "后期声音参考")
    .replace(/角色[:：][^。；;\n]*(?:驾驶者|驾驶员|司机|车手|driver)[^。；;\n]*(?:。|；|;)?/gi, "")
    .replace(/对峙停住/g, "并排短暂停住")
    .replace(/对峙/g, "并排短暂停住")
    .replace(/跑车/g, "双门车")
    .replace(/(?:猛)?冲出/g, "平稳驶过")
    .replace(/(?:猛)?冲向/g, "平稳驶向")
    .replace(/飙车|赛车/g, "山路车辆短片")
    .replace(/(?:两名|两位|一名|一位)?(?:驾驶者|驾驶员|司机|车手)[^。；;，,]*(?:踩下|按下)[^。；;，,]*/g, "车辆启动")
    .replace(/(?:驾驶者|驾驶员|司机|车手|driver)/gi, "")
    .replace(/油门轰鸣/g, "引擎低鸣")
    .replace(/油门/g, "启动踏板")
    .replace(/轮胎破水/g, "车轮带起雨水")
    .replace(/撕开雨雾/g, "穿过雨雾")
    .replace(/逼近/g, "靠近");
}

function seedanceShotVisualBrief(shot, compilePlan) {
  return seedanceContinuousShotText(shotVisualBrief(shot), compilePlan);
}

function compactSeedanceVisualBrief(shot, compilePlan) {
  const intent = cleanPublicText(shot.intent);
  const pictureMatch = intent.match(/画面[:：]\s*([\s\S]*?)(?:[。；;]\s*(?:主动作|触发|微反应|镜头\/机位|镜头|节奏|角色|场景|道具)[:：]|$)/u);
  const beforeMetadata = (pictureMatch?.[1] || intent)
    .split(/(?:主动作|触发|微反应|镜头\/机位|节奏|角色|场景|道具)[:：]/u)[0]
    .replace(/镜号[:：][^。；;\n]*[。；;]?/gu, "")
    .replace(/时长[:：][^。；;\n]*[。；;]?/gu, "")
    .replace(/景别[:：][^。；;\n]*[。；;]?/gu, "")
    .replace(/镜头[:：][^。；;\n]*[。；;]?/gu, "")
    .replace(/[。；;]\s*$/u, "")
    .trim();
  const fallback = cleanPublicText(shot.primaryAction || shot.title || shot.intent);
  return seedanceContinuousShotText(beforeMetadata || fallback, compilePlan);
}

function storyboardShotVisualBrief(shot) {
  return safeSeedanceProviderText(shotVisualBrief(shot));
}

function seedanceShotCamera(shot, compilePlan) {
  return seedanceContinuousShotText(shot.camera, compilePlan);
}

function timeRanges(shots) {
  let cursor = 0;
  return shots.map((shot, index) => {
    const start = cursor;
    const end = cursor + shot.durationSeconds;
    cursor = end;
    return {
      index: index + 1,
      start,
      end,
      label: `${start.toFixed(1)}-${end.toFixed(1)}s`,
      shot,
    };
  });
}

function shotPlanFor(compilePlan, shot) {
  return (compilePlan.shotPlans || []).find((plan) => plan.shotId === shot.id);
}

function rapidPanelIntentText(shot) {
  return cleanLines([
    shot.title,
    shot.intent,
    shot.camera,
    shot.primaryAction,
    shot.trigger,
    shot.microReaction,
    shot.splitPolicy,
    shot.executionMode,
    ...(shot.actionBeats || []),
  ]);
}

function explicitRapidCutCountFromText(text, durationSeconds) {
  const normalized = cleanPublicText(text);
  const range = normalized.match(/(\d+)\s*[-~～到至]\s*(\d+)\s*个?\s*(?:可见)?\s*(?:切点|剪辑|镜头|分镜|panel|panels|cut|cuts)/i);
  if (range) {
    const low = Number(range[1]);
    const high = Number(range[2]);
    if (Number.isFinite(low) && Number.isFinite(high)) {
      const min = Math.max(1, Math.min(low, high));
      const max = Math.max(low, high);
      return durationSeconds > 4.5 ? max : min;
    }
  }
  const exact = normalized.match(/(\d+)\s*个?\s*(?:可见)?\s*(?:切点|剪辑|镜头|分镜|panel|panels|cut|cuts)/i);
  if (exact) {
    const value = Number(exact[1]);
    if (Number.isFinite(value)) return value;
  }
  return 0;
}

function explicitCountFromText(text, durationSeconds) {
  const normalized = cleanPublicText(text);
  const range = normalized.match(/(\d+)\s*[-~～到至]\s*(\d+)\s*个?/i);
  if (range) {
    const low = Number(range[1]);
    const high = Number(range[2]);
    if (Number.isFinite(low) && Number.isFinite(high)) {
      const min = Math.max(0, Math.min(low, high));
      const max = Math.max(low, high);
      return durationSeconds > 4.5 ? max : min;
    }
  }
  const exact = normalized.match(/(\d+)\s*个?/i);
  if (!exact) return 0;
  const value = Number(exact[1]);
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function inferredRapidPanelCountForShot(shot) {
  const text = rapidPanelIntentText(shot);
  const duration = Number(shot.durationSeconds || 0);
  const explicit = explicitRapidCutCountFromText(text, duration);
  const cameraBeatCount = String(shot.camera || "")
    .replace(/计划快切|混合快切|快切|镜头|camera/gi, "")
    .split(/[，、,;；]/u)
    .map((item) => cleanPublicText(item))
    .filter(Boolean).length;
  const hasRapidGrammar = /混合快切|计划快切|快切|连击|可见切点|planned_cut_sequence|quick\s*cut|rapid\s*cut|montage/i.test(text);
  const inferred = Math.max(
    explicit,
    cameraBeatCount,
    hasRapidGrammar ? 3 : 0,
  );
  if (!inferred) return 0;
  const durationCap = duration > 0 && duration <= 4.5 ? 4 : duration > 0 && duration <= 8 ? 6 : 12;
  return Math.max(2, Math.min(durationCap, inferred));
}

function shotUsesRapidContract(shot, compilePlan) {
  if (compilePlan.strategyId !== "storyboard_rapid_cut") return false;
  const plan = shotPlanFor(compilePlan, shot);
  const text = rapidPanelIntentText(shot);
  return Boolean(
    plan?.strategyId === "storyboard_rapid_cut"
    || shot.referenceStrategy === "storyboard_rapid_cut"
    || shot.executionMode === "planned_cut_sequence"
    || /混合快切|计划快切|快切|连击|可见切点|planned_cut_sequence|quick\s*cut|rapid\s*cut|montage/i.test(text)
  );
}

function rapidPanelCountForShot(shot, compilePlan) {
  if (compilePlan.strategyId !== "storyboard_rapid_cut") return 1;
  const plan = shotPlanFor(compilePlan, shot);
  if (!shotUsesRapidContract(shot, compilePlan)) return 1;
  const planned = Number(plan?.panelCountIntent || 0);
  const explicitStoryboardPanels = Number(shot.storyboardPanels || 0);
  const text = rapidPanelIntentText(shot);
  const shouldInferRapidPanels = !plan
    || plan.strategyId === "storyboard_rapid_cut"
    || /混合快切|计划快切|快切|连击|可见切点|planned_cut_sequence|quick\s*cut|rapid\s*cut|montage/i.test(text);
  const inferred = shouldInferRapidPanels ? inferredRapidPanelCountForShot(shot) : 0;
  const minimum = shouldInferRapidPanels ? 2 : 1;
  const count = Math.max(planned, explicitStoryboardPanels, inferred, minimum);
  return Math.max(minimum, Math.min(12, Math.floor(count)));
}

function rapidVisibleClipCountForShot(shot, compilePlan) {
  if (compilePlan.strategyId !== "storyboard_rapid_cut") return 1;
  if (!shotUsesRapidContract(shot, compilePlan)) return 1;
  const explicitVisibleClips = Number(shot.visibleClips || 0);
  if (Number.isFinite(explicitVisibleClips) && explicitVisibleClips > 0) {
    return Math.max(1, Math.min(12, Math.floor(explicitVisibleClips)));
  }
  const cutCount = explicitCountFromText([
    shot.splitPolicy,
    shot.intent,
    shot.camera,
    shot.primaryAction,
  ].filter(Boolean).join(" "), shot.durationSeconds);
  if (cutCount > 0) return Math.max(1, Math.min(12, cutCount + 1));
  return Math.max(1, Math.min(12, rapidPanelCountForShot(shot, compilePlan)));
}

function storyboardPrimaryPanelCount(shots, compilePlan) {
  if (compilePlan.strategyId !== "storyboard_rapid_cut") return shots.length;
  return shots.reduce((sum, shot) => sum + rapidPanelCountForShot(shot, compilePlan), 0);
}

function visibleClipCount(shots, compilePlan) {
  if (compilePlan.strategyId !== "storyboard_rapid_cut") return shots.length;
  return shots.reduce((sum, shot) => sum + rapidVisibleClipCountForShot(shot, compilePlan), 0);
}

function rapidPanelBeatLabels(shot, count) {
  const candidates = [
    ...(shot.actionBeats || []),
    ...String(shot.camera || "")
      .replace(/计划快切|混合快切|快切|镜头|camera/gi, "")
      .split(/[，、,;；]/u),
    ...String(shot.primaryAction || "").split(/[，、,;；]/u),
    shot.trigger,
    shot.microReaction,
  ]
    .map((item) => cleanPublicText(item)
      .replace(/^[\s:：\-—]+/u, "")
      .replace(/^(?:镜头\/机位|镜头|机位|camera)\s*[:：\-—]?\s*/iu, "")
      .trim())
    .filter((item) => item && !/^(计划快切|混合快切|快切|镜头|camera)$/i.test(item));
  const fallback = cleanPublicText(shot.primaryAction || shot.intent || shot.title);
  return Array.from({ length: count }, (_, index) =>
    candidates[index] || `${fallback} beat ${index + 1}` || `${shot.title} beat ${index + 1}`
  );
}

function storyboardPanelRows(shots, compilePlan) {
  const rows = [];
  let cursor = 0;
  let panelIndex = 1;
  for (const shot of shots) {
    const count = rapidPanelCountForShot(shot, compilePlan);
    const slice = shot.durationSeconds / count;
    const beatLabels = rapidPanelBeatLabels(shot, count);
    for (let index = 0; index < count; index += 1) {
      const start = cursor + slice * index;
      const end = index === count - 1 ? cursor + shot.durationSeconds : cursor + slice * (index + 1);
      rows.push({
        index: panelIndex,
        shot,
        start,
        end,
        label: `${start.toFixed(1)}-${end.toFixed(1)}s`,
        beatLabel: beatLabels[index],
        panelWithinShot: index + 1,
        panelCountForShot: count,
      });
      panelIndex += 1;
    }
    cursor += shot.durationSeconds;
  }
  return rows;
}

function storyboardLayoutLines(shots, compilePlan) {
  const primaryCount = storyboardPrimaryPanelCount(shots, compilePlan);
  const finalClipCount = visibleClipCount(shots, compilePlan);
  if (compilePlan.strategyId === "storyboard_rapid_cut") {
    return [
      "Layout grammar: rough action previs / timing-sheet storyboard.",
      `Storyboard panel count: exactly ${primaryCount}. Final visible clips requested from Seedance: exactly ${finalClipCount}.`,
      "Storyboard panels are motion-planning beats; they do not automatically become final visible clips.",
      "Arrange the primary panels as a readable action sequence grid or strip. Panel shapes may be long, narrow, large, or small when it improves motion readability and information density.",
      "Each primary panel must carry one clear action/camera beat. Do not add prop catalog panels, character-sheet panels, reference-image panels, title bars, UI sections, or extra story moments.",
      "Production annotations may sit over the primary panels, but they must stay sparse, hand-drawn, and functional.",
    ];
  }
  return [
    "Layout grammar: flexible director storyboard, not a rigid template.",
    `Primary cut count: exactly ${primaryCount}. Draw exactly ${primaryCount} primary storyboard panels, one for each timing-map row.`,
    "Choose the simplest readable layout for this sequence: a horizontal film strip, an uneven 2x2 / 3x2 director board, or an establishing/relationship panel with smaller acting or insert panels.",
    "Do not force one dominant main composition if the sequence reads better as multiple balanced panels. Do not force equal-size boxes if camera distance, emotional weight, or action readability calls for different panel sizes.",
    "Optional micro-insets are allowed only as visually subordinate details inside or attached to their primary panel; they must not read as extra primary panels, extra clips, prop catalog images, or character sheets.",
    "Keep the page cinematic and sparse. Avoid dense tables, proposal-board modules, UI headers, title blocks, form fields, decorative typography, and finished poster composition.",
  ];
}

function productionPlansForShots(shots, refs) {
  const state = {
    scene: refs.some((ref) => ref.type === "scene") ? "locked" : "missing",
    characters: refs.some((ref) => ref.type === "character") ? "locked" : "missing",
    props: refs.some((ref) => ref.type === "prop") ? "locked" : "missing",
  };
  return shots.map((shot) => buildDirectorProductionSkillPlan({
    shotId: shot.id,
    title: shot.title,
    durationSeconds: shot.durationSeconds,
    shotText: cleanLines([
      shot.title,
      shotVisualBrief(shot),
      shot.seedanceDirection ? cleanPublicText(shot.seedanceDirection) : "",
      ...(shot.actionBeats || []),
    ]),
    executionMode: shot.executionMode,
    referenceStrategy: shot.referenceStrategy,
    actionBeats: shot.actionBeats,
    camera: shot.camera,
    visualDescription: shotVisualBrief(shot),
    assetState: state,
  }));
}

function sequenceCompilePlan(shots, refs) {
  const shotPlans = productionPlansForShots(shots, refs);
  const hasRapid = shotPlans.some((plan) => plan.strategyId === "storyboard_rapid_cut");
  const hasNarrative = shotPlans.some((plan) => plan.strategyId === "storyboard_narrative");
  const multiShotSequence = shots.length > 1;
  const strategyId = hasRapid
    ? "storyboard_rapid_cut"
    : (hasNarrative || multiShotSequence)
      ? "storyboard_narrative"
      : "omni_reference";
  const strategyLabel = strategyId === "storyboard_rapid_cut"
    ? "故事板快切"
    : strategyId === "storyboard_narrative"
      ? "故事板叙事"
      : "全能参考";
    const reasons = uniqueStrings([
    multiShotSequence ? "显式故事板组需要先用一个顺序参考锁住可见 cut 和时间段。" : "",
    ...shotPlans.flatMap((plan) => plan.reasons || []),
    strategyId === "storyboard_rapid_cut" ? "存在快切/动作密度较高段落，允许粗分镜标注作为内部运动提示。" : "",
  ]);
  return {
    strategyId,
    strategyLabel,
    shotPlans,
    reasons,
    allowProductionAnnotations: strategyId === "storyboard_rapid_cut",
  };
}

function assetUsedByShotIds(asset) {
  return Array.isArray(asset?.usedByShotIds)
    ? asset.usedByShotIds.filter((item) => typeof item === "string" && item.trim())
    : [];
}

function normalizedReferenceText(value) {
  return String(value || "").toLowerCase().replace(/\s+/g, "");
}

function assetSceneSpecificityPenalty(asset) {
  const text = [asset?.id, asset?.name, ...(asset?.textConstraints || [])].join(" ");
  return ["书桌前", "窗边", "手部", "特写", "近景", "insert", "close-up", "桌面"]
    .filter((hint) => text.includes(hint)).length * 0.2;
}

function shotExplicitReferenceIds(shot, type) {
  if (type === "scene") return textArray(shot.sceneAssetIds);
  if (type === "character") return textArray(shot.characterAssetIds);
  if (type === "prop") return textArray(shot.propAssetIds);
  return [];
}

function assetMatchesExplicitReference(asset, referenceId) {
  const key = identityKey(referenceId);
  if (!key) return false;
  return assetIdentityKeys(asset).some((assetKey) => assetKey === key);
}

function assetMatchesShotForType(asset, shot, type) {
  const assetText = [asset?.id, asset?.name, ...(asset?.textConstraints || [])].join(" ");
  if (type === "character" && isVehicleControllerLabel(assetText)) return false;
  if (type === "prop" && !isStandalonePropReference(assetText)) return false;
  const explicitReferenceIds = shotExplicitReferenceIds(shot, type);
  if (explicitReferenceIds.length) {
    return explicitReferenceIds.some((id) => assetMatchesExplicitReference(asset, id));
  }
  if (type === "scene") {
    const assetCluster = sceneClusterForText(assetText);
    const shotCluster = shotSceneCluster(shot);
    if (assetCluster && shotCluster && assetCluster.key === shotCluster.key) return true;
  }
  const shotText = normalizedReferenceText([
    shot.id,
    shot.title,
    shot.intent,
    shot.camera,
    shot.primaryAction,
    ...(shot.sceneGuidance || []),
    ...(shot.characterGuidance || []),
    ...(shot.propGuidance || []),
  ].join(" "));
  const needles = [
    asset?.id,
    asset?.name,
    ...(asset?.textConstraints || []),
  ].map(normalizedReferenceText).filter((item) => item.length >= 2);
  return needles.some((needle) => shotText.includes(needle) || needle.includes(shotText));
}

function representativeAssetsOfType(assets, shots, type) {
  const shotIds = new Set(shots.map((shot) => shot.id));
  const characterKeys = new Set(
    assets
      .filter((asset) => asset?.type === "character")
      .flatMap(assetIdentityKeys),
  );
  return assets
    .filter((asset) => asset?.type === type && asset.path)
    .filter((asset) => type !== "character" || !isVehicleControllerLabel([asset?.id, asset?.name, ...(asset?.textConstraints || [])].join(" ")))
    .filter((asset) => type !== "prop" || isStandalonePropReference([asset?.id, asset?.name, ...(asset?.textConstraints || [])].join(" ")))
    .filter((asset) => type !== "prop" || !assetIdentityKeys(asset).some((key) => characterKeys.has(key)))
    .map((asset, index) => {
      const text = [
        asset.id,
        asset.name,
        ...(asset.sourceRefs || []),
        ...assetUsedByShotIds(asset),
        ...(asset.textConstraints || []),
      ].join(" ");
      const explicitOverlap = Array.from(shotIds).filter((shotId) => text.includes(shotId)).length;
      const semanticOverlap = shots.filter((shot) => assetMatchesShotForType(asset, shot, type)).length;
      const lockedBonus = /locked|已锁定/i.test(`${asset.lockedStatus || ""} ${asset.status || ""}`) ? 0.25 : 0;
      const scenePenalty = type === "scene" ? assetSceneSpecificityPenalty(asset) : 0;
      return {
        asset,
        index,
        score: Math.max(explicitOverlap * 2, semanticOverlap) + lockedBonus - scenePenalty,
      };
    })
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .filter((item) => item.score > 0 || type === "scene")
    .slice(0, type === "character" ? 3 : type === "prop" ? 2 : 1)
    .map((item) => item.asset);
}

function assetRefs(workbenchFacts, source, scopedRepoPath, shots) {
  const assets = Array.isArray(workbenchFacts?.visualMemory?.assets) ? workbenchFacts.visualMemory.assets : [];
  const preferred = ["scene", "character", "prop"];
  return preferred.flatMap((type) => {
    const selectedAssets = representativeAssetsOfType(assets, shots, type);
    const fallback = assets.find((item) => item?.type === type && item.path
      && (type !== "character" || !isVehicleControllerLabel([item?.id, item?.name, ...(item?.textConstraints || [])].join(" ")))
      && (type !== "prop" || isStandalonePropReference([item?.id, item?.name, ...(item?.textConstraints || [])].join(" "))));
    // Prop references are high-risk when guessed: a cassette, wheel, or logo can
    // become an extra visible shot if it is uploaded to an unrelated segment.
    // Scenes/characters may fall back because they define the world/identity;
    // props must be explicitly matched to this active video unit.
    const candidates = selectedAssets.length ? selectedAssets : type === "prop" ? [] : fallback ? [fallback] : [];
    return candidates.flatMap((asset) => {
    const relativePath = asString(asset.path).replace(/^\.\//, "");
    let filePath;
    try {
      filePath = scopedRepoPath(relativePath);
    } catch {
      filePath = path.resolve(source.runRootPath, relativePath);
    }
    if (!existsSync(filePath)) {
      filePath = path.resolve(source.runRootPath, relativePath);
    }
    if (!existsSync(filePath)) return [];
    if (statSync(filePath).size > MAX_REFERENCE_IMAGE_BYTES) return [];
    return [{
      role: type === "scene" ? "scene_reference" : type === "character" ? "character_reference" : "prop_reference",
      type,
      name: asString(asset.name || asset.displayName || asset.id, type),
      relativePath,
      filePath,
      sha256: sha256File(filePath),
      mimeType: inferMime(filePath),
    }];
    });
  });
}

function buildStoryboardPrompt(shots, refs, compilePlan) {
  if (compilePlan.strategyId === "omni_reference") return "";
  const ranges = timeRanges(shots);
  const panelRows = storyboardPanelRows(shots, compilePlan);
  const isRapid = compilePlan.strategyId === "storyboard_rapid_cut";
  const primaryPanelCount = storyboardPrimaryPanelCount(shots, compilePlan);
  const lines = (isRapid ? panelRows : ranges).map((row) => {
    const shot = row.shot;
    const label = row.label;
    const index = row.index;
    return [
    `[${String(index).padStart(2, "0")}] ${isRapid ? `${shot.title} / ${row.beatLabel}` : shot.title}`,
    `time range: ${label}`,
    isRapid ? `storyboard panel: ${index}/${primaryPanelCount}` : `primary visible cut: ${index}/${primaryPanelCount}`,
    isRapid ? `source shot panel: ${row.panelWithinShot}/${row.panelCountForShot}` : "",
    `visual brief: ${storyboardShotVisualBrief(shot)}`,
    ].filter(Boolean).join("\n");
  }).join("\n---\n");
  const refLines = refs.map((ref, index) => `Reference image ${index + 1}: ${ref.role} / ${ref.name}.`).join("\n");
  const annotationLines = compilePlan.allowProductionAnnotations
    ? [
        "Production annotation mode is allowed because this is storyboard_rapid_cut.",
        "Use sparse rough hand-drawn production notes only when they improve motion readability.",
        "Color key: RED=camera/lens/framing/camera movement; BLUE=body movement/path/turn; GREEN=prop/cloth/environment/motion-system path; ORANGE=impact/burst/danger; PURPLE=timing/pause/acceleration.",
        "Tiny panel numbers and tiny time ranges may appear inside panel corners, but keep them away from faces, hands, props and silhouettes.",
      ]
    : [
        "Clean reference mode: do not print timecodes, panel numbers, arrows, labels, subtitles, captions, camera marks, color marks, or written notes inside the image.",
        "Use the timing map below only as sidecar planning metadata; communicate direction through staging, gaze, body orientation, prop placement and panel order.",
      ];
  return [
    "Create one 16:9 Japanese TV anime storyboard reference sheet for Seedance video generation.",
    "Use a unified 16:9 storyboard canvas for readability inside the app. The final video ratio is controlled later by the Seedance video request, not by this storyboard canvas.",
    `Compiler mode: ${compilePlan.strategyId} / ${compilePlan.strategyLabel}.`,
    "This is a director planning reference, not final key art, not a proposal board, not a manga page, not a product pitch sheet, and not a production form.",
    ...storyboardLayoutLines(shots, compilePlan),
    isRapid
      ? "Use rough black-and-white pencil / ink storyboard style with low-to-medium detail, visible construction lines, gesture-driven poses, and clear silhouettes."
      : "Use clean but still rough black-and-white pencil / ink anime storyboard style: readable staging, loose construction, clear silhouettes, simple background geometry, and no polished rendering.",
    "Preserve character identity, scene/weather, and prop appearance from attached references, but the storyboard itself controls only composition, staging, action beats, camera rhythm and rough motion.",
    isRapid ? `Contract: storyboardPanels=${primaryPanelCount}; visibleClips=${visibleClipCount(shots, compilePlan)}. Extra storyboard panels are actionBeats only and must not be treated as extra final clips.` : "",
    "Avoid finished illustration quality, photorealism, glossy 3D, rendered materials, heavy lighting detail, and poster composition.",
    ...annotationLines,
    "Character identity safety: do not invent a different hairstyle, bow/ribbon, outfit silhouette, age impression, body type, or face category that conflicts with the character reference.",
    "Prop reference isolation: never draw an uploaded prop reference image as a standalone storyboard panel; only show the prop when it belongs inside the listed cut.",
    refLines,
    "[TIMING MAP]",
    ...(isRapid ? panelRows : ranges).map((row) =>
      `Primary panel ${String(row.index).padStart(2, "0")} / ${row.label}: ${safeSeedanceProviderText(row.shot.title)} / ${isRapid ? safeSeedanceProviderText(row.beatLabel) : safeSeedanceProviderText(row.shot.primaryAction || shotVisualBrief(row.shot))}`
    ),
    "[SHOT PLAN]",
    lines,
    "[ROUTING REASONS]",
    ...compilePlan.reasons.map((reason) => `- ${reason}`),
  ].filter(Boolean).join("\n");
}

function timingPlan(shots, compilePlan) {
  if (compilePlan.strategyId === "storyboard_rapid_cut") {
    const rows = visibleClipRows(shots, compilePlan);
    const total = rows.length;
    return rows.map((row) => {
      const beat = seedanceContinuousShotText(row.beatLabel, compilePlan);
      return `${row.label}: visible cut ${row.index}/${total}, ${safeSeedanceProviderText(row.shot.title)}. ${safeSeedanceProviderText(beat)}`.trim();
    });
  }
  let cursor = 0;
  return shots.map((shot, index) => {
    const start = cursor;
    const end = cursor + shot.durationSeconds;
    cursor = end;
    const time = `${start.toFixed(1)}-${end.toFixed(1)}s`;
    return `${time}: visible cut ${index + 1}/${shots.length}, ${safeSeedanceProviderText(shot.title)}. ${safeSeedanceProviderText(shot.primaryAction || shot.intent || "")}`.trim();
  });
}

function visibleClipRows(shots, compilePlan) {
  const rows = [];
  let cursor = 0;
  let clipIndex = 1;
  for (const shot of shots) {
    const count = rapidVisibleClipCountForShot(shot, compilePlan);
    const slice = shot.durationSeconds / count;
    const beatLabels = rapidPanelBeatLabels(shot, count);
    for (let index = 0; index < count; index += 1) {
      const start = cursor + slice * index;
      const end = index === count - 1 ? cursor + shot.durationSeconds : cursor + slice * (index + 1);
      rows.push({
        index: clipIndex,
        shot,
        start,
        end,
        label: `${start.toFixed(1)}-${end.toFixed(1)}s`,
        beatLabel: beatLabels[index],
        clipWithinShot: index + 1,
        clipCountForShot: count,
        panelCountForShot: rapidPanelCountForShot(shot, compilePlan),
      });
      clipIndex += 1;
    }
    cursor += shot.durationSeconds;
  }
  return rows;
}

function seedanceRapidCameraBrief(shot, compilePlan) {
  return seedanceContinuousShotText(
    String(shot.camera || "").replace(/计划快切|混合快切|快切|镜头|camera/gi, "").trim(),
    compilePlan,
  );
}

function seedanceDirectionRows(shots, compilePlan) {
  if (compilePlan.strategyId === "storyboard_rapid_cut") {
    const rows = visibleClipRows(shots, compilePlan);
    const total = rows.length;
    return rows.map((row) => {
      const shot = row.shot;
      const beat = seedanceContinuousShotText(row.beatLabel, compilePlan);
      return [
        `Visible cut ${row.index}/${total}: ${safeSeedanceProviderText(shot.title)} / ${beat}`,
        `time: ${row.label}`,
        `final visible clip: ${row.clipWithinShot}/${row.clipCountForShot} inside this source shot`,
        `storyboard panels for this source shot: ${row.panelCountForShot}; extra panels are internal action planning only`,
        `action beat: ${beat}`,
        shot.primaryAction ? `source main action: ${safeSeedanceProviderText(shot.primaryAction)}` : "",
        row.clipWithinShot === 1 && shot.trigger ? `trigger: ${safeSeedanceProviderText(shot.trigger)}` : "",
        row.clipWithinShot === row.clipCountForShot && shot.microReaction ? `micro reaction: ${safeSeedanceProviderText(shot.microReaction)}` : "",
        shot.camera ? `camera intent: ${seedanceRapidCameraBrief(shot, compilePlan)}` : "",
        shot.sceneGuidance?.length ? `scene: ${safeSeedanceProviderText(shot.sceneGuidance.join(" / "))}` : "",
        shot.propGuidance?.filter((item) => isStandalonePropReference(item)).length
          ? `objects: ${safeSeedanceProviderText(shot.propGuidance.filter((item) => isStandalonePropReference(item)).join(" / "))}`
          : "",
      ].filter(Boolean).join("\n");
    });
  }
  return shots.map((shot, index) => [
    `Cut ${index + 1}: ${safeSeedanceProviderText(shot.title)}`,
    `duration: ${Number(shot.durationSeconds || 0) || "planned"}s, one continuous clip`,
    `visual: ${compactSeedanceVisualBrief(shot, compilePlan)}`,
    shot.camera ? `camera: ${seedanceShotCamera(shot, compilePlan)}` : "",
    shot.primaryAction ? `action: ${safeSeedanceProviderText(shot.primaryAction)}` : "",
    [shot.trigger ? `trigger: ${safeSeedanceProviderText(shot.trigger)}` : "", shot.microReaction ? `reaction: ${safeSeedanceProviderText(shot.microReaction)}` : ""].filter(Boolean).join("; "),
    shot.characterGuidance?.filter((item) => !isVehicleControllerLabel(item)).length
      ? `character cue: ${safeSeedanceProviderText(shot.characterGuidance.filter((item) => !isVehicleControllerLabel(item)).join(" / "))}`
      : "",
    shot.sceneGuidance?.length ? `environment cue: ${safeSeedanceProviderText(shot.sceneGuidance.join(" / "))}` : "",
    shot.propGuidance?.filter((item) => isStandalonePropReference(item)).length
      ? `object cue: ${safeSeedanceProviderText(shot.propGuidance.filter((item) => isStandalonePropReference(item)).join(" / "))}`
      : "",
  ].filter(Boolean).join("\n"));
}

function seedanceStyleLine(shots, compilePlan) {
  const text = [
    compilePlan?.strategyId,
    ...(shots || []).flatMap((shot) => [
      shot?.rhythmProfile,
      shot?.title,
      shot?.intent,
      shot?.primaryAction,
      shot?.seedanceDirection,
    ]),
  ].filter(Boolean).join(" ");
  const clauses = [
    "Style: original 1990s Japanese TV anime look",
    "restrained color",
    "clean cel shading",
    "soft painted backgrounds",
    "handmade 2D animation feel",
  ];
  if (/comedy_reaction|commercial_short|轻喜剧|喜剧|滑稽|可爱|cute|comedy/i.test(text)) {
    clauses.push("light comedic timing, clear cute expressions, lively but controlled acting");
  } else if (/action_fast_cut|storyboard_rapid_cut|追逐|赛车|战斗|前冲|横切|旋身|跃|快切|action|racing/i.test(text)) {
    clauses.push("clear action readability, sharp acceleration, readable silhouettes, energetic camera rhythm");
  } else if (/quiet_dialogue|anime_emotion|递|对视|沉默|犹豫|微笑|情绪|dialogue|emotion/i.test(text)) {
    clauses.push("quiet emotional restraint, subtle eye and hand acting, natural pauses");
  } else if (/suspense_pressure|悬疑|压迫|雾|消失|suspense/i.test(text)) {
    clauses.push("quiet suspense, controlled pressure, restrained atmosphere");
  } else if (/lyrical_observation|emotion_montage|诗意|观察|抒情|lyrical|montage/i.test(text)) {
    clauses.push("lyrical observation, gentle pacing, clean visual breathing room");
  }
  clauses.push("No photorealism, no glossy 3D, no game render");
  return `${clauses.join(", ")}.`;
}

function buildSeedancePrompt({ shots, refs, durationSeconds, compilePlan, hasStoryboardReference }) {
  const timing = timingPlan(shots, compilePlan);
  const primaryPanelCount = storyboardPrimaryPanelCount(shots, compilePlan);
  const finalVisibleClipCount = visibleClipCount(shots, compilePlan);
  const refOffset = hasStoryboardReference ? 2 : 1;
  const referenceLines = refs.map((ref, index) => {
    const imageIndex = index + refOffset;
    if (ref.type === "scene") {
      return `Use Image ${imageIndex} only as environment reference: location layout, weather, light direction, color temperature. Do not turn it into an extra establishing shot.`;
    }
    if (ref.type === "character") {
      return `Use Image ${imageIndex} only as character identity reference. If the shot only shows hands, back, or partial body, preserve identity through visible cues and do not force a face or full-body shot.`;
    }
    return `Use Image ${imageIndex} only as object appearance reference for ${safeSeedanceProviderText(ref.name)} inside the described action. Do not render it as a catalog image, extra insert, split screen, or standalone clip.`;
  });
  const clipCountLine = hasStoryboardReference
    ? `Create exactly ${finalVisibleClipCount} visible clip(s) in the final video. Use the ${primaryPanelCount} storyboard panel(s) only as internal staging, timing and action-beat guidance.`
    : shots.length === 1
      ? "Create exactly 1 continuous visible clip. Do not create extra visible cuts from reference images."
      : `Create exactly ${shots.length} visible clips in the listed order. Do not create extra visible cuts from reference images.`;
  const storyboardRoleLines = hasStoryboardReference
    ? [
        "Treat Image 1 as a sequential keyframe and choreography map, not as visible artwork, split screen, texture, background, or picture-in-picture content.",
        "Animate the motion between the storyboard poses; preserve panel order and staging logic, but follow the written Timing section for the final visible clip count.",
        "Priority order: Timing and visible clip count > storyboard panel order > scene reference > character identity > object appearance.",
      ]
    : [];
  return [
    `${compilePlan.strategyLabel} video request.`,
    hasStoryboardReference
      ? "Use Image 1 as internal storyboard reference for shot order, framing progression, timing, camera rhythm, and motion planning."
      : "Use the attached references and written direction only.",
    ...storyboardRoleLines,
    clipCountLine,
    hasStoryboardReference && compilePlan.strategyId === "storyboard_rapid_cut"
      ? "If storyboardPanels is greater than visibleClips, the extra storyboard panels are actionBeats only; do not turn them into extra final cuts."
      : "",
    `Total duration: ${durationSeconds}s.`,
    hasStoryboardReference
      ? "Do not render storyboard artifacts: arrows, numbers, panel boxes, borders, notes, labels, time marks, sketch overlays, white margins, logos, watermarks, UI."
      : "No text overlays, subtitles, logos, watermarks, UI, panels, or prompt artifacts.",
    hasStoryboardReference
      ? "If Image 1 contains production annotation colors, interpret them internally only: RED=camera/lens/framing/camera move, BLUE=body movement/path/turn, GREEN=prop/cloth/environment/motion-system path, ORANGE=impact/burst/danger, PURPLE=timing/pause/acceleration."
      : "",
    ...referenceLines,
    "Timing:",
    ...timing,
    compilePlan.strategyId === "storyboard_rapid_cut" ? "Visible cut direction:" : "Shot direction:",
    ...seedanceDirectionRows(shots, compilePlan),
    seedanceStyleLine(shots, compilePlan),
    "No music, no BGM, no subtitles.",
  ].filter(Boolean).join("\n");
}

function referenceBundlePolicy({ shots, refs, compilePlan, hasStoryboardReference }) {
  return {
    schemaVersion: "current_project_reference_bundle_policy_v1",
    videoTaskScope: {
      shotIds: shots.map((shot) => shot.id),
      durationSeconds: shots.reduce((sum, shot) => sum + shot.durationSeconds, 0),
      strategyId: compilePlan.strategyId,
      strategyLabel: compilePlan.strategyLabel,
      oneBundlePerProviderSubmit: true,
    },
    sceneBaseline: {
      role: "location_weather_light_authority",
      reusableAcrossShots: true,
      reusableAcrossCameraAngles: true,
      groupingRule: "Same location, weather, light, time of day, and spatial anchors may share one scene baseline even when framing or camera direction changes.",
      mustNotControl: ["visible cut count", "storyboard grouping", "character identity", "prop catalog"],
      selectedCount: refs.filter((ref) => ref.type === "scene").length,
    },
    storyboardReference: {
      role: "video_task_motion_and_timing_authority",
      generatedForCurrentProviderSubmitOnly: hasStoryboardReference,
      groupingRule: "A storyboard reference belongs to one explicit video generation task or planned sequence, not to every shot in the same scene.",
      mustNotControl: ["scene weather", "scene identity", "character identity", "prop identity"],
    },
    characterReferences: {
      role: "identity_and_silhouette_authority",
      selectedCount: refs.filter((ref) => ref.type === "character").length,
      mustNotControl: ["camera path", "scene weather", "visible cut count"],
    },
    propReferences: {
      role: "object_appearance_authority",
      selectedCount: refs.filter((ref) => ref.type === "prop").length,
      detailRule: "Dependent details such as body parts, object components, weather, light, road shine, mist, reflections, buttons, wheels, pages, screens, and similar sub-parts should stay as constraints on the parent character/object/scene unless they are the actual standalone subject.",
      mustNotControl: ["storyboard panels", "scene background", "visible cut count"],
    },
  };
}

function runCommand(command, args, options) {
  const startedAt = Date.now();
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, options.timeoutMs);
    child.stdout?.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({
        exitCode: null,
        stdout,
        stderr: `${stderr}\n${error instanceof Error ? error.message : String(error)}`,
        timedOut,
        durationMs: Date.now() - startedAt,
      });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ exitCode: code, stdout, stderr, timedOut, durationMs: Date.now() - startedAt });
    });
  });
}

function findVideoFiles(dir) {
  if (!existsSync(dir)) return [];
  const output = [];
  const visit = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) visit(absolute);
      else if (/\.(mp4|mov|webm)$/i.test(entry.name) && statSync(absolute).size > 0) output.push(absolute);
    }
  };
  visit(dir);
  return output.sort();
}

async function downloadDreaminaVideoUrls(videoUrls, videoDir) {
  const downloaded = [];
  for (const [index, videoUrl] of uniqueStrings(videoUrls || []).entries()) {
    try {
      const response = await fetch(videoUrl);
      if (!response.ok) continue;
      const bytes = Buffer.from(await response.arrayBuffer());
      if (!bytes.length) continue;
      const urlPath = new URL(videoUrl).pathname;
      const ext = path.extname(urlPath).replace(/[^.\w-]/g, "").match(/\.(mp4|mov|webm)$/i)?.[0] || ".mp4";
      const filePath = path.join(videoDir, `dreamina-result-${index + 1}${ext.toLowerCase()}`);
      writeFileSync(filePath, bytes);
      if (statSync(filePath).size > 0) downloaded.push(filePath);
    } catch {
      // The provider sometimes returns a signed URL while the CLI skips downloading.
      // Keep the submit id as recoverable rather than turning a download miss into success.
    }
  }
  return downloaded;
}

function readJsonObject(filePath) {
  try {
    const parsed = JSON.parse(readFileSync(filePath, "utf8"));
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function readJsonFile(filePath) {
  return readJsonObject(filePath);
}

function writeJsonObject(filePath, value) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function upsertStoryboardReferenceAsset(source, input) {
  if (!input?.hasStoryboardReference || !input.storyboardFilePath || !existsSync(input.storyboardFilePath)) return;
  const visualMemoryPath = source?.visualMemoryPath;
  if (!visualMemoryPath) return;
  const visualMemory = readJsonObject(visualMemoryPath);
  const existingAssets = Array.isArray(visualMemory.assets) ? visualMemory.assets : [];
  const assetId = `storyboard_reference_${safePathSegment(input.runId)}`;
  const now = input.generatedAt || new Date().toISOString();
  const storyboardAsset = {
    id: assetId,
    assetId,
    displayName: "本次故事板参考",
    name: "本次故事板参考",
    assetType: "prop",
    type: "storyboard_reference",
    status: "needs_review",
    visualMemoryStatus: "needs_review",
    lockedStatus: "needs_review",
    path: input.storyboardFilePath,
    mainReferencePath: input.storyboardFilePath,
    usedByShotIds: input.shots.map((shot) => shot.id),
    textConstraints: [
      "故事板参考：用于构图、动作、切镜节奏，不替代角色和场景设定。",
    ],
    sourceKind: "provider_temp_output",
    generatedBy: {
      providerId: input.providerId,
      providerSlot: "image.storyboard_reference",
      providerOperation: "image.generate",
      generatedAt: now,
      outputSha256: input.storyboardSha256,
    },
    referenceAuthority: {
      lockedStatus: "needs_review",
      canUseAsFutureReference: false,
      updatedAt: now,
    },
    updatedAt: now,
  };
  visualMemory.assets = [
    ...existingAssets.filter((asset) => asset?.id !== assetId && asset?.assetId !== assetId),
    storyboardAsset,
  ];
  writeJsonObject(visualMemoryPath, visualMemory);
}

// Clean up video run directories older than maxAgeMs (default 24 hours).
// Each submit creates dirs named seedance_YYYY-MM-DDTHH-MM-SS-SSSZ (ISO with :/. replaced by -).
// Only removes these seedance_* directories; ignores other content in the video/ root.
function cleanupOldVideoRuns(videoRoot, maxAgeMs = 24 * 60 * 60 * 1000) {
  if (!existsSync(videoRoot)) return;
  const seedancePrefix = "seedance_";
  let entries;
  try { entries = readdirSync(videoRoot, { withFileTypes: true }); } catch { return; }
  const now = Date.now();
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (!entry.name.startsWith(seedancePrefix)) continue;
    // Parse timestamp from dir name: seedance_2026-05-23T12-34-56-789Z
    const ts = entry.name.slice(seedancePrefix.length);
    const tIndex = ts.indexOf("T");
    if (tIndex === -1) continue;
    const datePart = ts.slice(0, tIndex); // already valid ISO date (YYYY-MM-DD)
    const timePart = ts.slice(tIndex + 1).replace(/Z$/i, ""); // HH-MM-SS-SSS
    // Convert time: HH-MM-SS-SSS -> HH:MM:SS.SSSZ
    const segments = timePart.split("-");
    if (segments.length < 3) continue;
    const isoString = `${datePart}T${segments[0]}:${segments[1]}:${segments[2]}.${segments.slice(3).join("")}Z`;
    const mtimeMs = Date.parse(isoString);
    if (Number.isNaN(mtimeMs)) continue;
    if (now - mtimeMs < maxAgeMs) continue;
    try {
      rmSync(path.join(videoRoot, entry.name), { recursive: true, force: true });
    } catch {
      // Best-effort cleanup; skip directories we cannot remove.
    }
  }
}

const ALLOWED_CLI_NAMES = new Set(["dreamina"]);

function validateCliPath(raw) {
  const trimmed = asString(raw, "dreamina");
  const basename = path.basename(trimmed);
  if (!ALLOWED_CLI_NAMES.has(basename)) return "dreamina";
  return trimmed;
}

function seedanceSubmitRequestInput(body) {
  const input = unwrapRequestJsonBody(body);
  const confirmation = isRecord(input?.confirmation) ? input.confirmation : {};
  return {
    confirmation,
    modelVersion: asString(input?.modelVersion, DEFAULT_MODEL_VERSION),
    videoResolution: asString(input?.videoResolution, JIMENG_VIDEO_DEFAULT_RESOLUTION),
    ratio: asString(input?.ratio, DEFAULT_RATIO),
    durationSeconds: asNumber(input?.durationSeconds, undefined),
    pollSeconds: Math.max(30, Math.floor(asNumber(input?.pollSeconds, DEFAULT_POLL_SECONDS))),
    providerId: asString(input?.providerId, APIKEY_FUN_RESPONSES_IMAGE_PROVIDER_ID),
    selectedShotIds: textArray(input?.selectedShotIds),
    mockProviderResult: input?.mockProviderResult === true,
    cliPath: validateCliPath(input?.cliPath || process.env.VIBE_JIMENG_CLI_PATH),
  };
}

export function createRuntimeApiCurrentProjectSeedanceSubmit(deps) {
  const {
    endpoint,
    repoRoot,
    currentProjectRouteContext,
    readProjectFacts,
    currentProjectWorkbenchFacts,
    getProviderApiKey,
    getProviderConfigStatuses,
    requestOverrideDiagnostics,
    runtimePolicy,
    scopedRepoPath,
    sha256Bytes: sha256BytesDep,
    writeCurrentProjectRuntimeBytes,
    writeCurrentProjectRuntimeJson,
    writeJson,
    mkdirSync: mkdirSyncDep = mkdirSync,
    running,
    setRunning,
  } = deps;

  // Promise-based lock to close the TOCTOU race on maxConcurrentVideoJobs: 1.
  // Replaces the boolean running flag so that the check-and-acquire are atomic
  // within a single synchronous tick: any concurrent request that arrives after
  // the lock is taken will wait for the previous holder to finish.
  let submitLockPromise = null;

  function runtimeState() {
    return Boolean(submitLockPromise);
  }

  async function currentProjectSeedanceSubmitResponse(input, extra = {}, source) {
    const submittedAt = new Date().toISOString();
    const projectFacts = readProjectFacts(source);
    const workbenchFacts = currentProjectWorkbenchFacts(source, projectFacts);
    const allShots = storyShots(projectFacts, workbenchFacts);
    const selectedShotIds = textArray(input.selectedShotIds);
    const referenceSegments = contiguousReferenceSegments(allShots);
    const relayQueueRelPath = `${source.runRootRelativePath}/reports/video_relay_queue.json`;
    let relayQueuePath;
    try {
      relayQueuePath = scopedRepoPath(relayQueueRelPath);
    } catch {
      relayQueuePath = path.resolve(source.runRootPath, "reports/video_relay_queue.json");
    }
    const existingRelayQueue = readJsonFile(relayQueuePath);
    const segmentChoice = chooseSegmentForSubmission({
      segments: referenceSegments,
      existingQueue: existingRelayQueue,
      selectedShotIds,
    });
    const activeSegment = segmentChoice.activeSegment;
    const shots = activeSegment?.shots || allShots;
    const segmentDurationSeconds = shots.reduce((sum, shot) => sum + shot.durationSeconds, 0) || 12;
    const useRequestedDuration = referenceSegments.length <= 1 || selectedShotIds.length > 1;
    const durationSeconds = Math.round(asNumber(useRequestedDuration ? input.durationSeconds : undefined, segmentDurationSeconds));
    const providerStatuses = getProviderConfigStatuses();
    const providerConfig = providerConfigFor(providerStatuses, input.providerId);
    const apiKey = getProviderApiKey(input.providerId);
    const confirmationOk = input.confirmation?.confirmed === true
      && input.confirmation?.phrase === CONFIRM_PHRASE
      && Boolean(asString(input.confirmation?.receiptId))
      && Boolean(asString(input.confirmation?.confirmedAt));
    const refs = assetRefs(workbenchFacts, source, scopedRepoPath, shots);
    const segmentPlan = referenceSegments.map((segment) => ({
      id: segment.id,
      sceneClusterKey: segment.sceneClusterKey,
      sceneLabel: segment.sceneLabel,
      shotIds: segment.shots.map((shot) => shot.id),
      durationSeconds: segment.durationSeconds,
      active: activeSegment?.id === segment.id,
    }));

    const baseRelayQueue = relayQueueForSegments({
      segments: referenceSegments,
      existingQueue: existingRelayQueue,
      input,
      generatedAt: submittedAt,
      activeSegmentId: undefined,
      activeUpdate: undefined,
    });

    // Prune old video run directories before creating a new one.
    const videoRoot = scopedRepoPath(`${source.runRootRelativePath}/video`);
    cleanupOldVideoRuns(videoRoot);

    if (submitLockPromise) {
      return {
        ok: false,
        ...runtimePolicy({
          runMode: "current_project_seedance_submit",
          providerCalled: false,
          liveSubmitAllowed: false,
          workerSpawnForbidden: true,
          dryRunOnly: true,
        }),
        endpoint,
        status: "blocked",
        uiStatus: "blocked",
        providerCalled: false,
        runtimeExternalNetworkCallMade: false,
        storyboardGenerated: false,
        videoSubmitted: false,
        blockers: ["当前已经有任务在运行，请稍后再提交。"],
        relayQueue: baseRelayQueue,
        message: "当前已经有任务在运行，请稍后再提交。",
        ...extra,
      };
    }

    const blockers = uniqueStrings([
      shots.length ? "" : "当前项目没有可提交的视频镜头。",
      segmentChoice.blockedByActive ? `已有视频段正在排队或生成：${segmentChoice.blockedByActive.title || segmentChoice.blockedByActive.id}` : "",
      confirmationOk ? "" : "需要确认后才能提交视频。",
      providerConfig ? "" : "未找到故事板生成服务配置。",
      providerConfig?.credential?.keyStatus === "configured" && apiKey ? "" : "请先在设置里保存生成服务 Key。",
      input.videoResolution === "720p" ? "" : "当前分辨率配置为 720p，避免误触高成本分辨率。",
      input.modelVersion === DEFAULT_MODEL_VERSION ? "" : "当前仅支持普通 Seedance 2.0 提交，不使用 VIP。",
    ]);
    const runId = `seedance_${new Date().toISOString().replace(/[:.]/g, "-")}`;
    const outputRoot = `${source.runRootRelativePath}/video/${runId}`;
    const receiptsRoot = `${outputRoot}/receipts`;
    const storyboardRelPath = `${outputRoot}/inputs/storyboard_reference.png`;
    const promptRelPath = `${receiptsRoot}/seedance_prompt.md`;
    const storyboardPromptRelPath = `${receiptsRoot}/storyboard_prompt.md`;
    const submitLogRelPath = `${receiptsRoot}/dreamina-submit.json`;
    const reportRelPath = `${source.runRootRelativePath}/reports/seedance_submit_report.json`;
    const previewPlanRelPath = source.previewPlanRelativePath;
    let previewPlanPath;
    try {
      previewPlanPath = scopedRepoPath(previewPlanRelPath);
    } catch {
      previewPlanPath = path.resolve(source.runRootPath, "reports/preview_plan.json");
    }
    const existingPreviewPlan = readJsonFile(previewPlanPath);

    if (blockers.length > 0) {
      return {
        ok: false,
        ...runtimePolicy({
          runMode: "current_project_seedance_submit",
          providerCalled: false,
          liveSubmitAllowed: false,
          workerSpawnForbidden: true,
          dryRunOnly: true,
        }),
        endpoint,
        status: "blocked",
        uiStatus: "blocked",
        providerCalled: false,
        runtimeExternalNetworkCallMade: false,
        storyboardGenerated: false,
        videoSubmitted: false,
        blockers,
        relayQueue: baseRelayQueue,
        message: blockers[0],
        ...extra,
      };
    }

    // Acquire the submit lock only after cheap validation succeeds. Otherwise
    // a blocked request (missing key, missing confirmation, active queued
    // segment) would return before the finally block and leave the lock stuck.
    let releaseSubmitLock;
    submitLockPromise = new Promise(resolve => { releaseSubmitLock = resolve; });

    try {
      const compilePlan = sequenceCompilePlan(shots, refs);

      // Music may drive the edit rhythm or final export mix, but provider video
      // generation must stay no-BGM. Keep the source planning text valid and
	      // strip music wording when compiling the Seedance prompt.

	      const hasStoryboardReference = compilePlan.strategyId !== "omni_reference";
	      const storyboardOutputSize = IMAGE2_GENERATE_DEFAULT_SIZE;
	      const storyboardPrompt = buildStoryboardPrompt(shots, refs, compilePlan);
	      const seedancePrompt = buildSeedancePrompt({
	        shots,
	        refs,
	        durationSeconds,
	        compilePlan,
	        hasStoryboardReference,
	      });
	      const referenceBundle = referenceBundlePolicy({
	        shots,
	        refs,
	        compilePlan,
	        hasStoryboardReference,
	      });
      const ruleQaReportRelPath = `${receiptsRoot}/director-rule-qa.json`;
      const textQaReportRelPath = `${receiptsRoot}/director-text-qa.json`;
      const ruleQaReport = runDirectorRuleQa({
        shots,
        assets: refs.map((ref) => ({
          id: ref.name,
          kind: ref.type,
          label: ref.name,
          usedByShotIds: shots.map((shot) => shot.id),
          sourceRefs: [ref.relativePath],
        })),
        seedancePrompts: [{
          compilerMode: compilePlan.strategyId,
          visibleClips: visibleClipCount(shots, compilePlan),
          storyboardPanels: hasStoryboardReference ? storyboardPrimaryPanelCount(shots, compilePlan) : 0,
          durationSeconds,
          prompt: seedancePrompt,
        }],
        targetDurationSeconds: durationSeconds,
      });
      writeCurrentProjectRuntimeJson(ruleQaReportRelPath, ruleQaReport, source);
      if (ruleQaReport.status === "blocked") {
        const report = {
          ok: false,
          ...runtimePolicy({
            runMode: "current_project_seedance_submit",
            providerCalled: false,
            liveSubmitAllowed: false,
            workerSpawnForbidden: true,
            dryRunOnly: true,
          }),
          endpoint,
          status: "rule_qa_blocked",
          uiStatus: "blocked",
          providerCalled: false,
          runtimeExternalNetworkCallMade: false,
          storyboardGenerated: false,
          videoSubmitted: false,
          outputRoot,
          compilerMode: compilePlan.strategyId,
          compilerModeLabel: compilePlan.strategyLabel,
          activeSegmentId: activeSegment?.id,
          segmentPlan,
          ruleQaReportPath: ruleQaReportRelPath,
          ruleQaReport,
          blockers: ruleQaReport.findings
            .filter((finding) => finding.severity === "blocker")
            .map((finding) => finding.message),
          message: ruleQaReport.findings.find((finding) => finding.severity === "blocker")?.message
            || "提交前检查发现需要先修复的问题。",
          ...extra,
        };
        writeCurrentProjectRuntimeJson(reportRelPath, report, source);
        return report;
      }
      const textQaReport = await runDirectorTextQaForRuntime({
        input: {
          shots,
          assets: refs.map((ref) => ({
            id: ref.name,
            kind: ref.type,
            label: ref.name,
            usedByShotIds: shots.map((shot) => shot.id),
          })),
          compilerMode: compilePlan.strategyId,
          compilerModeLabel: compilePlan.strategyLabel,
          compilerReasons: compilePlan.reasons,
          durationSeconds,
          visibleClips: visibleClipCount(shots, compilePlan),
          storyboardPanels: hasStoryboardReference ? storyboardPrimaryPanelCount(shots, compilePlan) : 0,
          seedancePrompt,
          storyboardPrompt,
          styleIntent: seedanceStyleLine(shots, compilePlan),
          userIntent: shots.map((shot) => `${shot.id} ${shot.title}: ${shot.intent}`).join("\n"),
          ruleQaReport,
        },
        getProviderApiKey,
        getProviderConfigStatuses,
        mockProviderResult: input.mockProviderResult,
      });
      writeCurrentProjectRuntimeJson(textQaReportRelPath, textQaReport, source);
      if (textQaReport.status === "blocked") {
        const report = {
          ok: false,
          ...runtimePolicy({
            runMode: "current_project_seedance_submit",
            providerCalled: textQaReport.providerCalled,
            liveSubmitAllowed: false,
            workerSpawnForbidden: true,
            dryRunOnly: true,
          }),
          endpoint,
          status: "text_qa_blocked",
          uiStatus: "blocked",
          providerCalled: textQaReport.providerCalled,
          runtimeExternalNetworkCallMade: textQaReport.runtimeExternalNetworkCallMade,
          storyboardGenerated: false,
          videoSubmitted: false,
          outputRoot,
          compilerMode: compilePlan.strategyId,
          compilerModeLabel: compilePlan.strategyLabel,
          activeSegmentId: activeSegment?.id,
          segmentPlan,
          ruleQaReportPath: ruleQaReportRelPath,
          ruleQaReport,
          textQaReportPath: textQaReportRelPath,
          textQaReport,
          blockers: textQaReport.findings
            .filter((finding) => finding.severity === "blocker")
            .map((finding) => finding.message),
          message: textQaReport.findings.find((finding) => finding.severity === "blocker")?.message
            || textQaReport.summary
            || "文本 QA 认为这次提交需要先修复。",
          ...extra,
        };
        writeCurrentProjectRuntimeJson(reportRelPath, report, source);
        return report;
      }
      if (hasStoryboardReference) {
        writeCurrentProjectRuntimeBytes(storyboardPromptRelPath, Buffer.from(storyboardPrompt), source);
      }
      const referenceImages = refs.map((ref) => {
        if (statSync(ref.filePath).size > MAX_REFERENCE_IMAGE_BYTES) {
          throw new Error(`Reference image "${ref.name}" exceeds the maximum allowed size of ${MAX_REFERENCE_IMAGE_BYTES / (1024 * 1024)}MB.`);
        }
        return {
          name: path.basename(ref.filePath),
          path: ref.filePath,
          mimeType: ref.mimeType,
          bytes: readFileSync(ref.filePath),
        };
      });
      const storyboardResult = hasStoryboardReference
        ? input.mockProviderResult
          ? {
            ok: true,
            bytes: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=", "base64"),
            providerId: input.providerId,
            requestedModel: providerConfig.imageModel || APIKEY_FUN_RESPONSES_IMAGE_DEFAULT_MODEL,
            providerRequestId: `mock_storyboard_${Date.now()}`,
            metadata: { mockProviderResult: true, referenceInputCount: referenceImages.length },
          }
          : await fetchStoryboardReferenceImage({
            apiKey,
	            endpoint: providerConfig.baseUrl || APIKEY_FUN_RESPONSES_IMAGE_DEFAULT_BASE_URL,
	            model: providerConfig.imageModel || APIKEY_FUN_RESPONSES_IMAGE_DEFAULT_MODEL,
	            prompt: storyboardPrompt,
	            size: storyboardOutputSize,
            quality: "low", // intentional default to keep storyboard generation cost predictable
            stream: true,
            referenceImages,
            timeoutMs: 8 * 60 * 1000,
          })
        : {
          ok: true,
          bytes: undefined,
          providerId: input.providerId,
          requestedModel: providerConfig.imageModel || APIKEY_FUN_RESPONSES_IMAGE_DEFAULT_MODEL,
          providerRequestId: undefined,
          metadata: { omittedStoryboardReference: true, referenceInputCount: referenceImages.length },
        };

      if (!storyboardResult.ok) {
        const report = {
          ok: false,
          ...runtimePolicy({
            runMode: "current_project_seedance_submit",
            providerCalled: true,
            liveSubmitAllowed: false,
            workerSpawnForbidden: true,
          }),
          endpoint,
          status: "storyboard_failed",
          uiStatus: "blocked",
          providerCalled: true,
          runtimeExternalNetworkCallMade: true,
          storyboardGenerated: false,
          videoSubmitted: false,
          message: storyboardResult.message || "故事板参考生成失败，可以稍后重试。",
          failure: {
            statusCode: storyboardResult.statusCode,
            errorType: storyboardResult.errorType,
            diagnostic: storyboardResult.diagnostic,
          },
        };
        writeCurrentProjectRuntimeJson(reportRelPath, report, source);
        return report;
      }

      const storyboardFilePath = hasStoryboardReference
        ? writeCurrentProjectRuntimeBytes(storyboardRelPath, storyboardResult.bytes, source)
        : undefined;
      const storyboardSha256 = hasStoryboardReference
        ? (typeof sha256BytesDep === "function" ? sha256BytesDep(storyboardResult.bytes) : sha256Bytes(storyboardResult.bytes))
        : undefined;
      upsertStoryboardReferenceAsset(source, {
        hasStoryboardReference,
        storyboardFilePath,
        storyboardSha256,
        generatedAt: submittedAt,
        providerId: input.providerId,
        runId,
        shots,
      });
	      writeCurrentProjectRuntimeBytes(promptRelPath, Buffer.from(seedancePrompt), source);
	      writeCurrentProjectRuntimeJson(`${receiptsRoot}/input-manifest.json`, {
	        schemaVersion: "current_project_seedance_submit_input_manifest_v1",
	        submittedAt,
		        modelVersion: input.modelVersion,
		        videoResolution: input.videoResolution,
		        ratio: input.ratio,
		        storyboardAspectRatio: DEFAULT_RATIO,
		        storyboardOutputSize,
	        durationSeconds,
        activeSegmentId: activeSegment?.id,
        segmentPlan,
	        compilerMode: compilePlan.strategyId,
	        compilerModeLabel: compilePlan.strategyLabel,
        compilerReasons: compilePlan.reasons,
        ruleQaReportPath: ruleQaReportRelPath,
        ruleQaStatus: ruleQaReport.status,
        textQaReportPath: textQaReportRelPath,
        textQaStatus: textQaReport.status,
	        referenceBundle,
	        shotStrategies: compilePlan.shotPlans.map((plan) => ({
	          shotId: plan.shotId,
	          strategyId: plan.strategyId,
	          strategyLabel: plan.strategyLabel,
          rhythmProfile: plan.rhythmProfile,
          splitPolicy: plan.splitPolicy,
          panelCountIntent: plan.panelCountIntent,
        })),
        storyboardReferencePath: hasStoryboardReference ? storyboardRelPath : undefined,
        storyboardReferenceSha256: storyboardSha256,
        referenceImageCount: refs.length,
        references: refs.map((ref) => ({
          role: ref.role,
          name: ref.name,
          path: ref.relativePath,
          sha256: ref.sha256,
        })),
        shots: shots.map((shot) => ({
          id: shot.id,
          title: shot.title,
          durationSeconds: shot.durationSeconds,
          primaryAction: shot.primaryAction,
        })),
      }, source);

      const activeReferencePaths = [
        ...(hasStoryboardReference ? [storyboardRelPath] : []),
        ...refs.map((ref) => ref.relativePath),
      ];
      const inputImages = [
        ...(hasStoryboardReference ? [{ role: "storyboard_reference", filePath: storyboardFilePath }] : []),
        ...refs.map((ref) => ({ role: ref.role, filePath: ref.filePath })),
      ];
      const videoDirRelPath = `${outputRoot}/video`;
      const videoDir = scopedRepoPath(videoDirRelPath);
      mkdirSyncDep(videoDir, { recursive: true });
      const args = [
        "multimodal2video",
        ...inputImages.flatMap((image) => ["--image", image.filePath]),
        "--prompt", seedancePrompt,
        "--duration", String(durationSeconds),
        "--ratio", input.ratio,
        "--video_resolution", input.videoResolution,
        "--model_version", input.modelVersion,
        "--poll", String(input.pollSeconds),
      ];
	      writeCurrentProjectRuntimeJson(`${receiptsRoot}/submit-plan.json`, {
		        schemaVersion: "current_project_seedance_submit_plan_v1",
		        command: input.cliPath,
		        args,
	        expectedQueueWaitMinutes: 50,
	        maxConcurrentVideoJobs: 1,
	        referenceBundle,
	        activeSegmentId: activeSegment?.id,
	        segmentPlan,
		        rawSecretStored: false,
		      }, source);

      const queueingRelayQueue = relayQueueForSegments({
        segments: referenceSegments,
        existingQueue: existingRelayQueue,
        input,
        generatedAt: submittedAt,
        activeSegmentId: activeSegment?.id,
        activeUpdate: {
          status: "submitted",
          attempted: true,
          promptPath: promptRelPath,
          referencePaths: activeReferencePaths,
          note: "本段已开始提交给即梦，等待任务号或视频回流。",
        },
      });
      writeCurrentProjectRuntimeJson(relayQueueRelPath, queueingRelayQueue, source);
      writeCurrentProjectRuntimeJson(`${receiptsRoot}/submit-progress.json`, {
        schemaVersion: "current_project_seedance_submit_progress_v1",
        phase: "waiting_for_provider_task",
        startedAt: submittedAt,
        activeSegmentId: activeSegment?.id,
        promptPath: promptRelPath,
        referencePaths: activeReferencePaths,
        relayQueuePath: relayQueueRelPath,
        rawSecretStored: false,
      }, source);

      // CLI timeout: minimum 300s (5 min) so the submit command has enough time to queue and receive its task ID.
      // The backend queue may take up to 50 minutes but the CLI returns a task ID after accepting the job.
      const submit = await runCommand(input.cliPath, args, {
        cwd: repoRoot,
        timeoutMs: Math.max(300, input.pollSeconds + 60) * 1000,
      });
      writeCurrentProjectRuntimeJson(submitLogRelPath, {
        command: input.cliPath,
        args,
        exitCode: submit.exitCode,
        timedOut: submit.timedOut,
        durationMs: submit.durationMs,
        stdout: redact(submit.stdout),
        stderr: redact(submit.stderr),
        rawSecretStored: false,
      }, source);
      const taskInfo = extractDreaminaTaskInfo(submit.stdout, submit.stderr);
      let videoFiles = findVideoFiles(videoDir);
      if (!videoFiles.length && taskInfo.videoUrls?.length) {
        await downloadDreaminaVideoUrls(taskInfo.videoUrls, videoDir);
        videoFiles = findVideoFiles(videoDir);
      }
      const normalizedStatus = normalizeDreaminaStatus(taskInfo.status || (taskInfo.submitId ? "submitted" : "unknown"));
      const status = videoFiles.length
        ? "success"
        : normalizedStatus === "success" && taskInfo.submitId
          ? "recoverable_queued"
          : normalizedStatus;
      if (submit.exitCode !== 0 && !taskInfo.submitId && !videoFiles.length) {
        const relayQueue = relayQueueForSegments({
          segments: referenceSegments,
          existingQueue: existingRelayQueue,
          input,
          generatedAt: submittedAt,
          activeSegmentId: activeSegment?.id,
          activeUpdate: {
            status: "failed",
            attempted: true,
            promptPath: promptRelPath,
            referencePaths: activeReferencePaths,
            blockers: ["Seedance 提交失败，请检查即梦 CLI 登录状态。"],
            note: "提交失败，未进入下一个视频段。",
          },
        });
        writeCurrentProjectRuntimeJson(relayQueueRelPath, relayQueue, source);
        const report = {
          ok: false,
          ...runtimePolicy({
            runMode: "current_project_seedance_submit",
            providerCalled: true,
            liveSubmitAllowed: true,
            workerSpawnForbidden: true,
          }),
          endpoint,
        status: "submit_failed",
          uiStatus: "blocked",
          providerCalled: true,
          runtimeExternalNetworkCallMade: true,
          storyboardGenerated: true,
          videoSubmitted: false,
          outputRoot,
          storyboardReferencePath: hasStoryboardReference ? storyboardRelPath : undefined,
          promptPath: promptRelPath,
          submitLogPath: submitLogRelPath,
          compilerMode: compilePlan.strategyId,
          activeSegmentId: activeSegment?.id,
          segmentPlan,
          relayQueuePath: relayQueueRelPath,
          relayQueue,
          message: redact(submit.stderr || submit.stdout) || "Seedance 提交失败，请检查即梦 CLI 登录状态。",
        };
        writeCurrentProjectRuntimeJson(reportRelPath, report, source);
        return report;
      }

      const outputVideoFilePath = videoFiles[0];
      const outputVideoPath = outputVideoFilePath
        ? path.relative(source.runRootPath, outputVideoFilePath).replace(/\\/g, "/")
        : undefined;
      const outputVideoSha256 = outputVideoFilePath ? sha256File(outputVideoFilePath) : undefined;
      const statusForUi = status === "success" ? "needs_review" : status === "timed_out" || status === "recoverable_queued" ? "submitted" : status;
      const resumeCommand = taskInfo.submitId ? jimengResumeCommand({ submitId: taskInfo.submitId, downloadDir: videoDir, cliPath: input.cliPath }) : undefined;
      const relayStatus = relayStatusFromSeedance(status, outputVideoPath);
      const relayQueue = relayQueueForSegments({
        segments: referenceSegments,
        existingQueue: existingRelayQueue,
        input,
        generatedAt: submittedAt,
        activeSegmentId: activeSegment?.id,
        activeUpdate: {
          status: relayStatus,
          attempted: true,
          promptPath: promptRelPath,
	          referencePaths: activeReferencePaths,
          submitId: taskInfo.submitId,
          resumeCommand,
          outputVideoPath,
          outputVideoSha256,
          localMediaPaths: outputVideoPath ? [outputVideoPath] : [],
          note: outputVideoPath ? "本段视频已回流，仍需复核。" : "本段已提交给即梦，等待回流。",
        },
      });
      writeCurrentProjectRuntimeJson(relayQueueRelPath, relayQueue, source);
      const relayQueueItemId = segmentItemId(activeSegment);
      const videoItemId = `seedance_storyboard_video_${activeSegment?.id || safePathSegment(runId)}`;
      const belongsToActiveSegment = (item) => item?.segmentId === activeSegment?.id || item?.relayQueueItemId === relayQueueItemId;
      const previousClips = Array.isArray(existingPreviewPlan?.clips)
        ? existingPreviewPlan.clips.filter((item) => !belongsToActiveSegment(item))
        : [];
      const previousPreviewItems = Array.isArray(existingPreviewPlan?.previewItems)
        ? existingPreviewPlan.previewItems.filter((item) => !belongsToActiveSegment(item))
        : [];
      const currentClip = {
        id: videoItemId,
        clipId: videoItemId,
        order: previousClips.length + 1,
        shotId: shots[0]?.id,
        mediaType: "video",
        mediaPath: outputVideoPath,
        durationSeconds,
        status: outputVideoPath ? "returned_with_review_overlay" : statusForUi,
        videoStatus: status,
        submitId: taskInfo.submitId,
        taskId: taskInfo.taskId,
        queueInfo: taskInfo.queueInfo,
        relayQueueItemId,
        segmentId: activeSegment?.id,
        segmentShotIds: shots.map((shot) => shot.id),
        localMediaPaths: outputVideoPath ? [outputVideoPath] : [],
      };
      const currentPreviewItem = {
        id: videoItemId,
        order: previousPreviewItems.length + 1,
        shotId: shots[0]?.id,
        mediaPath: outputVideoPath,
        status: outputVideoPath ? "returned_with_review_overlay" : statusForUi,
        videoStatus: status,
        submitId: taskInfo.submitId,
        taskId: taskInfo.taskId,
        queueInfo: taskInfo.queueInfo,
        relayQueueItemId,
        segmentId: activeSegment?.id,
        segmentShotIds: shots.map((shot) => shot.id),
        localMediaPaths: outputVideoPath ? [outputVideoPath] : [],
        reviewRequired: Boolean(outputVideoPath),
      };
      const previewPlan = {
        schemaVersion: "current_project_seedance_preview_plan_v1",
        generatedAt: submittedAt,
        status: statusForUi,
        previewStatus: outputVideoPath ? "returned_with_review_overlay" : statusForUi,
        productionStatus: outputVideoPath ? "needs_review" : "submitted",
        totalDurationSeconds: durationSeconds,
        activeSegmentId: activeSegment?.id,
        segmentPlan,
        relayQueuePath: relayQueueRelPath,
        relayQueue,
        clips: [...previousClips, currentClip].map((clip, index) => ({ ...clip, order: index + 1 })),
        previewItems: [...previousPreviewItems, currentPreviewItem].map((item, index) => ({ ...item, order: index + 1 })),
        storyboardReferences: hasStoryboardReference ? [{
          id: `storyboard_reference_${safePathSegment(runId)}`,
          name: "本次故事板参考",
          mediaPath: storyboardRelPath,
          status: "needs_review",
          sourceKind: "provider_temp_output",
        }] : [],
      };
      writeCurrentProjectRuntimeJson(previewPlanRelPath, previewPlan, source);

      const report = {
        ok: true,
        ...runtimePolicy({
          runMode: "current_project_seedance_submit",
          providerCalled: true,
          liveSubmitAllowed: true,
          workerSpawnForbidden: true,
        }),
        endpoint,
        status,
        uiStatus: statusForUi,
        providerCalled: true,
        runtimeExternalNetworkCallMade: true,
        storyboardGenerated: true,
        videoSubmitted: Boolean(taskInfo.submitId || videoFiles.length),
        outputRoot,
        compilerMode: compilePlan.strategyId,
        compilerModeLabel: compilePlan.strategyLabel,
        compilerReasons: compilePlan.reasons,
        ruleQaReportPath: ruleQaReportRelPath,
        ruleQaStatus: ruleQaReport.status,
        textQaReportPath: textQaReportRelPath,
        textQaStatus: textQaReport.status,
        activeSegmentId: activeSegment?.id,
        segmentPlan,
        relayQueuePath: relayQueueRelPath,
        relayQueue,
        storyboardReferencePath: hasStoryboardReference ? storyboardRelPath : undefined,
        storyboardReferenceSha256: storyboardSha256,
        promptPath: promptRelPath,
        storyboardPromptPath: hasStoryboardReference ? storyboardPromptRelPath : undefined,
        submitLogPath: submitLogRelPath,
        previewPlanPath: previewPlanRelPath,
        submitId: taskInfo.submitId,
        taskId: taskInfo.taskId,
        queueInfo: taskInfo.queueInfo,
        outputVideoPath,
        outputVideoSha256,
        resumeCommand,
        message: outputVideoPath
          ? relayQueue.autoSubmitAllowed
            ? "本段视频已回流，下一段已准备好，可以继续提交。"
            : "视频已回流，等待复核。"
          : referenceSegments.length > 1
            ? `已提交第 ${referenceSegments.findIndex((segment) => segment.id === activeSegment?.id) + 1}/${referenceSegments.length} 段；不同场景会分段处理，回来后继续下一段。`
            : "视频已提交，即梦排队中；可以稍后恢复查询。",
      };
      writeCurrentProjectRuntimeJson(reportRelPath, report, source);
      return report;
    } finally {
      if (releaseSubmitLock) { releaseSubmitLock(); submitLockPromise = null; }
    }
  }

  async function handleCurrentProjectSeedanceSubmitRoute(req, res, url) {
    if (req.method !== "POST" || url.pathname !== endpoint) return false;
    const routeContext = await currentProjectRouteContext(req, res, url, endpoint);
    if (!routeContext) return true;
    const input = seedanceSubmitRequestInput(routeContext.body);
    const payload = await currentProjectSeedanceSubmitResponse(input, {
      running: runtimeState(),
      ignoredRequestContext: requestOverrideDiagnostics(routeContext.requestContext),
    }, routeContext.source);
    writeJson(res, payload.ok === false ? 409 : 200, payload);
    return true;
  }

  return {
    seedanceSubmitRequestInput,
    currentProjectSeedanceSubmitResponse,
    handleCurrentProjectSeedanceSubmitRoute,
  };
}
