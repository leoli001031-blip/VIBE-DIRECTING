import { createHash } from "node:crypto";
import path from "node:path";
import { buildImage2CleanBasePrompt } from "../src/core/image2PromptBase.ts";
import { IMAGE2_GENERATE_DEFAULT_ASPECT_RATIO, IMAGE2_GENERATE_DEFAULT_SIZE } from "../src/core/providerPolicy.ts";
import { fetchImageEditBytesFromProvider } from "./runtime-api-current-project-p6-real-image2-submit.mts";

const CONFIRM_PHRASE = "generate-image2-end-frame";
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
  return String(value || "shot")
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80) || "shot";
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

function requestBodyString(body, names) {
  if (!isRecord(body)) return undefined;
  for (const name of names) {
    const value = body[name];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

function providerConfigFor(statuses, providerId) {
  return (Array.isArray(statuses) ? statuses : []).find((item) => item?.providerId === providerId);
}

function mimeTypeForImagePath(filePath) {
  const ext = path.extname(String(filePath || "")).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  return "image/png";
}

function image2EndFrameRequestInput(url, body) {
  const selectedShotId = asString(url.searchParams.get("selectedShotId"))
    || requestBodyString(body, ["selectedShotId", "shotId"]);
  const selectedShotIds = uniqueStrings(Array.isArray(body?.selectedShotIds)
    ? body.selectedShotIds
    : selectedShotId ? [selectedShotId] : []);
  const mockProviderResult = normalizeMockProviderResult(body?.mockProviderResult === undefined && body?.submitMode === "mock" ? true : body?.mockProviderResult);
  return {
    selectedShotId,
    selectedShotIds,
    providerId: requestBodyString(body, ["providerId"]) || "lanyi-image2",
    prompt: requestBodyString(body, ["prompt", "endFramePrompt"]),
    confirmation: isRecord(body?.confirmation) ? body.confirmation : undefined,
    mockProviderResult: mockProviderResult.enabled,
    mockProviderResultStatus: mockProviderResult.status,
  };
}

function rawStoryShots(storyFlow) {
  if (!isRecord(storyFlow)) return [];
  const directShots = Array.isArray(storyFlow.shots) ? storyFlow.shots.filter(isRecord).map((shot) => ({ shot, section: undefined })) : [];
  const sectionShots = (Array.isArray(storyFlow.sections) ? storyFlow.sections : [])
    .filter(isRecord)
    .flatMap((section) => Array.isArray(section.shots) ? section.shots.filter(isRecord).map((shot) => ({ shot, section })) : []);
  return [...directShots, ...sectionShots];
}

function rawShotId(shot, fallback) {
  return asString(shot?.id) || asString(shot?.shotId) || fallback;
}

function selectedRawShot(storyFlow, shotId) {
  return rawStoryShots(storyFlow).find((entry, index) => rawShotId(entry.shot, `S${index + 1}`) === shotId)?.shot;
}

function normalizedShot(workbenchFacts, shotId) {
  const shots = Array.isArray(workbenchFacts?.storyFlow?.shots) ? workbenchFacts.storyFlow.shots : [];
  return shotId ? shots.find((shot) => shot?.id === shotId) : shots[0];
}

function safeRuntimePath(value) {
  const normalized = String(value || "").trim().replace(/\\/g, "/");
  if (!normalized) return undefined;
  if (/^https?:\/\//i.test(normalized)) return undefined;
  if (path.isAbsolute(normalized)) return undefined;
  if (normalized === ".." || normalized.startsWith("../") || normalized.includes("/../")) return undefined;
  return normalized.replace(/^\.\//, "");
}

function candidateStartFramePaths({ source, rawShot, shot, projectionObservation, runtimeRelativeFromValue }) {
  const shotId = asString(rawShot?.id) || asString(rawShot?.shotId) || asString(shot?.id);
  const candidates = [
    asString(rawShot?.startFrame),
    asString(rawShot?.startFramePath),
    asString(rawShot?.imagePath),
    asString(shot?.startFrame),
    asString(projectionObservation?.expectedOutputPath),
    asString(projectionObservation?.imageUrl),
    shotId ? `${source.runRootRelativePath}/real-trigger-one-shot/${shotId}/image2-start.png` : undefined,
    shotId ? `${source.runRootRelativePath}/outputs/shots/${shotId}/start.png` : undefined,
  ];
  const normalized = [];
  for (const candidate of candidates) {
    const runtimeRelative = typeof runtimeRelativeFromValue === "function"
      ? runtimeRelativeFromValue(candidate)
      : candidate;
    const safe = safeRuntimePath(runtimeRelative);
    if (!safe) continue;
    normalized.push(safe);
    if (!safe.startsWith(`${source.runRootRelativePath}/`)) {
      normalized.push(`${source.runRootRelativePath}/${safe}`);
    }
  }
  return uniqueStrings(normalized);
}

function compactText(value, max = 420) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return undefined;
  return text.length > max ? `${text.slice(0, Math.max(0, max - 3)).trim()}...` : text;
}

function objectText(value, max = 520) {
  if (!isRecord(value)) return undefined;
  try {
    return compactText(JSON.stringify(value), max);
  } catch {
    return undefined;
  }
}

function shotFieldText(shot, names) {
  const lines = [];
  if (!isRecord(shot)) return lines;
  for (const name of names) {
    const value = shot[name];
    if (typeof value === "string" && value.trim()) lines.push(`${name}: ${value.trim()}`);
    else if (Array.isArray(value) && value.some((item) => typeof item === "string" && item.trim())) {
      lines.push(`${name}: ${textArray(value).join("; ")}`);
    } else if (isRecord(value)) {
      const text = objectText(value);
      if (text) lines.push(`${name}: ${text}`);
    }
  }
  return lines;
}

function endpointMotionText({ rawShot, shot, prompt }) {
  const fields = [
    "storyFunction",
    "motionIntent",
    "motionBrief",
    "motionPlan",
    "actionPlan",
    "startPose",
    "endPose",
    "startEndpoint",
    "endEndpoint",
    "endFrameIntent",
    "endFrameAction",
    "endFramePrompt",
    "subjectAction",
    "characterAction",
    "propAction",
    "cameraMotion",
    "cameraMove",
    "movement",
    "blocking",
    "bodyMechanics",
    "editableRegions",
    "protectedRegions",
    "mustPreserve",
    "mustNotAdd",
    "allowedDelta",
    "motionEndpointContract",
  ];
  return uniqueStrings([
    asString(prompt) ? `requestPrompt: ${prompt}` : "",
    ...shotFieldText(rawShot, fields),
    ...shotFieldText(shot, fields),
  ]);
}

function hasExplicitEndpointMotion(lines) {
  const normalized = lines.join(" ").toLowerCase();
  return Boolean(normalized) && /(\b(open|opens|opened|raise|raises|raised|lift|lifts|lifted|turn|turns|turned|tilt|tilts|tilted|step|steps|walk|walks|move|moves|moved|reach|reaches|reached|touch|touches|touched|press|presses|pressed|ignite|ignites|lit|glow|glows|look|looks|looked|gaze|gesture|hand|wrist|head|prop|endpoint|end pose|end frame)\b|打开|举起|抬起|转身|转头|倾斜|迈步|走到|移动|伸手|触碰|按下|点亮|亮起|发光|看向|凝视|手部|手腕|头部|道具|动作终点|结束姿态|结束帧)/u.test(normalized);
}

function resolveStartFramePath(input) {
  for (const candidate of candidateStartFramePaths(input)) {
    if (!input.runtimePathExists(candidate)) continue;
    if (!/\.(png|jpe?g|webp)$/i.test(candidate)) continue;
    return candidate;
  }
  return undefined;
}

function endFrameMotionGuidance({ rawShot, shot, prompt }) {
  const endpointLines = endpointMotionText({ rawShot, shot, prompt });
  return {
    endpointLines,
    hasExplicitEndpoint: hasExplicitEndpointMotion(endpointLines),
    promptLines: [
      "Motion endpoint contract:",
      "The end frame is not a second beauty still. It must be the settled endpoint of the shot action, derived from the attached start frame.",
      "Make exactly one visible action-state change: subject pose, hand/prop contact, gaze/head angle, object state, reveal, or camera framing as specified below.",
      "Preserve camera angle, character identity, scene layout, costume, approved props, and overall style unless an endpoint fact explicitly says otherwise.",
      "Prefer a readable small-to-medium physical change over a barely changed still; avoid large unexplained redraws or new story elements.",
      ...endpointLines.map((line) => `- ${compactText(line, 360)}`).filter(Boolean),
    ],
  };
}

function endFramePrompt({ rawShot, shot, prompt }) {
  const motion = endFrameMotionGuidance({ rawShot, shot, prompt });
  const sourcePrompt = [
    "Use the attached approved start frame as the visual source for an end frame.",
    "Keep the same character identity, scene layout, camera angle, aspect ratio, and clean restrained style.",
    "Only change the action state needed for the end of this shot. Do not add extra characters, text, logos, labels, or clutter.",
    ...motion.promptLines,
    asString(prompt),
    asString(shot?.title) ? `Shot title: ${shot.title}.` : "",
    asString(shot?.storyFunction) ? `Shot action: ${shot.storyFunction}.` : "",
    asString(rawShot?.storyFunction) ? `Story facts: ${rawShot.storyFunction}.` : "",
    asString(rawShot?.description) ? `Description: ${rawShot.description}.` : "",
  ].filter(Boolean).join(" ");
  return buildImage2CleanBasePrompt({
    sourcePrompt,
    frameRole: "end_frame",
    aspectRatio: IMAGE2_GENERATE_DEFAULT_ASPECT_RATIO,
    maxSourceCharacters: 640,
  });
}

function updateStoryFlowEndFrame(storyFlow, shotId, outputPath) {
  const next = isRecord(storyFlow) ? structuredClone(storyFlow) : {};
  const updateShot = (shot) => {
    if (!isRecord(shot)) return shot;
    const id = rawShotId(shot);
    if (id !== shotId) return shot;
    return {
      ...shot,
      endFrame: outputPath,
      endFrameStatus: "needs_review",
      keyframePairStatus: "end_frame_needs_review",
    };
  };
  if (Array.isArray(next.shots)) next.shots = next.shots.map(updateShot);
  if (Array.isArray(next.sections)) {
    next.sections = next.sections.map((section) => {
      if (!isRecord(section) || !Array.isArray(section.shots)) return section;
      return { ...section, shots: section.shots.map(updateShot) };
    });
  }
  return next;
}

export function createRuntimeApiCurrentProjectImage2EndFrameSubmit(deps) {
  const {
    currentProjectImage2EndFrameSubmitEndpoint,
    currentProjectRouteContext,
    projectProjectionFromSource,
    readProjectFacts,
    currentProjectWorkbenchFacts,
    getProviderApiKey,
    getProviderConfigStatuses,
    requestOverrideDiagnostics,
    runtimePolicy,
    runtimeFileUrl,
    runtimePathExists,
    runtimeRelativeFromValue,
    scopedRepoPath,
    readFileSync,
    sha256Bytes: sha256BytesDep,
    writeCurrentProjectRuntimeBytes,
    writeCurrentProjectRuntimeJson,
    writeJson,
    running,
  } = deps;

  function runtimeState() {
    return typeof running === "function" ? running() : Boolean(running);
  }

  async function currentProjectImage2EndFrameSubmitResponse(input, extra = {}, source) {
    const generatedAt = new Date().toISOString();
    const projectFacts = readProjectFacts(source);
    const workbenchFacts = currentProjectWorkbenchFacts(source, projectFacts);
    const projection = projectProjectionFromSource(source);
    const shot = normalizedShot(workbenchFacts, input.selectedShotId);
    const shotId = input.selectedShotId || shot?.id;
    const rawShot = selectedRawShot(projectFacts.storyFlow, shotId);
    const selectedShotIds = uniqueStrings(input.selectedShotIds?.length ? input.selectedShotIds : shotId ? [shotId] : []);
    const projectionObservation = projection.observations?.find((item) => item.shotId === shotId);
    const startFramePath = resolveStartFramePath({
      source,
      rawShot,
      shot,
      projectionObservation,
      runtimeRelativeFromValue,
      runtimePathExists,
    });
    const providerStatuses = getProviderConfigStatuses();
    const providerConfig = providerConfigFor(providerStatuses, input.providerId);
    const apiKey = getProviderApiKey(input.providerId);
    const confirmation = input.confirmation || {};
    const confirmationOk = confirmation.confirmed === true
      && confirmation.phrase === CONFIRM_PHRASE
      && Boolean(asString(confirmation.receiptId))
      && Boolean(asString(confirmation.confirmedAt));
    const motionGuidance = endFrameMotionGuidance({ rawShot, shot, prompt: input.prompt });
    const blockers = uniqueStrings([
      shotId ? "" : "请先选择一个镜头。",
      selectedShotIds.length === 1 ? "" : "结束帧一次只处理一个镜头。",
      rawShot || shot ? "" : "当前镜头不在故事流里。",
      startFramePath ? "" : "请先生成并复核起始帧。",
      motionGuidance.hasExplicitEndpoint ? "" : "请先确认这个镜头的结束动作，再生成结束帧。",
      providerConfig ? "" : "未找到可用的出图配置。",
      providerConfig?.credential?.keyStatus === "configured" && apiKey ? "" : "请先在设置里保存 Lanyi Key。",
      confirmationOk ? "" : "需要在提交前明确确认本次生成结束帧。",
      typeof writeCurrentProjectRuntimeBytes === "function" && typeof writeCurrentProjectRuntimeJson === "function" ? "" : "运行时写入能力不可用。",
    ]);

    if (blockers.length > 0) {
      return {
        ok: false,
        ...runtimePolicy({
          runMode: "current_project_image2_end_frame_submit",
          providerCalled: false,
          prepareRan: false,
          projectVibeWritten: false,
          liveSubmitAllowed: false,
          workerSpawnForbidden: true,
          dryRunOnly: true,
        }),
        endpoint: currentProjectImage2EndFrameSubmitEndpoint,
        source: "runtime_endpoint",
        projectionKind: "current_project_image2_end_frame_submit",
        status: "blocked",
        uiStatus: "blocked",
        selectedShotId: shotId,
        selectedShotIds,
        providerId: input.providerId,
        providerOperation: "image.edit",
        providerCalled: false,
        runtimeExternalNetworkCallMade: false,
        projectVibeWritten: false,
        storyFlowWritten: false,
        formalPromotionBlocked: true,
        blockers,
        message: blockers[0],
        ...extra,
      };
    }

    const safeShotId = safePathSegment(shotId);
    const outputPath = `${source.runRootRelativePath}/outputs/shots/${safeShotId}/end.png`;
    const providerObservationPath = `${source.runRootRelativePath}/provider_observations/end_frames/${safeShotId}.json`;
    const rawSsePath = `${source.runRootRelativePath}/provider_observations/end_frames/${safeShotId}.sse.txt`;
    const semanticQaPath = `${source.runRootRelativePath}/semantic_qa/end_frames/${safeShotId}.json`;
    const pairQaPath = `${source.runRootRelativePath}/keyframe_pairs/${safeShotId}.json`;
    const startBytes = readFileSync(scopedRepoPath(startFramePath));
    const sourceStartFrameSha256 = typeof sha256BytesDep === "function" ? sha256BytesDep(startBytes) : sha256Bytes(startBytes);
    const prompt = endFramePrompt({ rawShot, shot, prompt: input.prompt });
    const promptSha256 = sha256Bytes(Buffer.from(prompt, "utf8"));
    const promptPreview = compactText(prompt, 900);
    const providerResult = input.mockProviderResult
      ? input.mockProviderResultStatus === "missing"
        ? {
          ok: false,
          statusCode: 502,
          errorType: "provider_missing",
          failureKind: "provider_missing",
          message: "出图服务没有返回可用图片，可以重试一次。",
          diagnostic: { kind: "parse_error", message: "Mock Image2 edit provider returned no end frame.", retryable: true },
          providerResponseMetadata: { mockProviderResult: true, returnedCount: 0, retryable: true },
        }
        : {
          ok: true,
          bytes: MOCK_PNG,
          providerRequestId: `mock_lanyi_image2_end_${Date.now()}`,
          providerResponseMetadata: { mockProviderResult: true, returnedCount: 1 },
        }
      : await fetchImageEditBytesFromProvider({
        apiKey,
        baseUrl: providerConfig.baseUrl,
        model: providerConfig.imageModel,
        prompt,
        size: IMAGE2_GENERATE_DEFAULT_SIZE,
        referenceImages: [{
          path: startFramePath,
          name: path.basename(startFramePath),
          mimeType: mimeTypeForImagePath(startFramePath),
          bytes: startBytes,
        }],
      });
    const rawSseFilePath = providerResult.rawSseBytes?.length
      ? writeCurrentProjectRuntimeBytes(rawSsePath, providerResult.rawSseBytes, source)
      : undefined;

    if (!providerResult.ok) {
      const providerObservation = {
        schemaVersion: "current_project_image2_end_frame_provider_observation_v1",
        generatedAt,
        provider: input.providerId,
        providerId: input.providerId,
        providerOperation: "image.edit",
        baseUrl: providerConfig.baseUrl,
        model: providerConfig.imageModel,
        requestedSize: IMAGE2_GENERATE_DEFAULT_SIZE,
        requestedAspectRatio: IMAGE2_GENERATE_DEFAULT_ASPECT_RATIO,
        shotId,
        motionEndpointFacts: motionGuidance.endpointLines,
        promptSha256,
        promptPreview,
        sourceStartFramePath: startFramePath,
        sourceStartFrameSha256,
        outputPath,
        providerCalled: true,
        actualImage2Triggered: !input.mockProviderResult,
        externalNetworkCallMade: !input.mockProviderResult,
        rawCredentialMaterialSeen: false,
        projectVibeWritten: false,
        storyFlowWritten: false,
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
        schemaVersion: "current_project_image2_end_frame_semantic_qa_v1",
        generatedAt,
        reviewedAt: generatedAt,
        shotId,
        outputPath,
        status: "missing",
        qaStatus: "missing",
        finalAssessment: { status: "missing", reason: providerResult.message, retryable: true },
        providerCalled: true,
        actualImage2Triggered: !input.mockProviderResult,
      };
      writeCurrentProjectRuntimeJson(providerObservationPath, providerObservation, source);
      writeCurrentProjectRuntimeJson(semanticQaPath, semanticQa, source);
      return {
        ok: false,
        ...runtimePolicy({
          runMode: "current_project_image2_end_frame_submit",
          providerCalled: true,
          prepareRan: false,
          projectVibeWritten: false,
          liveSubmitAllowed: false,
          workerSpawnForbidden: true,
          dryRunOnly: input.mockProviderResult,
        }),
        endpoint: currentProjectImage2EndFrameSubmitEndpoint,
        source: "runtime_endpoint",
        projectionKind: "current_project_image2_end_frame_submit",
        status: "missing",
        uiStatus: "missing",
        selectedShotId: shotId,
        selectedShotIds,
        providerId: input.providerId,
        providerOperation: "image.edit",
        sourceStartFramePath: startFramePath,
        providerObservationPath,
        semanticQaPath,
        providerCalled: true,
        runtimeExternalNetworkCallMade: !input.mockProviderResult,
        projectVibeWritten: false,
        storyFlowWritten: false,
        formalPromotionBlocked: true,
        blockers: [providerResult.message],
        message: providerResult.message,
        ...extra,
      };
    }

    const outputFilePath = writeCurrentProjectRuntimeBytes(outputPath, providerResult.bytes, source);
    const outputSha256 = typeof sha256BytesDep === "function" ? sha256BytesDep(providerResult.bytes) : sha256Bytes(providerResult.bytes);
    const providerObservation = {
      schemaVersion: "current_project_image2_end_frame_provider_observation_v1",
      generatedAt,
      providerRequestId: providerResult.providerRequestId,
      provider: input.providerId,
      providerId: input.providerId,
      providerOperation: "image.edit",
      baseUrl: providerConfig.baseUrl,
      model: providerConfig.imageModel,
      requestedSize: IMAGE2_GENERATE_DEFAULT_SIZE,
      requestedAspectRatio: IMAGE2_GENERATE_DEFAULT_ASPECT_RATIO,
      shotId,
      motionEndpointFacts: motionGuidance.endpointLines,
      promptSha256,
      promptPreview,
      sourceStartFramePath: startFramePath,
      sourceStartFrameSha256,
      outputPath,
      outputSha256,
      outputBytes: providerResult.bytes.length,
      providerCalled: true,
      actualImage2Triggered: !input.mockProviderResult,
      providerCallsAttempted: input.mockProviderResult ? 0 : 1,
      maxProviderCallsPerExecution: 1,
      externalNetworkCallMade: !input.mockProviderResult,
      rawCredentialMaterialSeen: false,
      projectVibeWritten: false,
      storyFlowWritten: true,
      providerResponseMetadata: providerResult.providerResponseMetadata,
      providerTransport: providerResult.providerResponseMetadata?.transport,
      providerTransportOperation: providerResult.providerResponseMetadata?.providerOperation,
      rawSsePath: rawSseFilePath ? rawSsePath : undefined,
      rawSseSha256: providerResult.providerResponseMetadata?.rawSseSha256,
    };
    const semanticQa = {
      schemaVersion: "current_project_image2_end_frame_semantic_qa_v1",
      generatedAt,
      reviewedAt: generatedAt,
      shotId,
      sourceStartFramePath: startFramePath,
      sourceStartFrameSha256,
      outputPath,
      outputSha256,
      reviewedOutputSha256: outputSha256,
      status: "needs_review",
      qaStatus: "needs_review",
      finalAssessment: {
        status: "needs_review",
        reason: "结束帧已回流，等待首尾帧复核。",
      },
      providerCalled: true,
      actualImage2Triggered: !input.mockProviderResult,
    };
    const pairQa = {
      schemaVersion: "current_project_keyframe_pair_qa_v1",
      generatedAt,
      status: "needs_review",
      shotId,
      startFramePath,
      startFrameSha256: sourceStartFrameSha256,
      endFramePath: outputPath,
      endFrameSha256: outputSha256,
      providerRequestId: providerResult.providerRequestId,
      pairReviewRequired: true,
      completeVerified: false,
      notes: ["End frame is derived from the approved start frame via image.edit and still requires human review."],
    };
    writeCurrentProjectRuntimeJson(providerObservationPath, providerObservation, source);
    writeCurrentProjectRuntimeJson(semanticQaPath, semanticQa, source);
    writeCurrentProjectRuntimeJson(pairQaPath, pairQa, source);
    const nextStoryFlow = updateStoryFlowEndFrame(projectFacts.storyFlow, shotId, outputPath);
    writeCurrentProjectRuntimeJson(source.storyFlowRelativePath, nextStoryFlow, source);

    return {
      ok: true,
      ...runtimePolicy({
        runMode: "current_project_image2_end_frame_submit",
        providerCalled: true,
        prepareRan: false,
        projectVibeWritten: false,
        liveSubmitAllowed: false,
        workerSpawnForbidden: true,
        dryRunOnly: input.mockProviderResult,
      }),
      endpoint: currentProjectImage2EndFrameSubmitEndpoint,
      source: "runtime_endpoint",
      projectionKind: "current_project_image2_end_frame_submit",
      status: "needs_review",
      uiStatus: "needs_review",
      generatedAt,
      selectedShotId: shotId,
      selectedShotIds,
      providerId: input.providerId,
      providerOperation: "image.edit",
      requestedSize: IMAGE2_GENERATE_DEFAULT_SIZE,
      requestedAspectRatio: IMAGE2_GENERATE_DEFAULT_ASPECT_RATIO,
      motionEndpointFacts: motionGuidance.endpointLines,
      promptSha256,
      sourceStartFramePath: startFramePath,
      sourceStartFrameSha256,
      outputPath,
      outputFilePath,
      imageUrl: runtimeFileUrl(outputPath),
      outputSha256,
      providerObservationPath,
      semanticQaPath,
      pairQaPath,
      providerCalled: true,
      runtimeProviderSubmitAttempted: !input.mockProviderResult,
      runtimeExternalNetworkCallMade: !input.mockProviderResult,
      formalPromotionBlocked: true,
      liveSubmitAllowed: false,
      projectVibeWritten: false,
      storyFlowWritten: true,
      workerSpawnForbidden: true,
      blockers: [],
      message: "结束帧已生成，等待人工复核。",
      ...extra,
    };
  }

  async function handleCurrentProjectImage2EndFrameSubmitRoute(req, res, url) {
    if (req.method !== "POST" || url.pathname !== currentProjectImage2EndFrameSubmitEndpoint) return false;
    const routeContext = await currentProjectRouteContext(req, res, url, currentProjectImage2EndFrameSubmitEndpoint);
    if (!routeContext) return true;
    const input = image2EndFrameRequestInput(url, routeContext.body);
    const payload = await currentProjectImage2EndFrameSubmitResponse(input, {
      running: runtimeState(),
      ignoredRequestContext: requestOverrideDiagnostics(routeContext.requestContext),
    }, routeContext.source);
    writeJson(res, payload.ok === false ? 409 : 200, payload);
    return true;
  }

  return {
    image2EndFrameRequestInput,
    currentProjectImage2EndFrameSubmitResponse,
    handleCurrentProjectImage2EndFrameSubmitRoute,
  };
}
