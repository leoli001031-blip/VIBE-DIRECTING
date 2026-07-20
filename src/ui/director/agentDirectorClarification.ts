import type { VibeAgentTimelineEntry } from "../../agent-core/types";
import {
  agentDirectorReviewIdentityFromUnknown,
  validateAgentDirectorReviewIdentity,
  type AgentDirectorReviewIdentity,
} from "../../core/agentDirectorReviewDecision";

const clarificationDetailKind = "agent_director_clarification";
const clarificationResolutionDetailKind = "agent_director_clarification_resolution";

export type AgentDirectorClarificationOptionId =
  | "delay_as_turn"
  | "keep_as_foreshadow"
  | "advance_as_turn"
  | "hold_and_strengthen"
  | "extend_action"
  | "hold_and_soften"
  | "apply_as_stated"
  | "strengthen_direction";

export interface AgentDirectorClarificationOption {
  id: AgentDirectorClarificationOptionId;
  label: string;
  detail: string;
  resolvedIntent: string;
}

export interface AgentDirectorClarificationTurn {
  id: string;
  sourceIntent: string;
  targetLabel: string;
  selectedShotId: string;
  question: string;
  options: AgentDirectorClarificationOption[];
  boundary: string;
  reviewRevision?: {
    intentId: string;
    identity: AgentDirectorReviewIdentity;
  };
}

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function timingConcern(value: string): "early" | "late" | "fast" | undefined {
  if (/(?:太早|过早|早了|抢在.+前|还没.+就)/u.test(value)) return "early";
  if (/(?:太晚|过晚|晚了|拖到.+后)/u.test(value)) return "late";
  if (/(?:太快|过快|一下就|节奏快|变化快)/u.test(value)) return "fast";
  return undefined;
}

function alreadyContainsDirection(value: string) {
  return /(?:情绪转折|提前预兆|延后|推迟|提前到|保留(?:当前)?时机|减弱|降低|加强|拉长|改成|改为|调整为|设置为|设为|换成|先[^，。；\n]+再)/u.test(value);
}

export function agentDirectorReviewRevisionCanFormProposalDirectly(value: string) {
  const sourceIntent = clean(value);
  if (sourceIntent.length < 12) return false;
  const concreteSignals = [
    /(?:\d+(?:\.\d+)?\s*(?:秒|帧)|以内|之前|之后|提前到|延后到|推迟到|拉长到|缩短到)/u,
    /(?:让[^，。；\n]{2,24}|先[^，。；\n]+再|[^，。；\n]{2,16}前先|[^，。；\n]{2,16}后再)/u,
    /(?:保持|保留)[^，。；\n]{2,24}(?:连续|一致|外观|位置|方向|灯光|场景)/u,
    /(?:镜头|机位|构图|焦点|运镜)[^，。；\n]{0,16}(?:改|调整|保持|推进|拉开|切换)/u,
  ].filter((pattern) => pattern.test(sourceIntent)).length;
  return concreteSignals >= 2
    || (concreteSignals >= 1 && sourceIntent.length >= 20 && alreadyContainsDirection(sourceIntent));
}

function clarificationOptions(
  concern: "early" | "late" | "fast",
  sourceIntent: string,
): AgentDirectorClarificationOption[] {
  if (concern === "late") {
    return [
      {
        id: "advance_as_turn",
        label: "提前转折",
        detail: "让变化更早出现，承担主要情绪转折。",
        resolvedIntent: `${sourceIntent}；调整为提前出现这个变化，让它承担主要情绪转折。`,
      },
      {
        id: "hold_and_strengthen",
        label: "保留时机",
        detail: "保留当前出现点，但加强前面的动作铺垫。",
        resolvedIntent: `${sourceIntent}；保留当前出现时机，同时加强前面的动作铺垫。`,
      },
    ];
  }
  if (concern === "fast") {
    return [
      {
        id: "extend_action",
        label: "拉长动作",
        detail: "先让主要动作完成，再进入变化。",
        resolvedIntent: `${sourceIntent}；拉长主要动作，让动作完成后再进入这个变化。`,
      },
      {
        id: "hold_and_soften",
        label: "减弱变化",
        detail: "保留当前时长，只降低变化强度。",
        resolvedIntent: `${sourceIntent}；保留当前时长，但降低变化强度，避免抢走主要动作。`,
      },
    ];
  }
  return [
    {
      id: "delay_as_turn",
      label: "情绪转折",
      detail: "先完成主要动作，再让变化成为情绪转折。",
      resolvedIntent: `${sourceIntent}；调整为先完成主要动作，再出现这个变化，把它作为情绪转折。`,
    },
    {
      id: "keep_as_foreshadow",
      label: "提前预兆",
      detail: "保留当前时机，但只做较弱的提前预兆。",
      resolvedIntent: `${sourceIntent}；保留当前时机，但减弱变化强度，只把它作为提前预兆。`,
    },
  ];
}

