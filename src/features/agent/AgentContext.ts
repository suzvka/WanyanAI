/**
 * Agent 上下文管理器
 *
 * 管理跨步骤的对话消息历史和中间步骤结果。
 * 根据 AgentStep.inputSource 策略拼接消息。
 */

import type { ModelAnalysisMessage } from '@/types/analysis';
import type { EvaluationInput } from '@/types/report';
import type { AgentStep } from '@/types/module';
import { renderTextBlockMetadataForModel, renderTextBlocksForModel } from '@/lib/textBlocks';

/**
 * 客户端调试日志
 */
const log = (message: string, data?: unknown) => {
  console.log(`[AgentContext] ${message}`, data !== undefined ? data : '');
};

export class AgentContext {
  /** 累积的消息历史（system + user + assistant 交替） */
  private messages: ModelAnalysisMessage[] = [];

  /** 每步产出的上下文文本（按 outputModeId 索引） */
  private stepResults: Map<string, string> = new Map();

  /** 上一步的 outputModeId */
  private lastStepId: string | null = null;

  /** 当前迭代次数 */
  iterationCount = 0;

  /**
   * 添加初始用户输入
   */
  addUserInput(input: EvaluationInput, systemPrompt: string): void {
    const userParts: string[] = [];
    userParts.push(renderTextBlockMetadataForModel(input));
    userParts.push(renderTextBlocksForModel(input));

    this.messages = [
      {
        role: 'system',
        content: systemPrompt,
      },
      {
        role: 'user',
        content: userParts.join('\n\n'),
      },
    ];

    log('Initial user input added', {
      userContentLength: this.messages[1]?.content.length,
    });
  }

  /**
   * 记录步骤结果
   */
  addStepResult(stepId: string, contextText: string): void {
    this.stepResults.set(stepId, contextText);
    this.lastStepId = stepId;
    this.iterationCount += 1;
    log('Step result added', { stepId, textLength: contextText.length, iteration: this.iterationCount });
  }

  /**
   * 根据输入来源策略构建当前步骤的消息列表
   */
  buildMessagesForStep(
    step: AgentStep,
    systemPrompt: string,
    instructionText: string,
    mcpToolText: string,
  ): ModelAnalysisMessage[] {
    const messages: ModelAnalysisMessage[] = [
      {
        role: 'system',
        content: systemPrompt,
      },
    ];

    // 构建用户消息：MCP 工具文本 + 指令 + 上下文内容
    const userParts: string[] = [];

    if (mcpToolText?.trim()) {
      userParts.push(mcpToolText.trim());
    }

    if (instructionText?.trim()) {
      userParts.push(instructionText.trim());
    }

    // 根据 inputSource 拼接上下文
    const contextContent = this.buildContextContent(step.inputSource);
    if (contextContent) {
      userParts.push(contextContent);
    }

    messages.push({
      role: 'user',
      content: userParts.join('\n\n'),
    });

    log('Messages built for step', {
      stepId: step.outputMode,
      inputSource: step.inputSource,
      userContentLength: messages[1]?.content.length,
    });

    return messages;
  }

  /**
   * 根据 inputSource 策略构建上下文内容
   */
  private buildContextContent(inputSource: AgentStep['inputSource']): string {
    switch (inputSource) {
      case 'user':
        // 仅使用初始用户输入（已在 addUserInput 中添加）
        return '';

      case 'previous': {
        // 仅使用上一步的输出
        if (!this.lastStepId) return '';
        const prevText = this.stepResults.get(this.lastStepId);
        if (!prevText) return '';
        return `\n\n## 上一步分析结果\n\n${prevText}`;
      }

      case 'accumulated': {
        // 累积所有历史步骤的输出
        if (this.stepResults.size === 0) return '';
        const parts: string[] = [];
        parts.push('\n\n## 历史分析结果');
        let index = 1;
        for (const [stepId, text] of this.stepResults) {
          parts.push(`\n### 步骤 ${index}: ${stepId}\n\n${text}`);
          index += 1;
        }
        return parts.join('\n');
      }

      default:
        return '';
    }
  }

  /**
   * 获取所有已完成的步骤 ID
   */
  getCompletedStepIds(): string[] {
    return Array.from(this.stepResults.keys());
  }

  /**
   * 获取上一步 ID
   */
  getLastStepId(): string | null {
    return this.lastStepId;
  }

  /**
   * 重置上下文
   */
  reset(): void {
    this.messages = [];
    this.stepResults.clear();
    this.lastStepId = null;
    this.iterationCount = 0;
  }
}
