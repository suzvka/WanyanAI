import 'server-only';

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { getCachedOpsConfig, setCachedOpsConfig } from './cache';
import { createFallbackOpsConfig } from './fallback';
import {
  evaluationCatalogSchema,
  evaluationDefaultsSchema,
  featureFlagsSchema,
  manifestSchema,
  siteSchema,
  validatePublishedOpsConfig,
} from './schemas';

const publishedConfigDir = path.join(process.cwd(), 'ops-config', 'published');

async function readJsonFile<T>(fileName: string): Promise<T> {
  const content = await readFile(path.join(publishedConfigDir, fileName), 'utf-8');
  return JSON.parse(content) as T;
}

export async function getPublishedOpsConfig() {
  const cached = getCachedOpsConfig();
  if (cached) {
    return cached;
  }

  try {
    const [manifest, site, catalog, defaults, featureFlags] = await Promise.all([
      readJsonFile('manifest.json'),
      readJsonFile('site.json'),
      readJsonFile('evaluation-catalog.json'),
      readJsonFile('evaluation-defaults.json'),
      readJsonFile('feature-flags.json'),
    ]);

    const config = validatePublishedOpsConfig({
      manifest: manifestSchema.parse(manifest),
      site: siteSchema.parse(site),
      catalog: evaluationCatalogSchema.parse(catalog),
      defaults: evaluationDefaultsSchema.parse(defaults),
      featureFlags: featureFlagsSchema.parse(featureFlags),
    });

    return setCachedOpsConfig(config);
  } catch (error) {
    console.error('Failed to load published operations config:', error);
    return setCachedOpsConfig(createFallbackOpsConfig());
  }
}
