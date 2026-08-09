/**
 * Coze 内部模型中转站
 *
 * 当运行在 Coze 环境时，提供 Coze 内部模型的调用能力。
 * 自包含实现：logger 由工厂注入，不依赖项目内部日志设施。
 */

import type { Station, StationModel, ForwardRequest } from '../types';
import { LLMClient, Config, HeaderUtils, type Message } from 'coze-coding-dev-sdk';
import { createLogger, type Logger } from '../logger';

/**
 * 检测是否运行在 Coze 内部环境
 */
export function isCozeEnvironment(): boolean {
  const env = process.env.COZE_PROJECT_ENV;
  return env === 'PROD' || env === 'DEV';
}

/**
 * Coze 内部模型配置
 */
const COZE_MODELS: StationModel[] = [
  // {
  //   id: 'coze://doubao-seed-2-0-pro-260215',
  //   name: 'Doubao Seed 2.0 Pro',
  //   description: '旗舰级全能通用模型，面向 Agent 时代的复杂推理与长链路任务执行场景',
  //   maxCallsPerHour: 1000,
  // },
  {
    id: 'coze://doubao-seed-2-0-lite-260215',
    name: 'Doubao Seed 2.0',
    description: '均衡型模型，兼顾性能与成本，胜任非结构化信息处理、内容创作、数据分析等',
    maxCallsPerHour: 1000,
  },
  // {
  //   id: 'coze://doubao-seed-2-0-mini-260215',
  //   name: 'Doubao Seed 2.0 Mini',
  //   description: '轻量级模型，面向低时延、高并发与成本敏感场景',
  //   maxCallsPerHour: 1000,
  // },
  // {
  //   id: 'coze://doubao-seed-1-8-251228',
  //   name: 'Doubao Seed 1.8',
  //   description: '多模态 Agent 优化模型，支持深度思考、视觉理解与 Web 搜索',
  //   maxCallsPerHour: 1000,
  // },
  // {
  //   id: 'coze://doubao-seed-1-6-251015',
  //   name: 'Doubao Seed 1.6',
  //   description: '通用模型，兼顾复杂推理、视觉理解与指令遵循能力',
  //   maxCallsPerHour: 1000,
  // },
  // {
  //   id: 'coze://doubao-seed-1-6-vision-250815',
  //   name: 'Doubao Seed 1.6 Vision',
  //   description: '视觉理解模型，支持图像输入与多模态推理',
  //   maxCallsPerHour: 1000,
  // },
  // {
  //   id: 'coze://doubao-seed-1-6-lite-251015',
  //   name: 'Doubao Seed 1.6 Lite',
  //   description: '轻量级模型，主打低时延、高性价比',
  //   maxCallsPerHour: 1000,
  // },
  // {
  //   id: 'coze://deepseek-v3-2-251201',
  //   name: 'DeepSeek V3.2',
  //   description: '高性能推理模型，擅长代码与数学',
  //   maxCallsPerHour: 1000,
  // },
  // {
  //   id: 'coze://deepseek-r1-250528',
  //   name: 'DeepSeek R1',
  //   description: '深度推理模型，擅长复杂逻辑与数学推理',
  //   maxCallsPerHour: 1000,
  // },
  // {
  //   id: 'coze://kimi-k2-5-260127',
  //   name: 'Kimi K2.5',
  //   description: '多模态推理模型，支持长上下文理解',
  //   maxCallsPerHour: 1000,
  // },
  // {
  //   id: 'coze://glm-5-0-260211',
  //   name: 'GLM-5',
  //   description: '通用大模型，支持长文本生成与复杂任务',
  //   maxCallsPerHour: 1000,
  // },
  // {
  //   id: 'coze://glm-5-turbo-260316',
  //   name: 'GLM-5 Turbo',
  //   description: '高性能通用模型，兼顾速度与质量',
  //   maxCallsPerHour: 1000,
  // },
  // {
  //   id: 'coze://glm-4-7-251222',
  //   name: 'GLM-4.7',
  //   description: '通用大模型，支持长文本生成与复杂任务',
  //   maxCallsPerHour: 1000,
  // },
  // {
  //   id: 'coze://minimax-m2-5-260212',
  //   name: 'MiniMax M2.5',
  //   description: '通用大模型，支持长文本生成与复杂任务',
  //   maxCallsPerHour: 1000,
  // },
  // {
  //   id: 'coze://minimax-m2-7-260318',
  //   name: 'MiniMax M2.7',
  //   description: '通用大模型，支持长文本生成与复杂任务',
  //   maxCallsPerHour: 1000,
  // },
  // {
  //   id: 'coze://qwen-3-5-plus-260215',
  //   name: 'Qwen 3.5 Plus',
  //   description: '通用大模型，支持长文本生成与复杂任务',
  //   maxCallsPerHour: 1000,
  // },
];

/**
 * 将 OpenAI 消息格式转换为 Coze SDK 消息格式
 */
