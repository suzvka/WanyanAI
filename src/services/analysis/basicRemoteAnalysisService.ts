import { renderTextBlockMetadataForModel, renderTextBlocksForModel } from '@/lib/textBlocks';
import { validateModelConfig } from '@/lib/validation/modelConfig';
import {
    AnalysisRepairAttempt,
    ModelAnalysisMessage,
    ModelAnalysisRequest,
    ParsedAnalysisPayload,
    PromptTemplateResource,
    PromptTemplateSlotKey,
    RawModelResponse,
} from '@/types/analysis';
import { AnalysisReport, EvaluationInput } from '@/types/report';
import { AppError, createAppError } from '@/types/errors';
import { normalizeModelMinimalReport } from '@/lib/analysis/reportNormalization';
import { AnalysisProgressUpdate, AnalysisService, GenerateReportOptions, PromptTemplateService } from './types';

type ChatCompletionsResponse = {
    output_text?: string;
    choices?: Array<{
        text?: string;
        finish_reason?: string;
        message?: {
            content?: string | Array<{ type?: string; text?: string }>;
        };
    }>;
    error?: {
        message?: string;
    };
};

type PromptSlotValues = Record<PromptTemplateSlotKey, string>;
type TruncationSignal = {
    isLikelyTruncated: boolean;
    reason: string;
    missingTopLevelKeys: string[];
    endsWithClosingBrace: boolean;
    hasUnterminatedString: boolean;
    unclosedBraces: number;
    unclosedBrackets: number;
};

