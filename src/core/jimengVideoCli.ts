export const jimengVideoCliSchemaVersion = "0.1.0";

export const JIMENG_CLI_DEFAULT_BINARY = "dreamina";
export const JIMENG_CLI_SUPPORTED_MODEL_VERSIONS = [
  "seedance2.0",
  "seedance2.0fast",
  "seedance2.0_vip",
  "seedance2.0fast_vip",
] as const;
export const JIMENG_CLI_VIP_MODEL_VERSION = "seedance2.0_vip";
export const JIMENG_CLI_DEFAULT_MODEL_VERSION = "seedance2.0";
export const JIMENG_CLI_DEFAULT_VIDEO_RESOLUTION = "720p";
export const JIMENG_CLI_HIGH_COST_VIDEO_RESOLUTION = "1080p";
export const JIMENG_CLI_SUPPORTED_VIDEO_RESOLUTIONS = ["720p", "1080p"] as const;
export const JIMENG_CLI_DEFAULT_DURATION_SECONDS = 5;
export const JIMENG_CLI_MIN_DURATION_SECONDS = 4;
export const JIMENG_CLI_MAX_DURATION_SECONDS = 15;
export const JIMENG_CLI_DEFAULT_SHORT_POLL_SECONDS = 20;
export const JIMENG_CLI_DEFAULT_POLL_INTERVAL_SECONDS = 20;
export const JIMENG_CLI_EXPECTED_QUEUE_WAIT_MINUTES = 50;
export const JIMENG_CLI_DEFAULT_QUEUE_WAIT_SECONDS = 60 * 60;
export const JIMENG_CLI_DEFAULT_RESUME_INTERVAL_SECONDS = 10 * 60;
export const JIMENG_CLI_DEFAULT_MAX_CONCURRENT_VIDEO_JOBS = 1;
export const JIMENG_FIRST_FRAME_PROTECTION_PROMPT_VERSION = "jimeng_first_frame_protection_v1";
export const JIMENG_FIRST_FRAME_PROTECTION_PROMPT_MARKER = `[${JIMENG_FIRST_FRAME_PROTECTION_PROMPT_VERSION}]`;
export const JIMENG_FIRST_FRAME_PROTECTION_SECONDS = 0.5;
export const JIMENG_FIRST_FRAME_PROTECTION_RULES = [
  "For the first 0.5 seconds, keep the provided first frame composition and character proportions stable.",
  "During that protected first 0.5 seconds, allow only subtle environmental motion such as rain, light shimmer, or tiny atmospheric drift.",
  "Begin camera movement only after 0.5 seconds.",
  "Treat the input image as visual truth; the prompt should describe only the next motion delta, not redraw or reinterpret the picture.",
  "Do not stretch characters, change focal length, re-project the person, or re-crop/reframe the shot during the protected opening.",
];
export const JIMENG_FULL_FRAME_REFERENCE_PROMPT_VERSION = "jimeng_full_frame_reference_motion_v1";
export const JIMENG_FULL_FRAME_REFERENCE_PROMPT_MARKER = `[${JIMENG_FULL_FRAME_REFERENCE_PROMPT_VERSION}]`;
export const JIMENG_FULL_FRAME_REFERENCE_RULES = [
  "The input image is already a composed scene-state frame, not a loose reference collage.",
  "Keep the character identity, scene layout, prop placement, anime style, and overall composition from that frame.",
  "Use the prompt to describe only the next motion: body micro-action, gaze, environmental movement, and camera movement.",
  "Avoid scene changes, new characters, subtitles, logos, live action conversion, or photorealistic reinterpretation.",
  "Let the first frame breathe naturally into motion without local hold/cut post-processing.",
];

export type JimengCliModelVersion = typeof JIMENG_CLI_SUPPORTED_MODEL_VERSIONS[number];
export type JimengCliVideoResolution = typeof JIMENG_CLI_SUPPORTED_VIDEO_RESOLUTIONS[number];

export interface JimengCliModelOption {
  value: JimengCliModelVersion;
  label: string;
  tier: "standard" | "fast" | "vip" | "fast_vip";
  defaultVideoResolution: JimengCliVideoResolution;
  supportedVideoResolutions: JimengCliVideoResolution[];
  requiresExplicitHighCostConfirmation: boolean;
  userCostHint: string;
}

