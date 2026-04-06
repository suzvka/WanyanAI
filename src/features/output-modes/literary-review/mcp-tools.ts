/**
 * 文学作品评审 - MCP 工具定义
 *
 * 使用 McpToolDefinition 格式，不依赖 @obayd/agentic
 *
 * 架构说明：
 * - 业务工具由模块自行定义（collect_summary, collect_subscore 等）
 * - abort_workflow 从框架层导入，确保所有模块使用统一的中止工具
 * - handler 只负责收集数据，不做验证（验证在 assemble/process 阶段进行）
 * - 子维度分数由 grade 通过计算得出，无需模型提供 score
 *
 * 提示词微调位置：
 * - 修改 `description` 字段调整工具整体描述
 * - 修改 `parameters[].description` 字段调整参数说明
 */

import 'server-only';

import type { McpToolDefinition } from '@/mcp/types';
import { abortWorkflowTool } from '@/mcp/tools/abortWorkflow';
import { defaultSubscoreIds, defaultSubscoreDefinitions } from './subscores';

// ============================================================================
// collect_summary - 收集报告摘要
// ============================================================================

export const collectSummaryMcpTool: McpToolDefinition = {
  name: 'collect_summary',
  description: '收集报告摘要信息，包括标题和概述',
  parameters: [
    {
      name: 'title',
      description: '赏析标题，建议带副标题',
      required: false,
      type: 'string',
    },
    {
      name: 'overview',
      description: '整体观感与全局赏析',
      required: true,
      type: 'string',
    },
  ],
  inputSchema: null as any,
  handler: (params: any) => ({
    ok: true,
    data: {
      title: (params?.title as string) || '',
      overview: (params?.overview as string) || '',
    },
    message: '摘要已收集',
  }),
};

// ============================================================================
// collect_subscore - 收集单个子维度评分
// 注意：分数由 grade 计算得出，无需模型提供 score
// ============================================================================

export const collectSubscoreMcpTool: McpToolDefinition = {
  name: 'collect_subscore',
  description: `收集单个子维度评分。必须依次收集全部 6 个子维度：${defaultSubscoreIds.join(', ')}`,
  parameters: [
    {
      name: 'id',
      description: `子维度 ID，必须是以下之一：${defaultSubscoreIds.join('、')}`,
      required: true,
      type: 'string',
    },
    {
      name: 'grade',
      description: '评级，必须是以下之一：S, A, B, C, D',
      required: true,
      type: 'string',
    },
    {
      name: 'rationale',
      description: '1-2句, 评级需与理由匹配',
      required: true,
      type: 'string',
    },
  ],
  inputSchema: null as any,
  handler: (params: any) => {
    const id = params?.id as string;
    const definition = defaultSubscoreDefinitions.find((d) => d.id === id);
    
    return {
      ok: true,
      data: {
        id,
        label: definition?.label || id,
        grade: params?.grade as string,
        rationale: (params?.rationale as string) || '',
      },
      message: `子维度 ${id} 已收集`,
    };
  },
};

// ============================================================================
// collect_conclusion - 收集报告结论
// ============================================================================

export const collectConclusionMcpTool: McpToolDefinition = {
  name: 'collect_conclusion',
  description: '收集报告结论',
  parameters: [
    {
      name: 'rationale',
      description: '评价角度的总结',
      required: true,
      type: 'string',
    },
  ],
  inputSchema: null as any,
  handler: (params: any) => ({
    ok: true,
    data: {
      rationale: (params?.rationale as string) || '',
    },
    message: '结论已收集',
  }),
};

// ============================================================================
// collect_section - 收集单个段落
// ============================================================================

export const collectSectionMcpTool: McpToolDefinition = {
  name: 'collect_section',
  description: '收集单个段落内容，段落按章节标题分组显示。建议先用一个章节围绕亮点进行赏析(每个段落抓住一条主线)，然后点出优缺点，最后一个章节总结。',
  parameters: [
    {
      name: 'sectionTitle',
      description: '章节标题，同一章节标题下的段落会归为一组',
      required: true,
      type: 'string',
    },
    {
      name: 'paragraphTitle',
      description: '段落标题',
      required: true,
      type: 'string',
    },
    {
      name: 'body',
      description: '段落正文内容',
      required: true,
      type: 'string',
    },
  ],
  inputSchema: null as any,
  handler: (params: any) => ({
    ok: true,
    data: {
      sectionTitle: (params?.sectionTitle as string) || '',
      paragraphTitle: (params?.paragraphTitle as string) || '',
      body: (params?.body as string) || '',
    },
    message: `段落 ${params?.paragraphTitle} 已收集`,
  }),
};

// ============================================================================
// finalize_report - 确认报告完成
// ============================================================================

export const finalizeReportMcpTool: McpToolDefinition = {
  name: 'finalize_report',
  description: '确认报告完成，结束工作流',
  parameters: [
    {
      name: 'confirm',
      description: '输入 true 确认报告完成',
      required: true,
      type: 'boolean' as const,
    },
  ],
  inputSchema: null as any,
  handler: (_params: any) => ({
    ok: true,
    data: { finalized: true },
    message: '报告已完成',
    terminate: true, // 终止工作流
  }),
};

// ============================================================================
// 导出所有工具
// ============================================================================

/**
 * 获取所有文学作品评审工具定义
 *
 * 包含：
 * - 业务工具：collect_summary, collect_subscore, collect_conclusion, collect_section, finalize_report
 * - 框架工具：abort_workflow（从框架层导入）
 */
export function getLiteraryReviewMcpTools(): McpToolDefinition[] {
  return [
    // 业务工具
    collectSummaryMcpTool,
    collectSubscoreMcpTool,
    collectConclusionMcpTool,
    collectSectionMcpTool,
    finalizeReportMcpTool,
    // 框架工具（中止工作流）
    abortWorkflowTool,
  ];
}
