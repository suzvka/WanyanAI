import 'server-only';

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const promptBlocksDir = path.join(process.cwd(), 'ops-config', 'prompt-blocks');

export type PromptBlock = {
  fileName: string;
  title: string;
  body: string;
};

type PromptBlockDirEntry = {
  isFile: () => boolean;
  name: string;
};

function parsePromptBlock(fileName: string, content: string): PromptBlock | null {
  const normalized = content.replace(/^\uFEFF/, '');
  if (!normalized.trim()) {
    return null;
  }

  const [rawTitle = '', ...bodyLines] = normalized.split(/\r?\n/);
  const title = rawTitle.trim();

  if (!title) {
    console.warn(`Skipping prompt block without title: ${fileName}`);
    return null;
  }

  return {
    fileName,
    title,
    body: bodyLines.join('\n').replace(/^\n+/, ''),
  };
}

export async function loadPromptBlocks(): Promise<PromptBlock[]> {
  try {
    const entries = (await readdir(promptBlocksDir, { withFileTypes: true })) as PromptBlockDirEntry[];
    const fileNames = entries
      .filter((entry: PromptBlockDirEntry) => entry.isFile() && entry.name.toLowerCase().endsWith('.md'))
      .map((entry: PromptBlockDirEntry) => entry.name)
      .sort((left: string, right: string) => left.localeCompare(right, 'en'));

    const blocks = await Promise.all(
      fileNames.map(async (fileName: string) => {
        try {
          const content = await readFile(path.join(promptBlocksDir, fileName), 'utf-8');
          return parsePromptBlock(fileName, content);
        } catch (error) {
          console.warn(`Skipping unreadable prompt block: ${fileName}`, error);
          return null;
        }
      }),
    );

    return blocks.filter((block: PromptBlock | null): block is PromptBlock => block !== null);
  } catch (error) {
    console.error('Failed to read prompt blocks directory:', error);
    return [];
  }
}

export async function composeSystemPromptFromBlocks(): Promise<string> {
  const blocks = await loadPromptBlocks();

  return blocks
    .map((block) => (block.body ? `# ${block.title}\n\n${block.body}` : `# ${block.title}`))
    .join('\n\n');
}
