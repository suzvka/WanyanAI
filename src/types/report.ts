export type AnalysisReport = {
  schemaVersion: string;
  reportId: string;
  reportVersion: string;
  generatedAt: string;
  summary: ReportSummary;
  dashboard: ReportDashboard;
  conclusion: ReportConclusion;
  meta: ReportMeta;
  sections: ReportSection[];
  diagnostics: ReportNormalizationDiagnostics;
};

export type ReportSection = {
  id: string;
  title: string;
  body: string;
};

export type ReportNormalizationDiagnostics = {
  normalizationMode: 'paragraph-sections';
  sectionCount: number;
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

export type TextContentSource = {
  kind: 'text';
  text: string;
};

export type FileContentSource = {
  kind: 'file';
  file: TextBlockAttachment;
};

export type ContentSource = TextContentSource | FileContentSource;

export type TextAnnotation = {
  id: string;
  content: ContentSource | null;
};

export type TextBlock = {
  id: string;
  number: number;
  blockType: TextBlockType;
  title: string;
  content: ContentSource | null;
  annotations: TextAnnotation[];
};

export type SerializableTextAnnotation = {
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
  annotations: SerializableTextAnnotation[];
};

export type SerializableEvaluationMetadataFile = {
  id: string;
  blockId: string;
  annotationId?: string;
  originalName: string;
  storedName: string;
  mimeType: string;
  size: number;
  lastModified: number;
  source: TextBlockAttachmentSource;
};

export type EvaluationInput = {
  textBlocks: TextBlock[];
  textType: TextType;
  textCompleteness: TextCompleteness;
  evaluationGoal: EvaluationGoal;
};

export type SerializableEvaluationInput = Omit<EvaluationInput, 'textBlocks'> & {
  blocks: SerializableTextBlock[];
  metadata: {
    files: SerializableEvaluationMetadataFile[];
  };
};
