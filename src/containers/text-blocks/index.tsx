'use client';

import type { ContainerComponentProps } from '@/containers/registry';
import type { TextBlocksContainerParams } from '@/types/module';
import type { TextBlocksContainerData } from '@/types/container-data';
import TextBlocksEditor from '@/features/text-blocks/components/TextBlocksEditor';
import { usePlatformContext } from '@/providers/PlatformContext';

/**
 * text-blocks 容器组件
 *
 * 纯展示组件，通过 props 接收数据和回调。
 * 使用泛型化的 ContainerComponentProps，数据类型为 TextBlocksContainerData。
 * 
 * 文本块初始化已移至父组件 EvaluateClient 的 useState 初始值中，
 * 此处不再需要 useEffect 初始化逻辑。
 */
export default function TextBlocksContainer({
  config,
  data,
  onDataChange,
}: ContainerComponentProps<TextBlocksContainerParams, TextBlocksContainerData>) {
  const { params } = config;
  const {
    id,
    title,
    subtitle,
    defaultExpanded = false,
    maxBlockCount,
  } = params;

  const { featureFlags } = usePlatformContext();

  // 从 data 中提取文本块（提供默认值）
  // 初始化已在父组件完成，此处直接使用
  const textBlocks = data?.textBlocks || [];

  // 处理文本块变化，封装为容器数据格式
  const handleTextBlocksChange = (blocks: typeof textBlocks) => {
    onDataChange?.({ textBlocks: blocks });
  };

  return (
    <TextBlocksEditor
      title={title || id}
      subtitle={subtitle}
      textBlocks={textBlocks}
      enableFileUpload={featureFlags.enableFileUpload}
      enableAnnotations={featureFlags.enableAnnotations}
      defaultExpanded={defaultExpanded}
      maxBlockCount={maxBlockCount}
      onTextBlocksChange={handleTextBlocksChange}
    />
  );
}
