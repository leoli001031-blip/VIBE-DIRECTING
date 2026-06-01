import { useCallback, useMemo, useState } from "react";
import { fetchRuntimeJson, isRecord, numberOrUndefined, stringOrUndefined } from "../../core/runtimeApiClient";

export const LOCAL_QWEN3_TTS_CLONE_ENDPOINT = "/api/runtime/audio/local-qwen3-tts-clone/generate";
export const LOCAL_QWEN3_TTS_CLONE_CONFIRMATION_TOKEN = "submit-local-qwen3-tts-clone";

export type LocalQwen3TtsCloneActionStatus = "needs_reference" | "needs_authorization" | "ready" | "running" | "completed" | "failed";

export type LocalQwen3TtsCloneActionView = {
  status: LocalQwen3TtsCloneActionStatus;
  label: string;
  message: string;
  authorized: boolean;
  disabled: boolean;
};

export interface LocalQwen3TtsCloneResultPayload {
  ok?: boolean;
  status?: string;
  outputRelativePath?: string;
  outputUrl?: string;
  receiptRelativePath?: string;
  receiptUrl?: string;
  outputSha256?: string;
  outputSizeBytes?: number;
  userMessage?: string;
  raw: unknown;
}

type UseLocalQwen3TtsCloneActionInput = {
  shotId: string;
  text: string;
  language?: string;
  referenceAudioPath?: string;
  referenceText?: string;
  safeReferenceConfigured?: boolean;
  xVectorOnlyMode?: boolean;
  confirmAction?: (message: string) => boolean;
  onCompleted?: (payload: LocalQwen3TtsCloneResultPayload) => void | Promise<void>;
};

function defaultConfirmAction(message: string) {
  return typeof window !== "undefined" ? window.confirm(message) : false;
}

function makePermissionReceiptId(shotId: string) {
  const safeShotId = shotId.replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/^_+|_+$/g, "") || "shot";
  return `voice_clone_permission_${safeShotId}_${Date.now()}`;
}

function completedMessage(payload: unknown) {
  if (!isRecord(payload)) return "本镜头克隆配音已生成。";
  return stringOrUndefined(payload.userMessage) || "本镜头克隆配音已生成。";
}

function normalizePayload(payload: unknown): LocalQwen3TtsCloneResultPayload {
  if (!isRecord(payload)) return { raw: payload };
  return {
    ok: typeof payload.ok === "boolean" ? payload.ok : undefined,
    status: stringOrUndefined(payload.status),
    outputRelativePath: stringOrUndefined(payload.outputRelativePath),
    outputUrl: stringOrUndefined(payload.outputUrl),
    receiptRelativePath: stringOrUndefined(payload.receiptRelativePath),
    receiptUrl: stringOrUndefined(payload.receiptUrl),
    outputSha256: stringOrUndefined(payload.outputSha256),
    outputSizeBytes: numberOrUndefined(payload.outputSizeBytes),
    userMessage: stringOrUndefined(payload.userMessage),
    raw: payload,
  };
}

export async function generateLocalQwen3TtsClone(input: {
  shotId: string;
  text: string;
  language?: string;
  referenceAudioPath?: string;
  referenceText?: string;
  xVectorOnlyMode?: boolean;
  permissionReceiptId: string;
}): Promise<LocalQwen3TtsCloneResultPayload> {
  const payload = await fetchRuntimeJson(LOCAL_QWEN3_TTS_CLONE_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      shotId: input.shotId,
      text: input.text,
      language: input.language || "Auto",
      referenceAudioPath: input.referenceAudioPath,
      referenceText: input.referenceText,
      xVectorOnlyMode: input.xVectorOnlyMode ?? true,
      permissionReceiptId: input.permissionReceiptId,
      confirmationToken: LOCAL_QWEN3_TTS_CLONE_CONFIRMATION_TOKEN,
    }),
  });
  return normalizePayload(payload);
}

