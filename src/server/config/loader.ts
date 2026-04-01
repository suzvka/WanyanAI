import 'server-only';

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { getCachedPlatformConfig, setCachedPlatformConfig } from './cache';
import { createFallbackPlatformConfig } from './fallback';
import { validatePlatformConfig, platformManifestSchema, appearanceSchema, featureFlagsSchema } from './schemas';

const configDir = path.join(process.cwd(), 'ops-config');

async function readJsonFile<T>(fileName: string): Promise<T> {
  const content = await readFile(path.join(configDir, fileName), 'utf-8');
  return JSON.parse(content) as T;
}

/**
 * 获取平台配置
 */
export async function getPlatformConfig() {
  const cached = getCachedPlatformConfig();
  if (cached) {
    return cached;
  }

  try {
    const [manifest, appearance, featureFlags] = await Promise.all([
      readJsonFile('manifest.json'),
      readJsonFile('appearance.json'),
      readJsonFile('feature-flags.json'),
    ]);

    const config = validatePlatformConfig({
      manifest: platformManifestSchema.parse(manifest),
      appearance: appearanceSchema.parse(appearance),
      featureFlags: featureFlagsSchema.parse(featureFlags),
    });

    return setCachedPlatformConfig(config);
  } catch {
    return setCachedPlatformConfig(createFallbackPlatformConfig());
  }
}
