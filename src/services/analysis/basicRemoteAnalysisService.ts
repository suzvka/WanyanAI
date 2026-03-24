import {
  evaluationGoalOptions,
  feedbackStyleOptions,
  getOptionLabel,
  readerPreferenceOptions,
  specialConstraintOptions,
  textCompletenessOptions,
  textTypeOptions,
} from '@/config/evaluationOptions';
import { validateModelConfig } from '@/lib/validation/modelConfig';
import { ModelAnalysisRequest, PromptTemplateResource, PromptTemplateSlotKey } from '@/types/analysis';
import { AnalysisReport, EvaluationInput } from '@/types/report';
import { MockAnalysisService } from './mockAnalysisService';
import { AnalysisService, GenerateReportOptions, PromptTemplateService } from './types';

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

type PromptSlotValues = Record<PromptTemplateSlotKey, string>;

const normalizeBaseUrl = (baseUrl: string) => baseUrl.trim().replace(/\/$/, '');

export class BasicRemoteAnalysisService implements AnalysisService {
  constructor(
    private readonly templateService: PromptTemplateService,
    private readonly mockService: MockAnalysisService = new MockAnalysisService(),
  ) {}

  async generateReport({ input, modelConfig, onProgress }: GenerateReportOptions): Promise<AnalysisReport> {
    const validatedConfig = validateModelConfig(modelConfig);
    if (!validatedConfig.success) {
      throw new Error(validatedConfig.error);
    }

    onProgress?.('fetch-template');
    const template = await this.templateService.getTemplate({
      evaluationGoal: input.evaluationGoal,
    });

    onProgress?.('build-prompt');
    const messages = this.buildMessages(template, input);

    onProgress?.('request-model');
    const content = await this.requestRemoteAnalysis(validatedConfig.data.baseUrl, validatedConfig.data.apiKey, {
      model: validatedConfig.data.selectedModel,
      messages,
      temperature: template.recommendedParameters.temperature,
      max_tokens: template.recommendedParameters.maxTokens,
    });

    onProgress?.('parse-report');
    const payload = this.parseRemotePayload(content);
    return this.normalizeAnalysisReport(payload, input, validatedConfig.data.baseUrl, validatedConfig.data.selectedModel);
  }

  private buildMessages(template: PromptTemplateResource, input: EvaluationInput) {
    const slotValues = this.createSlotValues(input);

    return [
      {
        role: 'system' as const,
        content: this.fillPromptTemplate(template.systemPromptTemplate, slotValues),
      },
      {
        role: 'user' as const,
        content: this.fillPromptTemplate(template.userPromptTemplate, slotValues),
      },
    ];
  }

  private createSlotValues(input: EvaluationInput): PromptSlotValues {
    return {
      textContent: input.textContent.trim(),
      textTypeLabel: getOptionLabel(textTypeOptions, input.textType),
      textCompletenessLabel: getOptionLabel(textCompletenessOptions, input.textCompleteness),
      evaluationGoalLabel: getOptionLabel(evaluationGoalOptions, input.evaluationGoal),
      readerPreferenceLabel: input.readerPreference
        ? getOptionLabel(readerPreferenceOptions, input.readerPreference)
        : '未指定',
      feedbackStyleLabel: input.feedbackStyle
        ? getOptionLabel(feedbackStyleOptions, input.feedbackStyle)
        : '未指定',
      hasReferenceSampleLabel: input.hasReferenceSample ? '已提供' : '未提供',
      specialConstraintsLabel:
        input.specialConstraints && input.specialConstraints.length > 0
          ? input.specialConstraints.map((item) => getOptionLabel(specialConstraintOptions, item)).join('、')
          : '无',
    };
  }

  private fillPromptTemplate(template: string, slotValues: PromptSlotValues) {
    return template.replace(/{{(.*?)}}/g, (_, rawKey: string) => {
      const key = rawKey.trim() as PromptTemplateSlotKey;
      return slotValues[key] ?? '';
    });
  }

