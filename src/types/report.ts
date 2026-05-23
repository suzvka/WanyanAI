import type { ReportRating } from '@/config/reportScoring';

export type AnalysisReport = {
  schemaVersion: string;
  reportId: string;
  reportVersion: string;
  generatedAt: string;
  summary: ReportSummary;
  dashboard: ReportDashboard;
  conclusion: ReportConclusion;
  meta: ReportMeta;
  groups: ReportSectionGroup[];
  sections: ReportSection[];
  diagnostics: ReportNormalizationDiagnostics;
};

export type ReportSection = {
  id: string;
  title: string;
  body: string;
  groupId?: string;
  groupTitle?: string;
};

export type ReportSectionGroup = {
  id: string;
  title: string;
  sections: ReportSection[];
};

export type ReportNormalizationDiagnostics = {
  normalizationMode: 'paragraph-sections';
  sectionCount: number;
};

export type ReportSummary = {
  title: string;
  overview: string;
};

export type ReportSubscoreNature = 'internal' | 'internal_relational_boundary';

export type ReportSubscore = {
  id: string;
  label: string;
  grade: ReportRating;
  score: number;
  rationale: string;
  keyQuestion?: string;
  nature?: ReportSubscoreNature;
};

export type ReportDashboard = {
  totalScore: number;
  grade: ReportRating;
  subscores: ReportSubscore[];
};

export type ReportConclusion = {
  rationale: string;
};

export type ReportMeta = {
  frameworkVersion: string;
  scoringPolicyVersion: string;
  conclusionPolicyVersion: string;
  provider: string;
  model: string;
};

export type TextBlockType = string;

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

/**
 * 文本块
 * 
 * 文本块是纯数据载体，不携带归属信息。
 * 归属关系由外层容器决定（通过数组位置或容器 id 关联）。
 */
export type TextBlock = {
  id: string;
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

/**
 * 容器数据（用于序列化和模型渲染）
 */
export type ContainerData = {
  /** 容器唯一标识 */
  id: string;
  /** 容器标题 */
  title: string;
  /** 容器提示词（可选） */
  prompt?: string;
  /** 该容器下的文本块 */
  textBlocks: TextBlock[];
};

/**
 * 可序列化的容器数据
 */
export type SerializableContainerData = Omit<ContainerData, 'textBlocks'> & {
  textBlocks: SerializableTextBlock[];
};

export type EvaluationInput = {
  /** 所有文本块（扁平列表，保持向后兼容） */
  textBlocks: TextBlock[];
  /** 容器数据（按容器分组） */
  containers: ContainerData[];
};

export type SerializableEvaluationInput = Omit<EvaluationInput, 'textBlocks' | 'containers'> & {
  blocks: SerializableTextBlock[];
  containers: SerializableContainerData[];
  metadata: {
    files: SerializableEvaluationMetadataFile[];
  };
};
