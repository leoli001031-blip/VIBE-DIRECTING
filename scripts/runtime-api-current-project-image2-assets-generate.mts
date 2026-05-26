import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { IMAGE2_GENERATE_DEFAULT_ASPECT_RATIO, IMAGE2_GENERATE_DEFAULT_SIZE } from "../src/core/providerPolicy.ts";
import {
  isParentObjectReference,
  isStandalonePropReference,
  referenceAssetCandidates,
  referenceConstraintBuckets,
} from "../src/core/referenceAssetStrategy.ts";
import {
  APIKEY_FUN_RESPONSES_IMAGE_PROVIDER_ID,
  fetchApikeyFunImageViaResponses,
} from "./apikey-fun-responses-image-transport.mts";
import { fetchImageBytesFromProvider, image2ProviderTimeoutMs } from "./runtime-api-current-project-p6-real-image2-submit.mts";

const CONFIRM_PHRASE = "generate-image2-assets";
const MOCK_PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=", "base64");
const ASSET_GENERATION_TYPES = new Set(["character", "scene", "prop", "storyboard"]);

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function uniqueStrings(values) {
  return [...new Set((values || []).filter((value) => typeof value === "string" && value.trim()).map((value) => value.trim()))];
}

function textArray(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim()) : [];
}

function safePathSegment(value) {
  const raw = String(value || "asset").trim();
  const slug = raw
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
  if (slug) return slug;
  return `asset_${createHash("sha256").update(raw || "asset").digest("hex").slice(0, 10)}`;
}

