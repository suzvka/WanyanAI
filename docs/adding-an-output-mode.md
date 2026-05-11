# 添加输出模式

输出模式（Output Mode）定义报告的完整生命周期——提示词模板、MCP 工具、评分算法、数据校验、客户端渲染。每个输出模式在 `src/features/output-modes/<id>/` 下独立实现。

## 已有输出模式

| ID | 目录 | 用途 |
|----|------|------|
| `literary-review` | `src/features/output-modes/literary-review/` | 小说点评报告 |
| `gaokao-essay` | `src/features/output-modes/gaokao-essay/` | 高考作文评分报告 |

## 文件结构

```
src/features/output-modes/<mode-id>/
├── module.ts           # 模块注册 + process / validate / buildScoringContext
├── prompt.ts           # 提示词模板
├── mcp-tools.ts        # MCP 工具定义
├── scoring.ts          # 评分算法
├── validate.ts         # Zod 校验 schema
├── renderer.tsx        # 客户端渲染器
├── types.ts            # 模块私有类型
├── multiplierCalculator.ts  # 评分乘数计算（可选）
└── components/         # 渲染子组件（可选）
```

## 步骤

### 1. 创建提示词模板

```ts
// src/features/output-modes/my-mode/prompt.ts
export const PROMPT = `
你是一位专业评审专家。
请从以下维度对文本进行评估：
{subscore_instructions}

输出格式要求：
{output_format_schema}
`.trim();
```

占位符由指令编译系统替换：
- `{subscore_instructions}` — MCP 工具调用指令
- `{output_format_schema}` — JSON Schema 输出格式规定

### 2. 定义 MCP 工具

```ts
// src/features/output-modes/my-mode/mcp-tools.ts
import type { McpToolDefinition } from '@/mcp/types';

export const mcpToolDefinitions: McpToolDefinition[] = [
  {
    name: 'submit_evaluation',
    description: '提交评审结果',
    parameters: { /* inputSchema */ },
    handler: async (args) => ({ content: [{ type: 'text', text: JSON.stringify(args) }] }),
  },
];
```

### 3. 编写校验逻辑

```ts
// src/features/output-modes/my-mode/validate.ts
import { z } from 'zod';

const SubscoreSchema = z.object({
  id: z.string(),
  label: z.string(),
  score: z.number().min(0),
  maxScore: z.number().min(0),
  rationale: z.string(),
});

export const ReportSchema = z.object({
  summary: z.object({ overview: z.string() }),
  dashboard: z.object({ totalScore: z.number(), maxScore: z.number(), grade: z.string() }),
  subscores: z.array(SubscoreSchema),
  sections: z.array(z.object({ body: z.string() })),
  conclusion: z.object({ rationale: z.string() }),
});

export function validate(data: unknown) {
  const result = ReportSchema.safeParse(data);
  if (result.success) return { success: true, data: result.data };
  return {
    success: false,
    errors: result.error.issues.map((e) => ({ path: e.path.join('.'), message: e.message })),
  };
}
```

### 4. 实现数据处理与评分

```ts
// src/features/output-modes/my-mode/scoring.ts
import type { ProcessedSubscore, ProcessedDashboard } from '@/server/output-modes/types';

export function calculateSubscores(rawSubscores: unknown[]): ProcessedSubscore[] {
  // 将模型返回的子维度数据标准化
}

export function calculateDashboard(subscores: ProcessedSubscore[]): ProcessedDashboard {
  // 计算总分、等级
}
```

### 5. 组装模块入口

```ts
// src/features/output-modes/my-mode/module.ts
import { PROMPT } from './prompt';
import { mcpToolDefinitions } from './mcp-tools';
import { validate } from './validate';
import { calculateSubscores, calculateDashboard } from './scoring';
import { buildScoringContext } from './multiplierCalculator';
import type { OutputModeModule, ProcessInput } from '@/server/output-modes/types';

export function register(registry: { register: (module: OutputModeModule) => void }) {
  registry.register({
    id: 'my-mode',
    name: '我的输出模式',

    prompt: PROMPT,
    mcpToolDefinitions,

    validate(data) { return validate(data); },

    process(input: ProcessInput) {
      const validated = validate(input.rawJson);
      if (!validated.success) throw new Error('数据校验失败');

      const subscores = calculateSubscores(validated.data.subscores);
      const dashboard = calculateDashboard(subscores);

      return {
        schemaVersion: '1.0',
        reportId: input.reportId,
        generatedAt: new Date().toISOString(),
        summary: validated.data.summary,
        dashboard,
        conclusion: validated.data.conclusion,
        sections: validated.data.sections,
        meta: { /* ... */ },
        diagnostics: { normalizationMode: 'paragraph-sections', sectionCount: validated.data.sections.length },
      };
    },

    buildScoringContext(params) {
      return buildScoringContext(params.moduleConfig, params.controlSelections);
    },
  });
}
```

**`process()` 返回值**必须符合 `ProcessedReportData` 接口（`src/server/output-modes/types.ts`），核心字段：

| 字段 | 类型 | 说明 |
|------|------|------|
| `summary.overview` | `string` | 报告摘要 |
| `dashboard` | `{ totalScore, maxScore, grade, subscores[] }` | 仪表盘数据 |
| `sections[]` | `{ body, sectionTitle?, paragraphTitle? }` | 段落列表 |
| `conclusion.rationale` | `string` | 结论理由 |

### 6. 创建客户端渲染器

```tsx
// src/features/output-modes/my-mode/renderer.tsx
'use client';

import type { RendererProps } from '../renderer';

export function MyModeRenderer({ reportData }: RendererProps<unknown>) {
  const data = reportData as ProcessedReportData; // 或具体类型

  return (
    <article>
      <h1>{data.summary.title ?? '报告'}</h1>
      <p>{data.summary.overview}</p>
      <Dashboard data={data.dashboard} />
      {data.sections.map((section, i) => (
        <Section key={i} data={section} />
      ))}
    </article>
  );
}
```

`RendererProps<T>` 提供：

| Prop | 类型 | 说明 |
|------|------|------|
| `reportData` | `T` | 处理后的报告数据（即 `process()` 返回值） |
| `isLoading` | `boolean` | 加载状态 |
| `error` | `string \| null` | 错误信息 |

### 7. 注册到两端

**服务端** — 编辑 `src/server/output-modes/registry.ts`：

```ts
import { register as registerMyMode } from '@/features/output-modes/my-mode/module';

const OUTPUT_MODE_REGISTER_MAP = {
  // ...
  'my-mode': registerMyMode,
};
```

**客户端** — 编辑 `src/features/output-modes/manifest.ts`：

```ts
import { MyModeRenderer } from '@/features/output-modes/my-mode/renderer';

export function getOutputModeManifest() {
  return [
    // ...
    { id: 'my-mode', name: '我的输出模式', renderer: MyModeRenderer },
  ];
}
```

### 8. 关联到模块

在模块的 `main.json` 中指定：

```json
{ "outputMode": "my-mode" }
```

## 约束

- `module.ts` 中的 `register()` 函数命名统一为 `register`
- 服务端文件不得包含 `'use client'` 标记
- 渲染器必须标记 `'use client'`
- `process()` 必须返回符合 `ProcessedReportData` 的对象
- `validate()` 必须返回 `{ success, data?, errors? }` 格式
