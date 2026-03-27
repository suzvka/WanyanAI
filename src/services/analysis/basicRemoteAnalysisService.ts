import {
    evaluationGoalOptions,
    getOptionLabel,
    textCompletenessOptions,
    textTypeOptions,
} from '@/config/evaluationOptions';
import { renderTextBlocksForModel, summarizeTextBlocks } from '@/lib/textBlocks';
import { validateModelConfig } from '@/lib/validation/modelConfig';
import {
    AnalysisRepairAttempt,
    ModelAnalysisRequest,
    ParsedAnalysisPayload,
    PromptTemplateResource,
    PromptTemplateSlotKey,
    RawModelResponse,
} from '@/types/analysis';
import {
    AnalysisReport,
    EvaluationInput,
    ReportNormalizationDiagnostics,
    ReportSection,
    ReportSubscore,
} from '@/types/report';
import { AppError, createAppError } from '@/types/errors';
import { z } from 'zod';
import { AnalysisProgressUpdate, AnalysisService, GenerateReportOptions, PromptTemplateService } from './types';

type ChatCompletionsResponse = {
    output_text?: string;
    choices?: Array<{
        text?: string;
        message?: {
            content?: string | Array<{ type?: string; text?: string }>;
        };
    }>;
    error?: {
        message?: string;
    };
};

const remoteAnalysisSectionSchema = z.object({
    id: z.string().trim().min(1).optional(),
    title: z.string().trim().min(1),
    body: z.string().trim().min(1),
});

const remoteAnalysisSubscoreSchema = z.object({
    id: z.string().trim().min(1),
    label: z.string().trim().min(1),
    score: z.number(),
    rationale: z.string().trim().min(1),
    keyQuestion: z.string().trim().min(1).optional(),
    nature: z.enum(['internal', 'internal_relational_boundary']).optional(),
});

const remoteAnalysisReportSchema = z.object({
    reportId: z.string().trim().min(1).optional(),
    reportVersion: z.string().trim().min(1).optional(),
    generatedAt: z.string().trim().min(1).optional(),
    summary: z.object({
        title: z.string().trim().min(1),
        overview: z.string().trim().min(1),
    }),
    dashboard: z.object({
        totalScore: z.number().optional(),
        grade: z.string().trim().min(1),
        publishReadiness: z.string().trim().min(1),
        subscores: z.array(remoteAnalysisSubscoreSchema).min(1),
    }),
    conclusion: z.object({
        finalRecommendation: z.enum(['publish', 'revise_then_publish', 'rework']),
        rationale: z.string().trim().min(1),
    }),
    meta: z
        .object({
            frameworkVersion: z.string().trim().min(1).optional(),
            scoringPolicyVersion: z.string().trim().min(1).optional(),
            conclusionPolicyVersion: z.string().trim().min(1).optional(),
        })
        .optional(),
    sections: z.array(remoteAnalysisSectionSchema).min(1),
});

type RemoteAnalysisReport = z.infer<typeof remoteAnalysisReportSchema>;
type RemoteAnalysisSection = z.infer<typeof remoteAnalysisSectionSchema>;
type RemoteAnalysisSubscore = z.infer<typeof remoteAnalysisSubscoreSchema>;

type PromptSlotValues = Record<PromptTemplateSlotKey, string>;
type NormalizedAnalysisReport = Omit<AnalysisReport, 'schemaVersion' | 'diagnostics'>;

const normalizeBaseUrl = (baseUrl: string) => baseUrl.trim().replace(/\/$/, '');
const promptSlotPattern = /{{(.*?)}}/g;
const jsonFencePattern = /```(?:json)?\s*([\s\S]*?)```/i;
const normalizeScore = (score: number) => Math.max(0, Math.min(100, Math.round(score)));

function calculateAverageScore(subscores: ReportSubscore[]) {
    return normalizeScore(
        subscores.reduce((total: number, item: ReportSubscore) => total + item.score, 0) / subscores.length,
    );
}

