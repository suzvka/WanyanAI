import { NextResponse } from 'next/server';
import type { PromptTemplateErrorResponse, PromptTemplateSuccessResponse } from '@/types/analysis';
import { getPromptTemplate } from '@/services/analysis/promptTemplates';
import { validatePromptTemplateRequest } from '@/lib/validation/analysisRequest';
import { toAppErrorPayload } from '@/types/errors';

export async function POST(request: Request) {
  try {
    const parsed = validatePromptTemplateRequest(await request.json());

    if (!parsed.success) {
      const response: PromptTemplateErrorResponse = {
        error: {
          code: 'invalid_input',
          message: parsed.error.issues[0]?.message || '分析输入不合法',
          status: 400,
        },
      };

      return NextResponse.json(response, { status: 400 });
    }

    console.log('[api/templates/compile] Request:', parsed.data);
    const template = await getPromptTemplate(parsed.data.evaluationGoal, parsed.data.outputMode);
    console.log('[api/templates/compile] Template received:', {
      templateId: template.templateId,
      outputMode: parsed.data.outputMode,
      systemPromptLength: template.systemPromptTemplate.length,
      systemPromptContainsLanguageExpression: template.systemPromptTemplate.includes('language_expression'),
    });
    const response: PromptTemplateSuccessResponse = { template };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[api/templates/compile] Error:', error);
    const response: PromptTemplateErrorResponse = {
      error: toAppErrorPayload(error, {
        code: 'template_fetch_failed',
        message: '提示词模板获取失败',
        status: 500,
        retryable: true,
      }),
    };

    return NextResponse.json(response, { status: 500 });
  }
}
