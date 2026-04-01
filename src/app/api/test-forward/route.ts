import { NextRequest, NextResponse } from 'next/server';
import { getForwardMapping, getAllForwardMappings, getAvailableModels, getModelIds } from '@/lib/api-station/forwardConfig';

/**
 * GET /api/test-forward
 * 测试转发配置是否正确加载
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const model = searchParams.get('model');

    // 测试1: 获取所有转发映射
    const allMappings = getAllForwardMappings();

    // 测试2: 获取可用模型列表（权限等级 1 = 游客）
    const availableModels = getAvailableModels(1);

    // 测试3: 获取所有模型 ID
    const modelIds = getModelIds();

    // 测试4: 测试特定模型的转发配置
    let specificMapping = null;
    if (model) {
      specificMapping = getForwardMapping(model);
    }

    return NextResponse.json({
      success: true,
      data: {
        allMappingsCount: allMappings.length,
        availableModelsCount: availableModels.length,
        modelIds,
        availableModels: availableModels.map(m => ({
          id: m.id,
          displayName: m.displayName
        })),
        sampleMappings: allMappings.slice(0, 3).map(m => ({
          sourceModel: m.sourceModel,
          targetBaseUrl: m.targetBaseUrl,
          // 脱敏 API Key
          targetApiKey: m.targetApiKey.substring(0, 8) + '...'
        })),
        specificModel: model ? {
          model,
          found: !!specificMapping,
          mapping: specificMapping ? {
            targetBaseUrl: specificMapping.targetBaseUrl,
            targetApiKey: specificMapping.targetApiKey.substring(0, 8) + '...'
          } : null
        } : null
      }
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
