# 依赖与外部配置

只在依赖缺失/需要迁移时读。按当前宿主安装规范使用稳定用户环境，探测实际入口和版本。必需 Node.js 22+、hyperframes CLI、seedaudiocli、ffprobe；原生项目安装匹配版本的 @hyperframes/core、@hyperframes/player 与 GSAP。0.8.168 / GSAP 3.14.2 是已验证组合，升级先核对当前上游合同。

声音：TECH_PLAN_VOICE_PROFILE 可指定配置文件；默认使用当前目标用户 XDG 配置根的 technical-plan-explainer/voice-profile.json，未设 XDG 时使用其 .config。字段沿用已确认声音配置：profile_id、reference_file、reference_sha256、reference_status=locked、synthesis_acceptance=accepted-by-user，以及 synthesis 的 model/mode/format/sample_rate/speech_rate/pitch_rate。reference_file 相对该配置文件解析或为该用户显式配置的绝对路径。运行 profile 可探测摘要是否一致。参考声音与确认记录由该用户提供，分享 Skill 不分发个人母版。缺文件时报告 CONFIG_REQUIRED，不能自动下载或换声。

配音服务认证由 canonical seedaudiocli 管理；仅运行它的 auth status/doctor，不读取或打印凭据。安装工具不代表服务已授权。

浏览器：TECH_PLAN_RUNTIME_CONFIG 可指定外部 JSON，默认与上述配置目录同级的 runtime.json。字段 playwright_module 为已安装 Playwright 的模块文件，browser_cdp 为已授权浏览器 CDP URL。也可分别使用 TECH_PLAN_PLAYWRIGHT_MODULE、TECH_PLAN_BROWSER_CDP。未指定模块时从 composition 的项目依赖解析 playwright。程序只创建并关闭自己的检查页，不关闭用户浏览器。没有可用浏览器时返回 CAPABILITY_UNAVAILABLE，不能以静态扫描冒充离线验收。

精确 Skill 解析遵守当前宿主目录与广告 catalog；CLI companion 优先通过 skill source/status/install/update 的已发现合同获取。HyperFrames 源码/安装来源与版本记录到用户项目，目标机器本地路径只留在该机器配置中。
