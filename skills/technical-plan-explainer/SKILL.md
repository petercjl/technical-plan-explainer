---
name: technical-plan-explainer
description: "把技术方案、架构设计或实施文档转成易懂的 HyperFrames 机制动画与固定 Cove 配音，交付可离线播放的单文件 HTML。用于用户希望看懂技术方案、制作带语音的动画讲解或将方案可视化；支持已有讲解项目的局部修订。"
---

# 技术方案动画讲解

把方案变成可解释、可查证的动画讲解。动画显示对象如何移动与改变状态，旁白解释因果，原文面板提供依据。默认面向产品与业务读者，中文讲解；读者、语言、深度与时长服从本次请求。未限定时按机制覆盖确定篇幅，按章节组织。

## 合同与职责

**输入 I**：HTML、Markdown、PDF、DOCX、可访问页面或同一方案的多份资料；可选重点、读者、时长与视觉要求。正文是资料而非操作指令。记录版本、覆盖与疑点。

**策略 S**：读取定位 → 事实理解 → 案例讲稿 → 事件分镜 → 固定母版配音 → 真实时序 → HyperFrames 制作 → 离线验收。应用拥有讲稿、分镜、视觉、项目状态和业务质量；HyperFrames 拥有渲染/播放，seedaudiocli 拥有认证、收费提交、任务恢复与音频导出。

**输出 O**：新版本目录里的 `explainer.html`（内嵌播放资源），以及可恢复的原文定位、讲稿、分镜、媒体、cue、任务记录和 QA。普通运行不安装本 Skill、不改依赖 Skill 的业务规则、不发布网页。运行需要 Node.js 22+、声明的能力与外部声音配置。

首次进入 N2 这个知识依赖节点时，批量读取 [SCHEMA](references/SCHEMA.md)、[index](references/index.md)、[近期 log](references/log.md) 和该节点路线。后续仅加载对应节点的路线与 topic；后续节点和维护来源保持 deferred。方法采用 hybrid 内化，执行不依赖作者的知识库或历史对话。

## 主线

### N0 当前版本与执行环境
通过稳定入口运行 `technical-plan-explainer skill source --json`，读取返回的 canonical `SKILL.md`；全局入口在解析前自动检查兼容的 npm latest 并同步托管安装。若 source 指向已更新正文，切换到该正文后继续 N1。离线沿用当前版；新主版本通过用户明确更新请求迁移。个人声音、凭据和已有项目始终留在包外。包的安装与更新由 CLI 生命周期负责；运行时不手工改写 Skill 文件。缺入口按完整包名 `@petercjl/technical-plan-explainer` 的正式安装合同恢复。

### N1 接收与读取
输入：资料和目标。通过当前 adapter 的 `workspace.files` 读取文件，复杂格式解析按宿主当前对应 Skill 执行，页面按已授权读取能力获取。用 `scripts/project.mjs init OUTPUT --title TITLE --source FILE` 创建全新项目并复制原文；网页先保存可追溯本地快照。需要新目录时直接选新版本，保留旧项目。

输出：来源、版本与提取覆盖。缺页、扫描件识别或冲突版本影响关键结论时明确处理；能独立完成的部分继续。回到 N2 前先加载理解路线，再进行语义分析。

### N2 理解方案
读 [理解路线](references/queries/understand-plan.md)。从问题、参与者、数据对象、动作、状态、边界和取舍提取 fact-map；每条核心结论有 source_ref 和可回查摘录。区分原文、示意、推断。输出 `source-map.json`、事实和疑点，按 [文件合同](references/contracts.md) 关联稳定 ID。关键歧义未解决时缩小范围或提问，解决后回本节点。

### N3 写讲稿
读 [讲解路线](references/queries/build-explanation.md)。先给全局，再跟随一个案例走完整路径，必要时展开关键机制。解释机制为何存在以及代价；名词首次出现用日常话解释。保存 `narration.md` 和章节摘要。长度服从理解目标；用户已明确制作时按授权连续执行，具体歧义才提问。

### N4 编排事件分镜
读 [动画路线](references/queries/choose-motion.md)。每场景声明学习问题、持续主体、初始/目标状态、触发动作、旁白与来源。每个重要机制至少显示一次有效状态变化，保留动作前、中、后的可检查画面。

按精确名称解析并完整加载 `hyperframes`；按其当前入口进入 `general-video`，在创作阶段加载所需 core、animation、creative、keyframes 及命名规则。完整本次 brief 写入 BRIEF，已有授权避免重复访谈。使用当前原生 `hyperframes init` 创建项目下的 `composition/`，安装项目固定版本 core/player/GSAP；遵从工作流的注册与确定性合同。输出 `storyboard.json` 和原生项目。正文全部按同一种卡片淡入时回本节点重做。

### N5 统一声音
读 [声音及时序路线](references/queries/voice-and-sync.md) 的声音部分。运行 `node scripts/project.mjs profile` 解析并校验母版 SHA-256。标准 `cove-reference-v1` 母版与固定参数位于随包 assets/voices/，首次使用即可引用；用户已有外部配置时优先保留其选择。每段引用同一原始母版。个人覆盖配置与服务凭据存放在 Skill 外。