export function useLocalQwen3TtsCloneAction({
  shotId,
  text,
  language = "Auto",
  referenceAudioPath,
  referenceText,
  safeReferenceConfigured = false,
  xVectorOnlyMode = true,
  confirmAction = defaultConfirmAction,
  onCompleted,
}: UseLocalQwen3TtsCloneActionInput) {
  const [authorized, setAuthorized] = useState(false);
  const [actionState, setActionState] = useState<{
    status: LocalQwen3TtsCloneActionStatus;
    message?: string;
  }>({ status: "needs_authorization" });

  const cleanText = text.trim();
  const hasText = cleanText.length > 0;
  const cleanReferenceAudioPath = referenceAudioPath?.trim();
  const hasReferenceAudio = Boolean(cleanReferenceAudioPath || safeReferenceConfigured);

  const runLocalQwen3TtsClone = useCallback(async () => {
    if (!hasText) {
      setActionState({ status: "failed", message: "这个镜头还没有可生成的旁白或对话。" });
      return;
    }
    if (!hasReferenceAudio) {
      setActionState({ status: "needs_reference", message: "请先选择或配置一段已授权的声音参考，再生成克隆配音。" });
      return;
    }
    if (!authorized) {
      setActionState({ status: "needs_authorization", message: "请先确认使用已授权的声音参考。" });
      return;
    }
    if (!confirmAction("要为这个镜头生成声音克隆配音吗？")) {
      setActionState({ status: "needs_authorization", message: "已取消，本次没有生成配音。" });
      return;
    }

    setActionState({ status: "running", message: "正在生成本镜头克隆配音。" });
    try {
      const payload = await generateLocalQwen3TtsClone({
        shotId,
        text: cleanText,
        language,
        referenceAudioPath: cleanReferenceAudioPath,
        referenceText,
        xVectorOnlyMode,
        permissionReceiptId: makePermissionReceiptId(shotId),
      });
      setActionState({ status: "completed", message: completedMessage(payload) });
      await onCompleted?.(payload);
    } catch {
      setActionState({ status: "failed", message: "克隆配音没有生成成功，请检查声音参考设置后重试。" });
    }
  }, [authorized, cleanReferenceAudioPath, cleanText, confirmAction, hasReferenceAudio, hasText, language, onCompleted, referenceText, shotId, xVectorOnlyMode]);

  const view = useMemo<LocalQwen3TtsCloneActionView>(() => {
    const status = !hasReferenceAudio
      ? "needs_reference"
      : actionState.status === "needs_authorization" && authorized && hasText
      ? "ready"
      : actionState.status;
    const labels: Record<LocalQwen3TtsCloneActionStatus, string> = {
      needs_reference: "待设置",
      needs_authorization: "待授权",
      ready: "可生成",
      running: "生成中",
      completed: "完成",
      failed: "失败",
    };
    const fallbackMessages: Record<LocalQwen3TtsCloneActionStatus, string> = {
      needs_reference: hasText ? "请先选择或配置一段已授权的声音参考。" : "这个镜头还没有可生成的旁白或对话。",
      needs_authorization: hasText ? "确认后才会生成克隆配音。" : "这个镜头还没有可生成的旁白或对话。",
      ready: "已确认，可手动生成本镜头克隆配音。",
      running: "正在生成本镜头克隆配音。",
      completed: "本镜头克隆配音已生成。",
      failed: "克隆配音没有生成成功，请检查声音参考设置后重试。",
    };
    return {
      status,
      label: labels[status],
      message: actionState.message || fallbackMessages[status],
      authorized,
      disabled: status === "running" || !hasText || !hasReferenceAudio || !authorized,
    };
  }, [actionState.message, actionState.status, authorized, hasReferenceAudio, hasText]);

  return {
    voiceCloneAction: view,
    setVoiceCloneAuthorized: setAuthorized,
    runLocalQwen3TtsClone,
  };
}
