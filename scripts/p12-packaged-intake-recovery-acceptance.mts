import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import {
  assertAcceptance,
  closePackagedAcceptanceApp,
  forceClosePackagedAcceptanceApp,
  launchPackagedAcceptanceApp,
  observePackagedTask,
  waitForAcceptance,
  type PackagedAcceptanceClient,
  type RunningPackagedApp,
} from "./lib/packaged-acceptance-harness.mts";

type UiSnapshot = {
  bodyText: string;
  buttons: Array<{ text: string; ariaLabel: string; disabled: boolean }>;
  cards: Array<{ text: string; ariaLabel: string; pressed: string | null }>;
  pendingPointer: string | null;
  timelineKeys: string[];
};

const story = "我要拍一个 8 秒短片：雨夜便利店门口，女孩把纸飞机递给机器人保安，纸飞机在灯箱里亮起来。整理成 2 个镜头，不生成参考图，不提交视频。";
const selectedRevision = "这个只改动作：女孩把纸飞机递给机器人后停半拍，其他不变。";
const appPath = resolve(process.argv[2] || "release/mac-arm64/Vibe Director Studio.app");
const executablePath = join(appPath, "Contents", "MacOS", "Vibe Director Studio");
const evidenceRoot = resolve(process.argv[3] || "docs/evidence/p12-f-packaged-recovery-20260723");
await mkdir(evidenceRoot, { recursive: true });

function scenarioPaths(root: string) {
  return {
    root,
    profileRoot: join(root, "profile"),
    projectsRoot: join(root, "projects"),
    runtimeRoot: join(root, "runtime"),
    bindingPath: join(root, "profile", "current-project.local.json"),
  };
}

async function createScenario(label: string) {
  const paths = scenarioPaths(await mkdtemp(`/tmp/vibe-director-p12-f-${label}-`));
  await Promise.all([
    mkdir(paths.profileRoot, { recursive: true }),
    mkdir(paths.projectsRoot, { recursive: true }),
    mkdir(paths.runtimeRoot, { recursive: true }),
  ]);
  return paths;
}

async function launch(paths: ReturnType<typeof scenarioPaths>) {
  return launchPackagedAcceptanceApp({
    appPath,
    executablePath,
    profileRoot: paths.profileRoot,
    projectsRoot: paths.projectsRoot,
    runtimeRoot: paths.runtimeRoot,
    bindingPath: paths.bindingPath,
    extraEnv: {
      VIBE_DIRECTOR_DISABLE_PROVIDER_CALLS: "1",
    },
  });
}

async function setComposer(client: PackagedAcceptanceClient, value: string) {
  const accepted = await client.evaluate<string>(`(() => {
    const textarea = document.querySelector('textarea[aria-label="和 AI 导演说"]');
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
    setter?.call(textarea, ${JSON.stringify(value)});
    textarea?.dispatchEvent(new Event("input", { bubbles: true }));
    return textarea?.value || "";
  })()`);
  assertAcceptance(accepted === value, "packaged composer did not accept the exact intent");
  await waitForAcceptance(async () => await client.evaluate<boolean>(
    `Boolean(document.querySelector('button[aria-label="发送"]:not(:disabled)'))`,
  ) ? true : undefined, "packaged composer did not enable Send", 20_000);
}

async function doubleSend(client: PackagedAcceptanceClient) {
  const clickCount = await client.evaluate<number>(`(() => {
    const button = document.querySelector('button[aria-label="发送"]:not(:disabled)');
    if (!button) return 0;
    button.click();
    button.click();
    return 2;
  })()`);
  assertAcceptance(clickCount === 2, "packaged Send was unavailable for rapid-send coverage");
}

