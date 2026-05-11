import { useEffect, useState } from "react";
import type {
  AddAssetLibraryAssetInput,
  AssetLibraryAsset,
  AssetLibraryAssetType,
  AssetLibrarySnapshot,
  AssetLibraryStatus,
  UpdateAssetLibraryAssetInput,
} from "../../core/assetLibraryCrud";
import { MediaFrame } from "../common/MediaFrame";
import type { AssetLibraryUiStatus } from "./directorTypes";
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
}: {
  library: AssetLibrarySnapshot;
  readOnlyDetail?: string;
  selectedAssetId?: string;
  onSelectAsset: (id: string) => void;
  onAddAsset: (input: AddAssetLibraryAssetInput) => void;
  onUpdateAsset: (assetId: string, input: UpdateAssetLibraryAssetInput) => void;
  onMarkAssetStatus: (assetId: string, status: AssetLibraryUiStatus) => void;
}) {
  const groups = {
    characters: library.assets.filter((asset) => asset.assetType === "character"),
    scenes: library.assets.filter((asset) => asset.assetType === "scene"),
    anchors: library.assets.filter((asset) => asset.assetType === "prop" || asset.assetType === "style" || asset.assetType === "voice_anchor"),
  };
  const selectedAsset = library.assets.find((asset) => asset.id === selectedAssetId);
  const blockers = assetLibraryUserBlockers(library);
  const blockerLabel = blockers.length
    ? `${blockers.length} 项待补参考`
    : "参考已就绪";
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

  function addDraft(status: AssetLibraryStatus) {
    const name = draft.name.trim() || `${assetLibraryTypeLabel(draft.assetType)}参考`;
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
    return (
      <button
        key={asset.id}
        className={`asset-reference-card ${wide ? "wide" : ""} ${selectedAssetId === asset.id ? "selected" : ""}`}
        onClick={() => onSelectAsset(asset.id)}
      >
        <MediaFrame src={record.path} alt={asset.name} label={cleanLabel(asset.name)} className="asset-reference-image" />
        <span>
          <strong>{cleanLabel(asset.name)}</strong>
          <small><i className={`dot ${assetStatusTone(record)}`} /> {assetLibraryStatusLabel(asset.status)}</small>
        </span>
        <p>{asset.textConstraints[0] || "缺文本约束"}</p>
      </button>
    );
  }

  return (
    <main className="asset-library-view">
      <div className="asset-library-heading">
        <div>
          <h2>审核并锁定资产</h2>
          <small>{readOnlyDetail || "角色主参考、场景 master、风格锚图"}</small>
        </div>
        {!isReadOnly && <details className="asset-library-add" aria-label="添加资产">
          <summary>添加资产</summary>
          <div className="asset-library-toolbar">
            <select value={draft.assetType} onChange={(event) => setDraft({ ...draft, assetType: event.target.value as AssetLibraryAssetType })}>
              <option value="character">角色主参考</option>
              <option value="scene">场景 master</option>
              <option value="style">风格文本/锚图</option>
              <option value="prop">道具</option>
            </select>
            <input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="名称" />
            <input value={draft.path} onChange={(event) => setDraft({ ...draft, path: event.target.value })} placeholder="参考路径或留空" />
            <textarea value={draft.constraints} onChange={(event) => setDraft({ ...draft, constraints: event.target.value })} placeholder="文本约束" />
            <button onClick={() => addDraft("locked")}>锁定</button>
            <button onClick={() => addDraft("candidate")}>候选</button>
          </div>
        </details>}
      </div>
      <div className="asset-status-strip" aria-label="Asset consistency">
        <span><i className="dot ok" /> locked</span>
        <span><i className="dot warn" /> candidate</span>
        <span><i className="dot warn" /> review</span>
        <span><i className="dot bad" /> rejected</span>
      </div>
      <div className="asset-blocker-strip" aria-label="资产阻断">
        <span title={blockers.join(" · ") || blockerLabel}>{blockerLabel}</span>
      </div>
      {readOnlyDetail && (
        <section className="asset-edit-surface" aria-label="当前项目资产状态">
          <div>
            <span>当前项目</span>
            <strong>资产待补齐</strong>
            <small>只读投影</small>
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
            {(["locked", "candidate", "needs_review", "rejected"] as const).map((status) => (
              <button
                key={status}
                className={assetLibraryStatusToUiStatus(selectedAsset.status) === status ? "active" : ""}
                onClick={() => onMarkAssetStatus(selectedAsset.id, status)}
              >
                {assetLibraryStatusLabel(status)}
              </button>
            ))}
          </div>
          <textarea value={constraintDraft} onChange={(event) => setConstraintDraft(event.target.value)} aria-label="编辑文本约束" />
          <button onClick={updateSelectedConstraints}>更新约束</button>
        </section>
      )}
      <section className="asset-library-section">
        <span className="asset-section-label">角色参考</span>
        <div className="asset-feature-grid characters">
          {groups.characters.map((asset) => renderAssetCard(asset))}
          {!groups.characters.length && <div className="minimal-empty-line">还没有角色主参考</div>}
        </div>
      </section>
      <section className="asset-library-section">
        <span className="asset-section-label">场景 master</span>
        <div className="asset-feature-grid scenes">
          {groups.scenes.map((asset) => renderAssetCard(asset, true))}
          {!groups.scenes.length && <div className="minimal-empty-line">还没有场景 master</div>}
        </div>
      </section>
      <section className="asset-library-section compact">
        <span className="asset-section-label">道具 / 风格</span>
        <div className="asset-feature-grid anchors">
          {groups.anchors.map((asset) => renderAssetCard(asset, asset.assetType === "style"))}
          {!groups.anchors.length && <div className="minimal-empty-line">还没有道具或风格参考</div>}
        </div>
      </section>
    </main>
  );
}
