import 'server-only';

import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const promptBlocksDir = path.join(process.cwd(), 'ops-config', 'prompt-blocks');

/**
 * 获取所有提示词块文件名（排序后）
 */
async function getPromptBlockFiles(): Promise<string[]> {
  try {
    const files = await readdir(promptBlocksDir);
    // 只取 .md 文件，按文件名排序
    return files
      .filter(file => file.endsWith('.md'))
      .sort();
  } catch {
    return [];
  }
}

/**
 * 读取单个提示词块内容
 */
async function readPromptBlock(fileName: string): Promise<string> {
  const filePath = path.join(promptBlocksDir, fileName);
  const content = await readFile(filePath, 'utf-8');
  return content.trim();
}

/**
 * 从提示词块目录组合系统提示词
 * 
 * 按文件名顺序读取并拼接所有 .md 文件内容
 */
export async function composeSystemPromptFromBlocks(): Promise<string> {
  const files = await getPromptBlockFiles();
  
  if (files.length === 0) {
    return '';
  }

  const blocks = await Promise.all(
    files.map(async (file) => {
      const content = await readPromptBlock(file);
      return content;
    })
  );

  // 过滤空内容，用双换行拼接
  return blocks
    .filter(Boolean)
    .join('\n\n');
}
