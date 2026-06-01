import { estimateKnowledgeTokens, stableKnowledgeHash } from "./knowledgeManifest";
import type { KnowledgePack, KnowledgePackManifest, KnowledgeSnippet, KnowledgeTaskPurpose } from "./knowledgeTypes";
import {
  buildAgentWebSearchReviewCard,
  type AgentWebSearchConfirmationTarget,
  type AgentWebSearchResult,
  type AgentWebSearchReviewCard,
} from "./agentWebSearchClient";
import {
  applyProjectVibeTransaction,
  hashProjectVibeFacts,
  isPortableProjectPath,
  type ProjectVibePatchResult,
} from "../project/projectVibe";
import type {
  ProjectVibeAsset,
  ProjectVibeDocument,
  ProjectVibePatchOperation,
  ProjectVibeRunReceipt,
  ProjectVibeTransaction,
  ProjectVibeTransactionReceipt,
} from "../project/types";
import type { ElectronBridge } from "./electronBridge";

export const projectLocalKnowledgeManifestVersion = "project-local/0.1.0";

export interface BuildProjectLocalKnowledgePackInput {
  result: AgentWebSearchResult;
  userIntent: string;
  projectId: string;
  projectTitle: string;
  createdAt?: string;
  confirmedCard?: AgentWebSearchReviewCard;
  confirmationTarget?: AgentWebSearchConfirmationTarget;
}

export interface ProjectLocalKnowledgeReferenceStagedTransactionPreview {
  kind: "project_local_knowledge_reference_staged_transaction_preview";
  schemaVersion: "0.1.0";
  transactionId: string;
  generatedAt: string;
  projectVibeWriteAllowed: false;
  projectFactsMutated: false;
  transaction: ProjectVibeTransaction;
  patchOperations: ProjectVibePatchOperation[];
  pack: KnowledgePack;
  assetId: string;
  runReceiptId: string;
  source: {
    projectId: string;
    beforeFactHash: string;
    packId: string;
    packHash: string;
    evidenceRef: string;
    citationHashes: string[];
    sourceRefs: string[];
  };
  summary: {
    title: string;
    sourceCount: number;
    stagedFactCount: number;
    patchOperationCount: number;
  };
  blocked: boolean;
  blockedReasons: string[];
}

export interface ProjectLocalKnowledgeReferenceCommitResult {
  status: ProjectVibeTransactionReceipt["status"];
  project: ProjectVibeDocument;
  patch: ProjectVibePatchResult;
  pack: KnowledgePack;
  assetId: string;
  runReceiptId: string;
  blockedReasons: string[];
}

export interface BuildProjectLocalKnowledgeReferenceTransactionInput {
  project: ProjectVibeDocument;
  pack: KnowledgePack;
  result: AgentWebSearchResult;
  userIntent: string;
  generatedAt?: string;
}

export interface CommitProjectLocalKnowledgeReferenceTransactionInput {
  project: ProjectVibeDocument;
  stagedTransaction: ProjectLocalKnowledgeReferenceStagedTransactionPreview;
}

export type ProjectLocalKnowledgeStorageMode = "electron_project_file" | "browser_local";

export interface ProjectLocalKnowledgeStorageTarget {
  projectRoot?: string;
  storageKey?: string;
}

export interface ProjectLocalKnowledgeSaveResult {
  ok: boolean;
  mode?: ProjectLocalKnowledgeStorageMode;
  pack: KnowledgePack;
  path: string;
  hash: string;
  targetId: string;
  errors: string[];
}

export interface ProjectLocalKnowledgeOpenResult {
  ok: boolean;
  mode?: ProjectLocalKnowledgeStorageMode;
  packs: KnowledgePack[];
  paths: string[];
  targetId: string;
  errors: string[];
  warnings: string[];
}

const projectLocalKnowledgeStoragePrefix = "vibe-director.project-local-knowledge.v1";
const projectLocalKnowledgeBrowserStoragePrefix = "vibe-director.project-local-knowledge-files.v1";

function slug(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72) || "research";
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map((item) => item.trim()).filter(Boolean))).sort((left, right) => left.localeCompare(right));
}

function tokenKeywords(value: string): string[] {
  return value.toLowerCase().split(/[^\p{L}\p{N}.]+/u).filter((item) => item.length > 1).slice(0, 18);
}

