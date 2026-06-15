import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

type ScriptGroup =
  | "smoke"
  | "ui"
  | "runtime"
  | "provider"
  | "live"
  | "deferred"
  | "legacy"
  | "core"
  | "other";

type GroupedScript = {
  name: string;
  command: string;
};

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageJsonPath = path.join(repoRoot, "package.json");
const args = new Set(process.argv.slice(2));
const json = args.has("--json");

const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8")) as {
  scripts?: Record<string, string>;
};

const scripts = packageJson.scripts ?? {};

function includesAny(value: string, needles: string[]) {
  const lower = value.toLowerCase();
  return needles.some((needle) => lower.includes(needle));
}

function classifyScript(name: string, command: string): ScriptGroup {
  const joined = `${name} ${command}`;
  const lowerName = name.toLowerCase();

  if (
    includesAny(lowerName, [
      "music-rhythm",
      "script-music-rhythm",
      "final-video-render-music",
      "local-index-tts",
      "local-qwen3-tts",
      "tts-provider",
    ])
  ) {
    return "deferred";
  }
  if (includesAny(joined, [":live", "--live", "submit-live", "jimeng-video-cli:live"])) {
    return "live";
  }
  if (includesAny(joined, ["legacy", "diagnostics", "round4", "round5", "p6-real-image2", "subagent"])) {
    return "legacy";
  }
  if (includesAny(joined, ["provider", "image2", "seedance", "jimeng", "lanyi", "tavily", "tts", "voice", "audio"])) {
    return "provider";
  }
  if (includesAny(joined, ["runtime", "project-store", "project-vibe", "current-project", "relay-queue", "final-video", "export", "electron", "package:"])) {
    return "runtime";
  }
  if (includesAny(joined, ["ui", "minimal", "preview", "browser", "settings", "new-video", "startup-watchdog"])) {
    return "ui";
  }
  if (includesAny(joined, ["smoke", "verify:", "demo:", "acceptance"])) {
    return "smoke";
  }
  if (includesAny(joined, ["agent", "director", "storyboard", "script", "asset", "qa", "knowledge", "motion"])) {
    return "core";
  }

  return "other";
}

const grouped = Object.entries(scripts).reduce<Record<ScriptGroup, GroupedScript[]>>(
  (acc, [name, command]) => {
    acc[classifyScript(name, command)].push({ name, command });
    return acc;
  },
  {
    smoke: [],
    ui: [],
    runtime: [],
    provider: [],
    live: [],
    deferred: [],
    legacy: [],
    core: [],
    other: [],
  },
);

for (const scriptsInGroup of Object.values(grouped)) {
  scriptsInGroup.sort((a, b) => a.name.localeCompare(b.name));
}

if (json) {
  console.log(JSON.stringify(grouped, null, 2));
} else {
  for (const [group, scriptsInGroup] of Object.entries(grouped)) {
    console.log(`\n${group} (${scriptsInGroup.length})`);
    for (const script of scriptsInGroup) {
      console.log(`  ${script.name}`);
    }
  }
}
