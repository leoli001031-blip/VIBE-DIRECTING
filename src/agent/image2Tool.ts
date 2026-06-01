import { z } from "zod";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import type { ToolDefinition, ToolContext } from "./toolRegistry";

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const image2InputSchema = z.object({
  prompt: z.string().min(1).describe("Image generation prompt"),
  negativePrompt: z.string().optional().describe("Things to avoid in the generated image"),
  width: z.number().int().min(64).max(2048).default(1024).describe("Image width in pixels"),
  height: z.number().int().min(64).max(2048).default(1024).describe("Image height in pixels"),
  seed: z.number().int().optional().describe("Random seed for reproducibility"),
  referenceImagePath: z.string().optional().describe("Path to a reference image for img2img"),
  strength: z.number().min(0).max(1).optional().describe("Denoising strength (0=keep ref, 1=ignore ref)"),
  outputPath: z.string().optional().describe("File path to save the generated image"),
});

type Image2Input = z.infer<typeof image2InputSchema>;

export interface Image2Result {
  imagePath: string;
  evidenceRef: string;
  seed: number;
  width: number;
  height: number;
  durationMs: number;
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export interface Image2ToolConfig {
  /** Base URL of the Image2 API (e.g. "http://localhost:7860"). */
  apiBaseUrl: string;
  /** Default image dimensions. */
  defaultWidth?: number;
  defaultHeight?: number;
  /** Timeout in milliseconds for the API call. */
  timeoutMs?: number;
  /** Project-relative output prefixes allowed inside the sandbox. */
  allowedOutputPrefixes?: string[];
}

const defaultAllowedOutputPrefixes = ["output", "outputs", "evidence", "receipts"];

function normalizeRelativePath(path: string): string {
  const normalized = path.trim().replace(/\\/g, "/").replace(/^\.?\//, "");
  if (!normalized || normalized.endsWith("/") || normalized.startsWith("~/") || isAbsolute(normalized) || normalized.split("/").includes("..")) {
    throw new Error(`Image2 outputPath must be project-relative and scoped: ${path}`);
  }
  return normalized;
}

function normalizePrefix(prefix: string): string {
  return normalizeRelativePath(prefix).replace(/\/+$/, "");
}

function assertAllowedOutputPrefix(path: string, allowedPrefixes: string[]): void {
  const allowed = allowedPrefixes.map(normalizePrefix);
  if (!allowed.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) {
    throw new Error(`Image2 outputPath must stay under ${allowed.join(", ")}: ${path}`);
  }
}

function scopedOutputPath(context: ToolContext, requestedPath: string | undefined, allowedPrefixes: string[]) {
  const relativePath = normalizeRelativePath(requestedPath || `outputs/image2/output_${Date.now()}.png`);
  assertAllowedOutputPrefix(relativePath, allowedPrefixes);
  const root = resolve(context.sandboxRoot);
  const absolutePath = resolve(root, relativePath);
  const scopedRelative = relative(root, absolutePath);
  if (scopedRelative === "" || scopedRelative.startsWith("..") || isAbsolute(scopedRelative)) {
    throw new Error(`Image2 outputPath escaped sandbox: ${requestedPath}`);
  }
  return { relativePath, absolutePath };
}

// ---------------------------------------------------------------------------
// Tool Definition
// ---------------------------------------------------------------------------

export function createImage2Tool(config: Image2ToolConfig): ToolDefinition<Image2Input, Image2Result> {
  const apiBase = config.apiBaseUrl.replace(/\/$/, "");
  const timeoutMs = config.timeoutMs ?? 120_000;
  const allowedOutputPrefixes = config.allowedOutputPrefixes || defaultAllowedOutputPrefixes;

  return {
    name: "image2_generate",
    description: "Generate an image via the Image2 API (txt2img or img2img). Provide a detailed prompt describing what you want to create.",
    schema: image2InputSchema,
    async execute(input: Image2Input, context: ToolContext): Promise<Image2Result> {
      const startedAt = Date.now();

      const body: Record<string, unknown> = {
        prompt: input.prompt,
        negative_prompt: input.negativePrompt ?? "",
        width: input.width ?? config.defaultWidth ?? 1024,
        height: input.height ?? config.defaultHeight ?? 1024,
        seed: input.seed ?? -1,
      };

      if (input.referenceImagePath) {
        body.reference_image = input.referenceImagePath;
        body.denoising_strength = input.strength ?? 0.75;
      }

      const outputPath = scopedOutputPath(context, input.outputPath, allowedOutputPrefixes);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const endpoint = input.referenceImagePath
          ? `${apiBase}/sdapi/v1/img2img`
          : `${apiBase}/sdapi/v1/txt2img`;
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        if (!response.ok) {
          const errText = await response.text().catch(() => "(no body)");
          throw new Error(`Image2 API error ${response.status}: ${errText}`);
        }

        const data = (await response.json()) as {
          images?: string[];
          parameters?: Record<string, unknown>;
          info?: string;
        };

        if (!data.images || data.images.length === 0) {
          throw new Error("Image2 API returned no images");
        }

        const imageBuffer = Buffer.from(data.images[0], "base64");
        await mkdir(dirname(outputPath.absolutePath), { recursive: true });
        await writeFile(outputPath.absolutePath, imageBuffer);

        const seed = (data.parameters?.seed as number) ?? input.seed ?? -1;
        const durationMs = Date.now() - startedAt;

        return {
          imagePath: outputPath.relativePath,
          evidenceRef: `agent_image2#${outputPath.relativePath}`,
          seed: typeof seed === "number" ? seed : -1,
          width: input.width ?? config.defaultWidth ?? 1024,
          height: input.height ?? config.defaultHeight ?? 1024,
          durationMs,
        };
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
