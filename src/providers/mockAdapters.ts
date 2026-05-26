import {
  createMockProviderReceipt,
  createProviderBoundaryRequest,
  ingestProviderReturn,
  markProviderNeedsReview,
  markProviderReadyToSubmit,
  markProviderSubmitted,
  promoteProviderReturn,
  type Image2ProviderInput,
  type JimengProviderInput,
  type ProviderAdapterMode,
  type ProviderBoundaryInput,
  type ProviderBoundaryRequest,
  type ProviderId,
  type ProviderReturnSummaryInput,
  type ProviderTaskKind,
} from "./providerBoundary";

export interface ProviderPrepareContext {
  requestId?: string;
  createdAt?: string;
  fastTest?: boolean;
  notes?: string[];
}

export interface ProviderBoundaryAdapter<TInput extends ProviderBoundaryInput = ProviderBoundaryInput> {
  id: ProviderId;
  label: string;
  mode: ProviderAdapterMode;
  supportedTaskKinds: readonly ProviderTaskKind[];
  prepareRequest: (input: TInput, context?: ProviderPrepareContext) => ProviderBoundaryRequest<TInput>;
  markReady: (request: ProviderBoundaryRequest<TInput>, updatedAt?: string) => ProviderBoundaryRequest<TInput>;
  mockSubmit: (request: ProviderBoundaryRequest<TInput>, createdAt?: string) => ProviderBoundaryRequest<TInput>;
  ingestMockReturn: (
    request: ProviderBoundaryRequest<TInput>,
    summary: ProviderReturnSummaryInput,
  ) => ProviderBoundaryRequest<TInput>;
  requestReview: (request: ProviderBoundaryRequest<TInput>, updatedAt?: string) => ProviderBoundaryRequest<TInput>;
  promote: (request: ProviderBoundaryRequest<TInput>, updatedAt?: string) => ProviderBoundaryRequest<TInput>;
}

export interface Image2Provider extends ProviderBoundaryAdapter<Image2ProviderInput> {
  id: "image2";
  family: "image";
}

export interface JimengProvider extends ProviderBoundaryAdapter<JimengProviderInput> {
  id: "jimeng";
  family: "video";
}

export function createImage2Provider(): Image2Provider {
  const supportedTaskKinds = ["image.generate", "image.edit"] as const;

  return {
    id: "image2",
    label: "Image2 Mock Provider",
    family: "image",
    mode: "mock_only",
    supportedTaskKinds,
    prepareRequest(input, context = {}) {
      return createProviderBoundaryRequest({
        requestId: context.requestId,
        providerId: "image2",
        taskKind: inferImage2TaskKind(input),
        input,
        createdAt: context.createdAt,
        fastTest: context.fastTest,
        notes: context.notes,
      });
    },
    markReady: markProviderReadyToSubmit,
    mockSubmit(request, createdAt) {
      const receipt = createMockProviderReceipt(request, createdAt, [
        "Mock Image2 receipt. No network call was made.",
      ]);
      return markProviderSubmitted(request, receipt, receipt.createdAt);
    },
    ingestMockReturn: ingestProviderReturn,
    requestReview: markProviderNeedsReview,
    promote: promoteProviderReturn,
  };
}

export function createJimengProvider(): JimengProvider {
  const supportedTaskKinds = ["video.i2v"] as const;

  return {
    id: "jimeng",
    label: "Jimeng Mock Provider",
    family: "video",
    mode: "mock_only",
    supportedTaskKinds,
    prepareRequest(input, context = {}) {
      return createProviderBoundaryRequest({
        requestId: context.requestId,
        providerId: "jimeng",
        taskKind: "video.i2v",
        input,
        createdAt: context.createdAt,
        fastTest: context.fastTest,
        notes: context.notes,
      });
    },
    markReady: markProviderReadyToSubmit,
    mockSubmit(request, createdAt) {
      const receipt = createMockProviderReceipt(request, createdAt, [
        "Mock Jimeng receipt. No network call was made.",
      ]);
      return markProviderSubmitted(request, receipt, receipt.createdAt);
    },
    ingestMockReturn: ingestProviderReturn,
    requestReview: markProviderNeedsReview,
    promote: promoteProviderReturn,
  };
}

export function createMockProviderAdapters(): Record<ProviderId, Image2Provider | JimengProvider> {
  return {
    image2: createImage2Provider(),
    jimeng: createJimengProvider(),
  };
}

function inferImage2TaskKind(input: Image2ProviderInput): ProviderTaskKind {
  return input.referenceImagePaths && input.referenceImagePaths.length > 0
    ? "image.edit"
    : "image.generate";
}
