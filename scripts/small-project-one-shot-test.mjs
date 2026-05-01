import { assertCleanSmallProjectRuntimeState, buildSmallProjectDemoRuntime } from "./demo-runtime-fixture.mjs";

const { audit, runtimeState } = await buildSmallProjectDemoRuntime();
const { summary } = assertCleanSmallProjectRuntimeState(runtimeState, audit);

console.log("Small project one-shot runtime test passed.");
console.log(JSON.stringify(summary, null, 2));
