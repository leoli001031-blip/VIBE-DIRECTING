import {
  createImage2Provider,
  createJimengProvider,
  type Image2Provider,
  type JimengProvider,
} from "../providers/mockAdapters";
import type {
  Image2ProviderInput,
  JimengProviderInput,
  ProviderBoundaryInput,
  ProviderBoundaryRequest,
  ProviderId,
  ProviderOutputPath,
  ProviderReturnSummaryInput,
} from "../providers/providerBoundary";

export interface ProviderToolDescriptor {
  name: "provider_prepare_request" | "provider_mock_submit" | "provider_ingest_mock_return" | "provider_promote_reviewed_return";
  description: string;
  fastTestOnly: true;
  liveSubmitAllowed: false;
  credentialsAllowed: false;
}

export interface ProviderPrepareToolInput {
  providerId: ProviderId;
  prompt: string;
  outputPath: ProviderOutputPath;
  negativePrompt?: string;
  referenceAssetPaths?: string[];
  metadata?: Record<string, unknown>;
  requestId?: string;
  createdAt?: string;
  fastTest?: boolean;
  liveSubmitRequested?: boolean;
  width?: number;
  height?: number;
  referenceImagePaths?: string[];
  startFramePath?: string;
  endFramePath?: string;
  durationSeconds?: number;
  aspectRatio?: string;
}

export interface ProviderToolResult<TRequest extends ProviderBoundaryRequest = ProviderBoundaryRequest> {
  ok: boolean;
  request?: TRequest;
  blockers: string[];
  warnings: string[];
}

export interface ProviderBoundaryToolAdapters {
  image2?: Image2Provider;
  jimeng?: JimengProvider;
}

export const providerToolDescriptors: ProviderToolDescriptor[] = [
  {
    name: "provider_prepare_request",
    description: "Prepare a provider request with an input hash and mock-only submit policy.",
    fastTestOnly: true,
    liveSubmitAllowed: false,
    credentialsAllowed: false,
  },
  {
    name: "provider_mock_submit",
    description: "Attach a mock request receipt and move the request to submitted without a provider call.",
    fastTestOnly: true,
    liveSubmitAllowed: false,
    credentialsAllowed: false,
  },
  {
    name: "provider_ingest_mock_return",
    description: "Attach an output path and response summary from a mocked provider return.",
    fastTestOnly: true,
    liveSubmitAllowed: false,
    credentialsAllowed: false,
  },
  {
    name: "provider_promote_reviewed_return",
    description: "Promote a human-reviewed mock return into the promoted state.",
    fastTestOnly: true,
    liveSubmitAllowed: false,
    credentialsAllowed: false,
  },
];

export function prepareProviderToolRequest(
  input: ProviderPrepareToolInput,
  adapters: ProviderBoundaryToolAdapters = {},
): ProviderToolResult {
  if (input.liveSubmitRequested) {
    return {
      ok: false,
      blockers: ["Live provider submit is outside the Provider/tools boundary and is forbidden in fast tests."],
      warnings: [],
    };
  }

  if (input.providerId === "image2") {
    const adapter = adapters.image2 ?? createImage2Provider();
    const requestInput: Image2ProviderInput = {
      prompt: input.prompt,
      outputPath: input.outputPath,
      negativePrompt: input.negativePrompt,
      referenceAssetPaths: input.referenceAssetPaths,
      metadata: input.metadata,
      width: input.width,
      height: input.height,
      referenceImagePaths: input.referenceImagePaths,
    };
    const planned = adapter.prepareRequest(requestInput, {
      requestId: input.requestId,
      createdAt: input.createdAt,
      fastTest: input.fastTest ?? true,
    });

    return {
      ok: true,
      request: adapter.markReady(planned, input.createdAt),
      blockers: [],
      warnings: [],
    };
  }

  const adapter = adapters.jimeng ?? createJimengProvider();
  const requestInput: JimengProviderInput = {
    prompt: input.prompt,
    outputPath: input.outputPath,
    negativePrompt: input.negativePrompt,
    referenceAssetPaths: input.referenceAssetPaths,
    metadata: input.metadata,
    startFramePath: input.startFramePath,
    endFramePath: input.endFramePath,
    durationSeconds: input.durationSeconds,
    aspectRatio: input.aspectRatio,
  };
  const planned = adapter.prepareRequest(requestInput, {
    requestId: input.requestId,
    createdAt: input.createdAt,
    fastTest: input.fastTest ?? true,
  });

  return {
    ok: true,
    request: adapter.markReady(planned, input.createdAt),
    blockers: [],
    warnings: [],
  };
}