function sha256Bytes(bytes) {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function normalizeMockProviderResult(value) {
  if (value === true) return { enabled: true, status: "needs_review" };
  if (!isRecord(value)) return { enabled: false, status: undefined };
  const status = value.status === "success" || value.status === "verified"
    ? "success"
    : value.status === "missing"
      ? "missing"
      : "needs_review";
  return { enabled: true, status };
}

function providerConfigFor(statuses, providerId) {
  return (Array.isArray(statuses) ? statuses : []).find((item) => item?.providerId === providerId);
}

async function fetchAssetImageFromProvider({ providerId, apiKey, providerConfig, prompt, referenceImages = [] }) {
  if (providerId === APIKEY_FUN_RESPONSES_IMAGE_PROVIDER_ID) {
    const result = await fetchApikeyFunImageViaResponses({
      apiKey,
      endpoint: providerConfig.baseUrl,
      model: providerConfig.imageModel || "gpt-5.5",
      prompt,
      size: IMAGE2_GENERATE_DEFAULT_SIZE,
      quality: "low", // intentional default to keep generation cost predictable; size and aspect ratio come from providerPolicy
      stream: true,
      referenceImages,
      timeoutMs: image2AssetProviderTimeoutMs(),
    });
    if (!result.ok) {
      return {
        ok: false,
        statusCode: result.statusCode,
        errorType: result.errorType,
        failureKind: result.errorType,
        message: result.message,
        diagnostic: result.diagnostic,
        providerResponseMetadata: {
          providerId,
          transport: result.transport,
          providerEndpoint: result.endpoint,
          providerOperation: "responses.image_generation",
          requestedModel: result.requestedModel,
          returnedModel: result.returnedModel,
          ...result.metadata,
        },
      };
    }
    return {
      ok: true,
      bytes: result.bytes,
      providerRequestId: result.providerRequestId,
      providerResponseMetadata: {
        providerId,
        transport: result.transport,
        providerEndpoint: result.endpoint,
        providerOperation: "responses.image_generation",
        requestedModel: result.requestedModel,
        returnedModel: result.returnedModel,
        returnedCount: 1,
        rawSseSha256: result.metadata.rawResponseSha256,
        ...result.metadata,
      },
    };
  }
  return fetchImageBytesFromProvider({
    apiKey,
    baseUrl: providerConfig.baseUrl,
    model: providerConfig.imageModel,
    prompt,
    size: IMAGE2_GENERATE_DEFAULT_SIZE,
  });
}

function image2AssetProviderTimeoutMs(env = process.env) {
  const parsed = Number(env.VIBE_IMAGE2_ASSET_TIMEOUT_MS);
  if (Number.isFinite(parsed) && parsed >= 30_000) {
    return Math.min(Math.floor(parsed), 5 * 60 * 1000);
  }
  return Math.min(image2ProviderTimeoutMs(env), 2 * 60 * 1000);
}

function requestBodyString(body, names) {
  if (!isRecord(body)) return undefined;
  for (const name of names) {
    const value = body[name];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

function assetGenerateRequestInput(url, body) {
  const selectedShotId = asString(url.searchParams.get("selectedShotId"))
    || requestBodyString(body, ["selectedShotId", "shotId"]);
  const selectedShotIds = uniqueStrings(Array.isArray(body?.selectedShotIds)
    ? body.selectedShotIds
    : selectedShotId ? [selectedShotId] : []);
  const assetTypes = uniqueStrings(Array.isArray(body?.assetTypes) ? body.assetTypes : [])
    .filter((type) => ASSET_GENERATION_TYPES.has(type));
  const mockProviderResult = normalizeMockProviderResult(body?.mockProviderResult === undefined && body?.submitMode === "mock" ? true : body?.mockProviderResult);
  return {
    scope: body?.scope === "project" ? "project" : "selected_shots",
    selectedShotId,
    selectedShotIds,
    assetTypes: assetTypes.length ? assetTypes : ["character", "scene", "prop"],
    providerId: requestBodyString(body, ["providerId"]) || "lanyi-image2",
    confirmation: isRecord(body?.confirmation) ? body.confirmation : undefined,
    mockProviderResult: mockProviderResult.enabled,
    mockProviderResultStatus: mockProviderResult.status,
  };
}

function rawStoryShots(storyFlow) {
  if (!isRecord(storyFlow)) return [];
  const directShots = Array.isArray(storyFlow.shots) ? storyFlow.shots.filter(isRecord) : [];
  const sectionShots = (Array.isArray(storyFlow.sections) ? storyFlow.sections : [])
    .filter(isRecord)
    .flatMap((section) => Array.isArray(section.shots) ? section.shots.filter(isRecord) : []);
  return [...directShots, ...sectionShots];
}

function rawShotId(shot, fallback) {
  return asString(shot?.id) || asString(shot?.shotId) || fallback;
}

function rawShotById(storyFlow, shotId) {
  return rawStoryShots(storyFlow).find((shot, index) => rawShotId(shot, `S${index + 1}`) === shotId);
}

function rawProjectShotById(projectFacts, shotId) {
  if (!shotId) return undefined;
  return rawShotById({ shots: Array.isArray(projectFacts?.projectVibe?.shots) ? projectFacts.projectVibe.shots : [] }, shotId)
    || rawShotById(projectFacts?.storyFlow, shotId)
    || rawShotById({ shots: Array.isArray(projectFacts?.shots) ? projectFacts.shots : [] }, shotId)
}

function asPositiveNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function projectCharacterIdentityKeys(workbenchFacts, projectFacts) {
  const visualAssets = Array.isArray(workbenchFacts?.visualMemory?.assets)
    ? workbenchFacts.visualMemory.assets
    : [];
  const visualRoles = Array.isArray(projectFacts?.visualMemory?.roles)
    ? projectFacts.visualMemory.roles
    : [];
  const projectShots = [
    ...rawStoryShots(projectFacts?.projectVibe),
    ...rawStoryShots(projectFacts?.storyFlow),
    ...rawStoryShots({ shots: Array.isArray(projectFacts?.shots) ? projectFacts.shots : [] }),
  ];
  return new Set(uniqueStrings([
    ...visualAssets
      .filter((asset) => asset?.type === "character")
      .flatMap((asset) => [asset.id, asset.name, asset.displayName]),
    ...visualRoles.flatMap((role) => [role.id, role.roleId, role.name, role.displayName]),
    ...projectShots.flatMap((shot) => [
      ...textArray(shot?.roleIds),
      ...textArray(shot?.characterIds),
      ...textArray(shot?.characterAssetIds),
    ]),
  ]).map(normalizedAssetIdentity).filter(Boolean));
}

function projectStyleHint(projectFacts) {
  const projectVibe = isRecord(projectFacts?.projectVibe) ? projectFacts.projectVibe : projectFacts;
  const evidenceRefs = Array.isArray(projectVibe?.receipts?.scriptPlanningReceipts)
    ? projectVibe.receipts.scriptPlanningReceipts.flatMap((receipt) => textArray(receipt?.evidenceRefs))
    : [];
  const raw = uniqueStrings([
    asString(projectVibe?.manifest?.title),
    asString(projectVibe?.manifest?.description),
    asString(projectVibe?.manifest?.style),
    asString(projectVibe?.style),
    asString(projectVibe?.visualStyle),
    ...evidenceRefs,
  ]).join(" ").replace(/[_-]+/g, " ");
  const hints = [];
  if (/1990.*日本.*tv.*动画|日本\s*tv\s*动画|日漫|赛璐珞|手绘赛璐珞|cel\s*animation|cel-shaded|anime/i.test(raw)) {
    hints.push("风格锁定：1990年代日本TV动画，克制色彩，干净手绘赛璐珞上色，柔和手绘背景。");
  }
  if (/不要真人|无真人|非写实|no\s*photoreal|no\s*live-action|no\s*3d|无\s*3d|不要\s*3d/i.test(raw)) {
    hints.push("避免真人写实、照片级真实感、 glossy 3D 和游戏渲染。");
  }
  return hints.join(" ");
}

function richShotStoryText(rawShot, selected) {
  return uniqueStrings([
    asString(rawShot?.intent),
    asString(rawShot?.seedanceDirection),
    asString(rawShot?.summary),
    asString(rawShot?.storyFunction),
    asString(rawShot?.description),
    ...textArray(rawShot?.characterGuidance),
    ...textArray(rawShot?.sceneGuidance),
    ...textArray(rawShot?.propGuidance),
    ...textArray(rawShot?.actionBeats),
    asString(selected?.storyFunction),
  ]).join(" ");
}

function selectedShotFacts(workbenchFacts, projectFacts, selectedShotId) {
  const shots = Array.isArray(workbenchFacts?.storyFlow?.shots) ? workbenchFacts.storyFlow.shots : [];
  const selected = selectedShotId
    ? shots.find((shot) => shot?.id === selectedShotId)
    : shots[0];
  const shotId = selectedShotId || selected?.id;
  const rawShot = rawProjectShotById(projectFacts, shotId);
  const explicitRoleIds = uniqueStrings([
    ...textArray(selected?.roleIds),
    ...textArray(rawShot?.roleIds),
    ...textArray(rawShot?.characterIds),
    ...textArray(rawShot?.characterAssetIds),
  ]);
  const explicitPropIds = uniqueStrings([
    ...textArray(rawShot?.propIds),
    ...textArray(rawShot?.props),
    ...textArray(rawShot?.objectIds),
    ...textArray(rawShot?.propAssetIds),
  ]);
  const knownCharacterKeys = projectCharacterIdentityKeys(workbenchFacts, projectFacts);
  const rawPropReferences = explicitPropIds.length ? explicitPropIds : textArray(rawShot?.propGuidance);
  const propIdsThatAreCharacters = rawPropReferences.filter((id) => knownCharacterKeys.has(normalizedAssetIdentity(id)));
  const propReferenceCandidates = rawPropReferences.filter((id) => !knownCharacterKeys.has(normalizedAssetIdentity(id)));
  const propBuckets = referenceConstraintBuckets(propReferenceCandidates);
  return {
    shotId,
    title: asString(selected?.title) || asString(rawShot?.title) || asString(rawShot?.name) || shotId || "当前镜头",
    storyFunction: uniqueStrings([richShotStoryText(rawShot, selected), projectStyleHint(projectFacts)]).join(" "),
    sceneId: asString(selected?.sceneId)
      || asString(rawShot?.sceneId)
      || textArray(rawShot?.sceneAssetIds)[0]
      || textArray(rawShot?.sceneGuidance)[0]
      || asString(selected?.sectionId)
      || asString(rawShot?.sectionId),
    roleIds: referenceAssetCandidates(uniqueStrings([
      ...(explicitRoleIds.length ? explicitRoleIds : textArray(rawShot?.characterGuidance)),
      ...propIdsThatAreCharacters,
    ]), "character"),
    propIds: propBuckets.standalone,
    objectDetailIds: propBuckets.objectConstraints,
    vehicleDetailIds: propBuckets.objectConstraints,
    sceneDetailIds: propBuckets.sceneConstraints,
    characterDetailIds: propBuckets.characterConstraints,
    shotDetailIds: propBuckets.shotDetails,
    ignoredDetailIds: propBuckets.ignoredDetails,
    referenceStrategy: asString(rawShot?.referenceStrategy) || asString(selected?.referenceStrategy),
    visibleClips: asPositiveNumber(rawShot?.visibleClips) || asPositiveNumber(selected?.visibleClips),
    storyboardPanels: asPositiveNumber(rawShot?.storyboardPanels) || asPositiveNumber(selected?.storyboardPanels),
    durationSeconds: asPositiveNumber(rawShot?.durationSeconds) || asPositiveNumber(rawShot?.duration) || asPositiveNumber(selected?.durationSeconds),
    camera: asString(rawShot?.camera) || asString(selected?.camera),
    splitPolicy: asString(rawShot?.splitPolicy) || asString(selected?.splitPolicy),
    executionMode: asString(rawShot?.executionMode) || asString(selected?.executionMode),
    actionBeats: textArray(rawShot?.actionBeats),
    primaryAction: asString(rawShot?.primaryAction),
    actionTrigger: asString(rawShot?.actionTrigger),
    microReaction: asString(rawShot?.microReaction),
  };
}

function sceneClusterForText(value) {
  const text = String(value || "").toLowerCase();
  const clusters = [
    { key: "old_bookstore", id: "scene_old_bookstore", name: "旧书店环境", pattern: /旧书店|书店|书架|旧书|bookstore|bookshop|bookshelf|old\s*books?/i },
    { key: "train_station", id: "scene_train_station", name: "车站/站台环境", pattern: /车站|站台|电车站|火车站|地铁站|train\s*station|railway\s*platform|subway\s*platform/i },
    { key: "lighthouse_interior", id: "scene_lighthouse_interior", name: "灯塔内部维修室", pattern: /灯塔内部|灯塔内|维修室|控制台|旧灯塔控制台|灯塔维修|lighthouse\s*(interior|inside|control\s*room)|control\s*room/i },
    { key: "lighthouse_exterior", id: "scene_lighthouse_exterior", name: "雨后海雾小镇与灯塔外观", pattern: /海雾小镇|灯塔外观|灯塔门口|灯塔灯束|海边灯塔|海岸灯塔|雨后.*灯塔|lighthouse\s*(exterior|outside)|coastal\s*(town|lighthouse)/i },
    { key: "whale_tram_ocean", id: "scene_whale_tram_ocean", name: "海雾中的鲸鱼电车与海面", pattern: /鲸鱼电车|鲸影|海面|海雾中.*电车|whale\s*tram|ocean|sea/i },
    { key: "convenience_store", id: "scene_convenience_store", name: "便利店环境", pattern: /便利店(?:门口|入口|雨棚|店内|外)?|自动门|convenience\s*store/i },
    { key: "mountain_road", id: "scene_mountain_road", name: "雨夜山路环境", pattern: /山路|便利店外山路|山脊|跑山|发卡弯|雨夜山路|mountain\s*road|touge|hairpin|convenience\s*store\s*road/i },
    { key: "street", id: "scene_street", name: "街道环境", pattern: /街道|街边|路口|巷|湿漉漉的街|湿街|城市湿路|城市道路|城市路面|neon\s*street|city\s*street|street|alley/i },
    { key: "cafe", id: "scene_cafe", name: "咖啡馆环境", pattern: /咖啡馆|咖啡店|cafe|coffee\s*shop/i },
    { key: "rooftop", id: "scene_rooftop", name: "屋顶环境", pattern: /屋顶|天台|rooftop/i },
  ];
  const cluster = clusters.find((item) => item.pattern.test(text));
  return cluster;
}

function canonicalSceneCluster(selected) {
  const explicitSceneCluster = sceneClusterForText(selected.sceneId);
  const text = [
    selected.title,
    selected.storyFunction,
  ].filter(Boolean).join(" ").toLowerCase();
  const narrativeCluster = sceneClusterForText(text);
  if (explicitSceneCluster && explicitSceneCluster.key !== "street") return explicitSceneCluster;
  if (explicitSceneCluster?.key === "street" && narrativeCluster && narrativeCluster.key !== "street") return narrativeCluster;
  if (explicitSceneCluster) return explicitSceneCluster;
  if (narrativeCluster) return narrativeCluster;
  const cleanedId = safePathSegment(selected.sceneId || selected.title || "scene_reference");
  return {
    key: cleanedId,
    id: cleanedId.startsWith("scene_") ? cleanedId : `scene_${cleanedId}`,
    name: displayNameForId(selected.sceneId || selected.title || "场景参考", "scene"),
  };
}

function allProjectShotIds(workbenchFacts, projectFacts) {
  const workbenchShots = Array.isArray(workbenchFacts?.storyFlow?.shots) ? workbenchFacts.storyFlow.shots : [];
  return uniqueStrings([
    ...workbenchShots.map((shot) => asString(shot?.id)).filter(Boolean),
    ...rawStoryShots(projectFacts?.storyFlow).map((shot, index) => rawShotId(shot, `S${index + 1}`)),
    ...rawStoryShots({ shots: Array.isArray(projectFacts?.shots) ? projectFacts.shots : [] }).map((shot, index) => rawShotId(shot, `S${index + 1}`)),
    ...rawStoryShots({ shots: Array.isArray(projectFacts?.projectVibe?.shots) ? projectFacts.projectVibe.shots : [] }).map((shot, index) => rawShotId(shot, `S${index + 1}`)),
  ]);
}

function selectedShotFactsForInput(workbenchFacts, projectFacts, input) {
  if (input.scope === "project") {
    const shotIds = allProjectShotIds(workbenchFacts, projectFacts);
    const facts = shotIds.map((shotId) => selectedShotFacts(workbenchFacts, projectFacts, shotId)).filter((shot) => shot.shotId);
    if (facts.length) return facts;
  }
  const selectedIds = uniqueStrings(input.selectedShotIds?.length ? input.selectedShotIds : input.selectedShotId ? [input.selectedShotId] : []);
  if (selectedIds.length) {
    return selectedIds.map((shotId) => selectedShotFacts(workbenchFacts, projectFacts, shotId)).filter((shot) => shot.shotId);
  }
  const fallback = selectedShotFacts(workbenchFacts, projectFacts, input.selectedShotId);
  return fallback.shotId ? [fallback] : [];
}

function assetMatchesShot(asset, selected) {
  if (!asset?.id) return false;
  if (Array.isArray(asset.usedByShotIds) && asset.usedByShotIds.includes(selected.shotId)) return true;
  if (asset.type === "character") return selected.roleIds.includes(asset.id);
  if (asset.type === "scene") {
    const sceneCluster = canonicalSceneCluster(selected);
    const assetCluster = sceneClusterForText([asset.id, asset.name, ...(asset.textConstraints || [])].join(" "));
    const directSceneMatch = asset.id === selected.sceneId
      || asset.id === sceneCluster.id
      || assetCluster?.key === sceneCluster.key
      || normalizeSceneText(asset.name || asset.id) === normalizeSceneText(sceneCluster.name);
    if (directSceneMatch) return true;
    // If the shot has an explicit scene identity, never fall back to fuzzy
    // overlap. Shared words like "灯塔" would otherwise bind a new ocean/whale
    // scene to an existing lighthouse-interior baseline.
    if (selected.sceneId) return false;
    return asset.id === selected.sceneId
      || sceneTextOverlaps(asset, selected);
  }
  if (asset.type === "prop") return selected.propIds.includes(asset.id) && isStandalonePropReference(asset.id);
  return false;
}

function isStoryboardAssetRecord(asset) {
  const text = [asset?.id, asset?.name, asset?.displayName, asset?.path, asset?.mainReferencePath, ...(asset?.textConstraints || [])]
    .join(" ")
    .toLowerCase();
  return /storyboard|分镜/.test(text);
}

function assetReferencePath(asset) {
  return asString(asset?.mainReferencePath) || asString(asset?.path) || asString(asset?.referencePath);
}

function assetAlreadyBoundToShot(asset, selected) {
  return Array.isArray(asset?.usedByShotIds) && asset.usedByShotIds.includes(selected.shotId);
}

function normalizeSceneText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/旧书店书桌前|旧书店窗边|书桌前|窗边|手部|特写|近景|全景|中景|远景/g, "旧书店")
    .replace(/[_\s-]+/g, "");
}

function sceneTextOverlaps(asset, selected) {
  const assetText = normalizeSceneText([asset.id, asset.name, ...(asset.textConstraints || [])].join(" "));
  const sceneText = normalizeSceneText([selected.sceneId, selected.title, selected.storyFunction].join(" "));
  if (assetText.length < 3 || sceneText.length < 3) return false;
  return assetText.includes(sceneText) || sceneText.includes(assetText);
}

function displayNameForId(id, type) {
  if (!id) return type === "character" ? "角色参考" : type === "scene" ? "场景参考" : "道具参考";
  return id.replace(/[_-]+/g, " ");
}

function normalizedAssetIdentity(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[\s_-]+/g, "")
    .trim();
}

