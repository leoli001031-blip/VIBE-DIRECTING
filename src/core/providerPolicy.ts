import type { AuditIssue, GenerationJob, ProviderPolicy, ProviderRule } from "./types";

export const defaultProviderPolicy: ProviderPolicy = {
  strictImageProvider: "image2_only",
  rules: [
    {
      slot: "image.generate",
      activeProvider: "openai-image2-codex-cli",
      executionState: "active",
      allowedProviders: ["openai-image2-codex-cli", "openai-image2-api"],
      forbiddenProviders: ["dreamina", "jimeng", "seedream"],
      allowedModes: ["text2image"],
      forbiddenFallbacks: ["image2image_to_text2image"],
      concurrency: "adapter",
    },
    {
      slot: "image.edit",
      activeProvider: "openai-image2-api",
      executionState: "active",
      allowedProviders: ["openai-image2-codex-cli", "openai-image2-api"],
      forbiddenProviders: ["dreamina", "jimeng", "seedream"],
      allowedModes: ["image2image"],
      forbiddenFallbacks: ["image2image_to_text2image", "reference_edit_to_text2image"],
      concurrency: "adapter",
    },
    {
      slot: "image.reference_asset",
      activeProvider: "openai-image2-api",
      executionState: "active",
      allowedProviders: ["openai-image2-codex-cli", "openai-image2-api"],
      forbiddenProviders: ["dreamina", "jimeng", "seedream"],
      allowedModes: ["text2image", "image2image"],
      forbiddenFallbacks: ["image2image_to_text2image"],
      concurrency: "adapter",
    },
    {
      slot: "video.i2v",
      activeProvider: "seedance2-provider",
      executionState: "parked",
      allowedProviders: ["seedance2-provider", "dreamina-seedance2"],
      forbiddenProviders: [],
      allowedModes: ["frames2video"],
      forbiddenFallbacks: ["frames2video_to_text2video"],
      concurrency: 1,
    },
    {
      slot: "video.t2v.experimental",
      activeProvider: "none",
      executionState: "parked",
      allowedProviders: [],
      forbiddenProviders: [],
      allowedModes: ["text2video"],
      forbiddenFallbacks: [],
      concurrency: 0,
    },
    {
      slot: "video.extend",
      activeProvider: "none",
      executionState: "planned",
      allowedProviders: [],
      forbiddenProviders: [],
      allowedModes: ["video2video"],
      forbiddenFallbacks: [],
      concurrency: 0,
    },
    {
      slot: "video.edit",
      activeProvider: "none",
      executionState: "planned",
      allowedProviders: [],
      forbiddenProviders: [],
      allowedModes: ["video2video"],
      forbiddenFallbacks: [],
      concurrency: 0,
    },
    {
      slot: "audio.tts",
      activeProvider: "none",
      executionState: "planned",
      allowedProviders: [],
      forbiddenProviders: [],
      allowedModes: ["tts"],
      forbiddenFallbacks: [],
      concurrency: 0,
    },
    {
      slot: "audio.music",
      activeProvider: "none",
      executionState: "planned",
      allowedProviders: [],
      forbiddenProviders: [],
      allowedModes: ["music"],
      forbiddenFallbacks: [],
      concurrency: 0,
    },
    {
      slot: "local.postprocess",
      activeProvider: "ffmpeg-local",
      executionState: "available",
      allowedProviders: ["ffmpeg-local", "image-magick-local", "system-image-tools"],
      forbiddenProviders: ["opencv-semantic-repair"],
      allowedModes: ["postprocess"],
      forbiddenFallbacks: ["semantic_repair", "identity_repair", "scene_repair"],
      concurrency: "adapter",
    },
    {
      slot: "local.workflow",
      activeProvider: "none",
      executionState: "planned",
      allowedProviders: [],
      forbiddenProviders: [],
      allowedModes: ["not_applicable"],
      forbiddenFallbacks: [],
      concurrency: 0,
    },
  ],
};

function makeProviderIssue(
  job: GenerationJob,
  code: string,
  title: string,
  detail: string,
  recommendation: string,
): AuditIssue {
  return {
    id: `${code}-${job.id}`,
    severity: "blocker",
    type: "provider_policy",
    title,
    detail,
    target: job.id,
    recommendation,
  };
}

function isLiveStatus(job: GenerationJob) {
  return ["submitted", "querying", "success"].includes(job.status);
}

export function getProviderRule(slot: GenerationJob["slot"]): ProviderRule | undefined {
  return defaultProviderPolicy.rules.find((item) => item.slot === slot);
}

export function validateProviderJob(job: GenerationJob): AuditIssue[] {
  const rule = getProviderRule(job.slot);
  if (!rule) {
    return [
      makeProviderIssue(
        job,
        "unknown-slot",
        "Unknown provider slot",
        `${job.slot} is not registered in the Provider Registry.`,
        "Add a provider capability entry and validator before this task can run.",
      ),
    ];
  }

  const issues: AuditIssue[] = [];

  if (rule.executionState === "parked" || rule.executionState === "planned" || rule.executionState === "unavailable") {
    if (isLiveStatus(job)) {
      issues.push(
        makeProviderIssue(
          job,
          "parked-provider-live-task",
          "Parked provider task cannot be live",
          `${job.id} is ${job.status}, but ${job.slot} is ${rule.executionState}.`,
          "Keep this task as an envelope or queue placeholder until the provider is explicitly enabled.",
        ),
      );
    }
    return issues;
  }

  if (!job.providerId || job.providerId === "unknown") {
    issues.push(
      makeProviderIssue(
        job,
        "unknown-provider",
        "Unknown provider is blocked",
        `${job.id} has providerId=${job.providerId || "empty"} for active slot ${job.slot}.`,
        "Resolve the provider through ProviderTaskValidator before submission.",
      ),
    );
  }

  if (rule.allowedProviders.length && !rule.allowedProviders.includes(job.providerId)) {
    issues.push(
      makeProviderIssue(
        job,
        "provider-not-allowed",
        "Provider is not in allowlist",
        `${job.id} used ${job.providerId}; allowed providers for ${job.slot}: ${rule.allowedProviders.join(", ")}.`,
        "Use the active provider or explicitly onboard this provider before using it.",
      ),
    );
  }

  if (rule.forbiddenProviders.includes(job.providerId)) {
    issues.push(
      makeProviderIssue(
        job,
        "provider-forbidden",
        "Provider policy violation",
        `${job.id} used ${job.providerId}, but ${job.slot} is locked to ${rule.activeProvider}.`,
        "Block formal use. Rebuild this task through the active adapter or mark it as an external experiment.",
      ),
    );
  }

  if (!rule.allowedModes.includes(job.requiredMode)) {
    issues.push({
      id: `mode-${job.id}`,
      severity: "blocker",
      type: "state_gate",
      title: "Unsupported provider mode",
      detail: `${job.id} used ${job.requiredMode}; ${job.slot} only allows ${rule.allowedModes.join(", ")}.`,
      target: job.id,
      recommendation: "Recompile the task through ProviderTaskValidator before execution.",
    });
  }

  if (
    job.issues.some((item) => item.includes("fallback_text")) ||
    rule.forbiddenFallbacks.some((fallback) => job.issues.includes(fallback))
  ) {
    issues.push({
      id: `fallback-${job.id}`,
      severity: "blocker",
      type: "fallback",
      title: "Forbidden image fallback",
      detail: `${job.id} has evidence of image-to-image falling back to text-to-image.`,
      target: job.id,
      recommendation: "Reject the candidate chain. Required image-to-image tasks may only retry image-to-image or stop blocked.",
    });
  }

  return issues;
}
