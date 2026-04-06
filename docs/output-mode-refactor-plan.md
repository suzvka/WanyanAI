# 输出模式模块自治架构整改方案

## 一、问题诊断

### 当前架构问题

| 问题 | 描述 | 影响 |
|------|------|------|
| **模块不自治** | `src/server/output-modes.ts` 硬编码导入各模块 | 新增模块必须修改中心注册表 |
| **MCP 工具耦合** | `submitReport.ts` 定义通用 Schema，无法适配模块特定字段 | 子维度 ID、评分规则无法模块化 |
| **客户端业务逻辑** | `renderer.tsx` 内部进行验证、标准化、评分计算 | 违反客户端/服务端分离 |
| **代码重复** | 同一功能在 `src/features/` 和 `src/server/` 两处定义 | 维护困难 |

---

## 二、目标架构

### 设计原则

1. **完全自治**：每个输出模式模块独立定义所有内容（类型、提示词、MCP工具、验证、评分、渲染）
2. **自动注册**：服务端自动扫描模块目录，无需修改中心注册表
3. **服务端主导**：业务逻辑（验证、标准化、评分）全部在服务端完成
4. **客户端纯渲染**：渲染器只接收已处理的数据，不包含业务逻辑

### 目标文件结构

```
src/server/output-modes/
├── registry.ts              # 注册表（自动扫描，无硬编码）
├── types.ts                 # 公共接口定义
│
├── literary-review/         # 文学作品评审模块
│   ├── index.ts             # 模块入口：导出 register()
│   ├── types.ts             # 数据类型定义
│   ├── prompt.ts            # 提示词模板
│   ├── mcp-tool.ts          # MCP 工具定义（Schema + Handler）
│   ├── processor.ts         # 验证 + 标准化 + 评分计算
│   └── scoring.ts           # 评分常量
│
└── gaokao-essay/            # 高考作文评分模块
    ├── index.ts
    ├── types.ts
    ├── prompt.ts
    ├── mcp-tool.ts
    ├── processor.ts
    └── scoring.ts

src/features/output-modes/
├── registry.tsx             # 客户端渲染器注册表
├── types.ts                 # 渲染器 Props 类型
│
├── literary-review/
│   ├── index.ts             # 导出渲染器
│   ├── renderer.tsx         # 纯渲染组件（无业务逻辑）
│   └── components/          # UI 子组件
│
└── gaokao-essay/
    ├── index.ts
    ├── renderer.tsx
    └── components/
```

---

## 三、核心接口设计

### 3.1 服务端模块接口

```typescript
// src/server/output-modes/types.ts

import type { Tool } from '@obayd/agentic';
import type { ReportScoringContext } from '@/types/analysis';
import type { ModuleConfig } from '@/types/module';

/**
 * 输出模式模块定义
 * 
 * 每个模块必须实现此接口
 */
export interface OutputModeModule {
  /** 模块唯一标识 */
  id: string;
  
  /** 显示名称 */
  name: string;
  
  /** 提示词模板（定义 MCP 工具使用方式、子维度 ID 等） */
  prompt: string;
  
  /** MCP 工具定义（包含 Schema） */
  mcpTool: Tool<any, any>;
  
  /** 数据验证函数 */
  validate: (data: unknown) => ValidationResult;
  
  /** 数据处理函数：验证 + 标准化 + 评分 */
  process: (input: ProcessInput) => ProcessedData;
  
  /** 构建评分上下文 */
  buildScoringContext: (params: BuildScoringContextParams) => ReportScoringContext;
}

/** 验证结果 */
export interface ValidationResult {
  success: boolean;
  data?: unknown;
  errors?: Array<{ path: string; message: string }>;
}

/** 处理器输入 */
export interface ProcessInput {
  reportId: string;
  createdAt: string;
  rawJson: unknown;
  metadata: AnalysisReportMetadata;
  scoringContext: ReportScoringContext;
}

/** 处理后的数据（渲染器输入） */
export interface ProcessedData {
  schemaVersion: string;
  reportId: string;
  reportVersion: string;
  generatedAt: string;
  summary: { title?: string; overview: string };
  dashboard: {
    totalScore: number;
    maxScore: number;
    grade: string;
    subscores: Array<{
      id: string;
      label: string;
      grade: string;
      score: number;
      maxScore: number;
      rationale: string;
    }>;
  };
  conclusion: { rationale: string };
  meta: Record<string, unknown>;
  groups: Array<{ id: string; title: string; sections: Array<{ id: string; title: string; body: string }> }>;
  sections: Array<{ id: string; title: string; body: string }>;
}

/** 评分上下文构建参数 */
export interface BuildScoringContextParams {
  moduleConfig: ModuleConfig;
  controlSelections: Record<string, string>;
}
```

