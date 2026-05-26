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
  selectedAssetId,
  onSelectAsset,
  onAddAsset,
  onUpdateAsset,
  onMarkAssetStatus,
  assetGenerationAction,
  onGenerateAssets,
  localProjectReady = true,
  voiceSourceLibrary,
  onLockVoiceSource,
}: {
  library: AssetLibrarySnapshot;
  readOnlyDetail?: string;
  selectedAssetId?: string;
  onSelectAsset: (id: string) => void;
  onAddAsset: (input: AddAssetLibraryAssetInput) => void;
  onUpdateAsset: (assetId: string, input: UpdateAssetLibraryAssetInput) => void;
  onMarkAssetStatus: (assetId: string, status: AssetLibraryUiStatus) => void | Promise<void>;
  assetGenerationAction?: Image2AssetGenerationActionView;
  onGenerateAssets?: () => void | Promise<void>;
  localProjectReady?: boolean;
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
  const blockers = assetLibraryUserBlockers(library);
  const blockerLabel = blockers.length
    ? "待复核"
    : "已锁定";
  const isReadOnly = Boolean(readOnlyDetail);
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
      return { useFor: "台词节奏和声音气质", ignoreFor: "不负责画面设计" };
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
        <button className="asset-reference-main" type="button" onClick={() => onSelectAsset(asset.id)}>
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
          <p>{asset.textConstraints[0] || "待补说明"}</p>
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
              >
                重新复核
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => { void onMarkAssetStatus(asset.id, "locked"); }}
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
    if (!missingParts.length) return "参考基本齐了。";
    return `缺：${missingParts.join("、")}。细节会写进镜头里。`;
  }

  function assetNextStepCopy() {
    if (reviewCounts.needsReview > 0) return `${reviewCounts.needsReview} 个参考等你看。`;
    if (reviewCounts.missing > 0) return `${reviewCounts.missing} 个参考待补。`;
    if (workspaceCounts.characters && workspaceCounts.scenes && reviewCounts.locked > 0) return "参考已准备好，可以回到故事页继续。";
    return "先放脚本和素材，AI 会整理参考。";
  }

  function generationStatusCopy(message?: string) {
    if (!message) {
      if (!localProjectReady) return "先创建本地项目";
      if (assetGenerationAction?.keyConfigured === false) return "先去设置里填 Key";
      if (assetGenerationAction?.disabled) return "正在准备参考";
      return "会补缺的参考，结果先给你看";
    }
    if (/key|lanyi/i.test(message)) return "先去设置里填 Key";
    if (/未选择项目|未同步|连接项目失败|项目文件已打开|请选择|先创建本地项目/i.test(message)) {
      return localProjectReady ? "正在连接项目" : "先创建本地项目";
    }
    return message;
  }

  return (
    <main className="asset-library-view">
      <div className="asset-library-heading">
        <div>
          <h2>参考素材</h2>
          <small>{readOnlyDetail || "角色、场景、道具和故事板分开管理。"}</small>
        </div>
        {onGenerateAssets && (
          <div className="asset-generation-action">
            <button
              disabled={assetGenerationAction?.disabled}
              onClick={() => { void onGenerateAssets(); }}
            >
              {assetGenerationAction?.status === "running" ? "补齐中" : "补齐参考"}
            </button>
            <small>
              {generationStatusCopy(assetGenerationAction?.message)}
            </small>
            <small className="asset-generation-plan">{assetGenerationPlanCopy()}</small>
          </div>
        )}
        {!isReadOnly && <details className="asset-library-add" aria-label="添加参考">
          <summary>手动添加</summary>
          <div className="asset-library-toolbar">
            <select value={draft.assetType} onChange={(event) => setDraft({ ...draft, assetType: event.target.value as AssetLibraryAssetType })}>
              <option value="character">角色参考</option>
              <option value="scene">场景/天气参考</option>
              <option value="prop">道具参考</option>
            </select>
            <input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="名称" />
            <button onClick={() => addDraft("locked")}>已锁定</button>
            <button onClick={() => addDraft("review")}>待复核</button>
            <details className="asset-library-advanced">
              <summary>高级</summary>
              <input value={draft.path} onChange={(event) => setDraft({ ...draft, path: event.target.value })} placeholder="手填路径（可选）" />
              <textarea value={draft.constraints} onChange={(event) => setDraft({ ...draft, constraints: event.target.value })} placeholder="补充说明（可选）" />
            </details>
          </div>
        </details>}
      </div>
      <div className="asset-status-strip" aria-label="参考状态">
        <span><i className="dot warn" /> 待复核</span>
        <span><i className="dot ok" /> 已锁定</span>
      </div>
      <div className="asset-blocker-strip" aria-label="参考提醒">
        <span title={blockerLabel}>{blockerLabel}</span>
      </div>
      <section className="asset-next-step-strip" aria-label="下一步">
        <span>下一步</span>
        <strong>{assetNextStepCopy()}</strong>
      </section>
      <section className="asset-workspace-strip" aria-label="工作区参考">
        <span>
          <small>角色参考</small>
          <strong>{workspaceCounts.characters || "待补"}</strong>
          <em>身份外观</em>
        </span>
        <span>
          <small>场景/天气参考</small>
          <strong>{workspaceCounts.scenes || "待补"}</strong>
          <em>空间光线</em>
        </span>
        <span>
          <small>道具参考</small>
          <strong>{workspaceCounts.props || "待补"}</strong>
          <em>形状交互</em>
        </span>
        <span>
          <small>故事板参考</small>
          <strong>{workspaceCounts.storyboards || "按需"}</strong>
          <em>构图动作</em>
        </span>
        <span>
          <small>音频参考</small>
          <strong>{workspaceCounts.audio || "可选"}</strong>
          <em>台词节奏</em>
        </span>
      </section>
      {readOnlyDetail && (
        <section className="asset-edit-surface" aria-label="当前项目资产状态">
          <div>
            <span>当前项目</span>
            <strong>资产待补齐</strong>
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
                onClick={() => { void onMarkAssetStatus(selectedAsset.id, status); }}
              >
                {assetLibraryStatusLabel(status)}
              </button>
            ))}
          </div>
          <details className="asset-library-advanced asset-library-selected-advanced">
            <summary>高级</summary>
            <textarea value={constraintDraft} onChange={(event) => setConstraintDraft(event.target.value)} aria-label="编辑补充说明" />
            <button onClick={updateSelectedConstraints}>更新说明</button>
          </details>
        </section>
      )}
      <section className="asset-library-section">
        <span className="asset-section-label">角色参考</span>
        <div className="asset-feature-grid characters">
          {groups.characters.map((asset) => renderAssetCard(asset))}
          {!groups.characters.length && <div className="minimal-empty-line">还没有角色参考</div>}
        </div>
      </section>
      <section className="asset-library-section">
        <span className="asset-section-label">场景/天气参考</span>
        <p className="minimal-empty-line">用于天气、空间、环境一致性。后续视频会继续使用。</p>
        <div className="asset-feature-grid scenes">
          {groups.scenes.map((asset) => renderAssetCard(asset, true))}
          {!groups.scenes.length && <div className="minimal-empty-line">还没有场景/天气参考</div>}
        </div>
      </section>
      <section className="asset-library-section compact">
        <span className="asset-section-label">道具参考</span>
        <p className="minimal-empty-line">道具尽量保持干净独立，别让它看起来像一个新镜头。</p>
        <div className="asset-feature-grid anchors">
          {groups.props.map((asset) => renderAssetCard(asset))}
          {!groups.props.length && <div className="minimal-empty-line">还没有道具参考</div>}
        </div>
      </section>
      {groups.storyboards.length > 0 && (
        <section className="asset-library-section compact">
          <span className="asset-section-label">故事板参考</span>
          <p className="minimal-empty-line">故事板管构图、动作和切镜；角色、场景、道具由锁定参考管。</p>
          <div className="asset-feature-grid anchors">
            {groups.storyboards.map((asset) => renderAssetCard(asset))}
          </div>
        </section>
      )}
      {groups.styles.length > 0 && (
        <section className="asset-library-section compact">
          <span className="asset-section-label">风格参考</span>
          <div className="asset-feature-grid anchors">
            {groups.styles.map((asset) => renderAssetCard(asset, true))}
          </div>
        </section>
      )}
      <section className="asset-library-section compact">
        <span className="asset-section-label">音频参考</span>
        <div className="asset-audio-list">
          {groups.audioAnchors.map((asset) => (
            <div key={asset.id} className={`asset-audio-row ${asset.status}`}>
              <span>
                <strong>{cleanLabel(asset.name)}</strong>
                <small>音频参考</small>
              </span>
              <p>{asset.textConstraints[0] || "待确认授权"}</p>
              <small>{assetLibraryStatusLabel(asset.status)} · {assetRoleCopy(asset).useFor}</small>
            </div>
          ))}
          {audioSources.map((source) => (
            <div key={source.id} className={`asset-audio-row ${source.status}`}>
              <span>
                <strong>{cleanLabel(source.displayName)}</strong>
                <small>音频参考</small>
              </span>
              <p>{source.textConstraints[0] || "待确认授权"}</p>
              <small>{voiceStatusLabel(source.status)} · 台词节奏和声音气质</small>
              {source.status !== "locked" && source.status !== "rejected" && onLockVoiceSource && (
                <button
                  type="button"
                  className="asset-audio-lock"
                  onClick={() => { void onLockVoiceSource(source.id); }}
                >
                  确认授权
                </button>
              )}
            </div>
          ))}
          {!workspaceCounts.audio && <div className="minimal-empty-line">还没有音频参考，需要配音或配乐时再拖进来。</div>}
        </div>
      </section>
    </main>
  );
}
