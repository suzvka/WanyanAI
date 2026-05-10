/**
 * 服务端输出模式注册清单
 *
 * 与 features/output-modes/manifest.ts（客户端渲染器清单）职责分离：
 * - 本文件负责服务端模块注册（register 函数）
 * - features/output-modes/manifest.ts 负责客户端渲染器注册（React 组件）
 */

import 'server-only';

import type { OutputModeRegistry as IOutputModeRegistry } from './types';

import { register as registerLiteraryReview } from '@/features/output-modes/literary-review/module';
import { register as registerGaokaoEssay } from '@/features/output-modes/gaokao-essay/module';

type ServerOutputModeEntry = {
  id: string;
  register: (registry: IOutputModeRegistry) => void;
};

const SERVER_OUTPUT_MODE_MANIFEST: ServerOutputModeEntry[] = [
  { id: 'literary-review', register: registerLiteraryReview },
  { id: 'gaokao-essay', register: registerGaokaoEssay },
];

export function registerBuiltinOutputModes(registry: IOutputModeRegistry): void {
  for (const entry of SERVER_OUTPUT_MODE_MANIFEST) {
    entry.register(registry);
  }
}

export function getServerOutputModeManifestIds(): string[] {
  return SERVER_OUTPUT_MODE_MANIFEST.map((entry) => entry.id);
}