function reviewRevisionClarificationOptions(sourceIntent: string): AgentDirectorClarificationOption[] {
  return [
    {
      id: "apply_as_stated",
      label: "按此修改",
      detail: "保持你刚才的修改方向，整理成一个独立新版本提案。",
      resolvedIntent: sourceIntent,
    },
    {
      id: "strengthen_direction",
      label: "强化方向",
      detail: "保留当前故事事实，并进一步强化这条导演修改方向。",
      resolvedIntent: `${sourceIntent}；在不改变当前故事事实的前提下，进一步强化这条修改方向。`,
    },
  ];
}

export function buildAgentDirectorClarificationTurn(input: {
  userIntent: string;
  selectedShotId?: string;
  targetLabel?: string;
  hasAttachments?: boolean;
  createdAt?: string;
  reviewRevision?: AgentDirectorClarificationTurn["reviewRevision"];
}): AgentDirectorClarificationTurn | undefined {
  const sourceIntent = clean(input.userIntent);
  const selectedShotId = clean(input.selectedShotId);
  if (!sourceIntent || !selectedShotId || input.hasAttachments) return undefined;
  if (input.reviewRevision && validateAgentDirectorReviewIdentity(input.reviewRevision.identity).length) return undefined;
  const concern = timingConcern(sourceIntent);
  const useReviewRevisionClarification = Boolean(
    input.reviewRevision && (!concern || alreadyContainsDirection(sourceIntent)),
  );
  if (!concern && !useReviewRevisionClarification) return undefined;
  if (!input.reviewRevision && alreadyContainsDirection(sourceIntent)) return undefined;
  const targetLabel = clean(input.targetLabel) || selectedShotId;
  const createdAt = input.createdAt || new Date().toISOString();
  const suffix = createdAt.replace(/[^a-z0-9]+/gi, "").slice(0, 24).toLowerCase() || "now";
  const question = useReviewRevisionClarification
    ? "你希望按这条修改形成新版本提案，还是在此基础上进一步强化？"
    : concern === "late"
      ? "你希望把这个变化提前作为主要转折，还是保留当前时机并加强前面的铺垫？"
      : concern === "fast"
        ? "你希望拉长主要动作，还是保留当前时长但减弱这个变化？"
        : "你希望把这个变化留到主要动作完成后作为情绪转折，还是保留当前时机只做提前预兆？";
  return {
    id: `agent_director_clarification_${suffix}`,
    sourceIntent,
    targetLabel,
    selectedShotId,
    question,
    options: useReviewRevisionClarification
      ? reviewRevisionClarificationOptions(sourceIntent)
      : clarificationOptions(concern!, sourceIntent),
    boundary: "选择只会形成一条待确认提案；不会写项目、调用外部生成服务或导出。",
    reviewRevision: input.reviewRevision,
  };
}

export function buildAgentDirectorClarificationTimelineEntries(
  turn: AgentDirectorClarificationTurn,
  createdAt = new Date().toISOString(),
): VibeAgentTimelineEntry[] {
  return [
    {
      id: `${turn.id}_user`,
      type: "user_message",
      createdAt,
      title: "你",
      body: turn.sourceIntent,
      status: "done",
      facts: [{ label: "范围", value: turn.targetLabel }],
    },
    {
      id: turn.id,
      type: "assistant_message",
      createdAt,
      title: "AI 导演：确认导演意图",
      body: turn.question,
      lifecycle: "needs_user_input",
      status: "waiting",
      facts: [
        { label: "范围", value: turn.targetLabel },
        { label: "保护", value: "只形成提案，不执行" },
      ],
      details: {
        directorTurnKind: clarificationDetailKind,
        sourceIntent: turn.sourceIntent,
        targetLabel: turn.targetLabel,
        selectedShotId: turn.selectedShotId,
        question: turn.question,
        boundary: turn.boundary,
        options: turn.options,
        reviewRevision: turn.reviewRevision,
      },
    },
  ];
}

