'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import CollapsiblePanel from '@/components/ui/collapsible-panel';
import { Sparkles } from 'lucide-react';
import type { ControlConfig } from '@/types/module';
import { renderControl } from '@/features/controls/renderer';

type AnalysisControlsPanelProps = {
  title?: string;
  description?: string;
  controls: ControlConfig[];
  controlSelections: Record<string, string>;
  isSubmitting: boolean;
  emptyStateMessage?: string;
  onControlChange: (controlId: string, value: string) => void;
};

/**
 * 将控件配置转换为 renderControl 需要的 definition 格式
 */
function toDefinition(control: ControlConfig) {
  return {
    id: control.id,
    type: control.type,
    title: control.title,
    data: {
      options: control.options ?? [],
      promptText: (control as Record<string, unknown>).promptText as string | undefined,
      maxSelections: (control as Record<string, unknown>).maxSelections as number | undefined,
    },
  };
}

export default function AnalysisControlsPanel({
  title = '分析设置',
  description,
  controls,
  controlSelections,
  isSubmitting,
  emptyStateMessage = '当前没有可配置的动态检查项，本次分析将使用系统默认值。',
  onControlChange,
}: AnalysisControlsPanelProps) {
  return (
    <CollapsiblePanel
      title={title}
      subtitle={description}
      defaultExpanded={false}
    >
      <div className="space-y-3">
        {controls.length > 0 ? (
          <div className="space-y-3">
            {controls.map((control) => (
              <div key={control.id}>
                {renderControl(
                  toDefinition(control),
                  controlSelections[control.id] ?? '',
                  onControlChange,
                  isSubmitting,
                )}
              </div>
            ))}
          </div>
        ) : (
          <Alert>
            <Sparkles className="h-4 w-4" />
            <AlertTitle>当前无动态检查项</AlertTitle>
            <AlertDescription>{emptyStateMessage}</AlertDescription>
          </Alert>
        )}
      </div>
    </CollapsiblePanel>
  );
}
