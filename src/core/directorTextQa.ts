import type { DirectorRuleQaReport } from "./directorRuleQa";

export type DirectorTextQaStatus = "pass" | "needs_revision" | "blocked" | "skipped";
export type DirectorTextQaSeverity = "blocker" | "warning" | "info";

export type DirectorTextQaCategory =
  | "story_logic"
  | "reference_strategy"
  | "generation_contract"
  | "prompt_clarity"
  | "style_alignment"
  | "user_intent";

export interface DirectorTextQaFinding {
  code: string;
  severity: DirectorTextQaSeverity;
  category: DirectorTextQaCategory;
  path: string;
  message: string;
  evidence?: string;
  suggestedFix?: string;
  rewriteHint?: string;
}

export interface DirectorTextQaShotLike {
  id?: string;
  shotId?: string;
  title?: string;
  durationSeconds?: number;
  referenceStrategy?: string;
  executionMode?: string;
  rhythmProfile?: string;
  visibleClips?: number;
  storyboardPanels?: number;
  actionBeats?: string[];
  camera?: string;
  intent?: string;
  primaryAction?: string;
  actionTrigger?: string;
  trigger?: string;
  microReaction?: string;
  reaction?: string;
  characterGuidance?: string[];
  sceneGuidance?: string[];
  propGuidance?: string[];
}

export interface DirectorTextQaAssetLike {
  id?: string;
  kind?: string;
  type?: string;
  label?: string;
  name?: string;
  role?: string;
  usedByShotIds?: string[];
}

export interface DirectorTextQaInput {
  shots: DirectorTextQaShotLike[];
  assets?: DirectorTextQaAssetLike[];
  compilerMode?: string;
  compilerModeLabel?: string;
  compilerReasons?: string[];
  durationSeconds?: number;
  visibleClips?: number;
  storyboardPanels?: number;
  seedancePrompt?: string;
  storyboardPrompt?: string;
  userIntent?: string;
  styleIntent?: string;
  ruleQaReport?: DirectorRuleQaReport;
}

export interface DirectorTextQaReport {
  schemaVersion: "director_text_qa_v1";
  status: DirectorTextQaStatus;
  providerCalled: boolean;
  runtimeExternalNetworkCallMade: boolean;
  model?: string;
  providerId?: string;
  transport?: string;
  summary: string;
  blockerCount: number;
  warningCount: number;
  infoCount: number;
  findings: DirectorTextQaFinding[];
  rewriteHints: string[];
  rawStatus?: string;
  skippedReason?: string;
}

const categories = new Set<DirectorTextQaCategory>([
  "story_logic",
  "reference_strategy",
  "generation_contract",
  "prompt_clarity",
  "style_alignment",
  "user_intent",
]);

function clean(value: unknown, maxLength = 600): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, maxLength) : "";
}

function cleanMultiline(value: unknown, maxLength = 12000): string {
  return typeof value === "string"
    ? value.replace(/\r\n?/g, "\n").replace(/[ \t]+\n/g, "\n").trim().slice(0, maxLength)
    : "";
}

function stringArray(value: unknown, maxItems = 24): string[] {
  return Array.isArray(value) ? value.map((item) => clean(item, 240)).filter(Boolean).slice(0, maxItems) : [];
}

