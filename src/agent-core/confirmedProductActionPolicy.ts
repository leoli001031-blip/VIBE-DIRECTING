import type { DirectorAgentActionEnvelope } from "../core/directorAgentAction";
import {
  buildDirectorAgentToolHandoff,
  type DirectorAgentToolAvailability,
  type DirectorAgentToolHandoff,
} from "../core/directorAgentToolHandoff";
import type { VibeAgentReferenceAssetType } from "./confirmedProductActionRunner";

export interface VibeAgentProductToolAvailabilityInput {
  localProjectReady: boolean;
  webSearchReady: boolean;
  referenceGenerationCallbackReady: boolean;
  referenceGenerationKeyConfigured?: boolean;
  referenceGenerationDisabled?: boolean;
  referenceGenerationBusy?: boolean;
  videoSubmitCallbackReady: boolean;
  videoSubmitReady?: boolean;
  videoSubmitKeyConfigured?: boolean;
  videoAlreadySent?: boolean;
  videoCanResume?: boolean;
  exportCallbackReady: boolean;
}

export function buildVibeAgentProductToolAvailability(
  input: VibeAgentProductToolAvailabilityInput,
): DirectorAgentToolAvailability {
  const referenceGenerationReady = Boolean(
    input.localProjectReady
    && input.referenceGenerationCallbackReady
    && (
      input.referenceGenerationKeyConfigured === undefined
      || (input.referenceGenerationKeyConfigured && !input.referenceGenerationDisabled && !input.referenceGenerationBusy)
    )
  );
  return {
    projectReady: input.localProjectReady,
    webSearchReady: input.webSearchReady,
    referenceGenerationReady,
    videoSubmitReady: Boolean(
      input.localProjectReady
      && input.videoSubmitCallbackReady
      && input.videoSubmitReady
      && input.videoSubmitKeyConfigured
      && (!input.videoAlreadySent || input.videoCanResume)
    ),
    exportReady: Boolean(input.localProjectReady && input.exportCallbackReady),
  };
}

export function buildVibeAgentToolHandoff(input: {
  action: DirectorAgentActionEnvelope | undefined;
  availability: DirectorAgentToolAvailability;
  userConfirmed: boolean;
}) {
  if (!input.action) return undefined;
  return buildDirectorAgentToolHandoff({
    action: input.action,
    userConfirmed: input.userConfirmed,
    availability: input.availability,
  });
}

export function buildConfirmedVibeAgentToolHandoff(input: {
  action: DirectorAgentActionEnvelope | undefined;
  availability: DirectorAgentToolAvailability;
}) {
  return buildVibeAgentToolHandoff({
    ...input,
    userConfirmed: true,
  });
}

export function buildVibeAgentConfirmedProductPolicy(input: {
  availability: DirectorAgentToolAvailability;
}) {
  return {
    buildHandoff: (action: DirectorAgentActionEnvelope) => buildConfirmedVibeAgentToolHandoff({
      action,
      availability: input.availability,
    }),
    bindingIssue: vibeAgentToolHandoffBindingIssue,
    blockedStatusLabel: vibeAgentToolBlockedStatus,
    resultLabel: vibeAgentToolResultLabel,
    referenceAssetTypesForAction: vibeAgentReferenceAssetTypesForAction,
  };
}

export function vibeAgentToolOnlyNeedsConfirmation(handoff: DirectorAgentToolHandoff) {
  return handoff.status === "blocked"
    && handoff.blockers.length === 1
    && handoff.blockers[0] === "user_confirmation_required";
}

export function vibeAgentToolPlannedResultLabel(handler: DirectorAgentToolHandoff["handler"]) {
  if (handler === "project_vibe_patch") return "确认后写入项目";
	if (handler === "web_search") return "确认后资料进参考";
	if (handler === "image2_reference_generation") return "确认后图片进复核";
	if (handler === "seedance_video_submit") return "确认后排队回预览";
	if (handler === "project_export") return "确认后导出素材包";
  return "确认后执行";
}

export function vibeAgentToolResultLabel(handoff: DirectorAgentToolHandoff) {
  if (handoff.status === "handled_by_project_write") return "不需要额外动作";
  if (vibeAgentToolOnlyNeedsConfirmation(handoff)) return vibeAgentToolPlannedResultLabel(handoff.handler);
  if (handoff.status === "ready") {
	    if (handoff.handler === "web_search") return "资料先进入参考";
	    if (handoff.handler === "image2_reference_generation") return "图片先进入复核";
	    if (handoff.handler === "seedance_video_submit") return "排队后回到预览";
	    if (handoff.handler === "project_export") return "导出素材包";
  }
  return handoff.userFacingMessage;
}

export function vibeAgentToolBlockedStatus(handoff: DirectorAgentToolHandoff) {
  return `${handoff.userFacingMessage}。项目会保留，调整后可以重试。`;
}

export function vibeAgentToolHandoffBindingIssue(
  action: DirectorAgentActionEnvelope,
  handoff: DirectorAgentToolHandoff,
) {
  const taskEnvelope = handoff.invocation?.taskEnvelope;
  const changedMessage = "这次动作已经变化，请重新发送一次。";
  if (handoff.actionId !== action.actionId) return changedMessage;
  if (handoff.handler !== action.toolPlan.toolName) return changedMessage;
  if (handoff.expectedReceipt !== action.toolPlan.expectedReceipt) return changedMessage;
  if (handoff.status !== "ready") return undefined;
  if (handoff.invocation?.confirmation.actionId !== action.actionId) return changedMessage;
  if (handoff.invocation?.confirmation.expectedReceipt !== action.toolPlan.expectedReceipt) return changedMessage;
  if (!taskEnvelope) return undefined;
  if (taskEnvelope.actionId !== action.actionId) return changedMessage;
  if (taskEnvelope.handoffId !== handoff.handoffId) return changedMessage;
  if (taskEnvelope.handler !== action.toolPlan.toolName) return changedMessage;
  if (taskEnvelope.expectedReceipt !== action.toolPlan.expectedReceipt) return changedMessage;
  if (taskEnvelope.providerSubmitAllowed !== action.toolPlan.providerSubmitAllowed) return changedMessage;
  return undefined;
}

export function vibeAgentReferenceAssetTypesForAction(
  action: DirectorAgentActionEnvelope | undefined,
  userIntent: string,
): VibeAgentReferenceAssetType[] | undefined {
  const text = [
    userIntent,
    action?.sourceContext.userIntent,
    action?.summary,
    action?.userFacingMessage,
    ...(action?.blockers || []),
    ...(action?.proposedChanges || []).flatMap((change) => [change.to, change.reason]),
  ].filter(Boolean).join(" ");
  if (!text.trim()) return undefined;
  if (/场景|环境|地点|空间|背景|天气|光线|街道|站台|车站|室内|室外/.test(text)) return ["scene"];
  if (/角色|人物|身份|脸|发型|服装|少女|男主|女主|主角/.test(text)) return ["character"];
  if (/道具|物体|车辆|整辆车|票|书|手机|手持|物件/.test(text)) return ["prop"];
  if (/故事板|分镜|(?:^|[^a-z0-9_])storyboard(?:$|[^a-z0-9_])|(?:^|[^a-z0-9_])panel(?:$|[^a-z0-9_])/i.test(text)) return ["storyboard"];
  return undefined;
}
