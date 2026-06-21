import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const appRoot = process.cwd();
const distRoot = path.join(appRoot, "dist");
const distAssetsRoot = path.join(distRoot, "assets");
const viteConfigSource = readFileSync(path.join(appRoot, "vite.config.ts"), "utf8");
const permissionIntentSource = readFileSync(path.join(appRoot, "src/core/directorAgentPermissionIntent.ts"), "utf8");
const seedanceSubmitHookSource = readFileSync(path.join(appRoot, "src/ui/director/useSeedanceVideoSubmitAction.ts"), "utf8");

const staleUiCopies = [
  {
    text: "直接修改",
    reason: "Agent confirmation card now uses “再改一下” so users do not confuse revising with direct project writes.",
  },
  {
    text: "整理草案",
    reason: "New-video entry should say “发送给 AI 导演” / creator-facing copy, not workflow draft jargon.",
  },
  {
    text: "工作范围",
    reason: "Agent permission controls now use creator-facing “我现在会”.",
  },
];

function jsAssetFiles(root: string) {
  if (!existsSync(root)) return [];
  return readdirSync(root)
    .filter((name) => name.endsWith(".js"))
    .map((name) => path.join(root, name));
}

const jsFiles = jsAssetFiles(distAssetsRoot);

assert(
  /function noStoreDevCachePlugin\(\)[\s\S]*res\.writeHead[\s\S]*Cache-Control",\s*"no-store"[\s\S]*Pragma",\s*"no-cache"[\s\S]*Expires",\s*"0"/.test(viteConfigSource),
  "Vite dev server must force no-store headers for transformed modules so browser demos do not show stale Agent UI.",
);
assert(
  /plugins:\s*\[noStoreDevCachePlugin\(\),\s*currentProjectBindingBootstrapPlugin\(\),\s*react\(\)\]/.test(viteConfigSource),
  "Vite no-store cache guard must run before the current-project bootstrap and React plugins.",
);
assert(
  permissionIntentSource.includes("isDirectorAgentExplainOnlyIntent") && permissionIntentSource.includes("只告诉我"),
  "Agent explain-only intent guard must stay in the source before demo recording.",
);
assert(
  seedanceSubmitHookSource.includes("需要时可以重新确认"),
  "Seedance cancel copy must stay retryable instead of becoming a blocked video state.",
);

if (!existsSync(distRoot) || jsFiles.length === 0) {
  console.log("demo-artifact-freshness-test: dist check skipped (dist bundle not present)");
} else {
  const hits = [];
  for (const file of jsFiles) {
    const source = readFileSync(file, "utf8");
    for (const staleCopy of staleUiCopies) {
      if (source.includes(staleCopy.text)) {
        hits.push({
          file: path.relative(appRoot, file),
          text: staleCopy.text,
          reason: staleCopy.reason,
        });
      }
    }
  }

  assert.equal(
    hits.length,
    0,
    `Local dist bundle contains stale demo UI copy. Run npm run build before recording.\n${hits
      .map((hit) => `- ${hit.file}: ${hit.text} (${hit.reason})`)
      .join("\n")}`,
  );
}

async function assertLiveFrontendFreshness(frontendUrl: string) {
  const baseUrl = new URL(frontendUrl);
  const sourcesToCheck = [
    {
      path: "/src/core/directorAgentPermissionIntent.ts",
      markers: ["isDirectorAgentExplainOnlyIntent", "只告诉我"],
      reason: "Agent explain-only routing should be visible to the browser.",
    },
    {
      path: "/src/ui/director/useSeedanceVideoSubmitAction.ts",
      markers: ["需要时可以重新确认"],
      reason: "Cancelled Seedance submit should remain retryable in the live UI bundle.",
    },
  ];

  for (const sourceToCheck of sourcesToCheck) {
    const sourceUrl = new URL(sourceToCheck.path, baseUrl);
    sourceUrl.searchParams.set("freshness", String(Date.now()));
    const response = await fetch(sourceUrl);
    assert(
      response.ok,
      `Live frontend freshness check failed to fetch ${sourceToCheck.path} from ${baseUrl.origin}. Restart npm run dev:full before recording.`,
    );
    const cacheControl = response.headers.get("cache-control") || "";
    assert(
      cacheControl.toLowerCase().includes("no-store"),
      `Live frontend ${sourceToCheck.path} did not return Cache-Control: no-store. Restart npm run dev:full before recording.`,
    );
    const source = await response.text();
    for (const marker of sourceToCheck.markers) {
      assert(
        source.includes(marker),
        `Live frontend is stale for ${sourceToCheck.path}: missing "${marker}". ${sourceToCheck.reason} Restart npm run dev:full before recording.`,
      );
    }
  }
}

const frontendUrl = process.env.VIBE_FRONTEND_URL || "";
if (frontendUrl) {
  await assertLiveFrontendFreshness(frontendUrl);
  console.log(`demo-artifact-freshness-test: live frontend fresh (${frontendUrl})`);
}

console.log(`demo-artifact-freshness-test: ok (${jsFiles.length} dist bundle files checked)`);
