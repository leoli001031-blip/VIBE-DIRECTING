import { spawn } from "node:child_process";
import path from "node:path";
import { z } from "zod";
import type { ToolDefinition, ToolContext } from "./toolRegistry";
import {
  buildJimengImage2VideoPlan,
  extractDreaminaTaskInfo,
  jimengResumeCommand,
  JIMENG_CLI_DEFAULT_MODEL_VERSION,
  JIMENG_CLI_DEFAULT_VIDEO_RESOLUTION,
} from "../core/jimengVideoCli";
import { buildSeedanceStoryboardVideoPlan, type StoryboardReferenceAsset } from "../core/storyboardReferencePipeline";

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const jimengInputSchema = z.object({
  mode: z.enum(["i2v", "multimodal", "t2v", "extend", "edit"]).default("i2v").describe("Video generation mode"),
  prompt: z.string().min(1).describe("Video generation prompt"),
  negativePrompt: z.string().optional().describe("Things to avoid in the generated video"),
  imagePath: z.string().optional().describe("Input image path (required for i2v, extend, edit modes)"),
  storyboardReferencePath: z.string().optional().describe("Black-and-white storyboard image for multimodal generation"),
  sceneBaselinePath: z.string().optional().describe("Scene/weather reference image for multimodal generation"),
  characterReferencePaths: z.array(z.string()).default([]).describe("Character reference images for multimodal generation"),
  propReferencePaths: z.array(z.string()).default([]).describe("Prop reference images for multimodal generation"),
  audioPath: z.string().optional().describe("Dialogue/audio reference path for multimodal generation"),
  dialogueTranscript: z.string().optional().describe("Dialogue transcript paired with audio reference"),
  duration: z.number().int().min(1).max(60).default(5).describe("Video duration in seconds"),
  ratio: z.string().default("16:9").describe("Dreamina/Jimeng video aspect ratio"),
  width: z.number().int().min(256).max(1920).default(1280).describe("Video width in pixels"),
  height: z.number().int().min(256).max(1080).default(720).describe("Video height in pixels"),
  fps: z.number().int().min(8).max(60).default(24).describe("Frames per second"),
  modelVersion: z.string().default(JIMENG_CLI_DEFAULT_MODEL_VERSION).describe("Dreamina/Jimeng model version"),
  videoResolution: z.string().default(JIMENG_CLI_DEFAULT_VIDEO_RESOLUTION).describe("Dreamina/Jimeng video resolution"),
  shortPollSeconds: z.number().int().min(0).max(180).default(20).describe("Initial CLI poll duration"),
  queueWaitSeconds: z.number().int().min(60).max(7200).default(1800).describe("Maximum recoverable queue wait window"),
  seed: z.number().int().optional().describe("Random seed for reproducibility"),
  outputPath: z.string().optional().describe("File path to save the generated video"),
  extraArgs: z.array(z.string()).optional().describe("Additional CLI arguments to pass to jimeng"),
});

type JimengInput = z.infer<typeof jimengInputSchema>;