### 3.2 模块入口示例

```typescript
// src/server/output-modes/gaokao-essay/index.ts

import 'server-only';

import { Tool } from '@obayd/agentic';
import type { OutputModeModule } from '../types';
import { GAOKAO_ESSAY_PROMPT } from './prompt';
import { createGaokaoMcpTool } from './mcp-tool';
import { validateGaokaoEssay } from './validate';
import { processGaokaoEssay } from './processor';
import { buildGaokaoScoringContext } from './scoring';

/**
 * 高考作文评分模块定义
 */
export const gaokaoEssayModule: OutputModeModule = {
  id: 'gaokao-essay',
  name: '高考作文',
  prompt: GAOKAO_ESSAY_PROMPT,
  mcpTool: createGaokaoMcpTool(),
  validate: validateGaokaoEssay,
  process: processGaokaoEssay,
  buildScoringContext: buildGaokaoScoringContext,
};

/**
 * 注册函数（由注册表调用）
 */
export function register(registry: OutputModeRegistry): void {
  registry.register(gaokaoEssayModule);
}
```

### 3.3 自动扫描注册表

```typescript
// src/server/output-modes/registry.ts

import 'server-only';

import type { OutputModeModule } from './types';

/**
 * 输出模式注册表
 * 
 * 自动扫描模块目录并注册
 */
class OutputModeRegistry {
  private modules = new Map<string, OutputModeModule>();

  register(module: OutputModeModule): void {
    if (this.modules.has(module.id)) {
      console.warn(`[OutputModeRegistry] 模块 ${module.id} 已存在，将被覆盖`);
    }
    this.modules.set(module.id, module);
    console.log(`[OutputModeRegistry] 已注册模块: ${module.id}`);
  }

  get(id: string): OutputModeModule | undefined {
    return this.modules.get(id);
  }

  getAll(): OutputModeModule[] {
    return Array.from(this.modules.values());
  }

  getIds(): string[] {
    return Array.from(this.modules.keys());
  }

  getPrompt(id: string): string | undefined {
    return this.modules.get(id)?.prompt;
  }

  getMcpTool(id: string): Tool<any, any> | undefined {
    return this.modules.get(id)?.mcpTool;
  }

  validate(id: string, data: unknown) {
    const module = this.modules.get(id);
    if (!module) {
      return { success: false, errors: [{ path: '', message: `未找到输出模式：${id}` }] };
    }
    return module.validate(data);
  }

  process(id: string, input: ProcessInput) {
    const module = this.modules.get(id);
    if (!module) {
      throw new Error(`未找到输出模式：${id}`);
    }
    return module.process(input);
  }
}

/** 全局注册表实例 */
export const outputModeRegistry = new OutputModeRegistry();

/**
 * 自动加载所有模块
 * 
 * 注意：由于 Next.js 不支持动态 import 服务端模块，
 * 这里需要显式导入各模块
 */
export function initOutputModes(): void {
  // 显式导入各模块并注册
  // 新增模块只需在此处添加一行导入
  import('./gaokao-essay').then(m => m.register(outputModeRegistry));
  import('./literary-review').then(m => m.register(outputModeRegistry));
}

// 自动初始化
initOutputModes();
```

---

## 四、MCP 工具下沉

### 4.1 模块级 MCP 工具定义

