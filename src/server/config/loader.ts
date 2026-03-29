import 'server-only';

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { getCachedOpsConfig, setCachedOpsConfig } from './cache';
import { createFallbackOpsConfig } from './fallback';
import {
  analysisControlsSchema,
  appearanceSchema,
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
    const [manifest, site, featureFlags, analysisControls, appearance] = await Promise.all([
      readJsonFile('manifest.json'),
      readJsonFile('site.json'),
      readJsonFile('feature-flags.json'),
      readJsonFile('analysis-controls.json'),
      readJsonFile('appearance.json'),
    ]);

    const config = validatePublishedOpsConfig({
      manifest: manifestSchema.parse(manifest),
      site: siteSchema.parse(site),
      featureFlags: featureFlagsSchema.parse(featureFlags),
      analysisControls: analysisControlsSchema.parse(analysisControls),
      appearance: appearanceSchema.parse(appearance),
    });

    return setCachedOpsConfig(config);
  } catch (error) {
    console.error('Failed to load published operations config:', error);
    return setCachedOpsConfig(createFallbackOpsConfig());
  }
}
