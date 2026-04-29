import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const defaultSourceRoot = "/Users/lichenhao/Desktop/Vibe Director/knowledge";
const sourceRoot = path.resolve(process.argv[2] || defaultSourceRoot);
const resourcesRoot = path.join(projectRoot, "resources");
const targetRoot = path.join(resourcesRoot, "knowledge");
const manifestPath = path.join(resourcesRoot, "knowledge_pack_manifest.json");
const testCasesPath = path.join(targetRoot, "router_test_cases.json");
const schemaVersion = "0.1.0";
const manifestVersion = "2026.04.29";
const stableImportedAt = "2026-04-29T00:00:00.000Z";

const categoryByDir = new Map([
  ["script", "script"],
  ["story-function", "story_function"],
  ["style", "style"],
  ["composition", "composition"],
  ["camera", "camera"],
  ["lighting", "lighting"],
  ["color", "color"],
  ["lens-focus", "lens_focus"],
  ["performance", "performance"],
  ["prompt", "prompt"],
  ["provider", "provider"],
  ["qa", "qa"],
  ["audio", "audio"],
  ["agent", "agent"],
  ["index", "agent"],
]);

const taskPurposesByCategory = {
  script: ["script", "story_audit"],
  storyflow: ["script", "story_audit"],
  story_function: ["script", "keyframe", "qa", "story_audit", "continuity_audit"],
  style: ["asset", "keyframe", "edit", "qa", "visual_generation", "visual_audit"],
  composition: ["asset", "keyframe", "edit", "qa", "visual_generation", "visual_audit", "continuity_audit"],
  camera: ["i2v", "video", "keyframe", "video_generation", "video_audit"],
  lighting: ["asset", "keyframe", "edit", "visual_generation", "visual_audit"],
  color: ["asset", "keyframe", "edit", "visual_generation", "visual_audit"],
  lens_focus: ["asset", "keyframe", "edit", "i2v", "visual_generation"],
  performance: ["script", "keyframe", "visual_generation", "visual_audit"],
  prompt: ["asset", "keyframe", "edit", "i2v", "video_generation"],
  provider: ["asset", "keyframe", "edit", "i2v", "video", "audio", "export"],
  qa: ["qa", "audit", "visual_audit", "video_audit", "continuity_audit", "regeneration_plan", "story_audit"],
  audio: ["audio", "video"],
  agent: ["audit", "unknown"],
};

const providerSlotsByCategory = {
  prompt: ["image.generate", "image.edit", "image.reference_asset", "video.i2v"],
  provider: [
    "image.generate",
    "image.edit",
    "image.reference_asset",
    "video.i2v",
    "video.t2v.experimental",
    "video.extend",
    "video.edit",
    "audio.tts",
    "audio.music",
    "local.postprocess",
    "local.workflow",
  ],
  camera: ["image.generate", "image.edit", "video.i2v", "video.t2v.experimental"],
  qa: ["image.generate", "image.edit", "image.reference_asset", "video.i2v", "audio.tts", "audio.music"],
  audio: ["audio.tts", "audio.music", "video.i2v"],
};

