import { AnalysisRequest } from '@/types/analysis';
import { AnalysisReport } from '@/types/report';
import { MockAnalysisService } from './mockAnalysisService';
import { AnalysisService } from './types';

type RemoteIssue = {
  title: string;
  severity: AnalysisReport['keyIssues'][number]['severity'];
  description: string;
  suggestionDirection: string;
};

type RemoteAnalysisPayload = {
  overview: string;
  keyIssues: RemoteIssue[];
  finalRecommendation: AnalysisReport['conclusion']['finalRecommendation'];
  rationale: string;
};

type ChatCompletionsResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
};

const normalizeBaseUrl = (baseUrl: string) => baseUrl.trim().replace(/\/$/, '');

export class BasicRemoteAnalysisService implements AnalysisService {
  private readonly mockService = new MockAnalysisService();

  async generateReport(request: AnalysisRequest): Promise<AnalysisReport> {
    const baseReport = await this.mockService.generateReport(request);
    const remotePayload = await this.requestRemoteAnalysis(request);
    const providerHost = this.getProviderHost(request.modelConfig.baseUrl);

    return {
      ...baseReport,
      summary: {
        ...baseReport.summary,
        overview: remotePayload.overview || baseReport.summary.overview,
      },
      keyIssues:
        remotePayload.keyIssues.length > 0
          ? remotePayload.keyIssues.map((issue, index) => ({
              id: `issue-${index + 1}`,
              ...issue,
            }))
          : baseReport.keyIssues,
      conclusion: {
        finalRecommendation: remotePayload.finalRecommendation || baseReport.conclusion.finalRecommendation,
        rationale: remotePayload.rationale || baseReport.conclusion.rationale,
      },
      meta: {
        ...baseReport.meta,
        provider: providerHost,
        model: request.modelConfig.selectedModel,
      },
    };
  }

  private async requestRemoteAnalysis(request: AnalysisRequest): Promise<RemoteAnalysisPayload> {
    const response = await fetch(`${normalizeBaseUrl(request.modelConfig.baseUrl)}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${request.modelConfig.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: request.modelConfig.selectedModel,
        temperature: 0.3,
        max_tokens: 1200,
        messages: [
          {
            role: 'system',
            content:
              '你是一名中文文本质量分析助手。请只返回 JSON，不要输出 markdown。JSON 结构必须为 {"overview": string, "keyIssues": [{"title": string, "severity": "high" | "medium" | "low", "description": string, "suggestionDirection": string}], "finalRecommendation": "publish" | "revise_then_publish" | "rework", "rationale": string}。',
          },
          {
            role: 'user',
            content: JSON.stringify({
              task: 'analyze_text',
              input: request.input,
            }),
          },
        ],
      }),
    });

    const data = (await response.json()) as ChatCompletionsResponse;

    if (!response.ok) {
      throw new Error(data.error?.message || `远端分析请求失败: HTTP ${response.status}`);
    }

    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('远端分析响应为空');
    }

    const payload = this.parseRemotePayload(content);
    return this.normalizeRemotePayload(payload);
  }

  private parseRemotePayload(content: string): unknown {
    const fenced = content.match(/```json\s*([\s\S]*?)```/i);
    const candidate = fenced?.[1] || content;
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');

    if (start === -1 || end === -1 || end <= start) {
      throw new Error('远端分析未返回可解析的 JSON');
    }

    return JSON.parse(candidate.slice(start, end + 1));
  }

  private normalizeRemotePayload(payload: unknown): RemoteAnalysisPayload {
    if (!payload || typeof payload !== 'object') {
      throw new Error('远端分析响应格式异常');
    }

    const data = payload as Partial<RemoteAnalysisPayload>;
    const keyIssues = Array.isArray(data.keyIssues)
      ? data.keyIssues
          .filter(
            (issue): issue is RemoteIssue =>
              !!issue &&
              typeof issue === 'object' &&
              typeof issue.title === 'string' &&
              (issue.severity === 'high' || issue.severity === 'medium' || issue.severity === 'low') &&
              typeof issue.description === 'string' &&
              typeof issue.suggestionDirection === 'string',
          )
          .slice(0, 5)
      : [];

    if (
      typeof data.overview !== 'string' ||
      typeof data.rationale !== 'string' ||
      !data.finalRecommendation ||
      !['publish', 'revise_then_publish', 'rework'].includes(data.finalRecommendation)
    ) {
      throw new Error('远端分析响应缺少必要字段');
    }

    return {
      overview: data.overview.trim(),
      keyIssues,
      finalRecommendation: data.finalRecommendation,
      rationale: data.rationale.trim(),
    };
  }

  private getProviderHost(baseUrl: string): string {
    try {
      return new URL(baseUrl).host;
    } catch {
      return 'remote-openai-compatible';
    }
  }
}
