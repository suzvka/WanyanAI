/**
 * FileConfigStore
 *
 * 将配置写入 runtime-config/<key>.json 文件。
 * 适用于开发环境 / 沙箱环境。
 *
 * 注意：Coze 生产环境禁止写入部署包，请使用 CozeDbConfigStore。
 */

import 'server-only';

import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import type { ConfigStore } from './types';
import { createLogger } from '@/lib/api-station/logger';
import { loadEnv } from 'yunzone-service-kit/config';
import { envSchema, envLoadOptions } from '@/lib/env-schema';

const logger = createLogger('ConfigStore:File');

const CONFIG_DIR = 'runtime-config';

export class FileConfigStore implements ConfigStore {
  private configDir: string;

  constructor(baseDir?: string) {
    // TICKET-001：工作区路径经中立键读取（COZE_WORKSPACE_PATH 由适配层回退）
    const root = baseDir ?? loadEnv(envSchema, envLoadOptions).WORKSPACE_PATH ?? process.cwd();
    this.configDir = path.join(root, CONFIG_DIR);
    this.ensureDir();
  }

  private ensureDir(): void {
    if (!existsSync(this.configDir)) {
      mkdirSync(this.configDir, { recursive: true });
      logger.info('配置目录已创建', { configDir: this.configDir });
    }
  }

  private resolvePath(key: string): string {
    // 防止路径穿越
    const safeKey = key.replace(/\.\./g, '_').replace(/\//g, '__');
    return path.join(this.configDir, `${safeKey}.json`);
  }

  async get(key: string): Promise<string | null> {
    try {
      const filePath = this.resolvePath(key);
      if (!existsSync(filePath)) return null;
      const content = readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(content);
      return parsed.value ?? null;
    } catch (error) {
      logger.error('读取配置失败', error, { key });
      return null;
    }
  }

  async set(key: string, value: string): Promise<void> {
    try {
      const filePath = this.resolvePath(key);
      writeFileSync(filePath, JSON.stringify({ key, value, updatedAt: new Date().toISOString() }, null, 2), 'utf-8');
      logger.info('配置已写入', { key });
    } catch (error) {
      logger.error('写入配置失败', error, { key });
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    try {
      const filePath = this.resolvePath(key);
      if (existsSync(filePath)) {
        unlinkSync(filePath);
        logger.info('配置已删除', { key });
      }
    } catch (error) {
      logger.error('删除配置失败', error, { key });
    }
  }

  async list(prefix: string): Promise<{ key: string; value: string }[]> {
    try {
      this.ensureDir();
      const files = readdirSync(this.configDir);
      const results: { key: string; value: string }[] = [];

      for (const file of files) {
        if (!file.endsWith('.json')) continue;

        // 从文件名还原 key（__ → /, 去掉 .json）
        const fileKey = file.slice(0, -5).replace(/__/g, '/');
        if (!fileKey.startsWith(prefix)) continue;

        try {
          const content = readFileSync(path.join(this.configDir, file), 'utf-8');
          const parsed = JSON.parse(content);
          results.push({ key: fileKey, value: parsed.value ?? '' });
        } catch {
          // 跳过损坏的文件
        }
      }

      return results;
    } catch (error) {
      logger.error('列出配置失败', error, { prefix });
      return [];
    }
  }
}