function sha256(value) {
  return `sha256:${crypto.createHash("sha256").update(value).digest("hex")}`;
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function slug(value) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function titleFromMarkdown(content, fallback) {
  const heading = content.match(/^#\s+(.+)$/m)?.[1]?.trim();
  if (heading) return heading;
  return fallback.replace(/[-_]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function summaryFromMarkdown(content) {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && !line.startsWith("|") && !line.startsWith("---"));
  return (lines.slice(0, 4).join(" ") || "Imported knowledge pack.").slice(0, 500);
}

function keywordsFor(relativePath, title, heading = "") {
  return Array.from(
    new Set(
      [relativePath, title, heading]
        .join(" ")
        .toLowerCase()
        .split(/[^\p{L}\p{N}.]+/u)
        .filter((item) => item.length > 1),
    ),
  ).sort();
}

function estimateTokens(value) {
  return Math.max(1, Math.ceil(value.length / 4));
}

function snippetsFromMarkdown(content, relativePath, title) {
  const lines = content.split(/\r?\n/);
  const sections = [];
  let current = { heading: title, lines: [] };

  for (const line of lines) {
    const match = line.match(/^##\s+(.+)$/);
    if (match) {
      if (current.lines.join("\n").trim()) sections.push(current);
      current = { heading: match[1].trim(), lines: [line] };
    } else {
      current.lines.push(line);
    }
  }

  if (current.lines.join("\n").trim()) sections.push(current);

  return sections.map((section, index) => {
    const contentBlock = section.lines.join("\n").trim();
    const snippetId = `${slug(section.heading) || "snippet"}-${String(index + 1).padStart(2, "0")}`;

    return {
      id: snippetId,
      title: section.heading,
      summary: contentBlock
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#") && !line.startsWith("|"))
        .slice(0, 3)
        .join(" ")
        .slice(0, 320),
      content: contentBlock,
      keywords: keywordsFor(relativePath, title, section.heading),
      hash: sha256(contentBlock),
      tokenEstimate: estimateTokens(contentBlock),
      sourceHeading: section.heading,
    };
  });
}

async function walkMarkdown(root) {
  const entries = await fs.readdir(root, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkMarkdown(fullPath)));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(fullPath);
    }
  }

  return files.sort((left, right) => left.localeCompare(right));
}

async function removeManagedResourceFiles(root) {
  let entries;
  try {
    entries = await fs.readdir(root, { withFileTypes: true });
  } catch (error) {
    if (error && error.code === "ENOENT") return;
    throw error;
  }

  await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(root, entry.name);
      if (entry.isDirectory()) {
        await removeManagedResourceFiles(fullPath);
        return;
      }

      if (entry.isFile() && (entry.name.endsWith(".md") || entry.name.endsWith(".json"))) {
        await fs.rm(fullPath);
      }
    }),
  );
}

function categoryFor(relativePath) {
  const first = relativePath.split(/[\\/]/)[0];
  if (first === "script" && relativePath.includes("script-to-storyflow")) return "storyflow";
  return categoryByDir.get(first) || "agent";
}

function maxTokensFor(category) {
  if (category === "provider" || category === "style") return 900;
  if (category === "prompt" || category === "qa") return 750;
  return 600;
}

function packFromFile(relativePath, content) {
  const normalizedRelativePath = relativePath.replaceAll("\\", "/");
  const id = normalizedRelativePath.replace(/\.md$/i, "");
  const category = categoryFor(normalizedRelativePath);
  const title = titleFromMarkdown(content, path.basename(normalizedRelativePath, ".md"));
  const summary = summaryFromMarkdown(content);

  return {
    id,
    version: "1.0.0",
    hash: sha256(content),
    path: `resources/knowledge/${normalizedRelativePath}`,
    type: "external_imported",
    category,
    title,
    summary,
    tags: keywordsFor(normalizedRelativePath, title).slice(0, 24),
    applicableTaskPurposes: taskPurposesByCategory[category] || ["unknown"],
    applicableProviderSlots: providerSlotsByCategory[category] || [],
    dependencies: [],
    conflicts: [],
    maxInjectionTokens: maxTokensFor(category),
    trustLevel: "verified",
    verificationStatus: "verified",
    verificationReportId: "knowledge_import_report:deterministic_sha256_copy",
    conflictAcknowledged: false,
    enabled: true,
    defaultEnabled: false,
    createdAt: stableImportedAt,
    updatedAt: stableImportedAt,
    sourcePath: normalizedRelativePath,
    snippets: snippetsFromMarkdown(content, normalizedRelativePath, title),
  };
}

