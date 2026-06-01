export const providerBoundaryStatuses = [
  "planned",
  "ready_to_submit",
  "submitted",
  "return_ingested",
  "needs_review",
  "promoted",
  "failed",
] as const;

export type ProviderBoundaryStatus = (typeof providerBoundaryStatuses)[number];

export type ProviderId = "image2" | "jimeng";

export type ProviderTaskKind = "image.generate" | "image.edit" | "video.i2v";

export type ProviderAdapterMode = "mock_only";

export type ProviderInputHash = `input_${string}`;

export type ProviderOutputPath = string;

export type ProviderReviewStatus =
  | "not_started"
  | "pending_human_review"
  | "approved"
  | "rejected";

export interface ProviderSubmitPolicy {
  fastTest: boolean;
  liveSubmitAllowed: false;
  credentialsAllowed: false;
  adapterMode: ProviderAdapterMode;
  reason: string;
}

export interface ProviderBoundaryInput {
  prompt: string;
  outputPath: ProviderOutputPath;
  negativePrompt?: string;
  referenceAssetPaths?: string[];
  metadata?: Record<string, unknown>;
}

export interface Image2ProviderInput extends ProviderBoundaryInput {
  width?: number;
  height?: number;
  referenceImagePaths?: string[];
}

export interface JimengProviderInput extends ProviderBoundaryInput {
  startFramePath?: string;
  endFramePath?: string;
  durationSeconds?: number;
  aspectRatio?: string;
}

export interface ProviderRequestReceipt {
  receiptId: string;
  requestId: string;
  providerId: ProviderId;
  taskKind: ProviderTaskKind;
  inputHash: ProviderInputHash;
  createdAt: string;
  liveSubmit: false;
  adapterMode: ProviderAdapterMode;
  status: "prepared" | "mock_submitted";
  notes: string[];
}

export interface ProviderResponseSummary {
  summaryId: string;
  requestId: string;
  providerId: ProviderId;
  taskKind: ProviderTaskKind;
  inputHash: ProviderInputHash;
  receivedAt: string;
  outputPath: ProviderOutputPath;
  headline: string;
  artifactCount: number;
  mimeType?: string;
  width?: number;
  height?: number;
  durationSeconds?: number;
  remoteRequestId?: string;
  rawExcerpt?: string;
  warnings: string[];
  liveSubmit: false;
}

export interface ProviderBoundaryRequest<TInput extends ProviderBoundaryInput = ProviderBoundaryInput> {
  requestId: string;
  providerId: ProviderId;
  taskKind: ProviderTaskKind;
  status: ProviderBoundaryStatus;
  input: TInput;
  inputHash: ProviderInputHash;
  outputPath: ProviderOutputPath;
  reviewStatus: ProviderReviewStatus;
  receipt?: ProviderRequestReceipt;
  responseSummary?: ProviderResponseSummary;
  submitPolicy: ProviderSubmitPolicy;
  createdAt: string;
  updatedAt: string;
  notes: string[];
}

export interface CreateProviderBoundaryRequestParams<TInput extends ProviderBoundaryInput> {
  requestId?: string;
  providerId: ProviderId;
  taskKind: ProviderTaskKind;
  input: TInput;
  createdAt?: string;
  fastTest?: boolean;
  notes?: string[];
}

export interface ProviderReturnSummaryInput {
  outputPath?: ProviderOutputPath;
  headline: string;
  artifactCount?: number;
  mimeType?: string;
  width?: number;
  height?: number;
  durationSeconds?: number;
  remoteRequestId?: string;
  rawExcerpt?: string;
  warnings?: string[];
  receivedAt?: string;
}

const allowedTransitions: Record<ProviderBoundaryStatus, ProviderBoundaryStatus[]> = {
  planned: ["ready_to_submit", "failed"],
  ready_to_submit: ["submitted", "failed"],
  submitted: ["return_ingested", "failed"],
  return_ingested: ["needs_review", "failed"],
  needs_review: ["promoted", "failed"],
  promoted: [],
  failed: [],
};

export function isProviderBoundaryStatus(value: unknown): value is ProviderBoundaryStatus {
  return providerBoundaryStatuses.includes(value as ProviderBoundaryStatus);
}

export function assertProviderBoundaryTransition(
  from: ProviderBoundaryStatus,
  to: ProviderBoundaryStatus,
): void {
  if (from === to) {
    return;
  }
  if (!allowedTransitions[from].includes(to)) {
    throw new Error(`Invalid provider boundary transition: ${from} -> ${to}`);
  }
}

export function buildProviderInputHash(input: ProviderBoundaryInput): ProviderInputHash {
  const serialized = stableStringify(input);
  let hash = 0x811c9dc5;

  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }

  return `input_${hash.toString(16).padStart(8, "0")}`;
}

export function createProviderBoundaryRequest<TInput extends ProviderBoundaryInput>(
  params: CreateProviderBoundaryRequestParams<TInput>,
): ProviderBoundaryRequest<TInput> {
  const createdAt = params.createdAt ?? new Date().toISOString();
  const inputHash = buildProviderInputHash(params.input);
  const requestId =
    params.requestId ?? `req_${params.providerId}_${params.taskKind.replace(".", "_")}_${inputHash.slice(6)}`;

  return {
    requestId,
    providerId: params.providerId,
    taskKind: params.taskKind,
    status: "planned",
    input: params.input,
    inputHash,
    outputPath: params.input.outputPath,
    reviewStatus: "not_started",
    submitPolicy: {
      fastTest: params.fastTest ?? true,
      liveSubmitAllowed: false,
      credentialsAllowed: false,
      adapterMode: "mock_only",
      reason: "Provider/tools boundary is mock-only; fast tests never submit to real providers.",
    },
    createdAt,
    updatedAt: createdAt,
    notes: params.notes ?? [],
  };
}

