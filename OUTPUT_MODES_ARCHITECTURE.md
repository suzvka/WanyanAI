# 输出模式架构重构

## 概述

将输出模式系统重构为严格的客户端/服务端分离架构。

## 架构设计

### 服务端 (`src/server/output-modes.ts`)

服务端负责所有业务逻辑：
- **提示词管理**：存储和管理输出模式的格式规定
- **数据验证**：验证模型返回的数据格式
- **评分上下文**：根据分析控制选项构建评分乘数

### 客户端 (`src/features/output-modes/`)

客户端只负责渲染：
- **渲染器组件**：每个输出模式的渲染器
- **渲染器映射表**：简单的 ID 到组件的映射

### Server Actions (`src/app/actions/output-modes.ts`)

桥接客户端和服务端：
- `serverValidateOutputModeData`：验证数据
- `serverBuildOutputModeScoringContext`：构建评分上下文
- `serverGetOutputModeIds`：获取可用模式列表

## 关键文件

| 文件 | 职责 |
|------|------|
| `src/server/output-modes.ts` | 服务端输出模式注册表（提示词、验证、评分） |
| `src/features/output-modes/index.ts` | 客户端渲染器映射表 |
| `src/features/output-modes/renderer.ts` | 渲染器通用 Props 类型定义 |
| `src/app/actions/output-modes.ts` | 服务端功能的服务器动作 |

## 使用示例

### 服务端获取提示词

```typescript
import { getServerOutputModePrompt } from '@/server/output-modes';

const prompt = getServerOutputModePrompt('literary-review');
```

### 客户端获取渲染器

```typescript
import { getOutputModeRenderer } from '@/features/output-modes';

const Renderer = getOutputModeRenderer('literary-review');
```

### 客户端调用服务端验证

```typescript
import { serverValidateOutputModeData } from '@/app/actions/output-modes';

const validation = await serverValidateOutputModeData('literary-review', data);
```

## 优势

1. **清晰的职责分离**：服务端负责逻辑，客户端负责渲染
2. **类型安全**：通过 TypeScript 确保类型正确性
3. **避免代码泄漏**：`'server-only'` 确保服务端代码不会打包到客户端
4. **易于扩展**：新增输出模式只需在服务端注册，客户端添加渲染器
