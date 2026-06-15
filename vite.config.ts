import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(fileURLToPath(import.meta.url));
const normalizedProjectRoot = projectRoot.replace(/\\/g, "/");
const srcRoot = `${normalizedProjectRoot}/src/`;
const assetRootEnv = process.env.VIBE_DIRECTOR_ASSET_ROOT || process.env.VIBE_CORE_ASSET_ROOT;
// Intentional default: falls back to a sibling "Vibe Director" directory when no env var is set.
const localAssetRoot = assetRootEnv
  ? resolve(assetRootEnv)
  : resolve(projectRoot, "../Vibe Director");

function sourceManualChunk(id: string) {
  const normalizedId = id.replace(/\\/g, "/");
  const exportRuntimeModules = [
    `${srcRoot}core/exportWorker.ts`,
    `${srcRoot}core/exportAction.ts`,
    `${srcRoot}core/localPreviewExportProjection.ts`,
    `${srcRoot}core/finalVideoPlan.ts`,
    `${srcRoot}core/finalVideoRender.ts`,
  ];
  if (exportRuntimeModules.includes(normalizedId)) return "export-runtime";
  const newVideoRuntimeModules = [
    `${srcRoot}core/newVideoProjectVibePlanner.ts`,
    `${srcRoot}core/scriptPlanner.ts`,
  ];
  if (newVideoRuntimeModules.includes(normalizedId)) return "new-video-runtime";
  if (normalizedId.startsWith(`${srcRoot}agent/`)) {
    if (
      normalizedId.includes("/image2Tool.ts")
      || normalizedId.includes("/lanyiImage2AgentTool.ts")
      || normalizedId.includes("/jimengTool.ts")
      || normalizedId.includes("/webSearchTool.ts")
    ) return "agent-provider-tools";
    if (
      normalizedId.includes("/directorProductAgentLoop.ts")
      || normalizedId.includes("/directorAgentProviderTools.ts")
      || normalizedId.includes("/directorAgentPlan.ts")
    ) return "agent-product-loop";
    if (
      normalizedId.includes("/ownedAgentLoop.ts")
      || normalizedId.includes("/ownedAgentImage2SubmitPlan.ts")
    ) return "agent-owned-loop";
    if (
      normalizedId.includes("/agentLoop.ts")
      || normalizedId.includes("/toolRegistry.ts")
      || normalizedId.includes("/sessionManager.ts")
      || normalizedId.includes("/llmProvider.ts")
    ) return "agent-loop-core";
    return "agent-runtime";
  }
  if (normalizedId.startsWith(`${srcRoot}data/`)) return "demo-data";
  if (normalizedId.startsWith(`${srcRoot}project/`)) return "core-runtime";
  if (normalizedId.startsWith(`${srcRoot}core/`)) return "core-runtime";
  return undefined;
}

export default defineConfig({
  base: "./",
  plugins: [react()],
  server: {
    port: 5174, // Intentional default dev-server port.
    strictPort: false,
    fs: {
      allow: [projectRoot, localAssetRoot],
    },
  },
  build: {
    // Intentional threshold: large Agent/provider chunks remain visible while we finish splitting legacy surfaces.
    // Kept at 1000 to surface the warning without breaking the build.
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          const sourceChunk = sourceManualChunk(id);
          if (sourceChunk) return sourceChunk;
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("react/") || id.includes("react-dom/") || id.includes("scheduler/")) {
            return "vendor-react";
          }
          if (id.includes("lucide-react/")) return "vendor-icons";
          if (id.includes("/ai/") || id.includes("/@ai-sdk/") || id.includes("/zod/")) {
            return "vendor-agent";
          }
          return "vendor";
        },
      },
    },
  },
});
