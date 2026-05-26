import { EventEmitter } from "node:events";
import { readRequestJsonBody, requestJsonBodyMaxChars } from "./runtime-api-request-body.mts";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

class MockRequest extends EventEmitter {
  constructor() {
    super();
    this.destroyCalls = [];
  }

  destroy(error) {
    this.destroyCalls.push(error);
    this.emit("error", error);
  }
}

async function readFrom({ chunks = [], end = true, error } = {}) {
  const req = new MockRequest();
  const resultPromise = readRequestJsonBody(req);
  for (const chunk of chunks) {
    req.emit("data", chunk);
  }
  if (error) {
    req.emit("error", error);
  } else if (end) {
    req.emit("end");
  }
  return { req, result: await resultPromise };
}

{
  const { result } = await readFrom();
  assert(result.ok === true, "empty body should be ok");
  assert(result.body === undefined, "empty body should return undefined body");
}

{
  const { result } = await readFrom({ chunks: [" {\"ok\":", "true,\"count\":2} "] });
  assert(result.ok === true, "valid JSON body should be ok");
  assert(result.body.ok === true, "valid JSON should parse boolean field");
  assert(result.body.count === 2, "valid JSON should parse number field");
}

{
  const { result } = await readFrom({ chunks: ["{\"ok\":"] });
  assert(result.ok === false, "invalid JSON body should fail");
  assert(result.message === "Request body must be valid JSON.", "invalid JSON message mismatch");
}

{
  const { result } = await readFrom({ error: new Error("socket closed while reading body") });
  assert(result.ok === false, "stream error should fail");
  assert(result.message === "socket closed while reading body", "stream error message mismatch");
}

{
  const req = new MockRequest();
  const resultPromise = readRequestJsonBody(req);
  req.emit("data", "x".repeat(requestJsonBodyMaxChars + 1));
  const result = await resultPromise;
  assert(result.ok === false, "oversized body should fail");
  assert(result.message === "Request body is too large.", "oversized body message mismatch");
  assert(req.destroyCalls.length === 1, "oversized body should destroy request once");
  assert(req.destroyCalls[0] instanceof Error, "oversized destroy should receive Error");
}

console.log("runtime-api-request-body-test: ok");
