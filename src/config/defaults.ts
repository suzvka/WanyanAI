import { EvaluationInput } from '@/types/report';

export function createDefaultEvaluationInput(): EvaluationInput {
  return {
    textContent: '',
    textType: 'general_text',
    textCompleteness: 'excerpt',
    evaluationGoal: 'overall_check',
    readerPreference: 'general_reader',
    feedbackStyle: 'balanced',
    hasReferenceSample: false,
    specialConstraints: [],
  };
}

export const defaultEvaluationInput: EvaluationInput = createDefaultEvaluationInput();
