import {
  buildProjectVibeReviewPromotionTransaction,
  type BuildProjectVibeReviewPromotionTransactionInput,
  type ProjectVibeReviewDecision,
  type ProjectVibeReviewOutputCandidate,
  type ProjectVibeReviewPromotionStatus,
  type ProjectVibeReviewPromotionTarget,
  type ProjectVibeReviewPromotionTransactionResult,
} from "../project";

export type ProviderReviewPromotionStatus = ProjectVibeReviewPromotionStatus;
export type ProviderReviewPromotionTarget = ProjectVibeReviewPromotionTarget;
export type ProviderReviewOutputCandidate = ProjectVibeReviewOutputCandidate;
export type ProviderReviewDecision = ProjectVibeReviewDecision;
export type BuildProviderReviewPromotionTransactionInput = BuildProjectVibeReviewPromotionTransactionInput;
export type ProviderReviewPromotionTransactionResult = ProjectVibeReviewPromotionTransactionResult;

export function buildProviderReviewPromotionTransaction(
  input: BuildProviderReviewPromotionTransactionInput,
): ProviderReviewPromotionTransactionResult {
  return buildProjectVibeReviewPromotionTransaction(input);
}
