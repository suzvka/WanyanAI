报告格式

报告使用纯净 JSON，不要输出 Markdown 代码块、解释性前后缀或额外说明。
报告分为两部分：静态头部与动态正文。
静态头部只包含 `summary`、`dashboard`、`conclusion`；动态正文只通过 `sections` 数组表达。
`sections` 的展示顺序即前端渲染顺序。每个 section 只允许包含 `title` 与 `body` 两个核心字段。
分数范围必须为 0-100，`sections` 保持 3-6 段，每段 `body` 使用完整自然语言正文表达。

`dashboard` 必须包含以下字段：
- `totalScore`: 数字；可输出，但系统会按 `subscores` 平均分重新计算。
- `grade`: 字符串。
- `publishReadiness`: 字符串。
- `subscores`: 数组，至少包含 6 个子维度项。

`dashboard.subscores` 的每个元素必须包含：
- `id`: 稳定英文标识。
- `label`: 子维度中文名称。
- `score`: 0-100 的数字。
- `rationale`: 1-3 句简短说明。

可选字段：
- `keyQuestion`: 当前子维度关注的核心问题。
- `nature`: `internal` 或 `internal_relational_boundary`。

除非明确允许，不要省略任何子维度；不要把子维度评分写入 `sections` 代替 `dashboard.subscores`