```typescript
// src/server/output-modes/gaokao-essay/mcp-tool.ts

import 'server-only';

import { Tool } from '@obayd/agentic';
import { z } from 'zod';
import { gaokaoSubscoreIds, type GaokaoSubscoreId } from './types';

/**
 * 高考作文 MCP 工具 Schema
 * 
 * 特点：
 * 1. 子维度 ID 使用模块定义的常量
 * 2. 评级标准与模块评分逻辑一致
 */
const gaokaoGradeValues = ['S', 'A', 'B', 'C', 'D'] as const;
const subscoreIdValues = gaokaoSubscoreIds as [GaokaoSubscoreId, ...GaokaoSubscoreId[]];

const gaokaoSubscoreSchema = z.object({
  id: z.enum(subscoreIdValues).describe('子维度 ID'),
  grade: z.enum(gaokaoGradeValues).describe('评级（S/A/B/C/D）'),
  rationale: z.string().describe('评分理由（1-2 句）'),
});

const gaokaoSummarySchema = z.object({
  title: z.string().optional().describe('报告标题（可选）'),
  overview: z.string().describe('整体评价与核心观点'),
});

const gaokaoConclusionSchema = z.object({
  rationale: z.string().describe('综合评价与提升建议'),
});

const gaokaoSectionSchema = z.object({
  id: z.string().optional(),
  title: z.string().describe('章节标题'),
  body: z.string().describe('章节正文'),
});

const gaokaoGroupSchema = z.object({
  id: z.string().optional(),
  title: z.string().describe('分组标题'),
  sections: z.array(gaokaoSectionSchema).min(1),
});

const gaokaoReportSchema = z.object({
  summary: gaokaoSummarySchema,
  subscores: z.array(gaokaoSubscoreSchema).length(gaokaoSubscoreIds.length),
  conclusion: gaokaoConclusionSchema,
  groups: z.array(gaokaoGroupSchema).optional(),
  sections: z.array(gaokaoSectionSchema).optional(),
});

/**
 * 创建高考作文 MCP 工具
 */
export function createGaokaoMcpTool(): Tool<typeof gaokaoReportSchema, any> {
  return Tool.make('submit_report')
    .description('提交高考作文评分报告')
    .param('summary', '报告摘要', { required: true, schema: gaokaoSummarySchema })
    .param('subscores', `子维度评分（共 ${gaokaoSubscoreIds.length} 项）`, { required: true, schema: z.array(gaokaoSubscoreSchema) })
    .param('conclusion', '报告结论', { required: true, schema: gaokaoConclusionSchema })
    .param('groups', '报告章节分组', { required: false, schema: z.array(gaokaoGroupSchema) })
    .param('sections', '报告章节（兼容旧格式）', { required: false, schema: z.array(gaokaoSectionSchema) })
    .action(async (params) => {
      return { ok: true, data: params, terminate: true };
    });
}
```

### 4.2 运行时工具获取

```typescript
// 在分析任务执行时，根据 outputMode 获取对应的 MCP 工具

import { outputModeRegistry } from '@/server/output-modes/registry';

// 构建 MCP 提示词时
function buildMcpPrompt(outputModeId: string): string {
  const module = outputModeRegistry.get(outputModeId);
  if (!module) throw new Error(`Unknown output mode: ${outputModeId}`);
  
  // 返回模块定义的提示词
  return module.prompt;
}

// 获取 MCP 工具定义（用于模型调用）
function getMcpTool(outputModeId: string): Tool<any, any> {
  const module = outputModeRegistry.get(outputModeId);
  if (!module) throw new Error(`Unknown output mode: ${outputModeId}`);
  
  return module.mcpTool;
}
```

---

## 五、客户端渲染器简化

### 5.1 渲染器接口

```typescript
// src/features/output-modes/types.ts

/**
 * 渲染器 Props
 * 
 * 服务端已完成所有业务逻辑，渲染器只需展示
 */
export interface RendererProps<T = ProcessedData> {
  /** 已处理的数据（包含评分、标准化后的结构） */
  data: T;
  
  /** 回调 */
  onStartNew?: () => void;
  onBackToEdit?: () => void;
}
```

### 5.2 简化后的渲染器

