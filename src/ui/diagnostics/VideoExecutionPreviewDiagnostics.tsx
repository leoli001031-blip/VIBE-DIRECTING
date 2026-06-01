import { FileJson } from "lucide-react";
import type { ProjectRuntimeState } from "../../core/projectState";
import type { VideoExecutionPreview, VideoExecutionPreviewState } from "../../core/types";
import { getVideoExecutionPreview } from "./projections/runtimeDiagnostics";
import { CompactList, Metric, StatusPill } from "../common/DiagnosticsPrimitives";

export function VideoExecutionPreviewDiagnostics({ runtimeState }: { runtimeState: ProjectRuntimeState }) {
  const executionPreview: VideoExecutionPreviewState = getVideoExecutionPreview(runtimeState);
  const summary = executionPreview.summary;
  const hardLocks: string[] = Array.from(new Set(executionPreview.previews.flatMap((preview: VideoExecutionPreview) => preview.hardLocks)));
  const previewRows = executionPreview.previews.slice(0, 6);

  return (
    <section className="machine-panel video-execution-preview-diagnostics">
      <div className="audit-head">
        <FileJson size={17} />
        <span>Video Execution Preview</span>
      </div>
      <div className="summary-grid">
        <Metric label="Total" value={`${summary.total}`} detail={`${summary.blocked} blocked · ${summary.parked} parked`} />
        <Metric label="Preview Ready" value={`${summary.previewReady}`} detail={`${summary.canPreviewPacket} packet preview(s)`} />
        <Metric label="Can Execute" value={`${summary.canExecute}`} detail="dry-run packet surface only" />
        <Metric label="Hard Locks" value={executionPreview.liveSubmitAllowed ? "unlocked" : "locked"} detail={`${hardLocks.length} lock(s) active`} />
      </div>
      <div className="video-preview-locks">
        <StatusPill value={executionPreview.providerSubmissionForbidden ? "provider forbidden" : "provider allowed"} />
        <StatusPill value={executionPreview.liveSubmitAllowed ? "live allowed" : "live false"} />
        <StatusPill value={executionPreview.dryRunOnly ? "dry-run only" : "dry-run off"} />
        <StatusPill value={summary.canExecute === 0 ? "canExecute 0" : `canExecute ${summary.canExecute}`} />
      </div>
      <div className="video-execution-preview-list">
        {previewRows.map((preview: VideoExecutionPreview) => (
          <div key={preview.previewId} className="video-execution-preview-row">
            <span>{preview.shotId}</span>
            <StatusPill value={preview.status} />
            <small>Packet {preview.canPreviewPacket ? "previewable" : "blocked"} · {preview.subagentTaskEnvelope.injectedKnowledgePacks.length} injected pack(s) · canExecute {String(preview.canExecute)}</small>
          </div>
        ))}
        {!previewRows.length && <p className="muted-copy">No Video Execution Preview rows in this runtime state.</p>}
      </div>
      <div className="pipeline-details">
        <details>
          <summary>Hard locks ({hardLocks.length})</summary>
          <CompactList items={hardLocks} empty="No hard locks reported." />
        </details>
        <details>
          <summary>Preview notes ({executionPreview.notes.length})</summary>
          <CompactList items={executionPreview.notes} empty="No Video Execution Preview notes." />
        </details>
      </div>
    </section>
  );
}
