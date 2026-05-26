import path from "node:path";
import { assertCleanSmallProjectRuntimeState, writeDemoRuntimeArtifacts } from "./demo-runtime-fixture.mts";

function readArgValue(name, fallback) {
  const prefix = `${name}=`;
  const inline = process.argv.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = process.argv.indexOf(name);
  if (index >= 0 && process.argv[index + 1]) return process.argv[index + 1];
  return fallback;
}

const outputDir = readArgValue("--out-dir", "public");
const check = process.argv.includes("--check");

const { audit, runtimeState, statePath, auditPath } = await writeDemoRuntimeArtifacts({ outputDir });
const { summary } = assertCleanSmallProjectRuntimeState(runtimeState, audit);

console.log(check ? "Demo runtime state generated and verified." : "Demo runtime state generated.");
console.log(
  JSON.stringify(
    {
      ...summary,
      statePath: path.relative(process.cwd(), statePath),
      auditPath: path.relative(process.cwd(), auditPath),
    },
    null,
    2,
  ),
);
