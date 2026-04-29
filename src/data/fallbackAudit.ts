import { defaultProviderPolicy } from "../core/providerPolicy";
import type { ProjectAudit } from "../core/types";

export const fallbackAudit: ProjectAudit = {
  importedAt: new Date().toISOString(),
  projectTitle: "最后一班星图",
  projectRoot: "/Users/lichenhao/Desktop/Vibe Director/runtime-tests/full_generation_10shot_two_act_20260429",
  sourceTask: "/Users/lichenhao/Desktop/Vibe Director/双幕十镜头完整生成测试任务_20260429.md",
  state: "blocked_at_provider_policy",
  metrics: {
    expectedAssets: 16,
    existingAssets: 16,
    expectedKeyframes: 20,
    existingKeyframes: 20,
    expectedVideos: 10,
    existingVideos: 0,
    providerEvents: 0,
    dreaminaImageEvents: 0,
    forbiddenFallbackEvents: 0,
  },
  providerPolicy: defaultProviderPolicy,
  workflow: [],
  assets: [],
  shots: [],
  jobs: [],
  issues: [
    {
      id: "fallback-data",
      severity: "warning",
      type: "qa_gap",
      title: "Runtime audit data not imported",
      detail: "Run npm run import:test to generate public/runtime-audit.json.",
      recommendation: "Import the ten-shot runtime test before using this dashboard for decisions.",
    },
  ],
  contactSheets: {},
};
