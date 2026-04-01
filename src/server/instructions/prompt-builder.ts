import 'server-only';

import { composeSystemPromptFromBlocks } from '@/server/promptBlocks/loader';
import { getOutputModePrompt } from '@/features/output-modes';
import { compileDynamicInstructions } from './compile';
import type { CompileInstructionsRequest } from '@/types/instructions';

export type BuildSystemPromptOptions = {
  /** 模块 ID */
  moduleId: string;
  /** 输出模式 ID */
  outputMode: string;
  /** 用户选择的分析控制项 */
  controlSelections: Record<string, string>;
};

export type BuiltSystemPrompt = {
  /** 完整的系统提示词 */
  systemPrompt: string;
  /** 解析后的选择项 */
  resolvedSelections: Record<string, string>;
  /** 配置版本（模块 ID） */
  configVersion: string;
};

/**
 * 构建完整的系统提示词
 * 
 * 拼接顺序：
 * 1. prompt-blocks 目录下的静态提示词（按文件名排序）
 * 2. 输出格式规定（来自输出模式）
 * 3. 动态指令（根据用户选择编译）
 */
export async function buildSystemPrompt(
  options: BuildSystemPromptOptions,
): Promise<BuiltSystemPrompt> {
  const { moduleId, outputMode, controlSelections } = options;
  const parts: string[] = [];

  // 1. 读取 prompt-blocks 目录下的静态提示词
  const staticBlocks = await composeSystemPromptFromBlocks();
  if (staticBlocks.trim()) {
    parts.push(`---系统提示词---\n${staticBlocks}`);
  }

  // 2. 获取输出格式提示词
  const outputFormatPrompt = getOutputModePrompt(outputMode);
  if (outputFormatPrompt) {
    parts.push(outputFormatPrompt);
  }

  // 3. 编译动态指令
  const compileRequest: CompileInstructionsRequest = {
    configVersion: moduleId,
    controlSelections,
  };
  const { instructionText, resolvedSelections, configVersion } = 
    await compileDynamicInstructions(compileRequest);

  if (instructionText.trim()) {
    parts.push(`---分析指令---\n${instructionText}`);
  }

  // 拼接所有部分
  const systemPrompt = parts.join('\n\n');

  return {
    systemPrompt,
    resolvedSelections,
    configVersion,
  };
}
