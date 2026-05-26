import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { z } from "zod";

import type { ToolContext, ToolDefinition } from "./toolRegistry";

const fileToolInputSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("write_text"),
    path: z.string().min(1),
    content: z.string(),
  }),
  z.object({
    action: z.literal("read_text"),
    path: z.string().min(1),
  }),
]);

type AgentFileToolInput = z.infer<typeof fileToolInputSchema>;

export interface AgentFileToolConfig {
  allowedRelativePrefixes?: string[];
}

export interface AgentFileToolResult {
  action: AgentFileToolInput["action"];
  path: string;
  bytes: number;
  hash: string;
  content?: string;
  evidenceRef: string;
}

const defaultAllowedPrefixes = ["output", "outputs", "evidence", "receipts"];

function normalizeRelativePath(path: string): string {
  const normalized = path.trim().replace(/\\/g, "/").replace(/^\.?\//, "");
  if (!normalized || normalized.endsWith("/") || normalized.startsWith("~/") || isAbsolute(normalized) || normalized.split("/").includes("..")) {
    throw new Error(`Agent file path must be project-relative and scoped: ${path}`);
  }
  return normalized;
}

function normalizePrefix(prefix: string): string {
  return normalizeRelativePath(prefix).replace(/\/+$/, "");
}

function assertAllowedPrefix(path: string, allowedPrefixes: string[]): void {
  const allowed = allowedPrefixes.map(normalizePrefix);
  if (!allowed.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) {
    throw new Error(`Agent file path must stay under ${allowed.join(", ")}: ${path}`);
  }
}

function resolveScopedPath(context: ToolContext, path: string, allowedPrefixes: string[]): { relativePath: string; absolutePath: string } {
  const relativePath = normalizeRelativePath(path);
  assertAllowedPrefix(relativePath, allowedPrefixes);
  const root = resolve(context.sandboxRoot);
  const absolutePath = resolve(root, relativePath);
  const scopedRelative = relative(root, absolutePath);
  if (scopedRelative === "" || scopedRelative.startsWith("..") || isAbsolute(scopedRelative)) {
    throw new Error(`Agent file path escaped sandbox: ${path}`);
  }
  return { relativePath, absolutePath };
}

function hashString(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `agent_file_${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function createAgentFileTool(config: AgentFileToolConfig = {}): ToolDefinition<AgentFileToolInput, AgentFileToolResult> {
  const allowedPrefixes = config.allowedRelativePrefixes || defaultAllowedPrefixes;
  return {
    name: "agent_file",
    description: "Read or write controlled text evidence inside the agent sandbox. Paths must stay under output, outputs, evidence, or receipts.",
    schema: fileToolInputSchema,
    async execute(input, context): Promise<AgentFileToolResult> {
      const target = resolveScopedPath(context, input.path, allowedPrefixes);
      if (input.action === "write_text") {
        await mkdir(dirname(target.absolutePath), { recursive: true });
        await writeFile(target.absolutePath, input.content, "utf8");
        return {
          action: input.action,
          path: target.relativePath,
          bytes: Buffer.byteLength(input.content, "utf8"),
          hash: hashString(input.content),
          evidenceRef: `agent_file#${target.relativePath}`,
        };
      }

      const content = await readFile(target.absolutePath, "utf8");
      return {
        action: input.action,
        path: target.relativePath,
        bytes: Buffer.byteLength(content, "utf8"),
        hash: hashString(content),
        content,
        evidenceRef: `agent_file#${target.relativePath}`,
      };
    },
  };
}
