import { NextResponse } from 'next/server';
import { PromptTemplateErrorResponse, PromptTemplateSuccessResponse } from '@/types/analysis';
import { getPromptTemplate } from '@/services/analysis/promptTemplates';
import { validateAnalysisRequest } from '@/lib/validation/analysisRequest';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const parsed = validateAnalysisRequest({
      evaluationGoal: searchParams.get('evaluationGoal'),
    });

    if (!parsed.success) {
      const response: PromptTemplateErrorResponse = {
        error: parsed.error.issues[0]?.message || '分析输入不合法',
      };

      return NextResponse.json(response, { status: 400 });
    }

    const template = getPromptTemplate(parsed.data.evaluationGoal);
    const response: PromptTemplateSuccessResponse = { template };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Analysis route failed:', error);

    const response: PromptTemplateErrorResponse = {
      error: error instanceof Error ? error.message : '提示词模板获取失败',
    };

    return NextResponse.json(response, { status: 500 });
  }
}
