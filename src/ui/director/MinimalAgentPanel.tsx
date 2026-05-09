import { useState } from "react";
import { CheckCircle2, Eye } from "lucide-react";
import { buildDirectorWorkflowState } from "../../core/directorWorkflow";
import type { MinimalRuntimeProjection } from "../../core/minimalRuntimeProjection";
import type { ProjectRuntimeState } from "../../core/projectState";
import type { AssetRecord, ShotRecord } from "../../core/types";
import {
  agentProjectionBadges,
  agentProjectionNextStep,
  buildAgentPanelProjection,
  confirmAgentPlanProjection,
  selectedScopeLabel,
  type AgentPlanPhase,
  workflowBadgeLabels,
  workflowCanConfirm,
  workflowPanelNextStepLabel,
} from "./agentPanelProjection";

export function MinimalAgentPanel({
  runtimeState,
  projectScopeLabel,
  shot,
  selectedShots = [],
  asset,
  sectionLabel,
  sectionId,
}: {
  runtimeState: ProjectRuntimeState;
  projectScopeLabel?: string;
  shot?: ShotRecord;
  selectedShots?: ShotRecord[];
  asset?: AssetRecord;
  sectionLabel?: string;
  sectionId?: string;
}) {
  const [text, setText] = useState("");
  const [status, setStatus] = useState("等待描述");
  const [planPhase, setPlanPhase] = useState<AgentPlanPhase>("idle");
  const [workflow, setWorkflow] = useState<ReturnType<typeof buildDirectorWorkflowState> | undefined>();
  const [projection, setProjection] = useState<MinimalRuntimeProjection | undefined>();
  const scopedShotIds = selectedShots.map((item) => item.id);
  const localScopeLabel = selectedScopeLabel(shot, asset, sectionLabel, selectedShots);
  const scopeLabel = projectScopeLabel ? `${projectScopeLabel} · ${localScopeLabel}` : localScopeLabel;

  function prepareChange() {
    const userIntent = text.trim();
    if (!userIntent) {
      setStatus("先写下想改哪里");
      return;
    }
    const nextWorkflow = buildDirectorWorkflowState({
      runtimeState,
      userIntent,
      selection: {
        selectedShotId: scopedShotIds.length <= 1 ? shot?.id : undefined,
        selectedShotIds: scopedShotIds.length > 1 ? scopedShotIds : undefined,
        selectedAssetId: asset?.id,
        sectionId: !scopedShotIds.length && !asset ? sectionId : undefined,
      },
    });
    const nextProjection = buildAgentPanelProjection(nextWorkflow, runtimeState, "review");
    setWorkflow(nextWorkflow);
    setProjection(nextProjection);
    setPlanPhase("review");
    setStatus(nextProjection.shortLabel);
  }

  function confirmPlan() {
    if (!workflowCanConfirm(workflow)) return;
    const { projection: nextProjection } = confirmAgentPlanProjection(workflow, runtimeState);
    setProjection(nextProjection);
    setPlanPhase("confirmed");
    setStatus(nextProjection.shortLabel);
  }

  const canConfirm = workflowCanConfirm(workflow);
  const badges = projection ? agentProjectionBadges(projection, planPhase).slice(0, 2) : workflow ? workflowBadgeLabels(workflow).slice(0, 2) : ["先看一下"];
  const nextStep = projection ? agentProjectionNextStep(projection, planPhase, canConfirm) : workflow ? workflowPanelNextStepLabel(workflow, planPhase) : "写一句你想调整的画面、角色或节奏。";

  return (
    <aside className="minimal-agent-panel">
      <span>{scopeLabel}</span>
      <div className="minimal-agent-input">
        <textarea value={text} onChange={(event) => setText(event.target.value)} placeholder="描述你想怎么改..." />
        <button disabled={!text.trim()} onClick={prepareChange}>
          <Eye size={15} />
          看看
        </button>
      </div>
      <strong className="minimal-agent-status">{status}</strong>
      {projection && (
        <div className="minimal-state-dots agent" aria-label={projection.shortLabel}>
          {projection.progressDots.map((dot) => (
            <i key={dot.id} className={dot.tone} title={dot.label} />
          ))}
        </div>
      )}
      <div className="minimal-agent-badges" aria-label="修改摘要">
        {badges.map((badge) => (
          <small key={badge}>{badge}</small>
        ))}
      </div>
      <small>{nextStep}</small>
      {workflow && (
        <div className="minimal-agent-actions">
          <button disabled={!canConfirm || planPhase === "confirmed"} onClick={confirmPlan}>
            <CheckCircle2 size={15} />
            确认修改
          </button>
        </div>
      )}
    </aside>
  );
}