const reportSchemaGuide = `{
  "summary": { "title": "string", "overview": "string" },
  "dashboard": {
    "totalScore": 0,
    "grade": "string",
    "publishReadiness": "string",
    "subscores": [
      {
        "id": "string",
        "label": "string",
        "score": 0,
        "rationale": "string",
        "keyQuestion": "string",
        "nature": "internal | internal_relational_boundary"
      }
    ]
  },
  "conclusion": {
    "finalRecommendation": "publish | revise_then_publish | rework",
    "rationale": "string"
  },
  "reportId": "string",
  "reportVersion": "string",
  "generatedAt": "string",
  "meta": {
    "frameworkVersion": "string",
    "scoringPolicyVersion": "string",
    "conclusionPolicyVersion": "string"
  },
  "sections": [
    {
      "title": "string",
      "body": "string",
      "id": "string"
    }
  ]
}`;

async function readResponseData(response: Response): Promise<ChatCompletionsResponse | null> {
    const text = await response.text();

    if (!text.trim()) {
        return null;
    }

    try {
        return JSON.parse(text) as ChatCompletionsResponse;
    } catch {
        return null;
    }
}

export class BasicRemoteAnalysisService implements AnalysisService {
    constructor(private readonly templateService: PromptTemplateService) { }

    async generateReport({ input, modelConfig, instructionText, onProgress }: GenerateReportOptions): Promise<AnalysisReport> {
        const validatedConfig = validateModelConfig(modelConfig);
        if (!validatedConfig.success) {
            throw createAppError({
                code: 'config_invalid',
                message: validatedConfig.error,
            });
        }

        this.emitProgress(onProgress, 'prepare-upload', '正在整理文本输入与文件引用');

        this.emitProgress(onProgress, 'fetch-template', '正在获取当前评价方式的提示词模板');
        const template = await this.templateService.getTemplate({
            evaluationGoal: input.evaluationGoal,
        });

        this.emitProgress(onProgress, 'build-prompt', '正在拼接最终提示词');
        const messages = this.buildMessages(template, input, instructionText);

        this.emitProgress(onProgress, 'request-model', '模型正在生成分析结果');
        const requestPayload: ModelAnalysisRequest = {
            model: validatedConfig.data.selectedModel,
            messages,
            temperature: template.recommendedParameters.temperature,
            max_tokens: template.recommendedParameters.maxTokens,
        };

        const content = await this.requestRemoteAnalysis(
            validatedConfig.data.baseUrl,
            validatedConfig.data.apiKey,
            requestPayload,
        );

        this.emitProgress(onProgress, 'extract-json', '正在提取模型返回的结构化数据');
        let parsedPayload = this.tryParseRemotePayload(content.content);
        let repairAttempt: AnalysisRepairAttempt = {
            attempted: false,
            success: parsedPayload !== null && parsedPayload.usedRepair,
        };

        if (!parsedPayload) {
            repairAttempt = { attempted: true, success: false, reason: '模型返回内容不是合法 JSON' };
            parsedPayload = await this.requestJsonRepair({
                baseUrl: validatedConfig.data.baseUrl,
                apiKey: validatedConfig.data.apiKey,
                model: validatedConfig.data.selectedModel,
                rawContent: content.content,
                issueHint: '模型初次返回的内容不是合法 JSON，请只修复结构，不要重写分析结论。',
                onProgress,
            });
            repairAttempt.success = true;
        }

        this.emitProgress(onProgress, 'normalize-report', '正在校验结果结构并生成最终报告');

        try {
            return this.normalizeAnalysisReport(
                parsedPayload.parsed,
                template,
                validatedConfig.data.baseUrl,
                validatedConfig.data.selectedModel,
            );
        } catch (error) {
            if (!(error instanceof AppError) || error.code !== 'report_schema_invalid' || repairAttempt.attempted) {
                throw error;
            }

            repairAttempt = {
                attempted: true,
                success: false,
                reason: error.message,
            };

            parsedPayload = await this.requestJsonRepair({
                baseUrl: validatedConfig.data.baseUrl,
                apiKey: validatedConfig.data.apiKey,
                model: validatedConfig.data.selectedModel,
                rawContent: parsedPayload.jsonText,
                issueHint: `返回 JSON 缺少必要字段或字段类型不合法：${error.message}`,
                onProgress,
            });
            repairAttempt.success = true;

            this.emitProgress(onProgress, 'normalize-report', '正在校验修复后的结构化报告', 'recovering');
            return this.normalizeAnalysisReport(
                parsedPayload.parsed,
                template,
                validatedConfig.data.baseUrl,
                validatedConfig.data.selectedModel,
            );
        }
    }