export const JIMENG_CLI_MODEL_OPTIONS: JimengCliModelOption[] = [
  {
    value: "seedance2.0",
    label: "Seedance 2.0",
    tier: "standard",
    defaultVideoResolution: JIMENG_CLI_DEFAULT_VIDEO_RESOLUTION,
    supportedVideoResolutions: ["720p"],
    requiresExplicitHighCostConfirmation: false,
    userCostHint: "日常默认档，适合大多数项目测试。",
  },
  {
    value: "seedance2.0fast",
    label: "Seedance 2.0 Fast",
    tier: "fast",
    defaultVideoResolution: JIMENG_CLI_DEFAULT_VIDEO_RESOLUTION,
    supportedVideoResolutions: ["720p"],
    requiresExplicitHighCostConfirmation: false,
    userCostHint: "更快的普通测试档，画质优先级低于标准档。",
  },
  {
    value: "seedance2.0_vip",
    label: "Seedance 2.0 VIP",
    tier: "vip",
    defaultVideoResolution: JIMENG_CLI_DEFAULT_VIDEO_RESOLUTION,
    supportedVideoResolutions: ["720p", JIMENG_CLI_HIGH_COST_VIDEO_RESOLUTION],
    requiresExplicitHighCostConfirmation: true,
    userCostHint: "VIP 通道适合正式验收；默认仍用 720p，1080p 需要单独确认成本。",
  },
  {
    value: "seedance2.0fast_vip",
    label: "Seedance 2.0 Fast VIP",
    tier: "fast_vip",
    defaultVideoResolution: JIMENG_CLI_DEFAULT_VIDEO_RESOLUTION,
    supportedVideoResolutions: ["720p", JIMENG_CLI_HIGH_COST_VIDEO_RESOLUTION],
    requiresExplicitHighCostConfirmation: true,
    userCostHint: "更快的 VIP 通道；默认仍用 720p，1080p 需要单独确认成本。",
  },
];

export function isJimengVipModelVersion(value: string | undefined): boolean {
  return value === "seedance2.0_vip" || value === "seedance2.0fast_vip";
}

export function jimengVideoResolutionOptionsForModel(modelVersion: string | undefined): JimengCliVideoResolution[] {
  return isJimengVipModelVersion(modelVersion) ? ["720p", JIMENG_CLI_HIGH_COST_VIDEO_RESOLUTION] : ["720p"];
}

export function normalizeJimengVideoResolution(
  videoResolution: string | undefined,
  modelVersion: string | undefined,
): JimengCliVideoResolution {
  const supported = jimengVideoResolutionOptionsForModel(modelVersion);
  return supported.includes(videoResolution as JimengCliVideoResolution)
    ? videoResolution as JimengCliVideoResolution
    : JIMENG_CLI_DEFAULT_VIDEO_RESOLUTION;
}

export type JimengVideoCliStatus =
  | "not_submitted"
  | "submitted"
  | "queued"
  | "generating"
  | "success"
  | "failed"
  | "timed_out"
  | "unknown";

export interface JimengImage2VideoPlanInput {
  imagePath: string;
  prompt: string;
  outputDir: string;
  durationSeconds?: number;
  videoResolution?: string;
  modelVersion?: string;
  firstFrameProtectionEnabled?: boolean;
  shortPollSeconds?: number;
  pollIntervalSeconds?: number;
  queueWaitSeconds?: number;
  cliPath?: string;
}

export interface JimengImage2VideoPlan {
  schemaVersion: string;
  providerId: "jimeng-video-cli";
  cliPath: string;
  command: "image2video";
  args: string[];
  sourcePrompt: string;
  prompt: string;
  firstFrameProtection: {
    enabled: boolean;
    promptVersion: string | null;
    protectedInitialSeconds: number;
    rules: string[];
  };
  imagePath: string;
  outputDir: string;
  durationSeconds: number;
  videoResolution: string;
  modelVersion: string;
  shortPollSeconds: number;
  pollIntervalSeconds: number;
  queueWaitSeconds: number;
  queuePolicy: {
    providerAsync: true;
    initialPollSeconds: number;
    pollIntervalSeconds: number;
    maxWaitSeconds: number;
    expectedQueueWaitMinutes: number;
    recommendedResumeIntervalSeconds: number;
    maxConcurrentVideoJobs: 1;
    timeoutIsRecoverable: true;
    resumeWithSubmitId: true;
    userMessage: string;
  };
}

export interface DreaminaQueueInfo {
  position?: number;
  length?: number;
  status?: string;
}

export interface DreaminaTaskInfo {
  submitId?: string;
  status: JimengVideoCliStatus;
  taskId?: string;
  queueInfo?: DreaminaQueueInfo;
  videoUrls: string[];
  localMediaPaths: string[];
  rawJsonCount: number;
  notes: string[];
}

