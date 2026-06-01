import { z } from "zod";

import { ToolRegistry } from "./toolRegistry";
import type { DirectorProviderReviewState } from "./reviewState";
import {
  assertCurrentDirectorProviderRequest,
  setDirectorProviderRequest,
} from "./reviewState";
import {
  ingestMockProviderReturnForReview,
  mockSubmitProviderToolRequest,
  prepareProviderToolRequest,
  promoteMockProviderReturn,
} from "../tools";

export const directorPrototypeToolOrder = [
  "provider_prepare_request",
  "provider_mock_submit",
  "provider_ingest_mock_return",
  "provider_promote_reviewed_return",
] as const;

export const prepareInputSchema = z.object({
  providerId: z.enum(["image2", "jimeng"]),
  prompt: z.string().min(1),
  outputPath: z.string().min(1),
  negativePrompt: z.string().optional(),
  referenceAssetPaths: z.array(z.string()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  requestId: z.string().optional(),
  createdAt: z.string().optional(),
  fastTest: z.boolean().optional(),
  liveSubmitRequested: z.boolean().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  referenceImagePaths: z.array(z.string()).optional(),
  startFramePath: z.string().optional(),
  endFramePath: z.string().optional(),
  durationSeconds: z.number().positive().optional(),
  aspectRatio: z.string().optional(),
});

export const requestIdInputSchema = z.object({
  requestId: z.string().min(1),
  createdAt: z.string().optional(),
});

export const ingestInputSchema = z.object({
  requestId: z.string().min(1),
  headline: z.string().min(1),
  outputPath: z.string().min(1).optional(),
  artifactCount: z.number().int().positive().optional(),
  mimeType: z.string().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  durationSeconds: z.number().positive().optional(),
  receivedAt: z.string().optional(),
  warnings: z.array(z.string()).optional(),
});

type PrepareToolInput = z.infer<typeof prepareInputSchema>;
type RequestIdToolInput = z.infer<typeof requestIdInputSchema>;
type IngestToolInput = z.infer<typeof ingestInputSchema>;

export function createDirectorProviderRegistry(state: DirectorProviderReviewState): ToolRegistry {
  const registry = new ToolRegistry();

  registry.register({
    name: "provider_prepare_request",
    description: "Prepare a mock-only provider request for the selected shot.",
    schema: prepareInputSchema,
    execute: async (rawInput) => {
      const toolInput = rawInput as PrepareToolInput;
      const result = prepareProviderToolRequest(toolInput);
      if (!result.ok || !result.request) {
        throw new Error(result.blockers.join("; ") || "provider_prepare_request failed");
      }
      setDirectorProviderRequest(state, result.request);
      return result;
    },
  });

  registry.register({
    name: "provider_mock_submit",
    description: "Mock-submit the prepared provider request without live provider access.",
    schema: requestIdInputSchema,
    execute: async (rawInput) => {
      const toolInput = rawInput as RequestIdToolInput;
      assertCurrentDirectorProviderRequest(state, toolInput.requestId);
      const result = mockSubmitProviderToolRequest(state.request!, {}, toolInput.createdAt);
      if (!result.ok || !result.request) {
        throw new Error(result.blockers.join("; ") || "provider_mock_submit failed");
      }
      setDirectorProviderRequest(state, result.request);
      return result;
    },
  });

  registry.register({
    name: "provider_ingest_mock_return",
    description: "Ingest a mocked provider return and move it to review.",
    schema: ingestInputSchema,
    execute: async (rawInput) => {
      const toolInput = rawInput as IngestToolInput;
      assertCurrentDirectorProviderRequest(state, toolInput.requestId);
      const result = ingestMockProviderReturnForReview(state.request!, {
        headline: toolInput.headline,
        outputPath: toolInput.outputPath,
        artifactCount: toolInput.artifactCount,
        mimeType: toolInput.mimeType,
        width: toolInput.width,
        height: toolInput.height,
        durationSeconds: toolInput.durationSeconds,
        receivedAt: toolInput.receivedAt,
        warnings: toolInput.warnings,
      });
      if (!result.ok || !result.request) {
        throw new Error(result.blockers.join("; ") || "provider_ingest_mock_return failed");
      }
      setDirectorProviderRequest(state, result.request);
      return result;
    },
  });

  registry.register({
    name: "provider_promote_reviewed_return",
    description: "Promote a reviewed mock provider return into the preview-ready state.",
    schema: requestIdInputSchema,
    execute: async (rawInput) => {
      const toolInput = rawInput as RequestIdToolInput;
      assertCurrentDirectorProviderRequest(state, toolInput.requestId);
      const result = promoteMockProviderReturn(state.request!, {}, toolInput.createdAt);
      if (!result.ok || !result.request) {
        throw new Error(result.blockers.join("; ") || "provider_promote_reviewed_return failed");
      }
      setDirectorProviderRequest(state, result.request);
      return result;
    },
  });

  return registry;
}