export interface JimengResult {
  status: "submitted" | "queued" | "generating" | "success" | "failed" | "unknown";
  videoPath?: string;
  submitId?: string;
  duration: number;
  durationMs: number;
  command: string;
  resumeCommand?: string;
  queueMessage: string;
  stdout: string;
  stderr: string;
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export interface JimengToolConfig {
  /** Path to the jimeng CLI binary. */
  cliPath: string;
  /** Timeout in milliseconds. */
  timeoutMs?: number;
  /** Working directory for the subprocess. */
  cwd?: string;
}

// ---------------------------------------------------------------------------
// Tool Definition
// ---------------------------------------------------------------------------

export function createJimengTool(config: JimengToolConfig): ToolDefinition<JimengInput, JimengResult> {
  const timeoutMs = config.timeoutMs ?? 300_000;

  return {
    name: "jimeng_generate",
    description:
      "Submit a video task via Dreamina/Jimeng (即梦) CLI. The provider is asynchronous, so queued tasks return a submit_id and a resume command instead of blocking forever.",
    schema: jimengInputSchema,
    async execute(input: JimengInput, context: ToolContext): Promise<JimengResult> {
      const startedAt = Date.now();

      const outputPath =
        input.outputPath ??
        `${context.sandboxRoot}/output_${Date.now()}.mp4`;

      const outputDir = (() => {
        const dir = path.dirname(outputPath);
        // Ensure output stays within sandbox
        const resolved = path.resolve(dir);
        const sandboxResolved = path.resolve(context.sandboxRoot);
        if (!resolved.startsWith(sandboxResolved)) {
          throw new Error("Output directory must be inside the sandbox.");
        }
        return resolved;
      })();
      const args: string[] = (() => {
        if (input.mode === "multimodal") {
          if (!input.storyboardReferencePath) {
            throw new Error("Jimeng multimodal mode requires storyboardReferencePath.");
          }
          const sceneBaseline = input.sceneBaselinePath
            ? { id: "scene_baseline", role: "scene_baseline" as const, path: input.sceneBaselinePath }
            : undefined;
          const characterReferences: StoryboardReferenceAsset[] = input.characterReferencePaths.map((path, index) => ({
            id: `character_reference_${index + 1}`,
            role: "character_identity",
            path,
          }));
          const propReferences: StoryboardReferenceAsset[] = input.propReferencePaths.map((path, index) => ({
            id: `prop_reference_${index + 1}`,
            role: "prop_reference",
            path,
          }));
          const dialogueAudio = input.audioPath
            ? { id: "dialogue_audio", role: "dialogue_audio" as const, path: input.audioPath }
            : undefined;
          const plan = buildSeedanceStoryboardVideoPlan({
            shotId: String(context.taskEnvelope.shotId || context.taskEnvelope.id || "shot"),
            storyboardReference: {
              id: "storyboard_reference",
              role: "storyboard_reference",
              path: input.storyboardReferencePath,
            },
            sceneBaseline,
            characterReferences,
            propReferences,
            dialogueAudio,
            dialogueTranscript: input.dialogueTranscript,
            outputDir,
            prompt: input.prompt,
            durationSeconds: input.duration,
            ratio: input.ratio,
            modelVersion: input.modelVersion,
            videoResolution: input.videoResolution,
            shortPollSeconds: input.shortPollSeconds,
            cliPath: config.cliPath,
          });
          return [...plan.args];
        }

        const plan = buildJimengImage2VideoPlan({
          imagePath: input.imagePath || "",
          prompt: input.prompt,
          outputDir,
          durationSeconds: input.duration,
          modelVersion: input.modelVersion,
          videoResolution: input.videoResolution,
          shortPollSeconds: input.shortPollSeconds,
          queueWaitSeconds: input.queueWaitSeconds,
          cliPath: config.cliPath,
        });
        if (input.mode === "i2v") return [...plan.args];
        return [
            input.mode,
            "--prompt", input.prompt,
            "--duration", String(input.duration),
            "--width", String(input.width),
            "--height", String(input.height),
            "--fps", String(input.fps),
          ];
      })();

      if (input.negativePrompt && input.mode !== "multimodal") {
        args.push("--negative-prompt", input.negativePrompt);
      }
      if (input.imagePath && input.mode !== "i2v" && input.mode !== "multimodal") {
        args.push("--image", input.imagePath);
      }
      if (input.seed != null && input.mode !== "multimodal") {
        args.push("--seed", String(input.seed));
      }
      if (input.extraArgs) {
        const ALLOWED_EXTRA_ARGS = new Set([
          "--no-progress",
          "--quiet",
          "--skip-video-validation",
        ]);
        const sanitized = input.extraArgs.filter((arg) => ALLOWED_EXTRA_ARGS.has(arg));
        if (sanitized.length !== input.extraArgs.length) {
          console.error("Jimeng extraArgs contained disallowed values:",
            input.extraArgs.filter((arg) => !ALLOWED_EXTRA_ARGS.has(arg)));
        }
        args.push(...sanitized);
      }

      const fullCommand = `${config.cliPath} ${args.join(" ")}`;
      const safeCommand = `${path.basename(config.cliPath)} ${args.join(" ")}`;

      return new Promise((resolve, reject) => {
        const child = spawn(config.cliPath, args, {
          cwd: config.cwd ?? context.sandboxRoot,
          timeout: timeoutMs,
          stdio: ["ignore", "pipe", "pipe"],
        });

        let stdout = "";
        let stderr = "";
        child.stdout?.on("data", (chunk: Buffer) => {
          stdout += chunk.toString();
        });
        child.stderr?.on("data", (chunk: Buffer) => {
          stderr += chunk.toString();
        });

        child.on("error", (err: Error) => {
          reject(
            new Error(
              `Jimeng CLI failed to start: ${err.message}. Command: ${safeCommand}`,
            ),
          );
        });

        child.on("close", (code: number | null) => {
          const durationMs = Date.now() - startedAt;
          const taskInfo = extractDreaminaTaskInfo(stdout, stderr);
          const status = taskInfo.status === "timed_out" || taskInfo.status === "not_submitted"
            ? "unknown"
            : taskInfo.status;
          const resumeCommand = taskInfo.submitId
            ? jimengResumeCommand({ submitId: taskInfo.submitId, downloadDir: outputDir, cliPath: config.cliPath })
            : undefined;
          if (code !== 0) {
            reject(
              new Error(
                `Jimeng CLI exited with code ${code}. Stderr: ${stderr.slice(-500)}. Command: ${safeCommand}`,
              ),
            );
            return;
          }
          resolve({
            status,
            videoPath: status === "success" ? (taskInfo.localMediaPaths[0] || outputPath) : undefined,
            submitId: taskInfo.submitId,
            duration: input.duration,
            durationMs,
            command: fullCommand,
            resumeCommand,
            queueMessage: taskInfo.submitId && status !== "success"
              ? "Jimeng task is submitted and may still be queued. Resume with query_result instead of resubmitting."
              : "Jimeng CLI returned without a resumable queue id.",
            stdout,
            stderr,
          });
        });
      });
    },
  };
}
