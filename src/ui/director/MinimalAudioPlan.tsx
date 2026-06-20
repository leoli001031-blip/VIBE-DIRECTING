import { Mic, ShieldCheck, Wind } from "lucide-react";
import type { AudioPlan, AudioPlanningState } from "../../core/types";
import { toMediaSrc } from "../common/MediaFrame";
import { formatShotNumber } from "./MinimalStoryFlow";

export interface MinimalAudioPlanDialogueAudioCreated {
  shotId: string;
  text: string;
  plan: AudioPlan;
  payload: {
    outputRelativePath?: string;
    receiptRelativePath?: string;
    outputSha256?: string;
    outputSizeBytes?: number;
  };
}

function cleanAudioCopy(value: string) {
  const copy = value.trim().replace(/^"|"$/g, "");
  if (/^No BGM for video provider/i.test(copy)) return "视频模型不生成配乐；如需配乐，后期单独处理。";
  if (/^Ambience placeholder should support the story function:/i.test(copy)) {
    return copy.replace(/^Ambience placeholder should support the story function:\s*/i, "环境声围绕：");
  }
  if (/^No dialogue/i.test(copy)) return "暂无对话";
  return copy;
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
  if (!plan.outputPath) return "还没有对白音频。";
  if (plan.audioQaStatus === "PASS") return "已生成，可试听确认。";
  if (plan.audioQaStatus === "FAIL") return "确认未通过，可替换声音参考后重新发送视频。";
  return "已生成，等待试听确认。";
}

function voiceReferenceCopy(plan: AudioPlan, audioPlanning: AudioPlanningState) {
  const source = plan.voiceSourceId
    ? audioPlanning.voiceSourceRegistry.sources.find((item) => item.id === plan.voiceSourceId)
    : undefined;
  if (!source) return "还没有绑定声音参考；需要锁角色声线时，把授权音源拖到 AI 导演输入框。";
  return `已绑定 ${source.label || source.id}，发送视频时只作为声线、语气和说话质感参考。`;
}

export function MinimalAudioPlan({
  audioPlanning,
  shotId,
}: {
  audioPlanning: AudioPlanningState;
  shotId?: string;
  confirmAction?: (message: string) => boolean;
  onDialogueAudioCreated?: (input: MinimalAudioPlanDialogueAudioCreated) => void | Promise<void>;
}) {
  if (!shotId) {
    return (
      <div className="minimal-audio-plan empty">
        <small className="muted-copy">选择一个镜头以查看声音参考</small>
      </div>
    );
  }

  const plan = audioPlanning.shotPlans.find((p) => p.shotId === shotId);

  if (!plan) {
    return (
      <div className="minimal-audio-plan empty">
        <small className="muted-copy">{formatShotNumber(shotId)} 暂无声音参考</small>
      </div>
    );
  }

  return (
    <MinimalAudioPlanContent
      key={shotId}
      plan={plan}
      audioPlanning={audioPlanning}
    />
  );
}

function MinimalAudioPlanContent({
  plan,
  audioPlanning,
}: {
  plan: AudioPlan;
  audioPlanning: AudioPlanningState;
}) {
  const audioPath = spokenAudioPath(plan, audioPlanning);
  const audioSrc = toMediaSrc(audioPath);

  return (
    <div className="minimal-audio-plan">
      <h4>声音参考</h4>
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
            <ShieldCheck size={14} />
            <div>
              <strong>声音边界</strong>
              <p className="muted-copy">
                {cleanAudioCopy(plan.bgmProfile)}
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
        <div className="audio-plan-field voice-reference-action">
          <Mic size={14} />
          <div>
            <strong>声音参考</strong>
            <p className="muted-copy">
              {voiceReferenceCopy(plan, audioPlanning)}
            </p>
            <p className="muted-copy">
              本版不做本地配音；声音参考只在生成视频时锁定角色声线、语气和说话质感，视频本身不加配乐。
            </p>
            {audioSrc && (
              <div className="audio-review-player">
                <audio controls preload="metadata" src={audioSrc} />
                <small className="muted-copy">{audioReviewCopy(plan)}</small>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
