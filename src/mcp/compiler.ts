/**
 * 工具提示词编译器（自研标签协议，MCP 风格）
 *
 * 将工具定义编译为注入提示词的 <call> 标签调用规则。
 * 注：此处为自研流式工具调用协议，非标准 MCP（Model Context Protocol），
 * 命名沿用 MCP 字样仅为形态类比（见 streamingClient.ts 头部声明）。
 */
import type { McpCompiledPrompt, McpPromptToolDescriptor, McpToolDefinition } from './types';

function renderParameter(parameter: McpPromptToolDescriptor['parameters'][number]): string {
  const requiredText = parameter.required ? '' : '（可选）';
  return `- ${parameter.name} (${parameter.type}${requiredText}): ${parameter.description}`;
}

function renderTool(tool: McpPromptToolDescriptor): string {
  const parameterLines = tool.parameters.length > 0
    ? tool.parameters.map(renderParameter).join('\n')
    : '- 无参数';

  return [
    `工具名称: ${tool.name}`,
    `工具描述: ${tool.description}`,
    '工具参数:',
    parameterLines,
  ].join('\n');
}

export function compileMcpPrompt(tools: McpToolDefinition[]): McpCompiledPrompt {
  const descriptors: McpPromptToolDescriptor[] = tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
  }));

  if (descriptors.length === 0) {
    return {
      toolPromptText: '',
      tools: descriptors,
    };
  }

  const toolPromptText = [
    '# 工具调用规则',
    '',
    '**重要提醒**：你必须在单次响应中按顺序调用所有必需的工具，不要在调用第一个工具后停止！',
    '',
    '你可以调用以下工具来完成任务。调用工具时使用以下格式：',
    '',
    '```',
    '<call 工具名称>',
    '{ JSON 参数 }',
    '</call>',
    '```',
    '',
    '## 可用工具',
    '',
    ...descriptors.map(renderTool),
  ].join('\n');

  return {
    toolPromptText,
    tools: descriptors,
  };
}