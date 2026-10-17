# 技术方案动画讲解

把技术方案转成 HyperFrames 机制动画和固定 Cove 配音，输出可离线播放的单文件 HTML。包含字幕、章节、静态讲稿、术语和原文依据，适合阅读架构设计、产品方案与实施说明。

## 安装

在 Codex、SealSeek 或 WorkBuddy 中发送：

> 安装 @petercjl/technical-plan-explainer。

安装完成后开启新会话。需要能执行本地命令的 Agent 和 Node.js 22+。首次制作还需 HyperFrames、seedaudiocli、配音服务授权、外部 Cove 母版及浏览器验收环境；由 Agent 按 Skill 的 setup 合同检查和准备。音色母版与授权由使用者提供，包内不包含个人音频或服务凭据。

## 使用

附上技术方案，发送：

> 用技术方案动画讲解，把附件做成离线 HTML。

按需指定时长：

> 用技术方案动画讲解，把附件做成一分钟的离线 HTML。

## 更新与检查

全局安装的工具每次使用前检查 npm latest，兼容的小版本自动更新并同步已登记的 Skill；新主版本需要手动更新。离线继续使用当前版。自动更新失败会恢复原包；Skill 有本地修改时保留内容并报告冲突。生成项目、媒体及本地声音配置不参与更新。

> 更新 @petercjl/technical-plan-explainer。

> 检查技术方案动画讲解是否可用。

## 给安装 Agent 的执行合同

通过 npm 正式全局安装完整包名，解析实际 `technical-plan-explainer` 入口并确认版本；执行 `skill source --json`，读取返回的 canonical SKILL.md。用 `skill install --agent <当前宿主> --root <实际 Skill 根>` 登记安装。Codex 默认从 CODEX_HOME 解析；WorkBuddy 从 WORKBUDDY_SKILLS_DIR 或用户主目录 .workbuddy/skills 解析；SealSeek 从实际配置解析其当前 workspace 的 skills 根，通过 --root 或 SEALSEEK_SKILLS_DIR 传入。其他宿主可用 --root 指定真实发现目录并先核对能力合同。

手动更新走 `update install --yes` 后 `skill update`，通过 version/source/status 验证。源码 checkout 的版本由 Git 维护，工具返回 UPDATE_OWNER_REQUIRED。工具不在 npm postinstall 自动修改任何 Agent 目录。

已有非托管 Skill 先保留备份并对比，取得迁移授权后移到恢复目录，再执行安装；安装器不会直接覆盖它。复制安装保留用户 UI 元数据和额外文件，托管正文有本地修改时停止更新。锁定目录采用有备份的原位同步。私有声音和浏览器配置见 canonical Skill 的 references/setup.md。

Codex/macOS 已完成业务样片与离线播放验证。SealSeek、WorkBuddy 提供安装适配与能力映射，尚未完成各宿主的真实业务回归。平台生命周期由 CI 验证，不能替代宿主业务验收。
