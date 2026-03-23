import { NextResponse } from 'next/server';
import { AnalysisErrorResponse, AnalysisSuccessResponse } from '@/types/analysis';
import { mockAnalysisService } from '@/services/analysis';
import { evaluationInputSchema } from '@/lib/validation/evaluationInput';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = evaluationInputSchema.safeParse(body);

    if (!parsed.success) {
      const response: AnalysisErrorResponse = {
        error: parsed.error.issues[0]?.message || '分析输入不合法',
      };

      return NextResponse.json(response, { status: 400 });
    }

    const report = await mockAnalysisService.generateReport(parsed.data);
    const response: AnalysisSuccessResponse = { report };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Analysis route failed:', error);

    const response: AnalysisErrorResponse = {
      error: error instanceof Error ? error.message : '分析服务调用失败',
    };

    return NextResponse.json(response, { status: 500 });
  }
}
