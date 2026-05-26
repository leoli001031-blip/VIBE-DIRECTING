import { defaultProviderPolicy } from "../core/providerPolicy";
import type { ProjectAudit } from "../core/types";

export const fallbackAudit: ProjectAudit = {
  importedAt: new Date().toISOString(),
  projectTitle: "新视频项目",
  projectRoot: "",
  sourceTask: "",
  state: "empty_project",
  metrics: {
    expectedAssets: 0,
    existingAssets: 0,
    expectedKeyframes: 0,
    existingKeyframes: 0,
    expectedVideos: 0,
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
      title: "还没有打开项目",
      detail: "先从底部输入框写脚本，或打开一个本地项目文件夹。",
      recommendation: "创建或打开项目后，这里会恢复 Project.vibe 的真实内容。",
    },
  ],
  contactSheets: {},
};
