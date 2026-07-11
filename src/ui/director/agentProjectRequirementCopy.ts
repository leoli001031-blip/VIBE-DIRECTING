export function agentProjectRequirementCopy(input: {
  localProjectBusy: boolean;
  canCreateLocalProject: boolean;
}) {
  if (input.localProjectBusy) {
    return {
      label: "正在选择保存位置",
      detail: "正在为这版故事准备保存位置。",
      hint: "正在准备保存位置。",
    };
  }
  if (input.canCreateLocalProject) {
    return {
      label: "选择保存位置",
      detail: "生成参考、视频或导出前，需要先选择这版故事的保存位置。",
      hint: "点下方「选择保存位置」，再继续。",
    };
  }
  return {
    label: "需要保存位置",
    detail: "生成参考、视频或导出前，需要先选择这版故事的保存位置。",
    hint: "请在桌面 App 选择保存位置后继续。",
  };
}
