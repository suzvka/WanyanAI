import type { ComponentType } from 'react';
import type { RendererProps } from './renderer';
import type { McpToolDefinition } from '@/mcp/types';
import { LiteraryReviewRenderer } from './literary-review/renderer';
import { GaokaoEssayRenderer } from './gaokao-essay/renderer';
import { getLiteraryReviewMcpTools } from './literary-review/mcp-tools';
import { getGaokaoEssayMcpTools } from './gaokao-essay/mcp-tools';

export type OutputModeRendererComponent = ComponentType<RendererProps<unknown>>;

export type OutputModeManifestItem = {
  id: string;
  renderer: OutputModeRendererComponent;
  getMcpTools?: () => McpToolDefinition[];
};

export const OUTPUT_MODE_MANIFEST: OutputModeManifestItem[] = [
  {
    id: 'literary-review',
    renderer: LiteraryReviewRenderer as OutputModeRendererComponent,
    getMcpTools: getLiteraryReviewMcpTools,
  },
  {
    id: 'gaokao-essay',
    renderer: GaokaoEssayRenderer as OutputModeRendererComponent,
    getMcpTools: getGaokaoEssayMcpTools,
  },
];

export function getOutputModeManifest(): OutputModeManifestItem[] {
  return OUTPUT_MODE_MANIFEST;
}

/**
 * 获取输出模式的 MCP 工具定义
 *
 * 客户端使用此函数直接获取工具定义，无需通过 Server Actions
 */
export function getOutputModeMcpTools(outputModeId: string): McpToolDefinition[] {
  const manifestItem = OUTPUT_MODE_MANIFEST.find(item => item.id === outputModeId);
  return manifestItem?.getMcpTools?.() ?? [];
}
