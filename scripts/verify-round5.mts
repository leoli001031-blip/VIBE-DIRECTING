import { spawnSync } from "node:child_process";

const scripts = [
  "round5-artifact-ingest:test",
  "runtime-api-round5-artifact-ingest:test",
  "runtime-api-current-project-round5-strict-edit-prepare:test",
  "runtime-api-current-project-round5-strict-edit-return:test",
  "project-real-chain-round5-ui-derive:test",
  "local-runtime-api:test",
];

function runNpmScript(name, index, total) {
  console.log(`\n[verify:round5] ${index + 1}/${total} npm run ${name}`);
  const result = spawnSync("npm", ["run", name], {
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  if (result.status !== 0) {
    const status = result.status ?? 1;
    console.error(`[verify:round5] failed at npm run ${name} (exit ${status})`);
    process.exit(status);
  }
}

console.log("[verify:round5] Round5 ingest/derive boundary suite starting");
scripts.forEach((name, index) => runNpmScript(name, index, scripts.length));
console.log("\n[verify:round5] all checks passed");