export function markProviderReadyToSubmit<TInput extends ProviderBoundaryInput>(
  request: ProviderBoundaryRequest<TInput>,
  updatedAt = new Date().toISOString(),
): ProviderBoundaryRequest<TInput> {
  return transitionProviderRequest(request, "ready_to_submit", {
    updatedAt,
    reviewStatus: "not_started",
  });
}

export function createMockProviderReceipt<TInput extends ProviderBoundaryInput>(
  request: ProviderBoundaryRequest<TInput>,
  createdAt = new Date().toISOString(),
  notes: string[] = [],
): ProviderRequestReceipt {
  return {
    receiptId: `receipt_${request.providerId}_${request.inputHash.slice(6)}`,
    requestId: request.requestId,
    providerId: request.providerId,
    taskKind: request.taskKind,
    inputHash: request.inputHash,
    createdAt,
    liveSubmit: false,
    adapterMode: "mock_only",
    status: "mock_submitted",
    notes,
  };
}

export function markProviderSubmitted<TInput extends ProviderBoundaryInput>(
  request: ProviderBoundaryRequest<TInput>,
  receipt: ProviderRequestReceipt,
  updatedAt = receipt.createdAt,
): ProviderBoundaryRequest<TInput> {
  if (receipt.inputHash !== request.inputHash || receipt.requestId !== request.requestId) {
    throw new Error("Provider receipt does not match request identity.");
  }
  if (receipt.liveSubmit !== false || receipt.adapterMode !== "mock_only") {
    throw new Error("Provider receipt must be mock-only and must not represent a live submit.");
  }

  return transitionProviderRequest(request, "submitted", {
    updatedAt,
    receipt,
    reviewStatus: "not_started",
  });
}

export function ingestProviderReturn<TInput extends ProviderBoundaryInput>(
  request: ProviderBoundaryRequest<TInput>,
  summaryInput: ProviderReturnSummaryInput,
): ProviderBoundaryRequest<TInput> {
  const receivedAt = summaryInput.receivedAt ?? new Date().toISOString();
  const responseSummary: ProviderResponseSummary = {
    summaryId: `summary_${request.providerId}_${request.inputHash.slice(6)}`,
    requestId: request.requestId,
    providerId: request.providerId,
    taskKind: request.taskKind,
    inputHash: request.inputHash,
    receivedAt,
    outputPath: summaryInput.outputPath ?? request.outputPath,
    headline: summaryInput.headline,
    artifactCount: summaryInput.artifactCount ?? 1,
    mimeType: summaryInput.mimeType,
    width: summaryInput.width,
    height: summaryInput.height,
    durationSeconds: summaryInput.durationSeconds,
    remoteRequestId: summaryInput.remoteRequestId,
    rawExcerpt: summaryInput.rawExcerpt,
    warnings: summaryInput.warnings ?? [],
    liveSubmit: false,
  };

  return transitionProviderRequest(request, "return_ingested", {
    updatedAt: receivedAt,
    outputPath: responseSummary.outputPath,
    responseSummary,
    reviewStatus: "pending_human_review",
  });
}

export function markProviderNeedsReview<TInput extends ProviderBoundaryInput>(
  request: ProviderBoundaryRequest<TInput>,
  updatedAt = new Date().toISOString(),
): ProviderBoundaryRequest<TInput> {
  return transitionProviderRequest(request, "needs_review", {
    updatedAt,
    reviewStatus: "pending_human_review",
  });
}

export function promoteProviderReturn<TInput extends ProviderBoundaryInput>(
  request: ProviderBoundaryRequest<TInput>,
  updatedAt = new Date().toISOString(),
): ProviderBoundaryRequest<TInput> {
  if (!request.responseSummary) {
    throw new Error("Cannot promote a provider request without an ingested response summary.");
  }

  return transitionProviderRequest(request, "promoted", {
    updatedAt,
    reviewStatus: "approved",
  });
}

export function failProviderRequest<TInput extends ProviderBoundaryInput>(
  request: ProviderBoundaryRequest<TInput>,
  reason: string,
  updatedAt = new Date().toISOString(),
): ProviderBoundaryRequest<TInput> {
  return transitionProviderRequest(request, "failed", {
    updatedAt,
    reviewStatus: "rejected",
    notes: [...request.notes, reason],
  });
}

export function transitionProviderRequest<TInput extends ProviderBoundaryInput>(
  request: ProviderBoundaryRequest<TInput>,
  nextStatus: ProviderBoundaryStatus,
  patch: Partial<Omit<ProviderBoundaryRequest<TInput>, "requestId" | "providerId" | "taskKind" | "input" | "inputHash" | "submitPolicy" | "createdAt">> = {},
): ProviderBoundaryRequest<TInput> {
  assertProviderBoundaryTransition(request.status, nextStatus);

  return {
    ...request,
    ...patch,
    status: nextStatus,
    updatedAt: patch.updatedAt ?? new Date().toISOString(),
  };
}

function stableStringify(value: unknown): string {
  if (value === undefined) {
    return "undefined";
  }

  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",")}}`;
}
