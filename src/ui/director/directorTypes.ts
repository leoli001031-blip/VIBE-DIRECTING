import type { MinimalRuntimeProjection } from "../../core/minimalRuntimeProjection";

export type DirectorView = "story" | "assets" | "preview";
export type AssetLibraryUiStatus = "locked" | "candidate" | "needs_review" | "rejected";

export type MinimalProjectPlan = {
  entryLabel: string;
  planLabel: string;
  statusLabel: string;
  progressDots: MinimalRuntimeProjection["progressDots"];
};
