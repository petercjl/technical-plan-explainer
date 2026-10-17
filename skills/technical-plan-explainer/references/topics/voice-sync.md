# Cove 连续性与时序

## N5 声音
`project.mjs profile` 读取 TECH_PLAN_VOICE_PROFILE，或当前用户 XDG 配置目录中 technical-plan-explainer/voice-profile.json；未设 XDG 时用目标机器的 .config 约定。母版、确认记录与凭据存放在 Skill 外。脚本验证 accepted/locked、母版校验和与固定模型参数；缺配置返回配置缺口，不能自行挑另一个男声。

默认 cove-reference-v1：同一原始母版，seed-audio-1.0，audio-ref，mp3，24kHz，speech_rate=0，pitch_rate=0。@音频1 指向母版。提示词要求中文自然、平稳、清晰的单人讲述，并附纯正文、必要发音提示；以实际声音检查是否夹有其他说话者或音乐。

按当前 canonical seedaudiocli 完整合同执行，先探测 help/capabilities，再对完整请求 dry-run。付费生成前记录正文、提示词、参数和缓存键，CLI 返回的任务 ID 保存到项目媒体回执。未知提交先 task get/任务历史恢复；不自动重提收费请求。

短讲解优先一次连续生成。长稿按语义分段，初次可按约 40–60 秒规划一段，具体服务限制和实际语速以 live 合同及生成结果为准。分段引用同一原始母版，生成音频不成为下一段参考。比较相邻段的音色、语速、响度、停顿和术语读法，必要时只重做失败段。保留每段 task_id/cache_key。合成连续音轨时重新记录真实偏移；也可在原生时间线上顺序放置独立片段。

## N6 对齐
先读本次服务字幕，检查文本覆盖和逐字起止，而非仅文件存在。project.mjs cues 支持 seedaudiocli 的毫秒 sentences 格式，以及 HyperFrames 转写的秒制扁平 words 数组；偏移参数显式是舞台秒数。多段分别规范化，再按全局时间合并 provenance 和 sentences。

字幕缺失或不可靠时加载 HyperFrames 当前 media-use 转写合同，显式使用 Whisper 多语言 small（或适当多语言模型），中文通常指定 zh；混合语言时检查语言过滤是否遗漏英文术语。`.en` 模型不承接中文。识别差异需对照实际音频纠正或重新对齐，不能把译文硬当讲稿的时间戳。

正文与字幕规范化后逐字相等，是最小机械验收；另核对模型名和专有词。关键动作选 actual words 的起点，设置 motion_start，目标误差不超过 300ms；可有明确设计的提前铺垫与阅读停留，但语义动作的锚点应单独记录。所有字幕、章节、原生媒体共享全局时间；偏移从真实音频和编排得出。

运行时字幕从当前播放头纯函数重建；拖动回退不能保留未来字幕或旧批准状态。普通播放器只调用原生 HyperFrames 的播放/暂停/seek/rate，媒体归原生运行时管理。
