import { EvaluationInput } from '@/types/report';

export type EvaluationInputDefaults = Pick<
  EvaluationInput,
  'textType' | 'textCompleteness' | 'evaluationGoal'
> &
  Partial<Pick<EvaluationInput, 'readerPreference' | 'feedbackStyle' | 'specialConstraints'>>;

export function createDefaultEvaluationInput(overrides: Partial<EvaluationInputDefaults> = {}): EvaluationInput {
  return {
    textBlocks: [
      {
        id: 'block-1',
        number: 1,
        blockType: 'actual_text',
        title: '文本1',
        draftText: '',
        file: null,
        localSupplements: [],
      },
    ],
    globalSupplementBlocks: [],
    textType: overrides.textType ?? 'general_text',
    textCompleteness: overrides.textCompleteness ?? 'excerpt',
    evaluationGoal: overrides.evaluationGoal ?? 'overall_check',
    readerPreference: overrides.readerPreference ?? 'general_reader',
    feedbackStyle: overrides.feedbackStyle ?? 'balanced',
    specialConstraints: overrides.specialConstraints ?? [],
  };
}

export const defaultEvaluationInput: EvaluationInput = createDefaultEvaluationInput();