  private async requestRemoteAnalysis(baseUrl: string, apiKey: string, payload: ModelAnalysisRequest): Promise<string> {
    const response = await fetch(`${normalizeBaseUrl(baseUrl)}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = (await response.json()) as ChatCompletionsResponse;

    if (!response.ok) {
      throw new Error(data.error?.message || `远端分析请求失败: HTTP ${response.status}`);
    }

    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('远端分析响应为空');
    }

    return content;
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

  private async normalizeAnalysisReport(
    payload: unknown,
    input: EvaluationInput,
    baseUrl: string,
    model: string,
  ): Promise<AnalysisReport> {
    const fallbackReport = await this.mockService.generateReport({
      input,
      modelConfig: {
        baseUrl,
        apiKey: 'local-only',
        selectedModel: model,
      },
    });

    if (!payload || typeof payload !== 'object') {
      throw new Error('远端分析响应格式异常');
    }

    const data = payload as Partial<AnalysisReport>;

    return {
      ...fallbackReport,
      ...data,
      reportId: typeof data.reportId === 'string' && data.reportId.trim() ? data.reportId : fallbackReport.reportId,
      reportVersion:
        typeof data.reportVersion === 'string' && data.reportVersion.trim() ? data.reportVersion : '2.0.0',
      generatedAt:
        typeof data.generatedAt === 'string' && data.generatedAt.trim() ? data.generatedAt : new Date().toISOString(),
      summary:
        data.summary && typeof data.summary === 'object'
          ? {
              title:
                typeof data.summary.title === 'string' && data.summary.title.trim()
                  ? data.summary.title
                  : fallbackReport.summary.title,
              overview:
                typeof data.summary.overview === 'string' && data.summary.overview.trim()
                  ? data.summary.overview
                  : fallbackReport.summary.overview,
            }
          : fallbackReport.summary,
      dashboard:
        data.dashboard && typeof data.dashboard === 'object'
          ? {
              totalScore:
                typeof data.dashboard.totalScore === 'number'
                  ? Math.max(0, Math.min(100, Math.round(data.dashboard.totalScore)))
                  : fallbackReport.dashboard.totalScore,
              grade:
                typeof data.dashboard.grade === 'string' && data.dashboard.grade.trim()
                  ? data.dashboard.grade
                  : fallbackReport.dashboard.grade,
              publishReadiness:
                typeof data.dashboard.publishReadiness === 'string' && data.dashboard.publishReadiness.trim()
                  ? data.dashboard.publishReadiness
                  : fallbackReport.dashboard.publishReadiness,
            }
          : fallbackReport.dashboard,
      dimensions: Array.isArray(data.dimensions) && data.dimensions.length > 0 ? data.dimensions : fallbackReport.dimensions,
      keyIssues:
        Array.isArray(data.keyIssues) && data.keyIssues.length > 0
          ? data.keyIssues.map((issue, index) => ({
              id:
                typeof issue?.id === 'string' && issue.id.trim() ? issue.id : `issue-${index + 1}`,
              title: typeof issue?.title === 'string' ? issue.title : fallbackReport.keyIssues[index]?.title || '待补充问题',
              severity:
                issue?.severity === 'high' || issue?.severity === 'medium' || issue?.severity === 'low'
                  ? issue.severity
                  : 'medium',
              description:
                typeof issue?.description === 'string'
                  ? issue.description
                  : fallbackReport.keyIssues[index]?.description || '模型未返回问题描述。',
              suggestionDirection:
                typeof issue?.suggestionDirection === 'string'
                  ? issue.suggestionDirection
                  : fallbackReport.keyIssues[index]?.suggestionDirection || '请补充修改方向。',
            }))
          : fallbackReport.keyIssues,
      conclusion:
        data.conclusion && typeof data.conclusion === 'object'
          ? {
              finalRecommendation:
                data.conclusion.finalRecommendation === 'publish' ||
                data.conclusion.finalRecommendation === 'revise_then_publish' ||
                data.conclusion.finalRecommendation === 'rework'
                  ? data.conclusion.finalRecommendation
                  : fallbackReport.conclusion.finalRecommendation,
              rationale:
                typeof data.conclusion.rationale === 'string' && data.conclusion.rationale.trim()
                  ? data.conclusion.rationale
                  : fallbackReport.conclusion.rationale,
            }
          : fallbackReport.conclusion,
      meta: {
        frameworkVersion:
          data.meta && typeof data.meta.frameworkVersion === 'string' && data.meta.frameworkVersion.trim()
            ? data.meta.frameworkVersion
            : '2.0.0',
        scoringPolicyVersion:
          data.meta && typeof data.meta.scoringPolicyVersion === 'string' && data.meta.scoringPolicyVersion.trim()
            ? data.meta.scoringPolicyVersion
            : fallbackReport.meta.scoringPolicyVersion,
        conclusionPolicyVersion:
          data.meta && typeof data.meta.conclusionPolicyVersion === 'string' && data.meta.conclusionPolicyVersion.trim()
            ? data.meta.conclusionPolicyVersion
            : fallbackReport.meta.conclusionPolicyVersion,
        provider: this.getProviderHost(baseUrl),
        model,
      },
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
