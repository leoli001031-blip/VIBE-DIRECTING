import { Mic, Music, Wind } from "lucide-react";
import type { AudioPlan, AudioPlanningState } from "../../core/types";
import { toMediaSrc } from "../common/MediaFrame";
import { formatShotNumber } from "./MinimalStoryFlow";
import { type LocalQwen3TtsCloneResultPayload, useLocalQwen3TtsCloneAction } from "./useLocalQwen3TtsCloneAction";

export interface MinimalAudioPlanDialogueAudioCreated {
  shotId: string;
  text: string;
  plan: AudioPlan;
  payload: LocalQwen3TtsCloneResultPayload;
}

function cleanAudioCopy(value: string) {
  const copy = value.trim().replace(/^"|"$/g, "");
  if (/^No BGM for video provider/i.test(copy)) return "暂不生成配乐，可在后期导入或补写配乐计划";
  if (/^Ambience placeholder should support the story function:/i.test(copy)) {
    return copy.replace(/^Ambience placeholder should support the story function:\s*/i, "环境声围绕：");
  }
  if (/^No dialogue/i.test(copy)) return "暂无对话";
  return copy;
}

function hasSafeVoiceCloneReference(plan: AudioPlan, audioPlanning: AudioPlanningState) {
  if (!plan.voiceSourceId) return false;
  const source = audioPlanning.voiceSourceRegistry.sources.find((item) => item.id === plan.voiceSourceId);
  return source?.kind === "tts_voice" && source.status === "planned";
}

function spokenAudioPath(plan: AudioPlan, audioPlanning: AudioPlanningState) {
  return plan.outputPath
    || audioPlanning.previewMix.events.find((event) => (
      event.shotId === plan.shotId
      && (event.type === "dialogue_audio" || event.type === "narration_audio")
      && event.mediaPath
    ))?.mediaPath;
}

function audioReviewCopy(plan: AudioPlan) {
  if (!plan.outputPath) return "还没有可试听的配音；生成后会先进入复核，再用于导出。";
  if (plan.audioQaStatus === "PASS") return "已生成，可试听复核；需要替换时可重新生成。";
  if (plan.audioQaStatus === "FAIL") return "复核未通过，可重新生成替换。";
  return "已生成，等待试听复核；确认后再进入导出。";
}

export function MinimalAudioPlan({
  audioPlanning,
  shotId,
  confirmAction,
  onDialogueAudioCreated,
}: {
  audioPlanning: AudioPlanningState;
  shotId?: string;
  confirmAction?: (message: string) => boolean;
  onDialogueAudioCreated?: (input: MinimalAudioPlanDialogueAudioCreated) => void | Promise<void>;
}) {
  if (!shotId) {
    return (
      <div className="minimal-audio-plan empty">
        <small className="muted-copy">选择一个镜头以查看音频计划</small>
      </div>
    );
  }

  const plan = audioPlanning.shotPlans.find((p) => p.shotId === shotId);

  if (!plan) {
    return (
      <div className="minimal-audio-plan empty">
        <small className="muted-copy">{formatShotNumber(shotId)} 暂无音频计划</small>
      </div>
    );
  }

  return (
    <MinimalAudioPlanContent
      key={shotId}
      plan={plan}
      audioPlanning={audioPlanning}
      shotId={shotId}
      confirmAction={confirmAction}
      onDialogueAudioCreated={onDialogueAudioCreated}
    />
  );
}

function MinimalAudioPlanContent({
  plan,
  audioPlanning,
  shotId,
  confirmAction,
  onDialogueAudioCreated,
}: {
  plan: AudioPlan;
  audioPlanning: AudioPlanningState;
  shotId: string;
  confirmAction?: (message: string) => boolean;
  onDialogueAudioCreated?: (input: MinimalAudioPlanDialogueAudioCreated) => void | Promise<void>;
}) {
  const ttsText = [
    plan.narrationText,
    ...plan.dialogueLines,
  ].map(cleanAudioCopy).filter((copy) => copy && copy !== "暂无对话").join("\n");
  const audioPath = spokenAudioPath(plan, audioPlanning);
  const audioSrc = toMediaSrc(audioPath);
  const {
    voiceCloneAction,
    setVoiceCloneAuthorized,
    runLocalQwen3TtsClone,
  } = useLocalQwen3TtsCloneAction({
    shotId,
    text: ttsText,
    safeReferenceConfigured: hasSafeVoiceCloneReference(plan, audioPlanning),
    confirmAction,
    onCompleted: (payload) => onDialogueAudioCreated?.({
      shotId,
      text: ttsText,
      plan,
      payload,
    }),
  });

  return (
    <div className="minimal-audio-plan">
      <h4>音频计划</h4>
      <div className="audio-plan-fields">
        {plan.narrationText && (
          <div className="audio-plan-field">
            <Mic size={14} />
            <div>
              <strong>旁白</strong>
              <p className="muted-copy">{cleanAudioCopy(plan.narrationText)}</p>
            </div>
          </div>
        )}
        {plan.dialogueLines.length > 0 && (
          <div className="audio-plan-field">
            <Mic size={14} />
            <div>
              <strong>对话</strong>
              {plan.dialogueLines.map((line, i) => (
                <p key={i} className="muted-copy">{cleanAudioCopy(line)}</p>
              ))}
            </div>
          </div>
        )}
        {plan.bgmProfile && (
          <div className="audio-plan-field">
            <Music size={14} />
            <div>
              <strong>配乐</strong>
              <p className="muted-copy">
                {cleanAudioCopy(plan.bgmProfile)}
                {audioPlanning.postMixPolicy?.finalMixMusicAllowed ? "（最终导出使用）" : ""}
              </p>
            </div>
          </div>
        )}
        {plan.ambienceBrief && (
          <div className="audio-plan-field">
            <Wind size={14} />
            <div>
              <strong>环境音</strong>
              <p className="muted-copy">{cleanAudioCopy(plan.ambienceBrief)}</p>
            </div>
          </div>
        )}
        <div className="audio-plan-field muted">
          <small className="muted-copy">
            时长：{plan.targetDurationSeconds}s
            {plan.fadeInSeconds != null ? ` · 淡入 ${plan.fadeInSeconds}s` : ""}
            {plan.fadeOutSeconds != null ? ` · 淡出 ${plan.fadeOutSeconds}s` : ""}
            {plan.outputPath ? ` · 已生成 ${plan.outputPath}` : ""}
          </small>
        </div>
        <div className="audio-plan-field voice-clone-action">
          <Mic size={14} />
          <div>
            <strong>千问声音克隆</strong>
            <p className="muted-copy">{voiceCloneAction.label} · {voiceCloneAction.message}</p>
            {audioSrc && (
              <div className="audio-review-player">
                <audio controls preload="metadata" src={audioSrc} />
                <small className="muted-copy">{audioReviewCopy(plan)}</small>
              </div>
            )}
            <label className="muted-copy">
              <input
                type="checkbox"
                checked={voiceCloneAction.authorized}
                disabled={!ttsText || voiceCloneAction.status === "running" || voiceCloneAction.status === "needs_reference"}
                onChange={(event) => setVoiceCloneAuthorized(event.currentTarget.checked)}
              />
              确认使用已授权的声音参考生成克隆配音
            </label>
            <button
              type="button"
              onClick={() => { void runLocalQwen3TtsClone(); }}
              disabled={voiceCloneAction.disabled}
            >
              {plan.outputPath ? "重新生成克隆配音" : "生成克隆配音"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
