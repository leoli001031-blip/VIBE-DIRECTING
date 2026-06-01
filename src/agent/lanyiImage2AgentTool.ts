import { basename, dirname, isAbsolute, relative, resolve } from "node:path";
import { z } from "zod";

import type { TaskEnvelope } from "../core/types";
import type { ToolContext, ToolDefinition } from "./toolRegistry";

export const lanyiImage2AgentToolName = "lanyi_image2_agent_tool";
export const lanyiImage2AgentToolSchemaVersion = "0.1.0";

export type LanyiImage2AgentProviderMode = "mock_lanyi_image2_provider" | "real_lanyi_image2_provider";
export type LanyiImage2AgentResultStatus = "mock_candidate_ready" | "real_provider_gated";

const lanyiImage2ReferenceSchema = z.object({
  id: z.string().min(1),
  path: z.string().min(1),
  role: z.string().min(1),
}).strict();

const structuredImageTaskSchema = z.object({
  kind: z.literal("structured_lanyi_image2_task"),
  taskEnvelopeId: z.string().min(1),
  promptText: z.string().min(1),
  requiredMode: z.enum(["text2image", "image2image"]),
  expectedOutputPath: z.string().min(1),
  references: z.array(lanyiImage2ReferenceSchema).default([]),
  qaChecklist: z.array(z.string().min(1)).default([]),
}).strict();

const validatedEnvelopeTaskSchema = z.object({
  kind: z.literal("validated_task_envelope_ref"),
  taskEnvelopeId: z.string().min(1),
  expectedOutputPath: z.string().min(1).optional(),
}).strict();

export const lanyiImage2AgentToolInputSchema = z.discriminatedUnion("kind", [
  structuredImageTaskSchema,
  validatedEnvelopeTaskSchema,
]);

export type LanyiImage2AgentToolInput = z.infer<typeof lanyiImage2AgentToolInputSchema>;

export interface LanyiImage2AgentToolConfig {
  providerMode?: LanyiImage2AgentProviderMode;
  model?: string;
  baseUrl?: string;
  allowedOutputPrefixes?: string[];
}

export interface LanyiImage2ReceiptCandidate {
  id: string;
  kind: "lanyi_image2_receipt_candidate";
  schemaVersion: typeof lanyiImage2AgentToolSchemaVersion;
  providerMode: LanyiImage2AgentProviderMode;
  providerId: "lanyi-image2";
  model: string;
  taskEnvelopeId: string;
  expectedOutputPath: string;
  evidenceRef: string;
  providerCalled: false;
  status: "candidate";
  reviewRequired: true;
  promotionAllowed: false;
}

export interface LanyiImage2EvidenceCandidate {
  id: string;
  kind: "lanyi_image2_evidence_candidate";
  schemaVersion: typeof lanyiImage2AgentToolSchemaVersion;
  taskEnvelopeId: string;
  evidenceRef: string;
  expectedOutputPath: string;
  promptHash: string;
  referenceCount: number;
  qaChecklist: string[];
}

export interface LanyiImage2RealProviderGateContract {
  mode: "real_provider_gated_contract";
  providerMode: "real_lanyi_image2_provider";
  baseUrl: string;
  model: string;
  endpoint: "/v1/images/generations" | "/v1/images/edits";
  providerCalled: false;
  networkIoAllowed: false;
  requiresExplicitMainThreadConfirmation: true;
  requiresScopedCredentialRef: true;
  blockedReason: "real_provider_submit_not_enabled_in_owned_agent_loop";
}

export interface LanyiImage2SubmitPlanCandidate {
  id: string;
  kind: "lanyi_image2_submit_plan_candidate";
  schemaVersion: typeof lanyiImage2AgentToolSchemaVersion;
  status: "awaiting_explicit_permission_receipt";
  providerMode: LanyiImage2AgentProviderMode;
  providerId: "lanyi-image2";
  model: string;
  providerSlot: TaskEnvelope["providerSlot"];
  requiredMode: TaskEnvelope["requiredMode"];
  taskEnvelopeId: string;
  inputHash: string;
  permissionReceiptId: string;
  shotId: string;
  expectedOutputPath: string;
  referenceCount: number;
  providerCalled: false;
  networkIoAllowed: false;
  liveSubmitAllowed: false;
  requiresRuntimeConfirmation: true;
  promotionAllowed: false;
}

export interface LanyiImage2AgentToolResult {
  kind: "lanyi_image2_agent_tool_result";
  schemaVersion: typeof lanyiImage2AgentToolSchemaVersion;
  status: LanyiImage2AgentResultStatus;
  providerMode: LanyiImage2AgentProviderMode;
  providerId: "lanyi-image2";
  model: string;
  taskEnvelopeId: string;
  expectedOutputPath: string;
  evidenceRef: string;
  receiptCandidate: LanyiImage2ReceiptCandidate;
  evidenceCandidate: LanyiImage2EvidenceCandidate;
  submitPlanCandidate: LanyiImage2SubmitPlanCandidate;
  realProviderGateContract?: LanyiImage2RealProviderGateContract;
  providerCalled: false;
  promotionAllowed: false;
}

