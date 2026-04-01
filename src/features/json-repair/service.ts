/**
 * JSON 修复服务实现
 * 
 * 提供基于 LLM 的 JSON 格式修复能力
 * 最多重试一次，再错则报告错误
 */

import { modelClient } from '@/services/model-client';
import { buildRepairMessages } from './prompt';
import type { JsonRepairConfig, JsonRepairParams, JsonRepairResult, JsonRepairService } from './types';

/** 最大尝试次数 */
const MAX_ATTEMPTS = 2;

/**
 * 尝试解析 JSON
 */
function tryParseJson(content: string): unknown | null {
  if (!content.trim()) {
    return null;
  }

  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * 从响应中提取 JSON
 */
function extractJsonFromResponse(content: string): string {
  const rawText = content.replace(/^\uFEFF/, '').trim();

  // 尝试从代码块中提取
  const fencePattern = /```(?:json)?\s*([\s\S]*?)```/i;
  const fenced = rawText.match(fencePattern)?.[1]?.trim();
  if (fenced) {
    return fenced;
  }

  // 尝试提取括号内的 JSON
  const objectStart = rawText.indexOf('{');
  const objectEnd = rawText.lastIndexOf('}');

  if (objectStart !== -1 && objectEnd !== -1 && objectEnd > objectStart) {
    return rawText.slice(objectStart, objectEnd + 1).trim();
  }

  return rawText;
}

/**
 * 默认 JSON 修复服务实现
 */
class DefaultJsonRepairService implements JsonRepairService {
  async repair(config: JsonRepairConfig, params: JsonRepairParams): Promise<JsonRepairResult> {
    const { baseUrl, apiKey, model, progressController, temperature = 0.1, maxTokens = 4096 } = config;
    const { schemaPrompt, malformedJson } = params;

    // 重置进度控制器
    progressController?.reset();

    let currentJson = malformedJson;
    let lastRawResponse: string | undefined;

    // 最多尝试 MAX_ATTEMPTS 次
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        // 构建修复请求消息
        const messages = buildRepairMessages(schemaPrompt, currentJson);

        // 调用模型
        const result = await modelClient.call({
          baseUrl,
          apiKey,
          model,
          messages,
          temperature,
          maxTokens,
          events: progressController?.createEventHandlers(),
        });

        lastRawResponse = result.content;

        // 提取并解析响应
        const jsonText = extractJsonFromResponse(result.content);
        const parsed = tryParseJson(jsonText);

        if (parsed !== null) {
          return {
            success: true,
            data: parsed,
            repairedJsonText: jsonText,
            rawResponse: result.content,
            attempts: attempt,
          };
        }

        // 解析失败，准备下一次尝试
        currentJson = jsonText || result.content;

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'JSON 修复请求失败';
        return {
          success: false,
          error: errorMessage,
          rawResponse: lastRawResponse,
          attempts: attempt,
        };
      }
    }

    // 所有尝试都失败
    return {
      success: false,
      error: `JSON 修复失败，已尝试 ${MAX_ATTEMPTS} 次，修复后的内容仍无法解析`,
      rawResponse: lastRawResponse,
      attempts: MAX_ATTEMPTS,
    };
  }
}

/**
 * 默认导出的 JSON 修复服务实例
 */
export const jsonRepairService: JsonRepairService = new DefaultJsonRepairService();
