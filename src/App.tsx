import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  Clapperboard,
  FileJson,
  Gauge,
  Layers3,
  LockKeyhole,
  PauseCircle,
  Play,
  PlugZap,
  Radio,
  RefreshCw,
  Send,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import type { AssetRecord, AuditIssue, ProjectAudit, ShotRecord, WorkflowStage } from "./core/types";
import { buildTaskEnvelope } from "./core/taskEnvelope";
import { fallbackAudit } from "./data/fallbackAudit";

const gateNames = ["identity", "scene", "pair", "story", "prop", "style"] as const;

function gateClass(value: string) {
  if (value === "PASS") return "gate pass";
  if (value === "PARTIAL") return "gate partial";
  if (value === "FAIL") return "gate fail";
  if (value === "N/A") return "gate muted";
  return "gate unknown";
}

function issueTone(issue: AuditIssue) {
  if (issue.severity === "blocker") return "issue blocker";
  if (issue.severity === "warning") return "issue warning";
  return "issue";
}

function stageIcon(stage: WorkflowStage) {
  if (stage.status === "done") return <CheckCircle2 size={15} />;
  if (stage.status === "blocked") return <ShieldAlert size={15} />;
  if (stage.status === "active") return <RefreshCw size={15} />;
  return <Radio size={15} />;
}

function groupAssets(assets: AssetRecord[]) {
  return {
    Characters: assets.filter((asset) => asset.type === "character"),
    Scenes: assets.filter((asset) => asset.type === "scene"),
    Props: assets.filter((asset) => asset.type === "prop"),
  };
}

function StatusPill({ value }: { value: string }) {
  const tone = value.includes("blocked") || value.includes("missing") || value === "blocker" ? "danger" : value.includes("ready") || value.includes("done") || value === "PASS" ? "good" : "neutral";
  return <span className={`pill ${tone}`}>{value}</span>;
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

function AssetPanel({ assets, selectedAsset, onSelectAsset }: { assets: AssetRecord[]; selectedAsset?: string; onSelectAsset: (id: string) => void }) {
  const groups = groupAssets(assets);
  return (
    <aside className="asset-panel">
      <div className="panel-title">
        <Boxes size={17} />
        <span>Visual Memory</span>
      </div>
      {Object.entries(groups).map(([group, items]) => (
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
                <span className={`dot ${asset.issues.length ? "warn" : asset.status === "missing" ? "bad" : "ok"}`} />
                <small>{asset.lockedStatus}</small>
              </button>
            ))}
          </div>
        </section>
      ))}
    </aside>
  );
}

function ShotCard({ shot, selected, onClick }: { shot: ShotRecord; selected: boolean; onClick: () => void }) {
  return (
    <button className={`shot-card ${selected ? "selected" : ""}`} onClick={onClick}>
      <div className="shot-top">
        <strong>{shot.id}</strong>
        <StatusPill value={shot.status} />
      </div>
      <p>{shot.storyFunction}</p>
      <div className="shot-media">
        <div>
          <span>Start</span>
          <small>{shot.startFrame ? "present" : "missing"}</small>
        </div>
        <div>
          <span>End</span>
          <small>{shot.endFrame ? "present" : "missing"}</small>
        </div>
        <div>
          <span>Video</span>
          <small>{shot.videoPath ? "ready" : "missing"}</small>
        </div>
      </div>
      <div className="gate-row">
        {gateNames.map((name) => (
          <span key={name} className={gateClass(shot.gates[name])} title={`${name}: ${shot.gates[name]}`}>
            {name[0]}
          </span>
        ))}
      </div>
    </button>
  );
}

function ShotWorkspace({ audit, selectedShotId, onSelectShot }: { audit: ProjectAudit; selectedShotId: string; onSelectShot: (id: string) => void }) {
  const [tab, setTab] = useState<"A1" | "A2" | "All">("A1");
  const shots = tab === "All" ? audit.shots : audit.shots.filter((shot) => shot.actId === tab);
  return (
    <main className="workspace">
      <div className="tabs">
        {(["A1", "A2", "All"] as const).map((item) => (
          <button key={item} className={tab === item ? "active" : ""} onClick={() => setTab(item)}>
            {item === "A1" ? "Act I" : item === "A2" ? "Act II" : "All Shots"}
          </button>
        ))}
      </div>
      <div className="shot-grid">
        {shots.map((shot) => (
          <ShotCard key={shot.id} shot={shot} selected={selectedShotId === shot.id} onClick={() => onSelectShot(shot.id)} />
        ))}
      </div>
      <div className="contact-strip">
        <div>
          <h3>Asset Contact Sheet</h3>
          {audit.contactSheets.assets ? <img src={audit.contactSheets.assets} alt="Asset contact sheet" /> : <div className="empty-media">No asset contact sheet</div>}
        </div>
        <div>
          <h3>Keyframe Contact Sheet</h3>
          {audit.contactSheets.keyframes ? <img src={audit.contactSheets.keyframes} alt="Keyframe contact sheet" /> : <div className="empty-media">No keyframe contact sheet</div>}
        </div>
      </div>
    </main>
  );
}