    private buildMessages(template: PromptTemplateResource, input: EvaluationInput, instructionText?: string) {
        const slotValues = this.createSlotValues(input, instructionText);
        this.validateTemplateSlots(template, slotValues);

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

    private createSlotValues(input: EvaluationInput, instructionText?: string): PromptSlotValues {
        return {
            textBlocksPlainText: renderTextBlocksForModel(input),
            textBlocksSummary: summarizeTextBlocks(input),
            textTypeLabel: getOptionLabel(textTypeOptions, input.textType),
            textCompletenessLabel: getOptionLabel(textCompletenessOptions, input.textCompleteness),
            evaluationGoalLabel: getOptionLabel(evaluationGoalOptions, input.evaluationGoal),
            dynamicInstructionText: instructionText?.trim() || '',
        };
    }

    private fillPromptTemplate(template: string, slotValues: PromptSlotValues) {
        return template.replace(promptSlotPattern, (_, rawKey: string) => {
            const key = rawKey.trim() as PromptTemplateSlotKey;
            const value = slotValues[key];

            if (value == null) {
                throw createAppError({
                    code: 'template_response_invalid',
                    message: `提示词槽位缺失：${key}`,
                });
            }

            return value;
        });
    }

    private validateTemplateSlots(template: PromptTemplateResource, slotValues: PromptSlotValues) {
        const placeholderKeys = this.extractPlaceholderKeys(template.systemPromptTemplate, template.userPromptTemplate);

        for (const slot of template.slots) {
            if (slot.required && !placeholderKeys.has(slot.key)) {
                throw createAppError({
                    code: 'template_response_invalid',
                    message: `提示词模板缺少必填槽位占位符：${slot.key}`,
                });
            }
        }

        for (const key of placeholderKeys) {
            if (!(key in slotValues)) {
                throw createAppError({
                    code: 'template_response_invalid',
                    message: `提示词模板存在未知槽位：${key}`,
                });
            }
        }
    }

    private extractPlaceholderKeys(...templates: string[]): Set<string> {
        const keys = new Set<string>();

        for (const template of templates) {
            const matches = template.matchAll(promptSlotPattern);
            for (const match of matches) {
                const key = match[1]?.trim();
                if (key) {
                    keys.add(key);
                }
            }
        }

        return keys;
    }

    private emitProgress(
        onProgress: GenerateReportOptions['onProgress'],
        stage: AnalysisProgressUpdate['stage'],
        message: string,
        status: AnalysisProgressUpdate['status'] = 'running',
    ) {
        onProgress?.({ stage, message, status });
    }

    private extractContent(data: ChatCompletionsResponse | null): RawModelResponse | null {
        if (!data) {
            return null;
        }

        if (typeof data.output_text === 'string' && data.output_text.trim()) {
            return {
                content: data.output_text,
                source: 'output_text',
            };
        }

        const firstChoice = data.choices?.[0];
        if (!firstChoice) {
            return null;
        }

        if (typeof firstChoice.text === 'string' && firstChoice.text.trim()) {
            return {
                content: firstChoice.text,
                source: 'choice_text',
            };
        }

        const messageContent = firstChoice.message?.content;
        if (typeof messageContent === 'string' && messageContent.trim()) {
            return {
                content: messageContent,
                source: 'message_content',
            };
        }

        if (Array.isArray(messageContent)) {
            const merged = messageContent
                .map((part) => (part.type === 'text' || !part.type ? part.text : ''))
                .filter((value): value is string => Boolean(value?.trim()))
                .join('\n')
                .trim();

            return merged
                ? {
                    content: merged,
                    source: 'message_content',
                }
                : null;
        }

        return null;
    }

    private async requestRemoteAnalysis(
        baseUrl: string,
        apiKey: string,
        payload: ModelAnalysisRequest,
    ): Promise<RawModelResponse> {
        let response: Response;
        const endpoint = `${normalizeBaseUrl(baseUrl)}/chat/completions`;

        try {
            response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });
        } catch {
            throw createAppError({
                code: 'network_error',
                message: '远程分析请求失败，请检查网络、跨域配置或模型服务地址',
                retryable: true,
            });
        }

