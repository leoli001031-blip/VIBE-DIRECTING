import crypto from "node:crypto";

export function createRuntimeSessionToken() {
  return crypto.randomBytes(32).toString("base64url");
}
