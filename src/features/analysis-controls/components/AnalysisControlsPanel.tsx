'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import CollapsiblePanel from '@/components/ui/collapsible-panel';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sparkles } from 'lucide-react';
import type { AnalysisControlConfig, AnalysisControlGroupConfig } from '@/server/config/types';

/** 下拉菜单固定宽度 */
const SELECT_FIXED_WIDTH = '200px';

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

type ControlRowProps = {
  control: AnalysisControlConfig;
  selectedValue?: string;
  isSubmitting: boolean;
  onControlChange: (controlId: string, value: string) => void;
};

function ControlRow({
  control,
  selectedValue,
  isSubmitting,
  onControlChange,
}: ControlRowProps) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="flex-1 text-sm text-[color:var(--report-text-heading)]">
        {control.title}
      </span>
      <Select
        value={selectedValue}
        onValueChange={(value: string) => onControlChange(control.id, value)}
        disabled={isSubmitting}
      >
        <SelectTrigger
          className="shrink-0"
          style={{ width: SELECT_FIXED_WIDTH }}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent style={{ minWidth: SELECT_FIXED_WIDTH }}>
          {control.options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

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
              <div key={group.id}>
                {/* 分组标题 */}
                <div className="mb-4 space-y-1">
                  <h3 className="text-base font-semibold text-[color:var(--report-text-heading)]">{group.title}</h3>
                  {group.description ? <p className="text-sm text-[color:var(--report-text-subtle)]">{group.description}</p> : null}
                </div>

                {/* 控件列表 */}
                <div className="space-y-3">
                  {group.controls.map((control) => (
                    <div key={control.id}>
                      <ControlRow
                        control={control}
                        selectedValue={controlSelections[control.id]}
                        isSubmitting={isSubmitting}
                        onControlChange={onControlChange}
                      />
                    </div>
                  ))}
                </div>

                {/* 分组分隔符：最后一个分组不显示 */}
                {groupIndex < groups.length - 1 && (
                  <div className="mt-6 border-t border-[color:var(--report-border)]" />
                )}
              </div>
            ))}
          </div>
        ) : controls.length > 0 ? (
          <div className="space-y-3">
            {controls.map((control) => (
              <div key={control.id}>
                <ControlRow
                  control={control}
                  selectedValue={controlSelections[control.id]}
                  isSubmitting={isSubmitting}
                  onControlChange={onControlChange}
                />
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
