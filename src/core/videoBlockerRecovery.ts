function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function videoBlockerRecoveryAdvice(value: unknown) {
  const intent = videoBlockerRecoveryIntent(value);
  if (!intent) return "在右侧输入框说明要补什么参考，或让 AI 改这一段。";
  const text = clean(value);
  if (/场景|环境|地点|空间|背景|天气|光线|街道|站台|车站|室内|室外/.test(text)) {
    return `可以在右侧输入框说：${intent}；也可以让 AI 把这一段改到现有场景内。`;
  }
  if (/角色|人物|身份|脸|发型|服装|少女|男主|女主/.test(text)) {
    return `可以在右侧输入框说：${intent}；也可以把这一段改成不依赖新角色身份的镜头。`;
  }
  if (/道具|物体|车辆|车|票|书|手机|手持|物件/.test(text)) {
    return `可以在右侧输入框说：${intent}；也可以把道具外观并入当前角色/场景说明。`;
  }
  if (/故事板|分镜|panel|镜头数|切镜|时长|visible|clip|cut/.test(text)) {
    return `可以在右侧输入框说：${intent}；让可见剪辑数量和时间计划一致。`;
  }
  return `可以在右侧输入框说：${intent}；也可以让 AI 把这一段改到现有场景内。`;
}

export function videoBlockerRecoveryIntent(value: unknown) {
  const text = clean(value);
  if (!text) return "";
  const referenceProblem = /参考|缺|不足|无法覆盖|失真|不匹配|混入|污染/.test(text);
  if (referenceProblem && /场景|环境|地点|空间|背景|天气|光线|街道|站台|车站|室内|室外/.test(text)) {
    return "只补参考，补一张覆盖完整行动范围的场景/天气参考，先不要提交视频";
  }
  if (referenceProblem && /角色|人物|身份|脸|发型|服装|少女|男主|女主/.test(text)) {
    return "只补参考，补一张角色身份参考，先不要提交视频";
  }
  if (referenceProblem && /道具|物体|车辆|车|票|书|手机|手持|物件/.test(text)) {
    return "只补参考，补一张独立道具参考，先不要提交视频";
  }
  if (/故事板|分镜|panel|镜头数|切镜|时长|visible|clip|cut/.test(text)) {
    return "重做这一段故事板，先不要提交视频";
  }
  return "";
}

export function appendVideoBlockerRecoveryAdvice(message: unknown) {
  const cleanMessage = clean(message);
  const advice = videoBlockerRecoveryAdvice(cleanMessage);
  if (!cleanMessage) return advice;
  return cleanMessage.includes(advice) ? cleanMessage : `${cleanMessage} ${advice}`;
}
