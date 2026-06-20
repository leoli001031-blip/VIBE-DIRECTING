import { isDirectorAgentExplainOnlyIntent } from "./directorAgentPermissionIntent";

export function directorIntentStartsFreshVideoDraft(value: string) {
  const text = value.trim();
  if (!text || text.length < 12) return false;
  if (isDirectorAgentExplainOnlyIntent(text)) return false;

  const currentObjectFeedback = /^(这个|这段|这一段|当前|选中|刚才|这里|它)\b|^(把|给)?(这个|这段|这一段|当前|选中|刚才|这里|它)|(?:镜头|shot)\s*\d+/iu.test(text);
  const hardFreshSignal = /(新建|新项目|新视频|新短片|另起|换个主题|换一个项目|全新|重新开始)/u.test(text);
  if (hardFreshSignal) return true;
  if (isMaterialWorkspaceReviewIntent(text)) return false;
  if (currentObjectFeedback) return false;
  if (hasPositiveExistingProjectActionSignal(text)) return false;

  const wholeVideoNoun = "(短片|视频|项目|故事|广告|OP|MV|电影|动画|片子)";
  const recreateWholeVideo = new RegExp(`(另做|再做|重新做|重做)[\\s\\S]{0,40}${wholeVideoNoun}`, "iu").test(text);
  const createsWholeVideo = new RegExp(`(做|拍|来|生成|写|制作|创建)(一个|一支|一条|一段)?[\\s\\S]{0,60}${wholeVideoNoun}`, "iu").test(text);
  return recreateWholeVideo || createsWholeVideo;
}

export function directorIntentCanStartNewVideoPlanningWithoutProject(value: string) {
  const text = value.trim();
  if (!text) return false;
  if (isDirectorAgentExplainOnlyIntent(text)) return false;
  if (hasPositiveExistingProjectActionSignal(text)) return false;
  if (isMaterialWorkspaceReviewIntent(text)) return false;
  const explicitlyPlanningOnly = /只(整理|规划|拆|写|看)|先(整理|规划|拆|写|看)|不(生成|发送|提交|导出)|不要(生成|发送|提交|导出)|别(生成|发送|提交|导出)/u.test(text);
  const asksForCostlyOrProjectAction = /(生成参考|补齐参考|生图|生成图片|提交视频|发送视频|生视频|导出|继续|下一步|执行|确认)/u.test(text);
  if (asksForCostlyOrProjectAction && !explicitlyPlanningOnly) return false;
  return directorIntentStartsFreshVideoDraft(text)
    || (text.length >= 12 && /(做一个|拍一个|短片|视频|脚本|故事|分镜|镜头|规划|整理|拆镜头|广告|OP|MV|日漫|电影|动画)/u.test(text));
}

function isMaterialWorkspaceReviewIntent(text: string) {
  return /(?:素材|文件|参考素材|项目材料|拖入文件).{0,16}(?:整理|分类|归类|绑定|匹配|建议|识别)|(?:整理|分类|归类|绑定|匹配|识别).{0,16}(?:素材|文件|参考素材|项目材料|拖入文件)|绑定建议/u.test(text);
}

function hasPositiveExistingProjectActionSignal(text: string) {
  const positiveActionText = text
    .replace(/(不|不要|别)(生成|补齐|补).{0,16}(参考|角色图|场景图|道具图|故事板)/gu, "")
    .replace(/(不|不要|别)(提交|发送|生成|生).{0,8}视频/gu, "")
    .replace(/(不|不要|别)导出/gu, "");
  return /(生成|补齐|补).{0,16}(参考|角色图|场景图|道具图|故事板)|参考.{0,16}(生成|补齐|补)|提交视频|发送视频|生视频|导出/u.test(positiveActionText);
}
