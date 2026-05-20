import type { McpToolDefinition } from '@/mcp/types';
import { getLiteraryReviewMcpTools } from './literary-review/mcp-tools';
import { getGaokaoEssayMcpTools } from './gaokao-essay/mcp-tools';

export type OutputModeManifestItem = {
  id: string;
  /** 是否为终端模式（有渲染器可呈递给用户） */
  hasRenderer: boolean;
  getMcpTools?: () => McpToolDefinition[];
};

export const OUTPUT_MODE_MANIFEST: OutputModeManifestItem[] = [
  {
    id: 'literary-review',
    hasRenderer: true,
    getMcpTools: getLiteraryReviewMcpTools,
  },
  {
    id: 'gaokao-essay',
    hasRenderer: true,
    getMcpTools: getGaokaoEssayMcpTools,
  },
  { id: 'text-segmentation', hasRenderer: false },
  { id: 'checklist', hasRenderer: false },
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
