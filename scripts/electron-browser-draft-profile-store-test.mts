import assert from "node:assert/strict";
import crypto from "node:crypto";
import { mkdir, mkdtemp, readFile, symlink } from "node:fs/promises";
import { join } from "node:path";

import {
  browserDraftStorageKeyPrefix,
  createBrowserDraftProfileStore,
} from "../electron/browserDraftProfileStore.mts";

const root = await mkdtemp("/tmp/vibe-director-browser-draft-store-");
const outside = await mkdtemp("/tmp/vibe-director-browser-draft-outside-");
const storageKey = `${browserDraftStorageKeyPrefix}:session:test-recovery`;
const store = createBrowserDraftProfileStore({ userDataRoot: root });

assert.deepEqual(store.bootstrap(), {});
assert.equal(store.fileExists(storageKey, ".vibe-runtime/agent-timeline.json"), false);
store.writeFile(storageKey, ".vibe-runtime/agent-timeline.json", "{\"ok\":true}\n");
assert.equal(store.fileExists(storageKey, ".vibe-runtime/agent-timeline.json"), true);
assert.equal(store.readFile(storageKey, ".vibe-runtime/agent-timeline.json").content, "{\"ok\":true}\n");

store.rememberPointer("pending_intake", storageKey);
assert.equal(store.bootstrap().pendingIntakeStorageKey, storageKey);
store.rememberPointer("active_project", storageKey);
assert.equal(store.bootstrap().activeStorageKey, storageKey);
store.rememberPointer("pending_intake", undefined);
assert.equal(store.bootstrap().pendingIntakeStorageKey, undefined);

assert.throws(() => store.writeFile("invalid", "project.vibe", "{}"), /Invalid browser draft storage key/);
assert.throws(() => store.writeFile(storageKey, "../escape.json", "{}"), /profile-relative/);

const storageHash = crypto.createHash("sha256").update(storageKey).digest("hex");
const runtimeDirectory = join(root, "browser-drafts", storageHash, ".vibe-runtime");
await mkdir(runtimeDirectory, { recursive: true });
await symlink(outside, join(runtimeDirectory, "unsafe-link"));
assert.throws(
  () => store.writeFile(storageKey, ".vibe-runtime/unsafe-link/escape.json", "{}"),
  /unsafe directory/,
);
assert.equal(await readFile(join(root, "browser-drafts", storageHash, ".vibe-runtime", "agent-timeline.json"), "utf8"), "{\"ok\":true}\n");

assert.equal(store.deleteFile(storageKey, ".vibe-runtime/agent-timeline.json").deleted, true);
assert.equal(store.fileExists(storageKey, ".vibe-runtime/agent-timeline.json"), false);
assert.equal(store.forget(storageKey).forgotten, true);

console.log("PASS Electron browser-draft profile store contract");