        const data = await readResponseData(response);

        if (!response.ok) {
            throw createAppError({
                code: 'provider_request_failed',
                message: data?.error?.message || `远程分析请求失败：HTTP ${response.status}`,
                status: response.status,
                retryable: response.status >= 500,
            });
        }

        const content = this.extractContent(data);
        if (!content) {
            throw createAppError({
                code: 'provider_response_invalid',
                message: '远程分析响应为空',
            });
        }

        return content;
    }

    private tryParseRemotePayload(content: string): ParsedAnalysisPayload | null {
        const extracted = this.extractJsonCandidate(content);
        const directParsed = this.tryParseJson(extracted.jsonText);
        if (directParsed !== null) {
            return {
                ...extracted,
                parsed: directParsed,
                usedRepair: false,
            };
        }

        const repairedJson = this.repairMalformedJson(extracted.jsonText);
        if (repairedJson !== extracted.jsonText) {
            const repairedParsed = this.tryParseJson(repairedJson);
            if (repairedParsed !== null) {
                return {
                    ...extracted,
                    jsonText: repairedJson,
                    parsed: repairedParsed,
                    usedRepair: true,
                };
            }
        }

        return null;
    }

    private extractJsonCandidate(content: string): Omit<ParsedAnalysisPayload, 'parsed' | 'usedRepair'> {
        const rawText = content.replace(/^\uFEFF/, '').trim();
        let jsonText = rawText;
        let usedFenceExtraction = false;
        let usedBracketExtraction = false;

        const fenced = rawText.match(jsonFencePattern)?.[1]?.trim();
        if (fenced) {
            jsonText = fenced;
            usedFenceExtraction = true;
        }

        const bracketed = this.extractBracketedJson(jsonText);
        if (bracketed && bracketed !== jsonText) {
            jsonText = bracketed;
            usedBracketExtraction = true;
        }

        return {
            rawText,
            jsonText: jsonText.trim(),
            usedFenceExtraction,
            usedBracketExtraction,
        };
    }

    private extractBracketedJson(content: string): string | null {
        const objectStart = content.indexOf('{');
        const objectEnd = content.lastIndexOf('}');

        if (objectStart !== -1 && objectEnd !== -1 && objectEnd > objectStart) {
            return content.slice(objectStart, objectEnd + 1).trim();
        }

        return null;
    }

    private tryParseJson(content: string): unknown | null {
        if (!content.trim()) {
            return null;
        }

        try {
            return JSON.parse(content);
        } catch {
            return null;
        }
    }

    private repairMalformedJson(content: string): string {
        return content
            .replace(/^```(?:json)?\s*/i, '')
            .replace(/```$/i, '')
            .replace(/[\u201C\u201D]/g, '"')
            .replace(/[\u2018\u2019]/g, "'")
            .replace(/,\s*([}\]])/g, '$1')
            .trim();
    }

    private async requestJsonRepair({
        baseUrl,
        apiKey,
        model,
        rawContent,
        issueHint,
        onProgress,
    }: {
        baseUrl: string;
        apiKey: string;
        model: string;
        rawContent: string;
        issueHint: string;
        onProgress?: GenerateReportOptions['onProgress'];
    }): Promise<ParsedAnalysisPayload> {
        this.emitProgress(onProgress, 'repair-json', '检测到结构异常，正在自动修复输出格式', 'recovering');

        const repairPayload: ModelAnalysisRequest = {
            model,
            temperature: 0,
            max_tokens: 2200,
            messages: [
                {
                    role: 'system',
                    content:
                        '你是 JSON 修复助手。你只能输出一个严格合法的 JSON 对象，不要输出解释、注释、Markdown 代码块或额外文本。不得重新分析原文，只能基于已有内容补齐结构并修复格式。',
                },
                {
                    role: 'user',
                    content: [
                        '请将下面已有的分析结果整理为严格合法的 JSON。',
                        `问题说明：${issueHint}`,
                        '输出必须符合以下结构：',
                        reportSchemaGuide,
                        '待修复内容如下：',
                        rawContent,
                    ].join('\n\n'),
                },
            ],
        };

        const repairedResponse = await this.requestRemoteAnalysis(baseUrl, apiKey, repairPayload);
        this.emitProgress(onProgress, 'extract-json', '正在校验修复后的结构化结果', 'recovering');

        const parsedPayload = this.tryParseRemotePayload(repairedResponse.content);
        if (!parsedPayload) {
            throw createAppError({
                code: 'json_repair_failed',
                message: '系统已尝试自动修复结果格式，但仍未得到合法 JSON，请重新生成。',
                retryable: true,
            });
        }

        return parsedPayload;
    }

    private normalizeAnalysisReport(
        payload: unknown,
        template: PromptTemplateResource,
        baseUrl: string,
        model: string,
    ): AnalysisReport {
        const parsed = remoteAnalysisReportSchema.safeParse(payload);

        if (!parsed.success) {
            throw createAppError({
                code: 'report_schema_invalid',
                message: parsed.error.issues[0]?.message || '远程分析返回的报告结构不合法',
                retryable: true,
            });
        }

        const data: RemoteAnalysisReport = parsed.data;
        const sections = data.sections.map((section: RemoteAnalysisSection, index: number) =>
            this.normalizeRemoteSection(section, index),
        );
        const subscores = this.normalizeRemoteSubscores(data.dashboard.subscores);

        const normalizedReport: NormalizedAnalysisReport = {
            reportId: data.reportId || `report-${Date.now()}`,
            reportVersion: data.reportVersion || template.version,
            generatedAt: data.generatedAt || new Date().toISOString(),
            summary: data.summary,
            dashboard: {
                ...data.dashboard,
                subscores,
                totalScore: calculateAverageScore(subscores),
            },
            conclusion: data.conclusion,
            meta: {
                frameworkVersion: data.meta?.frameworkVersion || template.version,
                scoringPolicyVersion: data.meta?.scoringPolicyVersion || template.policyMeta.scoringPolicyVersion,
                conclusionPolicyVersion: data.meta?.conclusionPolicyVersion || template.policyMeta.conclusionPolicyVersion,
                provider: this.getProviderHost(baseUrl),
                model,
            },
            sections,
        };

        return {
            schemaVersion: 'report_schema_v3_subscores',
            ...normalizedReport,
            diagnostics: this.buildReportDiagnostics(sections),
        };
    }

    private normalizeRemoteSubscores(subscores: RemoteAnalysisSubscore[]): ReportSubscore[] {
        return subscores.map((subscore: RemoteAnalysisSubscore) => ({
            ...subscore,
            score: normalizeScore(subscore.score),
        }));
    }

    private normalizeRemoteSection(section: RemoteAnalysisSection, index: number): ReportSection {
        return {
            id: section.id || `section-${index + 1}`,
            title: section.title,
            body: section.body,
        };
    }

    private buildReportDiagnostics(sections: ReportSection[]): ReportNormalizationDiagnostics {
        return {
            normalizationMode: 'paragraph-sections',
            sectionCount: sections.length,
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