async function snapshot(client: PackagedAcceptanceClient): Promise<UiSnapshot> {
  return client.evaluate<UiSnapshot>(`(async () => {
    const bootstrap = window.vibeRuntime?.browserDraftBootstrap?.() || {};
    const pendingPointer = bootstrap.pendingIntakeStorageKey
      || localStorage.getItem("vibe-director:project-vibe:browser-draft:pending-intake");
    const timelineKeys = Object.keys(localStorage).filter((key) => key.endsWith(":.vibe-runtime/agent-timeline.json"));
    if (pendingPointer && window.vibeRuntime?.browserDraftFileExists) {
      const path = ".vibe-runtime/agent-timeline.json";
      const exists = await window.vibeRuntime.browserDraftFileExists({ storageKey: pendingPointer, path });
      if (exists.exists) timelineKeys.push(pendingPointer + ":" + path);
    }
    return {
      bodyText: document.body.innerText,
      buttons: [...document.querySelectorAll("button")].map((button) => ({
        text: button.textContent?.replace(/\\s+/g, " ").trim() || "",
        ariaLabel: button.getAttribute("aria-label") || "",
        disabled: button.disabled,
      })),
      cards: [...document.querySelectorAll('[aria-label^="选中草案镜头 "]')].map((card) => ({
        text: card.textContent?.replace(/\\s+/g, " ").trim() || "",
        ariaLabel: card.getAttribute("aria-label") || "",
        pressed: card.getAttribute("aria-pressed"),
      })),
      pendingPointer: pendingPointer || null,
      timelineKeys,
    };
  })()`);
}

async function waitForReadyDraft(client: PackagedAcceptanceClient, expectedText?: string) {
  return waitForAcceptance(async () => {
    const state = await snapshot(client);
    const ready = state.cards.length === 2
      && (state.bodyText.includes("草案待确认") || state.bodyText.includes("待确认草案"))
      && (!expectedText || state.cards.some((card) => card.text.includes(expectedText)));
    if (ready) return state;
    throw new Error(JSON.stringify({
      cardCount: state.cards.length,
      cardLabels: state.cards.map((card) => card.ariaLabel),
      buttons: state.buttons.filter((button) => !button.disabled).slice(-12),
      bodyTail: state.bodyText.slice(-1200),
      pendingPointer: state.pendingPointer,
      timelineKeys: state.timelineKeys,
    }));
  }, `packaged draft did not become ready${expectedText ? ` with ${expectedText}` : ""}`, 40_000);
}

async function assertOneCurrentTask(app: RunningPackagedApp, label: string) {
  const observation = await observePackagedTask(app.client);
  assertAcceptance(observation.currentTaskCount === 1, `${label} must expose exactly one current Agent task`);
  return observation;
}

async function capture(client: PackagedAcceptanceClient, name: string) {
  const page = await client.send("capture_page");
  assertAcceptance(typeof page === "string" && page.length > 1000, `${name} screenshot is empty`);
  await writeFile(join(evidenceRoot, name), Buffer.from(page, "base64"));
}

async function settleBrowserStorage() {
  await new Promise((resolveDelay) => setTimeout(resolveDelay, 1_500));
}

async function selectSecondShot(client: PackagedAcceptanceClient) {
  const clicked = await client.evaluate<boolean>(`(() => {
    const cards = [...document.querySelectorAll('[aria-label^="选中草案镜头 "]')];
    const card = cards[1];
    card?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    return Boolean(card);
  })()`);
  assertAcceptance(clicked, "the second draft shot was unavailable");
  await waitForAcceptance(async () => {
    const state = await snapshot(client);
    return state.cards[1]?.pressed === "true" ? state : undefined;
  }, "the second draft shot did not become selected", 15_000);
}

async function duplicateTimelineEntries(client: PackagedAcceptanceClient) {
  return client.evaluate<{ key?: string; originalCount: number; duplicatedCount: number }>(`(async () => {
    const bootstrap = window.vibeRuntime?.browserDraftBootstrap?.() || {};
    const pointer = bootstrap.pendingIntakeStorageKey
      || localStorage.getItem("vibe-director:project-vibe:browser-draft:pending-intake");
    const path = ".vibe-runtime/agent-timeline.json";
    if (pointer && window.vibeRuntime?.browserDraftReadFile && window.vibeRuntime?.browserDraftWriteFile) {
      const stored = await window.vibeRuntime.browserDraftReadFile({ storageKey: pointer, path });
      const timeline = JSON.parse(stored.content || "{}");
      const originalCount = Array.isArray(timeline.entries) ? timeline.entries.length : 0;
      timeline.entries = [...(timeline.entries || []), ...(timeline.entries || [])];
      await window.vibeRuntime.browserDraftWriteFile({ storageKey: pointer, path, content: JSON.stringify(timeline) });
      return { key: pointer + ":" + path, originalCount, duplicatedCount: timeline.entries.length };
    }
    const key = Object.keys(localStorage).find((item) => item.endsWith(":.vibe-runtime/agent-timeline.json"));
    if (!key) return { originalCount: 0, duplicatedCount: 0 };
    const timeline = JSON.parse(localStorage.getItem(key) || "{}");
    const originalCount = Array.isArray(timeline.entries) ? timeline.entries.length : 0;
    timeline.entries = [...(timeline.entries || []), ...(timeline.entries || [])];
    localStorage.setItem(key, JSON.stringify(timeline));
    return { key, originalCount, duplicatedCount: timeline.entries.length };
  })()`);
}

