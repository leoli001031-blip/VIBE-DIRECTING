import type { FileSnapshot, ManifestMatchReport } from "./manifestMatcher";
import { buildGenerationHealthReports } from "./generationHealth";
import type {
  AssetReadinessReport,
  GenerationHealthReport,
  GenerationQaStatus,
  ImageTaskPlan,
  QaPromotionReport,
  QaPromotionStatus,
  ShotPromptPlan,
} from "./types";

export interface BuildQaPromotionReportsInput {
  imageTaskPlans: ImageTaskPlan[];
  fileSnapshot: FileSnapshot;
  manifestReports?: ManifestMatchReport[];
  generationHealthReports?: GenerationHealthReport[];
  assetReadinessReports?: AssetReadinessReport[];
  promptPlans?: ShotPromptPlan[];
  qaStatusByOutputPath?: Record<string, GenerationQaStatus>;
  promotedFormalPaths?: string[];
}

function hasManifestMatch(status: string): boolean {
  return ["actual_output_present", "complete", "matched"].includes(status);
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, "/");
}

function formalPathForCandidate(candidatePath: string): string {
  const normalized = normalizePath(candidatePath);
  const parts = normalized.split("/");
  const fileName = parts.pop() || "formal-output";
  const directory = parts.join("/");
  const formalDirectory = directory ? `${directory}/formal` : "formal";
  return `${formalDirectory}/${fileName}`;
}

function promotionStatus(input: {
  allGatesPass: boolean;
  formalAlreadyPromoted: boolean;
  expectedOutput: boolean;
  manifestMatch: boolean;
  promptFresh: boolean;
  assetReadiness: boolean;
  qaPass: boolean;
  qaStatus: GenerationQaStatus;
}): QaPromotionStatus {
  if (input.allGatesPass && input.formalAlreadyPromoted) return "promoted";
  if (input.allGatesPass) return "ready_for_promotion";
  if (input.expectedOutput && input.manifestMatch && input.promptFresh && input.assetReadiness && !input.qaPass) return "qa_pending";
  if (!input.expectedOutput) return "candidate";
  return input.qaStatus === "pending" || input.qaStatus === "missing" ? "qa_pending" : "blocked";
}

export function buildQaPromotionReports(input: BuildQaPromotionReportsInput): QaPromotionReport[] {
  const healthReports =
    input.generationHealthReports ||
    buildGenerationHealthReports({
      imageTaskPlans: input.imageTaskPlans,
      fileSnapshot: input.fileSnapshot,
      manifestReports: input.manifestReports,
      assetReadinessReports: input.assetReadinessReports,
      promptPlans: input.promptPlans,
      qaStatusByOutputPath: input.qaStatusByOutputPath,
    });
  const healthByTaskPlan = new Map(healthReports.map((report) => [report.taskPlanId, report]));
  const promotedPaths = new Set((input.promotedFormalPaths || []).map((path) => path.replace(/\\/g, "/")));

  return input.imageTaskPlans.map((taskPlan) => {
    const health = healthByTaskPlan.get(taskPlan.taskPlanId);
    const expectedOutput = Boolean(health?.outputExists);
    const manifestMatch = hasManifestMatch(health?.manifestStatus || "missing_expected_output");
    const promptFresh = !health?.stalePrompt;
    const assetReadiness = health?.assetReadinessStatus === "ready";
    const qaPass = health?.qaStatus === "pass";
    const healthClear = health?.healthStatus !== "blocked" && health?.healthStatus !== "failed";
    const taskPlanClear = taskPlan.status !== "blocked";
    const requiredGates = {
      expectedOutput,
      manifestMatch,
      promptFresh,
      assetReadiness,
      qaPass,
    };
    const candidatePath = taskPlan.expectedOutputPath;
    const formalPath = formalPathForCandidate(candidatePath);
    const blockers = [
      ...(expectedOutput ? [] : ["Expected output is required before formal promotion."]),
      ...(manifestMatch ? [] : [`Manifest match is required before formal promotion${health?.manifestStatus ? ` (${health.manifestStatus})` : ""}.`]),
      ...(promptFresh ? [] : ["Prompt must be fresh before formal promotion."]),
      ...(assetReadiness ? [] : ["Asset readiness must be ready before formal promotion."]),
      ...(qaPass ? [] : ["Explicit QA pass is required before formal promotion."]),
      ...(healthClear ? [] : [`Generation health must not be ${health?.healthStatus} before formal promotion.`]),
      ...(taskPlanClear ? [] : ["Task plan must not be blocked before formal promotion."]),
      ...(health?.blockers || []),
    ];
    const uniqueBlockers = Array.from(new Set(blockers.filter(Boolean))).sort();
    const canPromoteToFormal = Object.values(requiredGates).every(Boolean) && healthClear && taskPlanClear && uniqueBlockers.length === 0;
    const warnings = [
      ...(health?.warnings || []),
      "Worker or provider self-report is not a formal success gate.",
    ];

    return {
      reportId: `qa_promotion_${taskPlan.taskPlanId}`,
      taskPlanId: taskPlan.taskPlanId,
      jobId: taskPlan.jobId,
      shotId: taskPlan.shotId,
      candidatePath,
      formalPath,
      promotionStatus: promotionStatus({
        allGatesPass: canPromoteToFormal,
        formalAlreadyPromoted: promotedPaths.has(normalizePath(formalPath)),
        expectedOutput,
        manifestMatch,
        promptFresh,
        assetReadiness,
        qaPass,
        qaStatus: health?.qaStatus || "unknown",
      }),
      requiredGates,
      blockers: uniqueBlockers,
      warnings: Array.from(new Set(warnings.filter(Boolean))).sort(),
      canPromoteToFormal,
    };
  });
}
