import {
  ContentSource,
  EvaluationInput,
  SerializableEvaluationInput,
  SerializableEvaluationMetadataFile,
  SerializableTextAnnotation,
  SerializableTextBlock,
  SerializableTextBlockContent,
  TextBlock,
} from '@/types/report';

export type PreparedEvaluationSubmission = {
  submissionData: SerializableEvaluationInput;
};

type PreparedContentUnit = {
  content: SerializableTextBlockContent | null;
  metadataFile: SerializableEvaluationMetadataFile | null;
};

function prepareContentUnit(
  content: ContentSource | null,
  options: Pick<SerializableEvaluationMetadataFile, 'blockId' | 'annotationId'>,
): PreparedContentUnit {
  if (!content) {
    return {
      content: null,
      metadataFile: null,
    };
  }

  if (content.kind === 'file') {
    return {
      content: {
        kind: 'file',
        fileName: content.file.storedName,
        content: content.file.content,
      },
      metadataFile: {
        id: content.file.id,
        blockId: options.blockId,
        annotationId: options.annotationId,
        originalName: content.file.originalName,
        storedName: content.file.storedName,
        mimeType: content.file.mimeType,
        size: content.file.size,
        lastModified: content.file.lastModified,
        source: content.file.source,
      },
    };
  }

  if (!content.text.trim()) {
    return {
      content: null,
      metadataFile: null,
    };
  }

  return {
    content: {
      kind: 'text',
      content: content.text,
    },
    metadataFile: null,
  };
}

function prepareTextBlock(
  block: TextBlock,
): { serializableBlock: SerializableTextBlock; metadataFiles: SerializableEvaluationMetadataFile[] } {
  const blockUnit = prepareContentUnit(block.content, {
    blockId: block.id,
  });

  const annotationResults = block.annotations.map((annotation) =>
    prepareContentUnit(annotation.content, {
      blockId: block.id,
      annotationId: annotation.id,
    }),
  );

  const annotations: SerializableTextAnnotation[] = annotationResults.map((result, index) => ({
    id: block.annotations[index].id,
    content: result.content,
  }));

  return {
    serializableBlock: {
      id: block.id,
      number: block.number,
      blockType: block.blockType,
      title: block.title,
      content: blockUnit.content,
      annotations,
    },
    metadataFiles: [blockUnit.metadataFile, ...annotationResults.map((result) => result.metadataFile)].filter(
      (file): file is SerializableEvaluationMetadataFile => file !== null,
    ),
  };
}

export function prepareEvaluationSubmission(input: EvaluationInput): PreparedEvaluationSubmission {
  const blocks = input.textBlocks.map((block) => prepareTextBlock(block));

  const submissionData: SerializableEvaluationInput = {
    blocks: blocks.map((item) => item.serializableBlock),
    metadata: {
      files: blocks.flatMap((item) => item.metadataFiles),
    },
    textType: input.textType,
    textCompleteness: input.textCompleteness,
    evaluationGoal: input.evaluationGoal,
  };

  return {
    submissionData,
  };
}
