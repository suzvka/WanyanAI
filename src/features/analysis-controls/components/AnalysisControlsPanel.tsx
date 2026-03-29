'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import CollapsiblePanel from '@/components/ui/collapsible-panel';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sparkles } from 'lucide-react';
import type { AnalysisControlConfig, AnalysisControlGroupConfig } from '@/server/config/types';

type AnalysisControlsPanelProps = {
  title?: string;
  description?: string;
  groups?: AnalysisControlGroupConfig[];
  controls: AnalysisControlConfig[];
  controlSelections: Record<string, string>;
  isSubmitting: boolean;
  emptyStateMessage?: string;
  onControlChange: (controlId: string, value: string) => void;
};

export default function AnalysisControlsPanel({
  title = '分析设置',
  description,
  groups,
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
      <div className="space-y-6">
        {groups && groups.length > 0 ? (
          <div className="space-y-6">
            {groups.map((group, groupIndex) => (
              <div key={group.id} className="space-y-4 rounded-lg border border-[color:var(--report-border)] bg-[color:var(--report-surface)] p-4 sm:p-5">
                <div className="space-y-1">
                  <h3 className="text-base font-semibold text-[color:var(--report-text-heading)]">{group.title}</h3>
                  {group.description ? <p className="text-sm text-[color:var(--report-text-subtle)]">{group.description}</p> : null}
                </div>

                <div className="space-y-4 pl-1 sm:pl-2">
                  {group.controls.map((control) => (
                    <div key={control.id} className="space-y-3">
                      <Label className="text-base font-medium">{control.title}</Label>
                      <Select
                        value={controlSelections[control.id]}
                        onValueChange={(value: string) => onControlChange(control.id, value)}
                        disabled={isSubmitting}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {control.options.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>

                {groupIndex < groups.length - 1 && <div className="border-t border-[color:var(--report-border)] pt-2" />}
              </div>
            ))}
          </div>
        ) : controls.length > 0 ? (
          controls.map((control) => (
            <div key={control.id} className="space-y-3">
              <Label className="text-base font-medium">{control.title}</Label>
              <Select
                value={controlSelections[control.id]}
                onValueChange={(value: string) => onControlChange(control.id, value)}
                disabled={isSubmitting}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {control.options.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))
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