function assetIdentityKeys(spec) {
  return uniqueStrings([spec?.id, spec?.name, spec?.displayName])
    .map(normalizedAssetIdentity)
    .filter(Boolean);
}

function removeCrossTypeDuplicateSpecs(specs) {
  const characterKeys = new Set(
    specs
      .filter((spec) => spec.type === "character")
      .flatMap(assetIdentityKeys),
  );
  return specs.filter((spec) => {
    if (spec.type !== "prop") return true;
    return !assetIdentityKeys(spec).some((key) => characterKeys.has(key));
  });
}

function pruneVisualMemoryCrossTypeDuplicates(visualMemory) {
  if (!isRecord(visualMemory)) return visualMemory;
  const next = structuredClone(visualMemory);
  const roles = Array.isArray(next.roles) ? next.roles : [];
  const roleKeys = new Set(
    roles.flatMap((role) => uniqueStrings([role?.id, role?.roleId, role?.name, role?.displayName]).map(normalizedAssetIdentity)),
  );
  if (Array.isArray(next.props) && roleKeys.size) {
    next.props = next.props.filter((prop) => {
      const propKeys = uniqueStrings([prop?.id, prop?.name, prop?.displayName]).map(normalizedAssetIdentity);
      return !propKeys.some((key) => roleKeys.has(key));
    });
  }
  return next;
}

function nonPhotographicStyleGuard(selected) {
  const facts = `${selected?.title || ""} ${selected?.storyFunction || ""}`.toLowerCase();
  const hasAnimeStyle = /日漫|日本\s*tv\s*动画|动画|anime|manga|cel animation|cel-shaded|2d/.test(facts);
  if (!hasAnimeStyle) return "";
  return [
    "Style lock: clean 2D Japanese TV anime / cel animation reference, not live-action.",
    "Use line art, cel shading, painted anime background logic, and restrained 1990s TV anime color.",
    "Avoid photorealism, real people, live-action photography, glossy 3D, game render, and cinematic realism.",
  ].join(" ");
}

