import { stdin } from "node:process";

import { setProviderCredential } from "./runtime-api-credentials.mts";

function argFlag(name: string): boolean {
  return process.argv.includes(name);
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stdin) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8").trim();
}

const key = argFlag("--stdin")
  ? await readStdin()
  : (process.env.VIBE_APIKEY_FUN_API_KEY || process.env.APIKEY_FUN_API_KEY || process.env.VIBE_IMAGE2_API_KEY || "");

if (!key.trim()) {
  console.error("Missing API key. Pass --stdin or set VIBE_APIKEY_FUN_API_KEY.");
  process.exit(1);
}

const entry = setProviderCredential("apikey-fun-gpt55-responses-image", key.trim(), "Apikey.fun Image2");

console.log(JSON.stringify({
  ok: true,
  providerId: entry.providerId,
  label: entry.label,
  primaryEndpoint: "https://slb.apikey.fun/v1/responses",
  fallbackEndpoint: "https://api.apikey.fun/v1/responses",
  keyStored: true,
  keyDisplayed: false,
}, null, 2));
