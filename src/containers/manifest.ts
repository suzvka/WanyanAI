import type { TextBlocksContainerParams } from '@/types/module';

export type BuiltInContainerManifestItem = {
  type: string;
  defaultParams?: Record<string, unknown>;
};

const TEXT_BLOCKS_DEFAULT_PARAMS: Partial<TextBlocksContainerParams> = {
  defaultExpanded: false,
  initialBlockCount: 0,
};

const BUILT_IN_CONTAINER_MANIFEST: BuiltInContainerManifestItem[] = [
  {
    type: 'analysis-controls',
  },
  {
    type: 'text-blocks',
    defaultParams: TEXT_BLOCKS_DEFAULT_PARAMS as Record<string, unknown>,
  },
];

export function getBuiltInContainerManifest(): BuiltInContainerManifestItem[] {
  return BUILT_IN_CONTAINER_MANIFEST;
}

export function getBuiltInContainerTypes(): string[] {
  return BUILT_IN_CONTAINER_MANIFEST.map((item) => item.type);
}