function Inspector({ audit, shot, asset }: { audit: ProjectAudit; shot?: ShotRecord; asset?: AssetRecord }) {
  const shotJobs = shot ? audit.jobs.filter((job) => job.id.includes(shot.id)) : [];
  const relatedIssues = audit.issues.filter((issue) => !shot || issue.target?.includes(shot.id) || issue.type === "provider_policy" || issue.type === "fallback" || issue.type === "missing_output");
  return (
    <aside className="inspector">
      <div className="panel-title">
        <Clapperboard size={17} />
        <span>Director Panel</span>
      </div>
      {shot && (
        <section className="inspector-section">
          <div className="selected-line">Selected {shot.id}</div>
          <h2>{shot.storyFunction}</h2>
          <div className="field-grid">
            <label>Act</label>
            <span>{shot.actId}</span>
            <label>Status</label>
            <span>{shot.status}</span>
            <label>Video</label>
            <span>{shot.videoPath ? "ready" : "blocked"}</span>
          </div>
          <div className="gate-table">
            {gateNames.map((name) => (
              <div key={name}>
                <span>{name}</span>
                <b className={gateClass(shot.gates[name])}>{shot.gates[name]}</b>
              </div>
            ))}
          </div>
          <div className="path-list">
            <small>{shot.startFrame}</small>
            <small>{shot.endFrame}</small>
          </div>
        </section>
      )}
      {asset && (
        <section className="inspector-section">
          <div className="selected-line">Asset {asset.type}</div>
          <h2>{asset.name}</h2>
          <div className="field-grid">
            <label>Status</label>
            <span>{asset.status}</span>
            <label>Lock</label>
            <span>{asset.lockedStatus}</span>
            <label>Provider</label>
            <span>{asset.providerId || "unknown"}</span>
          </div>
          <div className="path-list">
            <small>{asset.path}</small>
          </div>
        </section>
      )}
      <section className="inspector-section">
        <h3>Dry-run Tasks</h3>
        {shotJobs.length ? (
          <div className="job-list">
            {shotJobs.map((job) => (
              <div key={job.id} className="job-row">
                <span>{job.id}</span>
                <small>{job.slot} / {job.requiredMode}</small>
                <StatusPill value={job.status} />
              </div>
            ))}
          </div>
        ) : (
          <p className="muted-copy">Select a shot to inspect generated task envelopes.</p>
        )}
      </section>
      <section className="inspector-section">
        <h3>Blocking Reasons</h3>
        <div className="issue-list">
          {relatedIssues.slice(0, 6).map((issue) => (
            <div key={issue.id} className={issueTone(issue)}>
              <strong>{issue.title}</strong>
              <p>{issue.detail}</p>
            </div>
          ))}
        </div>
      </section>
    </aside>
  );
}

function Workflow({ stages }: { stages: WorkflowStage[] }) {
  return (
    <div className="workflow">
      {stages.map((stage) => (
        <div key={stage.id} className={`stage ${stage.status}`}>
          {stageIcon(stage)}
          <span>{stage.label}</span>
          <small>{stage.detail}</small>
        </div>
      ))}
    </div>
  );
}

function ProviderDock({ audit }: { audit: ProjectAudit }) {
  return (
    <section className="provider-dock">
      <div className="provider-title">
        <PlugZap size={16} />
        <span>Provider Policy</span>
      </div>
      {audit.providerPolicy.rules.map((rule) => (
        <div key={rule.slot} className={`provider-rule ${rule.executionState}`}>
          <div>
            <strong>{rule.slot}</strong>
            <small>{rule.activeProvider}</small>
          </div>
          <StatusPill value={rule.executionState} />
        </div>
      ))}
      <div className="provider-note">
        <PauseCircle size={15} />
        <span>Jimeng/Seedance is parked for now: build envelopes and queues, do not submit live jobs.</span>
      </div>
    </section>
  );
}

