import type { LanguageModel, ModelMessage, ToolSet } from "ai";

import type { DirectorAgentPlan } from "./directorAgentPlan";
import { directorPrototypeToolOrder } from "./directorAgentProviderTools";
import type { LLMCallResult, LLMProvider } from "./llmProvider";

export const directorPrototypeAgentConfig = {
  provider: {
    model: {} as LanguageModel,
    systemPrompt: "You are a mock-only director prototype loop. Use the provider boundary tools in order.",
  },
  session: { maxTurnsBeforeCompaction: 10 },
  maxTurns: 8,
} as const;

export function createDirectorAgentMockProvider(plan: DirectorAgentPlan): LLMProvider {
  let step = 0;
  return {
    async call(_messages: ModelMessage[], tools?: ToolSet): Promise<LLMCallResult> {
      step += 1;
      for (const toolName of directorPrototypeToolOrder) {
        if (!tools?.[toolName]) throw new Error(`Missing registered tool: ${toolName}`);
      }

      if (step === 1) {
        return {
          text: null,
          toolCalls: [
            {
              id: "prototype-tool-prepare",
              name: "provider_prepare_request",
              args: {
                providerId: plan.providerId,
                prompt: plan.prompt,
                outputPath: plan.outputPath,
                requestId: plan.requestId,
                createdAt: plan.createdAt,
                fastTest: true,
                liveSubmitRequested: false,
                width: 1024,
                height: 576,
                metadata: {
                  selectedShotId: plan.selectedShotId,
                  prototypeLoop: true,
                },
              },
            },
          ],
          finishReason: "tool-calls",
          usage: { inputTokens: 40, outputTokens: 12 },
        };
      }

      if (step === 2) {
        return {
          text: null,
          toolCalls: [
            {
              id: "prototype-tool-submit",
              name: "provider_mock_submit",
              args: {
                requestId: plan.requestId,
                createdAt: plan.createdAt,
              },
            },
          ],
          finishReason: "tool-calls",
          usage: { inputTokens: 48, outputTokens: 8 },
        };
      }

      if (step === 3) {
        return {
          text: null,
          toolCalls: [
            {
              id: "prototype-tool-ingest",
              name: "provider_ingest_mock_return",
              args: {
                requestId: plan.requestId,
                headline: "Mock provider output is ready for director review.",
                outputPath: plan.outputPath,
                artifactCount: 1,
                mimeType: "image/png",
                width: 1024,
                height: 576,
                receivedAt: plan.createdAt,
              },
            },
          ],
          finishReason: "tool-calls",
          usage: { inputTokens: 52, outputTokens: 10 },
        };
      }

      if (step === 4) {
        return {
          text: null,
          toolCalls: [
            {
              id: "prototype-tool-promote",
              name: "provider_promote_reviewed_return",
              args: {
                requestId: plan.requestId,
                createdAt: plan.createdAt,
              },
            },
          ],
          finishReason: "tool-calls",
          usage: { inputTokens: 55, outputTokens: 8 },
        };
      }

      return {
        text: `Mock-only provider return promoted for ${plan.selectedShotId}.`,
        toolCalls: [],
        finishReason: "stop",
        usage: { inputTokens: 60, outputTokens: 11 },
      };
    },
  };
}
