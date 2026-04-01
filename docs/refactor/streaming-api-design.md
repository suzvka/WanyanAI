# API 访问模块流式重构方案

## 一、设计目标

1. **干净的事件系统**：工作流阶段事件 + 流式响应事件，完全独立，不存在则不触发
2. **透明流式化**：对外暴露完整响应接口，内部流式接收并整流
3. **简洁的错误处理**：移除复杂的重试和 JSON 修复逻辑，失败直接抛出错误

---

## 二、事件类型定义

```typescript
// src/types/streamEvents.ts

// ============ 工作流阶段事件 ============

/** 工作流阶段类型 */
export type WorkflowStage = 
  | 'prepare'         // 准备阶段：整理输入数据
  | 'fetch-template'  // 获取提示词模板
  | 'build-prompt'    // 构建最终提示词
  | 'request-model'   // 请求模型生成
  | 'parse-response'  // 解析模型响应
  | 'normalize'       // 标准化报告
  | 'complete';       // 完成

/** 工作流阶段事件 */
export type WorkflowStageEvent = {
  type: 'workflow-stage';
  stage: WorkflowStage;
  timestamp: number;
  message?: string;
  data?: Record<string, unknown>;
};

// ============ 流式响应事件 ============

/** 流式响应事件类型 */
export type StreamEventType = 
  | 'first-token'    // 收到第一个有效 token
  | 'think-start'    // 检测到思考块开始
  | 'content-start'; // 检测到正文开始

/** 流式响应事件 */
export type StreamResponseEvent = {
  type: StreamEventType;
  timestamp: number;
  data?: Record<string, unknown>;
};

// ============ 统一事件类型 ============

/** 分析事件（联合类型） */
export type AnalysisEvent = WorkflowStageEvent | StreamResponseEvent;

/** 分析事件订阅配置 */
export interface AnalysisEventHandlers {
  /** 工作流阶段变更时触发 */
  onWorkflowStage?: (event: AnalysisEvent) => void;
  /** 第一个 token 到达时触发 */
  onFirstToken?: (event: AnalysisEvent) => void;
  /** 检测到思考块开始时触发 */
  onThinkStart?: (event: AnalysisEvent) => void;
  /** 检测到正文开始时触发 */
  onContentStart?: (event: AnalysisEvent) => void;
}
```

---

## 三、核心架构

### 3.1 模块分层

```
┌─────────────────────────────────────────────────────────────────┐
│  BasicRemoteAnalysisService (门面层)                            │
│  - generateReport() 返回完整响应                                 │
│  - 发射工作流阶段事件                                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  StreamingClient (流式客户端)                                    │
│  - 处理 HTTP 流式请求                                           │
│  - 解析 SSE 数据格式                                            │
│  - 发射流式响应事件                                              │
│  - 累积完整响应                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 事件流

```
generateReport() 调用
      │
      ├── emit('workflow-stage', 'prepare')
      ├── emit('workflow-stage', 'fetch-template')
      ├── emit('workflow-stage', 'build-prompt')
      ├── emit('workflow-stage', 'request-model')
      │         │
      │         ▼ StreamingClient
      │         ├── emit('first-token')
      │         ├── emit('think-start')  [可选]
      │         └── emit('content-start')
      │
      ├── emit('workflow-stage', 'parse-response')
      ├── emit('workflow-stage', 'normalize')
      ├── emit('workflow-stage', 'complete')
      │
      ▼
  return AnalysisReport
```

---

## 四、实现文件

### 文件清单

| 文件 | 说明 |
|------|------|
| `src/types/streamEvents.ts` | 事件类型定义 |
| `src/services/analysis/streamingClient.ts` | 流式客户端实现 |
| `src/services/analysis/types.ts` | 扩展 GenerateReportOptions |
| `src/services/analysis/basicRemoteAnalysisService.ts` | 核心服务实现 |

### 已移除的逻辑

| 移除项 | 说明 |
|--------|------|
| 重试逻辑 | 移除 `retryTruncatedAnalysis` 方法和相关调用 |
| JSON 修复逻辑 | 移除 `requestJsonRepair` 方法和相关调用 |
| 截断检测 | 移除 `detectTruncation`、`inspectJsonClosure` 等方法 |
| 相关常量 | 移除 `minimumRetryMaxTokens`、`maximumRepairMaxTokens` 等 |

---

## 五、调用方式

### 5.1 基本调用（向后兼容）

```typescript
const result = await analysisService.generateReport({
  input,
  modelConfig,
  controlLabels,
  instructionText,
});
```

### 5.2 订阅所有事件

```typescript
const result = await analysisService.generateReport({
  input,
  modelConfig,
  controlLabels,
  instructionText,
  events: {
    onWorkflowStage: (event) => {
      console.log(`阶段: ${event.stage}`, event.message);
      // 更新进度条状态
    },
    onFirstToken: () => {
      console.log('模型开始响应');
    },
    onThinkStart: () => {
      console.log('模型正在思考...');
    },
    onContentStart: () => {
      console.log('正文开始输出');
    },
  },
});
```

### 5.3 仅订阅工作流阶段

```typescript
const result = await analysisService.generateReport({
  input,
  modelConfig,
  controlLabels,
  instructionText,
  events: {
    onWorkflowStage: (event) => {
      updateProgressBar(event.stage, event.message);
    },
  },
});
```

---

## 六、工作流阶段说明

| 阶段 | 说明 | 触发时机 |
|------|------|---------|
| `prepare` | 整理输入数据 | 方法开始时 |
| `fetch-template` | 获取提示词模板 | 调用 templateService 前 |
| `build-prompt` | 构建最终提示词 | 开始构建消息前 |
| `request-model` | 请求模型生成 | 发起流式请求前 |
| `parse-response` | 解析模型响应 | 开始解析 JSON 前 |
| `normalize` | 标准化报告 | 开始标准化前 |
| `complete` | 完成 | 方法返回前 |

---

## 七、错误处理

### 简化策略

移除了复杂的重试和修复逻辑后，错误处理变得简单直接：

```typescript
// 解析失败直接抛出错误
if (!parsedPayload) {
    throw createAppError({
        code: 'provider_response_invalid',
        message: '模型返回的内容无法解析为有效的 JSON 格式，请重试。',
        retryable: true,
    });
}
```

### 错误类型

| 错误码 | 说明 | 重试性 |
|--------|------|--------|
| `config_invalid` | 配置无效 | 不可重试 |
| `network_error` | 网络错误 | 可重试 |
| `provider_request_failed` | 模型服务请求失败 | 视状态码 |
| `provider_response_invalid` | 响应无效/解析失败 | 可重试 |

---

## 八、思考块检测模式

### 默认支持的格式

| 开始标记 | 结束标记 |
|---------|---------|
| `<tool_call>done<arg_key>commit_msg</arg_key><arg_value>refactor: 重构事件系统并移除重试/修复逻辑

事件系统重构：
- 扩展事件类型，新增工作流阶段事件（prepare/fetch-template/build-prompt/request-model/parse-response/normalize/complete）
- 统一 AnalysisEvent 类型，支持工作流阶段事件和流式响应事件
- 重命名参数：streamEvents → events，使用 AnalysisEventHandlers

移除逻辑：
- 移除 retryTruncatedAnalysis 重试逻辑
- 移除 requestJsonRepair JSON 修复逻辑
- 移除 detectTruncation、inspectJsonClosure 等截断检测方法
- 移除相关常量（minimumRetryMaxTokens、maximumRepairMaxTokens 等）

简化错误处理：
- 解析失败直接抛出 provider_response_invalid 错误
- 用户可选择重试整个分析流程