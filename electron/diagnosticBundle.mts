import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const DIAGNOSTIC_SIDECAR_PATHS = [
  ".vibe-runtime/agent-generation-job-ledger.json",
  ".vibe-runtime/agent-review-selection-ledger.json",
  ".vibe-runtime/agent-staged-plan.json",
  ".vibe-runtime/agent-timeline.json",
  ".vibe-runtime/agent-action-log.json",
  "reports/video_relay_queue.json",
  "reports/seedance_submit_report.json",
  "reports/seedance_resume_report.json",
] as const;

const sensitiveKeyPattern = /(?:api.?key|authorization|bearer|credential|password|secret|token)/i;
const errorKeyPattern = /(?:blocker|error|failure|message|reason|warning)/i;
const countArrayKeys = ["jobs", "entries", "items", "attempts", "receipts"];

function hashText(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function fileHash(filePath: string): string {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function redactRoot(value: string, root: string, replacement: string): string {
  if (!root) return value;
  const normalizedRoot = path.resolve(root).replace(/\\/g, "/");
  return value.replaceAll(normalizedRoot, replacement).replaceAll(`/private${normalizedRoot}`, replacement);
}

export function redactDiagnosticText(value: unknown, roots: string[] = []): string {
  let text = typeof value === "string" ? value : String(value ?? "");
  for (const [index, root] of roots.entries()) {
    text = redactRoot(text, root, `<root-${index + 1}>`);
  }
  text = text
    .replace(/(?:sk-|ghp_|github_pat_)[A-Za-z0-9_-]{12,}/g, "<redacted-secret>")
    .replace(/\b(?:Bearer|token|api[_-]?key|authorization|password|secret)\s*[:=]\s*[^\s,;]+/gi, "<redacted-secret>")
    .replace(/(?:file:\/\/)?\/(?:Users|home|private\/tmp|tmp)\/[^\s"'<>]+/g, "<redacted-path>")
    .replace(/(?<![:/A-Za-z0-9_])\/(?:[^/\s"'<>]+\/)*[^/\s"'<>]+/g, "<redacted-path>")
    .replace(/[A-Za-z]:\\(?:[^\s"'<>]+\\)*[^\s"'<>]*/g, "<redacted-path>")
    .replace(/(?:<root-\d+>\/)?(?:[^\s"'<>]+\/)*[^\s"'<>]+\.(?:mp4|mov|m4v|webm|png|jpe?g|webp|gif|wav|mp3|m4a|aac|flac)\b/gi, "<redacted-media-path>");
  return text.slice(0, 2_000);
}

function statusCounts(value: unknown, roots: string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  const visit = (current: unknown, depth: number) => {
    if (depth > 6 || current === null || current === undefined) return;
    if (Array.isArray(current)) {
      current.slice(0, 500).forEach((item) => visit(item, depth + 1));
      return;
    }
    if (typeof current !== "object") return;
    for (const [key, item] of Object.entries(current as Record<string, unknown>)) {
      if (sensitiveKeyPattern.test(key)) continue;
      if (key === "status" && typeof item === "string" && item.trim()) {
        const status = redactDiagnosticText(item.trim(), roots).slice(0, 80);
        counts[status] = (counts[status] || 0) + 1;
      }
      visit(item, depth + 1);
    }
  };
  visit(value, 0);
  return counts;
}

function recentErrors(value: unknown, roots: string[]): string[] {
  const errors: string[] = [];
  const visit = (current: unknown, parentKey: string, depth: number) => {
    if (errors.length >= 20 || depth > 6 || current === null || current === undefined) return;
    if (Array.isArray(current)) {
      current.slice(-50).forEach((item) => visit(item, parentKey, depth + 1));
      return;
    }
    if (typeof current !== "object") {
      if (errorKeyPattern.test(parentKey) && typeof current === "string" && current.trim()) {
        errors.push(redactDiagnosticText(current, roots));
      }
      return;
    }
    for (const [key, item] of Object.entries(current as Record<string, unknown>)) {
      if (sensitiveKeyPattern.test(key)) continue;
      visit(item, key, depth + 1);
    }
  };
  visit(value, "", 0);
  return [...new Set(errors)].slice(-12);
}

function recordCount(value: unknown): number {
  if (!value || typeof value !== "object" || Array.isArray(value)) return 0;
  for (const key of countArrayKeys) {
    const rows = (value as Record<string, unknown>)[key];
    if (Array.isArray(rows)) return rows.length;
  }
  return 1;
}

export function summarizeDiagnosticSidecar(relativePath: string, value: unknown, roots: string[] = []) {
  const record = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  return {
    relativePath,
    schemaVersion: typeof record.schemaVersion === "string" ? redactDiagnosticText(record.schemaVersion, roots).slice(0, 120) : undefined,
    topLevelStatus: typeof record.status === "string" ? redactDiagnosticText(record.status, roots).slice(0, 80) : undefined,
    recordCount: recordCount(value),
    statusCounts: statusCounts(value, roots),
    recentErrors: recentErrors(value, roots),
  };
}

function readJson(filePath: string): unknown {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    return { status: "unreadable", error: error instanceof Error ? error.message : String(error) };
  }
}

function safeProjectFile(projectRoot: string, filePath: string): string | undefined {
  try {
    const canonicalRoot = fs.realpathSync(projectRoot);
    const canonicalFile = fs.realpathSync(filePath);
    const relativePath = path.relative(canonicalRoot, canonicalFile);
    if (!relativePath || relativePath.startsWith("..") || path.isAbsolute(relativePath)) return undefined;
    return fs.statSync(canonicalFile).isFile() ? canonicalFile : undefined;
  } catch {
    return undefined;
  }
}

function runDitto(dittoPath: string, sourcePath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(dittoPath, ["-c", "-k", "--keepParent", sourcePath, outputPath], {
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stderr = "";
    child.stderr.on("data", (chunk) => { stderr += String(chunk).slice(0, 8_000); });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`diagnostic archive failed (${code}): ${stderr.trim()}`));
    });
  });
}

export interface ExportDiagnosticBundleInput {
  outputPath: string;
  projectRoot?: string;
  userDataRoot?: string;
  runtimeRoot?: string;
  runtimeLogs?: string[];
  recentMainErrors?: string[];
  appInfo: {
    name: string;
    version: string;
    packaged: boolean;
    platform: string;
    arch: string;
    electron: string;
    node: string;
  };
  generatedAt?: string;
  tempRoot?: string;
  dittoPath?: string;
}

export async function exportDiagnosticBundle(input: ExportDiagnosticBundleInput) {
  const outputPath = path.resolve(input.outputPath);
  if (path.extname(outputPath).toLowerCase() !== ".zip") {
    throw new Error("Diagnostic export path must end with .zip");
  }
  const tempRoot = input.tempRoot || os.tmpdir();
  const workRoot = fs.mkdtempSync(path.join(tempRoot, "vibe-director-diagnostics-"));
  const bundleRoot = path.join(workRoot, "Vibe Director Diagnostics");
  const roots = [input.projectRoot, input.userDataRoot, input.runtimeRoot, workRoot].filter((value): value is string => Boolean(value));
  try {
    fs.mkdirSync(bundleRoot, { recursive: true });
    const sidecars = (input.projectRoot ? DIAGNOSTIC_SIDECAR_PATHS : []).flatMap((relativePath) => {
      const filePath = safeProjectFile(input.projectRoot!, path.join(input.projectRoot!, relativePath));
      if (!filePath) return [];
      return [summarizeDiagnosticSidecar(relativePath, readJson(filePath), roots)];
    });
    const projectVibePath = input.projectRoot
      ? safeProjectFile(input.projectRoot, path.join(input.projectRoot, "project.vibe")) || ""
      : "";
    const generatedAt = input.generatedAt || new Date().toISOString();
    const manifest = {
      schemaVersion: "vibe_director_diagnostic_bundle/1.0.0",
      generatedAt,
      app: input.appInfo,
      project: {
        bound: Boolean(input.projectRoot),
        identityHash: input.projectRoot ? `sha256:${hashText(path.resolve(input.projectRoot))}` : undefined,
        projectVibePresent: Boolean(projectVibePath && fs.existsSync(projectVibePath)),
        projectVibeSha256: projectVibePath && fs.existsSync(projectVibePath) ? `sha256:${fileHash(projectVibePath)}` : undefined,
      },
      sidecars,
      recentMainErrors: (input.recentMainErrors || []).map((line) => redactDiagnosticText(line, roots)).slice(-20),
      privacy: {
        credentialsIncluded: false,
        tokensIncluded: false,
        fullProjectFilesIncluded: false,
        mediaIncluded: false,
        absolutePathsIncluded: false,
      },
    };
    const runtimeLog = (input.runtimeLogs || [])
      .map((line) => redactDiagnosticText(line, roots))
      .filter(Boolean)
      .slice(-400)
      .join("\n");
    fs.writeFileSync(path.join(bundleRoot, "diagnostics.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    fs.writeFileSync(path.join(bundleRoot, "runtime.log"), runtimeLog ? `${runtimeLog}\n` : "No runtime log lines were captured.\n", "utf8");
    fs.writeFileSync(
      path.join(bundleRoot, "README.txt"),
      "This support bundle contains app/runtime metadata, redacted log lines, and structural sidecar summaries. It excludes credentials, tokens, full project files, and media.\n",
      "utf8",
    );
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.rmSync(outputPath, { force: true });
    await runDitto(input.dittoPath || "/usr/bin/ditto", bundleRoot, outputPath);
    const size = fs.statSync(outputPath).size;
    return {
      filePath: outputPath,
      fileName: path.basename(outputPath),
      size,
      sha256: fileHash(outputPath),
      sidecarCount: sidecars.length,
      generatedAt,
    };
  } finally {
    fs.rmSync(workRoot, { recursive: true, force: true });
  }
}
