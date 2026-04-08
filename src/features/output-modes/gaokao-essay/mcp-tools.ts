/**
 * 高考作文评分 - MCP 工具定义
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

import { z } from 'zod';
import { defineMcpTool, type McpToolDefinition } from '@/mcp/types';
import { abortWorkflowTool } from '@/mcp/tools/abortWorkflow';
import { gaokaoSubscoreIds, gaokaoSubscoreDefinitions } from './subscores';

const collectSummaryInputSchema = z.object({
  title: z.string().optional(),
  overview: z.string().default(''),
});

const collectSubscoreInputSchema = z.object({
  id: z.string(),
  grade: z.enum(['S', 'A', 'B', 'C', 'D']),
  rationale: z.string(),
});

const collectConclusionInputSchema = z.object({
  rationale: z.string(),
});

const collectSectionInputSchema = z.object({
  sectionTitle: z.string(),
  paragraphTitle: z.string(),
  body: z.string(),
});

const finalizeReportInputSchema = z.object({
  confirm: z.boolean(),
});

// ============================================================================
// collect_summary - 收集报告摘要
// ============================================================================

export const collectSummaryMcpTool = defineMcpTool<typeof collectSummaryInputSchema>({
  name: 'collect_summary',
  description: '收集报告摘要信息，包括作文标题或试卷标题、整体观感',
  parameters: [
    {
      name: 'title',
      description: '本次报告的标题',
      required: false,
      type: 'string',
    },
    {
      name: 'overview',
      description: '整体观感与核心评价，先概括整体观感，再做核心评价',
      required: true,
      type: 'string',
    },
  ],
  inputSchema: collectSummaryInputSchema,
  handler: (params) => ({
    ok: true,
    data: {
      title: params.title ?? '',
      overview: params.overview ?? '',
    },
    message: '摘要已收集',
  }),
});

// ============================================================================
// collect_subscore - 收集单个子维度评分
// 注意：分数由 grade 计算得出，无需模型提供 score
// ============================================================================

export const collectSubscoreMcpTool = defineMcpTool<typeof collectSubscoreInputSchema>({
  name: 'collect_subscore',
  description: `收集单个子维度评分。必须依次收集全部 6 个子维度：${gaokaoSubscoreIds.join(', ')}`,
  parameters: [
    {
      name: 'id',
      description: `子维度 ID，必须是以下之一：${gaokaoSubscoreIds.join('、')}`,
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
  inputSchema: collectSubscoreInputSchema,
  handler: (params) => {
    const id = params.id;
    const definition = gaokaoSubscoreDefinitions.find((d) => d.id === id);

    return {
      ok: true,
      data: {
        id,
        label: definition?.label || id,
        grade: params.grade,
        rationale: params.rationale,
      },
      message: `子维度 ${id} 已收集`,
    };
  },
});

// ============================================================================
// collect_conclusion - 收集报告结论
// ============================================================================

export const collectConclusionMcpTool = defineMcpTool<typeof collectConclusionInputSchema>({
  name: 'collect_conclusion',
  description: '收集报告结论，综合评价与提升建议（考虑到学生的接受能力）',
  parameters: [
    {
      name: 'rationale',
      description: '综合评价与提升建议，在开始正式点评前用这一段铺垫',
      required: true,
      type: 'string',
    },
  ],
  inputSchema: collectConclusionInputSchema,
  handler: (params) => ({
    ok: true,
    data: {
      rationale: params.rationale,
    },
    message: '结论已收集',
  }),
});

// ============================================================================
// collect_section - 收集单个段落
// ============================================================================

export const collectSectionMcpTool = defineMcpTool<typeof collectSectionInputSchema>({
  name: 'collect_section',
  description: '收集单个段落内容。段落按章节标题分组显示。',
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
  inputSchema: collectSectionInputSchema,
  handler: (params) => ({
    ok: true,
    data: {
      sectionTitle: params.sectionTitle,
      paragraphTitle: params.paragraphTitle,
      body: params.body,
    },
    message: `段落 ${params.paragraphTitle} 已收集`,
  }),
});

// ============================================================================
// finalize_report - 确认报告完成
// ============================================================================

export const finalizeReportMcpTool = defineMcpTool<typeof finalizeReportInputSchema>({
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
  inputSchema: finalizeReportInputSchema,
  handler: () => ({
    ok: true,
    data: { finalized: true },
    message: '报告已完成',
    terminate: true, // 终止工作流
  }),
});

// ============================================================================
// 导出所有工具
// ============================================================================

/**
 * 获取所有高考作文评分工具定义
 *
 * 包含：
 * - 业务工具：collect_summary, collect_subscore, collect_conclusion, collect_section, finalize_report
 * - 框架工具：abort_workflow（从框架层导入）
 */
export function getGaokaoEssayMcpTools(): McpToolDefinition[] {
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
