import { createHash } from "node:crypto";
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

async function fetchAssetImageFromProvider({ providerId, apiKey, providerConfig, prompt }) {
  if (providerId === APIKEY_FUN_RESPONSES_IMAGE_PROVIDER_ID) {
    const result = await fetchApikeyFunImageViaResponses({
      apiKey,
      endpoint: providerConfig.baseUrl,
      model: providerConfig.imageModel || "gpt-5.5",
      prompt,
      size: IMAGE2_GENERATE_DEFAULT_SIZE,
      quality: "low", // intentional default to keep generation cost predictable; size and aspect ratio come from providerPolicy
      stream: true,
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
    .filter((type) => type === "character" || type === "scene" || type === "prop");
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
  return rawShotById(projectFacts?.storyFlow, shotId)
    || rawShotById({ shots: Array.isArray(projectFacts?.shots) ? projectFacts.shots : [] }, shotId)
    || rawShotById({ shots: Array.isArray(projectFacts?.projectVibe?.shots) ? projectFacts.projectVibe.shots : [] }, shotId);
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
  for (const asset of assets) {
    if (!includeType(asset.type) || asset.status === "locked") continue;
    if (!assetMatchesShot(asset, selected)) continue;
    specs.push({
      id: asset.id,
      type: asset.type,
      name: asset.name || displayNameForId(asset.id, asset.type),
      existingPath: asset.path,
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
  const seen = new Set(specs.map((spec) => `${spec.type}:${spec.id}`));
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
  if (selected.sceneId && includeType("scene") && !specs.some((spec) => spec.type === "scene")) {
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

function providerPromptAudit(prompt) {
  return {
    requestPromptVersion: "reference_asset_prompt_v2",
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

function updateVisualMemoryAsset(visualMemory, result, selected) {
  const next = isRecord(visualMemory) ? structuredClone(visualMemory) : {};
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
    generatedBy: {
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
    const specs = assetSpecsForShots(workbenchFacts, selectedShots, input.assetTypes);
    const blockers = uniqueStrings([
      selectedShotIds.length ? "" : "项目里还没有可补参考的镜头。",
      providerConfig ? "" : "未找到可用的出图配置。",
      providerConfig?.credential?.keyStatus === "configured" && apiKey ? "" : "请先在设置里保存生成服务 Key。",
      confirmationOk ? "" : "需要在提交前明确确认本次生成参考。",
      specs.length ? "" : "当前镜头没有需要生成的角色、场景或道具参考。",
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
    for (const [index, spec] of specs.entries()) {
      const assetId = safePathSegment(spec.id);
      const selected = selectedShots.find((shot) => Array.isArray(spec.usedByShotIds) && spec.usedByShotIds.includes(shot.shotId)) || primarySelected;
      const outputPath = `${source.runRootRelativePath}/assets/generated/${spec.type}_${assetId}.png`;
      const providerObservationPath = `${source.runRootRelativePath}/provider_observations/assets/${spec.type}_${assetId}.json`;
      const rawSsePath = `${source.runRootRelativePath}/provider_observations/assets/${spec.type}_${assetId}.sse.txt`;
      const semanticQaPath = `${source.runRootRelativePath}/semantic_qa/assets/${spec.type}_${assetId}.json`;
      const prompt = assetPrompt(spec, selected);
      const promptAudit = providerPromptAudit(prompt);
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
          providerSlot: "image.reference_asset",
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
        providerSlot: "image.reference_asset",
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
        providerCalled: true,
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
      providerCalled: true,
      runtimeProviderSubmitAttempted: !input.mockProviderResult,
      runtimeExternalNetworkCallMade: !input.mockProviderResult,
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
