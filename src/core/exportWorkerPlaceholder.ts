import type { ExportWorkerState } from "./exportWorker";
import type { ProjectPreviewExportState } from "./types";

interface BuildExportWorkerPlaceholderStateInput {
  source?: ProjectPreviewExportState;
  exportRoot?: string;
  generatedAt: string;
  executionMode?: ExportWorkerState["executionMode"];
}

const placeholderHardLocks: ExportWorkerState["hardLocks"] = {
  dryRunOnly: true,
  liveSubmitAllowed: false,
  providerSubmissionForbidden: true,
  noFileMutation: true,
  noCredentialRead: true,
  noCredentialWrite: true,
  noShellExecution: true,
  noWorkerSpawn: true,
  projectRootRelativeOnly: true,
  exportScopeOnly: true,
  noAbsolutePath: true,
  noParentTraversal: true,
  noDelete: true,
  noMove: true,
  noMediaRender: true,
  noProviderSubmit: true,
  noArbitraryShell: true,
  noUserFileOverwriteOutsideExport: true,
};

function safeExportRoot(value?: string) {
  const normalized = (value || "exports/export-worker").replace(/\\/g, "/").replace(/\/+/g, "/");
  if (normalized.startsWith("/") || /(^|\/)\.\.(\/|$)/.test(normalized)) return "exports/export-worker";
  return normalized.startsWith("exports/") ? normalized : "exports/export-worker";
}

export function buildExportWorkerPlaceholderState(input: BuildExportWorkerPlaceholderStateInput): ExportWorkerState {
  const exportRoot = safeExportRoot(input.exportRoot);
  const manifestPath = `${exportRoot}/export_manifest.json`;
  const readiness: ExportWorkerState["readiness"] = "planned";
  const executionMode = input.executionMode || "plan_only";
  const manifest: ExportWorkerState["manifest"] = {
    manifestId: "export_manifest_runtime_placeholder",
    generatedAt: input.generatedAt,
    exportRoot,
    profileSelection: [],
    readiness,
    writeFilesOnly: false,
    textOnly: false,
    allowedOperations: ["create_directory", "write_file"],
    allowedDirectories: [exportRoot],
    allowedWritePaths: [manifestPath],
    allowedCopyPaths: [],
    allowedCopySources: [],
    files: [],
    mediaFiles: [],
    blockedProfileKinds: [],
    mvpPackage: {
      projectVibeIncluded: false,
      lockedAssetCount: 0,
      previewMediaCount: 0,
      videoResultCount: 0,
      videoNeedsReviewCount: 0,
      videoApprovedCount: 0,
      videoMissingCount: 0,
      finalVideoCopyCount: 0,
      receiptCount: 0,
      knowledgeReferenceCount: 0,
      videoReportIncluded: false,
      finalVideoManifestIncluded: false,
      audioManifestIncluded: false,
      reportIncluded: false,
    },
    source: {
      schemaVersion: input.source?.schemaVersion || "runtime_placeholder",
      packagePlanId: input.source?.exportPackagePlan.planId || "runtime_placeholder",
      packageStatus: input.source?.exportPackagePlan.status || "draft_only",
      formalPreviewStatus: input.source?.formalPreview.status || "blocked",
      draftPreviewStatus: input.source?.draftPreview.status || "blocked",
    },
    notes: ["Lightweight runtime placeholder. The full export worker is built only when the Export view or export action needs it."],
  };

  const manifestContent = JSON.stringify(manifest, null, 2);

  return {
    schemaVersion: "0.1.0",
    generatedAt: input.generatedAt,
    phase: "phase_27_export_worker_mvp",
    scope: "export_project_io_contract",
    rootRef: "project_root",
    exportRoot,
    executionMode,
    confirmationRequired: true,
    confirmed: false,
    readiness,
    canExecute: false,
    deliveryGate: {
      schemaVersion: "export_delivery_gate/0.1.0",
      status: "blocked",
      identity: {
        projectId: "",
        projectFactHash: "",
      },
      media: [],
      reviewBindings: [],
      canPrepare: false,
      canExecute: false,
      blockers: [
        {
          code: "delivery_confirmation_required",
          message: "Open Export to build the current structured Delivery Gate.",
        },
      ],
    },
    entries: [
      {
        id: "export_dir_runtime_placeholder",
        kind: "export_directory",
        operation: "create_directory",
        path: exportRoot,
        canExecute: false,
        projectRootRelative: true,
        notes: ["Runtime placeholder entry."],
      },
      {
        id: "export_manifest_runtime_placeholder",
        kind: "export_manifest",
        operation: "write_file",
        path: manifestPath,
        content: manifestContent,
        mimeType: "application/json",
        canExecute: false,
        projectRootRelative: true,
        notes: ["Runtime placeholder manifest. Open Export to build the full package plan."],
      },
    ],
    manifest,
    blockers: [],
    warnings: ["Export package details are deferred until the Export view opens."],
    hardLocks: placeholderHardLocks,
    notes: ["Runtime state keeps a lightweight export worker to reduce first-screen bundle cost."],
  };
}
