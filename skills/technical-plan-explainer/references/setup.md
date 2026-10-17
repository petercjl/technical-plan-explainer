# 依赖与外部配置

只在依赖缺失/需要迁移时读。按当前宿主安装规范使用稳定用户环境，探测实际入口和版本。必需 Node.js 22+、hyperframes CLI、seedaudiocli、ffprobe；原生项目安装匹配版本的 @hyperframes/core、@hyperframes/player 与 GSAP。0.8.168 / GSAP 3.14.2 是已验证组合，升级先核对当前上游合同。

声音：标准 Cove 母版、固定参数与公开来源记录随包位于 assets/voices/cove-reference-v1/，相对路径可跨机器解析。运行 profile 校验真实文件摘要，返回 profile_source=bundled 或 user。优先级为显式文件参数、TECH_PLAN_VOICE_PROFILE、当前用户 XDG 配置根下 technical-plan-explainer/voice-profile.json、随包标准配置；未设 XDG 时使用用户 .config。显式或已有用户配置损坏、缺母版、摘要不符时直接报告缺口，保留用户选定音色。

个人覆盖配置与音频由使用者外置管理。字段为 profile_id、reference_file、reference_sha256、reference_status=locked、synthesis_acceptance=accepted-by-user，以及 synthesis 的 model/mode/format/sample_rate/speech_rate/pitch_rate。reference_file 相对该配置文件解析或为该用户显式配置的绝对路径。标准母版使用已确认的固定参考音色合成；声音资源本身不包含新讲稿，也不包含配音服务访问权限。

配音服务认证由 canonical seedaudiocli 管理；仅运行它的 auth status/doctor，不读取或打印凭据。安装工具不代表服务已授权。

浏览器：TECH_PLAN_RUNTIME_CONFIG 可指定外部 JSON，默认与上述配置目录同级的 runtime.json。字段 playwright_module 为已安装 Playwright 的模块文件，browser_cdp 为已授权浏览器 CDP URL。也可分别使用 TECH_PLAN_PLAYWRIGHT_MODULE、TECH_PLAN_BROWSER_CDP。未指定模块时从 composition 的项目依赖解析 playwright。程序只创建并关闭自己的检查页，不关闭用户浏览器。没有可用浏览器时返回 CAPABILITY_UNAVAILABLE，不能以静态扫描冒充离线验收。

精确 Skill 解析遵守当前宿主目录与广告 catalog；CLI companion 优先通过 skill source/status/install/update 的已发现合同获取。HyperFrames 源码/安装来源与版本记录到用户项目，目标机器本地路径只留在该机器配置中。
