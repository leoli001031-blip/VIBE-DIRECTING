import type { DirectorTextQaInput, DirectorTextQaReport } from "./directorTextQa";
import {
  fetchRuntimeJson,
  isRecord,
  projectRuntimeBasePath,
} from "./runtimeApiClient";

export const runtimeDirectorTextQaEndpoint = `${projectRuntimeBasePath}/director/text-qa`;

function normalizeDirectorTextQaResponse(value: unknown): DirectorTextQaReport | undefined {
  const record = isRecord(value) ? value : {};
  const report = isRecord(record.report) ? record.report : record;
  return report.schemaVersion === "director_text_qa_v1" ? report as unknown as DirectorTextQaReport : undefined;
}

export async function runDirectorTextQa(input: DirectorTextQaInput): Promise<DirectorTextQaReport | undefined> {
  const payload = await fetchRuntimeJson(runtimeDirectorTextQaEndpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ input }),
  });
  return normalizeDirectorTextQaResponse(payload);
}
