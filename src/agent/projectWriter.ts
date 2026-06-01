import type { DirectorAgentPlan } from "./directorAgentPlan";
import {
  applyProjectVibeTransaction,
  hashProjectVibeFacts,
  type ProjectVibeDocument,
  type ProjectVibeRunReceipt,
  type ProjectVibeTransactionReceipt,
} from "../project";

export interface DirectorPrototypeRunWriteResult {
  nextProject: ProjectVibeDocument;
  transactionReceipt: ProjectVibeTransactionReceipt;
  runReceipt: ProjectVibeRunReceipt;
}

export interface ProviderRequestEvidenceRef {
  requestId: string;
}

export function createDirectorPrototypeRunReceipt(
  project: ProjectVibeDocument,
  plan: DirectorAgentPlan,
  providerRequest: ProviderRequestEvidenceRef,
): ProjectVibeRunReceipt {
  return {
    id: plan.runId,
    runKind: "agent_loop",
    status: "succeeded",
    createdAt: plan.createdAt,
    summary: `Mock-only director prototype loop promoted provider return for ${plan.selectedShotId}.`,
    sourceFactHash: hashProjectVibeFacts(project),
    affectedShotIds: [plan.selectedShotId],
    producedAssetIds: [],
    evidenceRefs: [
      `providerBoundary#${providerRequest.requestId}`,
      `project.vibe#shots/${plan.selectedShotId}`,
      plan.outputPath,
    ],
    projectFactsMutated: true,
    runtimeFixtureUsed: false,
  };
}

export function appendDirectorPrototypeRunReceipt(
  project: ProjectVibeDocument,
  plan: DirectorAgentPlan,
  providerRequest: ProviderRequestEvidenceRef,
): DirectorPrototypeRunWriteResult {
  const runReceipt = createDirectorPrototypeRunReceipt(project, plan, providerRequest);
  const patched = applyProjectVibeTransaction(project, {
    id: `txn_${plan.runId}`,
    actor: "agent_loop",
    reason: "Append mock-only director prototype provider run receipt.",
    createdAt: plan.createdAt,
    operations: [
      {
        op: "append_run_receipt",
        run: runReceipt,
      },
    ],
  });

  if (patched.receipt.status !== "applied") {
    throw new Error(`Project.vibe transaction rejected: ${patched.receipt.errors.join("; ")}`);
  }

  return {
    nextProject: patched.project,
    transactionReceipt: patched.receipt,
    runReceipt,
  };
}