function packIdsFromRouterCell(cell) {
  const matches = Array.from(cell.matchAll(/`([^`]+\.md)`/g)).map((match) => match[1]);
  return matches.map((item) => item.replace(/\.md$/i, ""));
}

function purposeFromRouterSection(section, userIntent) {
  if (section.includes("脚本")) return "script";
  if (section.includes("运镜")) return "i2v";
  if (section.includes("风格")) return "keyframe";
  if (userIntent.includes("QA") || userIntent.includes("判断")) return "qa";
  if (userIntent.includes("视频") || userIntent.includes("Seedance")) return "i2v";
  if (userIntent.includes("音")) return "audio";
  return "keyframe";
}

function providerSlotFromRouterIntent(userIntent) {
  if (userIntent.includes("Image 2 编辑")) return "image.edit";
  if (userIntent.includes("Image 2")) return "image.generate";
  if (userIntent.includes("Seedance") || userIntent.includes("图生视频")) return "video.i2v";
  return undefined;
}

async function buildRouterTestCases() {
  const routerMapPath = path.join(sourceRoot, "index", "router-map.md");
  let content;
  try {
    content = await fs.readFile(routerMapPath, "utf8");
  } catch {
    return [];
  }

  const cases = [];
  let section = "";
  for (const rawLine of content.split(/\r?\n/)) {
    const heading = rawLine.match(/^##\s+(.+)$/)?.[1]?.trim();
    if (heading) {
      section = heading;
      continue;
    }

    if (!rawLine.trim().startsWith("|") || rawLine.includes("---") || rawLine.includes("用户说法") || rawLine.includes("任务 |")) {
      continue;
    }

    const cells = rawLine.split("|").map((cell) => cell.trim()).filter(Boolean);
    if (cells.length < 2) continue;

    const userIntent = cells[0].replace(/`/g, "");
    const expectedPackIds = packIdsFromRouterCell(cells[1]);
    if (!userIntent || !expectedPackIds.length) continue;

    const providerSlot = providerSlotFromRouterIntent(userIntent);
    const testCase = {
      id: `router-map-${String(cases.length + 1).padStart(2, "0")}`,
      userIntent,
      taskPurpose: purposeFromRouterSection(section, userIntent),
      expectedPackIds,
      forbiddenPackIds: [],
    };
    if (providerSlot) testCase.providerSlot = providerSlot;
    cases.push(testCase);
  }

  return cases;
}

async function main() {
  const files = await walkMarkdown(sourceRoot);
  await fs.mkdir(targetRoot, { recursive: true });
  await removeManagedResourceFiles(targetRoot);
  const packs = [];
  const skippedFiles = [];
  const warnings = [];

  for (const file of files) {
    const relativePath = path.relative(sourceRoot, file);
    const targetPath = path.join(targetRoot, relativePath);
    try {
      const rawContent = await fs.readFile(file, "utf8");
      const content = rawContent.replace(/[ \t\r\n]+$/u, "\n");
      await fs.mkdir(path.dirname(targetPath), { recursive: true });
      await fs.writeFile(targetPath, content, "utf8");
      packs.push(packFromFile(relativePath, content));
    } catch (error) {
      skippedFiles.push(relativePath.replaceAll("\\", "/"));
      warnings.push(error instanceof Error ? error.message : String(error));
    }
  }

  const routerTestCases = await buildRouterTestCases();
  await fs.writeFile(testCasesPath, `${JSON.stringify(routerTestCases, null, 2)}\n`, "utf8");

  const generatedAt = stableImportedAt;
  const manifestBase = {
    schemaVersion,
    manifestVersion,
    generatedAt,
    knowledgeLibraryRoot: "resources/knowledge",
    manifestHash: "",
    packs: packs.sort((left, right) => left.id.localeCompare(right.id)),
  };
  const manifestHash = sha256(stableJson({ ...manifestBase, manifestHash: "" }));
  const manifest = { ...manifestBase, manifestHash };

  await fs.mkdir(resourcesRoot, { recursive: true });
  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  const report = {
    schemaVersion,
    sourceRoot,
    targetRoot: path.relative(projectRoot, targetRoot).replaceAll("\\", "/"),
    manifestPath: path.relative(projectRoot, manifestPath).replaceAll("\\", "/"),
    importedPackCount: packs.length,
    skippedFiles,
    warnings,
    manifestHash,
    generatedAt,
  };

  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
