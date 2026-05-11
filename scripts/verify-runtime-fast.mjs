import { spawnSync } from "node:child_process";

const scripts = [
  "local-runtime-api:test",
  "runtime-api-boundary:test",
  "runtime-api-current-project-return-writers:test",
  "runtime-api-current-project-one-shot-return:test",
  "runtime-api-provider-return-evidence:test",
  "runtime-api-workbench-projection:test",
  "runtime-api-current-project-binding-routes:test",
  "runtime-api-current-project-read-check-routes:test",
  "runtime-api-current-project-real-chain-status:test",
  "runtime-api-current-project-image2-batch-plan:test",
  "runtime-api-file-serving:test",
];

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
scripts.forEach((name, index) => runNpmScript(name, index, scripts.length));
console.log("\n[verify:runtime-fast] all checks passed");
