/**
 * Agent 编排层
 *
 * 使用 LangChain 原语（ChatOpenAI.bindTools + DynamicStructuredTool）
 * 构建轻量 Agent 执行循环，替代手写 while 循环。
 *
 * 与完整 AgentExecutor 的区别：
 * - 不依赖 langchain 顶级包，只使用 @langchain/core + @langchain/openai
 * - 保留对进度回调、终端步骤检测的完全控制
 * - 使用 BaseMessage 类型系统管理消息历史
 * - 可选上下文裁剪防止 token 溢出
 */

import {
  SystemMessage,
  HumanMessage,
  AIMessage,
  ToolMessage,
  type BaseMessage,
  type ToolCall,
} from '@langchain/core/messages';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { ChatOpenAI } from '@langchain/openai';
import type { AgentPipeline } from '@/types/module';
import type {
  AgentProgressSnapshot,
} from '../types';
import { buildAgentSystemPromptText } from './prompts';
import { createContextTrimmer } from './memory';

// ---- 类型 ----

/**
 * Agent 循环执行结果
 */
export interface AgentLoopResult {
  /** 是否成功 */
  success: boolean;
  /** 终端报告 ID（仅成功时有值） */
  terminalToolCalled: boolean;
  /** 错误信息 */
  error?: string;
}

/**
 * Agent 循环配置
 */
export interface AgentLoopConfig {
  /** Agent LLM 实例 */
  chatModel: ChatOpenAI;
  /** LangChain Tool 数组 */
  tools: DynamicStructuredTool[];
  /** 终端工具名称 */
  terminalToolName: string;
  /** 管线配置 */
  pipeline: AgentPipeline;
  /** 输出模式元数据 */
  descriptions: Map<string, { name: string; description: string }>;
  /** 用户输入文本 */
  userPrompt: string;
  /** 进度回调 */
  onProgress: (snapshot: AgentProgressSnapshot) => void;
  /** 上下文窗口最大 token（默认 8000，0 表示不限制） */
  maxContextTokens?: number;
}

// ---- 执行循环 ----

const log = (message: string, data?: unknown) => {
  console.log(`[AgentLoop] ${message}`, data !== undefined ? data : '');
};

/**
 * 运行 Agent 编排循环
 *
 * 使用 LangChain ChatOpenAI.bindTools() 进行工具调用，
 * 自动管理消息历史和上下文窗口。
 */
export async function runAgentLoop(config: AgentLoopConfig): Promise<AgentLoopResult> {
  const {
    chatModel,
    tools,
    terminalToolName,
    pipeline,
    descriptions,
    userPrompt,
    onProgress,
    maxContextTokens = 8000,
  } = config;

  const systemPrompt = buildAgentSystemPromptText(pipeline, descriptions);

  // 构建 Tool Map（tool name → DynamicStructuredTool）
  const toolMap = new Map<string, DynamicStructuredTool>();
  for (const tool of tools) {
    toolMap.set(tool.name, tool);
  }

  // 绑定 tools 到聊天模型
  const modelWithTools = chatModel.bindTools(
    tools.map((t) => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.schema as Record<string, unknown>,
      },
    })),
  );

  // 上下文裁剪器（可选）
  const trimContext = maxContextTokens > 0
    ? createContextTrimmer({ chatModel, maxTokens: maxContextTokens })
    : null;

  // 消息历史
  let messages: BaseMessage[] = [
    new SystemMessage(systemPrompt),
    new HumanMessage(userPrompt),
  ];

  const maxSteps = pipeline.maxIterations + 1; // +1 for terminal step
  let iteration = 0;
  let terminalCalled = false;

  try {
    while (iteration < maxSteps + 2) {
      log(`Iteration ${iteration}`);

      // 裁剪上下文（防止 token 溢出）
      if (trimContext && messages.length > 4) {
        const trimmed = await trimContext(messages);
        if (trimmed.length < messages.length) {
          log(`Context trimmed: ${messages.length} → ${trimmed.length} messages`);
        }
        messages = trimmed;
      }

      // 代理 LLM 调用
      const response = await modelWithTools.invoke(messages);

      // 添加 assistant 消息到历史
      const assistantMsg = new AIMessage({
        content: typeof response.content === 'string'
          ? response.content
          : JSON.stringify(response.content),
        tool_calls: response.tool_calls?.length
          ? response.tool_calls.map(mapToolCall)
          : undefined,
      });
      messages.push(assistantMsg);

      // 检查 tool calls
      if (response.tool_calls && response.tool_calls.length > 0) {
        // 执行被调用的工具
        for (const tc of response.tool_calls) {
          const tool = toolMap.get(tc.name);
          const isTerminal = tc.name === terminalToolName;

          // 进度回调
          onProgress({
            stepIndex: isTerminal ? pipeline.steps.length : iteration,
            totalSteps: pipeline.steps.length,
            stepLabel: tool?.description ?? tc.name,
            phase: isTerminal ? 'agent-final' : 'agent-step',
          });

          log(`Executing ${isTerminal ? 'TERMINAL' : 'INTERMEDIATE'} tool: ${tc.name}`);

          let toolResult: string;
          if (tool) {
            toolResult = await tool.invoke(tc.args);
          } else {
            toolResult = `ERROR: Unknown tool "${tc.name}"`;
          }

          // 添加 tool 消息到历史
          messages.push(new ToolMessage({
            content: toolResult,
            tool_call_id: tc.id!,
          }));

          // 检测终端步骤
          if (isTerminal) {
            terminalCalled = true;
          }
        }
      } else {
        // 无 tool calls，Agent 结束
        log('Agent finished without tool calls');
        break;
      }

      iteration += 1;

      // 终端步骤被调用后立即结束
      if (terminalCalled) {
        log('Terminal step executed, ending loop');
        break;
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Agent loop failed';
    log('Agent loop error', { error: errorMessage });
    return { success: false, terminalToolCalled: false, error: errorMessage };
  }

  return {
    success: true,
    terminalToolCalled: terminalCalled,
  };
}

/**
 * 将 LangChain ToolCall 转换为标准格式
 */
function mapToolCall(tc: ToolCall): {
  id: string;
  name: string;
  args: Record<string, unknown>;
  type: 'tool_call';
} {
  return {
    id: tc.id ?? `call_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    name: tc.name,
    args: tc.args as Record<string, unknown>,
    type: 'tool_call',
  };
}