function assetSpecsForShot(workbenchFacts, selected, assetTypes) {
  const assets = Array.isArray(workbenchFacts?.visualMemory?.assets) ? workbenchFacts.visualMemory.assets : [];
  const specs = [];
  const includeType = (type) => assetTypes.includes(type);
  const covered = new Set();
  let sceneCovered = false;
  for (const asset of assets) {
    if (isStoryboardAssetRecord(asset)) continue;
    if (!includeType(asset.type)) continue;
    if (!assetMatchesShot(asset, selected)) continue;
    if (asset.status === "locked") {
      covered.add(`${asset.type}:${asset.id}`);
      if (asset.type === "scene") sceneCovered = true;
      continue;
    }
    const existingPath = assetReferencePath(asset);
    if (existingPath && assetAlreadyBoundToShot(asset, selected)) {
      covered.add(`${asset.type}:${asset.id}`);
      if (asset.type === "scene") sceneCovered = true;
      continue;
    }
    specs.push({
      id: asset.id,
      type: asset.type,
      name: asset.name || displayNameForId(asset.id, asset.type),
      existingPath,
      existingOutputSha256: asset.outputHash || asset.outputSha256 || asset.generatedBy?.outputSha256,
      existingProviderObservationPath: asset.providerObservationPath || asset.generatedBy?.providerObservationPath,
      existingSemanticQaPath: asset.semanticQaPath || asset.generatedBy?.semanticQaPath,
      textConstraints: uniqueStrings([
        ...(Array.isArray(asset.textConstraints) ? asset.textConstraints : []),
        ...(asset.type === "scene" ? (selected.sceneDetailIds || []) : []),
        ...(asset.type === "prop" && isParentObjectReference(asset.id) ? (selected.objectDetailIds || selected.vehicleDetailIds || []) : []),
      ]),
      usedByShotIds: [selected.shotId],
      relatedShotTitles: [selected.title],
      storyContexts: [selected.storyFunction],
    });
  }
  const seen = new Set([...covered, ...specs.map((spec) => `${spec.type}:${spec.id}`)]);
  const addMissing = (type, id) => {
    if (!id || !includeType(type) || seen.has(`${type}:${id}`)) return;
    seen.add(`${type}:${id}`);
    specs.push({
      id,
      type,
      name: displayNameForId(id, type),
      textConstraints: type === "prop" && isParentObjectReference(id)
        ? uniqueStrings([...(selected.objectDetailIds || selected.vehicleDetailIds || [])])
        : [],
      usedByShotIds: [selected.shotId],
      relatedShotTitles: [selected.title],
      storyContexts: [selected.storyFunction],
    });
  };
  for (const id of selected.roleIds) addMissing("character", id);
  if (selected.sceneId && includeType("scene") && !sceneCovered && !specs.some((spec) => spec.type === "scene")) {
    const cluster = canonicalSceneCluster(selected);
    if (!seen.has(`scene:${cluster.id}`)) {
      seen.add(`scene:${cluster.id}`);
      specs.push({
        id: cluster.id,
        type: "scene",
        name: cluster.name,
        textConstraints: uniqueStrings([selected.sceneId, ...(selected.sceneDetailIds || [])].filter(Boolean)),
        usedByShotIds: [selected.shotId],
        relatedShotTitles: [selected.title],
        storyContexts: [selected.storyFunction],
      });
    }
  }
  for (const id of selected.propIds) addMissing("prop", id);
  return specs;
}

function mergeAssetSpec(existing, incoming) {
  return {
    ...existing,
    name: existing.name || incoming.name,
    existingPath: existing.existingPath || incoming.existingPath,
    textConstraints: uniqueStrings([...(existing.textConstraints || []), ...(incoming.textConstraints || [])]),
    usedByShotIds: uniqueStrings([...(existing.usedByShotIds || []), ...(incoming.usedByShotIds || [])]),
    relatedShotTitles: uniqueStrings([...(existing.relatedShotTitles || []), ...(incoming.relatedShotTitles || [])]),
    storyContexts: uniqueStrings([...(existing.storyContexts || []), ...(incoming.storyContexts || [])]),
  };
}

function assetSpecsForShots(workbenchFacts, selectedShots, assetTypes) {
  const byKey = new Map();
  for (const selected of selectedShots) {
    for (const spec of assetSpecsForShot(workbenchFacts, selected, assetTypes)) {
      const key = `${spec.type}:${spec.id}`;
      byKey.set(key, byKey.has(key) ? mergeAssetSpec(byKey.get(key), spec) : spec);
    }
  }
  return removeCrossTypeDuplicateSpecs([...byKey.values()]);
}

function storyboardReferenceExists(workbenchFacts, selected) {
  const assets = Array.isArray(workbenchFacts?.visualMemory?.assets) ? workbenchFacts.visualMemory.assets : [];
  return assets.some((asset) => {
    const text = [asset?.id, asset?.name, asset?.displayName, asset?.path, asset?.mainReferencePath, ...(asset?.textConstraints || [])]
      .join(" ")
      .toLowerCase();
    if (!/storyboard|分镜/.test(text)) return false;
    if (Array.isArray(asset?.usedByShotIds) && asset.usedByShotIds.includes(selected.shotId)) return true;
    return selected.shotId && text.includes(String(selected.shotId).toLowerCase());
  });
}

function storyboardPanelCount(selected) {
  const explicitPanels = Math.floor(selected.storyboardPanels || 0);
  if (explicitPanels > 0) return Math.min(explicitPanels, 12);
  const visibleClips = Math.floor(selected.visibleClips || 0);
  if (visibleClips > 0 && selected.referenceStrategy === "storyboard_narrative") return Math.min(visibleClips, 8);
  if (visibleClips > 0 && selected.referenceStrategy === "storyboard_rapid_cut") return Math.min(Math.max(visibleClips + 2, 3), 12);
  if (selected.referenceStrategy === "storyboard_rapid_cut") return 4;
  return 3;
}

function shotNeedsStoryboardReference(selected) {
  const strategy = String(selected.referenceStrategy || "").trim();
  if (strategy === "omni_reference") return false;
  if (strategy === "storyboard_narrative" || strategy === "storyboard_rapid_cut") return true;
  if (selected.storyboardPanels && selected.storyboardPanels > 0) return true;
  const text = [
    selected.title,
    selected.storyFunction,
    selected.camera,
    selected.splitPolicy,
    selected.executionMode,
    ...(selected.actionBeats || []),
  ].join(" ");
  return /故事板|分镜图|快切|切镜|rapid[_\s-]*cut|storyboard/i.test(text);
}

function storyboardSpecsForShots(workbenchFacts, selectedShots, assetTypes) {
  if (!assetTypes.includes("storyboard")) return [];
  return selectedShots.flatMap((selected) => {
    if (!selected?.shotId || !shotNeedsStoryboardReference(selected)) return [];
    if (storyboardReferenceExists(workbenchFacts, selected)) return [];
    const panelCount = storyboardPanelCount(selected);
    const visibleClips = Math.max(1, Math.floor(selected.visibleClips || (selected.referenceStrategy === "storyboard_rapid_cut" ? 1 : panelCount)));
    return [{
      id: `storyboard_reference_${selected.shotId}`,
      type: "storyboard",
      name: `${selected.title || selected.shotId} 故事板参考`,
      textConstraints: uniqueStrings([
        `referenceStrategy:${selected.referenceStrategy || "storyboard_narrative"}`,
        `visibleClips:${visibleClips}`,
        `storyboardPanels:${panelCount}`,
        selected.splitPolicy ? `splitPolicy:${selected.splitPolicy}` : "",
      ]),
      usedByShotIds: [selected.shotId],
      relatedShotTitles: [selected.title],
      storyContexts: [selected.storyFunction],
      referenceStrategy: selected.referenceStrategy || "storyboard_narrative",
      visibleClips,
      storyboardPanels: panelCount,
      durationSeconds: selected.durationSeconds,
      camera: selected.camera,
      splitPolicy: selected.splitPolicy,
      executionMode: selected.executionMode,
      actionBeats: selected.actionBeats || [],
      primaryAction: selected.primaryAction,
      actionTrigger: selected.actionTrigger,
      microReaction: selected.microReaction,
    }];
  });
}

function generationSpecsForShots(workbenchFacts, selectedShots, assetTypes) {
  return [
    ...assetSpecsForShots(workbenchFacts, selectedShots, assetTypes),
    ...storyboardSpecsForShots(workbenchFacts, selectedShots, assetTypes),
  ];
}

