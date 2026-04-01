/**
 * 容器数据类型定义
 *
 * 每个容器类型定义自己的数据结构，
 * 通过泛型与 ContainerSharedProps 结合实现类型安全。
 *
 * 扩展指南：
 * 1. 在此文件中定义新的容器数据类型
 * 2. 创建对应的容器组件，使用泛型约束
 * 3. 在容器注册表中注册新类型
 * 4. 在 EvaluateClient 初始化逻辑中添加默认值
 */

import type { TextBlock } from './report';

/**
 * 容器数据载荷基类（通用）
 *
 * 所有容器数据都必须是可序列化的对象
 */
export type ContainerDataPayload = Record<string, unknown>;

/**
 * text-blocks 容器数据
 */
export type TextBlocksContainerData = {
  textBlocks: TextBlock[];
};

/**
 * 图片上传容器数据（预留扩展）
 */
export type ImageUploaderContainerData = {
  images: Array<{
    id: string;
    url: string;
    caption?: string;
  }>;
};

/**
 * 选择题容器数据（预留扩展）
 */
export type ChoiceQuestionContainerData = {
  question: string;
  options: string[];
  selectedOption?: string;
};

/**
 * 评分容器数据（预留扩展）
 */
export type RatingContainerData = {
  value: number;
  maxValue: number;
  comment?: string;
};