function numberOrUndefined(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function shotId(shot: DirectorTextQaShotLike, index: number): string {
  return clean(shot.id || shot.shotId, 120) || `shot_${index + 1}`;
}

function compactShot(shot: DirectorTextQaShotLike, index: number): Record<string, unknown> {
  return {
    id: shotId(shot, index),
    title: clean(shot.title),
    durationSeconds: numberOrUndefined(shot.durationSeconds),
    referenceStrategy: clean(shot.referenceStrategy),
    executionMode: clean(shot.executionMode),
    rhythmProfile: clean(shot.rhythmProfile),
    visibleClips: numberOrUndefined(shot.visibleClips),
    storyboardPanels: numberOrUndefined(shot.storyboardPanels),
    actionBeats: stringArray(shot.actionBeats, 16),
    camera: clean(shot.camera, 500),
    intent: clean(shot.intent, 900),
    primaryAction: clean(shot.primaryAction, 500),
    trigger: clean(shot.actionTrigger || shot.trigger, 400),
    microReaction: clean(shot.microReaction || shot.reaction, 400),
    characterGuidance: stringArray(shot.characterGuidance, 12),
    sceneGuidance: stringArray(shot.sceneGuidance, 12),
    propGuidance: stringArray(shot.propGuidance, 12),
  };
}

function compactAsset(asset: DirectorTextQaAssetLike, index: number): Record<string, unknown> {
  return {
    id: clean(asset.id, 160) || `asset_${index + 1}`,
    kind: clean(asset.kind || asset.type || asset.role, 80),
    label: clean(asset.label || asset.name, 240),
    usedByShotIds: stringArray(asset.usedByShotIds, 24),
  };
}

function compactRuleQa(ruleQaReport?: DirectorRuleQaReport): Record<string, unknown> | undefined {
  if (!ruleQaReport) return undefined;
  return {
    status: ruleQaReport.status,
    blockerCount: ruleQaReport.blockerCount,
    warningCount: ruleQaReport.warningCount,
    findings: ruleQaReport.findings.slice(0, 16).map((finding) => ({
      code: finding.code,
      severity: finding.severity,
      category: finding.category,
      path: finding.path,
      message: finding.message,
      suggestedFix: finding.suggestedFix,
    })),
  };
}

export function buildDirectorTextQaPrompt(input: DirectorTextQaInput): string {
  const payload = {
    compiler: {
      mode: clean(input.compilerMode, 120),
      label: clean(input.compilerModeLabel, 120),
      reasons: stringArray(input.compilerReasons, 16),
      durationSeconds: numberOrUndefined(input.durationSeconds),
      visibleClips: numberOrUndefined(input.visibleClips),
      storyboardPanels: numberOrUndefined(input.storyboardPanels),
    },
    userIntent: cleanMultiline(input.userIntent, 1800),
    styleIntent: cleanMultiline(input.styleIntent, 1800),
    shots: input.shots.map(compactShot),
    assets: (input.assets || []).map(compactAsset),
    ruleQa: compactRuleQa(input.ruleQaReport),
    prompts: {
      seedancePrompt: cleanMultiline(input.seedancePrompt, 9000),
      storyboardPrompt: cleanMultiline(input.storyboardPrompt, 7000),
    },
  };

  return [
    "你是一个 AIGC 视频导演工作流的文本 QA。你只审查文字规划、参考策略、故事板/全能参考合同和视频提示词，不做图片多模态判断。",
    "目标：在真正调用 Image2 或 Seedance 之前，发现会浪费生成成本的文本问题。",
    "请特别检查：",
    "1. 故事逻辑是否和镜头顺序、场景、动作触发一致；不要让一个故事板覆盖明显不同场景的镜头。",
    "2. 三种生成模式是否合理：storyboard_narrative、storyboard_rapid_cut、omni_reference。",
    "3. visibleClips 是最终可见剪辑数；storyboardPanels 是故事板面板数；actionBeats 是动作节点。三者可以不同，但必须说清楚，不能互相污染。",
    "4. 参考资产是否被正确使用：场景只管地点/天气/光线，角色只管身份，道具只管独立物体外观；车灯、轮胎、手、眼神、雾气这类细节通常应并入父对象或动作说明。",
    "5. Seedance prompt 是否存在矛盾：故事板数量、最终可见剪辑数、总时长、no BGM、禁止渲染箭头/数字/面板框/文字等。",
    "6. 风格和用户意图是否被尊重；比如用户要 1990 年代日本 TV 动画，就不要写成真人写实、3D 或商业广告质感。",
    "只返回 JSON，不要 Markdown，不要解释性长文。",
    "JSON schema:",
    JSON.stringify({
      schemaVersion: "director_text_qa_model_output_v1",
      status: "pass | needs_revision | blocked",
      summary: "一句中文总结",
      findings: [{
        code: "stable_snake_case_code",
        severity: "blocker | warning | info",
        category: "story_logic | reference_strategy | generation_contract | prompt_clarity | style_alignment | user_intent",
        path: "shots.S01.referenceStrategy 或 seedancePrompt",
        message: "给用户看的中文问题",
        evidence: "引用最短证据",
        suggestedFix: "中文修复建议",
        rewriteHint: "可给 Agent 的改写提示",
      }],
      rewriteHints: ["整体改写建议"],
    }),
    "判定标准：",
    "- pass：没有需要修的文本问题。",
    "- needs_revision：有明显可改进问题，但不一定要阻断真实生成。",
    "- blocked：存在会导致模式错用、参考错绑、剪辑数/时长冲突、BGM/标注泄漏、场景串用等高成本硬错误。",
    "[QA INPUT]",
    JSON.stringify(payload, null, 2),
  ].join("\n");
}

function extractJsonObject(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const source = fenced || text;
  const start = source.indexOf("{");
  const end = source.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("director_text_qa_json_missing");
  return JSON.parse(source.slice(start, end + 1));
}

function normalizeSeverity(value: unknown): DirectorTextQaSeverity {
  const text = clean(value, 80).toLowerCase();
  if (text === "blocker" || text === "blocked" || text === "fatal" || text === "error") return "blocker";
  if (text === "info" || text === "note") return "info";
  return "warning";
}

function normalizeCategory(value: unknown): DirectorTextQaCategory {
  const text = clean(value, 80).toLowerCase() as DirectorTextQaCategory;
  return categories.has(text) ? text : "prompt_clarity";
}

function normalizeFinding(value: unknown, index: number): DirectorTextQaFinding | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  const message = clean(record.message, 500);
  if (!message) return undefined;
  return {
    code: clean(record.code, 120).replace(/[^a-z0-9_:-]+/gi, "_").replace(/^_+|_+$/g, "") || `text_qa_finding_${index + 1}`,
    severity: normalizeSeverity(record.severity),
    category: normalizeCategory(record.category),
    path: clean(record.path, 240) || "directorTextQa",
    message,
    evidence: clean(record.evidence, 600) || undefined,
    suggestedFix: clean(record.suggestedFix, 600) || undefined,
    rewriteHint: clean(record.rewriteHint, 800) || undefined,
  };
}