function contextTextForAsset(spec, selected) {
  return uniqueStrings([
    spec.name,
    selected.title,
    selected.storyFunction,
    ...(Array.isArray(spec.relatedShotTitles) ? spec.relatedShotTitles : []),
    ...(Array.isArray(spec.storyContexts) ? spec.storyContexts : []),
    ...(Array.isArray(spec.textConstraints) ? spec.textConstraints : []),
  ]).join(" ");
}

function missingAny(text, patterns) {
  return !patterns.some((pattern) => pattern.test(text));
}

function sceneContaminationGuard(spec, selected) {
  const facts = contextTextForAsset(spec, selected).toLowerCase();
  const guards = [
    "Do not borrow a location from another shot. The named scene is the source of truth.",
  ];
  if (missingAny(facts, [/车站|站台|火车站|电车站|train\s*station|platform|railway\s*platform|subway\s*platform|tracks?/i])) {
    guards.push("No train station, no platform, no railway tracks, no tunnel, no timetable board.");
  }
  if (missingAny(facts, [/书店|书架|旧书|bookstore|bookshop|bookshelf|old\s*books?/i])) {
    return guards;
  }
  return [
    ...guards,
    "If the scene is a bookstore, show bookshelves, old books, wood floor, window light, dust or morning atmosphere.",
  ];
}

function propContaminationGuard(spec, selected) {
  const facts = contextTextForAsset(spec, selected).toLowerCase();
  const guards = ["Do not turn the prop sheet into a storyboard panel or scene frame."];
  if (missingAny(facts, [/车票|ticket|pass/i])) {
    guards.push("No train ticket unless the prop itself is a ticket.");
  }
  return guards;
}

function assetPrompt(spec, selected) {
  const typeLabel = spec.type === "character" ? "character" : spec.type === "scene" ? "scene" : "prop";
  const styleGuard = nonPhotographicStyleGuard(selected);
  const textConstraints = Array.isArray(spec.textConstraints) ? spec.textConstraints.slice(0, 6) : [];
  const relatedShotTitles = uniqueStrings(Array.isArray(spec.relatedShotTitles) ? spec.relatedShotTitles : []).slice(0, 6);
  const storyContexts = uniqueStrings(Array.isArray(spec.storyContexts) ? spec.storyContexts : []).slice(0, 6);
  return [
    "reference_asset_prompt_v2: create a production reference asset, not a cinematic shot frame, not a storyboard panel, not final key art.",
    `Asset type: ${typeLabel}. Asset name: ${spec.name}. Aspect ratio ${IMAGE2_GENERATE_DEFAULT_ASPECT_RATIO}.`,
    "The asset name and asset constraints are the source of truth for this image.",
    "The shot facts below are context only. Do not copy their full scene composition, actor pose, camera angle, or action as the asset image.",
    relatedShotTitles.length ? `Related shots: ${relatedShotTitles.join(" / ")}.` : selected.title ? `Related shot: ${selected.title}.` : "",
    storyContexts.length ? `Context facts: ${storyContexts.join(" / ")}.` : selected.storyFunction ? `Context facts: ${selected.storyFunction}.` : "",
    textConstraints.length ? `Asset constraints: ${textConstraints.join(" / ")}.` : "",
    styleGuard,
    spec.type === "character"
      ? "Output exactly one character identity reference on a plain warm-white or light gray background. Neutral or slight three-quarter pose. Show face, hair, outfit silhouette, proportions, shoes, and carried items only when described. No background scene, no story action, no other people, no camera drama."
      : "",
    spec.type === "scene"
      ? [
        `Output one clean environment background plate for this named scene only: ${spec.name}.`,
        "Show space layout, weather, time of day, light direction, atmosphere, floor/walls/windows/furniture or environmental anchors that belong to the named scene.",
        "No character, no hand, no action beat, no prop close-up, no readable signage text, no panel borders, no labels.",
        ...sceneContaminationGuard(spec, selected),
      ].join(" ")
      : "",
    spec.type === "prop"
      ? [
        `Output one isolated prop reference for this named prop only: ${spec.name}.`,
        "Use a plain light background or simple object sheet. Show shape, material, scale cues, and interaction affordance.",
        "No hands, no character, no full environment, no panel borders, no labels, no readable text, no extra objects.",
        ...propContaminationGuard(spec, selected),
      ].join(" ")
      : "",
    "Keep the asset simple, readable, centered, and reusable by later storyboard/video generation.",
  ].filter(Boolean).join("\n");
}

function storyboardPrompt(spec, selected) {
  const panelCount = Math.max(1, Math.floor(spec.storyboardPanels || storyboardPanelCount(selected)));
  const visibleClips = Math.max(1, Math.floor(spec.visibleClips || selected.visibleClips || 1));
  const duration = spec.durationSeconds || selected.durationSeconds || 4;
  const beatLines = uniqueStrings([
    ...(Array.isArray(spec.actionBeats) ? spec.actionBeats : []),
    spec.primaryAction,
    spec.actionTrigger ? `trigger: ${spec.actionTrigger}` : "",
    spec.microReaction ? `micro reaction: ${spec.microReaction}` : "",
  ]).slice(0, 8);
  const referenceStrategy = spec.referenceStrategy || selected.referenceStrategy || "storyboard_narrative";
  const rapidCutRules = referenceStrategy === "storyboard_rapid_cut"
    ? [
      "This is a rapid-cut / action-beat planning board: use multiple small panels to clarify timing, body/object paths, impact beats and camera rhythm.",
      "If final visibleClips is 1 but storyboardPanels is larger, those panels are internal beat planning for one final clip, not extra final clips.",
    ].join("\n")
    : "This is a narrative storyboard: each panel should be a clear visible clip or composition beat.";
  return [
    "storyboard_reference_prompt_v3:",
    "Create a 16:9 rough cinematic storyboard reference sheet for video generation planning.",
    `Panel count: exactly ${panelCount}. Final visible video clips: exactly ${visibleClips}. Total duration: ${duration}s.`,
    "Use a clean white sheet with black panel borders. Keep every panel readable at a glance.",
    "Each panel must show one clear action beat, composition, camera direction, and motion intention.",
    "Keep the drawing rough: pencil/ink sketch, gesture poses, simple masses, minimal rendering. This is planning, not final illustration.",
    "Use small panel numbers and optional time ranges in the panel margin only; keep them away from faces, hands, props and silhouettes.",
    "Do not add decorative UI, logos, watermarks, fake app chrome, production brand marks, or unrelated text.",
    "If using arrows or motion marks, make them thin hand-drawn production notes and do not cover the main silhouette.",
    "Use reference images only for identity, scene/weather, and prop shape. Do not collage reference images into the board.",
    rapidCutRules,
    `Shot title: ${selected.title || spec.name}.`,
    `Shot story: ${selected.storyFunction || "按当前镜头意图完成构图和动作。"}。`,
    selected.camera || spec.camera ? `Camera / lens / movement: ${selected.camera || spec.camera}.` : "",
    beatLines.length ? `Action beats: ${beatLines.join(" / ")}.` : "",
    "Style: keep the board suitable for directing Seedance; prioritize staging, timing, motion readability and spatial continuity.",
  ].filter(Boolean).join("\n");
}

function providerPromptAudit(prompt, requestPromptVersion = "reference_asset_prompt_v2") {
  return {
    requestPromptVersion,
    requestPromptText: prompt,
    requestPromptSha256: sha256Bytes(Buffer.from(prompt, "utf8")),
  };
}

function providerFailureRetryable(result) {
  if (result?.ok) return false;
  return ["network_error", "timeout", "rate_limit", "server_error", "no_image", "provider_missing"].includes(result?.errorType || result?.failureKind);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchAssetImageWithRetry(args) {
  const maxAttempts = 2;
  let latest;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    latest = await fetchAssetImageFromProvider(args);
    if (latest.ok || !providerFailureRetryable(latest) || attempt === maxAttempts) {
      return { ...latest, providerAttemptCount: attempt };
    }
    await sleep(1200 * attempt);
  }
  return { ...latest, providerAttemptCount: maxAttempts };
}

