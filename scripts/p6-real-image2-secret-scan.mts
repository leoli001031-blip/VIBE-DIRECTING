import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const defaultRoots = [
  "test_artifacts",
  "test_artifacts/p6-real-image2",
  "test_artifacts/lanyi-api-smoke",
  "test_artifacts/lanyi-image-generate-concurrency",
  "test_artifacts/lanyi-reference-edit-concurrency",
  "real-test-sandbox",
  "exports",
  "reports/exports",
];

function argValue(name) {
  const prefix = `${name}=`;
  const exactIndex = process.argv.indexOf(name);
  if (exactIndex >= 0) return process.argv[exactIndex + 1];
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function rootsFromArgs() {
  const raw = argValue("--roots");
  const roots = raw ? raw.split(",").map((item) => item.trim()).filter(Boolean) : defaultRoots;
  return Array.from(new Set(roots));
}

function walkFiles(root) {
  if (!existsSync(root)) return [];
  const stats = statSync(root);
  if (stats.isFile()) return [root];
  if (!stats.isDirectory()) return [];
  const files = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(entryPath));
    } else if (entry.isFile()) {
      files.push(entryPath);
    }
  }
  return files;
}

function shouldScan(filePath) {
  return path.basename(filePath).toLowerCase() === "project.vibe"
    || /\.(json|jsonl|md|txt|log|yaml|yml|env|tsv|csv)$/i.test(filePath);
}

const secretPatterns = [
  { id: "sk_key", pattern: /\bsk-[A-Za-z0-9_-]{12,}\b/g },
  { id: "tvly_key", pattern: /\btvly-[A-Za-z0-9_-]{4,}\b/gi },
  { id: "bearer_token", pattern: /\bBearer\s+[A-Za-z0-9._-]{12,}\b/gi },
  { id: "api_key_field", pattern: /["']?(?:apiKey|api_key|api-key)["']?\s*[:=]\s*["']?(?!\[REDACTED\]|REDACTED|\*\*\*\*|redacted_)[A-Za-z0-9._~+/-]{8,}["']?/gi },
  { id: "authorization_header", pattern: /"authorization"\s*:\s*"(?!\[REDACTED\]|REDACTED|\*\*\*\*)[^"]{8,}"/gi },
  { id: "reference_audio_absolute_path", pattern: /(?:referenceAudioPath|refAudioPath|speakerWavPath|speakerAudioPath|reference[-_ ]?audio|voice[-_ ]?reference|audio[-_ ]?reference)[^\n\r]{0,160}(?:\/Users\/|\/private\/|\/tmp\/|~\/|[A-Za-z]:[\\/])/gi },
];

const findings = [];
for (const root of rootsFromArgs()) {
  const scanned = new Set();
  for (const filePath of walkFiles(root).filter(shouldScan)) {
    if (scanned.has(filePath)) continue;
    scanned.add(filePath);
    const text = readFileSync(filePath, "utf8");
    for (const { id, pattern } of secretPatterns) {
      pattern.lastIndex = 0;
      if (pattern.test(text)) findings.push({ id, filePath });
    }
  }
}

if (findings.length) {
  throw new Error(`p6-real-image2-secret-scan found possible secrets:\n${findings.map((item) => `- ${item.id}: ${item.filePath}`).join("\n")}`);
}

console.log(`p6-real-image2-secret-scan: ok (${rootsFromArgs().join(", ")})`);
