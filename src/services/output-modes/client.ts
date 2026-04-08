import { requestJson } from '@/lib/client-request';
import type { ReportScoringContext } from '@/types/analysis';
import type { PageModuleConfig } from '@/types/module';
import type { McpToolDefinition } from '@/mcp/types';

type OutputModeToolDescriptor = Pick<McpToolDefinition, 'name' | 'description' | 'parameters'>;

type OutputModeToolsResponse = {
  success?: boolean;
  data?: {
    tools?: OutputModeToolDescriptor[];
  };
};

type AssembleOutputModeResponse = {
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
};

type ValidateOutputModeResponse = {
  success: boolean;
  data?: unknown;
  errors?: Array<{ path: string; message: string }>;
};

type BuildOutputModeScoringContextParams = {
  moduleConfig: PageModuleConfig;
  controlSelections: Record<string, string>;
};

type BuildOutputModeScoringContextResponse = {
  success?: boolean;
  data?: ReportScoringContext;
};

function createClientToolDefinition(tool: OutputModeToolDescriptor): McpToolDefinition {
  return {
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
    inputSchema: null as never,
    handler: (args: unknown) => {
      const params = args as Record<string, unknown>;
      if (tool.name === 'abort_workflow') {
        return {
          ok: true,
          data: params,
          message: '工作流已中止',
          terminate: true,
        };
      }

      if (tool.name === 'finalize_report') {
        return {
          ok: true,
          data: { finalized: true },
          message: '报告已完成',
          terminate: true,
        };
      }

      return {
        ok: true,
        data: params,
        message: '数据已收集',
      };
    },
  };
}

async function postOutputModeJson<TResponse>(
  path: string,
  body: Record<string, unknown>,
  errorMessage: string,
  networkErrorMessage: string,
): Promise<TResponse> {
  return requestJson<TResponse>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    errorMessage,
    networkErrorMessage,
  });
}

export async function getOutputModeToolDefinitions(outputModeId: string): Promise<McpToolDefinition[]> {
  const result = await requestJson<OutputModeToolsResponse>(`/api/output-modes/tools?outputModeId=${outputModeId}`, {
    errorMessage: '获取输出模式工具定义失败',
    networkErrorMessage: '获取输出模式工具定义失败，请检查网络后重试',
  });

  if (!result.success || !result.data?.tools) {
    return [];
  }

  return result.data.tools.map(createClientToolDefinition);
}

export async function assembleOutputModeData(
  outputModeId: string,
  collectedData: Record<string, unknown[]>,
): Promise<AssembleOutputModeResponse> {
  return postOutputModeJson<AssembleOutputModeResponse>(
    '/api/output-modes/assemble',
    { outputModeId, collectedData },
    '拼装输出模式数据失败',
    '拼装输出模式数据失败，请检查网络后重试',
  );
}

export async function validateOutputModeData(
  outputModeId: string,
  data: unknown,
): Promise<ValidateOutputModeResponse> {
  return postOutputModeJson<ValidateOutputModeResponse>(
    '/api/output-modes/validate',
    { outputModeId, data },
    '校验输出模式数据失败',
    '校验输出模式数据失败，请检查网络后重试',
  );
}

export async function buildOutputModeScoringContext(
  outputModeId: string,
  params: BuildOutputModeScoringContextParams,
): Promise<ReportScoringContext> {
  const result = await postOutputModeJson<BuildOutputModeScoringContextResponse>(
    '/api/output-modes/scoring-context',
    { outputModeId, params },
    '构建评分上下文失败',
    '构建评分上下文失败，请检查网络后重试',
  );

  if (result.success) {
    return result.data as ReportScoringContext;
  }

  return { multipliers: {}, defaultMultiplier: 1 };
}
