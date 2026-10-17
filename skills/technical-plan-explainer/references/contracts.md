# 项目交接合同 v1

项目根独立于 Skill，用户资料、音频和评测不进入 Skill。脚本运行要求 Node.js 22+，参数均通过宿主命令执行能力传递，路径含空格时按宿主规则引用。所有应用脚本的 JSON 输出携带 ok；失败退出非零，报告错误 code。生成文件采用排他写入，OUTPUT_EXISTS 时选新修订路径。

## 工作文件

| 文件 | 字段与用途 |
|---|---|
| project.json | init 生成 schema_version=1、title、stage、sources[{id,file,sha256,coverage}]、nodes、voice_profile_id；Agent 维护节点输入输出摘要、阶段和任务引用，修改前保留恢复点 |
| source-map.json | references[{id,quote,section 或 location,source_id}]；source_id 对应 project.sources；摘录回查原文；可追加 sources 和 coverage |
| fact-map.json | facts[{id,statement,kind: fact/illustration/inference,source_refs}]、open_questions；语义判断由 Agent 完成 |
| narration.md | 纯旁白正文，段落自然换行；不混入分镜、章节编号或执行指令，便于逐字核对 |
| storyboard.json | scenes[{id,start,end,question,subject,initial_state,trigger,end_state,source_refs,motion_rules,proof_times}]；初末状态不同；proof_times 至少两项，须在场景区间内 |
| audio-cues.json | schema_version=1、provenance[{media_id,format,source_sha256,offset,audio_duration}]、sentences[{media_id,text,start,end,words:[{text,start,end}]}]；全局秒制、真实时间戳；多段按实际偏移合并 |
| delivery.json | 见下一节，N6/N7 的显式执行清单 |
| composition/ | 当前 HyperFrames init 创建的原生项目；index.html 包含完整 inline 时间线，assets、package.json/lock 保留实际依赖 |
| qa/ | 原生检查 JSON、截图、浏览器报告、音画/声音与事实检查；与最终产物摘要关联 |
| dist/ | 离线 HTML 和封装回执；每次修订使用新文件名或新项目目录 |

## delivery.json

必需：schema_version=1、title、duration（全局秒数）、composition、script、sources、storyboard、cues、voice、media、chapters、key_cues。可选 description、glossary、native_check。

- composition/script/sources/storyboard/cues 均为项目相对路径，不能经符号链接逃出项目；composition 指向原生目录。
- voice：profile_id、reference_sha256、model。默认 profile_id=cove-reference-v1，model=seed-audio-1.0，摘要从实际已锁定配置读取。
- media：每段 {id,path,start,duration,task_id,profile_id,reference_sha256,model,sample_rate,speech_rate,pitch_rate,cache_key}。path 相对项目根；id 对应原生 audio id，start/duration 与原生标签相同；实际文件字节也须相同。各段不重叠，voice 合同一致，sample_rate=24000、speech_rate=0、pitch_rate=0。
- chapters：[{id,title,start,summary,source_refs}]，按 start 递增，第一章从 0 开始，范围小于总时长。
- key_cues：[{scene_id,action,audio_phrase,word_start,motion_start,source_ref}]。word_start 必须是实际 words 数组中的时间，motion_start 相差至多 0.3 秒；语义匹配由 Agent 同时检查。
- glossary：[{term,definition}]。
- native_check：原生检查报告相对路径，初次可用 qa/hyperframes-check.json。再次检查选新文件名，避免覆盖旧证据。

## 脚本入口

1. `project.mjs doctor` 探测 Node、HyperFrames、seedaudiocli、ffprobe 与外部母版；不验证远端账户授权。
2. `project.mjs profile [CONFIG]` 校验母版，返回配置与参考路径给 Agent 构造真实 CLI 请求；不会提交生成。
3. `project.mjs init OUTPUT --title TITLE --source FILE`，可重复 --source；输出新项目和原文副本。OUTPUT 父目录需存在。
4. `project.mjs cache-key TEXT --prompt PROMPT [--profile CONFIG]`：哈希完整正文、提示词与母版/模型参数，判断已有成功媒体能否复用。
5. `project.mjs cues SUBTITLES --id ID --offset SECONDS --duration AUDIO_SECONDS --output FILE`：读取原始服务毫秒 sentences 或 HyperFrames 秒制扁平 words。输出新 cue 文件；多段由 Agent 合并 provenance 与 sentences，再统一 validate。
6. `project.mjs validate PROJECT`：文件、来源/场景/章节关联、cue 覆盖、段间声音、时长与关键锚点。它不替代事实审查、原生执行、语音听感和画面检查。
7. `project.mjs check PROJECT`：执行原生 hyperframes check、快照与 JSON；封装前后计算输入指纹，报告发生变化则报错。通过后交给 bundle。
8. `bundle.mjs PROJECT [OUTPUT_RELATIVE_HTML]`：默认 dist/explainer.html。要求当前输入的原生检查通过；使用 composition 项目自己的 core/player 依赖。输出 HTML 与 .receipt.json。CSS/脚本/媒体资源有缺口则失败。
9. `verify.mjs PROJECT [HTML_RELATIVE_PATH]`：按外部配置连接授权 CDP，使用实际 Playwright 检查并生成新 qa/browser-ID/ 目录。关闭自己创建的页面，然后退出本工具连接，保留用户浏览器。

## 状态与失效

项目保存 source→fact→script→storyboard→audio→cue→composition→bundle→qa 的输入输出摘要。改来源使 N2 起的语义判断需复核；改正文仅失效关联片段和下游偏移；画面改变保留媒体但重新原生检查和封装；母版/模型参数变化使相关声音缓存失效。收费恢复由 seedaudiocli 原任务负责。application_fingerprint 防止把旧 check 用于新输入；HTML receipt 防止把浏览器测试错归到别的文件。

缺文件/模型/能力、字幕不匹配、资源出界、旧检查和未确认服务结果是可识别失败。保留成功产物，回 SKILL.md 对应节点，不把“部分成功”写成完整交付。