function safeId(value: string, fallback: string): string {
  const safe = value.trim().replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 72);
  return safe || fallback;
}

function compactTime(value: string): string {
  return value.replace(/\D/g, "").slice(0, 14) || `${Date.now()}`;
}

function snippet(id: string, title: string, content: string, keywords: string[]): KnowledgeSnippet {
  const normalized = content.trim();
  return {
    id,
    title,
    summary: normalized.split(/\n+/).map((line) => line.trim()).filter(Boolean).slice(0, 3).join(" ").slice(0, 320),
    content: normalized,
    keywords: unique(keywords),
    hash: stableKnowledgeHash(`${title}\n${normalized}`),
    tokenEstimate: estimateKnowledgeTokens(normalized),
    sourceHeading: title,
  };
}

function conciseCitationSnippet(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, 220);
}

function confirmedResearchCard(input: BuildProjectLocalKnowledgePackInput): AgentWebSearchReviewCard {
  return input.confirmedCard || input.result.reviewCard || buildAgentWebSearchReviewCard(input.result, input.userIntent);
}

function cardLabel(card: Pick<AgentWebSearchReviewCard, "cardKind">): string {
  return card.cardKind === "style_research_card" ? "风格研究卡" : "本片参考卡";
}

function portableRefValue(value: string | undefined): string | undefined {
  const raw = value?.trim().replace(/\\/g, "/");
  if (!raw || raw.startsWith("/") || raw.startsWith("~/") || /^[A-Za-z]:\//.test(raw)) return undefined;
  const normalized = raw.replace(/^\.\//, "");
  if (!normalized || !isPortableProjectPath(normalized)) return undefined;
  return normalized;
}

function portableEvidenceRef(value: string | undefined): string | undefined {
  const normalized = value?.trim().replace(/\\/g, "/");
  if (!normalized) return undefined;
  const hashIndex = normalized.indexOf("#");
  if (hashIndex >= 0) {
    const prefix = normalized.slice(0, hashIndex);
    const refPath = portableRefValue(normalized.slice(hashIndex + 1));
    return refPath ? `${prefix}#${refPath}` : undefined;
  }
  return portableRefValue(normalized);
}

function methodContent(input: BuildProjectLocalKnowledgePackInput): string {
  const card = confirmedResearchCard(input);
  const label = cardLabel(card);
  const sources = input.result.citations
    .slice(0, 5)
    .map((source, index) => `${index + 1}. ${source.title} (${source.domain})\n   ${conciseCitationSnippet(source.snippet)}`)
    .join("\n");
  return [
    `## ${label}`,
    "",
    `卡片来源：${card.title}`,
    `确认目标：${input.confirmationTarget || "project_knowledge_card"}`,
    "",
    "这张卡已经经过用户确认才进入项目知识；原始搜索结果仍不是正式事实。",
    "",
    `用户意图：${input.userIntent}`,
    "",
    "把外部资料当作创作方法参考，而不是复刻对象。执行脚本、分镜、起始帧、结束帧和 QA 时，只使用这些方法化信号：叙事结构、对白节奏、镜头构图、情绪压力、色彩与空间关系。",
    "",
    "可用方法：",
    "- 先提炼“它是怎么做的”，不要复制任何现成角色、台词、剧情、组织名、标志、镜头表或分镜顺序。",
    "- 写脚本时关注冲突如何进入场景、信息如何延迟释放、角色选择如何产生后果。",
    "- 拆分镜时关注画面如何承载情绪：人物位置、负空间、静帧停顿、光源、屏幕或机械结构、视线与沉默。",
    "- 写生图提示词时使用抽象方法词和原创画面元素，不写受版权保护的具体角色或场景。",
    "",
    "来源信号：",
    sources || "- 暂无来源摘要。",
  ].join("\n");
}

function safetyContent(input: BuildProjectLocalKnowledgePackInput): string {
  const card = confirmedResearchCard(input);
  const evidenceRef = portableEvidenceRef(input.result.evidenceRef) || portableRefValue(input.result.evidencePath) || "web-search evidence";
  return [
    "## 致敬边界",
    "",
    "这份本片参考只允许影响方法，不允许变成原作复刻。",
    "",
    "必须避免：",
    "- 复写原作台词、剧情桥段、角色姓名、组织名、专有世界观名词。",
    "- 要求生成“同款分镜”“原版镜头”“原角色造型”。",
    "- 把网页摘要直接写入 Project.vibe 正式事实。",
    "",
    "允许使用：",
    "- 非线性章节、延迟揭示、对白中的隐藏压力、日常话题与危险感并置。",
    "- 静帧、留白、压迫性空间、冷色屏幕光、工业结构、克制动作和长停顿。",
    "- 对公开资料的概括性方法总结，并保留来源回执。",
    "",
    "确认合同：",
    `- 待确认卡片：${card.cardId}`,
    "- 搜索结果不能直接污染 Project.vibe 正式事实。",
    "- 只有用户确认并保存后，才生成项目知识卡或全局 card。",
    "",
    `来源回执：${evidenceRef}`,
  ].join("\n");
}

const applicableTaskPurposes: KnowledgeTaskPurpose[] = [
  "script",
  "asset",
  "keyframe",
  "edit",
  "qa",
  "audit",
  "story_audit",
  "visual_generation",
  "visual_audit",
  "continuity_audit",
  "regeneration_plan",
];

export function buildProjectLocalKnowledgePackFromWebSearch(input: BuildProjectLocalKnowledgePackInput): KnowledgePack {
  const createdAt = input.createdAt || new Date().toISOString();
  const card = confirmedResearchCard(input);
  const seed = stableKnowledgeHash(JSON.stringify({
    projectId: input.projectId,
    query: input.result.query,
    userIntent: input.userIntent,
    evidencePath: input.result.evidencePath,
    citations: input.result.citations.map((source) => source.hash),
    cardId: card.cardId,
    confirmationTarget: input.confirmationTarget || "project_knowledge_card",
  }));
  const title = `${cardLabel(card)}：${input.userIntent.trim().slice(0, 28) || input.result.query.slice(0, 28)}`;
  const packId = `project/${slug(input.projectId)}/research/${seed.slice(4, 12)}`;
  const keywords = unique([
    "research",
    "style",
    "confirmed_research_card",
    card.cardKind,
    input.confirmationTarget === "global_card" ? "global_card_candidate" : "project_knowledge_card",
    "script",
    "dialogue",
    "composition",
    "prompt",
    "qa",
    "参考",
    "致敬",
    "方法",
    ...tokenKeywords(input.userIntent),
    ...input.result.citations.flatMap((source) => [source.domain, ...tokenKeywords(`${source.title} ${source.snippet}`)]),
  ]).slice(0, 36);
  const snippets = [
    snippet("creative-method", "本片参考方法", methodContent(input), keywords),
    snippet("homage-boundary", "致敬边界", safetyContent(input), [...keywords, "qa", "boundary", "版权", "边界"]),
  ];
  const packBody = JSON.stringify({
    packId,
    title,
    query: input.result.query,
    projectId: input.projectId,
    confirmedCardId: card.cardId,
    confirmedCardKind: card.cardKind,
    confirmationTarget: input.confirmationTarget || "project_knowledge_card",
    citationHashes: input.result.citations.map((source) => source.hash),
    snippets: snippets.map((item) => item.hash),
  });

  return {
    id: packId,
    version: "1.0.0",
    hash: stableKnowledgeHash(packBody),
    path: `project-knowledge/${slug(input.projectId)}/${seed.slice(4, 12)}.json`,
    type: "project_local",
    category: "style",
    title,
    summary: `用户确认后的${cardLabel(card)}，来自 ${input.result.resultCount} 个外部来源，只作为原创脚本、分镜、画面提示词和 QA 的方法参考；原始搜索结果没有直接写入正式事实。`,
    tags: keywords,
    applicableTaskPurposes,
    applicableProviderSlots: ["image.generate", "image.edit", "image.reference_asset"],
    dependencies: [],
    conflicts: [],
    maxInjectionTokens: 760,
    trustLevel: "verified",
    verificationStatus: "verified",
    verificationReportId: portableEvidenceRef(input.result.evidenceRef) || portableRefValue(input.result.evidencePath) || `web_search:${seed}`,
    conflictAcknowledged: false,
    enabled: true,
    defaultEnabled: true,
    createdAt,
    updatedAt: createdAt,
    sourcePath: portableRefValue(input.result.evidencePath),
    snippets,
  };
}

function sourceRefsForProjectVibe(input: BuildProjectLocalKnowledgeReferenceTransactionInput): string[] {
  return unique([
    `knowledge_pack#${input.pack.id}`,
    `knowledge_pack_hash#${input.pack.hash}`,
    `knowledge_pack_path#${input.pack.path}`,
    portableEvidenceRef(input.result.evidenceRef) ? `web_search_evidence#${portableEvidenceRef(input.result.evidenceRef)}` : "",
    portableRefValue(input.result.evidencePath) ? `web_search_evidence_path#${portableRefValue(input.result.evidencePath)}` : "",
    ...input.result.citations.map((source) => `web_citation#${source.domain}#${source.hash}`),
  ]);
}

function projectVibeResearchAsset(input: BuildProjectLocalKnowledgeReferenceTransactionInput, assetId: string): ProjectVibeAsset {
  return {
    id: assetId,
    kind: "style",
    label: input.pack.title,
    status: "locked",
    textConstraints: unique([
      `本片参考：${input.userIntent.trim() || input.pack.title}`,
      `来源已确认：${input.result.resultCount} 个外部来源；只作为原创脚本、分镜、画面提示词和复核的方法参考。`,
      "知识卡边界：这是一张用户确认后的研究卡；原始搜索结果仍不是 Project.vibe 正式事实。",
      "致敬边界：不复制角色、台词、剧情、世界观、标志、镜头表或分镜顺序。",
      "提示词边界：使用抽象方法词和原创画面元素，不把网页摘要直接写成正式任务。",
    ]),
    usedByShotIds: [],
    sourceRefs: sourceRefsForProjectVibe(input),
    lockedBy: "user",
  };
}

function projectVibeResearchRunReceipt(input: BuildProjectLocalKnowledgeReferenceTransactionInput, runReceiptId: string, assetId: string): ProjectVibeRunReceipt {
  return {
    id: runReceiptId,
    runKind: "agent_loop",
    status: "succeeded",
    createdAt: input.generatedAt || new Date().toISOString(),
    summary: `用户确认本片参考：${input.pack.title}`,
    sourceFactHash: input.pack.hash,
    affectedShotIds: [],
    producedAssetIds: [assetId],
    evidenceRefs: sourceRefsForProjectVibe(input),
    projectFactsMutated: true,
    runtimeFixtureUsed: false,
  };
}

export function buildProjectLocalKnowledgeReferenceStagedTransaction(
  input: BuildProjectLocalKnowledgeReferenceTransactionInput,
): ProjectLocalKnowledgeReferenceStagedTransactionPreview {
  const generatedAt = input.generatedAt || new Date().toISOString();
  const beforeFactHash = hashProjectVibeFacts(input.project);
  const seed = stableKnowledgeHash(JSON.stringify({
    projectId: input.project.manifest.projectId,
    packId: input.pack.id,
    packHash: input.pack.hash,
    userIntent: input.userIntent,
    evidencePath: input.result.evidencePath,
  }));
  const assetId = `style_research_${safeId(seed.slice(4, 14), "reference")}`;
  const runReceiptId = `run_research_${safeId(seed.slice(4, 14), "reference")}_${compactTime(generatedAt)}`;
  const asset = projectVibeResearchAsset(input, assetId);
  const run = projectVibeResearchRunReceipt({ ...input, generatedAt }, runReceiptId, assetId);
  const patchOperations: ProjectVibePatchOperation[] = [
    { op: "upsert_asset", asset },
    { op: "append_run_receipt", run },
  ];
  const blockedReasons = unique([
    input.pack.type !== "project_local" ? "project_local_pack_required" : "",
    input.pack.trustLevel !== "verified" ? "verified_pack_required" : "",
    input.result.reviewRequired !== true ? "web_search_review_required" : "",
    input.result.promotionAllowed !== false ? "raw_web_search_promotion_must_stay_blocked" : "",
    input.result.citations.length <= 0 ? "confirmed_sources_required" : "",
  ]);
  const transactionId = `txn_research_${safeId(seed.slice(4, 14), "reference")}_${compactTime(generatedAt)}`;
  return {
    kind: "project_local_knowledge_reference_staged_transaction_preview",
    schemaVersion: "0.1.0",
    transactionId,
    generatedAt,
    projectVibeWriteAllowed: false,
    projectFactsMutated: false,
    transaction: {
      id: transactionId,
      actor: "user",
      reason: "Record user-confirmed project-local research reference.",
      createdAt: generatedAt,
      operations: patchOperations,
    },
    patchOperations,
    pack: input.pack,
    assetId,
    runReceiptId,
    source: {
      projectId: input.project.manifest.projectId,
      beforeFactHash,
      packId: input.pack.id,
      packHash: input.pack.hash,
      evidenceRef: portableEvidenceRef(input.result.evidenceRef) || portableRefValue(input.result.evidencePath) || "",
      citationHashes: input.result.citations.map((source) => source.hash),
      sourceRefs: sourceRefsForProjectVibe(input),
    },
    summary: {
      title: input.pack.title,
      sourceCount: input.result.resultCount,
      stagedFactCount: 2,
      patchOperationCount: patchOperations.length,
    },
    blocked: blockedReasons.length > 0,
    blockedReasons,
  };
}

export function commitProjectLocalKnowledgeReferenceStagedTransaction(
  input: CommitProjectLocalKnowledgeReferenceTransactionInput,
): ProjectLocalKnowledgeReferenceCommitResult {
  if (input.stagedTransaction.blocked) {
    return {
      status: "rejected",
      project: input.project,
      patch: applyProjectVibeTransaction(input.project, {
        ...input.stagedTransaction.transaction,
        operations: [],
      }),
      pack: input.stagedTransaction.pack,
      assetId: input.stagedTransaction.assetId,
      runReceiptId: input.stagedTransaction.runReceiptId,
      blockedReasons: input.stagedTransaction.blockedReasons,
    };
  }
  const patch = applyProjectVibeTransaction(input.project, input.stagedTransaction.transaction);
  return {
    status: patch.receipt.status,
    project: patch.project,
    patch,
    pack: input.stagedTransaction.pack,
    assetId: input.stagedTransaction.assetId,
    runReceiptId: input.stagedTransaction.runReceiptId,
    blockedReasons: patch.receipt.errors,
  };
}

export function buildProjectLocalKnowledgeManifest(projectId: string, packs: KnowledgePack[], generatedAt?: string): KnowledgePackManifest {
  const enabledPacks = packs.filter((pack) => pack.enabled);
  const manifestHash = stableKnowledgeHash(JSON.stringify(enabledPacks.map((pack) => `${pack.id}@${pack.version}:${pack.hash}`).sort()));
  return {
    schemaVersion: "0.1.0",
    manifestVersion: projectLocalKnowledgeManifestVersion,
    generatedAt: generatedAt || new Date().toISOString(),
    knowledgeLibraryRoot: `project-knowledge/${slug(projectId)}`,
    manifestHash,
    packs: enabledPacks,
  };
}

function storageKey(projectId: string): string {
  return `${projectLocalKnowledgeStoragePrefix}.${slug(projectId || "default")}`;
}

function isKnowledgePack(value: unknown): value is KnowledgePack {
  return Boolean(value && typeof value === "object" && !Array.isArray(value) && typeof (value as { id?: unknown }).id === "string");
}

function cloneKnowledgePack(pack: KnowledgePack): KnowledgePack {
  return JSON.parse(JSON.stringify(pack)) as KnowledgePack;
}

function normalizeProjectKnowledgePath(path: string): string {
  const raw = path.trim().replace(/\\/g, "/");
  if (raw.startsWith("/") || raw.startsWith("~/") || /^[A-Za-z]:\//.test(raw)) {
    throw new Error(`Project-local knowledge pack path must be portable and under project-knowledge/: ${path}`);
  }
  const normalized = raw.replace(/^\.\//, "");
  if (!normalized.startsWith("project-knowledge/") || !isPortableProjectPath(normalized)) {
    throw new Error(`Project-local knowledge pack path must be portable and under project-knowledge/: ${path}`);
  }
  return normalized;
}

export function portableProjectLocalKnowledgePackPath(pack: KnowledgePack): string {
  return normalizeProjectKnowledgePath(pack.path);
}

export function sanitizeProjectLocalKnowledgePackForPersistence(pack: KnowledgePack): KnowledgePack {
  const next = cloneKnowledgePack(pack);
  next.path = normalizeProjectKnowledgePath(next.path);
  next.sourcePath = portableRefValue(next.sourcePath);
  next.verificationReportId = portableEvidenceRef(next.verificationReportId);
  return next;
}

export function serializeProjectLocalKnowledgePack(pack: KnowledgePack): string {
  return `${JSON.stringify(sanitizeProjectLocalKnowledgePackForPersistence(pack), null, 2)}\n`;
}

export function parseProjectLocalKnowledgePack(serialized: string): KnowledgePack {
  const parsed = JSON.parse(serialized) as unknown;
  if (!isKnowledgePack(parsed)) throw new Error("Project-local knowledge pack JSON does not match KnowledgePack shape.");
  const pack = sanitizeProjectLocalKnowledgePackForPersistence(parsed);
  if (pack.type !== "project_local") throw new Error(`Knowledge pack ${pack.id} must be project_local.`);
  return pack;
}

export function projectLocalKnowledgePackPathsFromProjectVibe(project: ProjectVibeDocument): string[] {
  const refs = [
    ...project.assets.flatMap((asset) => asset.sourceRefs),
    ...project.visualMemory.entries.flatMap((entry) => entry.sourceRefs),
    ...project.runs.flatMap((run) => run.evidenceRefs),
  ];
  return unique(refs.flatMap((ref) => {
    const match = /^knowledge_pack_path#(.+)$/.exec(ref.trim());
    if (!match) return [];
    try {
      return [normalizeProjectKnowledgePath(match[1])];
    } catch {
      return [];
    }
  }));
}

function projectLocalKnowledgeTargetId(projectId: string, target: ProjectLocalKnowledgeStorageTarget = {}): string {
  if (target.projectRoot && electronBridge()) {
    return `project-file:${normalizeProjectRootForDisplay(target.projectRoot)}/project-knowledge/${slug(projectId || "default")}`;
  }
  return `browser-local:${browserProjectLocalKnowledgeStorageKey(projectId, target)}`;
}

function browserProjectLocalKnowledgeStorageKey(projectId: string, target: ProjectLocalKnowledgeStorageTarget = {}): string {
  void target;
  return storageKey(projectId);
}

function browserProjectLocalKnowledgeFileKey(projectId: string, path: string, target: ProjectLocalKnowledgeStorageTarget = {}): string {
  void target;
  return `${projectLocalKnowledgeBrowserStoragePrefix}.${slug(projectId || "default")}:${normalizeProjectKnowledgePath(path)}`;
}

function electronProjectLocalKnowledgePath(projectRoot: string, path: string): string {
  const root = normalizeProjectRootForDisplay(projectRoot);
  if (!root || root.includes("\n") || root.includes("\r")) {
    throw new Error("Project root is required before saving project-local knowledge.");
  }
  return `${root}/${normalizeProjectKnowledgePath(path)}`;
}

function electronBridge(): ElectronBridge | undefined {
  if (typeof window === "undefined") return undefined;
  return window.vibeRuntime;
}

function browserStorage(): Pick<Storage, "getItem" | "setItem"> | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

function normalizeProjectRootForDisplay(projectRoot: string): string {
  return projectRoot.trim().replace(/\\/g, "/").replace(/\/+$/, "");
}

function upsertPack(packs: KnowledgePack[], pack: KnowledgePack): KnowledgePack[] {
  return Array.from(new Map([...packs, pack].map((item) => [item.id, item])).values());
}

export async function saveProjectLocalKnowledgePack(
  projectId: string,
  pack: KnowledgePack,
  target: ProjectLocalKnowledgeStorageTarget = {},
): Promise<ProjectLocalKnowledgeSaveResult> {
  const safePack = sanitizeProjectLocalKnowledgePackForPersistence(pack);
  const path = portableProjectLocalKnowledgePackPath(safePack);
  const serialized = serializeProjectLocalKnowledgePack(safePack);
  const targetId = projectLocalKnowledgeTargetId(projectId, target);
  const bridge = target.projectRoot ? electronBridge() : undefined;

  if (target.projectRoot && bridge) {
    try {
      await bridge.sandboxWriteFile(electronProjectLocalKnowledgePath(target.projectRoot, path), serialized);
      return { ok: true, mode: "electron_project_file", pack: safePack, path, hash: safePack.hash, targetId, errors: [] };
    } catch (error) {
      return {
        ok: false,
        mode: "electron_project_file",
        pack: safePack,
        path,
        hash: safePack.hash,
        targetId,
        errors: [error instanceof Error ? error.message : String(error)],
      };
    }
  }

  const nextPacks = upsertProjectLocalKnowledgePack(projectId, safePack, target);
  const storage = browserStorage();
  if (storage) storage.setItem(browserProjectLocalKnowledgeFileKey(projectId, path, target), serialized);
  void nextPacks;
  return { ok: true, mode: "browser_local", pack: safePack, path, hash: safePack.hash, targetId, errors: [] };
}

export async function openProjectLocalKnowledgePacks(
  projectId: string,
  target: ProjectLocalKnowledgeStorageTarget = {},
  project?: ProjectVibeDocument,
): Promise<ProjectLocalKnowledgeOpenResult> {
  const targetId = projectLocalKnowledgeTargetId(projectId, target);
  const paths = project ? projectLocalKnowledgePackPathsFromProjectVibe(project) : [];
  const bridge = target.projectRoot ? electronBridge() : undefined;
  const packs: KnowledgePack[] = [];
  const warnings: string[] = [];

  if (target.projectRoot && bridge) {
    for (const path of paths) {
      try {
        const result = await bridge.sandboxReadFile(electronProjectLocalKnowledgePath(target.projectRoot, path));
        packs.push(parseProjectLocalKnowledgePack(result.content));
      } catch (error) {
        warnings.push(`project_knowledge_pack_read_failed:${path}:${error instanceof Error ? error.message : String(error)}`);
      }
    }
    const localFallback = loadBrowserLocalProjectKnowledgePacks(projectId, target);
    const merged = Array.from(new Map([...packs, ...localFallback].map((pack) => [pack.id, pack])).values());
    return {
      ok: warnings.length === 0 || merged.length > 0,
      mode: "electron_project_file",
      packs: merged,
      paths,
      targetId,
      errors: [],
      warnings,
    };
  }

  const storage = browserStorage();
  for (const path of paths) {
    try {
      const serialized = storage?.getItem(browserProjectLocalKnowledgeFileKey(projectId, path, target));
      if (serialized) packs.push(parseProjectLocalKnowledgePack(serialized));
    } catch (error) {
      warnings.push(`browser_knowledge_pack_read_failed:${path}:${error instanceof Error ? error.message : String(error)}`);
    }
  }
  const merged = Array.from(new Map([...packs, ...loadBrowserLocalProjectKnowledgePacks(projectId, target)].map((pack) => [pack.id, pack])).values());
  return {
    ok: true,
    mode: "browser_local",
    packs: merged,
    paths,
    targetId,
    errors: [],
    warnings,
  };
}

export function loadBrowserLocalProjectKnowledgePacks(projectId: string, target: ProjectLocalKnowledgeStorageTarget = {}): KnowledgePack[] {
  const storage = browserStorage();
  if (!storage) return [];
  try {
    const parsed = JSON.parse(storage.getItem(browserProjectLocalKnowledgeStorageKey(projectId, target)) || "[]");
    return Array.isArray(parsed) ? parsed.filter(isKnowledgePack).map(sanitizeProjectLocalKnowledgePackForPersistence) : [];
  } catch {
    return [];
  }
}

export function saveBrowserLocalProjectKnowledgePacks(
  projectId: string,
  packs: KnowledgePack[],
  target: ProjectLocalKnowledgeStorageTarget = {},
): KnowledgePack[] {
  const uniquePacks = Array.from(new Map(packs.map((pack) => {
    const safePack = sanitizeProjectLocalKnowledgePackForPersistence(pack);
    return [safePack.id, safePack] as const;
  })).values());
  const storage = browserStorage();
  if (storage) {
    storage.setItem(browserProjectLocalKnowledgeStorageKey(projectId, target), JSON.stringify(uniquePacks));
  }
  return uniquePacks;
}

export function loadProjectLocalKnowledgePacks(projectId: string, target: ProjectLocalKnowledgeStorageTarget = {}): KnowledgePack[] {
  return loadBrowserLocalProjectKnowledgePacks(projectId, target);
}

export function saveProjectLocalKnowledgePacks(
  projectId: string,
  packs: KnowledgePack[],
  target: ProjectLocalKnowledgeStorageTarget = {},
): KnowledgePack[] {
  return saveBrowserLocalProjectKnowledgePacks(projectId, packs, target);
}

export function upsertProjectLocalKnowledgePack(
  projectId: string,
  pack: KnowledgePack,
  target: ProjectLocalKnowledgeStorageTarget = {},
): KnowledgePack[] {
  return saveProjectLocalKnowledgePacks(projectId, upsertPack(loadProjectLocalKnowledgePacks(projectId, target), pack), target);
}
