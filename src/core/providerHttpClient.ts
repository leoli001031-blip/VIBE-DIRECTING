export interface Image2ProviderCallInput {
  apiKey: string;
  baseUrl: string;
  prompt: string;
  size?: string;
  n?: number;
  timeoutMs?: number;
}

export interface Image2ProviderCallResult {
  ok: true;
  imageBase64: string;
  imageBytes: Uint8Array;
  metadata: {
    model: string;
    size: string;
    responseTimestamp: string;
  };
}

export interface Image2ProviderCallError {
  ok: false;
  errorType: "auth" | "rate_limit" | "timeout" | "server_error" | "parse_error" | "network_error";
  message: string;
  statusCode?: number;
  diagnostic?: ProviderNetworkDiagnostic;
}

export interface ProviderNetworkDiagnostic {
  kind: "timeout" | "network_error" | "http_error" | "parse_error";
  name?: string;
  message: string;
  causeName?: string;
  causeCode?: string;
  causeMessage?: string;
  retryable: boolean;
}

function classifyError(response: Response): Image2ProviderCallError["errorType"] {
  if (response.status === 401 || response.status === 403) return "auth";
  if (response.status === 429) return "rate_limit";
  if (response.status >= 500) return "server_error";
  return "server_error";
}

function stringField(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 240) : undefined;
}

export function providerNetworkDiagnostic(
  error: unknown,
  kind: ProviderNetworkDiagnostic["kind"],
  fallback: string,
): ProviderNetworkDiagnostic {
  const record = error && typeof error === "object" ? error as Record<string, unknown> : undefined;
  const cause = record?.cause && typeof record.cause === "object" ? record.cause as Record<string, unknown> : undefined;
  return {
    kind,
    name: stringField(record?.name),
    message: stringField(record?.message) || fallback,
    causeName: stringField(cause?.name),
    causeCode: stringField(cause?.code),
    causeMessage: stringField(cause?.message),
    retryable: kind === "timeout" || kind === "network_error",
  };
}

export function providerHttpDiagnostic(response: Response): ProviderNetworkDiagnostic {
  const errorType = classifyError(response);
  return {
    kind: "http_error",
    message: `HTTP ${response.status}: ${response.statusText}`,
    causeCode: String(response.status),
    retryable: errorType === "rate_limit" || errorType === "server_error",
  };
}

export async function callImage2Provider(
  input: Image2ProviderCallInput,
): Promise<Image2ProviderCallResult | Image2ProviderCallError> {
  const baseUrl = input.baseUrl.replace(/\/+$/, "");
  const url = `${baseUrl}/v1/images/generations`;
  const size = input.size || IMAGE2_GENERATE_DEFAULT_SIZE;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${input.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-image-2",
        prompt: input.prompt,
        size,
        n: input.n ?? 1,
        response_format: "b64_json",
      }),
      signal: AbortSignal.timeout(input.timeoutMs ?? 30000),
    });
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === "AbortError") {
      const message = `Request timed out after ${input.timeoutMs ?? 30000}ms`;
      return {
        ok: false,
        errorType: "timeout",
        message,
        diagnostic: providerNetworkDiagnostic(error, "timeout", message),
      };
    }
    return {
      ok: false,
      errorType: "network_error",
      message: error instanceof Error ? error.message : "Network request failed",
      diagnostic: providerNetworkDiagnostic(error, "network_error", "Network request failed"),
    };
  }

  if (!response.ok) {
    const errorType = classifyError(response);
    const diagnostic = providerHttpDiagnostic(response);
    return { ok: false, errorType, message: diagnostic.message, statusCode: response.status, diagnostic };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return {
      ok: false,
      errorType: "parse_error",
      message: "Failed to parse response JSON",
      diagnostic: { kind: "parse_error", message: "Failed to parse response JSON", retryable: true },
    };
  }

  const data = body as Record<string, unknown>;
  const images = data.data as Array<Record<string, unknown>> | undefined;
  const b64 = images?.[0]?.b64_json as string | undefined;

  if (!b64 || typeof b64 !== "string") {
    return { ok: false, errorType: "parse_error", message: "Response missing data[0].b64_json" };
  }

  const imageBytes = Buffer.from(b64, "base64");

  return {
    ok: true,
    imageBase64: b64,
    imageBytes,
    metadata: {
      model: "gpt-image-2",
      size,
      responseTimestamp: new Date().toISOString(),
    },
  };
}
import { IMAGE2_GENERATE_DEFAULT_SIZE } from "./providerPolicy";
