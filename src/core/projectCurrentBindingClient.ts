import {
  fetchRuntimeJson,
  hasProjectRuntimeIdentity,
  isRecord,
  prepareRuntimeApiRequest,
  projectMismatchMessage,
  projectRuntimeBasePath,
  runtimeRequestInit,
  toRuntimeUrl,
  type ProjectRuntimeIdentity,
} from "./runtimeApiClient";

export const projectCurrentBindingEndpoint = `${projectRuntimeBasePath}/projects/current`;
export const projectCurrentSelectEndpoint = `${projectRuntimeBasePath}/projects/select`;
export const projectCurrentChoicesEndpoint = `${projectRuntimeBasePath}/projects/recent`;

export type ProjectCurrentBindingStatus = {
  status: "loading" | "bound" | "unbound";
  projectId?: string;
  projectRoot?: string;
  projectTitle?: string;
  projectVibePath?: string;
  message?: string;
};

export type SelectCurrentProjectInput = {
  projectRoot: string;
  projectId?: string;
  displayName?: string;
};

export type ProjectCurrentChoice = {
  projectRoot: string;
  displayName: string;
  projectId?: string;
  updatedAt?: string;
  status?: string;
};

function stringRecordValue(record: Record<string, unknown> | undefined, keys: string[]) {
  if (!record) return undefined;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return undefined;
}

export function deriveCurrentProjectBindingStatus(payload: unknown): ProjectCurrentBindingStatus {
  if (!isRecord(payload)) {
    return {
      status: "unbound",
      message: projectMismatchMessage(),
    };
  }

  const currentProject = isRecord(payload.currentProject) ? payload.currentProject : undefined;
  const binding = isRecord(currentProject?.binding) ? currentProject.binding : undefined;
  const project = isRecord(currentProject?.project)
    ? currentProject.project
    : isRecord(payload.project)
      ? payload.project
      : payload;
  const projectId = stringRecordValue(project, ["projectId", "id"])
    || stringRecordValue(currentProject, ["projectId"])
    || stringRecordValue(binding, ["projectId"]);
  const projectRoot = stringRecordValue(project, ["projectRoot", "root"])
    || stringRecordValue(currentProject, ["projectRoot", "projectRootRelativePath"])
    || stringRecordValue(binding, ["projectRoot", "projectRootRelativePath"]);
  const projectTitle = stringRecordValue(project, ["projectTitle", "title", "name"])
    || stringRecordValue(currentProject, ["projectTitle", "title", "name", "displayName"])
    || stringRecordValue(binding, ["projectTitle", "title", "name", "displayName"]);
  const projectVibePath = stringRecordValue(project, ["projectVibePath", "projectVibeRelativePath"])
    || stringRecordValue(currentProject, ["projectVibePath", "projectVibeRelativePath"])
    || stringRecordValue(binding, ["projectVibePath", "projectVibeRelativePath"]);
  const rawStatus = typeof payload.status === "string" ? payload.status.trim().toLowerCase() : "";
  const explicitlyUnbound = payload.bound === false
    || currentProject?.bound === false
    || ["unbound", "unselected", "not_selected", "none", "missing"].includes(rawStatus);
  const explicitlyBlocked = ["blocked", "error", "forbidden", "bad_request"].includes(rawStatus);
  const bound = payload.bound === true
    || currentProject?.bound === true
    || ["bound", "selected", "ready", "ok"].includes(rawStatus)
    || Boolean(projectId || projectRoot);

  if (!explicitlyUnbound && !explicitlyBlocked && bound) {
    return {
      status: "bound",
      projectId,
      projectRoot,
      projectTitle,
      projectVibePath,
      message: typeof payload.message === "string" ? payload.message : undefined,
    };
  }

  return {
    status: "unbound",
    message: typeof payload.message === "string" ? payload.message : projectMismatchMessage(),
  };
}

export function currentProjectBindingIdentity(binding: ProjectCurrentBindingStatus): ProjectRuntimeIdentity | undefined {
  if (binding.status !== "bound") return undefined;
  const identity = {
    projectId: binding.projectId,
    projectRoot: binding.projectRoot,
  };
  return hasProjectRuntimeIdentity(identity) ? identity : undefined;
}

export function deriveCurrentProjectChoices(payload: unknown): ProjectCurrentChoice[] {
  if (!isRecord(payload) || !Array.isArray(payload.choices)) return [];
  const choices: ProjectCurrentChoice[] = [];
  const seenRoots = new Set<string>();
  for (const item of payload.choices) {
    if (!isRecord(item)) continue;
    const projectRoot = stringRecordValue(item, ["projectRoot", "projectRootRelativePath"]);
    if (!projectRoot || projectRoot.startsWith("/") || /^[A-Za-z]:[\\/]/.test(projectRoot) || seenRoots.has(projectRoot)) continue;
    const displayName = stringRecordValue(item, ["displayName", "projectTitle", "title", "name"]) || projectRoot.split("/").filter(Boolean).at(-1) || "未命名项目";
    choices.push({
      projectRoot,
      displayName,
      projectId: stringRecordValue(item, ["projectId", "id"]),
      updatedAt: stringRecordValue(item, ["updatedAt"]),
      status: stringRecordValue(item, ["status"]),
    });
    seenRoots.add(projectRoot);
  }
  return choices;
}

export async function loadCurrentProjectBindingStatus(): Promise<ProjectCurrentBindingStatus> {
  try {
    const payload = await fetchRuntimeJson(projectCurrentBindingEndpoint);
    return deriveCurrentProjectBindingStatus(payload);
  } catch (error) {
    console.error("loadCurrentProjectBindingStatus failed:", error);
    return {
      status: "unbound",
      message: projectMismatchMessage(),
    };
  }
}

export async function loadCurrentProjectChoices(): Promise<ProjectCurrentChoice[]> {
  try {
    const payload = await fetchRuntimeJson(projectCurrentChoicesEndpoint);
    return deriveCurrentProjectChoices(payload);
  } catch (error) {
    console.error("loadCurrentProjectChoices failed:", error);
    return [];
  }
}

export async function selectCurrentProjectBinding(input: SelectCurrentProjectInput): Promise<ProjectCurrentBindingStatus> {
  const projectRoot = input.projectRoot.trim();
  if (!projectRoot) throw new Error("请输入项目路径。");

  await prepareRuntimeApiRequest();
  const response = await fetch(toRuntimeUrl(projectCurrentSelectEndpoint), runtimeRequestInit({
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      projectRoot,
      projectId: input.projectId?.trim() || undefined,
      displayName: input.displayName?.trim() || undefined,
    }),
  }));
  const payload = await response.json().catch(() => undefined);
  if (!response.ok) {
    throw new Error("连接项目失败，请确认路径在当前工作区内并且项目文件可读取。");
  }
  const binding = deriveCurrentProjectBindingStatus(payload);
  if (binding.status !== "bound") {
    throw new Error("连接项目失败，请确认路径在当前工作区内并且项目文件可读取。");
  }
  return binding;
}

export async function clearCurrentProjectBinding(): Promise<ProjectCurrentBindingStatus> {
  await prepareRuntimeApiRequest();
  const response = await fetch(toRuntimeUrl(projectCurrentBindingEndpoint), runtimeRequestInit({
    method: "DELETE",
  }));
  const payload = await response.json().catch(() => undefined);
  if (!response.ok) {
    throw new Error("忘记当前项目失败。");
  }
  return deriveCurrentProjectBindingStatus(payload);
}
