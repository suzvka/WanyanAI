import { EvaluationInput } from '@/types/report';

export type EvaluationInputDefaults = Pick<EvaluationInput, 'textType' | 'textCompleteness' | 'evaluationGoal'>;

export function createDefaultEvaluationInput(overrides: Partial<EvaluationInputDefaults> = {}): EvaluationInput {
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
    textType: overrides.textType ?? 'general_text',
    textCompleteness: overrides.textCompleteness ?? 'excerpt',
    evaluationGoal: overrides.evaluationGoal ?? 'overall_check',
  };
}

export const defaultEvaluationInput: EvaluationInput = createDefaultEvaluationInput();
