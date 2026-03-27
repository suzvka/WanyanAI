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

## Writing Constraints
- 保持输入、接口、错误处理与编码一致性。

## Reporting Architecture
- 保持现有的总分区域作为固定标准化报告显示，扩展以包括子维度分数，主要通过调整提示来驱动变化，以便模型输出子分数和描述性文本。
- 在本轮中，totalScore 应计算为子维度分数的平均值，同时保持总分区域作为固定标准化报告显示。

