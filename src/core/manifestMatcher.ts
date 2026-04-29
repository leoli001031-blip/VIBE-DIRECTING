import type { TaskRun } from "./types";

export type ManifestMatchStatus =
  | "missing_expected_output"
  | "actual_output_present"
  | "qa_missing"
  | "complete"
  | "postprocess_recoverable";

export interface FileSnapshotEntry {
  path: string;
  hash?: string;
  sizeBytes?: number;
  modifiedAt?: string;
}

export type FileSnapshot = string[] | FileSnapshotEntry[] | Record<string, Omit<FileSnapshotEntry, "path"> | true>;

export interface OutputMatch {
  expectedPath: string;
  status: ManifestMatchStatus;
  actualPath?: string;
  recoverableCandidates: string[];
  reason: string;
}

export interface ManifestMatchReport {
  taskId: string;
  status: ManifestMatchStatus;
  expectedOutputCount: number;
  presentOutputCount: number;
  missingExpectedOutputs: string[];
  actualOutputsPresent: string[];
  recoverableOutputs: string[];
  outputMatches: OutputMatch[];
}

export interface QaCoverage {
  required?: boolean;
  coveredOutputPaths: string[];
  missingOutputPaths?: string[];
  failedOutputPaths?: string[];
  reportIdsByOutput?: Record<string, string>;
}

export interface TaskCompletionReport {
  taskId: string;
  status: ManifestMatchStatus;
  canAdvance: boolean;
  presentExpectedOutputs: string[];
  missingExpectedOutputs: string[];
  missingQaOutputs: string[];
  failedQaOutputs: string[];
  recoverableOutputs: string[];
  reason: string;
}

function normalizeSnapshot(snapshot: FileSnapshot): Set<string> {
  if (Array.isArray(snapshot)) {
    return new Set(
      snapshot.map((entry) => {
        if (typeof entry === "string") return entry;
        return entry.path;
      }),
    );
  }

  return new Set(Object.keys(snapshot));
}

function pathBasename(path: string): string {
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] || path;
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, "/");
}

function isInsideTempDir(path: string, tempDirs: string[]): boolean {
  const normalizedPath = normalizePath(path);
  return tempDirs.some((tempDir) => {
    const normalizedTempDir = normalizePath(tempDir).replace(/\/$/, "");
    return normalizedPath === normalizedTempDir || normalizedPath.startsWith(`${normalizedTempDir}/`);
  });
}

function findRecoverableCandidates(expectedPath: string, taskRun: TaskRun, snapshotPaths: Set<string>): string[] {
  const expectedName = pathBasename(expectedPath);
  const actualOutputsPresent = taskRun.actualOutputs.filter((actualPath) => snapshotPaths.has(actualPath));
  const tempSnapshotPaths = Array.from(snapshotPaths).filter((path) => isInsideTempDir(path, taskRun.tempDirs));
  const sameNameCandidates = [...actualOutputsPresent, ...tempSnapshotPaths].filter((path) => pathBasename(path) === expectedName);

  return Array.from(new Set([...actualOutputsPresent, ...sameNameCandidates])).sort();
}

function outputExists(path: string, snapshotPaths: Set<string>): boolean {
  return snapshotPaths.has(path);
}

export function matchTaskRunOutputs(taskRun: TaskRun, fsSnapshot: FileSnapshot): ManifestMatchReport {
  const snapshotPaths = normalizeSnapshot(fsSnapshot);
  const missingExpectedOutputs: string[] = [];
  const actualOutputsPresent = new Set(taskRun.actualOutputs.filter((path) => snapshotPaths.has(path)));
  const recoverableOutputs: string[] = [];
  const outputMatches = taskRun.expectedOutputs.map((expectedPath): OutputMatch => {
    if (outputExists(expectedPath, snapshotPaths)) {
      actualOutputsPresent.add(expectedPath);
      return {
        expectedPath,
        status: "actual_output_present",
        actualPath: expectedPath,
        recoverableCandidates: [],
        reason: "Expected output is present in manifest snapshot or task actualOutputs.",
      };
    }

    const recoverableCandidates = findRecoverableCandidates(expectedPath, taskRun, snapshotPaths);
    if (recoverableCandidates.length > 0) {
      recoverableOutputs.push(...recoverableCandidates);
      return {
        expectedPath,
        status: "postprocess_recoverable",
        actualPath: recoverableCandidates[0],
        recoverableCandidates,
        reason: "Expected output is missing, but a temp or actual candidate is available for postprocess recovery.",
      };
    }

    missingExpectedOutputs.push(expectedPath);
    return {
      expectedPath,
      status: "missing_expected_output",
      recoverableCandidates: [],
      reason: "Expected output is absent from both manifest snapshot and task actualOutputs.",
    };
  });

  const uniqueRecoverableOutputs = Array.from(new Set(recoverableOutputs)).sort();
  const presentOutputCount = outputMatches.filter((match) => match.status === "actual_output_present").length;
  const status = (() => {
    if (taskRun.expectedOutputs.length === 0 || missingExpectedOutputs.length > 0) {
      return uniqueRecoverableOutputs.length > 0 ? "postprocess_recoverable" : "missing_expected_output";
    }

    if (uniqueRecoverableOutputs.length > 0) return "postprocess_recoverable";
    return "actual_output_present";
  })();

  return {
    taskId: taskRun.taskId,
    status,
    expectedOutputCount: taskRun.expectedOutputs.length,
    presentOutputCount,
    missingExpectedOutputs,
    actualOutputsPresent: Array.from(actualOutputsPresent).sort(),
    recoverableOutputs: uniqueRecoverableOutputs,
    outputMatches,
  };
}

