import type { ModelConfig } from '@/types/modelConfig';

function hashString(value: string): string {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(16);
}

export function createSchedulerKey(modelConfig: ModelConfig): string {
  return `task-${hashString(`${modelConfig.baseUrl}::${modelConfig.selectedModel}::${modelConfig.apiKey}`)}`;
}
