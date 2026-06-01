import type { ExecutionLedgerOutputSandbox } from "./executionLedger";
import {
  providerObservationFilePath,
  type ProviderObservation,
} from "./providerObservationSidecar";
import { sandboxPathValid } from "./sandboxPathUtils";
import { sandboxWriteJsonFile } from "./sandboxWriter";

export async function writeProviderObservation(
  observation: ProviderObservation,
  sandbox: ExecutionLedgerOutputSandbox,
): Promise<{ filePath: string; written: boolean; blocker?: string }> {
  const filePath = providerObservationFilePath(sandbox, observation);

  if (!sandboxPathValid(filePath, sandbox)) {
    return { filePath, written: false, blocker: `Observation path outside sandbox: ${filePath}` };
  }

  const result = await sandboxWriteJsonFile(filePath, observation, sandbox);
  if (result.status === "written") {
    return { filePath: result.filePath, written: true };
  }
  return { filePath, written: false, blocker: result.blocker };
}
