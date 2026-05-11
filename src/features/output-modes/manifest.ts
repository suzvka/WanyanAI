import type { ComponentType } from 'react';
import type { RendererProps } from './renderer';
import { LiteraryReviewRenderer } from './literary-review/renderer';
import { GaokaoEssayRenderer } from './gaokao-essay/renderer';

export type OutputModeRendererComponent = ComponentType<RendererProps<unknown>>;

export type OutputModeManifestItem = {
  id: string;
  renderer: OutputModeRendererComponent;
};

export const OUTPUT_MODE_MANIFEST: OutputModeManifestItem[] = [
  {
    id: 'literary-review',
    renderer: LiteraryReviewRenderer as OutputModeRendererComponent,
  },
  {
    id: 'gaokao-essay',
    renderer: GaokaoEssayRenderer as OutputModeRendererComponent,
  },
];

export function getOutputModeManifest(): OutputModeManifestItem[] {
  return OUTPUT_MODE_MANIFEST;
}
