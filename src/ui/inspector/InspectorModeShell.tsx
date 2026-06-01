import { AlertTriangle, Clapperboard, FileJson, ListChecks, LockKeyhole, Play, Radio, Sparkles } from "lucide-react";
import type {
  AssetRecord,
  AuditIssue,
  ProjectAudit,
  ShotRecord,
} from "../../core/types";
import type { RuntimeView, TaskRuntimeView } from "../../core/runtimeView";
import type { ProjectRuntimeState } from "../../core/projectState";
import {
  EnvelopePreview,
  gateClass,
  gateNames,
  issueTone,
  ShotAudioInspector,
  ShotExecutionPreviewInspector,
  ShotImagePipelineSummary,
  ShotPreviewExportSummary,
  ShotVideoGateInspector,
  TaskRows,
} from "../../App";

export function InspectorMode({
  audit,
  view,
  runtimeState,
  selectedShot,
  selectedAsset,
}: {
  audit: ProjectAudit;
  view: RuntimeView;
  runtimeState: ProjectRuntimeState;
  selectedShot?: ShotRecord;
  selectedAsset?: AssetRecord;
}) {
  const selectedTasks = selectedShot ? view.taskViews.filter((task) => task.shot?.id === selectedShot.id) : [];
  const primaryTask = selectedTasks.find((task) => task.job.slot === "video.i2v") || selectedTasks[0];
  const relatedIssues = audit.issues.filter((issue) => !selectedShot || issue.target?.includes(selectedShot.id) || issue.type === "provider_policy" || issue.type === "fallback" || issue.type === "missing_output");

  return (
    <div className="inspector-layout">
      <aside className="inspector">
        <div className="panel-title">
          <Clapperboard size={17} />
          <span>Inspector</span>
        </div>
        {selectedShot && (
          <section className="inspector-section">
            <div className="selected-line">Selected {selectedShot.id}</div>
            <h2>{selectedShot.storyFunction}</h2>
            <div className="field-grid">
              <label>Act</label>
              <span>{selectedShot.actId}</span>
              <label>Section</label>
              <span>{selectedShot.sectionId || "none"}</span>
              <label>Status</label>
              <span>{selectedShot.status}</span>
              <label>Video</label>
              <span>{selectedShot.videoPath ? "ready" : "blocked"}</span>
            </div>
            <div className="gate-table">
              {gateNames.map((name) => (
                <div key={name}>
                  <span>{name}</span>
                  <b className={gateClass(selectedShot.gates[name])}>{selectedShot.gates[name]}</b>
                </div>
              ))}
            </div>
          </section>
        )}
        {selectedAsset && (
          <section className="inspector-section">
            <div className="selected-line">Asset {selectedAsset.type}</div>
            <h2>{selectedAsset.name}</h2>
            <div className="field-grid">
              <label>Status</label>
              <span>{selectedAsset.status}</span>
              <label>Lock</label>
              <span>{selectedAsset.lockedStatus}</span>
              <label>Provider</label>
              <span>{selectedAsset.providerId || "unknown"}</span>
            </div>
            <div className="path-list">
              <small>{selectedAsset.path}</small>
            </div>
          </section>
        )}
      </aside>
      <main className="inspector-main">
        <section className="machine-panel">
          <div className="audit-head">
            <Sparkles size={17} />
            <span>Phase 4 Image Pipeline</span>
          </div>
          <ShotImagePipelineSummary runtimeState={runtimeState} selectedShot={selectedShot} />
        </section>
        <section className="machine-panel">
          <div className="audit-head">
            <LockKeyhole size={17} />
            <span>Video Gate</span>
          </div>
          <ShotVideoGateInspector runtimeState={runtimeState} selectedShot={selectedShot} />
        </section>
        <section className="machine-panel">
          <div className="audit-head">
            <FileJson size={17} />
            <span>Video Execution Preview</span>
          </div>
          <ShotExecutionPreviewInspector runtimeState={runtimeState} selectedShot={selectedShot} />
        </section>
        <section className="machine-panel">
          <div className="audit-head">
            <Play size={17} />
            <span>Preview / Export</span>
          </div>
          <ShotPreviewExportSummary previewExport={runtimeState.previewExport} selectedShot={selectedShot} tasks={selectedTasks} />
        </section>
        <section className="machine-panel">
          <div className="audit-head">
            <Radio size={17} />
            <span>Shot Audio Plan</span>
          </div>
          <ShotAudioInspector audioPlanning={runtimeState.audioPlanning} selectedShot={selectedShot} />
        </section>
        <section className="machine-panel">
          <div className="audit-head">
            <ListChecks size={17} />
            <span>Task Runs</span>
          </div>
          <TaskRows tasks={selectedTasks} />
        </section>
        <section className="machine-panel">
          <div className="audit-head">
            <FileJson size={17} />
            <span>Task Envelope Preview</span>
          </div>
          <EnvelopePreview task={primaryTask} />
        </section>
        <section className="machine-panel">
          <div className="audit-head">
            <AlertTriangle size={17} />
            <span>Blocking Reasons</span>
          </div>
          <div className="issue-list">
            {relatedIssues.slice(0, 8).map((issue) => (
              <div key={issue.id} className={issueTone(issue)}>
                <strong>{issue.title}</strong>
                <p>{issue.detail}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
