import { Boxes } from "lucide-react";
import type { AssetRecord, ProjectAudit } from "../../core/types";
import type { RuntimeView } from "../../core/runtimeView";

export function groupAssets(assets: AssetRecord[]) {
  return {
    Characters: assets.filter((asset) => asset.type === "character"),
    Scenes: assets.filter((asset) => asset.type === "scene"),
    Props: assets.filter((asset) => asset.type === "prop"),
    Style: assets.filter((asset) => asset.type === "style"),
    Other: assets.filter((asset) => !["character", "scene", "prop", "style"].includes(asset.type)),
  };
}

export function VisualMemoryPanel({
  audit,
  view,
  selectedAsset,
  onSelectAsset,
}: {
  audit: ProjectAudit;
  view: RuntimeView;
  selectedAsset?: string;
  onSelectAsset: (id: string) => void;
}) {
  const groups = groupAssets(audit.assets);
  return (
    <aside className="asset-panel">
      <div className="panel-title">
        <Boxes size={17} />
        <span>Visual Memory</span>
      </div>
      <div className="memory-summary">
        <strong>{view.visualMemory.existing}/{view.visualMemory.total || audit.metrics.expectedAssets}</strong>
        <span>assets present</span>
        <small>{view.visualMemory.needsReview} need review · {view.visualMemory.missing} missing</small>
      </div>
      {Object.entries(groups).filter(([, items]) => items.length).map(([group, items]) => (
        <section key={group} className="asset-group">
          <h3>{group}</h3>
          <div className="asset-list">
            {items.map((asset) => (
              <button
                key={asset.id}
                className={`asset-row ${selectedAsset === asset.id ? "selected" : ""}`}
                onClick={() => onSelectAsset(asset.id)}
              >
                <span className="asset-name">{asset.name}</span>
                <span className={`dot ${asset.status === "missing" ? "bad" : asset.issues.length ? "warn" : "ok"}`} />
                <small>{asset.lockedStatus}</small>
              </button>
            ))}
          </div>
        </section>
      ))}
    </aside>
  );
}
