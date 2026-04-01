import { EvaluationInput } from '@/types/report';
import type { ModuleConfig } from '@/types/module';

export type EvaluationInputDefaults = Pick<EvaluationInput, 'textType' | 'textCompleteness' | 'evaluationGoal'>;

export function createDefaultEvaluationInput(defaults: EvaluationInputDefaults): EvaluationInput {
  return {
    textBlocks: [],
    containers: [],
    textType: defaults.textType,
    textCompleteness: defaults.textCompleteness,
    evaluationGoal: defaults.evaluationGoal,
  };
}

/**
 * 从模块配置创建初始评估输入
 */
export function createInitialEvaluationInputFromModule(moduleConfig: ModuleConfig): EvaluationInput {
  // 查找分析控制中的默认值
  const getControlDefault = (controlId: string): string => {
    const control = moduleConfig.analysisControls.controls.find((c) => c.id === controlId && c.enabled);
    return control?.options[0]?.value || '';
  };

  const textType = getControlDefault('text_type') || 'general_text';
  const textCompleteness = getControlDefault('text_completeness') || 'complete';
  const evaluationGoal = getControlDefault('evaluation_goal') || 'overall_check';

  return createDefaultEvaluationInput({
    textType: textType as EvaluationInput['textType'],
    textCompleteness: textCompleteness as EvaluationInput['textCompleteness'],
    evaluationGoal: evaluationGoal as EvaluationInput['evaluationGoal'],
  });
}