export type JimengVideoUserStatus =
  | "not_generated"
  | "submitted"
  | "queued"
  | "generating"
  | "completed"
  | "recoverable";

export interface JimengVideoStatusProjectionInput {
  status?: unknown;
  submitId?: string;
  queueInfo?: DreaminaQueueInfo | Record<string, unknown>;
  queuePosition?: number;
  queueLength?: number;
  queueStatus?: string;
  videoPath?: string;
  outputVideoPath?: string;
  mediaPath?: string;
  videoUrls?: string[];
  localMediaPaths?: string[];
  timedOut?: boolean;
  recoverable?: boolean;
}

export interface JimengVideoStatusProjection {
  status: JimengVideoUserStatus;
  label: string;
  detail: string;
  shortSubmitId?: string;
  queuePosition?: number;
  queueLength?: number;
  queueStatus?: string;
  canResume: boolean;
  hasSubmitId: boolean;
  hasVideo: boolean;
  hasQueueInfo: boolean;
}

function positiveInteger(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) && value && value > 0 ? Math.floor(value) : fallback;
}

export function clampJimengDurationSeconds(value: number | undefined, fallback = JIMENG_CLI_DEFAULT_DURATION_SECONDS): number {
  const duration = positiveInteger(value, fallback);
  return Math.max(JIMENG_CLI_MIN_DURATION_SECONDS, Math.min(JIMENG_CLI_MAX_DURATION_SECONDS, duration));
}

function unique(items: string[]): string[] {
  return Array.from(new Set(items.filter(Boolean)));
}

