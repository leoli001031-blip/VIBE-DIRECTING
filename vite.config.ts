import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(fileURLToPath(import.meta.url));
const localAssetRoot = process.env.VIBE_CORE_ASSET_ROOT
  ? resolve(process.env.VIBE_CORE_ASSET_ROOT)
  : resolve(projectRoot, "../Vibe Director");

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    strictPort: false,
    fs: {
      allow: [projectRoot, localAssetRoot],
    },
  },
});
