# Operations Config

`published/` 目录用于存放当前已发布配置文件。

当前实际生效的发布文件：
- `manifest.json`
- `site.json`
- `feature-flags.json`
- `analysis-controls.json`

发布方式：
1. 团队确认配置内容。
2. 系统管理员将定稿文件上传到服务器上的 `ops-config/published/`。
3. 前台请求时读取已发布配置；若读取失败则回退到内置最小配置。

当前阶段：
- 已发布配置驱动站点文案、功能开关与动态检查项
- 动态下拉的选项注册、默认值与文案统一由 `analysis-controls.json` 控制，顺序直接按数组排列
- 核心控件使用保留 `id`：`text_type`、`text_completeness`、`evaluation_goal`
- 动态下拉默认值取各控件 `options` 数组中的第一个选项
- 提示词模板配置化与版本回滚在二期处理
- 回退配置仅保留最小可运行默认值，不声明未接入的提示能力
- 人类可见的配置文本允许为空字符串，可通过热更快速显示或隐藏对应文本元素