export function mockSubmitProviderToolRequest<TInput extends ProviderBoundaryInput>(
  request: ProviderBoundaryRequest<TInput>,
  adapters: ProviderBoundaryToolAdapters = {},
  createdAt?: string,
): ProviderToolResult<ProviderBoundaryRequest<TInput>> {
  if (request.submitPolicy.liveSubmitAllowed !== false || request.submitPolicy.adapterMode !== "mock_only") {
    return {
      ok: false,
      blockers: ["Request submit policy is not mock-only."],
      warnings: [],
    };
  }

  const submitted =
    request.providerId === "image2"
      ? (adapters.image2 ?? createImage2Provider()).mockSubmit(
          request as ProviderBoundaryRequest<Image2ProviderInput>,
          createdAt,
        )
      : (adapters.jimeng ?? createJimengProvider()).mockSubmit(
          request as ProviderBoundaryRequest<JimengProviderInput>,
          createdAt,
        );

  return {
    ok: true,
    request: submitted as ProviderBoundaryRequest<TInput>,
    blockers: [],
    warnings: [],
  };
}

export function ingestMockProviderReturnForReview<TInput extends ProviderBoundaryInput>(
  request: ProviderBoundaryRequest<TInput>,
  summary: ProviderReturnSummaryInput,
  adapters: ProviderBoundaryToolAdapters = {},
): ProviderToolResult<ProviderBoundaryRequest<TInput>> {
  const ingested =
    request.providerId === "image2"
      ? (adapters.image2 ?? createImage2Provider()).ingestMockReturn(
          request as ProviderBoundaryRequest<Image2ProviderInput>,
          summary,
        )
      : (adapters.jimeng ?? createJimengProvider()).ingestMockReturn(
          request as ProviderBoundaryRequest<JimengProviderInput>,
          summary,
        );

  const reviewReady =
    request.providerId === "image2"
      ? (adapters.image2 ?? createImage2Provider()).requestReview(
          ingested as ProviderBoundaryRequest<Image2ProviderInput>,
          summary.receivedAt,
        )
      : (adapters.jimeng ?? createJimengProvider()).requestReview(
          ingested as ProviderBoundaryRequest<JimengProviderInput>,
          summary.receivedAt,
        );

  return {
    ok: true,
    request: reviewReady as ProviderBoundaryRequest<TInput>,
    blockers: [],
    warnings: summary.warnings ?? [],
  };
}

export function promoteMockProviderReturn<TInput extends ProviderBoundaryInput>(
  request: ProviderBoundaryRequest<TInput>,
  adapters: ProviderBoundaryToolAdapters = {},
  updatedAt?: string,
): ProviderToolResult<ProviderBoundaryRequest<TInput>> {
  const promoted =
    request.providerId === "image2"
      ? (adapters.image2 ?? createImage2Provider()).promote(
          request as ProviderBoundaryRequest<Image2ProviderInput>,
          updatedAt,
        )
      : (adapters.jimeng ?? createJimengProvider()).promote(
          request as ProviderBoundaryRequest<JimengProviderInput>,
          updatedAt,
        );

  return {
    ok: true,
    request: promoted as ProviderBoundaryRequest<TInput>,
    blockers: [],
    warnings: [],
  };
}