function safePositiveNumber(value: unknown): number | undefined {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? Math.floor(numeric) : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function shortSubmitId(value: string | undefined): string | undefined {
  const cleaned = stringValue(value)?.replace(/[^A-Za-z0-9_-]/g, "");
  return cleaned ? cleaned.slice(0, 8) : undefined;
}

function queueInfoValue(value: JimengVideoStatusProjectionInput["queueInfo"]): DreaminaQueueInfo {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return {
    position:
      safePositiveNumber((value as Record<string, unknown>).position)
      ?? safePositiveNumber((value as Record<string, unknown>).queuePosition)
      ?? safePositiveNumber((value as Record<string, unknown>).queue_idx)
      ?? safePositiveNumber((value as Record<string, unknown>).queueIndex),
    length:
      safePositiveNumber((value as Record<string, unknown>).length)
      ?? safePositiveNumber((value as Record<string, unknown>).queueLength)
      ?? safePositiveNumber((value as Record<string, unknown>).queue_length),
    status:
      stringValue((value as Record<string, unknown>).status)
      ?? stringValue((value as Record<string, unknown>).queueStatus)
      ?? stringValue((value as Record<string, unknown>).queue_status),
  };
}

export function buildJimengFirstFrameProtectedPrompt(prompt: string): string {
  const trimmedPrompt = prompt.trim();
  if (
    trimmedPrompt.includes(JIMENG_FIRST_FRAME_PROTECTION_PROMPT_MARKER)
    || trimmedPrompt.includes(JIMENG_FULL_FRAME_REFERENCE_PROMPT_MARKER)
  ) {
    return trimmedPrompt;
  }
  return [
    JIMENG_FIRST_FRAME_PROTECTION_PROMPT_MARKER,
    "First-frame protection base prompt:",
    ...JIMENG_FIRST_FRAME_PROTECTION_RULES.map((rule) => `- ${rule}`),
    "",
    "Shot motion request:",
    trimmedPrompt,
  ].join("\n");
}

export function buildJimengFullFrameReferenceMotionPrompt(prompt: string): string {
  const trimmedPrompt = prompt.trim();
  if (
    trimmedPrompt.includes(JIMENG_FULL_FRAME_REFERENCE_PROMPT_MARKER)
    || trimmedPrompt.includes(JIMENG_FIRST_FRAME_PROTECTION_PROMPT_MARKER)
  ) {
    return trimmedPrompt;
  }
  return [
    JIMENG_FULL_FRAME_REFERENCE_PROMPT_MARKER,
    "Full-frame scene-state reference rules:",
    ...JIMENG_FULL_FRAME_REFERENCE_RULES.map((rule) => `- ${rule}`),
    "",
    "Shot motion request:",
    trimmedPrompt,
  ].join("\n");
}

export function normalizeDreaminaStatus(value: unknown): JimengVideoCliStatus {
  const text = String(value || "").trim().toLowerCase();
  if (!text) return "unknown";
  if (["success", "succeeded", "done", "completed", "complete", "finish", "finished"].includes(text)) return "success";
  if (["queued", "queueing", "in_queue", "inqueue", "waiting", "wait", "pending"].includes(text)) return "queued";
  if (["submitted", "created"].includes(text)) return "submitted";
  if (["running", "generating", "processing"].includes(text)) return "generating";
  if (["timeout", "timed_out", "timedout"].includes(text)) return "timed_out";
  if (["failed", "fail", "error", "canceled", "cancelled", "rejected"].includes(text)) return "failed";
  return "unknown";
}

export function buildJimengVideoStatusProjection(input: JimengVideoStatusProjectionInput = {}): JimengVideoStatusProjection {
  const submitId = stringValue(input.submitId);
  const shortId = shortSubmitId(submitId);
  const queue = queueInfoValue(input.queueInfo);
  const queuePosition = safePositiveNumber(input.queuePosition) ?? queue.position;
  const queueLength = safePositiveNumber(input.queueLength) ?? queue.length;
  const queueStatus = stringValue(input.queueStatus) ?? queue.status;
  const status = normalizeDreaminaStatus(input.status);
  const hasVideo = Boolean(
    stringValue(input.videoPath)
    || stringValue(input.outputVideoPath)
    || stringValue(input.mediaPath)?.match(/\.(?:mp4|mov|webm)(?:\?|$)/i)
    || input.videoUrls?.length
    || input.localMediaPaths?.length,
  );
  const hasQueueInfo = queuePosition !== undefined || queueLength !== undefined || Boolean(queueStatus);
  const canResume = Boolean(submitId && !hasVideo);

  const userStatus: JimengVideoUserStatus = hasVideo || status === "success"
    ? "completed"
    : input.timedOut === true || input.recoverable === true || status === "timed_out"
      ? "recoverable"
      : status === "queued" || (hasQueueInfo && queuePosition !== 0)
        ? "queued"
        : status === "generating"
          ? "generating"
          : submitId || status === "submitted"
            ? "submitted"
            : "not_generated";

  const label: Record<JimengVideoUserStatus, string> = {
    not_generated: "未生成",
    submitted: "已提交",
    queued: "排队中",
    generating: "生成中",
    completed: "已完成",
    recoverable: "可稍后恢复",
  };
  const idCopy = shortId ? `编号 ${shortId}` : "";
  const positionCopy = queuePosition !== undefined && queuePosition > 0
    ? `前面约 ${queuePosition} 个任务`
    : queuePosition === 0
      ? "已经轮到当前任务"
      : "";
  const longWaitCopy = `即梦排队常见约 ${JIMENG_CLI_EXPECTED_QUEUE_WAIT_MINUTES} 分钟，可以离开后恢复查询。`;
  const detail: Record<JimengVideoUserStatus, string> = {
    not_generated: "起始帧通过后再提交视频。",
    submitted: [idCopy || "视频任务已提交", "等待开始，可稍后恢复查询。"].filter(Boolean).join("，"),
    queued: [idCopy, positionCopy, longWaitCopy].filter(Boolean).join("，"),
    generating: [idCopy, "正在生成，可以稍后恢复查询。"].filter(Boolean).join("，"),
    completed: shortId ? `编号 ${shortId} 已完成，视频已回到预览。` : "视频已回到预览。",
    recoverable: [idCopy, "已保存进度，可以稍后恢复查询，不需要重新提交。"].filter(Boolean).join("，"),
  };

  return {
    status: userStatus,
    label: label[userStatus],
    detail: detail[userStatus],
    shortSubmitId: shortId,
    queuePosition,
    queueLength,
    queueStatus,
    canResume,
    hasSubmitId: Boolean(submitId),
    hasVideo,
    hasQueueInfo,
  };
}

export function buildJimengImage2VideoPlan(input: JimengImage2VideoPlanInput): JimengImage2VideoPlan {
  const durationSeconds = clampJimengDurationSeconds(input.durationSeconds, JIMENG_CLI_DEFAULT_DURATION_SECONDS);
  const modelVersion = input.modelVersion || JIMENG_CLI_DEFAULT_MODEL_VERSION;
  const videoResolution = normalizeJimengVideoResolution(input.videoResolution, modelVersion);
  const shortPollSeconds = positiveInteger(input.shortPollSeconds, JIMENG_CLI_DEFAULT_SHORT_POLL_SECONDS);
  const pollIntervalSeconds = positiveInteger(input.pollIntervalSeconds, JIMENG_CLI_DEFAULT_POLL_INTERVAL_SECONDS);
  const queueWaitSeconds = positiveInteger(input.queueWaitSeconds, JIMENG_CLI_DEFAULT_QUEUE_WAIT_SECONDS);
  const cliPath = input.cliPath || JIMENG_CLI_DEFAULT_BINARY;
  const firstFrameProtectionEnabled = input.firstFrameProtectionEnabled === true;
  const prompt = firstFrameProtectionEnabled
    ? buildJimengFirstFrameProtectedPrompt(input.prompt)
    : buildJimengFullFrameReferenceMotionPrompt(input.prompt);
  const args = [
    "image2video",
    "--image",
    input.imagePath,
    "--prompt",
    prompt,
    "--duration",
    String(durationSeconds),
    "--video_resolution",
    videoResolution,
    "--model_version",
    modelVersion,
    "--poll",
    String(shortPollSeconds),
  ];

  return {
    schemaVersion: jimengVideoCliSchemaVersion,
    providerId: "jimeng-video-cli",
    cliPath,
    command: "image2video",
    args,
    sourcePrompt: input.prompt,
    prompt,
    firstFrameProtection: {
      enabled: firstFrameProtectionEnabled,
      promptVersion: firstFrameProtectionEnabled ? JIMENG_FIRST_FRAME_PROTECTION_PROMPT_VERSION : null,
      protectedInitialSeconds: firstFrameProtectionEnabled ? JIMENG_FIRST_FRAME_PROTECTION_SECONDS : 0,
      rules: firstFrameProtectionEnabled ? JIMENG_FIRST_FRAME_PROTECTION_RULES : [],
    },
    imagePath: input.imagePath,
    outputDir: input.outputDir,
    durationSeconds,
    videoResolution,
    modelVersion,
    shortPollSeconds,
    pollIntervalSeconds,
    queueWaitSeconds,
    queuePolicy: {
      providerAsync: true,
      initialPollSeconds: shortPollSeconds,
      pollIntervalSeconds,
      maxWaitSeconds: queueWaitSeconds,
      expectedQueueWaitMinutes: JIMENG_CLI_EXPECTED_QUEUE_WAIT_MINUTES,
      recommendedResumeIntervalSeconds: JIMENG_CLI_DEFAULT_RESUME_INTERVAL_SECONDS,
      maxConcurrentVideoJobs: JIMENG_CLI_DEFAULT_MAX_CONCURRENT_VIDEO_JOBS,
      timeoutIsRecoverable: true,
      resumeWithSubmitId: true,
      userMessage: `即梦视频默认一次处理一个任务；排队常见约 ${JIMENG_CLI_EXPECTED_QUEUE_WAIT_MINUTES} 分钟，可以离开后恢复查询。`,
    },
  };
}

function collectJsonObjectsFromText(text: string): unknown[] {
  const objects: unknown[] = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || (!trimmed.startsWith("{") && !trimmed.startsWith("["))) continue;
    try {
      objects.push(JSON.parse(trimmed));
    } catch {
      // CLI output can contain progress prefixes; regex extraction below still covers submit_id.
    }
  }
  try {
    const whole = JSON.parse(text.trim());
    objects.push(whole);
  } catch {
    // Not a single JSON document.
  }
  return objects;
}

