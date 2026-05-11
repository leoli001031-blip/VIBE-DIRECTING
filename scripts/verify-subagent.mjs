import { spawnSync } from "node:child_process";

const scripts = [
  "subagent-gate:test",
  "artifact-transaction:test",
  "provider-execution-permission-gate:test",
];

function runNpmScript(name, index, total) {
  console.log(`\n[verify:subagent] ${index + 1}/${total} npm run ${name}`);
  const result = spawnSync("npm", ["run", name], {
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  if (result.status !== 0) {
    const status = result.status ?? 1;
    console.error(`[verify:subagent] failed at npm run ${name} (exit ${status})`);
    process.exit(status);
  }
}

console.log("[verify:subagent] task envelope/worker gate suite starting");
scripts.forEach((name, index) => runNpmScript(name, index, scripts.length));
console.log("\n[verify:subagent] all checks passed");
