import {
  canCreateLocalProject,
  canChooseProjectRoot,
  canRememberProjectRoot,
  chooseProjectRoot,
  createLocalProject,
  rememberProjectRoot,
} from "../src/project/projectRootDialog";
import { readFileSync } from "node:fs";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`FAIL: ${message}`);
}

const previousWindow = (globalThis as { window?: unknown }).window;

try {
  const preloadSource = readFileSync("electron/preload.mts", "utf8");
  const mainSource = readFileSync("electron/main.mts", "utf8");
  const devRunnerSource = readFileSync("scripts/electron-dev.mts", "utf8");
  const packageSource = readFileSync("package.json", "utf8");
  assert(/tsx scripts\/electron-dev\.mts/.test(packageSource), "electron:dev must use the Electron dev runner");
  assert(/esbuild/.test(devRunnerSource), "Electron dev runner must bundle TS entrypoints before launch");
  assert(/VIBE_ELECTRON_PRELOAD/.test(devRunnerSource), "Electron dev runner must provide compiled preload path");
  assert(/chooseProjectRoot/.test(preloadSource), "preload must expose chooseProjectRoot");
  assert(/project:chooseRoot/.test(preloadSource), "preload must invoke project chooser IPC");
  assert(/createLocalProject/.test(preloadSource), "preload must expose createLocalProject");
  assert(/project:createLocal/.test(preloadSource), "preload must invoke local project creation IPC");
  assert(/rememberProject/.test(preloadSource), "preload must expose rememberProject");
  assert(/project:remember/.test(preloadSource), "preload must invoke remembered project IPC");
  assert(/ipcMain\.handle\("project:chooseRoot"/.test(mainSource), "main process must register project chooser IPC");
  assert(/ipcMain\.handle\("project:createLocal"/.test(mainSource), "main process must register local project creation IPC");
  assert(/ipcMain\.handle\("project:remember"/.test(mainSource), "main process must register remembered project IPC");
  assert(/dialog\.showOpenDialog/.test(mainSource), "main process chooser must use the native open dialog");
  assert(/Vibe Director Studio Projects/.test(mainSource), "main process local project creation must use the default projects folder");
  assert(/projectVibePathForRoot/.test(mainSource), "main process chooser must resolve the Project.vibe target path");
  assert(/createProjectRootScope/.test(mainSource), "main process must use project root scope guard");
  assert(/projectRootScope\.rememberProjectRoot\(resolvedProjectRoot\)/.test(mainSource), "project chooser must authorize the selected project root");
  assert(/projectRootScope\.resolveOpenedProjectPath\(watchDir,\s*"sandbox:watch"\)/.test(mainSource), "sandbox watch must be scoped to opened project roots");
  assert(/ipcMain\.handle\("sandbox:unwatch"/.test(mainSource), "sandbox watch must expose a clone-safe unwatch IPC");
  assert(/projectRootScope\.resolveOpenedProjectPath\(filePath,\s*"sandbox:readFile"\)/.test(mainSource), "sandbox read must be scoped to opened project roots");
  assert(/projectRootScope\.resolveOpenedProjectPath\(filePath,\s*"sandbox:writeFile"\)/.test(mainSource), "sandbox write must be scoped to opened project roots");
  assert(/projectRootScope\.resolveOpenedProjectPath\(sourcePath,\s*"sandbox:copyFile source"\)/.test(mainSource), "sandbox copy source must be scoped to opened project roots");
  assert(/projectRootScope\.resolveOpenedProjectPath\(destinationPath,\s*"sandbox:copyFile destination"\)/.test(mainSource), "sandbox copy destination must be scoped to opened project roots");
  assert(/spawnAllowed/.test(mainSource), "sandbox spawn must use an allowlist");
  assert(/sandbox:spawn is limited to local runtime version checks/.test(mainSource), "sandbox spawn must fail closed for arbitrary commands");
  assert(/electron-runtime/.test(mainSource), "packaged runtime server must use the bundled runtime entry");
  assert(/ELECTRON_RUN_AS_NODE/.test(mainSource), "packaged runtime server must run through Electron's Node mode");
  assert(!/npx",\s*\["tsx"/.test(mainSource), "packaged runtime server must not depend on npx tsx");
  assert(/chooseRuntimePort/.test(mainSource), "packaged runtime server must avoid fixed-port collisions");
  assert(/--vibe-runtime-api-base-url=/.test(mainSource), "main process must pass runtime API base URL to preload");
  assert(/__VIBE_RUNTIME_API_BASE_URL__/.test(preloadSource), "preload must expose the runtime API base URL to the renderer");

  delete (globalThis as { window?: unknown }).window;
  assert(canChooseProjectRoot() === false, "project root dialog should be unavailable without Electron bridge");
  assert(canCreateLocalProject() === false, "local project creation should be unavailable without Electron bridge");
  assert(canRememberProjectRoot() === false, "remembered project restore should be unavailable without Electron bridge");
  const unavailable = await chooseProjectRoot();
  assert(unavailable.cancelled === true, "unavailable dialog should fail closed as cancelled");
  const unavailableCreate = await createLocalProject();
  assert(unavailableCreate.cancelled === true, "unavailable local project creation should fail closed as cancelled");
  const unavailableRemember = await rememberProjectRoot("/tmp/missing");
  assert(unavailableRemember.cancelled === true, "unavailable remembered project restore should fail closed as cancelled");

  (globalThis as { window?: unknown }).window = {
    vibeRuntime: {
      chooseProjectRoot: async () => ({
        cancelled: false,
        projectRoot: " /tmp/vibe-director-project ",
        projectPath: " project/project.vibe ",
        projectVibePath: " /tmp/vibe-director-project/project/project.vibe ",
        hasProjectVibe: true,
        displayName: " Test Project ",
      }),
      createLocalProject: async () => ({
        cancelled: false,
        projectRoot: " /tmp/vibe-director-created ",
        projectPath: " project.vibe ",
        projectVibePath: " /tmp/vibe-director-created/project.vibe ",
        hasProjectVibe: false,
        displayName: " Created Project ",
      }),
      rememberProject: async () => ({
        cancelled: false,
        projectRoot: " /tmp/vibe-director-remembered ",
        projectPath: " project/project.vibe ",
        projectVibePath: " /tmp/vibe-director-remembered/project/project.vibe ",
        hasProjectVibe: true,
        displayName: " Remembered Project ",
      }),
    },
  };

  assert(canChooseProjectRoot() === true, "project root dialog should be available when bridge exposes chooseProjectRoot");
  assert(canCreateLocalProject() === true, "local project creation should be available when bridge exposes createLocalProject");
  assert(canRememberProjectRoot() === true, "remembered project restore should be available when bridge exposes rememberProject");
  const selected = await chooseProjectRoot();
  assert(selected.cancelled === false, "selected project root should not be cancelled");
  assert(selected.projectRoot === "/tmp/vibe-director-project", "selected project root should be trimmed");
  assert(selected.projectPath === "project/project.vibe", "selected Project.vibe path should be trimmed");
  assert(selected.projectVibePath === "/tmp/vibe-director-project/project/project.vibe", "selected absolute Project.vibe path should be trimmed");
  assert(selected.hasProjectVibe === true, "selected project should preserve Project.vibe existence");
  assert(selected.displayName === "Test Project", "selected display name should be trimmed");
  const created = await createLocalProject({ displayName: "Created Project" });
  assert(created.cancelled === false, "created local project should not be cancelled");
  assert(created.projectRoot === "/tmp/vibe-director-created", "created local project root should be trimmed");
  assert(created.projectPath === "project.vibe", "created Project.vibe path should be trimmed");
  assert(created.hasProjectVibe === false, "created local project should start without Project.vibe");
  assert(created.displayName === "Created Project", "created display name should be trimmed");
  const remembered = await rememberProjectRoot("/tmp/vibe-director-remembered");
  assert(remembered.cancelled === false, "remembered project root should not be cancelled");
  assert(remembered.projectRoot === "/tmp/vibe-director-remembered", "remembered project root should be trimmed");
  assert(remembered.projectPath === "project/project.vibe", "remembered Project.vibe path should be trimmed");
  assert(remembered.hasProjectVibe === true, "remembered project should preserve Project.vibe existence");
  assert(remembered.displayName === "Remembered Project", "remembered display name should be trimmed");

  (globalThis as { window?: unknown }).window = {
    vibeRuntime: {
      chooseProjectRoot: async () => ({
        cancelled: false,
        projectRoot: "   ",
      }),
    },
  };
  const blank = await chooseProjectRoot();
  assert(blank.cancelled === true, "blank project root should be normalized to cancelled");
} finally {
  (globalThis as { window?: unknown }).window = previousWindow;
}

console.log("project-root-dialog-bridge-test: Electron project chooser bridge checks completed.");
