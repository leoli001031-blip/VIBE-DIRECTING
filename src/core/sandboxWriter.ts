import { createHash } from "node:crypto";
import { writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { ExecutionLedgerOutputSandbox } from "./executionLedger";
import {
  normalizePath,
  validateSandboxPath,
  pathInsideSandbox,
} from "./sandboxPathUtils";

export const sandboxWriterSchemaVersion = "0.1.0";

export type SandboxWriteResultStatus = "written" | "blocked_path" | "blocked_io_error";

export interface SandboxWriteResult {
  filePath: string;
  status: SandboxWriteResultStatus;
  hash?: string;
  hashAlgorithm?: "sha256";
  sizeBytes?: number;
  writtenAt?: string;
  blocker?: string;
}

export { sandboxPathValid, sandboxResolvePath } from "./sandboxPathUtils";

function computeSha256(content: Buffer | string): string {
  return createHash("sha256").update(content).digest("hex");
}

export async function sandboxWriteFile(
  filePath: string,
  content: Buffer | string,
  sandbox: ExecutionLedgerOutputSandbox,
): Promise<SandboxWriteResult> {
  const normalizedPath = normalizePath(filePath);
  const blocker = validateSandboxPath(normalizedPath, sandbox);
  if (blocker) {
    return { filePath: normalizedPath, status: "blocked_path", blocker };
  }

  try {
    const dir = dirname(normalizedPath);
    await mkdir(dir, { recursive: true });
    await writeFile(normalizedPath, content);
    const hash = computeSha256(content);
    const size = Buffer.isBuffer(content)
      ? content.length
      : Buffer.byteLength(content, "utf8");

    return {
      filePath: normalizedPath,
      status: "written",
      hash,
      hashAlgorithm: "sha256",
      sizeBytes: size,
      writtenAt: new Date().toISOString(),
    };
  } catch (error) {
    return {
      filePath: normalizedPath,
      status: "blocked_io_error",
      blocker: error instanceof Error ? error.message : "Unknown I/O error",
    };
  }
}

export async function sandboxWriteJsonFile(
  filePath: string,
  data: unknown,
  sandbox: ExecutionLedgerOutputSandbox,
): Promise<SandboxWriteResult> {
  const json = JSON.stringify(data, null, 2);
  return sandboxWriteFile(filePath, json, sandbox);
}

export interface SandboxFileHashResult {
  filePath: string;
  exists: boolean;
  hash?: string;
  hashAlgorithm?: "sha256";
  blocker?: string;
}

export async function sandboxComputeFileHash(
  filePath: string,
  sandbox: ExecutionLedgerOutputSandbox,
  readFileFn: (path: string) => Promise<Buffer>,
): Promise<SandboxFileHashResult> {
  const normalizedPath = normalizePath(filePath);
  const blocker = validateSandboxPath(normalizedPath, sandbox);
  if (blocker) {
    return { filePath: normalizedPath, exists: false, blocker };
  }

  try {
    const content = await readFileFn(normalizedPath);
    return {
      filePath: normalizedPath,
      exists: true,
      hash: computeSha256(content),
      hashAlgorithm: "sha256",
    };
  } catch {
    return { filePath: normalizedPath, exists: false };
  }
}