async function clickStoryConfirmationTwice(client: PackagedAcceptanceClient) {
  const result = await client.evaluate<{ clicked: boolean; label: string }>(`(() => {
    const button = [...document.querySelectorAll("button")].find((item) => {
      const copy = (item.textContent || "") + " " + (item.getAttribute("aria-label") || "");
      return !item.disabled && /确认后保存故事|确认这版故事/.test(copy);
    });
    if (!button) return { clicked: false, label: "" };
    const label = (button.textContent || "").replace(/\\s+/g, " ").trim();
    button.click();
    button.click();
    return { clicked: true, label };
  })()`);
  assertAcceptance(result.clicked, `story confirmation was unavailable: ${result.label}`);
}

async function mutatePendingTimeline(client: PackagedAcceptanceClient, mode: "corrupt" | "missing") {
  return client.evaluate<{ key?: string; pointer: string | null }>(`(async () => {
    const bootstrap = window.vibeRuntime?.browserDraftBootstrap?.() || {};
    const pointer = bootstrap.pendingIntakeStorageKey
      || localStorage.getItem("vibe-director:project-vibe:browser-draft:pending-intake");
    const path = ".vibe-runtime/agent-timeline.json";
    if (pointer && window.vibeRuntime?.browserDraftWriteFile && window.vibeRuntime?.browserDraftDeleteFile) {
      if (${JSON.stringify(mode)} === "corrupt") {
        await window.vibeRuntime.browserDraftWriteFile({ storageKey: pointer, path, content: "{not-json" });
      } else {
        await window.vibeRuntime.browserDraftDeleteFile({ storageKey: pointer, path });
      }
      return { key: pointer + ":" + path, pointer };
    }
    const key = Object.keys(localStorage).find((item) => item.endsWith(":.vibe-runtime/agent-timeline.json"));
    const localPointer = localStorage.getItem("vibe-director:project-vibe:browser-draft:pending-intake");
    if (key) {
      if (${JSON.stringify(mode)} === "corrupt") localStorage.setItem(key, "{not-json");
      else localStorage.removeItem(key);
    }
    return { key, pointer: localPointer };
  })()`);
}

const results: Record<string, unknown> = {
  schemaVersion: "p12_f_packaged_intake_recovery/1.0.0",
  generatedAt: new Date().toISOString(),
  providerCalls: 0,
};

