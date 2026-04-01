# Copilot Instructions

## Top-level Constraints
- 项目被视为新项目，可优先考虑长期可扩展性。
- 开始下一步开发前，先对齐当前已有模块。
- 当前环境没有可用的本地编译工具链，构建验证需在外部环境完成。
- 优先保持输入、接口、错误处理与编码一致性。
- 使用 `pnpm`。
- 优先使用 `src/components/ui/` 中的 `shadcn/ui` 组件。
- 遵循 `Next.js App Router`。
- 使用 `TypeScript` 与 `@/` 路径别名。
- 页面模块配置应放在新的独立目录中；每个模块必须是独立文件夹且包含 `main.json` 作为核心注册信息；侧栏/入口仅根据有声明的模块显示；模块对外仅暴露 `slug`、`title`、`description`，其余为内部配置。

## Temp Constraints
- 在下面添加临时约束。