export function buildAgentDirectorClarificationResolutionTimelineEntry(input: {
  turn: AgentDirectorClarificationTurn;
  option: AgentDirectorClarificationOption;
  createdAt?: string;
}): VibeAgentTimelineEntry {
  const createdAt = input.createdAt || new Date().toISOString();
  return {
    id: `${input.turn.id}_resolved_${input.option.id}`,
    type: "user_message",
    createdAt,
    title: "你",
    body: `选择：${input.option.label}`,
    status: "done",
    facts: [
      { label: "范围", value: input.turn.targetLabel },
      { label: "方向", value: input.option.label },
    ],
    details: {
      directorTurnKind: clarificationResolutionDetailKind,
      clarificationId: input.turn.id,
      optionId: input.option.id,
      resolvedIntent: input.option.resolvedIntent,
      reviewRevisionIntentId: input.turn.reviewRevision?.intentId,
    },
  };
}

export function buildAgentDirectorClarificationFreeformResolutionTimelineEntry(input: {
  turn: AgentDirectorClarificationTurn;
  resolvedIntent: string;
  createdAt?: string;
}): VibeAgentTimelineEntry {
  const createdAt = input.createdAt || new Date().toISOString();
  return {
    id: `${input.turn.id}_resolved_custom`,
    type: "user_message",
    createdAt,
    title: "你",
    body: input.resolvedIntent,
    status: "done",
    facts: [{ label: "范围", value: input.turn.targetLabel }],
    details: {
      directorTurnKind: clarificationResolutionDetailKind,
      clarificationId: input.turn.id,
      optionId: "custom",
      resolvedIntent: input.resolvedIntent,
      reviewRevisionIntentId: input.turn.reviewRevision?.intentId,
    },
  };
}

function clarificationTurnFromEntry(entry: VibeAgentTimelineEntry): AgentDirectorClarificationTurn | undefined {
  const details = record(entry.details);
  if (details?.directorTurnKind !== clarificationDetailKind) return undefined;
  const options = Array.isArray(details.options)
    ? details.options.map((value) => {
      const option = record(value);
      const id = clean(option?.id) as AgentDirectorClarificationOptionId;
      const label = clean(option?.label);
      const detail = clean(option?.detail);
      const resolvedIntent = clean(option?.resolvedIntent);
      return id && label && detail && resolvedIntent ? { id, label, detail, resolvedIntent } : undefined;
    }).filter((value): value is AgentDirectorClarificationOption => Boolean(value))
    : [];
  const sourceIntent = clean(details.sourceIntent);
  const targetLabel = clean(details.targetLabel);
  const selectedShotId = clean(details.selectedShotId);
  const question = clean(details.question);
  const boundary = clean(details.boundary);
  const reviewRevisionRecord = record(details.reviewRevision);
  const reviewRevisionIdentity = agentDirectorReviewIdentityFromUnknown(reviewRevisionRecord?.identity);
  const reviewRevisionIntentId = clean(reviewRevisionRecord?.intentId);
  const reviewRevision = reviewRevisionIntentId
    && reviewRevisionIdentity
    && validateAgentDirectorReviewIdentity(reviewRevisionIdentity).length === 0
    ? { intentId: reviewRevisionIntentId, identity: reviewRevisionIdentity }
    : undefined;
  if (reviewRevisionRecord && !reviewRevision) return undefined;
  if (!sourceIntent || !targetLabel || !selectedShotId || !question || options.length < 2) return undefined;
  return {
    id: entry.id,
    sourceIntent,
    targetLabel,
    selectedShotId,
    question,
    options,
    boundary: boundary || "选择只会形成一条待确认提案；不会执行。",
    reviewRevision,
  };
}

export function activeAgentDirectorClarificationFromTimeline(
  entries: VibeAgentTimelineEntry[],
): AgentDirectorClarificationTurn | undefined {
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index]!;
    const turn = clarificationTurnFromEntry(entry);
    if (!turn || entry.status === "done") continue;
    const explicitlyResolved = entries.some((candidate) => {
      const details = record(candidate.details);
      return details?.directorTurnKind === clarificationResolutionDetailKind
        && details.clarificationId === turn.id;
    });
    if (explicitlyResolved) continue;
    const resolved = entries.slice(index + 1).some((candidate) =>
      candidate.type === "confirmation_request"
      || Boolean(candidate.actionId)
      || (candidate.type === "user_message" && candidate.id !== `${turn.id}_user`)
    );
    if (!resolved) return turn;
  }
  return undefined;
}

export function agentDirectorClarificationReplyIntent(
  turn: AgentDirectorClarificationTurn,
  reply: string,
) {
  const cleanedReply = clean(reply);
  const matched = turn.options.find((option) => option.label === cleanedReply || option.id === cleanedReply);
  if (matched) return matched.resolvedIntent;
  return cleanedReply ? `${turn.sourceIntent}；补充：${cleanedReply}` : turn.sourceIntent;
}
