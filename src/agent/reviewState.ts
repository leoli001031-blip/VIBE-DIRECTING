import type { ProviderBoundaryRequest } from "../providers";

export interface DirectorProviderReviewState {
  request?: ProviderBoundaryRequest;
}

export function createDirectorProviderReviewState(): DirectorProviderReviewState {
  return {};
}

export function setDirectorProviderRequest(
  state: DirectorProviderReviewState,
  request: ProviderBoundaryRequest,
): void {
  state.request = request;
}

export function assertCurrentDirectorProviderRequest(
  state: DirectorProviderReviewState,
  requestId: string,
): void {
  if (!state.request) throw new Error("No provider request has been prepared.");
  if (state.request.requestId !== requestId) {
    throw new Error(`Provider request mismatch: expected ${state.request.requestId}, got ${requestId}.`);
  }
}

export function requirePromotedMockProviderRequest(
  state: DirectorProviderReviewState,
  requestId: string,
): ProviderBoundaryRequest {
  assertCurrentDirectorProviderRequest(state, requestId);
  const request = state.request;

  if (!request || request.status !== "promoted") {
    throw new Error(`Provider request did not reach promoted status for ${requestId}.`);
  }
  if (request.receipt?.liveSubmit !== false || request.responseSummary?.liveSubmit !== false) {
    throw new Error("Prototype provider loop must stay mock-only and non-live.");
  }

  return request;
}
