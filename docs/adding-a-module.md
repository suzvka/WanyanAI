# 添加功能模块

功能模块（Module）是平台的基本交付单元，对应一个独立的评测页面（如「小说点评」「高考作文评分」）。每个模块由 JSON 配置驱动，声明路由、容器、控件和输出模式。

## 文件结构

```
app-modules/<module-id>/
├── main.json              # 模块注册（必填）
├── controls.json          # 控件定义（按需）
├── analysis-controls.json # 分析控制配置（按需）
└── site.json              # 页面文案（按需）
```

参考现有模块（`app-modules/novel-evaluate/`），`analysis-controls.json` 用于声明分析控制选项（与 `controls.json` 分工），部分模块可能只使用其中一个。

## 步骤

### 1. 创建目录与 main.json

```json
{
  "slug": "my-module",
  "title": "我的评测",
  "description": "一句话描述",
  "route": "/evaluate/my-module",
  "containers": [
    { "type": "analysis-controls" },
    { "type": "text-blocks", "params": { "id": "main-text", "title": "正文" } }
  ],
  "outputMode": "literary-review",
  "controlsConfig": "./controls.json",
  "entry": {
    "enabled": true,
    "icon": "BookOpen",
    "order": 1,
    "landing": {
      "tagline": "一句话价值主张，展示在首页卡片上",
      "highlights": ["亮点标签一", "亮点标签二"],
      "accent": "primary"
    }
  }
}
```

| 字段 | 必填 | 说明 |
|------|------|------|
| `slug` | 是 | URL 路径标识，全局唯一 |
| `title` / `description` | 是 | 显示名称 |
| `route` | 是 | 页面路径 |
| `containers` | 是 | 容器列表，必须包含 `analysis-controls` |
| `outputMode` | 是 | 输出模式 ID（须已注册） |
| `controlsConfig` | 否 | 控件配置文件路径或内联数组 |
| `entry.enabled` | 否 | 是否在首页展示 |
| `entry.icon` | 否 | 首页卡片图标（lucide 图标名，需在 `LandingClient` 的 `ICON_MAP` 中注册，未注册时回退默认图标） |
| `entry.landing` | 否 | 首页自描述契约，见下节 |

### 首页自描述契约（可选）

首页内容由模块自己声明，框架只负责透传与渲染。`entry.landing` 支持：

| 字段 | 说明 |
|------|------|
| `tagline` | 一句话价值主张，展示在卡片描述下方 |
| `highlights` | 亮点标签数组（最多 4 个），展示为卡片内短标签 |
| `accent` | 卡片主色调，可选值：`primary` / `violet` / `blue` / `green` / `amber`，默认 `primary` |

所有字段均可缺省：缺省时首页卡片自动退化为「标题 + 描述」的简洁形态，不影响加载。

### 2. 定义控件（可选）

创建 `controls.json`：

```json
[
  {
    "id": "review-dimension",
    "type": "multi-select",
    "title": "评审维度",
    "promptText": "请从以下维度进行评审",
    "maxSelections": 3,
    "options": [
      { "label": "语言表现力", "defaultSelected": true },
      { "label": "情节结构" },
      { "label": "人物塑造" }
    ]
  }
]
```

也可直接在 `main.json` 中使用 `"controls": [...]` 内联。

### 3. 分析控制配置（可选）

创建 `analysis-controls.json` 声明分析控制选项（若模块使用分析控制容器），格式与 `controls.json` 一致。

### 4. 页面文案（可选）

创建 `site.json` 覆盖默认 UI 文本。键名见现有模块的 `site.json`。

## 约束

- `containers[0]` 的 `type` 必须为 `analysis-controls`
- `outputMode` 值必须匹配 `src/server/output-modes/registry.ts` 中已注册的 ID
- 控件的 `type` 值必须匹配 `src/features/controls/manifest.ts` 中已注册的类型
- 模块加载时自动扫描 `app-modules/` 目录，无需手动注册