const main = await createScenario("main");
let app: RunningPackagedApp | undefined;
try {
  app = await launch(main);
  await setComposer(app.client, story);
  await doubleSend(app.client);
  const initialReady = await waitForReadyDraft(app.client);
  assertAcceptance(Boolean(initialReady.pendingPointer), "ready draft did not register its pending-intake recovery pointer");
  results.initialReady = { state: initialReady, task: await assertOneCurrentTask(app, "initial ready") };

  await settleBrowserStorage();
  await forceClosePackagedAcceptanceApp(app);
  app = await launch(main);
  const firstRestore = await waitForReadyDraft(app.client);
  results.readyColdRestore = { state: firstRestore, task: await assertOneCurrentTask(app, "ready cold restore") };
  await capture(app.client, "01-ready-draft-cold-restore.png");

  await selectSecondShot(app.client);
  const selectedBeforeRestart = await snapshot(app.client);
  await settleBrowserStorage();
  await forceClosePackagedAcceptanceApp(app);
  app = await launch(main);
  const selectedAfterRestart = await waitForReadyDraft(app.client);
  assertAcceptance(selectedAfterRestart.cards[1]?.pressed === "true", "selected draft shot drifted after restart");
  results.selectedShotColdRestore = {
    before: selectedBeforeRestart.cards,
    after: selectedAfterRestart.cards,
    task: await assertOneCurrentTask(app, "selected-shot cold restore"),
  };
  await capture(app.client, "02-selected-shot-cold-restore.png");

  await setComposer(app.client, selectedRevision);
  await doubleSend(app.client);
  const modifiedReady = await waitForReadyDraft(app.client, "停半拍");
  const duplicated = await duplicateTimelineEntries(app.client);
  assertAcceptance(duplicated.originalCount > 0 && duplicated.duplicatedCount === duplicated.originalCount * 2, "timeline duplicate fault was not injected");
  await settleBrowserStorage();
  await forceClosePackagedAcceptanceApp(app);
  app = await launch(main);
  const modifiedRestore = await waitForReadyDraft(app.client, "停半拍");
  assertAcceptance(modifiedRestore.cards[1]?.pressed === "true", "selected shot drifted after modified-draft restore");
  results.modifiedDraftAndDuplicateRestore = {
    before: modifiedReady.cards,
    duplicateFault: duplicated,
    after: modifiedRestore.cards,
    task: await assertOneCurrentTask(app, "modified draft cold restore"),
  };
  await capture(app.client, "03-modified-draft-cold-restore.png");

  await clickStoryConfirmationTwice(app.client);
  const saveLocation = await waitForAcceptance(async () => {
    const state = await snapshot(app!.client);
    return state.bodyText.includes("选择保存位置") && !state.bodyText.includes("还没有可确认的草案") ? state : undefined;
  }, "duplicate story confirmation did not settle at save-location boundary", 30_000);
  assertAcceptance(saveLocation.pendingPointer == null, "story confirmation did not clear the pending-intake pointer");
  results.saveLocationAfterDuplicateConfirmation = {
    state: saveLocation,
    task: await assertOneCurrentTask(app, "save-location boundary"),
  };

  await settleBrowserStorage();
  await forceClosePackagedAcceptanceApp(app);
  app = await launch(main);
  const saveLocationRestore = await waitForAcceptance(async () => {
    const state = await snapshot(app!.client);
    return state.bodyText.includes("选择保存位置") && !state.bodyText.includes("还没有可确认的草案") ? state : undefined;
  }, "save-location boundary did not survive cold restart", 30_000);
  results.saveLocationColdRestore = {
    state: saveLocationRestore,
    task: await assertOneCurrentTask(app, "save-location cold restore"),
  };
  await capture(app.client, "04-save-location-cold-restore.png");
} finally {
  if (app) await closePackagedAcceptanceApp(app);
  app = undefined;
}

for (const fault of ["corrupt", "missing"] as const) {
  const paths = await createScenario(fault);
  try {
    app = await launch(paths);
    await setComposer(app.client, story);
    await doubleSend(app.client);
    const ready = await waitForReadyDraft(app.client);
    const injected = await mutatePendingTimeline(app.client, fault);
    assertAcceptance(Boolean(injected.key && injected.pointer), `${fault} sidecar fault could not locate the pending timeline`);
    await settleBrowserStorage();
    await forceClosePackagedAcceptanceApp(app);
    app = await launch(paths);
    const failedClosed = await waitForAcceptance(async () => {
      const state = await snapshot(app!.client);
      return state.pendingPointer == null ? state : undefined;
    }, `${fault} sidecar did not clear its pending recovery pointer`, 20_000);
    assertAcceptance(failedClosed.cards.length === 0, `${fault} sidecar restored an unverified draft`);
    assertAcceptance(
      !failedClosed.buttons.some((button) => !button.disabled && /确认这版故事/.test(button.text)),
      `${fault} sidecar revived an actionable stale confirmation`,
    );
    const failedClosedTask = await assertOneCurrentTask(app, `${fault} sidecar fail-closed`);
    assertAcceptance(failedClosedTask.currentTaskStep !== "confirm_story", `${fault} sidecar restored confirm_story as the current task`);
    results[`${fault}Sidecar`] = {
      ready: { cardCount: ready.cards.length, pointer: ready.pendingPointer },
      injected,
      failedClosed,
      task: failedClosedTask,
    };
  } finally {
    if (app) await closePackagedAcceptanceApp(app);
    app = undefined;
  }
}

results.completedAt = new Date().toISOString();
results.status = "pass";
const evidencePath = join(evidenceRoot, "packaged-intake-recovery-observation.json");
await writeFile(evidencePath, `${JSON.stringify(results, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ status: "pass", evidencePath, providerCalls: 0 }, null, 2));