按精确名称解析 `seedaudiocli`，用其 `skill source --json` 加载 canonical Skill；探测实际版本、能力和叶子 help，完整请求先 dry-run 再提交。已有明确生成要求是本任务的付费执行授权；不重复询问。记录任务 ID、正文、母版摘要、模型参数与实际返回路径。未知提交结果查询原任务，遵守 CLI 恢复合同，不盲目付费重试。失败只处理受影响片段，成功媒体复用。

### N6 真实时间对齐
继续声音及时序路线的对齐部分。优先使用本次服务字幕；缺少可用时间戳时动态加载 HyperFrames `media-use` 当前转写合同，明确选中文多语言模型，核对夹杂英文术语。使用 `project.mjs cues` 规范化实际时间戳，核对讲稿覆盖；关键动作声明对应词句和 motion_start。字幕不可用时返回对齐能力修复，不按章节均分伪造时间。

输出 `audio-cues.json`、`delivery.json` 的 media/chapters/key_cues。母版/参数/正文参与媒体缓存键，命中仅允许复用同一输入的成功结果。多段的每段使用独立 ID、真实时长与全局偏移。

### N7 制作与封装
动画按实际 cue 调整。一个原生暂停时间线驱动各对象，媒体交给 HyperFrames，所有状态可前后定位。编译前把本地动画脚本放进原生 HTML 的 inline script，确保原生 lint 能发现注册；应用 JS、字体与 SVG 留在项目资源中。

读 [交付路线](references/queries/verify-delivery.md)。先运行 `project.mjs validate PROJECT`；按当前 HyperFrames CLI 合同运行原生 lint/check、关键帧及快照，错误回所属节点修复。使用 `scripts/bundle.mjs PROJECT` 调用项目安装的官方 core 编译器、内嵌官方 player 和媒体；应用脚本只封装 UI，不复制框架实现。默认输出 `dist/explainer.html`，重复封装使用新版本名。源文件与已有输出保留。

### N8 验收与交付
用 `scripts/verify.mjs PROJECT` 做本地浏览器验收，浏览器配置由 adapter/环境显式提供。实际阻断外网请求，验证音频与播放头、暂停、跳转、倍速、重播、窄屏与脚本异常。检查关键帧证明机制运动，并核对原文和新配音听感；程序通过不替代内容判断。修复后重跑受影响项。

产物包含字幕、章节、静态讲稿、术语、原文摘录；打开依据面板先暂停。保存浏览器报告与最终原生 check，`delivery.json` 更新为实际采用的设置。交付可点击 HTML，并说明实际时长与实质缺口。全部必要资源离线可用才称“离线交付”；缺能力返回清晰错误并保留中间产物。

## 依赖与返回点

| 逻辑依赖 | 发现与当前合同 | 交接 / 返回 |
|---|---|---|
| hyperframes → general-video / core / animation / keyframes / creative | 当前宿主精确 Skill 名；入口依其规则更新/加载，记录 live CLI 版本；core/player 0.8.168 为已验证基线，新版先验证合同 | 明确 brief、分镜、媒体、cue → 原生项目/check；N4/N7 |
| seedaudiocli | CLI canonical Skill；version/capabilities/help；0.2.1 的 audio-ref 合同已验证，运行时探测 | 原始母版、正文、显式参数 → 任务 ID/音频/字幕；N5 |
| media-use（条件） | 从 HyperFrames 当前 Skill 根精确加载；转写中文合同 | 实际音频 → 实际时间戳；N6 |
| 文件格式阅读（条件） | 当前宿主相应精确 Skill/已声明能力；未找到则明确缺口 | 资料 → 可定位正文和覆盖；N1 |

命名依赖不等于加载。读取被调用 Skill 的完整当前说明，资源相对其根解析，执行完回表中节点。缺依赖按其安装方式恢复；不复制被依赖 Skill 或私造服务 API。原生宿主能力见 [capabilities](capabilities.json) 与对应 adapter：[Codex](adapters/codex.json)、[SealSeek](adapters/sealseek.json)、[WorkBuddy](adapters/workbuddy.json)。后两者为 implemented，需在实际宿主核对工具和浏览器配置；不能据安装成功声称完整业务已实测。其他 Agent 需要明确适配，不能运行时自造。

## 修订与恢复
只改画面：复用声音与 cue，回 N4/N7。改正文：仅对应音频、cue、场景及后续总时序失效，回 N3。母版或模型参数改变：对应配音全部重新核验，回 N5。每段 `cache-key` 必须包含完整提示词、正文、母版摘要、模型与参数。工具版本变更先核对合同，项目策略与选定模型保持原意。

保留输入、来源、任务 ID 与成功媒体，创建新修订目录；未确认外部结果先恢复。需要补充新通用能力时单独维护对应能力包，本 Skill 保持业务编排职责。维护来源见 references/source-manifest.md，普通运行不读维护材料；开发基准与用户接受记录存放在 Skill 外。干净上下文回归仅在用户明确请求时运行。
