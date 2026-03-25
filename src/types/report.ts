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

export type TextBlockType = 'actual_text' | 'reference_material' | 'reference_review';

export type TextBlockAttachmentSource = 'upload';

export type TextBlockFileRef = {
  id: string;
  originalName: string;
  storedName: string;
  mimeType: string;
  size: number;
  lastModified: number;
  source: TextBlockAttachmentSource;
};

export type TextBlockAttachment = TextBlockFileRef & {
  content: string;
};

export type TextBlockContentUnit = {
  draftText: string;
  file: TextBlockAttachment | null;
};

export type TextBlockSupplement = TextBlockContentUnit & {
  id: string;
};

export type TextBlock = TextBlockContentUnit & {
  id: string;
  number: number;
  blockType: TextBlockType;
  title: string;
  localSupplements: TextBlockSupplement[];
};

export type SerializableTextBlockSupplement = {
  id: string;
  content: SerializableTextBlockContent | null;
};

export type SerializableTextBlockContent =
  | {
      kind: 'text';
      content: string;
    }
  | {
      kind: 'file';
      fileName: string;
      content: string;
    };

export type SerializableTextBlock = {
  id: string;
  number: number;
  blockType: TextBlockType;
  title: string;
  content: SerializableTextBlockContent | null;
  localSupplements: SerializableTextBlockSupplement[];
};

export type SerializableEvaluationMetadataFile = {
  id: string;
  blockId: string;
  parentBlockId?: string;
  originalName: string;
  storedName: string;
  mimeType: string;
  size: number;
  lastModified: number;
  source: TextBlockAttachmentSource;
};

export type EvaluationInput = {
  textBlocks: TextBlock[];
  globalSupplementBlocks: TextBlock[];
  textType: TextType;
  textCompleteness: TextCompleteness;
  evaluationGoal: EvaluationGoal;
  readerPreference?: ReaderPreference;
  feedbackStyle?: FeedbackStyle;
  specialConstraints?: SpecialConstraint[];
};

export type SerializableEvaluationInput = Omit<EvaluationInput, 'textBlocks' | 'globalSupplementBlocks'> & {
  blocks: SerializableTextBlock[];
  globalSupplements: SerializableTextBlock[];
  metadata: {
    files: SerializableEvaluationMetadataFile[];
  };
};
