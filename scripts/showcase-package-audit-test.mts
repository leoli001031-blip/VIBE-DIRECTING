import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function fileSize(relativePath: string) {
  const fullPath = path.join(root, relativePath);
  assert(fs.existsSync(fullPath), `Missing showcase file: ${relativePath}`);
  const stat = fs.statSync(fullPath);
  assert(stat.isFile(), `Showcase path is not a file: ${relativePath}`);
  assert(stat.size > 0, `Showcase file is empty: ${relativePath}`);
  return stat.size;
}

function requireMinSize(relativePath: string, minBytes: number) {
  const size = fileSize(relativePath);
  assert(size >= minBytes, `Showcase file is unexpectedly small: ${relativePath} (${size} bytes)`);
}

function requireText(relativePath: string, pattern: RegExp, label: string) {
  const fullPath = path.join(root, relativePath);
  const text = fs.readFileSync(fullPath, "utf8");
  assert(pattern.test(text), `${relativePath} must mention ${label}`);
}

const fourShotPackage = "showcase-package/vibe-director-4shot-seedance-showcase-2026-06-18T13-00";
const promoPackage = "showcase-package/promo-page-ai-ladies-op-2026-06-18";

const fourShotRequired = [
  `${fourShotPackage}/README.md`,
  `${fourShotPackage}/demo-recording-flow.md`,
  `${fourShotPackage}/01-project-plan/showcase_4shot_plan.md`,
  `${fourShotPackage}/02-reference-assets/scene-rain-street.png`,
  `${fourShotPackage}/02-reference-assets/character-headphone-girl.png`,
  `${fourShotPackage}/02-reference-assets/prop-glowing-ticket.png`,
  `${fourShotPackage}/03-seedance-prompts/shot_1_seedance_prompt.md`,
  `${fourShotPackage}/03-seedance-prompts/shot_2_seedance_prompt.md`,
  `${fourShotPackage}/03-seedance-prompts/shot_3_seedance_prompt.md`,
  `${fourShotPackage}/03-seedance-prompts/shot_4_seedance_prompt.md`,
  `${fourShotPackage}/05-receipts/shot_1_dreamina-submit.json`,
  `${fourShotPackage}/05-receipts/shot_2_dreamina-submit.json`,
  `${fourShotPackage}/05-receipts/shot_3_dreamina-submit.json`,
  `${fourShotPackage}/05-receipts/shot_4_dreamina-submit.json`,
  `${fourShotPackage}/06-thumbnails/four_shot_contact_sheet.png`,
];

for (const file of fourShotRequired) fileSize(file);
for (const file of [
  `${fourShotPackage}/04-generated-videos/shot_1_rainy_ticket.mp4`,
  `${fourShotPackage}/04-generated-videos/shot_2_follow_blue_light.mp4`,
  `${fourShotPackage}/04-generated-videos/shot_3_platform_gate.mp4`,
  `${fourShotPackage}/04-generated-videos/shot_4_window_reflection.mp4`,
  `${fourShotPackage}/04-generated-videos/combined_4shot_preview.mp4`,
]) {
  requireMinSize(file, 512 * 1024);
}

const promoRequired = [
  `${promoPackage}/README.md`,
  `${promoPackage}/index.html`,
  `${promoPackage}/copy/concept-positioning.md`,
  `${promoPackage}/copy/software-screenshot-notes.md`,
  `${promoPackage}/prompts/op-6shot-plan.md`,
  `${promoPackage}/evidence/run-state.json`,
  `${promoPackage}/evidence/submit-ids.md`,
  `${promoPackage}/references/character-reference-grid.png`,
  `${promoPackage}/references/scene-reference-grid.png`,
  `${promoPackage}/software-ui/01-current-entry-viewport.png`,
  `${promoPackage}/software-ui/02-reference-assets.png`,
  `${promoPackage}/software-ui/03-video-preview-status.png`,
  `${promoPackage}/software-ui/04-export-page.png`,
  `${promoPackage}/software-ui/05-story-flow.png`,
  `${promoPackage}/web/ai-ladies-op-final-web.mp4`,
  `${promoPackage}/web/hero-poster.jpg`,
];

for (const file of promoRequired) fileSize(file);
for (const file of [
  `${promoPackage}/shots/shot-01-academy-opening-muted.mp4`,
  `${promoPackage}/shots/shot-02-claude-gpt-duel-muted.mp4`,
  `${promoPackage}/shots/shot-03-gemini-doubao-burst-muted.mp4`,
  `${promoPackage}/shots/shot-04-three-heroine-flash-muted.mp4`,
  `${promoPackage}/shots/shot-05-clubroom-team-muted.mp4`,
  `${promoPackage}/shots/shot-06-core3-hook-muted.mp4`,
]) {
  requireMinSize(file, 512 * 1024);
}

requireText(`${fourShotPackage}/README.md`, /Agent 不只是写一个视频 prompt/, "Agent workflow positioning");
requireText(`${promoPackage}/copy/concept-positioning.md`, /让 AI 不只是生成画面，而是学会怎么拍/, "Skills positioning");
requireText(`${promoPackage}/index.html`, /Vibe Director/, "page title");

console.log("showcase-package-audit-test: ok");
