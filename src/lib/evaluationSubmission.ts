import {
  EvaluationInput,
  SerializableEvaluationInput,
  SerializableEvaluationMetadataFile,
  SerializableTextBlock,
  SerializableTextBlockContent,
  SerializableTextBlockSupplement,
  TextBlock,
  TextBlockContentUnit,
} from '@/types/report';

export type PreparedEvaluationSubmission = {
  submissionData: SerializableEvaluationInput;
};

type PreparedContentUnit = {
  content: SerializableTextBlockContent | null;
  metadataFile: SerializableEvaluationMetadataFile | null;
};

function prepareContentUnit(
  unit: TextBlockContentUnit,
  options: Pick<SerializableEvaluationMetadataFile, 'blockId' | 'parentBlockId'>,
): PreparedContentUnit {
  if (unit.file) {
    return {
      content: {
        kind: 'file',
        fileName: unit.file.storedName,
        content: unit.file.content,
      },
      metadataFile: {
        id: unit.file.id,
        blockId: options.blockId,
        parentBlockId: options.parentBlockId,
        originalName: unit.file.originalName,
        storedName: unit.file.storedName,
        mimeType: unit.file.mimeType,
        size: unit.file.size,
        lastModified: unit.file.lastModified,
        source: unit.file.source,
      },
    };
  }

  if (!unit.draftText.trim()) {
    return {
      content: null,
      metadataFile: null,
    };
  }

  return {
    content: {
      kind: 'text',
      content: unit.draftText,
    },
    metadataFile: null,
  };
}

function prepareTextBlock(
  block: TextBlock,
): { serializableBlock: SerializableTextBlock; metadataFiles: SerializableEvaluationMetadataFile[] } {
  const blockUnit = prepareContentUnit(block, {
    blockId: block.id,
  });

  const supplementResults = block.localSupplements.map((supplement) =>
    prepareContentUnit(supplement, {
      blockId: supplement.id,
      parentBlockId: block.id,
    }),
  );

  const localSupplements: SerializableTextBlockSupplement[] = supplementResults.map((result, index) => ({
    id: block.localSupplements[index].id,
    content: result.content,
  }));

  return {
    serializableBlock: {
      id: block.id,
      number: block.number,
      blockType: block.blockType,
      title: block.title,
      content: blockUnit.content,
      localSupplements,
    },
    metadataFiles: [blockUnit.metadataFile, ...supplementResults.map((result) => result.metadataFile)].filter(
      (file): file is SerializableEvaluationMetadataFile => file !== null,
    ),
  };
}

export function prepareEvaluationSubmission(input: EvaluationInput): PreparedEvaluationSubmission {
  const mainBlocks = input.textBlocks.map((block) => prepareTextBlock(block));
  const globalBlocks = input.globalSupplementBlocks.map((block) => prepareTextBlock(block));

  const submissionData: SerializableEvaluationInput = {
    blocks: mainBlocks.map((item) => item.serializableBlock),
    globalSupplements: globalBlocks.map((item) => item.serializableBlock),
    metadata: {
      files: [...mainBlocks, ...globalBlocks].flatMap((item) => item.metadataFiles),
    },
    textType: input.textType,
    textCompleteness: input.textCompleteness,
    evaluationGoal: input.evaluationGoal,
    readerPreference: input.readerPreference,
    feedbackStyle: input.feedbackStyle,
    specialConstraints: input.specialConstraints,
  };

  return {
    submissionData,
  };
}
