/**
 * 输出模式注册表
 *
 * 自动扫描并注册所有输出模式模块
 */

import 'server-only';

import type {
  OutputModeModule,
  OutputModeRegistry as IOutputModeRegistry,
  ValidationResult,
  ProcessInput,
  ProcessedReportData,
  BuildScoringContextParams,
  CollectedToolData,
} from './types';
import type { ReportScoringContext } from '@/types/analysis';

// ============================================================================
// 静态导入所有模块（确保同步初始化）
// ============================================================================

// 从 features/output-modes/ 导入模块（模块自治架构）
import { register as registerLiteraryReview } from '@/features/output-modes/literary-review/module';
import { register as registerGaokaoEssay } from '@/features/output-modes/gaokao-essay/module';

// ============================================================================
// 注册表实现
// ============================================================================

/**
 * 输出模式注册表实现
 */
class OutputModeRegistryImpl implements IOutputModeRegistry {
  private modules = new Map<string, OutputModeModule>();

  /**
   * 注册输出模式模块
   */
  register(module: OutputModeModule): void {
    if (this.modules.has(module.id)) {
      console.warn(`[OutputModeRegistry] 模块 ${module.id} 已存在，将被覆盖`);
    }
    this.modules.set(module.id, module);
    console.log(`[OutputModeRegistry] 已注册模块: ${module.id}`);
  }

  /**
   * 获取模块
   */
  get(id: string): OutputModeModule | undefined {
    return this.modules.get(id);
  }

  /**
   * 获取所有模块
   */
  getAll(): OutputModeModule[] {
    return Array.from(this.modules.values());
  }

  /**
   * 获取所有模块 ID
   */
  getIds(): string[] {
    return Array.from(this.modules.keys());
  }

  /**
   * 获取模块提示词
   */
  getPrompt(id: string): string | undefined {
    return this.modules.get(id)?.prompt;
  }

  /**
   * 获取模块 MCP 工具定义
   */
  getMcpToolDefinitions(id: string) {
    return this.modules.get(id)?.mcpToolDefinitions;
  }

  /**
   * 验证数据
   */
  validate(id: string, data: unknown): ValidationResult {
    const module = this.modules.get(id);
    if (!module) {
      return {
        success: false,
        errors: [{ path: '', message: `未找到输出模式：${id}` }],
      };
    }
    return module.validate(data);
  }

  /**
   * 处理数据
   */
  process(id: string, input: ProcessInput): ProcessedReportData {
    const module = this.modules.get(id);
    if (!module) {
      throw new Error(`未找到输出模式：${id}`);
    }
    return module.process(input);
  }

  /**
   * 构建评分上下文
   */
  buildScoringContext(id: string, params: BuildScoringContextParams): ReportScoringContext {
    const module = this.modules.get(id);
    if (!module) {
      throw new Error(`未找到输出模式：${id}`);
    }
    return module.buildScoringContext(params);
  }

  /**
   * 拼装数据（多工具收集模式）
   *
   * 从多个工具调用结果中拼装完整的报告数据
   */
  assemble(id: string, collectedData: CollectedToolData): { success: boolean; data?: Record<string, unknown>; error?: string } {
    const module = this.modules.get(id);
    if (!module) {
      return { success: false, error: `未找到输出模式：${id}` };
    }

    // 检查模块是否支持 assemble
    if (!module.assemble) {
      return { success: false, error: `输出模式 ${id} 不支持多工具收集模式` };
    }

    try {
      const assembledData = module.assemble(collectedData);
      return { success: true, data: assembledData as Record<string, unknown> };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : '拼装数据失败' 
      };
    }
  }

  /**
   * 检查模块是否存在
   */
  has(id: string): boolean {
    return this.modules.has(id);
  }
}

// ============================================================================
// 全局注册表实例与初始化
// ============================================================================

/**
 * 全局注册表实例
 */
export const outputModeRegistry = new OutputModeRegistryImpl();

// 同步注册所有模块（在模块加载时立即执行）
registerLiteraryReview(outputModeRegistry);
registerGaokaoEssay(outputModeRegistry);

console.log('[OutputModeRegistry] 初始化完成，已注册模块:', outputModeRegistry.getIds());

// ============================================================================
// 导出
// ============================================================================

// 重新导出类型
export type { OutputModeModule, ValidationResult, ProcessInput, ProcessedReportData } from './types';

/**
 * 获取输出模式模块（便捷函数）
 */
export function getOutputModeModule(id: string): OutputModeModule | undefined {
  return outputModeRegistry.get(id);
}
