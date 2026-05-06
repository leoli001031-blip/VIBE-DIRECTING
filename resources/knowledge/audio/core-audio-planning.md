# Core Audio Planning Pack

更新时间：2026-05-05

用途：给声音规划、音频 subagent 和视频任务提供最小可注入规则。当前只生成计划和 provider slot 预留，不调用真实 TTS、BGM 或混音 API。

## 1. Narration / 旁白

- 旁白只写用户故事需要的声轨内容，不替画面解释已经清楚的信息。
- 每条旁白必须绑定 shotId、语言、情绪、语速、入点和出点。
- 旁白可以是临时文字计划；正式 TTS 前必须绑定授权音源或明确使用系统默认临时音色。
- 旁白不得写入视频 prompt 的画面描述里；它属于 audio plan。

## 2. Dialogue / 对白

- 对白以角色为单位记录 speaker、line、delivery、timing 和 sync note。
- 对白优先表达潜台词和行动目标，避免解释性台词。
- 多角色对白必须标出声源位置或画内/画外状态，方便后续混音和字幕对齐。
- 没有对白时显式记录 no_dialogue，避免 worker 自行补台词。

## 3. Voice Source License / 音源授权与预留

- 每个 voiceSourceId 必须有授权状态：approved、candidate、needs_review 或 placeholder。
- approved 才能进入正式 TTS；candidate/placeholder 只能进入计划和预览说明。
- 不允许从参考视频或临时素材中克隆未授权声音。
- provider adapter 只能接收授权后的 voiceSourceId、voicePreset 或 explicit placeholder，不读取凭据。

## 4. Ambience / 环境音

- 环境音记录 location bed、room tone、weather、crowd、machine hum 等可听背景。
- 环境音只服务空间真实感和节奏，不要抢对白或旁白。
- 每条 ambience cue 需要 loudness intent：silent、low、medium、featured。
- 没有环境音时显式记录 no_ambience，而不是留空。

## 5. BGM Brief / 配乐说明

- BGM brief 只描述情绪、节奏、乐器倾向、进入/退出点和授权要求。
- BGM provider slot 预留为 audio.music；当前不得调用真实音乐生成 API。
- 需要音乐时输出 music_brief、license_requirement、duration_hint 和 avoid_terms。
- 不需要音乐时输出 no_bgm，并说明是否保留环境音或对白。

## 6. Video Prompt No BGM Default

- 视频生成 prompt 默认 no BGM。
- video.i2v 或 video.t2v.experimental 任务不得把 BGM、配乐、音乐风格写入视频 prompt。
- 需要声音时，先分离到 audio plan；视频 prompt 只保留画面、运动、节奏和静音规则。
- 如果用户说“不要音乐”“无配乐”“no bgm”，必须命中 audio pack 并在 audio plan 写 no_bgm。

## 7. TTS / BGM Provider Slots

- TTS 预留 providerSlot：audio.tts。
- BGM 预留 providerSlot：audio.music。
- 两个 slot 当前只允许 planned 或 unavailable，不允许 live provider submit。
- provider request 未来最小字段：taskId、shotId、providerSlot、voiceSourceId 或 musicBriefId、expectedOutputPath、sourceIndexHash、knowledgeRouteResultId、contextBudgetId。

## 8. QA Checklist

- voice_source_gate：正式音频是否只使用 approved 音源。
- narration_gate：旁白是否绑定 shotId、timing、语言和情绪。
- dialogue_gate：对白是否绑定 speaker、delivery、sync note，且不解释画面。
- ambience_gate：环境音是否服务空间而不过载。
- bgm_gate：BGM brief 是否明确 license requirement；视频 prompt 是否保持 no_bgm。
- provider_slot_gate：audio.tts/audio.music 只保留为计划，不调用真实 API。
