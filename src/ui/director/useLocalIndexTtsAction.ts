import { useCallback, useMemo, useState } from "react";
import { fetchRuntimeJson, isRecord, stringOrUndefined } from "../../core/runtimeApiClient";

export const LOCAL_INDEX_TTS_ENDPOINT = "/api/runtime/audio/local-index-tts/generate";
export const LOCAL_INDEX_TTS_CONFIRMATION_TOKEN = "submit-local-index-tts";

export type LocalIndexTtsActionStatus = "needs_authorization" | "ready" | "running" | "completed" | "failed";

export type LocalIndexTtsActionView = {
  status: LocalIndexTtsActionStatus;
  label: string;
  message: string;
  authorized: boolean;
  disabled: boolean;
};

type UseLocalIndexTtsActionInput = {
  shotId: string;
  text: string;
  confirmAction?: (message: string) => boolean;
};

function defaultConfirmAction(message: string) {
  return typeof window !== "undefined" ? window.confirm(message) : false;
}

function makePermissionReceiptId(shotId: string) {
  const safeShotId = shotId.replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/^_+|_+$/g, "") || "shot";
  return `local_tts_permission_${safeShotId}_${Date.now()}`;
}

function completedMessage(payload: unknown) {
  if (!isRecord(payload)) return "本镜头配音已生成。";
  return stringOrUndefined(payload.userMessage) || "本镜头配音已生成。";
}

export async function generateLocalIndexTts(input: {
  shotId: string;
  text: string;
  permissionReceiptId: string;
}) {
  return fetchRuntimeJson(LOCAL_INDEX_TTS_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      shotId: input.shotId,
      text: input.text,
      permissionReceiptId: input.permissionReceiptId,
      confirmationToken: LOCAL_INDEX_TTS_CONFIRMATION_TOKEN,
    }),
  });
}

export function useLocalIndexTtsAction({
  shotId,
  text,
  confirmAction = defaultConfirmAction,
}: UseLocalIndexTtsActionInput) {
  const [authorized, setAuthorized] = useState(false);
  const [actionState, setActionState] = useState<{
    status: LocalIndexTtsActionStatus;
    message?: string;
  }>({ status: "needs_authorization" });

  const cleanText = text.trim();
  const hasText = cleanText.length > 0;

  const runLocalIndexTts = useCallback(async () => {
    if (!hasText) {
      setActionState({ status: "failed", message: "这个镜头还没有可生成的旁白或对话。" });
      return;
    }
    if (!authorized) {
      setActionState({ status: "needs_authorization", message: "请先确认使用已设置的本机声音参考。" });
      return;
    }
    if (!confirmAction("要为这个镜头生成本机配音吗？")) {
      setActionState({ status: "needs_authorization", message: "已取消，本次没有生成配音。" });
      return;
    }

    setActionState({ status: "running", message: "正在生成本镜头配音。" });
    try {
      const payload = await generateLocalIndexTts({
        shotId,
        text: cleanText,
        permissionReceiptId: makePermissionReceiptId(shotId),
      });
      setActionState({ status: "completed", message: completedMessage(payload) });
    } catch {
      setActionState({ status: "failed", message: "配音没有生成成功，请检查本机配音设置后重试。" });
    }
  }, [authorized, cleanText, confirmAction, hasText, shotId]);

  const view = useMemo<LocalIndexTtsActionView>(() => {
    const status = actionState.status === "needs_authorization" && authorized && hasText
      ? "ready"
      : actionState.status;
    const labels: Record<LocalIndexTtsActionStatus, string> = {
      needs_authorization: "待授权",
      ready: "可生成",
      running: "生成中",
      completed: "完成",
      failed: "失败",
    };
    const fallbackMessages: Record<LocalIndexTtsActionStatus, string> = {
      needs_authorization: hasText ? "确认后才会生成配音。" : "这个镜头还没有可生成的旁白或对话。",
      ready: "已确认，可手动生成本镜头配音。",
      running: "正在生成本镜头配音。",
      completed: "本镜头配音已生成。",
      failed: "配音没有生成成功，请检查本机配音设置后重试。",
    };
    return {
      status,
      label: labels[status],
      message: actionState.message || fallbackMessages[status],
      authorized,
      disabled: status === "running" || !hasText || !authorized,
    };
  }, [actionState.message, actionState.status, authorized, hasText]);

  return {
    localTtsAction: view,
    setLocalTtsAuthorized: setAuthorized,
    runLocalIndexTts,
  };
}
