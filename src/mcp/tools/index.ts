/**
 * MCP 工具定义导出
 *
 * 架构说明：
 * - abortWorkflowTool: 框架层工具，所有模块应导入使用
 * 
 * 迁移指南：
 * - 新模块应自行定义工具，并导入 abortWorkflowTool
 * - 工具定义通过输出模式模块的 mcpToolDefinitions 字段提供
 */

import { registerMcpTools } from '@/mcp/registry';
import { abortWorkflowTool } from './abortWorkflow';

let builtInToolsRegistered = false;

/**
 * 注册内置 MCP 工具
 *
 * @deprecated 工具定义应由各输出模式模块自行提供
 * 
 * 新架构：
 * - 输出模式模块定义自己的工具（包含 abort_workflow）
 * - 工具定义通过 mcpToolDefinitions 字段传递给 StreamingMCPAdapter
 */
export function ensureBuiltInMcpToolsRegistered(): void {
  if (builtInToolsRegistered) {
    return;
  }

  // 仅注册 abort_workflow 作为兜底
  registerMcpTools([abortWorkflowTool]);

  builtInToolsRegistered = true;
}

// 导出框架层工具
export { abortWorkflowTool } from './abortWorkflow';


