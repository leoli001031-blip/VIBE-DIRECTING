import fs from "node:fs";
import { execSync } from "node:child_process";

const outDir = "schemas";
fs.mkdirSync(outDir, { recursive: true });

// Find all schema names from test files
const refs = new Set<string>();
for (const f of fs.readdirSync("scripts")) {
  if (!f.endsWith(".mts") && !f.endsWith(".mjs")) continue;
  const content = fs.readFileSync(`scripts/${f}`, "utf8");
  for (const m of content.matchAll(/schemas\/([a-z_]+\.schema\.json)/g)) {
    refs.add(m[1]);
  }
}

// For each schema, extract relevant constants from source code
function findSourceFile(schemaName: string): string | null {
  const base = schemaName.replace(".schema.json", "").replace(/_/g, "");
  // Try common patterns
  const patterns = [
    `src/core/${base}.ts`,
    `src/core/${base.replace(/harness|checker|manager|builder|runner|shell|gate|preview|plan|pilot|executor|library/g, "")}.ts`,
  ];
  for (const p of patterns) {
    if (fs.existsSync(p)) return p;
  }
  // Search
  const result = execSync(`grep -rl "schemaVersion.*${base}" src/core/ --include="*.ts" 2>/dev/null || echo ""`, { encoding: "utf8" }).trim();
  return result.split("\n")[0] || null;
}

function extractConsts(sourcePath: string): Record<string, unknown> {
  try {
    const content = fs.readFileSync(sourcePath, "utf8");
    const consts: Record<string, unknown> = {};
    for (const m of content.matchAll(/export const (\w+)(?:\s*:\s*\w+)?\s*=\s*(.+?)(?:;|\n\s*\/\/|\n\s*\n)/gs)) {
      try {
        const val = m[2].trim();
        if (val === "true") consts[m[1]] = true;
        else if (val === "false") consts[m[1]] = false;
        else if (/^\d+$/.test(val)) consts[m[1]] = Number(val);
        else if (/^"(.+)"$/.test(val)) consts[m[1]] = val.slice(1, -1);
        else if (val.startsWith("{")) {
          try { consts[m[1]] = JSON.parse(val); } catch {}
        }
      } catch {}
    }
    return consts;
  } catch {
    return {};
  }
}

for (const schemaName of refs) {
  const sourcePath = findSourceFile(schemaName);
  const consts = sourcePath ? extractConsts(sourcePath) : {};
  
  const schema: any = {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    type: "object",
    properties: {},
    required: [],
  };

  if (consts.schemaVersion) {
    schema.properties.schemaVersion = { type: "string", const: consts.schemaVersion };
    schema.required.push("schemaVersion");
  }

  // Add common properties
  for (const [key, val] of Object.entries(consts)) {
    if (key === "schemaVersion") continue;
    if (typeof val === "boolean") {
      if (key.startsWith("no") || key.includes("Forbidden") || key.includes("Allowed")) {
        if (!schema.properties.hardLocks) {
          schema.properties.hardLocks = { type: "object", properties: {}, required: [] };
          schema.required.push("hardLocks");
        }
        schema.properties.hardLocks.properties[key] = { type: "boolean", const: val };
      }
    }
  }

  // Ensure basic required fields
  if (!schema.required.includes("schemaVersion")) schema.required.push("schemaVersion");
  
  fs.writeFileSync(`${outDir}/${schemaName}`, JSON.stringify(schema, null, 2));
}

console.log(`Generated ${refs.size} schemas in ${outDir}/`);
