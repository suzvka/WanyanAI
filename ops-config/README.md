# Operations Config

`published/` 目录用于存放当前已发布配置文件。

当前实际生效的发布文件：
- `manifest.json`
- `site.json`
- `evaluation-defaults.json`
- `feature-flags.json`
- `analysis-controls.json`

发布方式：
1. 团队确认配置内容。
2. 系统管理员将定稿文件上传到服务器上的 `ops-config/published/`。
3. 前台请求时读取已发布配置；若读取失败则回退到内置最小配置。

当前阶段：
- 已发布配置驱动站点文案、默认值、功能开关与动态检查项
- 提示词模板配置化与版本回滚在二期处理
- 回退配置仅保留最小可运行默认值，不声明未接入的提示能力
- 人类可见的配置文本允许为空字符串，可通过热更快速显示或隐藏对应文本元素
