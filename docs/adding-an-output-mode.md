# 添加输出模式

输出模式（Output Mode）定义报告的完整生命周期——提示词模板、MCP 工具、数据校验、评分上下文、数据拼装、工具语义解析、客户端渲染。每个输出模式在 `src/features/output-modes/<id>/` 下独立实现（模块自治），框架仅通过 `OutputModeModule` 接口调度。

## 已有输出模式

| ID | 目录 | 用途 |
|----|------|------|
| `literary-review` | `src/features/output-modes/literary-review/` | 小说点评报告 |
| `gaokao-essay` | `src/features/output-modes/gaokao-essay/` | 高考作文评分报告 |
| `text-segmentation` | `src/features/output-modes/text-segmentation/` | 文本分段（中间模式，无渲染器） |
| `checklist` | `src/features/output-modes/checklist/` | 清单模式（中间模式，无渲染器） |

## 文件结构

```
src/features/output-modes/<mode-id>/
├── module.ts           # OutputModeModule 实现 + register()
├── prompt.ts           # 提示词模板
├── mcp-tools.ts        # MCP 工具定义（业务工具，不含框架工具）
├── scoring.ts          # 评分算法
├── validate.ts         # Zod 校验 schema
├── renderer.tsx        # 客户端渲染器（终端模式需要）
├── types.ts            # 模块私有类型
├── multiplierCalculator.ts  # 评分乘数计算（可选）
└── components/         # 渲染子组件（可选）
```

## 模块接口（OutputModeModule）

接口定义见 `src/server/output-modes/types.ts`：

| 字段 | 必填 | 说明 |
|------|------|------|
| `id` | 是 | 输出模式唯一标识 |
| `name` / `description` | 是 | 显示名称与功能描述（description 供 Agent 编排使用） |
| `prompt` | 是 | 提示词模板（框架运行时与用户动态指令拼接后发给模型） |
| `mcpToolDefinitions` | 否 | 业务 MCP 工具定义（**不要声明框架工具**，见下） |
| `validate(data)` | 是 | 校验模型输出，返回 `{ success, data?, errors? }` |
| `buildScoringContext(params)` | 是 | 根据 `moduleConfig` + `controlSelections` 构建评分上下文 |
| `assemble(collectedData)` | 否 | 将多工具收集的数据（`{ toolName: data[] }`）拼装为完整报告 |
| `resolveToolCall(toolName, params)` | 否 | 把业务工具调用映射为框架语义动作（`data`/`abort`/`finalize`/`unknown`） |
| `getFrameworkToolNames()` | 否 | 声明依赖的框架工具名，默认 `['abort_workflow']` |

> **框架工具注入**：`abort_workflow` 由注册表 `getTools()` 自动注入，模块无需（也不应）自行声明；若声明了框架工具，注册表会过滤并告警。

## 步骤

### 1. 创建提示词模板

```ts
// src/features/output-modes/my-mode/prompt.ts
export const MY_MODE_PROMPT = `
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

export function getMyModeMcpTools(): McpToolDefinition[] {
  return [
    {
      name: 'submit_evaluation',
      description: '提交评审结果',
      parameters: { /* inputSchema */ },
      handler: async (args) => ({ ok: true, data: args }),
    },
  ];
}
```

注意：
- `handler` 返回值约定为 `{ ok, data?, error?, terminate? }`（`terminate: true` 表示终止收集流程）
- 工具名使用 `snake_case`，与提示词中的 `<call name="...">` 标签一致

### 3. 编写校验逻辑

```ts
// src/features/output-modes/my-mode/validate.ts
import { z } from 'zod';
import type { ValidationResult } from '@/server/output-modes/types';

const SubscoreSchema = z.object({
  id: z.string(),
  label: z.string(),
  score: z.number().min(0),
  maxScore: z.number().min(0),
  rationale: z.string(),
});

const ReportSchema = z.object({
  summary: z.object({ overview: z.string() }),
  subscores: z.array(SubscoreSchema),
  sections: z.array(z.object({ body: z.string() })),
  conclusion: z.object({ rationale: z.string() }),
});

export function validate(data: unknown): ValidationResult {
  const result = ReportSchema.safeParse(data);
  if (result.success) return { success: true, data: result.data };
  return {
    success: false,
    errors: result.error.issues.map((e) => ({ path: e.path.join('.'), message: e.message })),
  };
}
```

### 4. 实现评分上下文与数据拼装

```ts
// src/features/output-modes/my-mode/scoring.ts
import type { ReportScoringContext } from '@/types/analysis';
import type { BuildScoringContextParams, CollectedToolData } from '@/server/output-modes/types';

