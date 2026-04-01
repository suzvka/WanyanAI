# Operations Config

`ops-config/` 目录当前用于存放平台级运行配置，服务端直接从该目录根级文件读取配置。

当前实际生效的文件：
- `manifest.json`：平台配置版本、发布时间与环境标识
- `appearance.json`：品牌名称、口号与主题色
- `feature-flags.json`：平台级功能开关

当前未由该目录直接承载的内容：
- 模块注册信息不在 `ops-config/`，而在 `app-modules/<module-id>/main.json`
- 模块文案不在 `ops-config/`，而在 `app-modules/<module-id>/site.json`
- 动态分析选项不在 `ops-config/`，而在 `app-modules/<module-id>/analysis-controls.json`

读取行为：
1. 服务端启动后读取 `ops-config/manifest.json`、`ops-config/appearance.json`、`ops-config/feature-flags.json`。
2. 任一文件读取或校验失败时，回退到内置最小平台配置。
3. 模块配置由 `app-modules/` 目录单独扫描加载，与平台配置分开管理。

当前阶段：
- 平台配置驱动品牌展示与平台级开关
- 模块的分析选项、默认值与选项文案统一由各模块自己的 `analysis-controls.json` 控制
- 动态指令编译当前基于分析选项中的 `promptText`
- `prompt-blocks/` 目录目前为预留目录，运行时尚未直接接入
