import type { ExecutionLedgerOutputSandbox } from "./executionLedger";

const absolutePathPattern = /^(?:[A-Za-z]:[\\/]|\/|\/\/|~[\\/])/;
const parentTraversalPattern = /(?:^|\/)\.\.(?:\/|$)/;

export function normalizePath(value: string): string {
  return value.trim().replace(/\\/g, "/").replace(/\/+/g, "/").replace(/\/$/, "");
}

export function isAbsoluteLike(value: string): boolean {
  return absolutePathPattern.test(value.trim());
}

export function hasParentTraversal(value: string): boolean {
  return parentTraversalPattern.test(normalizePath(value));
}

export function pathInsidePrefix(path: string, prefix: string): boolean {
  const normalizedPath = normalizePath(path);
  const normalizedPrefix = normalizePath(prefix);
  return normalizedPath === normalizedPrefix || normalizedPath.startsWith(`${normalizedPrefix}/`);
}

export function pathInsideSandbox(path: string, sandbox: ExecutionLedgerOutputSandbox): boolean {
  if (!path.trim() || isAbsoluteLike(path) || hasParentTraversal(path)) return false;
  return sandbox.allowedPrefixes.some((prefix) => pathInsidePrefix(path, prefix));
}

export function validateSandboxPath(
  filePath: string,
  sandbox: ExecutionLedgerOutputSandbox,
): string | undefined {
  if (!filePath.trim()) return "Output file path is empty.";
  if (isAbsoluteLike(filePath)) return `Output file path must be project-root-relative: ${filePath}`;
  if (hasParentTraversal(filePath)) return `Output file path must not contain parent traversal: ${filePath}`;
  if (!pathInsideSandbox(filePath, sandbox)) return `Output file path must stay inside the output sandbox: ${filePath}`;
  return undefined;
}

export function sandboxPathValid(filePath: string, sandbox: ExecutionLedgerOutputSandbox): boolean {
  return validateSandboxPath(filePath, sandbox) === undefined;
}

export function sandboxResolvePath(fileName: string, sandbox: ExecutionLedgerOutputSandbox): string {
  const normalized = normalizePath(fileName);
  if (pathInsideSandbox(normalized, sandbox)) return normalized;
  return `${normalizePath(sandbox.root)}/${normalized.replace(/^\/+/, "")}`;
}
