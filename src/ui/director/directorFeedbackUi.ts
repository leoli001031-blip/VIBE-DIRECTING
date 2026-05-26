import type { DirectorFeedbackRecompileResult } from "../../core/directorFeedbackRecompile";

export function directorFeedbackCanConfirm(recompile?: DirectorFeedbackRecompileResult): recompile is DirectorFeedbackRecompileResult {
  return recompile?.status === "ready_for_confirmation";
}

export function directorFeedbackNeedsConcreteDirection(recompile?: DirectorFeedbackRecompileResult) {
  return recompile?.status === "blocked_prompt_bypass";
}

export function directorFeedbackGenerationLabel(recompile: DirectorFeedbackRecompileResult) {
  return recompile.liveSubmitAllowed ? "需再次确认" : "不会启动生成";
}
