import { createAppError } from '@/types/errors';
import type { McpToolDefinition } from './types';

const registry = new Map<string, McpToolDefinition>();

export function registerMcpTool(tool: McpToolDefinition): void {
  const normalizedName = tool.name.trim();

  if (!normalizedName) {
    throw createAppError({
      code: 'config_invalid',
      message: 'MCP ƲΪա',
    });
  }

  if (registry.has(normalizedName)) {
    throw createAppError({
      code: 'config_invalid',
      message: `MCP ע᣺${normalizedName}`,
    });
  }

  registry.set(normalizedName, {
    ...tool,
    name: normalizedName,
    description: tool.description.trim(),
  });
}

export function registerMcpTools(tools: McpToolDefinition[]): void {
  tools.forEach(registerMcpTool);
}

export function getMcpTool(name: string): McpToolDefinition | undefined {
  return registry.get(name);
}

export function listMcpTools(): McpToolDefinition[] {
  return Array.from(registry.values());
}

export function clearMcpTools(): void {
  registry.clear();
}