function visualMemoryKeyForType(type) {
  if (type === "character") return "roles";
  if (type === "scene") return "scenes";
  return "props";
}

function resolveProjectMediaFile(source, value) {
  const raw = asString(value);
  if (!raw) return undefined;
  if (path.isAbsolute(raw)) return raw;
  const normalized = raw.replace(/\\/g, "/");
  const rootRelative = String(source?.runRootRelativePath || "").replace(/\\/g, "/");
  if (rootRelative && (normalized === rootRelative || normalized.startsWith(`${rootRelative}/`))) {
    return path.resolve(process.cwd(), normalized);
  }
  return path.resolve(source?.runRootPath || process.cwd(), normalized);
}

function flattenVisualMemoryReferences(visualMemory) {
  if (!isRecord(visualMemory)) return [];
  const refs = [];
  for (const [key, type] of [
    ["roles", "character"],
    ["characters", "character"],
    ["scenes", "scene"],
    ["props", "prop"],
  ]) {
    const items = Array.isArray(visualMemory[key]) ? visualMemory[key] : [];
    items.forEach((item) => refs.push({ ...item, type }));
  }
  const genericAssets = Array.isArray(visualMemory.assets) ? visualMemory.assets : [];
  genericAssets.forEach((item) => {
    const type = item?.assetType === "character" || item?.type === "character"
      ? "character"
      : item?.assetType === "scene" || item?.type === "scene"
        ? "scene"
        : "prop";
    refs.push({ ...item, type });
  });
  const entries = Array.isArray(visualMemory.entries) ? visualMemory.entries : [];
  entries.forEach((item) => {
    const type = item?.assetType === "character" || item?.type === "character"
      ? "character"
      : item?.assetType === "scene" || item?.type === "scene"
        ? "scene"
        : "prop";
    refs.push({ ...item, type });
  });
  return refs;
}

function referenceSortWeight(ref) {
  if (ref.type === "scene") return 0;
  if (ref.type === "character") return 1;
  return 2;
}

function referenceImagesForStoryboardSpec(visualMemory, spec, source) {
  const shotIds = new Set(spec.usedByShotIds || []);
  const refs = flattenVisualMemoryReferences(visualMemory)
    .filter((ref) => {
      const status = String(ref?.status || ref?.visualMemoryStatus || ref?.lockedStatus || "").toLowerCase();
      if (status === "missing" || status === "rejected") return false;
      const haystack = [ref?.id, ref?.name, ref?.displayName, ref?.type, ref?.assetType, ref?.path, ref?.mainReferencePath].join(" ").toLowerCase();
      if (/storyboard|分镜/.test(haystack)) return false;
      const usedByShotIds = Array.isArray(ref?.usedByShotIds) ? ref.usedByShotIds : [];
      return usedByShotIds.length === 0 || usedByShotIds.some((shotId) => shotIds.has(shotId));
    })
    .sort((a, b) => referenceSortWeight(a) - referenceSortWeight(b));
  const unique = [];
  const seen = new Set();
  for (const ref of refs) {
    const mediaPath = ref?.mainReferencePath || ref?.path || ref?.referencePath;
    const filePath = resolveProjectMediaFile(source, mediaPath);
    if (!filePath || seen.has(filePath) || !existsSync(filePath)) continue;
    seen.add(filePath);
    try {
      unique.push({
        name: asString(ref?.displayName) || asString(ref?.name) || asString(ref?.id) || path.basename(filePath),
        path: filePath,
        bytes: readFileSync(filePath),
      });
    } catch {
      // Missing or unreadable local references should not block storyboard generation.
    }
    if (unique.length >= 4) break;
  }
  return unique;
}

function updateVisualMemoryAsset(visualMemory, result, selected) {
  const next = isRecord(visualMemory) ? structuredClone(visualMemory) : {};
  if (result.type === "storyboard") {
    const list = Array.isArray(next.entries) ? next.entries : [];
    const legacyList = Array.isArray(next.assets) ? next.assets : [];
    const usedByShotIds = uniqueStrings(Array.isArray(result.usedByShotIds) ? result.usedByShotIds : [selected.shotId].filter(Boolean));
    const index = list.findIndex((item) => isRecord(item) && (item.id === result.id || item.assetId === result.id));
    const legacyIndex = legacyList.findIndex((item) => isRecord(item) && (item.id === result.id || item.assetId === result.id));
    const updated = {
      ...(index >= 0 ? list[index] : {}),
      id: result.id,
      assetId: result.id,
      displayName: result.name,
      name: result.name,
      assetType: "reference",
      type: "storyboard_reference",
      status: "needs_review",
      visualMemoryStatus: "needs_review",
      lockedStatus: "needs_review",
      path: result.path,
      mainReferencePath: result.path,
      usedByShotIds,
      textConstraints: uniqueStrings([
        "故事板参考：用于构图、动作、切镜节奏，不替代角色和场景设定。",
        ...(Array.isArray(result.textConstraints) ? result.textConstraints : []),
      ]),
      sourceKind: "provider_temp_output",
      generatedBy: {
        providerId: result.providerId,
        providerSlot: "image.storyboard_reference",
        providerOperation: "image.generate",
        generatedAt: result.generatedAt,
        providerObservationPath: result.providerObservationPath,
        semanticQaPath: result.semanticQaPath,
        outputSha256: result.outputSha256,
      },
      referenceAuthority: {
        lockedStatus: "needs_review",
        canUseAsFutureReference: false,
        updatedAt: result.generatedAt,
      },
      roleBinding: {
        role: "storyboard_reference",
        useFor: ["composition", "blocking", "camera", "timing"],
        ignoreFor: ["character_identity", "scene_weather", "prop_design"],
        priority: 1,
        conflictRule: "故事板只管构图、动作和节奏；角色、场景、道具身份以对应参考为准。",
      },
      updatedAt: result.generatedAt,
    };
    if (index >= 0) {
      list[index] = updated;
    } else {
      list.push(updated);
    }
    if (legacyIndex >= 0) {
      legacyList[legacyIndex] = updated;
    } else {
      legacyList.push(updated);
    }
    next.entries = list;
    next.assets = legacyList;
    if (!next.schemaVersion) next.schemaVersion = "current_project_visual_memory_v1";
    return pruneVisualMemoryCrossTypeDuplicates(next);
  }
  const key = visualMemoryKeyForType(result.type);
  const list = Array.isArray(next[key]) ? next[key] : [];
  const index = list.findIndex((item) => isRecord(item) && (item.id === result.id || item.roleId === result.id || item.sceneId === result.id));
  const base = index >= 0 ? list[index] : {};
  const usedByShotIds = uniqueStrings([
    ...(Array.isArray(base.usedByShotIds) ? base.usedByShotIds : []),
    ...(Array.isArray(result.usedByShotIds) ? result.usedByShotIds : []),
    selected.shotId,
  ]);
  const updated = {
    ...base,
    id: result.id,
    displayName: asString(base.displayName) || asString(base.name) || result.name,
    name: asString(base.name) || asString(base.displayName) || result.name,
    status: "needs_review",
    path: result.path,
    mainReferencePath: result.path,
    usedByShotIds,
    textConstraints: uniqueStrings([
      ...(Array.isArray(base.textConstraints) ? base.textConstraints : []),
      ...(Array.isArray(result.textConstraints) ? result.textConstraints : []),
    ]),
    generatedBy: result.reusedExistingReference && isRecord(base.generatedBy)
      ? base.generatedBy
      : {
        providerId: result.providerId,
        providerSlot: "image.reference_asset",
        providerOperation: "image.generate",
        generatedAt: result.generatedAt,
        providerObservationPath: result.providerObservationPath,
        semanticQaPath: result.semanticQaPath,
        outputSha256: result.outputSha256,
      },
  };
  if (index >= 0) {
    list[index] = updated;
  } else {
    list.push(updated);
  }
  next[key] = list;
  if (!next.schemaVersion) next.schemaVersion = "current_project_visual_memory_v1";
  return pruneVisualMemoryCrossTypeDuplicates(next);
}