```typescript
// src/features/output-modes/gaokao-essay/renderer.tsx

'use client';

import type { GaokaoEssayData } from '@/server/output-modes/gaokao-essay/types';
import type { RendererProps } from '../types';
import { GaokaoEssayView } from './components/GaokaoEssayView';

/**
 * 高考作文评分报告渲染器
 * 
 * 纯渲染组件：
 * - 接收服务端处理后的 GaokaoEssayData
 * - 不包含验证、标准化、评分等业务逻辑
 */
export function GaokaoEssayRenderer({
  data,
  onStartNew,
  onBackToEdit,
}: RendererProps<GaokaoEssayData>) {
  return (
    <GaokaoEssayView
      data={data}
      onStartNew={onStartNew}
      onBackToEdit={onBackToEdit}
    />
  );
}
```

### 5.3 客户端渲染器注册表

```typescript
// src/features/output-modes/registry.tsx

'use client';

import type { RendererProps, ProcessedData } from './types';
import { LiteraryReviewRenderer } from './literary-review/renderer';
import { GaokaoEssayRenderer } from './gaokao-essay/renderer';

type RendererComponent = React.ComponentType<RendererProps<any>>;

/**
 * 客户端渲染器映射表
 * 
 * 纯静态映射，无业务逻辑
 */
const RENDERER_MAP: Record<string, RendererComponent> = {
  'literary-review': LiteraryReviewRenderer,
  'gaokao-essay': GaokaoEssayRenderer,
};

/**
 * 获取渲染器
 */
export function getOutputModeRenderer(outputModeId: string): RendererComponent | undefined {
  return RENDERER_MAP[outputModeId];
}
```

---

## 六、数据流重设计

### 6.1 完整数据流

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              服务端                                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. 模块选择                                                                 │
│     └── outputModeRegistry.get(moduleId)                                    │
│         ├── module.prompt → 构建提示词                                       │
│         └── module.mcpTool → 注册到模型调用                                  │
│                                                                              │
│  2. 模型调用                                                                 │
│     └── modelClient.call({ tools: [module.mcpTool] })                       │
│         └── 模型返回 toolCall: { name: 'submit_report', params: {...} }     │
│                                                                              │
│  3. 数据处理                                                                 │
│     └── module.process({ rawJson: toolCall.params, ... })                   │
│         ├── module.validate(rawJson) → 验证                                 │
│         ├── 标准化为 ProcessedData                                           │
│         └── module.buildScoringContext() → 评分计算                         │
│                                                                              │
│  4. 返回给客户端                                                             │
│     └── { reportId, outputMode, processedData }                             │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              客户端                                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  5. 获取渲染器                                                               │
│     └── getOutputModeRenderer(outputMode)                                   │
│                                                                              │
│  6. 渲染报告                                                                 │
│     └── <Renderer data={processedData} />                                   │
│         └── 纯展示，无业务逻辑                                               │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6.2 关键代码变更

```typescript
// src/features/analysis-tasks/runAnalysisTask.ts

import { outputModeRegistry } from '@/server/output-modes/registry';

export async function runAnalysisTask(task: RuntimeAnalysisTask, progressController: ProgressController) {
  const outputModeId = task.moduleConfig.manifest.outputMode;
  const module = outputModeRegistry.get(outputModeId);
  
  if (!module) {
    throw createAppError({ code: 'config_invalid', message: `未找到输出模式：${outputModeId}` });
  }

  // 1. 构建提示词（使用模块定义的 prompt）
  const compiledMcpPrompt = module.prompt;
  
  // 2. 获取 MCP 工具
  const mcpTool = module.mcpTool;
  
  // 3. 调用模型
  const result = await modelClient.call({
    baseUrl: task.modelConfig.baseUrl,
    apiKey: task.modelConfig.apiKey,
    model: task.modelConfig.selectedModel,
    messages,
    tools: [mcpTool],  // 使用模块定义的工具
  });

  // 4. 处理返回数据（使用模块的 processor）
  const toolData = result.toolCall.params;
  
  // 5. 验证 + 标准化 + 评分（服务端完成）
  const processedData = module.process({
    reportId: task.id,
    createdAt: new Date().toISOString(),
    rawJson: toolData,
    metadata: { ... },
    scoringContext: module.buildScoringContext({ ... }),
  });

  // 6. 返回处理后的数据给客户端
  return {
    reportId: task.id,
    outputMode: outputModeId,
    data: processedData,
  };
}
```