export function computeTaskCompletion(
  taskRun: TaskRun,
  qaCoverage: QaCoverage,
  matchReport: ManifestMatchReport = matchTaskRunOutputs(taskRun, []),
): TaskCompletionReport {
  const presentExpectedOutputs = matchReport.actualOutputsPresent;
  const missingExpectedOutputs = matchReport.missingExpectedOutputs;
  const recoverableOutputs = matchReport.recoverableOutputs;
  const qaRequired = qaCoverage.required !== false;
  const coveredOutputPaths = new Set(qaCoverage.coveredOutputPaths);
  const failedQaOutputs = qaCoverage.failedOutputPaths || [];
  const missingQaOutputs = qaRequired
    ? Array.from(
        new Set([
          ...presentExpectedOutputs.filter((path) => !coveredOutputPaths.has(path)),
          ...(qaCoverage.missingOutputPaths || []),
        ]),
      ).sort()
    : [];

  if (taskRun.expectedOutputs.length === 0) {
    return {
      taskId: taskRun.taskId,
      status: "missing_expected_output",
      canAdvance: false,
      presentExpectedOutputs,
      missingExpectedOutputs,
      missingQaOutputs,
      failedQaOutputs,
      recoverableOutputs,
      reason: "TaskRun declares no expected outputs, so worker completion cannot be trusted.",
    };
  }

  if (missingExpectedOutputs.length > 0) {
    return {
      taskId: taskRun.taskId,
      status: matchReport.status === "postprocess_recoverable" ? "postprocess_recoverable" : "missing_expected_output",
      canAdvance: false,
      presentExpectedOutputs,
      missingExpectedOutputs,
      missingQaOutputs,
      failedQaOutputs,
      recoverableOutputs,
      reason:
        recoverableOutputs.length > 0
          ? "Expected outputs are missing, but non-final actual outputs exist and may be recovered by postprocess."
          : "Expected outputs are missing from TaskRun actualOutputs.",
    };
  }

  if (failedQaOutputs.length > 0 || missingQaOutputs.length > 0) {
    return {
      taskId: taskRun.taskId,
      status: "qa_missing",
      canAdvance: false,
      presentExpectedOutputs,
      missingExpectedOutputs,
      missingQaOutputs,
      failedQaOutputs,
      recoverableOutputs,
      reason:
        failedQaOutputs.length > 0
          ? "One or more expected outputs have failing QA reports."
          : "Expected outputs are present, but QA coverage is missing.",
    };
  }

  return {
    taskId: taskRun.taskId,
    status: qaRequired ? "complete" : "actual_output_present",
    canAdvance: qaRequired,
    presentExpectedOutputs,
    missingExpectedOutputs,
    missingQaOutputs,
    failedQaOutputs,
    recoverableOutputs,
    reason: qaRequired
      ? "Expected outputs are present and covered by QA."
      : "Expected outputs are present; QA was explicitly marked as not required.",
  };
}

export function computeTaskCompletionFromSnapshot(
  taskRun: TaskRun,
  fsSnapshot: FileSnapshot,
  qaCoverage: QaCoverage,
): TaskCompletionReport {
  return computeTaskCompletion(taskRun, qaCoverage, matchTaskRunOutputs(taskRun, fsSnapshot));
}
