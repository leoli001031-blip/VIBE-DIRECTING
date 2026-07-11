import { useEffect, useState } from "react";
import type {
  AddAssetLibraryAssetInput,
  AssetLibraryAsset,
  AssetLibraryAssetType,
  AssetLibrarySnapshot,
  AssetLibraryStatus,
  UpdateAssetLibraryAssetInput,
} from "../../core/assetLibraryCrud";
import type { VoiceSourceLibraryState, VoiceSourceStatus } from "../../core/voiceSourceLibrary";
import { MediaFrame } from "../common/MediaFrame";
import type { AssetLibraryUiStatus } from "./directorTypes";
import type { Image2AssetGenerationActionView } from "./useImage2AssetGenerationAction";
import {
  assetLibraryAssetToRecord,
  assetLibraryStatusLabel,
  assetLibraryStatusToUiStatus,
  assetLibraryTypeLabel,
  assetLibraryUserBlockers,
  assetSourceKindForPath,
  assetStatusTone,
  cleanLabel,
  defaultAssetConstraints,
  pathOriginForUi,
  safeAssetId,
  splitConstraints,
} from "./assetLibraryUi";

export function MinimalAssetLibrary({
  library,
  readOnlyDetail,
  referenceGapCount = 0,
  selectedAssetId,
  onSelectAsset,
  onAddAsset,
  onUpdateAsset,
  onMarkAssetStatus,
  onMarkAllReviewAssetsLocked,
  assetGenerationAction,
  onGenerateAssets,
  localProjectReady = true,
  pendingConfirmationLabel,
  voiceSourceLibrary,
  onLockVoiceSource,
}: {
  library: AssetLibrarySnapshot;
  readOnlyDetail?: string;
  referenceGapCount?: number;
  selectedAssetId?: string;
  onSelectAsset: (id: string) => void;
  onAddAsset: (input: AddAssetLibraryAssetInput) => void;
  onUpdateAsset: (assetId: string, input: UpdateAssetLibraryAssetInput) => void;
  onMarkAssetStatus: (assetId: string, status: AssetLibraryUiStatus) => void | Promise<void>;
  onMarkAllReviewAssetsLocked?: (assetIds: string[]) => void | Promise<void>;
  assetGenerationAction?: Image2AssetGenerationActionView;
  onGenerateAssets?: () => unknown | Promise<unknown>;
  localProjectReady?: boolean;
  pendingConfirmationLabel?: string;
  voiceSourceLibrary?: VoiceSourceLibraryState;
  onLockVoiceSource?: (sourceId: string) => void | Promise<void>;
}) {
  function isStoryboardReference(asset: AssetLibraryAsset) {
    const searchable = [
      asset.id,
      asset.name,
      asset.mainReferencePath,
      asset.sourcePath?.path,
      asset.referenceAuthority.path,
      ...asset.textConstraints,
    ].filter(Boolean).join(" ").toLowerCase();
    return /storyboard|分镜/.test(searchable);
  }

  const groups = {
    characters: library.assets.filter((asset) => asset.assetType === "character"),
    scenes: library.assets.filter((asset) => asset.assetType === "scene"),
    props: library.assets.filter((asset) => asset.assetType === "prop" && !isStoryboardReference(asset)),
    storyboards: library.assets.filter(isStoryboardReference),
    styles: library.assets.filter((asset) => asset.assetType === "style"),
    audioAnchors: library.assets.filter((asset) => asset.assetType === "voice_anchor"),
  };
  const selectedAsset = library.assets.find((asset) => asset.id === selectedAssetId);
  const visualPreviewAssets = library.assets.filter((asset) => {
    const record = assetLibraryAssetToRecord(asset);
    return Boolean(record.path) && asset.assetType !== "style" && asset.assetType !== "voice_anchor";
  });
  const audioSources = (voiceSourceLibrary?.sources || []).filter((source) => {
    const searchable = [source.id, source.displayName].join(" ").toLowerCase();
    return !/voice[-_\s]*registry[-_\s]*placeholder|placeholder/.test(searchable);
  });
  const workspaceCounts = {
    characters: groups.characters.length,
    scenes: groups.scenes.length,
    props: groups.props.length,
    storyboards: groups.storyboards.length,
    audio: audioSources.length + groups.audioAnchors.length,
  };
  const reviewCounts = {
    locked: library.assets.filter((asset) => asset.status === "locked").length,
    needsReview: library.assets.filter((asset) => asset.status === "review" || asset.status === "candidate").length,
    missing: library.assets.filter((asset) => asset.status === "missing").length,
  };
  const visibleReferenceMissingCount = Math.max(reviewCounts.missing, Math.round(referenceGapCount));
  const reviewableAssets = library.assets.filter((asset) => asset.status === "review" || asset.status === "candidate");
  const blockers = assetLibraryUserBlockers(library);
  const blockerLabel = blockers.length
    ? "待复核"
    : "已锁定";
  const reviewBoundaryCopy = reviewCounts.needsReview > 0
    ? localProjectReady
      ? `${reviewCounts.needsReview} 个素材等你确认；确认后才进入故事参考库。`
      : `${reviewCounts.needsReview} 个素材等你确认；先选择保存位置，确认后才进入故事参考库。`
    : localProjectReady
      ? "新素材会先分类，等你确认后才进入故事参考库。"
      : "新素材会先分类；选择保存位置后再进入故事参考库。";
  const localDetailBoundaryCopy = "手、眼神、车灯会跟随对应角色、场景或道具说明，不会单独变成新参考项。";
  const isReadOnly = Boolean(readOnlyDetail);
  const generationBlockedByAgentConfirmation = Boolean(pendingConfirmationLabel);
  const reviewActionBlockedBySaveLocation = !localProjectReady;
  const [draft, setDraft] = useState<{ assetType: AssetLibraryAssetType; name: string; path: string; constraints: string }>({
    assetType: "character",
    name: "",
    path: "",
    constraints: "",
  });
  const [constraintDraft, setConstraintDraft] = useState("");

  useEffect(() => {
    setConstraintDraft(selectedAsset?.textConstraints.join("\n") || "");
  }, [selectedAsset?.id, selectedAsset?.textConstraints]);

  function assetRoleCopy(asset: AssetLibraryAsset) {
    const assetType = asset.assetType;
    if (isStoryboardReference(asset)) {
      return { useFor: "构图、动作、切镜节奏", ignoreFor: "不替代角色和场景设定" };
    }
    if (assetType === "character") {
      return { useFor: "身份、发型、服装轮廓", ignoreFor: "不负责场景和构图" };
    }
    if (assetType === "scene") {
      return { useFor: "空间、天气、光线", ignoreFor: "不负责角色身份" };
    }
    if (assetType === "prop") {
      return { useFor: "物体外观、尺度、交互方式", ignoreFor: "不负责人物、背景和切镜" };
    }
    if (assetType === "voice_anchor") {
      return { useFor: "角色声线、语气和对白质感", ignoreFor: "不负责画面设计" };
    }
    return { useFor: "光感、色调、画面密度", ignoreFor: "不替代主体设定" };
  }

  function addDraft(status: AssetLibraryStatus) {
    const name = draft.name.trim() || assetLibraryTypeLabel(draft.assetType);
    const id = safeAssetId(name, draft.assetType);
    const path = draft.path.trim();
    const textConstraints = splitConstraints(draft.constraints || defaultAssetConstraints(draft.assetType, name).join("\n"));
    onAddAsset({
      id,
      assetType: draft.assetType,
      name,
      status,
      sourceKind: assetSourceKindForPath(path) === "source_asset" && !path ? "manual_definition" : assetSourceKindForPath(path),
      path: path || undefined,
      pathOrigin: pathOriginForUi(path),
      importId: id,
      textConstraints,
      sourceRefs: ["ui.asset_library"],
      usedByShotIds: [],
      updatedAt: new Date().toISOString(),
    });
    setDraft({ ...draft, name: "", path: "", constraints: "" });
  }

  function updateSelectedConstraints() {
    if (!selectedAsset) return;
    onUpdateAsset(selectedAsset.id, {
      textConstraints: splitConstraints(constraintDraft),
      updatedAt: new Date().toISOString(),
    });
  }

  function renderAssetCard(asset: AssetLibraryAsset, wide = false) {
    const record = assetLibraryAssetToRecord(asset);
    const roleCopy = assetRoleCopy(asset);
    const uiStatus = assetLibraryStatusToUiStatus(asset.status);
    return (
      <article
        key={asset.id}
        className={`asset-reference-card ${wide ? "wide" : ""} ${selectedAssetId === asset.id ? "selected" : ""}`}
      >
        <button
          className="asset-reference-main"
          type="button"
          onClick={() => onSelectAsset(asset.id)}
          aria-label={`选择参考素材 ${cleanLabel(asset.name)} · ${assetLibraryStatusLabel(asset.status)}`}
        >
          <MediaFrame src={record.path} alt={asset.name} label={cleanLabel(asset.name)} className="asset-reference-image" />
          <span>
            <strong>{cleanLabel(asset.name)}</strong>
            <small><i className={`dot ${assetStatusTone(record)}`} /> {assetLibraryStatusLabel(asset.status)}</small>
          </span>
          <dl className="asset-authority-grid" aria-label="参考职责">
            <div>
              <dt>用于</dt>
              <dd>{roleCopy.useFor}</dd>
            </div>
            <div>
              <dt>不用于</dt>
              <dd>{roleCopy.ignoreFor}</dd>
            </div>
          </dl>
          <p>{asset.textConstraints[0] || "说明待完善"}</p>
        </button>
        {!isReadOnly && (
          <div className="asset-card-review-actions" aria-label={`${cleanLabel(asset.name)} 复核操作`}>
            {uiStatus === "locked" ? (
              <button
                type="button"
                onClick={() => {
                  onSelectAsset(asset.id);
                  void onMarkAssetStatus(asset.id, "needs_review");
                }}
                aria-label={`${cleanLabel(asset.name)}：重新复核`}
              >
                重新复核
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => { void onMarkAssetStatus(asset.id, "locked"); }}
                  aria-label={`${cleanLabel(asset.name)}：通过并锁定`}
                >
                  通过并锁定
                </button>
                <button
                  type="button"
                  className="active"
                  onClick={() => {
                    onSelectAsset(asset.id);
                    void onMarkAssetStatus(asset.id, "needs_review");
                  }}
                  aria-label={`${cleanLabel(asset.name)}：保留待复核`}
                >
                  保留待复核
                </button>
              </>
            )}
          </div>
        )}
      </article>
    );
  }

  function voiceStatusLabel(status: VoiceSourceStatus) {
    if (status === "locked") return "已锁定";
    if (status === "rejected") return "已拒绝";
    return "待确认授权";
  }

  function assetGenerationPlanCopy() {
    const missingParts = [
      !workspaceCounts.characters ? "角色" : "",
      !workspaceCounts.scenes ? "场景/天气" : "",
      !workspaceCounts.props ? "独立道具" : "",
    ].filter(Boolean);
    if (!missingParts.length) return "参考已齐；故事板只在需要的镜头生成。";
    return `还缺 ${missingParts.join("、")}；AI 导演会按镜头判断是否需要故事板。`;
  }

  function assetNextStepCopy() {
    if (!localProjectReady && reviewCounts.needsReview > 0) {
      return pendingConfirmationLabel
        ? `先处理右侧「${pendingConfirmationLabel}」，再确认这些参考。`
        : "先选择保存位置，再确认这些参考。";
    }
    if (!localProjectReady && visibleReferenceMissingCount > 0) {
      return pendingConfirmationLabel
        ? `先处理右侧「${pendingConfirmationLabel}」，再让 AI 继续补参考。`
        : "先选择保存位置，再让 AI 继续补参考。";
    }
    if (reviewCounts.needsReview > 0) return "有参考等你看，先确认能不能继续使用。";
    if (visibleReferenceMissingCount > 0 && pendingConfirmationLabel) return `当前故事还缺 ${visibleReferenceMissingCount} 张参考；先处理右侧确认，或继续说明怎么改。`;
    if (visibleReferenceMissingCount > 0) return "有参考还没准备好，在消息里让 AI 继续处理。";
    if (workspaceCounts.characters && workspaceCounts.scenes && reviewCounts.locked > 0) return "参考已准备好，可以回到故事页继续。";
    return "先放脚本和素材，AI 会先分类，采用前等你确认。";
  }

  function generationStatusCopy(message?: string) {
    if (generationBlockedByAgentConfirmation) {
      return `先处理右侧消息里的「${pendingConfirmationLabel}」，确认前不会生成参考。`;
    }
    if (assetGenerationAction?.status === "running") {
      return message || "正在生成参考，完成后会在下方待复核。通常需要几十秒到几分钟。";
    }
    if (!message) {
      if (!localProjectReady) return "先选择保存位置";
      if (assetGenerationAction?.keyConfigured === false) return "先去设置里连接图片服务";
      if (assetGenerationAction?.disabled) return "正在准备参考";
      if (workspaceCounts.characters && workspaceCounts.scenes && workspaceCounts.props) return "参考已齐，需要重做时再点。";
      return "推荐直接在右侧输入框说需求；需要手动操作时再展开这里。";
    }
    if (/key|api/i.test(message)) return "先去设置里连接图片服务";
    if (/未选择项目|未同步|连接项目失败|项目文件已打开|请选择|先创建本地项目/i.test(message)) {
      return localProjectReady ? "正在连接保存位置" : "先选择保存位置";
    }
    return message;
  }

  function generationStatusTitle() {
    if (generationBlockedByAgentConfirmation) return "先处理确认";
    if (assetGenerationAction?.status === "running") return "正在生成";
    if (assetGenerationAction?.status === "blocked") return "生成失败";
    if (assetGenerationAction?.status === "needs_review") return "等你复核";
    if (assetGenerationAction?.status === "verified") return "参考已齐";
    if (!localProjectReady) return "先选保存位置";
    if (assetGenerationAction?.keyConfigured === false) return "待连接";
    if (workspaceCounts.characters && workspaceCounts.scenes && workspaceCounts.props) return "参考已齐";
    return "可生成";
  }

  return (
    <main className="asset-library-view">
      <div className="asset-library-heading">
        <div>
          <h2>参考素材</h2>
          <small>{readOnlyDetail || "角色、场景、道具和故事板分开管理。"}</small>
        </div>
        {onGenerateAssets && (
          <div
            className={`asset-generation-action ${assetGenerationAction?.status || "idle"}`}
            aria-live="polite"
          >
            <strong className="asset-generation-status">{generationStatusTitle()}</strong>
            <small>
              {generationStatusCopy(assetGenerationAction?.message)}
            </small>
            <small className="asset-generation-plan">{assetGenerationPlanCopy()}</small>
            {localProjectReady && assetGenerationAction?.status !== "running" && (
              <details className="asset-generation-manual">
                <summary>高级操作</summary>
                <button
                  disabled={assetGenerationAction?.disabled || generationBlockedByAgentConfirmation}
                  onClick={() => { void onGenerateAssets(); }}
                  aria-label="手动生成缺少的参考图和故事板"
                >
                  生成缺少的参考
                </button>
                <small>日常建议直接在右侧输入框告诉 AI 导演要做什么。</small>
              </details>
            )}
          </div>
        )}
        {!isReadOnly && localProjectReady && <details className="asset-library-add" aria-label="更多参考操作">
          <summary>更多</summary>
          <div className="asset-library-toolbar">
            <select value={draft.assetType} onChange={(event) => setDraft({ ...draft, assetType: event.target.value as AssetLibraryAssetType })}>
              <option value="character">角色参考</option>
              <option value="scene">场景/天气参考</option>
              <option value="prop">道具参考</option>
            </select>
            <input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="名称" />
            <button onClick={() => addDraft("locked")} aria-label="手动添加已锁定参考">已锁定</button>
            <button onClick={() => addDraft("review")} aria-label="手动添加待复核参考">待复核</button>
            <details className="asset-library-advanced">
              <summary>高级</summary>
              <input value={draft.path} onChange={(event) => setDraft({ ...draft, path: event.target.value })} placeholder="手填路径（可选）" />
              <textarea value={draft.constraints} onChange={(event) => setDraft({ ...draft, constraints: event.target.value })} placeholder="补充说明（可选）" />
            </details>
          </div>
        </details>}
      </div>
      {visualPreviewAssets.length > 0 && (
        <section className="asset-generated-gallery" aria-label="已生成参考图">
          <div className="asset-generated-gallery-heading">
            <span>生成结果</span>
            <strong>{visualPreviewAssets.length} 张参考图</strong>
            <small>角色、场景和道具都先在这里复核。</small>
          </div>
          <div className="asset-generated-gallery-grid">
            {visualPreviewAssets.map((asset) => {
              const record = assetLibraryAssetToRecord(asset);
              return (
                <button
                  key={asset.id}
                  className={`asset-generated-preview ${selectedAssetId === asset.id ? "selected" : ""}`}
                  type="button"
                  onClick={() => onSelectAsset(asset.id)}
                  aria-label={`查看生成参考图 ${cleanLabel(asset.name)}`}
                >
                  <MediaFrame
                    src={record.path}
                    alt={asset.name}
                    label={cleanLabel(asset.name)}
                    className="asset-generated-preview-image"
                  />
                  <span>
                    <strong>{cleanLabel(asset.name)}</strong>
                    <small>{assetLibraryTypeLabel(asset.assetType)} · {assetLibraryStatusLabel(asset.status)}</small>
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}
      <div className="asset-status-strip" aria-label="参考状态">
        <span><i className="dot warn" /> 等你确认 {reviewCounts.needsReview} 个</span>
        <span><i className="dot ok" /> 已锁定 {reviewCounts.locked} 个</span>
        <span><i className="dot bad" /> 缺参考 {visibleReferenceMissingCount} 张</span>
      </div>
      <section className="asset-review-boundary" aria-label="素材确认边界">
        <span>素材确认边界</span>
        <strong>{reviewBoundaryCopy}</strong>
        <small>{localDetailBoundaryCopy}</small>
      </section>
      <div className="asset-blocker-strip" aria-label="参考提醒">
        <span title={blockerLabel}>{blockerLabel}</span>
      </div>
      <section className="asset-next-step-strip" aria-label="下一步">
        <div>
          <span>下一步</span>
          <strong>{assetNextStepCopy()}</strong>
        </div>
        {!isReadOnly && reviewableAssets.length > 0 && onMarkAllReviewAssetsLocked && (
          <button
            type="button"
            className="asset-review-all-button"
            disabled={reviewActionBlockedBySaveLocation}
            title={reviewActionBlockedBySaveLocation ? "先在右侧选择保存位置，再锁定参考。" : undefined}
            onClick={() => { void onMarkAllReviewAssetsLocked(reviewableAssets.map((asset) => asset.id)); }}
            aria-label={reviewActionBlockedBySaveLocation
              ? `先选择保存位置，再锁定 ${reviewableAssets.length} 个待复核参考`
              : `全部通过并锁定 ${reviewableAssets.length} 个待复核参考`}
          >
            {reviewActionBlockedBySaveLocation ? "先选保存位置" : "全部通过"}
          </button>
        )}
      </section>
      <section className="asset-workspace-strip" aria-label="工作区参考">
        <span>
          <small>角色参考</small>
          <strong>{workspaceCounts.characters || "未放"}</strong>
          <em>身份外观</em>
        </span>
        <span>
          <small>场景/天气参考</small>
          <strong>{workspaceCounts.scenes || "未放"}</strong>
          <em>空间光线</em>
        </span>
        <span>
          <small>道具参考</small>
          <strong>{workspaceCounts.props || "未放"}</strong>
          <em>形状交互</em>
        </span>
        <span>
          <small>故事板参考</small>
          <strong>{workspaceCounts.storyboards || "按镜头"}</strong>
          <em>需要时生成</em>
        </span>
        <span>
          <small>声音参考</small>
          <strong>{workspaceCounts.audio || "可选"}</strong>
          <em>角色声线</em>
        </span>
      </section>
      {readOnlyDetail && (
        <section className="asset-edit-surface" aria-label="当前项目资产状态">
          <div>
            <span>当前项目</span>
            <strong>资产缺参考</strong>
            <small>等待生成或确认</small>
          </div>
          <small>{readOnlyDetail}</small>
        </section>
      )}
      {!isReadOnly && selectedAsset && (
        <section className="asset-edit-surface" aria-label="资产编辑">
          <div>
            <span>已选择</span>
            <strong>{cleanLabel(selectedAsset.name)}</strong>
            <small>{assetLibraryStatusLabel(selectedAsset.status)}</small>
          </div>
          <div className="asset-status-actions">
            {(["locked", "needs_review"] as const).map((status) => (
              <button
                key={status}
                className={assetLibraryStatusToUiStatus(selectedAsset.status) === status ? "active" : ""}
                disabled={reviewActionBlockedBySaveLocation}
                title={reviewActionBlockedBySaveLocation ? "先在右侧选择保存位置，再修改参考状态。" : undefined}
                onClick={() => { void onMarkAssetStatus(selectedAsset.id, status); }}
                aria-label={reviewActionBlockedBySaveLocation
                  ? `${cleanLabel(selectedAsset.name)}：先选择保存位置，再标记为${assetLibraryStatusLabel(status)}`
                  : `${cleanLabel(selectedAsset.name)}：标记为${assetLibraryStatusLabel(status)}`}
              >
                {assetLibraryStatusLabel(status)}
              </button>
            ))}
          </div>
          {reviewActionBlockedBySaveLocation && <small className="muted-copy">先选择保存位置，再锁定或修改参考。</small>}
          <details className="asset-library-advanced asset-library-selected-advanced">
            <summary>高级</summary>
            <textarea
              value={constraintDraft}
              disabled={reviewActionBlockedBySaveLocation}
              onChange={(event) => setConstraintDraft(event.target.value)}
              aria-label="编辑补充说明"
            />
            <button
              disabled={reviewActionBlockedBySaveLocation}
              onClick={updateSelectedConstraints}
              aria-label={`${cleanLabel(selectedAsset.name)}：更新补充说明`}
            >
              更新说明
            </button>
          </details>
        </section>
      )}
      <details className="asset-library-section">
        <summary>
          <span className="asset-section-label">角色参考</span>
          <small>{workspaceCounts.characters || 0} 个 · 身份外观</small>
        </summary>
        <div className="asset-feature-grid characters">
          {groups.characters.map((asset) => renderAssetCard(asset))}
          {!groups.characters.length && <div className="minimal-empty-line">还没有角色参考</div>}
        </div>
      </details>
      <details className="asset-library-section">
        <summary>
          <span className="asset-section-label">场景/天气参考</span>
          <small>{workspaceCounts.scenes || 0} 个 · 空间光线</small>
        </summary>
        <p className="minimal-empty-line">用于天气、空间、环境一致性。后续视频会继续使用。</p>
        <div className="asset-feature-grid scenes">
          {groups.scenes.map((asset) => renderAssetCard(asset, true))}
          {!groups.scenes.length && <div className="minimal-empty-line">还没有场景/天气参考</div>}
        </div>
      </details>
      <details className="asset-library-section compact">
        <summary>
          <span className="asset-section-label">道具参考</span>
          <small>{workspaceCounts.props || 0} 个 · 形状交互</small>
        </summary>
        <p className="minimal-empty-line">道具尽量保持干净独立，别让它看起来像一个新镜头。</p>
        <div className="asset-feature-grid anchors">
          {groups.props.map((asset) => renderAssetCard(asset))}
          {!groups.props.length && <div className="minimal-empty-line">还没有道具参考</div>}
        </div>
      </details>
      {groups.storyboards.length > 0 && (
        <details className="asset-library-section compact">
          <summary>
            <span className="asset-section-label">故事板参考</span>
            <small>{workspaceCounts.storyboards || 0} 个 · 构图动作</small>
          </summary>
          <p className="minimal-empty-line">故事板管构图、动作和切镜；角色、场景、道具由锁定参考管。</p>
          <div className="asset-feature-grid anchors">
            {groups.storyboards.map((asset) => renderAssetCard(asset))}
          </div>
        </details>
      )}
      {groups.styles.length > 0 && (
        <details className="asset-library-section compact">
          <summary>
            <span className="asset-section-label">风格参考</span>
            <small>{groups.styles.length} 个 · 画面质感</small>
          </summary>
          <div className="asset-feature-grid anchors">
            {groups.styles.map((asset) => renderAssetCard(asset, true))}
          </div>
        </details>
      )}
      <details className="asset-library-section compact">
        <summary>
          <span className="asset-section-label">声音参考</span>
          <small>{workspaceCounts.audio || 0} 个 · 角色声线</small>
        </summary>
        <div className="asset-audio-list">
          {groups.audioAnchors.map((asset) => (
            <div key={asset.id} className={`asset-audio-row ${asset.status}`}>
              <span>
                <strong>{cleanLabel(asset.name)}</strong>
                <small>声音参考</small>
              </span>
              <p>{asset.textConstraints[0] || "待确认授权"}</p>
              <small>{assetLibraryStatusLabel(asset.status)} · {assetRoleCopy(asset).useFor}</small>
            </div>
          ))}
          {audioSources.map((source) => (
            <div key={source.id} className={`asset-audio-row ${source.status}`}>
              <span>
                <strong>{cleanLabel(source.displayName)}</strong>
                <small>声音参考</small>
              </span>
              <p>{source.textConstraints[0] || "待确认授权"}</p>
              <small>{voiceStatusLabel(source.status)} · 角色声线、语气和说话质感</small>
              {source.status !== "locked" && source.status !== "rejected" && onLockVoiceSource && (
                <button
                  type="button"
                  className="asset-audio-lock"
                  onClick={() => { void onLockVoiceSource(source.id); }}
                  aria-label={`${cleanLabel(source.displayName)}：确认声音参考授权`}
                >
                  锁定声音参考
                </button>
              )}
            </div>
          ))}
          {!workspaceCounts.audio && <div className="minimal-empty-line">还没有声音参考；需要锁角色声线时再拖进来。</div>}
        </div>
      </details>
    </main>
  );
}
