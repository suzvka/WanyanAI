import { EvaluationInput } from '@/types/report';

export type EvaluationInputDefaults = Pick<EvaluationInput, 'textType' | 'textCompleteness' | 'evaluationGoal'>;

export function createDefaultEvaluationInput(defaults: EvaluationInputDefaults): EvaluationInput {
  return {
    textBlocks: [
      {
        id: 'block-1',
        number: 1,
        blockType: 'actual_text',
        title: '文本1',
        content: null,
        annotations: [],
      },
    ],
    textType: defaults.textType,
    textCompleteness: defaults.textCompleteness,
    evaluationGoal: defaults.evaluationGoal,
  };
}
