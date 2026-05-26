import { spawnSync } from "node:child_process";

const scripts = [
  "runtime-api-request-body:test",
  "runtime-api-endpoints:test",
  "runtime-api-current-project-route-context:test",
  "runtime-api-status-route:test",
  "runtime-api-real-demo-005-routes:test",
  "runtime-api-boundary:test",
  "runtime-api-current-project-binding-routes:test",
  "runtime-api-current-project-read-check-routes:test",
  "runtime-api-current-project-one-shot-routes:test",
  "runtime-api-current-project-review-decision:test",
  "lanyi-responses-stream-transport:test",
  "agent-web-search-product:test",
  "tavily-project-knowledge:test",
  "project-local-knowledge-file:test",
  "runtime-api-current-project-image2-assets-generate:test",
  "runtime-api-current-project-image2-end-frame-submit:test",
  "runtime-api-current-project-p6-real-image2-routes:test",
  "runtime-api-file-serving:test",
  "p6-real-image2:app-action-test",
  "p6-real-image2:serial-batch-test",
];

const realProviderSubmitScripts = new Set([
  "p6-real-image2:test",
  "p6-real-image2:submit-live",
  "p6-real-image2:live",
  "p6-real-image2:preflight",
  "real-provider-executor:test",
  "real-provider-pilot:test",
  "real-provider-submit-permission:test",
  "current-project-real-image2-readiness:test",
  "image2-provider-boundary:test",
  "verify:all",
  "verify:provider-contracts",
]);

for (const name of scripts) {
  if (realProviderSubmitScripts.has(name)) {
    throw new Error(`[verify:runtime-fast] ${name} is not allowed in the fast no-provider-submit suite`);
  }
}

function runNpmScript(name, index, total) {
  console.log(`\n[verify:runtime-fast] ${index + 1}/${total} npm run ${name}`);
  const result = spawnSync("npm", ["run", name], {
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  if (result.status !== 0) {
    const status = result.status ?? 1;
    console.error(`[verify:runtime-fast] failed at npm run ${name} (exit ${status})`);
    process.exit(status);
  }
}

console.log("[verify:runtime-fast] runtime API fast boundary suite starting");
console.log("[verify:runtime-fast] no real provider submit is performed by this aggregator");
scripts.forEach((name, index) => runNpmScript(name, index, scripts.length));
console.log("\n[verify:runtime-fast] all checks passed");