export function createRuntimeApiCurrentProjectImage2AssetGenerate(deps) {
  const {
    currentProjectImage2AssetGenerateEndpoint,
    currentProjectRouteContext,
    readProjectFacts,
    currentProjectWorkbenchFacts,
    getProviderApiKey,
    getProviderConfigStatuses,
    requestOverrideDiagnostics,
    runtimePolicy,
    runtimeFileUrl,
    sha256Bytes: sha256BytesDep,
    writeCurrentProjectRuntimeBytes,
    writeCurrentProjectRuntimeJson,
    writeJson,
    running,
  } = deps;

  function runtimeState() {
    return typeof running === "function" ? running() : Boolean(running);
  }

  async function currentProjectImage2AssetGenerateResponse(input, extra = {}, source) {
    const generatedAt = new Date().toISOString();
    const projectFacts = readProjectFacts(source);
    const workbenchFacts = currentProjectWorkbenchFacts(source, projectFacts);
    const selectedShots = selectedShotFactsForInput(workbenchFacts, projectFacts, input);
    const primarySelected = selectedShots[0] || {};
    const selectedShotIds = uniqueStrings(selectedShots.map((shot) => shot.shotId));
    const providerStatuses = getProviderConfigStatuses();
    const providerConfig = providerConfigFor(providerStatuses, input.providerId);
    const apiKey = getProviderApiKey(input.providerId);
    const confirmation = input.confirmation || {};
    const confirmationOk = confirmation.confirmed === true
      && confirmation.phrase === CONFIRM_PHRASE
      && Boolean(asString(confirmation.receiptId))
      && Boolean(asString(confirmation.confirmedAt));
    const specs = generationSpecsForShots(workbenchFacts, selectedShots, input.assetTypes);
    const blockers = uniqueStrings([
      selectedShotIds.length ? "" : "项目里还没有可补参考的镜头。",
      providerConfig ? "" : "未找到可用的出图配置。",
      providerConfig?.credential?.keyStatus === "configured" && apiKey ? "" : "请先在设置里保存生成服务 Key。",
      confirmationOk ? "" : "需要在提交前明确确认本次生成参考。",
      specs.length ? "" : "当前镜头没有需要生成的参考。",
      workbenchFacts?.visualMemory?.readable === true ? "" : "项目资产文件不可读取。",
    ]);

    if (blockers.length > 0) {
      return {
        ok: false,
        ...runtimePolicy({
          runMode: "current_project_image2_asset_generate",
          providerCalled: false,
          prepareRan: false,
          projectVibeWritten: false,
          liveSubmitAllowed: false,
          workerSpawnForbidden: true,
          dryRunOnly: true,
        }),
        endpoint: currentProjectImage2AssetGenerateEndpoint,
        source: "runtime_endpoint",
        projectionKind: "current_project_image2_asset_generate",
        status: "blocked",
        uiStatus: "blocked",
        scope: input.scope,
        selectedShotId: primarySelected.shotId,
        selectedShotIds,
        providerId: input.providerId,
        providerKeyConfigured: providerConfig?.credential?.keyStatus === "configured",
        providerCalled: false,
        runtimeExternalNetworkCallMade: false,
        projectVibeWritten: false,
        visualMemoryWritten: false,
        formalPromotionBlocked: true,
        blockers,
        message: blockers[0],
        ...extra,
      };
    }

    const results = [];
    let visualMemory = pruneVisualMemoryCrossTypeDuplicates(projectFacts.visualMemory || {});
    let providerCalled = false;
    let externalNetworkCallMade = false;
    for (const [index, spec] of specs.entries()) {
      const assetId = safePathSegment(spec.id);
      const selected = selectedShots.find((shot) => Array.isArray(spec.usedByShotIds) && spec.usedByShotIds.includes(shot.shotId)) || primarySelected;
      const slot = spec.type === "storyboard" ? "storyboard" : spec.type;
      const providerSlot = spec.type === "storyboard" ? "image.storyboard_reference" : "image.reference_asset";
      const outputPath = `${source.runRootRelativePath}/assets/generated/${slot}_${assetId}.png`;
      const providerObservationPath = `${source.runRootRelativePath}/provider_observations/assets/${slot}_${assetId}.json`;
      const rawSsePath = `${source.runRootRelativePath}/provider_observations/assets/${slot}_${assetId}.sse.txt`;
      const semanticQaPath = `${source.runRootRelativePath}/semantic_qa/assets/${slot}_${assetId}.json`;
      if (spec.existingPath) {
        const result = {
          id: spec.id,
          type: spec.type,
          name: spec.name,
          status: "needs_review",
          path: spec.existingPath,
          imageUrl: runtimeFileUrl(spec.existingPath),
          outputFilePath: spec.existingPath,
          outputSha256: spec.existingOutputSha256,
          requestPromptSha256: undefined,
          usedByShotIds: spec.usedByShotIds || [selected.shotId].filter(Boolean),
          textConstraints: spec.textConstraints || [],
          providerId: input.providerId,
          generatedAt,
          providerObservationPath: spec.existingProviderObservationPath,
          semanticQaPath: spec.existingSemanticQaPath,
          reusedExistingReference: true,
        };
        results.push(result);
        visualMemory = updateVisualMemoryAsset(visualMemory, result, selected);
        writeCurrentProjectRuntimeJson(source.visualMemoryRelativePath, visualMemory, source);
        continue;
      }
      const prompt = spec.type === "storyboard" ? storyboardPrompt(spec, selected) : assetPrompt(spec, selected);
      const promptAudit = providerPromptAudit(prompt, spec.type === "storyboard" ? "storyboard_reference_prompt_v3" : "reference_asset_prompt_v2");
      const referenceImages = spec.type === "storyboard" ? referenceImagesForStoryboardSpec(visualMemory, spec, source) : [];
      providerCalled = true;
      externalNetworkCallMade = externalNetworkCallMade || !input.mockProviderResult;
      const providerResult = input.mockProviderResult
        ? input.mockProviderResultStatus === "missing"
          ? {
            ok: false,
            statusCode: 502,
            errorType: "provider_missing",
            failureKind: "provider_missing",
            message: "出图服务没有返回可用图片，可以重试一次。",
            diagnostic: { kind: "parse_error", message: "Mock Image2 provider returned no asset image.", retryable: true },
            providerResponseMetadata: { mockProviderResult: true, returnedCount: 0, retryable: true },
          }
          : {
            ok: true,
            bytes: MOCK_PNG,
            providerRequestId: `mock_lanyi_image2_asset_${Date.now()}_${index + 1}`,
            providerResponseMetadata: { mockProviderResult: true, returnedCount: 1 },
          }
        : await fetchAssetImageWithRetry({
          providerId: input.providerId,
          apiKey,
          providerConfig,
          prompt,
          referenceImages,
        });
      const rawSseFilePath = providerResult.rawSseBytes?.length
        ? writeCurrentProjectRuntimeBytes(rawSsePath, providerResult.rawSseBytes, source)
        : undefined;

      if (!providerResult.ok) {
        const providerObservation = {
          schemaVersion: "current_project_image2_asset_provider_observation_v1",
          generatedAt,
          provider: input.providerId,
          providerId: input.providerId,
          providerSlot,
          providerOperation: "image.generate",
          baseUrl: providerConfig.baseUrl,
          model: providerConfig.imageModel,
          requestedSize: IMAGE2_GENERATE_DEFAULT_SIZE,
          requestedAspectRatio: IMAGE2_GENERATE_DEFAULT_ASPECT_RATIO,
          ...promptAudit,
          assetId: spec.id,
          assetType: spec.type,
          assetName: spec.name,
          selectedShotId: selected.shotId,
          selectedShotIds: spec.usedByShotIds || [selected.shotId].filter(Boolean),
          outputPath,
          providerCalled: true,
          actualImage2Triggered: !input.mockProviderResult,
          externalNetworkCallMade: !input.mockProviderResult,
          providerAttemptCount: providerResult.providerAttemptCount || 1,
          referenceImageCount: referenceImages.length,
          rawCredentialMaterialSeen: false,
          projectVibeWritten: false,
          statusCode: providerResult.statusCode,
          errorType: providerResult.errorType,
          failureKind: providerResult.failureKind,
          message: providerResult.message,
          diagnostic: providerResult.diagnostic,
          providerResponseMetadata: providerResult.providerResponseMetadata,
          providerTransport: providerResult.providerResponseMetadata?.transport,
          providerTransportOperation: providerResult.providerResponseMetadata?.providerOperation,
          rawSsePath: rawSseFilePath ? rawSsePath : undefined,
          rawSseSha256: providerResult.providerResponseMetadata?.rawSseSha256,
        };
        const semanticQa = {
          schemaVersion: "current_project_image2_asset_semantic_qa_v1",
          generatedAt,
          reviewedAt: generatedAt,
          assetId: spec.id,
          assetType: spec.type,
          selectedShotId: selected.shotId,
          selectedShotIds: spec.usedByShotIds || [selected.shotId].filter(Boolean),
          outputPath,
          requestPromptSha256: promptAudit.requestPromptSha256,
          status: "missing",
          qaStatus: "missing",
          finalAssessment: { status: "missing", reason: providerResult.message, retryable: true },
          providerCalled: true,
          actualImage2Triggered: !input.mockProviderResult,
          referenceImageCount: referenceImages.length,
        };
        writeCurrentProjectRuntimeJson(providerObservationPath, providerObservation, source);
        writeCurrentProjectRuntimeJson(semanticQaPath, semanticQa, source);
        results.push({
          id: spec.id,
          type: spec.type,
          name: spec.name,
          status: "missing",
          path: outputPath,
          providerObservationPath,
          semanticQaPath,
          usedByShotIds: spec.usedByShotIds || [selected.shotId].filter(Boolean),
          textConstraints: spec.textConstraints || [],
          message: providerResult.message,
        });
        continue;
      }

      const outputFilePath = writeCurrentProjectRuntimeBytes(outputPath, providerResult.bytes, source);
      const outputSha256 = typeof sha256BytesDep === "function" ? sha256BytesDep(providerResult.bytes) : sha256Bytes(providerResult.bytes);
      const providerObservation = {
        schemaVersion: "current_project_image2_asset_provider_observation_v1",
        generatedAt,
        providerRequestId: providerResult.providerRequestId,
        provider: input.providerId,
        providerId: input.providerId,
        providerSlot,
        providerOperation: "image.generate",
        baseUrl: providerConfig.baseUrl,
        model: providerConfig.imageModel,
        requestedSize: IMAGE2_GENERATE_DEFAULT_SIZE,
        requestedAspectRatio: IMAGE2_GENERATE_DEFAULT_ASPECT_RATIO,
        ...promptAudit,
        assetId: spec.id,
        assetType: spec.type,
        assetName: spec.name,
        selectedShotId: selected.shotId,
        selectedShotIds: spec.usedByShotIds || [selected.shotId].filter(Boolean),
        outputPath,
        outputSha256,
        outputBytes: providerResult.bytes.length,
        providerCalled: true,
        actualImage2Triggered: !input.mockProviderResult,
        externalNetworkCallMade: !input.mockProviderResult,
        providerAttemptCount: providerResult.providerAttemptCount || 1,
        referenceImageCount: referenceImages.length,
        rawCredentialMaterialSeen: false,
        projectVibeWritten: false,
        providerResponseMetadata: providerResult.providerResponseMetadata,
        providerTransport: providerResult.providerResponseMetadata?.transport,
        providerTransportOperation: providerResult.providerResponseMetadata?.providerOperation,
        rawSsePath: rawSseFilePath ? rawSsePath : undefined,
        rawSseSha256: providerResult.providerResponseMetadata?.rawSseSha256,
      };
      const semanticQa = {
        schemaVersion: "current_project_image2_asset_semantic_qa_v1",
        generatedAt,
        reviewedAt: generatedAt,
        assetId: spec.id,
        assetType: spec.type,
        selectedShotId: selected.shotId,
        selectedShotIds: spec.usedByShotIds || [selected.shotId].filter(Boolean),
        outputPath,
        outputSha256,
        requestPromptSha256: promptAudit.requestPromptSha256,
        reviewedOutputSha256: outputSha256,
        status: "needs_review",
        qaStatus: "needs_review",
        finalAssessment: {
          status: "needs_review",
          reason: "参考图已回流，进入人工复核。",
        },
        providerCalled: true,
        actualImage2Triggered: !input.mockProviderResult,
        referenceImageCount: referenceImages.length,
      };
      writeCurrentProjectRuntimeJson(providerObservationPath, providerObservation, source);
      writeCurrentProjectRuntimeJson(semanticQaPath, semanticQa, source);
      const result = {
        id: spec.id,
        type: spec.type,
        name: spec.name,
        status: "needs_review",
        path: outputPath,
        imageUrl: runtimeFileUrl(outputPath),
        outputFilePath,
        outputSha256,
        requestPromptSha256: promptAudit.requestPromptSha256,
        usedByShotIds: spec.usedByShotIds || [selected.shotId].filter(Boolean),
        textConstraints: spec.textConstraints || [],
        providerId: input.providerId,
        generatedAt,
        providerObservationPath,
        semanticQaPath,
      };
      results.push(result);
      visualMemory = updateVisualMemoryAsset(visualMemory, result, selected);
      writeCurrentProjectRuntimeJson(source.visualMemoryRelativePath, visualMemory, source);
    }

    const successful = results.filter((result) => result.status === "needs_review");
    if (successful.length) {
      writeCurrentProjectRuntimeJson(source.visualMemoryRelativePath, visualMemory, source);
    }
    const missing = results.filter((result) => result.status === "missing");
    return {
      ok: successful.length > 0 && missing.length === 0,
      ...runtimePolicy({
        runMode: "current_project_image2_asset_generate",
        providerCalled,
        prepareRan: false,
        projectVibeWritten: false,
        liveSubmitAllowed: false,
        workerSpawnForbidden: true,
        dryRunOnly: input.mockProviderResult,
      }),
      endpoint: currentProjectImage2AssetGenerateEndpoint,
      source: "runtime_endpoint",
      projectionKind: "current_project_image2_asset_generate",
      status: missing.length ? "missing" : "needs_review",
      uiStatus: missing.length ? "missing" : "needs_review",
      generatedAt,
      scope: input.scope,
      selectedShotId: primarySelected.shotId,
      selectedShotIds,
      providerId: input.providerId,
      requestedSize: IMAGE2_GENERATE_DEFAULT_SIZE,
      requestedAspectRatio: IMAGE2_GENERATE_DEFAULT_ASPECT_RATIO,
      generatedAssetCount: successful.length,
      assets: results,
      providerCalled,
      runtimeProviderSubmitAttempted: providerCalled && !input.mockProviderResult,
      runtimeExternalNetworkCallMade: externalNetworkCallMade,
      formalPromotionBlocked: true,
      liveSubmitAllowed: false,
      projectVibeWritten: false,
      visualMemoryWritten: successful.length > 0,
      workerSpawnForbidden: true,
      blockers: missing.map((result) => result.message).filter(Boolean),
      message: missing.length
        ? `${missing.length} 个参考没有拿到回流，可以稍后重试。`
        : "参考已生成，等待人工复核。",
      ...extra,
    };
  }

  async function handleCurrentProjectImage2AssetGenerateRoute(req, res, url) {
    if (req.method !== "POST" || url.pathname !== currentProjectImage2AssetGenerateEndpoint) return false;
    const routeContext = await currentProjectRouteContext(req, res, url, currentProjectImage2AssetGenerateEndpoint);
    if (!routeContext) return true;
    const input = assetGenerateRequestInput(url, routeContext.body);
    const payload = await currentProjectImage2AssetGenerateResponse(input, {
      running: runtimeState(),
      ignoredRequestContext: requestOverrideDiagnostics(routeContext.requestContext),
    }, routeContext.source);
    writeJson(res, payload.ok === false ? 409 : 200, payload);
    return true;
  }

  return {
    assetGenerateRequestInput,
    currentProjectImage2AssetGenerateResponse,
    handleCurrentProjectImage2AssetGenerateRoute,
  };
}
