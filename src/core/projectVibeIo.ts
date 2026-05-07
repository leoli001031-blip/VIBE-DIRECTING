import {
  buildProjectStoreIoGate,
  executeProjectStoreIoGate,
  type BuildProjectStoreIoGateInput,
  type ProjectStoreIoExecutionResult,
} from "./projectStoreIo";

export const projectVibeIoSchemaVersion = "0.1.0";

export interface ProjectVibeMemoryAdapter {
  files: Map<string, string>;
  directories: Set<string>;
  mkdir(path: string): void;
  readFile(path: string): string;
  writeFile(path: string, content: string): void;
}

export interface ProjectVibeMemoryRoundtripResult {
  schemaVersion: typeof projectVibeIoSchemaVersion;
  generatedAt: string;
  saved: ProjectStoreIoExecutionResult;
  opened: ProjectStoreIoExecutionResult;
  projectVibePresent: boolean;
  runtimeStatePresent: boolean;
  ok: boolean;
  blockers: string[];
  notes: string[];
}

export function createProjectVibeMemoryAdapter(initialFiles?: Record<string, string>): ProjectVibeMemoryAdapter {
  const files = new Map(Object.entries(initialFiles || {}));
  const directories = new Set<string>();
  const adapter: ProjectVibeMemoryAdapter = {
    files,
    directories,
    mkdir(path: string): void {
      directories.add(path);
    },
    readFile(path: string): string {
      const value = files.get(path);
      if (value === undefined) throw new Error(`missing memory project file ${path}`);
      return value;
    },
    writeFile(path: string, content: string): void {
      files.set(path, content);
    },
  };
  return adapter;
}

export async function roundtripProjectVibeInMemory(input: BuildProjectStoreIoGateInput): Promise<ProjectVibeMemoryRoundtripResult> {
  const generatedAt = input.generatedAt || new Date().toISOString();
  const adapter = createProjectVibeMemoryAdapter();
  const saveGate = buildProjectStoreIoGate({
    ...input,
    mode: input.mode === "open" ? "save" : input.mode,
    generatedAt,
  });
  const saved = await executeProjectStoreIoGate(saveGate, adapter);
  const openGate = buildProjectStoreIoGate({
    mode: "open",
    serializedProjectVibe: adapter.files.get("project.vibe"),
    generatedAt,
  });
  const opened = await executeProjectStoreIoGate(openGate, adapter);
  const blockers = [
    ...(saved.ok ? [] : saved.errors),
    ...(opened.ok ? [] : opened.errors),
    adapter.files.has("project.vibe") ? "" : "project_vibe_memory_roundtrip_missing_project_vibe",
    adapter.files.has("runtime-state.json") ? "" : "project_vibe_memory_roundtrip_missing_runtime_state_cache",
  ].filter(Boolean);
  return {
    schemaVersion: projectVibeIoSchemaVersion,
    generatedAt,
    saved,
    opened,
    projectVibePresent: adapter.files.has("project.vibe"),
    runtimeStatePresent: adapter.files.has("runtime-state.json"),
    ok: blockers.length === 0,
    blockers,
    notes: [
      "project.vibe memory roundtrip uses the ProjectStoreIo adapter contract only. It does not write to disk, move user files, read credentials, submit providers, generate images, or generate videos.",
    ],
  };
}