function EnvelopePreview({ audit, shot }: { audit: ProjectAudit; shot?: ShotRecord }) {
  const job = shot ? audit.jobs.find((item) => item.id.includes(shot.id)) : undefined;
  if (!job) return <p className="muted-copy">Select a shot to preview its standardized task envelope.</p>;

  const envelope = buildTaskEnvelope(job, shot, audit.issues, { preflightScope: "dev_preview" });
  return (
    <div className="envelope-preview">
      <div className="field-grid compact">
        <label>Slot</label>
        <span>{envelope.providerSlot}</span>
        <label>Mode</label>
        <span>{envelope.requiredMode}</span>
        <label>Provider</label>
        <span>{envelope.providerId}</span>
        <label>State</label>
        <span>{envelope.executionState}</span>
        <label>Preflight</label>
        <span>{envelope.preflight.status}</span>
        <label>Blockers</label>
        <span>{envelope.preflight.blockers.length}</span>
      </div>
      <div className="rule-list">
        {envelope.hardRules.map((rule) => (
          <small key={rule}>{rule}</small>
        ))}
        {envelope.preflight.blockers.slice(0, 3).map((item) => (
          <small key={item.code}>{item.messageForUser}</small>
        ))}
      </div>
    </div>
  );
}

function DirectorInput() {
  const [text, setText] = useState("");
  const [saved, setSaved] = useState("No command recorded");
  return (
    <div className="director-input">
      <div className="input-header">
        <Sparkles size={16} />
        <span>Director Input</span>
      </div>
      <textarea value={text} onChange={(event) => setText(event.target.value)} placeholder="Describe a change. This first build records intent only; it does not call a model." />
      <button
        onClick={() => {
          setSaved(text.trim() ? `Mock command saved: ${text.trim()}` : "No command text");
          setText("");
        }}
      >
        <Send size={15} />
        Save Mock Command
      </button>
      <small>{saved}</small>
    </div>
  );
}

function App() {
  const [audit, setAudit] = useState<ProjectAudit>(fallbackAudit);
  const [selectedShotId, setSelectedShotId] = useState("A1_01");
  const [selectedAssetId, setSelectedAssetId] = useState<string | undefined>();

  useEffect(() => {
    fetch("/runtime-audit.json")
      .then((response) => (response.ok ? response.json() : fallbackAudit))
      .then((data) => {
        setAudit(data);
        if (data.shots?.[0]) setSelectedShotId(data.shots[0].id);
      })
      .catch(() => setAudit(fallbackAudit));
  }, []);

  const selectedShot = useMemo(() => audit.shots.find((shot) => shot.id === selectedShotId), [audit.shots, selectedShotId]);
  const selectedAsset = useMemo(() => audit.assets.find((asset) => asset.id === selectedAssetId), [audit.assets, selectedAssetId]);
  const blockers = audit.issues.filter((issue) => issue.severity === "blocker");

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="mark">VD</div>
          <div>
            <h1>Vibe Director Studio</h1>
            <p>{audit.projectTitle} · {audit.state}</p>
          </div>
        </div>
        <div className="top-actions">
          <button><FileJson size={16} /> Import Runtime Test</button>
          <button><Gauge size={16} /> Run Dry Check</button>
          <button><Play size={16} /> Mock Generate</button>
        </div>
      </header>

      <section className="overview">
        <Metric label="Assets" value={`${audit.metrics.existingAssets}/${audit.metrics.expectedAssets}`} detail="protocol imported" />
        <Metric label="Keyframes" value={`${audit.metrics.existingKeyframes}/${audit.metrics.expectedKeyframes}`} detail="start/end pairs" />
        <Metric label="Videos" value={`${audit.metrics.existingVideos}/${audit.metrics.expectedVideos}`} detail="clips found" />
        <Metric label="Blockers" value={`${blockers.length}`} detail="policy/state gates" />
      </section>

      <Workflow stages={audit.workflow} />
      <ProviderDock audit={audit} />

      <div className="main-layout">
        <AssetPanel assets={audit.assets} selectedAsset={selectedAssetId} onSelectAsset={setSelectedAssetId} />
        <ShotWorkspace audit={audit} selectedShotId={selectedShotId} onSelectShot={setSelectedShotId} />
        <Inspector audit={audit} shot={selectedShot} asset={selectedAsset} />
      </div>

      <footer className="bottom-panel">
        <div className="audit-head">
          <Layers3 size={17} />
          <span>Audit Log</span>
        </div>
        <div className="audit-list">
          {audit.issues.map((issue) => (
            <div key={issue.id} className={issueTone(issue)}>
              <AlertTriangle size={15} />
              <div>
                <strong>{issue.title}</strong>
                <p>{issue.recommendation}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="envelope-panel">
          <div className="audit-head">
            <FileJson size={17} />
            <span>Task Envelope</span>
          </div>
          <EnvelopePreview audit={audit} shot={selectedShot} />
        </div>
        <DirectorInput />
        <div className="policy-note">
          <LockKeyhole size={16} />
          <span>Image policy: Image2 only. Required image-to-image tasks cannot fall back to text-to-image.</span>
        </div>
      </footer>
    </div>
  );
}

export default App;
