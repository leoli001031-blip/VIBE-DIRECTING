import { spawnSync } from "node:child_process";

const scripts = [
  "provider-execution-permission-gate:test",
  "provider-action-confirmation-receipt:test",
  "provider-execution-handoff:test",
  "real-provider-transport:test",
  "provider-submit-permission-receipt:test",
  "current-project-provider-submit-permission-receipt:test",
  "real-image2-executor-adapter:test",
  "runtime-api-provider-return-evidence:test",
  "current-project-image2-return-executor:test",
];

function runNpmScript(name, index, total) {
  console.log(`\n[verify:provider-fast] ${index + 1}/${total} npm run ${name}`);
  const result = spawnSync("npm", ["run", name], {
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  if (result.status !== 0) {
    const status = result.status ?? 1;
    console.error(`[verify:provider-fast] failed at npm run ${name} (exit ${status})`);
    process.exit(status);
  }
}

console.log("[verify:provider-fast] provider contract fixture suite starting");
console.log("[verify:provider-fast] no real provider submit is performed by this aggregator");
scripts.forEach((name, index) => runNpmScript(name, index, scripts.length));
console.log("\n[verify:provider-fast] all checks passed");
