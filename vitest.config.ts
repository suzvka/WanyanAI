/**
 * vitest 配置 — 纯函数单测（评分/校验）
 *
 * 仅解析 @/ 路径别名（与 tsconfig paths 对齐），无浏览器环境需求。
 */
import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(dirname, 'src'),
    },
  },
});
