export function agentProjectRequirementCopy(input: {
  localProjectBusy: boolean;
  canCreateLocalProject: boolean;
}) {
  if (input.localProjectBusy) {
    return {
      label: "正在选择项目",
      detail: "正在选择或创建项目文件夹。",
      hint: "正在准备项目文件夹。",
    };
  }
  if (input.canCreateLocalProject) {
    return {
      label: "新建本地项目",
      detail: "生成参考、提交视频或导出前，需要先准备本地项目文件夹。",
      hint: "点底部按钮新建本地项目，再继续。",
    };
  }
  return {
    label: "需要本地项目",
    detail: "生成参考、提交视频或导出前，需要在桌面 App 里选择或新建本地项目。",
    hint: "请在桌面 App 打开或新建本地项目后继续。",
  };
}
