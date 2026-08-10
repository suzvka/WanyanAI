/**
 * CozeDbConfigStore
 *
 * 将配置写入 Coze Supabase runtime_config 表。
 * 适用于 Coze 生产环境（部署包不可写）。
 *
 * 环境变量依赖：
 * - COZE_SUPABASE_URL / COZE_SUPABASE_ANON_KEY（Coze 平台自动注入）
 * - COZE_SUPABASE_SERVICE_ROLE_KEY（可选，服务端绕过 RLS）
 */

import 'server-only';

import type { ConfigStore } from './types';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { createLogger } from '@/lib/api-station/logger';

const logger = createLogger('ConfigStore:CozeDb');

const TABLE = 'runtime_config';

export class CozeDbConfigStore implements ConfigStore {
  async get(key: string): Promise<string | null> {
    try {
      const client = getSupabaseClient();
      const { data, error } = await client
        .from(TABLE)
        .select('value')
        .eq('key', key)
        .maybeSingle();

      if (error) {
        logger.error('数据库读取失败', error, { key });
        return null;
      }

      if (!data) return null;
      return JSON.stringify(data.value);
    } catch (error) {
      logger.error('CozeDbConfigStore.get 异常', error, { key });
      return null;
    }
  }

  async set(key: string, value: string): Promise<void> {
    try {
      let parsedValue: unknown;
      try {
        parsedValue = JSON.parse(value);
      } catch {
        parsedValue = value;
      }

      const client = getSupabaseClient();
      const { error } = await client
        .from(TABLE)
        .upsert(
          { key, value: parsedValue, updated_at: new Date().toISOString() },
          { onConflict: 'key' }
        );

      if (error) {
        throw new Error(`数据库写入失败: ${error.message}`);
      }

      logger.info('配置已写入数据库', { key });
    } catch (error) {
      logger.error('CozeDbConfigStore.set 失败', error, { key });
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    try {
      const client = getSupabaseClient();
      const { error } = await client
        .from(TABLE)
        .delete()
        .eq('key', key);

      if (error) {
        throw new Error(`数据库删除失败: ${error.message}`);
      }

      logger.info('配置已从数据库删除', { key });
    } catch (error) {
      logger.error('CozeDbConfigStore.delete 失败', error, { key });
    }
  }

  async list(prefix: string): Promise<{ key: string; value: string }[]> {
    try {
      const client = getSupabaseClient();
      const { data, error } = await client
        .from(TABLE)
        .select('key, value')
        .like('key', `${prefix}%`)
        .order('key', { ascending: true });

      if (error) {
        throw new Error(`数据库查询失败: ${error.message}`);
      }

      return (data ?? []).map(row => ({
        key: row.key as string,
        value: JSON.stringify(row.value),
      }));
    } catch (error) {
      logger.error('CozeDbConfigStore.list 失败', error, { prefix });
      return [];
    }
  }
}