export function buildScoringContext(params: BuildScoringContextParams): ReportScoringContext {
  // 根据 moduleConfig.controls + controlSelections 计算评分乘数
}

export function assemble(collectedData: CollectedToolData): unknown {
  // 将多工具收集的数据（collect_summary / collect_subscore / …）拼装为完整报告对象
  // 返回值将交给 validate() 校验
}
```

### 5. 组装模块入口

```ts
// src/features/output-modes/my-mode/module.ts
import 'server-only';

import type { OutputModeModule, OutputModeRegistry, BuildScoringContextParams, CollectedToolData, ToolCallResolutionResult } from '@/server/output-modes/types';
import { MY_MODE_PROMPT } from './prompt';
import { getMyModeMcpTools } from './mcp-tools';
import { validate } from './validate';
import { buildScoringContext, assemble } from './scoring';

export const myModeModule: OutputModeModule = {
  id: 'my-mode',
  name: '我的输出模式',
  description: '对文本进行 XX 维度评审，产出结构化报告。',
  prompt: MY_MODE_PROMPT,
  mcpToolDefinitions: getMyModeMcpTools(),

  validate,

  buildScoringContext: (params: BuildScoringContextParams) => buildScoringContext(params),

  assemble: (collectedData: CollectedToolData) => assemble(collectedData),

  resolveToolCall: (toolName: string, params: Record<string, unknown>): ToolCallResolutionResult => {
    if (toolName === 'finalize_report') return { type: 'finalize' };
    return { type: 'unknown' };
  },
};

export function register(registry: OutputModeRegistry): void {
  registry.register(myModeModule);
}
```

参考实现：`src/features/output-modes/literary-review/module.ts`。

### 6. 创建客户端渲染器

```tsx
// src/features/output-modes/my-mode/renderer.tsx
'use client';

import type { RendererProps } from '../renderer';

export function MyModeRenderer({ reportData }: RendererProps<unknown>) {
  const data = reportData as { summary: { overview: string } };
  return (
    <article>
      <h1>评审报告</h1>
      <p>{data.summary.overview}</p>
    </article>
  );
}
```

`RendererProps<T>` 提供：

| Prop | 类型 | 说明 |
|------|------|------|
| `reportData` | `T` | 报告原始数据（`validate` 校验通过后的对象） |
| `isLoading` | `boolean` | 加载状态 |
| `error` | `string \| null` | 错误信息 |

### 7. 注册到两端

**服务端** — 在 `src/server/output-modes/manifest.ts` 的 `SERVER_OUTPUT_MODE_MANIFEST` 中添加：

```ts
import { register as registerMyMode } from '@/features/output-modes/my-mode/module';

const SERVER_OUTPUT_MODE_MANIFEST: ServerOutputModeEntry[] = [
  // ...
  { id: 'my-mode', register: registerMyMode },
];
```

**客户端** — 两处：

1. `src/features/output-modes/manifest.ts` 的 `OUTPUT_MODE_MANIFEST` 中添加：

```ts
{
  id: 'my-mode',
  hasRenderer: true,                       // 无渲染器的中间模式填 false
  getMcpTools: getMyModeMcpTools,
},
```

2. `src/features/output-modes/index.ts` 的 `LAZY_RENDERER_LOADERS` 中添加懒加载映射：

```ts
'my-mode': () => import('./my-mode/renderer').then((m) => m.MyModeRenderer),
```

### 8. 关联到模块

在模块的 `main.json` 中指定：

```json
{ "outputMode": "my-mode" }
```

## 约束

- `module.ts` 必须导出统一命名的 `register(registry)` 函数，并实现 `OutputModeModule` 接口
- 服务端文件（`module.ts` / `prompt.ts` / `mcp-tools.ts` / `scoring.ts` / `validate.ts`）不得包含 `'use client'` 标记，且应导入 `'server-only'`
- 渲染器必须标记 `'use client'`
- `validate()` 必须返回 `{ success, data?, errors? }` 格式（`ValidationResult`）
- 模块只声明业务工具，框架工具（`abort_workflow`）由注册表自动注入
- 无渲染器的中间模式（如 `text-segmentation`）：`hasRenderer: false`，不添加懒加载映射
