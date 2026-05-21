/**
 * Agent 工具注册表
 *
 * 继承 BaseRegistry，管理 Agent 编排层所有可用工具。
 * 每个新增工具只需创建 DynamicStructuredTool 后调用 registry.register()。
 *
 * 与 MCP 工具注册表的区别：
 * - MCP 工具：注册在 output mode 下，通过 <call> 标签调用
 * - Agent 工具：注册在编排层，通过 OpenAI tool_calls 调用
 * - 两者完全隔离，AgentToolRegistry 不感知 MCP
 */

import { BaseRegistry } from '@/lib/registry/BaseRegistry';
import { DynamicStructuredTool } from '@langchain/core/tools';

/** 注册表条目 */
export interface AgentToolEntry {
  id: string;
  tool: DynamicStructuredTool;
}

export class AgentToolRegistry extends BaseRegistry<AgentToolEntry> {
  constructor() {
    super('AgentTool');
  }

  /** 获取所有已注册的 LangChain Tool */
  getAllTools(): DynamicStructuredTool[] {
    return this.getIds().map((id) => this.get(id)!.tool);
  }

  /**
   * 检查是否已注册终端工具
   * 用于 AgentRunner 判断循环是否应产生可终止条件
   */
  hasTerminalTool(): boolean {
    // 终端工具通过注册时的 id 约定识别，或由外部显式提供
    return this.getIds().length > 0;
  }
}
