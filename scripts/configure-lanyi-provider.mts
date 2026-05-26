import { stdin } from "node:process";

import { setProviderCredential } from "./runtime-api-credentials.mts";

function argFlag(name: string): boolean {
  return process.argv.includes(name);
}

function argValue(name: string): string | undefined {
  const exact = process.argv.find((arg) => arg.startsWith(`${name}=`));
  if (exact) return exact.slice(name.length + 1);
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stdin) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8").trim();
}

const key = argFlag("--stdin") ? await readStdin() : (process.env.VIBE_IMAGE2_API_KEY || process.env.LANYI_API_KEY || "");
if (!key.trim()) {
  console.error("Missing API key. Pass --stdin or set VIBE_IMAGE2_API_KEY.");
  process.exit(1);
}

const providerId = argValue("--provider-id") || "lanyi-image2";
const label = argValue("--label") || "Lanyi Image2";
const entry = setProviderCredential(providerId, key.trim(), label);

console.log(JSON.stringify({
  ok: true,
  providerId: entry.providerId,
  label: entry.label,
  keyStored: true,
  keyDisplayed: false,
}, null, 2));
