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
  if (normalizedId.startsWith(`${srcRoot}agent/`)) return "agent-runtime";
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
    // Intentional threshold: core-runtime chunk (~1059 KB) currently exceeds this limit.
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
