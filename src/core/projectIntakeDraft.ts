export const projectIntakeDraftSchemaVersion = "0.1.0";

export type IntakeReferenceAssetType = "image" | "audio" | "style" | "character" | "scene" | "prop";
export type IntakeReferenceBindingKind = "character" | "scene" | "prop" | "style" | "reference";

export interface IntakeReferenceBinding {
  kind?: IntakeReferenceBindingKind;
  role?: string;
  character?: string;
  scene?: string;
  prop?: string;
  style?: string;
  shotIds?: string[];
  scope?: string;
}

export interface IntakeReferenceAsset {
  id: string;
  type: IntakeReferenceAssetType;
  label: string;
  uri?: string;
  note?: string;
  binding?: IntakeReferenceBinding;
}

export interface ProjectIntakeDraft {
  schemaVersion: typeof projectIntakeDraftSchemaVersion;
  draftId: string;
  createdAt: string;
  status: "awaiting_confirmation";
  scriptText: string;
  referenceAssets: IntakeReferenceAsset[];
  styleNote: string;
}

export interface BuildProjectIntakeDraftInput {
  scriptText?: string;
  referenceAssets?: IntakeReferenceAsset[];
  styleNote?: string;
  createdAt?: string;
  draftId?: string;
}

export type IntakeMissingChecklistField =
  | "script_text"
  | "audio_reference"
  | "visual_reference"
  | "character_or_style_reference";

export interface IntakeMissingChecklistItem {
  field: IntakeMissingChecklistField;
  severity: "required" | "recommended";
  label: string;
  detail: string;
}

export interface IntakeStagedPlanStep {
  id: string;
  label: string;
  detail: string;
  status: "ready" | "needs_input";
}

export interface IntakeDraftSummary {
  title: string;
  scriptPreview: string;
  assetCounts: Record<IntakeReferenceAssetType, number>;
  styleNote: string;
  confirmationLabel: string;
}

export interface IntakeReferenceBindingSummary {
  assetId: string;
  label: string;
  type: IntakeReferenceAssetType;
  bindingLabel: string;
  scopeLabel: string;
  shotIds: string[];
}

export interface IntakeStagedPlanProjection {
  schemaVersion: typeof projectIntakeDraftSchemaVersion;
  draftId: string;
  status: "draft_pending_confirmation";
  summary: IntakeDraftSummary;
  referenceBindings: IntakeReferenceBindingSummary[];
  missingChecklist: IntakeMissingChecklistItem[];
  stagedPlan: IntakeStagedPlanStep[];
  guardrails: {
    formalTaskCreation: "blocked_until_user_confirmation";
    providerSubmission: "not_allowed_from_intake_draft";
  };
}

const deterministicTimestamp = "1970-01-01T00:00:00.000Z";

function clean(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function cleanMultiline(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function safeId(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5_-]+/gi, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48) || "intake";
}