function convertMessages(messages: ForwardRequest['messages']): Message[] {
  return messages.map(msg => {
    const role = msg.role as 'system' | 'user' | 'assistant';
    return {
      role,
      content: msg.content,
    };
  });
}

/**
 * 格式化 SSE 数据块
 */
function formatSSEChunk(id: string, model: string, content: string): string {
  const data = JSON.stringify({
    id,
    object: 'chat.completion.chunk',
    created: Date.now(),
    model,
    choices: [
      {
        index: 0,
        delta: { content },
        finish_reason: null,
      },
    ],
  });
  return `data: ${data}\n\n`;
}

/**
 * 创建 Coze 中转站
 *
 * @param options.logger 日志实例（默认使用 console 实现）
 */
export function createCozeStation(options?: { logger?: Logger }): Station {
  const logger = options?.logger ?? createLogger('Station:Coze');

  return {
    id: 'coze-internal',
    name: 'Coze Internal',

    getModels(): StationModel[] {
      // 非 Coze 环境返回空列表（中转站禁用）
      if (!isCozeEnvironment()) {
        logger.info('非 Coze 环境，中转站禁用');
        return [];
      }

      logger.info('Coze 环境检测到，返回模型列表', { modelCount: COZE_MODELS.length });
      return COZE_MODELS;
    },

    canHandle(modelId: string): boolean {
      return modelId.startsWith('coze://') && isCozeEnvironment();
    },

    async forward(request: ForwardRequest): Promise<Response> {
      const { model, messages, stream, headers, requestId, authKey, ...params } = request;

      // 环境检查
      if (!isCozeEnvironment()) {
        logger.error('非 Coze 环境，拒绝请求', null, { requestId });
        return new Response(
          JSON.stringify({
            error: {
              message: 'Coze internal API is only available in Coze environment',
              type: 'environment_error',
              code: 'NOT_COZE_ENVIRONMENT',
              requestId,
            },
          }),
          { status: 503, headers: { 'Content-Type': 'application/json' } }
        );
      }

      try {
        logger.info('收到请求', { requestId, model, stream });

        // 提取实际模型 ID（移除 coze:// 前缀）
        const actualModel = model.startsWith('coze://') ? model.slice(7) : model;

        logger.info('请求参数', {
          requestId,
          model: actualModel,
          stream,
          messageCount: messages.length,
        });

        // 初始化 Coze SDK 客户端
        const customHeaders = HeaderUtils.extractForwardHeaders(headers);
        const config = new Config();
        const client = new LLMClient(config, customHeaders);

        // 转换消息格式
        const cozeMessages = convertMessages(messages);

        const llmConfig = {
          model: actualModel,
          stream: !!stream,
          temperature: params.temperature as number | undefined,
          max_tokens: params.max_tokens as number | undefined,
        };

        // 非流式请求
        if (!stream) {
          const response = await client.invoke(cozeMessages, llmConfig);

          return new Response(
            JSON.stringify({
              id: `coze-${requestId}`,
              object: 'chat.completion',
              created: Date.now(),
              model: actualModel,
              choices: [
                {
                  index: 0,
                  message: {
                    role: 'assistant',
                    content: response.content,
                  },
                  finish_reason: 'stop',
                },
              ],
            }),
            { headers: { 'Content-Type': 'application/json' } }
          );
        }

        // 流式请求
        const streamId = `coze-${requestId}`;
        const encoder = new TextEncoder();

        const readable = new ReadableStream({
          async start(controller) {
            try {
              const streamIterator = client.stream(cozeMessages, llmConfig);

              for await (const chunk of streamIterator) {
                const content = chunk.content?.toString() || '';
                if (content) {
                  const text = formatSSEChunk(streamId, actualModel, content);
                  controller.enqueue(encoder.encode(text));
                }
              }

              // 发送结束标记
              const doneData = JSON.stringify({
                id: streamId,
                object: 'chat.completion.chunk',
                created: Date.now(),
                model: actualModel,
                choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
              });
              controller.enqueue(encoder.encode(`data: ${doneData}\n\n`));
              controller.enqueue(encoder.encode('data: [DONE]\n\n'));

              logger.info('流式响应完成', { requestId, model: actualModel });
            } catch (error) {
              logger.error('流式响应错误', error, { requestId });
              const errorChunk = formatSSEChunk(streamId, actualModel, `[Error] ${error instanceof Error ? error.message : 'Unknown error'}`);
              controller.enqueue(encoder.encode(errorChunk));
            } finally {
              controller.close();
            }
          },
        });

        return new Response(readable, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          },
        });
      } catch (error) {
        logger.error('请求处理失败', error, { requestId });

        return new Response(
          JSON.stringify({
            error: {
              message: error instanceof Error ? error.message : 'Unknown error',
              type: 'api_error',
              code: 'COZE_API_ERROR',
              requestId,
            },
          }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }
    },
  };
}

export default createCozeStation;
