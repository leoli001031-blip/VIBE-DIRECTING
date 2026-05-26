import type { MinimalRuntimeProjection } from "../../core/minimalRuntimeProjection";

export type DirectorView = "story" | "assets" | "preview" | "export";
export type AssetLibraryUiStatus = "locked" | "candidate" | "needs_review" | "rejected";

export type DirectorProgressTone = "preparing" | "working" | "review" | "blocked" | "complete";

type DirectorProgressSegment = {
  label: string;
  value: number;
  tone: DirectorProgressTone;
};

export type DirectorProgressStripState = {
  label: string;
  detail: string;
  tone: DirectorProgressTone;
  total: number;
  preparing: number;
  working: number;
  review: number;
  blocked: number;
  complete: number;
  segments: DirectorProgressSegment[];
};

export type MinimalProjectPlan = {
  entryLabel: string;
  planLabel: string;
  statusLabel: string;
  progressDots: MinimalRuntimeProjection["progressDots"];
};