function compactPreview(value: string, maxLength = 140): string {
  const normalized = clean(value);
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 3)}...`;
}

function titleFromScript(scriptText: string): string {
  const normalized = cleanMultiline(scriptText);
  const lines = normalized.split(/\n+/u).map(clean).filter(Boolean);
  const timecodeIndex = lines.findIndex((line) => /^\d{1,2}:\d{2}(?::\d{2})?\s*(?:-|–|—|~|至|到|-->)\s*\d{1,2}:\d{2}(?::\d{2})?/u.test(line));
  const firstLine = timecodeIndex >= 0
    ? clean(lines.slice(timecodeIndex + 1).find((line) => !/^\[[^\]]+\]$/u.test(line)) || "")
    : clean(lines.find((line) => !/^\[[^\]]+\]$/u.test(line) && !/^(?:five|four|three|two|one|go)[.!…\s]*$/iu.test(line)) || scriptText);
  const sentence = firstLine.split(/[。.!?！？]/u).map((part) => part.trim()).find(Boolean) || firstLine;
  return compactPreview(sentence, 28) || "未命名视频草案";
}

function normalizeAsset(asset: IntakeReferenceAsset, index: number): IntakeReferenceAsset {
  const type = asset.type;
  const label = clean(asset.label) || `${type} reference ${index + 1}`;
  const id = clean(asset.id) || `${type}_${safeId(label)}_${index + 1}`;
  const shotIds = Array.isArray(asset.binding?.shotIds)
    ? Array.from(new Set(asset.binding.shotIds.map(clean).filter(Boolean)))
    : [];
  const binding = asset.binding
    ? {
        ...(clean(asset.binding.kind) ? { kind: clean(asset.binding.kind) as IntakeReferenceBindingKind } : {}),
        ...(clean(asset.binding.role) ? { role: clean(asset.binding.role) } : {}),
        ...(clean(asset.binding.character) ? { character: clean(asset.binding.character) } : {}),
        ...(clean(asset.binding.scene) ? { scene: clean(asset.binding.scene) } : {}),
        ...(clean(asset.binding.prop) ? { prop: clean(asset.binding.prop) } : {}),
        ...(clean(asset.binding.style) ? { style: clean(asset.binding.style) } : {}),
        ...(shotIds.length ? { shotIds } : {}),
        ...(clean(asset.binding.scope) ? { scope: clean(asset.binding.scope) } : {}),
      }
    : undefined;
  return {
    id,
    type,
    label,
    ...(clean(asset.uri) ? { uri: clean(asset.uri) } : {}),
    ...(clean(asset.note) ? { note: clean(asset.note) } : {}),
    ...(binding && Object.keys(binding).length ? { binding } : {}),
  };
}

function countAssets(referenceAssets: IntakeReferenceAsset[]): Record<IntakeReferenceAssetType, number> {
  return {
    image: referenceAssets.filter((asset) => asset.type === "image").length,
    audio: referenceAssets.filter((asset) => asset.type === "audio").length,
    style: referenceAssets.filter((asset) => asset.type === "style").length,
    character: referenceAssets.filter((asset) => asset.type === "character").length,
    scene: referenceAssets.filter((asset) => asset.type === "scene").length,
    prop: referenceAssets.filter((asset) => asset.type === "prop").length,
  };
}

function hasAnyAsset(referenceAssets: IntakeReferenceAsset[], types: IntakeReferenceAssetType[]): boolean {
  return referenceAssets.some((asset) => types.includes(asset.type));
}

export function buildProjectIntakeDraft(input: BuildProjectIntakeDraftInput): ProjectIntakeDraft {
  const scriptText = cleanMultiline(input.scriptText);
  const styleNote = clean(input.styleNote);
  const referenceAssets = (input.referenceAssets || []).map(normalizeAsset);
  const createdAt = input.createdAt || deterministicTimestamp;
  const draftSeed = [scriptText, styleNote, referenceAssets.map((asset) => `${asset.type}:${asset.label}:${JSON.stringify(asset.binding || {})}`).join("|")]
    .filter(Boolean)
    .join("_");

  return {
    schemaVersion: projectIntakeDraftSchemaVersion,
    draftId: input.draftId || `intake_${safeId(draftSeed)}`,
    createdAt,
    status: "awaiting_confirmation",
    scriptText,
    referenceAssets,
    styleNote,
  };
}

function bindingTargetLabel(binding?: IntakeReferenceBinding): string {
  if (!binding) return "";
  return clean(binding.role)
    || clean(binding.character)
    || clean(binding.scene)
    || clean(binding.prop)
    || clean(binding.style);
}

function bindingKindLabel(asset: IntakeReferenceAsset): string {
  const binding = asset.binding;
  const kind = clean(binding?.kind) || (
    clean(binding?.role) || clean(binding?.character)
      ? "character"
      : clean(binding?.scene)
        ? "scene"
        : clean(binding?.prop)
          ? "prop"
          : clean(binding?.style)
            ? "style"
            : asset.type
  );
  if (kind === "character") return "角色";
  if (kind === "scene") return "场景";
  if (kind === "prop") return "道具";
  if (kind === "style") return "风格";
  if (asset.type === "audio") return "音频";
  return "参考图";
}

function bindingScopeLabel(binding?: IntakeReferenceBinding): string {
  const shotIds = binding?.shotIds || [];
  if (shotIds.length) return `镜头：${shotIds.join("、")}`;
  const scope = clean(binding?.scope);
  if (!scope) return "范围待确认";
  if (/^(project|global|all|all_shots)$/i.test(scope)) return "整片";
  if (/^(first|first_shot)$/i.test(scope)) return "第一个镜头";
  if (/^(last|last_shot|final)$/i.test(scope)) return "最后一个镜头";
  if (/^(none|asset_only)$/i.test(scope)) return "仅入候选资产";
  return `范围：${scope}`;
}

function referenceBindingSummaries(referenceAssets: IntakeReferenceAsset[]): IntakeReferenceBindingSummary[] {
  return referenceAssets
    .filter((asset) => asset.type !== "audio")
    .map((asset) => {
      const target = bindingTargetLabel(asset.binding);
      const kind = bindingKindLabel(asset);
      return {
        assetId: asset.id,
        label: asset.label,
        type: asset.type,
        bindingLabel: target ? `${kind}：${target}` : `${kind}用途待确认`,
        scopeLabel: bindingScopeLabel(asset.binding),
        shotIds: asset.binding?.shotIds || [],
      };
    });
}

export function buildIntakeStagedPlanProjection(draft: ProjectIntakeDraft): IntakeStagedPlanProjection {
  const assetCounts = countAssets(draft.referenceAssets);
  const hasScript = Boolean(draft.scriptText);
  const hasAudio = hasAnyAsset(draft.referenceAssets, ["audio"]);
  const hasVisualReference = hasAnyAsset(draft.referenceAssets, ["image", "scene"]);
  const hasCharacterOrStyleReference = hasAnyAsset(draft.referenceAssets, ["character", "style"]) || Boolean(draft.styleNote);
  const missingChecklist: IntakeMissingChecklistItem[] = [
    ...(!hasScript
      ? [{
          field: "script_text" as const,
          severity: "required" as const,
          label: "补充脚本",
          detail: "草案需要先有脚本文字，才能进入确认。",
        }]
      : []),
    ...(!hasAudio
      ? [{
          field: "audio_reference" as const,
          severity: "recommended" as const,
          label: "准备音频",
          detail: "音频可以现在放进来，也可以稍后确认。",
        }]
      : []),
    ...(!hasVisualReference
      ? [{
          field: "visual_reference" as const,
          severity: "recommended" as const,
          label: "添加画面参考",
          detail: "参考图或场景说明可以帮助锁住第一版画面方向。",
        }]
      : []),
    ...(!hasCharacterOrStyleReference
      ? [{
          field: "character_or_style_reference" as const,
          severity: "recommended" as const,
          label: "补主角或风格",
          detail: "主角、风格参考或风格一句话可以帮助后续保持一致。",
        }]
      : []),
  ];

  return {
    schemaVersion: projectIntakeDraftSchemaVersion,
    draftId: draft.draftId,
    status: "draft_pending_confirmation",
    summary: {
      title: titleFromScript(draft.scriptText),
      scriptPreview: compactPreview(draft.scriptText) || "还没有脚本。",
      assetCounts,
      styleNote: draft.styleNote || "还没有风格说明。",
      confirmationLabel: "查看草案",
    },
    referenceBindings: referenceBindingSummaries(draft.referenceAssets),
    missingChecklist,
    stagedPlan: [
      {
        id: "review_script",
        label: "复核脚本",
        detail: hasScript ? "脚本文字已进入草案。" : "脚本文字还缺失。",
        status: hasScript ? "ready" : "needs_input",
      },
      {
        id: "organize_references",
        label: "整理参考",
        detail: `已整理 ${draft.referenceAssets.length} 个参考素材。`,
        status: draft.referenceAssets.length ? "ready" : "needs_input",
      },
      {
        id: "confirm_visual_direction",
        label: "确认视觉方向",
        detail: hasCharacterOrStyleReference ? "主角或风格方向已进入草案。" : "主角或风格方向还需要补充。",
        status: hasCharacterOrStyleReference ? "ready" : "needs_input",
      },
      {
        id: "prepare_project_draft",
        label: "生成项目草案",
        detail: "确认后进入项目待处理内容。",
        status: hasScript ? "ready" : "needs_input",
      },
    ],
    guardrails: {
      formalTaskCreation: "blocked_until_user_confirmation",
      providerSubmission: "not_allowed_from_intake_draft",
    },
  };
}