function statusFrom(rawStatus: unknown, findings: DirectorTextQaFinding[]): DirectorTextQaStatus {
  if (findings.some((finding) => finding.severity === "blocker")) return "blocked";
  const text = clean(rawStatus, 80).toLowerCase();
  if (text === "blocked" || text === "block") return "blocked";
  if (text === "needs_revision" || text === "needs-revision" || text === "warning" || text === "revise") return "needs_revision";
  if (text === "pass" || text === "passed" || text === "ok") return findings.some((finding) => finding.severity === "blocker")
    ? "blocked"
    : findings.some((finding) => finding.severity === "warning")
      ? "needs_revision"
      : "pass";
  return findings.some((finding) => finding.severity === "blocker")
    ? "blocked"
    : findings.some((finding) => finding.severity === "warning")
      ? "needs_revision"
      : "pass";
}

export function normalizeDirectorTextQaReport(
  raw: unknown,
  metadata: Pick<DirectorTextQaReport, "providerCalled" | "runtimeExternalNetworkCallMade"> & Partial<Pick<DirectorTextQaReport, "model" | "providerId" | "transport">> = {
    providerCalled: false,
    runtimeExternalNetworkCallMade: false,
  },
): DirectorTextQaReport {
  const record = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  const findings = (Array.isArray(record.findings) ? record.findings : [])
    .map(normalizeFinding)
    .filter((finding): finding is DirectorTextQaFinding => Boolean(finding))
    .slice(0, 24);
  const blockerCount = findings.filter((finding) => finding.severity === "blocker").length;
  const warningCount = findings.filter((finding) => finding.severity === "warning").length;
  const infoCount = findings.filter((finding) => finding.severity === "info").length;
  const rewriteHints = [
    ...stringArray(record.rewriteHints, 12),
    ...findings.map((finding) => clean(finding.rewriteHint, 800)).filter(Boolean),
  ].slice(0, 16);

  return {
    schemaVersion: "director_text_qa_v1",
    status: statusFrom(record.status, findings),
    providerCalled: metadata.providerCalled,
    runtimeExternalNetworkCallMade: metadata.runtimeExternalNetworkCallMade,
    model: metadata.model,
    providerId: metadata.providerId,
    transport: metadata.transport,
    summary: clean(record.summary, 500) || (findings.length ? "LLM 文本 QA 发现需要检查的问题。" : "LLM 文本 QA 未发现阻断问题。"),
    blockerCount,
    warningCount,
    infoCount,
    findings,
    rewriteHints,
    rawStatus: clean(record.status, 120) || undefined,
  };
}

export function recoverDirectorTextQaReportFromText(
  text: string,
  metadata: Pick<DirectorTextQaReport, "providerCalled" | "runtimeExternalNetworkCallMade"> & Partial<Pick<DirectorTextQaReport, "model" | "providerId" | "transport">>,
): DirectorTextQaReport {
  return normalizeDirectorTextQaReport(extractJsonObject(text), metadata);
}

export function skippedDirectorTextQaReport(reason: string): DirectorTextQaReport {
  return {
    schemaVersion: "director_text_qa_v1",
    status: "skipped",
    providerCalled: false,
    runtimeExternalNetworkCallMade: false,
    summary: reason,
    blockerCount: 0,
    warningCount: 0,
    infoCount: 1,
    findings: [{
      code: "director_text_qa_skipped",
      severity: "info",
      category: "prompt_clarity",
      path: "directorTextQa",
      message: reason,
    }],
    rewriteHints: [],
    skippedReason: reason,
  };
}
