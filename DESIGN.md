# DESIGN.md

## 主题与明暗模式

- 全局通过 `next-themes`（`attribute="class"`，默认跟随系统）驱动 `.dark` 变量体系。
- Admin 管理控制台（`/admin`，含登录页）支持深色模式适配：
  - 页面背景、头部使用语义 token（`bg-background`），不硬编码浅色。
  - 头部提供主题切换按钮（Sun/Moon 图标，`useTheme` 切换，Hydration 安全）。
