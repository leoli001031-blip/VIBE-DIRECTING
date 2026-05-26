import { watch, type FSWatcher } from "node:fs";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { ExecutionLedgerOutputSandbox } from "./executionLedger";
import { sandboxPathValid } from "./sandboxPathUtils";
import type { SandboxWatcherEvent } from "./providerObservationSidecar";

export interface SandboxWatcher {
  root: string;
  watching: boolean;
  events: SandboxWatcherEvent[];
  onEvent: (event: SandboxWatcherEvent) => void;
  stop: () => void;
}

function sandboxEventId(): string {
  return `sandbox_watcher_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function computeFileHash(filePath: string): Promise<string | undefined> {
  try {
    const content = await readFile(filePath);
    return createHash("sha256").update(content).digest("hex");
  } catch {
    return undefined;
  }
}

export function startSandboxWatcher(
  sandbox: ExecutionLedgerOutputSandbox,
  onEvent: (event: SandboxWatcherEvent) => void,
): SandboxWatcher {
  const events: SandboxWatcherEvent[] = [];
  const watchRoot = sandbox.root;
  let watcher: FSWatcher | undefined;
  let watching = true;

  function emit(eventType: "file_added" | "file_changed", filePath: string) {
    if (!sandboxPathValid(filePath, sandbox)) return;
    const eventId = sandboxEventId();
    const event: SandboxWatcherEvent = {
      eventId,
      eventType,
      filePath,
      detectedAt: new Date().toISOString(),
    };
    computeFileHash(filePath).then((hash) => {
      event.hash = hash;
      event.hashAlgorithm = "sha256";
    }).catch((error: unknown) => {
      console.error("Failed to compute file hash for sandbox watcher event", error);
    }).finally(() => {
      events.push(event);
      onEvent(event);
    });
  }

  try {
    watcher = watch(watchRoot, { recursive: true }, (_eventType, filename) => {
      if (!watching || !filename) return;
      const filePath = `${watchRoot}/${filename}`;
      emit("file_changed", filePath);
    });
  } catch {
    watching = false;
  }

  return {
    root: watchRoot,
    get watching() { return watching; },
    events,
    onEvent,
    stop() {
      watching = false;
      try { watcher?.close(); } catch { /* ignore */ }
    },
  };
}

export function sandboxWatcherHasNewFile(watcher: SandboxWatcher, since?: string): boolean {
  if (!since) return watcher.events.length > 0;
  return watcher.events.some((event) => event.detectedAt > since);
}

export function sandboxWatcherLatestHash(watcher: SandboxWatcher): string | undefined {
  const withHash = watcher.events.filter((event) => event.hash).sort((a, b) => b.detectedAt.localeCompare(a.detectedAt));
  return withHash[0]?.hash;
}
