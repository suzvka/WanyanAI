import { NextResponse } from 'next/server';
import { PromptTemplateErrorResponse, PromptTemplateSuccessResponse } from '@/types/analysis';
import { compilePromptFramework } from '@/services/analysis/promptTemplates';
import { validateAnalysisRequest } from '@/lib/validation/analysisRequest';
import { toAppErrorPayload } from '@/types/errors';

export async function POST(request: Request) {
  try {
    const parsed = validateAnalysisRequest(await request.json());

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

    const framework = compilePromptFramework(parsed.data.evaluationGoal);
    const response: PromptTemplateSuccessResponse = { framework };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Prompt framework compile route failed:', error);

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