const defaultAllowedOutputPrefixes = ["output", "outputs", "planned", "evidence", "receipts", "test_artifacts"];

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",")}}`;
}

function hashValue(prefix: string, value: unknown): string {
  const input = stableStringify(value);
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${prefix}_${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function safeId(value: string): string {
  return value.trim().replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/^_+|_+$/g, "") || "task";
}

function normalizeRelativePath(path: string): string {
  const normalized = path.trim().replace(/\\/g, "/").replace(/^\.?\//, "");
  if (!normalized || normalized.endsWith("/") || normalized.startsWith("~/") || isAbsolute(normalized) || normalized.split("/").includes("..")) {
    throw new Error(`Lanyi Image2 expectedOutputPath must be project-relative and scoped: ${path}`);
  }
  return normalized;
}

function normalizePrefix(prefix: string): string {
  return normalizeRelativePath(prefix).replace(/\/+$/, "");
}

function assertAllowedOutputPrefix(path: string, allowedPrefixes: string[]): void {
  const allowed = allowedPrefixes.map(normalizePrefix);
  if (!allowed.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) {
    throw new Error(`Lanyi Image2 expectedOutputPath must stay under ${allowed.join(", ")}: ${path}`);
  }
}

function scopedExpectedOutputPath(context: ToolContext, requestedPath: string, allowedPrefixes: string[]) {
  const relativePath = normalizeRelativePath(requestedPath);
  assertAllowedOutputPrefix(relativePath, allowedPrefixes);
  const root = resolve(context.sandboxRoot);
  const absolutePath = resolve(root, relativePath);
  const scopedRelative = relative(root, absolutePath);
  if (scopedRelative === "" || scopedRelative.startsWith("..") || isAbsolute(scopedRelative)) {
    throw new Error(`Lanyi Image2 expectedOutputPath escaped sandbox: ${requestedPath}`);
  }
  return relativePath;
}

function taskEnvelopeFromContext(context: ToolContext): TaskEnvelope {
  const envelope = context.taskEnvelope as unknown as TaskEnvelope;
  if (!envelope || typeof envelope.id !== "string") {
    throw new Error("Lanyi Image2 agent tool requires a TaskEnvelope in tool context.");
  }
  return envelope;
}

function shotIdFromTask(envelope: TaskEnvelope, expectedOutputPath: string): string {
  if (envelope.keyframePairDerivation?.shotId) return envelope.keyframePairDerivation.shotId;
  const normalized = expectedOutputPath.replace(/\\/g, "/");
  const segments = normalized.split("/").filter(Boolean);
  const shotsIndex = segments.findIndex((segment) => segment.toLowerCase() === "shots");
  if (shotsIndex >= 0 && segments[shotsIndex + 1]) return segments[shotsIndex + 1];
  const base = basename(normalized).replace(/\.[^.]+$/, "");
  const stripped = base.replace(/(?:[_-]?(?:start|end|frame|keyframe|image))+$/i, "").replace(/^[_-]+|[_-]+$/g, "");
  if (stripped && !/^(start|end|frame|image)$/i.test(stripped)) return stripped;
  const parent = basename(dirname(normalized));
  if (parent && !/^(outputs?|keyframes?|shots?)$/i.test(parent)) return parent;
  return safeId(envelope.id);
}

function providerEndpoint(requiredMode: TaskEnvelope["requiredMode"]): LanyiImage2RealProviderGateContract["endpoint"] {
  return requiredMode === "image2image" ? "/v1/images/edits" : "/v1/images/generations";
}

function structuredTaskFromInput(input: LanyiImage2AgentToolInput, envelope: TaskEnvelope) {
  if (input.taskEnvelopeId !== envelope.id) {
    throw new Error(`Lanyi Image2 taskEnvelopeId mismatch: ${input.taskEnvelopeId}`);
  }

  if (input.kind === "structured_lanyi_image2_task") {
    return {
      promptText: input.promptText,
      requiredMode: input.requiredMode,
      expectedOutputPath: input.expectedOutputPath,
      references: input.references,
      qaChecklist: input.qaChecklist,
    };
  }

  const expectedOutputPath = input.expectedOutputPath || envelope.outputPath || envelope.expectedOutputs[0];
  if (!expectedOutputPath) {
    throw new Error("Lanyi Image2 validated TaskEnvelope input requires expectedOutputPath or expectedOutputs[0].");
  }

  return {
    promptText: [
      envelope.storyFunction || envelope.purpose,
      `providerSlot=${envelope.providerSlot}`,
      `requiredMode=${envelope.requiredMode}`,
      `sourceIndexHash=${envelope.sourceIndexHash}`,
    ].filter(Boolean).join("\n"),
    requiredMode: envelope.requiredMode,
    expectedOutputPath,
    references: envelope.references.map((reference) => ({
      id: reference.id,
      path: reference.path,
      role: reference.referenceRole,
    })),
    qaChecklist: envelope.qaChecklist,
  };
}

export function createLanyiImage2AgentTool(config: LanyiImage2AgentToolConfig = {}): ToolDefinition<LanyiImage2AgentToolInput, LanyiImage2AgentToolResult> {
  const providerMode = config.providerMode || "mock_lanyi_image2_provider";
  const model = config.model || "gpt-image-2";
  const baseUrl = (config.baseUrl || "https://lanyiapi.com").replace(/\/+$/, "");
  const allowedOutputPrefixes = config.allowedOutputPrefixes || defaultAllowedOutputPrefixes;

  return {
    name: lanyiImage2AgentToolName,
    description: "Prepare a structured Lanyi Image2 candidate from a validated TaskEnvelope or structured image task. This tool is dry-run by default and never promotes outputs.",
    schema: lanyiImage2AgentToolInputSchema,
    async execute(input, context): Promise<LanyiImage2AgentToolResult> {
      const parsedInput = lanyiImage2AgentToolInputSchema.parse(input);
      const envelope = taskEnvelopeFromContext(context);
      const structuredTask = structuredTaskFromInput(parsedInput, envelope);
      const expectedOutputPath = scopedExpectedOutputPath(context, structuredTask.expectedOutputPath, allowedOutputPrefixes);
      const evidenceId = hashValue("lanyi_image2_evidence", {
        providerMode,
        model,
        taskEnvelopeId: envelope.id,
        expectedOutputPath,
        promptText: structuredTask.promptText,
        references: structuredTask.references,
        qaChecklist: structuredTask.qaChecklist,
      });
      const evidenceRef = `lanyi_image2_agent_tool#${evidenceId}`;
      const inputHash = envelope.inputHash || hashValue("lanyi_image2_input", envelope);
      const shotId = shotIdFromTask(envelope, expectedOutputPath);
      const receiptCandidate: LanyiImage2ReceiptCandidate = {
        id: `lanyi_image2_receipt_${safeId(envelope.id)}_${evidenceId.replace(/^lanyi_image2_evidence_/, "")}`,
        kind: "lanyi_image2_receipt_candidate",
        schemaVersion: lanyiImage2AgentToolSchemaVersion,
        providerMode,
        providerId: "lanyi-image2",
        model,
        taskEnvelopeId: envelope.id,
        expectedOutputPath,
        evidenceRef,
        providerCalled: false,
        status: "candidate",
        reviewRequired: true,
        promotionAllowed: false,
      };
      const submitPlanCandidate: LanyiImage2SubmitPlanCandidate = {
        id: `lanyi_image2_submit_plan_${safeId(envelope.id)}_${evidenceId.replace(/^lanyi_image2_evidence_/, "")}`,
        kind: "lanyi_image2_submit_plan_candidate",
        schemaVersion: lanyiImage2AgentToolSchemaVersion,
        status: "awaiting_explicit_permission_receipt",
        providerMode,
        providerId: "lanyi-image2",
        model,
        providerSlot: envelope.providerSlot,
        requiredMode: structuredTask.requiredMode,
        taskEnvelopeId: envelope.id,
        inputHash,
        permissionReceiptId: `manual_permission_required:${shotId}`,
        shotId,
        expectedOutputPath,
        referenceCount: structuredTask.references.length,
        providerCalled: false,
        networkIoAllowed: false,
        liveSubmitAllowed: false,
        requiresRuntimeConfirmation: true,
        promotionAllowed: false,
      };
      const evidenceCandidate: LanyiImage2EvidenceCandidate = {
        id: evidenceId,
        kind: "lanyi_image2_evidence_candidate",
        schemaVersion: lanyiImage2AgentToolSchemaVersion,
        taskEnvelopeId: envelope.id,
        evidenceRef,
        expectedOutputPath,
        promptHash: hashValue("lanyi_image2_prompt", structuredTask.promptText),
        referenceCount: structuredTask.references.length,
        qaChecklist: structuredTask.qaChecklist,
      };

      return {
        kind: "lanyi_image2_agent_tool_result",
        schemaVersion: lanyiImage2AgentToolSchemaVersion,
        status: providerMode === "real_lanyi_image2_provider" ? "real_provider_gated" : "mock_candidate_ready",
        providerMode,
        providerId: "lanyi-image2",
        model,
        taskEnvelopeId: envelope.id,
	        expectedOutputPath,
	        evidenceRef,
	        receiptCandidate,
	        evidenceCandidate,
	        submitPlanCandidate,
	        realProviderGateContract: providerMode === "real_lanyi_image2_provider"
	          ? {
	              mode: "real_provider_gated_contract",
	              providerMode: "real_lanyi_image2_provider",
	              baseUrl,
	              model,
	              endpoint: providerEndpoint(structuredTask.requiredMode),
	              providerCalled: false,
	              networkIoAllowed: false,
              requiresExplicitMainThreadConfirmation: true,
              requiresScopedCredentialRef: true,
              blockedReason: "real_provider_submit_not_enabled_in_owned_agent_loop",
            }
          : undefined,
        providerCalled: false,
        promotionAllowed: false,
      };
    },
  };
}
