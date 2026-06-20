import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { scanProjectFolderFiles } from "../src/core/projectFolderScannerNode.ts";
import { buildProjectFolderInboxProjection } from "../src/core/projectAgentWorkspace.ts";

const root = fs.mkdtempSync(path.join(os.tmpdir(), "vibe-project-folder-scan-"));

function write(relativePath: string, content = "demo") {
  const fullPath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content);
}

write("characters/heroine/front.png");
write("characters/heroine/hand-closeup.png");
write("scenes/rain-station/wide.jpg");
write("props/glowing-ticket.webp");
write("vehicles/white-car.png");
write("vehicles/headlight.png");
write("props/wheel-detail.jpg");
write("voices/heroine.wav");
write("dialogue/opening-lines.txt", "少女：下一班车还会来吗？");
write("dialogue/heroine.wav");
write("music/eurobeat.wav");
write("scripts/episode-01.md", "# Episode");
write("subtitles/opening.srt", "1\n00:00:00,000 --> 00:00:02,000\n下一班车还会来吗？");
write("prompts/shot-01.md", "Seedance prompt");
write("receipts/shot-01-submit.json", "{\"submitId\":\"demo\"}");
write("videos/shot-01.mp4");
write("exports/final-package.zip");
write("assets/generated/auto.png");
write(".vibe-runtime/video-relay-queue.json", "{}");
write("node_modules/pkg/index.js");
write(".git/config");

const files = scanProjectFolderFiles(root, { maxDepth: 4, maxFiles: 50 });
const paths = files.map((file) => file.path).sort();

assert(paths.includes("characters/heroine/front.png"), "scanner should include character images");
assert(paths.includes("prompts/shot-01.md"), "scanner should include prompt files");
assert(paths.includes("receipts/shot-01-submit.json"), "scanner should include receipt json");
assert(!paths.some((item) => item.startsWith(".vibe-runtime/")), "scanner should skip runtime sidecars");
assert(!paths.some((item) => item.startsWith("node_modules/")), "scanner should skip dependencies");
assert(!paths.some((item) => item.startsWith(".git/")), "scanner should skip git internals");
assert(files.every((file) => file.sizeBytes && file.modifiedAt), "scanner should attach file metadata");

const inbox = buildProjectFolderInboxProjection({ files });

assert(inbox.items.some((item) => item.kind === "character" && item.label === "front.png"), "inbox should classify character refs");
assert(inbox.items.some((item) => item.kind === "scene" && item.label === "wide.jpg"), "inbox should classify scene refs");
assert(inbox.items.some((item) => item.kind === "prop" && item.label === "glowing-ticket.webp"), "inbox should classify prop refs");
assert(inbox.items.some((item) => item.kind === "prop" && item.label === "white-car.png"), "whole vehicles should classify as independent object refs");
for (const detailLabel of ["hand-closeup.png", "headlight.png", "wheel-detail.jpg"]) {
  const detailItem = inbox.items.find((item) => item.label === detailLabel);
  assert(detailItem, `${detailLabel} should still appear in the project inbox`);
  assert.equal(detailItem.kind, "reference", `${detailLabel} should not become an independent character/prop reference`);
  assert.match(detailItem.detail, /局部细节/u, `${detailLabel} should be marked as a fine-detail reference`);
  assert.match(detailItem.suggestedBinding, /不单独生成参考/u, `${detailLabel} should be folded into subject assets or shot notes`);
  assert.match(detailItem.suggestedAction, /并入主体或镜头说明/u, `${detailLabel} should have an actionable fallback`);
  assert.match(detailItem.reason, /局部细节|动作瞬间|状态/u, `${detailLabel} should explain why it is not standalone`);
  assert.equal(detailItem.confidence, "low", `${detailLabel} should require review instead of confident binding`);
}
const characterItem = inbox.items.find((item) => item.kind === "character" && item.label === "front.png");
assert(characterItem, "character item should exist");
assert.match(characterItem.suggestedAction, /角色参考/u, "independent character assets should have a reusable action");
assert.match(characterItem.reason, /目录和文件名/u, "folder-derived assets should explain the inference source");
assert(inbox.items.some((item) => item.kind === "voice" && item.label === "heroine.wav"), "inbox should classify voice refs");
assert(inbox.items.some((item) => item.kind === "script" && item.label === "opening-lines.txt"), "text dialogue files should classify as scripts");
assert(inbox.items.some((item) => item.kind === "voice" && item.label === "heroine.wav"), "audio dialogue files should still classify as voice refs");
assert(inbox.items.some((item) => item.kind === "reference" && item.label === "eurobeat.wav"), "music should stay a parked reference");
assert(inbox.items.some((item) => item.kind === "script" && item.label === "episode-01.md"), "inbox should classify scripts");
assert(inbox.items.some((item) => item.kind === "script" && item.label === "opening.srt"), "subtitle files should classify as scripts");
assert(inbox.items.some((item) => item.kind === "prompt" && item.label === "shot-01.md"), "inbox should classify prompt evidence");
assert(inbox.items.some((item) => item.kind === "receipt" && item.label === "shot-01-submit.json"), "inbox should classify submit receipts");
assert(inbox.items.some((item) => item.kind === "video" && item.label === "shot-01.mp4"), "inbox should classify returned videos");
assert(inbox.items.some((item) => item.kind === "export" && item.label === "final-package.zip"), "inbox should classify export packages");
assert(!inbox.items.some((item) => item.label === "auto.png"), "app-generated assets should not become user review cards");
assert.match(inbox.summary, /项目文件夹识别/u, "folder scan summary should be creator-facing");

const scopedInbox = buildProjectFolderInboxProjection({
  files: [
    { path: "chapter-01/sequence-opening/shot-03/props/glowing-ticket.webp" },
    { path: "chapter-01/sequence-opening/shot-03/characters/hand-closeup.png" },
  ],
});
const scopedProp = scopedInbox.items.find((item) => item.label === "glowing-ticket.webp");
assert(scopedProp, "scoped folder props should appear in the inbox");
assert.match(scopedProp.detail, /章节 chapter 01/u, "scoped assets should show chapter hints in the material card");
assert.match(scopedProp.suggestedBinding, /段落 sequence opening/u, "scoped assets should show sequence hints in binding copy");
assert.match(scopedProp.reason, /镜头 shot 03/u, "scoped assets should show shot hints in the classification reason");
const scopedDetail = scopedInbox.items.find((item) => item.label === "hand-closeup.png");
assert(scopedDetail, "scoped fine details should still appear for review");
assert.equal(scopedDetail.kind, "reference", "scoped fine details should still fold into subject or shot notes");
assert.match(scopedDetail.suggestedBinding, /不单独生成参考/u, "scoped fine details should preserve the non-standalone rule");
assert.match(scopedDetail.suggestedBinding, /镜头 shot 03/u, "scoped fine details should retain the target shot hint");

console.log(`project-folder-scanner-test: files=${files.length}, inbox=${inbox.items.length}`);