const normalizeBaseUrl = (baseUrl: string) => baseUrl.trim().replace(/\/$/, '');
const promptSlotPattern = /{{(.*?)}}/g;
const jsonFencePattern = /```(?:json)?\s*([\s\S]*?)```/i;
const requiredTopLevelKeys = ['summary', 'subscores', 'conclusion'] as const;
const minimumInitialMaxTokens = 2200;
const minimumRetryMaxTokens = 2800;
const maximumGenerationMaxTokens = 3200;
const maximumRepairMaxTokens = 3600;

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
        const slotValues = this.createSlotValues(input, instructionText);
        const messages = this.buildMessages(template, slotValues);
        const initialMaxTokens = this.calculateGenerationMaxTokens(
            template.recommendedParameters.maxTokens ?? 8192,
            slotValues.textBlocksPlainText.length,
        );

        // 打印完整提示词到控制台
        console.group('📤 分析请求 - 完整提示词');
        console.info('🎯 评价目标:', input.evaluationGoal);
        console.info('📝 槽位值:', slotValues);
        console.info('─────────────────────────────────────');
        messages.forEach((msg, index) => {
            console.info(`${msg.role === 'system' ? '🤖 System' : '👤 User'} (消息 ${index + 1}):`);
            console.info(msg.content);
            console.info('─────────────────────────────────────');
        });
        console.groupEnd();

        this.emitProgress(onProgress, 'request-model', '模型正在生成分析结果');
        const requestPayload: ModelAnalysisRequest = {
            model: validatedConfig.data.selectedModel,
            messages,
            temperature: template.recommendedParameters.temperature,
            max_tokens: initialMaxTokens,
        };

        let content = await this.requestRemoteAnalysis(
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
        let retryAttempted = false;

        if (!parsedPayload) {
            const truncationSignal = this.detectTruncation(content.content, parsedPayload, content.finishReason);

            if (truncationSignal.isLikelyTruncated) {
                this.logJsonDiagnostic('检测到疑似截断', {
                    reason: truncationSignal.reason,
                    finishReason: content.finishReason || null,
                    missingTopLevelKeys: truncationSignal.missingTopLevelKeys,
                    endsWithClosingBrace: truncationSignal.endsWithClosingBrace,
                    hasUnterminatedString: truncationSignal.hasUnterminatedString,
                    unclosedBraces: truncationSignal.unclosedBraces,
                    unclosedBrackets: truncationSignal.unclosedBrackets,
                });
                retryAttempted = true;
                const retryResult = await this.retryTruncatedAnalysis({
                    baseUrl: validatedConfig.data.baseUrl,
                    apiKey: validatedConfig.data.apiKey,
                    requestPayload,
                    reason: truncationSignal.reason,
                    onProgress,
                });

                content = retryResult.response;
                parsedPayload = retryResult.parsedPayload;
                repairAttempt.success = parsedPayload !== null && parsedPayload.usedRepair;
            }

            if (!parsedPayload) {
                repairAttempt = { attempted: true, success: false, reason: '模型返回内容不是合法 JSON' };
                parsedPayload = await this.requestJsonRepair({
                    baseUrl: validatedConfig.data.baseUrl,
                    apiKey: validatedConfig.data.apiKey,
                    model: validatedConfig.data.selectedModel,
                    originalMessages: messages,
                    rawContent: content.content,
                    issueHint: '模型返回的内容无法完成解析，请只修复结构，不要重写分析结论。',
                    onProgress,
                });
                repairAttempt.success = true;
            }
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

            const truncationSignal = this.detectTruncation(content.content, parsedPayload, content.finishReason);
            if (truncationSignal.isLikelyTruncated && !retryAttempted) {
                this.logJsonDiagnostic('Schema 校验前识别到疑似截断', {
                    reason: truncationSignal.reason,
                    finishReason: content.finishReason || null,
                    missingTopLevelKeys: truncationSignal.missingTopLevelKeys,
                    endsWithClosingBrace: truncationSignal.endsWithClosingBrace,
                    hasUnterminatedString: truncationSignal.hasUnterminatedString,
                    unclosedBraces: truncationSignal.unclosedBraces,
                    unclosedBrackets: truncationSignal.unclosedBrackets,
                    schemaError: error.message,
                });
                retryAttempted = true;
                const retryResult = await this.retryTruncatedAnalysis({
                    baseUrl: validatedConfig.data.baseUrl,
                    apiKey: validatedConfig.data.apiKey,
                    requestPayload,
                    reason: `${truncationSignal.reason}；schema 校验失败：${error.message}`,
                    onProgress,
                });

                content = retryResult.response;
                parsedPayload = retryResult.parsedPayload;

                if (parsedPayload) {
                    this.emitProgress(onProgress, 'normalize-report', '正在校验重试后的结构化报告', 'recovering');
                    return this.normalizeAnalysisReport(
                        parsedPayload.parsed,
                        template,
                        validatedConfig.data.baseUrl,
                        validatedConfig.data.selectedModel,
                    );
                }
            }

            repairAttempt = {
                attempted: true,
                success: false,
                reason: error.message,
            };

            const repairSource = parsedPayload?.jsonText ?? content.content;

            parsedPayload = await this.requestJsonRepair({
                baseUrl: validatedConfig.data.baseUrl,
                apiKey: validatedConfig.data.apiKey,
                model: validatedConfig.data.selectedModel,
                originalMessages: messages,
                rawContent: repairSource,
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

    private buildMessages(template: PromptTemplateResource, slotValues: PromptSlotValues) {
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
            textBlocksMetadata: renderTextBlockMetadataForModel(input),
            textBlocksPlainText: renderTextBlocksForModel(input),
            dynamicInstructionText: instructionText?.trim() || '',
        };
    }

    private fillPromptTemplate(template: string, slotValues: PromptSlotValues) {
        return template.replace(promptSlotPattern, (_, rawKey: string) => {
            const key = rawKey.trim() as PromptTemplateSlotKey;
            const value = slotValues[key];

            // 槽位缺失时返回空字符串，允许自由配置
            if (value == null) {
                return '';
            }

            return value;
        });
    }

    private validateTemplateSlots(template: PromptTemplateResource, slotValues: PromptSlotValues) {
        // 完全信任动态配置，不再进行严格验证
        // 槽位缺失时会在 fillPromptTemplate 中用空字符串填充
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

    private calculateGenerationMaxTokens(recommendedMaxTokens: number, plainTextLength: number) {
        const baseTokens = Math.max(recommendedMaxTokens, minimumInitialMaxTokens);

        if (plainTextLength >= 30000) {
            return Math.min(maximumGenerationMaxTokens, baseTokens + 800);
        }

        if (plainTextLength >= 18000) {
            return Math.min(maximumGenerationMaxTokens, baseTokens + 500);
        }

        if (plainTextLength >= 8000) {
            return Math.min(maximumGenerationMaxTokens, baseTokens + 250);
        }

        return baseTokens;
    }

    private calculateRetryMaxTokens(currentMaxTokens?: number) {
        const baseTokens = Math.max(currentMaxTokens ?? minimumInitialMaxTokens, minimumRetryMaxTokens);
        return Math.min(maximumGenerationMaxTokens, baseTokens + 400);
    }

    private calculateRepairMaxTokens(rawContentLength: number) {
        if (rawContentLength >= 2800) {
            return maximumRepairMaxTokens;
        }

        if (rawContentLength >= 2000) {
            return 3000;
        }

        return minimumRetryMaxTokens;
    }

    private inspectJsonClosure(content: string) {
        let inString = false;
        let isEscaped = false;
        let unclosedBraces = 0;
        let unclosedBrackets = 0;

        for (const char of content) {
            if (isEscaped) {
                isEscaped = false;
                continue;
            }

            if (char === '\\') {
                isEscaped = true;
                continue;
            }

            if (char === '"') {
                inString = !inString;
                continue;
            }

            if (inString) {
                continue;
            }

            if (char === '{') {
                unclosedBraces += 1;
            } else if (char === '}') {
                unclosedBraces = Math.max(0, unclosedBraces - 1);
            } else if (char === '[') {
                unclosedBrackets += 1;
            } else if (char === ']') {
                unclosedBrackets = Math.max(0, unclosedBrackets - 1);
            }
        }

        return {
            endsWithClosingBrace: content.trimEnd().endsWith('}'),
            hasUnterminatedString: inString,
            unclosedBraces,
            unclosedBrackets,
        };
    }

    private detectTruncation(
        content: string,
        parsedPayload: ParsedAnalysisPayload | null,
        finishReason?: string,
    ): TruncationSignal {
        const closure = this.inspectJsonClosure(content);
        const normalizedContent = content.trim();
        const hasKeyLiteral = (key: (typeof requiredTopLevelKeys)[number]) => normalizedContent.includes(`"${key}"`);
        const parsedRecord = parsedPayload?.parsed && typeof parsedPayload.parsed === 'object' ? parsedPayload.parsed : null;
        const parsedKeys = parsedRecord ? Object.keys(parsedRecord as Record<string, unknown>) : [];
        const missingTopLevelKeys = requiredTopLevelKeys.filter((key) => {
            if (parsedKeys.length > 0) {
                return !parsedKeys.includes(key);
            }

            return !hasKeyLiteral(key);
        });

        const hasSummaryAndSubscores = parsedKeys.length > 0
            ? parsedKeys.includes('summary') && parsedKeys.includes('subscores')
            : hasKeyLiteral('summary') && hasKeyLiteral('subscores');

        const isLikelyTruncated =
            finishReason === 'length'
            || closure.hasUnterminatedString
            || closure.unclosedBraces > 0
            || closure.unclosedBrackets > 0
            || !closure.endsWithClosingBrace
            || (hasSummaryAndSubscores && missingTopLevelKeys.length > 0);

        const reason = finishReason === 'length'
            ? 'provider finish_reason=length'
            : closure.hasUnterminatedString
                ? 'JSON 字符串未闭合'
                : closure.unclosedBraces > 0 || closure.unclosedBrackets > 0
                    ? 'JSON 结构未闭合'
                    : !closure.endsWithClosingBrace
                        ? '输出未以对象闭合'
                        : hasSummaryAndSubscores && missingTopLevelKeys.length > 0
                            ? `缺少顶层字段：${missingTopLevelKeys.join(', ')}`
                            : '未检测到明显截断';

        return {
            isLikelyTruncated,
            reason,
            missingTopLevelKeys,
            ...closure,
        };
    }

    private async retryTruncatedAnalysis({
        baseUrl,
        apiKey,
        requestPayload,
        reason,
        onProgress,
    }: {
        baseUrl: string;
        apiKey: string;
        requestPayload: ModelAnalysisRequest;
        reason: string;
        onProgress?: GenerateReportOptions['onProgress'];
    }): Promise<{ response: RawModelResponse; parsedPayload: ParsedAnalysisPayload | null }> {
        this.emitProgress(onProgress, 'request-model', `检测到输出疑似被截断，正在提高输出上限后重试：${reason}`, 'recovering');

        const retryPayload: ModelAnalysisRequest = {
            ...requestPayload,
            temperature: 0,
            max_tokens: this.calculateRetryMaxTokens(requestPayload.max_tokens),
        };

        const response = await this.requestRemoteAnalysis(baseUrl, apiKey, retryPayload);
        this.emitProgress(onProgress, 'extract-json', '正在校验重试后的结构化结果', 'recovering');

        return {
            response,
            parsedPayload: this.tryParseRemotePayload(response.content),
        };
    }

    private emitProgress(
        onProgress: GenerateReportOptions['onProgress'],
        stage: AnalysisProgressUpdate['stage'],
        message: string,
        status: AnalysisProgressUpdate['status'] = 'running',
    ) {
        onProgress?.({ stage, message, status });
    }

    private logJsonDiagnostic(label: string, payload?: Record<string, unknown>) {
        if (payload) {
            console.info(`[JSON解析诊断] ${label}`, payload);
            return;
        }

        console.info(`[JSON解析诊断] ${label}`);
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
                finishReason: firstChoice.finish_reason,
            };
        }

        const messageContent = firstChoice.message?.content;
        if (typeof messageContent === 'string' && messageContent.trim()) {
            return {
                content: messageContent,
                source: 'message_content',
                finishReason: firstChoice.finish_reason,
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
                    finishReason: firstChoice.finish_reason,
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
        originalMessages,
        rawContent,
        issueHint,
        onProgress,
    }: {
        baseUrl: string;
        apiKey: string;
        model: string;
        originalMessages: ModelAnalysisMessage[];
        rawContent: string;
        issueHint: string;
        onProgress?: GenerateReportOptions['onProgress'];
    }): Promise<ParsedAnalysisPayload> {
        this.emitProgress(onProgress, 'repair-json', '检测到结构异常，正在自动修复输出格式', 'recovering');

        const repairPayload: ModelAnalysisRequest = {
            model,
            temperature: 0,
            max_tokens: this.calculateRepairMaxTokens(rawContent.length),
            messages: this.buildRepairMessages(originalMessages, rawContent, issueHint),
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

    private buildRepairMessages(
        originalMessages: ModelAnalysisMessage[],
        rawContent: string,
        issueHint: string,
    ): ModelAnalysisMessage[] {
        return [
            ...originalMessages,
            {
                role: 'assistant',
                content: rawContent,
            },
            {
                role: 'user',
                content: [
                    '以上是你刚才基于同一输入生成的结果。',
                    `问题说明：${issueHint}`,
                    '不要重新分析，不要改写既有判断，只修复结构并仅输出一个严格合法的 JSON 对象。',
                ].join('\n'),
            },
        ];
    }

    private normalizeAnalysisReport(
        payload: unknown,
        template: PromptTemplateResource,
        baseUrl: string,
        model: string,
    ): AnalysisReport {
        return normalizeModelMinimalReport(payload, template, baseUrl, model);
    }
}