---

## 七、实施步骤

### Phase 1: 创建新架构骨架
1. 创建 `src/server/output-modes/types.ts` 接口定义
2. 创建 `src/server/output-modes/registry.ts` 注册表
3. 创建 `src/features/output-modes/types.ts` 渲染器接口

### Phase 2: 迁移 literary-review 模块
1. 创建 `src/server/output-modes/literary-review/` 目录
2. 迁移 types.ts、prompt.ts、scoring.ts
3. 创建 mcp-tool.ts（MCP 工具定义）
4. 重构 processor.ts（验证 + 标准化 + 评分）
5. 创建 index.ts（导出 register 函数）
6. 简化客户端渲染器

### Phase 3: 迁移 gaokao-essay 模块
1. 同上

### Phase 4: 更新调用链
1. 修改 `runAnalysisTask.ts` 使用新注册表
2. 修改 MCP 工具获取逻辑
3. 更新 Server Actions

### Phase 5: 清理冗余
1. 删除 `src/server/output-modes.ts`（旧注册表）
2. 删除 `src/mcp/tools/submitReport.ts`（通用工具）
3. 删除 `src/features/output-modes/*/validate.ts`、`scoring.ts`（客户端业务逻辑）
4. 更新 AGENTS.md

### Phase 6: 测试验证
1. 验证文学评审模块
2. 验证高考作文模块
3. 验证新增模块流程

---

## 八、新增模块流程（整改后）

### 步骤

1. **创建服务端模块目录**
   ```bash
   mkdir -p src/server/output-modes/my-module
   ```

2. **创建模块文件**
   ```
   src/server/output-modes/my-module/
   ├── index.ts        # 导出 register()
   ├── types.ts        # 数据类型
   ├── prompt.ts       # 提示词模板
   ├── mcp-tool.ts     # MCP 工具定义
   ├── processor.ts    # 数据处理
   └── scoring.ts      # 评分常量
   ```

3. **实现模块接口**
   ```typescript
   // src/server/output-modes/my-module/index.ts
   import type { OutputModeModule } from '../types';
   
   export const myModule: OutputModeModule = {
     id: 'my-module',
     name: '我的模块',
     prompt: MY_MODULE_PROMPT,
     mcpTool: createMyModuleMcpTool(),
     validate: validateMyModule,
     process: processMyModule,
     buildScoringContext: buildMyModuleScoringContext,
   };
   
   export function register(registry: OutputModeRegistry): void {
     registry.register(myModule);
   }
   ```

4. **注册到注册表**
   ```typescript
   // src/server/output-modes/registry.ts
   import('./my-module').then(m => m.register(outputModeRegistry));
   ```

5. **创建客户端渲染器**
   ```typescript
   // src/features/output-modes/my-module/renderer.tsx
   export function MyModuleRenderer({ data }: RendererProps<MyModuleData>) {
     return <MyModuleView data={data} />;
   }
   ```

6. **注册渲染器**
   ```typescript
   // src/features/output-modes/registry.tsx
   import { MyModuleRenderer } from './my-module/renderer';
   
   const RENDERER_MAP = {
     'my-module': MyModuleRenderer,
     // ...
   };
   ```

### 特点

- **零侵入**：不修改任何框架文件
- **完全自治**：模块内部定义所有内容
- **服务端优先**：业务逻辑集中在服务端
- **客户端轻量**：渲染器只有 UI 代码

---

## 九、风险与缓解

| 风险 | 缓解措施 |
|------|----------|
| 数据库中旧格式报告不兼容 | 保留 `processedData` 类型兼容性，渲染器做版本判断 |
| MCP 工具名称冲突 | 工具名统一使用 `submit_report`，但 Schema 由模块定义 |
| 动态 import 失败 | 服务端使用显式导入列表，确保构建时静态分析 |

---

## 十、验收标准

1. ✅ 新增模块无需修改框架代码
2. ✅ 服务端包含所有业务逻辑
3. ✅ 客户端渲染器无验证/评分逻辑
4. ✅ MCP 工具 Schema 由模块定义
5. ✅ 现有报告功能正常运行
