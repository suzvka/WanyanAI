export type AnalysisReport = {
  reportId: string;
  reportVersion: string;
  generatedAt: string;
  summary: ReportSummary;
  dashboard: ReportDashboard;
  dimensions: DimensionScore[];
  keyIssues: KeyIssue[];
  conclusion: ReportConclusion;
  meta: ReportMeta;
};

export type ReportSummary = {
  title: string;
  overview: string;
};

export type ReportDashboard = {
  totalScore: number;
  grade: string;
  publishReadiness: string;
};

export type DimensionScore = {
  dimensionKey: string;
  dimensionName: string;
  score: number;
  grade: string;
  strengths: string[];
  weaknesses: string[];
};

export type KeyIssue = {
  id: string;
  title: string;
  severity: "high" | "medium" | "low";
  description: string;
  suggestionDirection: string;
};

export type ReportConclusion = {
  finalRecommendation: "publish" | "revise_then_publish" | "rework";
  rationale: string;
};

export type ReportMeta = {
  frameworkVersion: string;
  scoringPolicyVersion: string;
  conclusionPolicyVersion: string;
  provider: string;
  model: string;
};

export type TextType = 
  | "web_serial" 
  | "short_story" 
  | "light_novel" 
  | "literary_submission" 
  | "general_text";

export type TextCompleteness = 
  | "complete" 
  | "single_chapter" 
  | "first_chapters" 
  | "excerpt" 
  | "draft";

export type EvaluationGoal = 
  | "overall_check" 
  | "opening_attraction" 
  | "rhythm_progression" 
  | "character_development" 
  | "style_consistency" 
  | "structure_completeness" 
  | "reader_acceptance";

export type ReaderPreference = 
  | "fast_paced" 
  | "plot_driven" 
  | "character_emotion" 
  | "world_building" 
  | "literary_expression" 
  | "general_reader";

export type FeedbackStyle = 
  | "strict" 
  | "balanced" 
  | "encouraging";

export type SpecialConstraint = 
  | "keep_original_style" 
  | "avoid_overwriting" 
  | "focus_publishability" 
  | "focus_literary_expression";

export type EvaluationInput = {
  textContent: string;
  textType: TextType;
  textCompleteness: TextCompleteness;
  evaluationGoal: EvaluationGoal;
  readerPreference?: ReaderPreference;
  feedbackStyle?: FeedbackStyle;
  hasReferenceSample?: boolean;
  specialConstraints?: SpecialConstraint[];
};
