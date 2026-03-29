报告格式

报告使用纯净 JSON，不要输出 Markdown 代码块、解释性前后缀或额外说明。

字段要求：
- `summary`：必须包含 `overview`，可选包含 `title`。
- `subscores`：必须是固定 6 项数组，每项只包含 `id`、`grade`、`rationale`。
- `subscores[].grade` 只能取 `S`、`A`、`B`、`C`、`D` 中的一个值。
- `conclusion`：必须包含 `rationale`。
- `sections`：数组顺序即前端渲染顺序，每项只允许包含 `title` 与 `body`。
- `groups`：分组数组，每组包含 `id`、`title` 与 `sections`，用于把相关段落聚合展示。

内容填充建议：
- `summary.title` 带副标题，引导进入文本赏析。
- `summary.overview` 从核心角度概括文本的艺术特质，突出最具代表性的审美体验。先用一句或几句话概况整体观感，然后进行全局赏析(类似读后感)。
- `subscores[].rationale` 控制在 1-2 句内。
- `sections[].body` 围绕子块标题深入讨论，不重复 `summary.overview`的视角。
- `groups[].sections` 用于把主题相近的段落放在一起，组标题应简洁、稳定、可读。

最小合法示例：

{
  "summary": {
    "overview": "string",
    "title": "string"
  },
  "subscores": [
    {
      "id": "language_expression",
      "grade": "S",
      "rationale": "string"
    }
  ],
  "conclusion": {
    "rationale": "string"
  },
  "groups": [
    {
      "id": "string",
      "title": "string",
      "sections": [
        {
          "title": "string",
          "body": "string"
        }
      ]
    }
  ]
}