function visitJson(value: unknown, visitor: (key: string, leaf: unknown) => void, key = ""): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => visitJson(item, visitor, `${key}[${index}]`));
    return;
  }
  if (typeof value === "object" && value !== null) {
    for (const [childKey, childValue] of Object.entries(value)) {
      visitJson(childValue, visitor, childKey);
    }
    return;
  }
  visitor(key, value);
}

export function extractDreaminaTaskInfo(stdout = "", stderr = ""): DreaminaTaskInfo {
  const combined = `${stdout}\n${stderr}`;
  const jsonObjects = collectJsonObjectsFromText(combined);
  const videoUrls: string[] = [];
  const localMediaPaths: string[] = [];
  const statusCandidates: unknown[] = [];
  let submitId = "";
  let taskId = "";
  const queueInfo: DreaminaQueueInfo = {};

  for (const object of jsonObjects) {
    visitJson(object, (key, leaf) => {
      const lowerKey = key.toLowerCase();
      const value = String(leaf || "");
      if (!value) return;
      if (!submitId && /submit[_-]?id/.test(lowerKey)) submitId = value;
      if (!taskId && /task[_-]?id|gen[_-]?task[_-]?id/.test(lowerKey)) taskId = value;
      if (/status|gen_status|task_status/.test(lowerKey)) statusCandidates.push(value);
      if (/queue[_-]?(idx|index|position)$/.test(lowerKey)) queueInfo.position = safePositiveNumber(leaf);
      if (/queue[_-]?length$/.test(lowerKey)) queueInfo.length = safePositiveNumber(leaf);
      if (/queue[_-]?status$/.test(lowerKey)) {
        queueInfo.status = value;
        statusCandidates.push(value);
      }
      if (/https?:\/\/\S+\.(?:mp4|mov|webm)(?:\?\S*)?$/i.test(value)) videoUrls.push(value);
      if (/\.(?:mp4|mov|webm)$/i.test(value) && !/^https?:/i.test(value)) localMediaPaths.push(value);
    });
  }

  if (!submitId) {
    submitId =
      combined.match(/"submit[_-]?id"\s*:\s*"([^"]+)"/i)?.[1] ||
      combined.match(/\bsubmit[_-]?id\b\s*[:=]\s*([A-Za-z0-9._-]+)/i)?.[1] ||
      "";
  }
  if (!taskId) {
    taskId =
      combined.match(/"gen[_-]?task[_-]?id"\s*:\s*"([^"]+)"/i)?.[1] ||
      combined.match(/\btask[_-]?id\b\s*[:=]\s*([A-Za-z0-9._-]+)/i)?.[1] ||
      "";
  }

  const regexStatus =
    combined.match(/"gen[_-]?status"\s*:\s*"([^"]+)"/i)?.[1] ||
    combined.match(/"status"\s*:\s*"([^"]+)"/i)?.[1] ||
    combined.match(/\b(?:gen_status|status)\b\s*[:=]\s*([A-Za-z0-9._-]+)/i)?.[1] ||
    "";
  if (regexStatus) statusCandidates.push(regexStatus);
  if (queueInfo.position === undefined) {
    queueInfo.position = safePositiveNumber(
      combined.match(/"queue[_-]?(?:idx|index|position)"\s*:\s*(\d+)/i)?.[1] ||
      combined.match(/\bqueue[_-]?(?:idx|index|position)\b\s*[:=]\s*(\d+)/i)?.[1],
    );
  }
  if (queueInfo.length === undefined) {
    queueInfo.length = safePositiveNumber(
      combined.match(/"queue[_-]?length"\s*:\s*(\d+)/i)?.[1] ||
      combined.match(/\bqueue[_-]?length\b\s*[:=]\s*(\d+)/i)?.[1],
    );
  }
  if (!queueInfo.status) {
    queueInfo.status =
      combined.match(/"queue[_-]?status"\s*:\s*"([^"]+)"/i)?.[1] ||
      combined.match(/\bqueue[_-]?status\b\s*[:=]\s*([A-Za-z0-9._-]+)/i)?.[1] ||
      undefined;
    if (queueInfo.status) statusCandidates.push(queueInfo.status);
  }

  const status =
    statusCandidates.map(normalizeDreaminaStatus).find((candidate) => candidate !== "unknown") ||
    (submitId ? "submitted" : "unknown");

  const regexVideoPaths = combined.match(/\S+\.(?:mp4|mov|webm)(?:\?\S*)?/gi) || [];
  for (const candidate of regexVideoPaths) {
    if (/^https?:/i.test(candidate)) videoUrls.push(candidate);
    else localMediaPaths.push(candidate.replace(/^"|"$/g, ""));
  }

  return {
    submitId: submitId || undefined,
    taskId: taskId || undefined,
    status,
    queueInfo: queueInfo.position !== undefined || queueInfo.length !== undefined || queueInfo.status ? queueInfo : undefined,
    videoUrls: unique(videoUrls),
    localMediaPaths: unique(localMediaPaths),
    rawJsonCount: jsonObjects.length,
    notes: [
      submitId ? "submit_id parsed from Dreamina CLI output." : "submit_id not found in Dreamina CLI output.",
      status === "unknown" ? "Dreamina status could not be normalized." : `Dreamina status normalized as ${status}.`,
    ],
  };
}

export function jimengResumeCommand(input: { submitId: string; downloadDir: string; cliPath?: string }): string {
  const cliPath = input.cliPath || JIMENG_CLI_DEFAULT_BINARY;
  return `${cliPath} query_result --submit_id=${input.submitId} --download_dir=${input.downloadDir}`;
}
