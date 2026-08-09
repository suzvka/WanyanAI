'use client';

import type { ReactNode } from 'react';
import { CircleHelp, Settings2, UserRound } from 'lucide-react';
import type { PageModulePublicMeta } from '@/types/module';
import AppSidebar from '@/components/layout/AppSidebar';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import ModelSelector from '@/features/model-config/components/ModelSelector';
import ApiConfigManagerDialog from '@/features/model-config/components/ApiConfigManagerDialog';
import { useModelConfig } from '@/providers/ModelConfigProvider';

interface AppShellProps {
  siteTitle: string;
  primaryColor?: string;
  modules?: PageModulePublicMeta[];
  children: ReactNode;
}

export default function AppShell({
  siteTitle,
  primaryColor,
  modules,
  children,
}: AppShellProps) {
  const {
    apiConfigs,
    selectedConfigId,
    selectedConfig,
    isConfigBusy,
    createConfig,
    updateConfig,
    deleteConfig,
    selectConfig,
    selectModel,
    isConfigDialogOpen,
    setIsConfigDialogOpen,
    // 内置模式
    useBuiltInMode,
    setUseBuiltInMode,
    builtInModels,
    builtInSelectedModel,
    builtInValidationStatus,
    selectBuiltInModel,
    refreshBuiltInModels,
  } = useModelConfig();

  return (
    <>
      <SidebarProvider defaultOpen={false}>
        <AppSidebar title={siteTitle} primaryColor={primaryColor} modules={modules} />
        <SidebarInset className="min-h-screen bg-transparent">
          <header className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
            <div className="mx-auto max-w-7xl px-2.5 py-2 sm:px-6 lg:px-8">
              <div className="flex min-h-12 items-center gap-2 sm:gap-3">
                <div className="flex shrink-0 items-center">
                  <SidebarTrigger aria-label="切换侧栏" className="size-9" />
                </div>
                <div className="min-w-0 max-w-[15rem] sm:max-w-xs md:max-w-sm lg:max-w-md">
                  <ModelSelector
                    selectedConfig={selectedConfig}
                    disabled={isConfigBusy}
                    onSelectModel={selectModel}
                    // 内置模式
                    useBuiltInMode={useBuiltInMode}
                    builtInModels={builtInModels}
                    builtInSelectedModel={builtInSelectedModel}
                    onSelectBuiltInModel={selectBuiltInModel}
                    // 刷新功能
                    isRefreshing={useBuiltInMode && builtInValidationStatus === 'validating'}
                    onRefresh={useBuiltInMode ? refreshBuiltInModels : undefined}
                  />
                </div>
                <div className="flex-1" />
                <div className="flex shrink-0 items-center gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button type="button" variant="outline" size="icon" className="size-9">
                        <Settings2 className="size-4" />
                        <span className="sr-only">更多选项</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuLabel>更多功能</DropdownMenuLabel>
                      <DropdownMenuItem disabled>
                        <UserRound className="mr-2 h-4 w-4" />
                        个人中心（预留）
                      </DropdownMenuItem>
                      <DropdownMenuItem disabled>
                        <Settings2 className="mr-2 h-4 w-4" />
                        偏好设置（预留）
                      </DropdownMenuItem>
                      <DropdownMenuItem disabled>
                        <CircleHelp className="mr-2 h-4 w-4" />
                        帮助与反馈（预留）
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => setIsConfigDialogOpen(true)}>
                        <Settings2 className="mr-2 h-4 w-4" />
                        管理配置
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>
            {/* 底部渐变分隔线（透明→边框色→透明），弱化生硬边线 */}
            <div
              aria-hidden="true"
              className="h-px w-full"
              style={{
                background:
                  'linear-gradient(90deg, transparent, var(--border) 20%, var(--border) 80%, transparent)',
              }}
            />
          </header>
          {children}
        </SidebarInset>
      </SidebarProvider>

      <ApiConfigManagerDialog
        open={isConfigDialogOpen}
        selectedConfigId={selectedConfigId}
        configs={apiConfigs}
        busy={isConfigBusy}
        onOpenChange={setIsConfigDialogOpen}
        onSelectConfig={selectConfig}
        onCreateConfig={createConfig}
        onUpdateConfig={updateConfig}
        onDeleteConfig={deleteConfig}
        // 内置模式
        useBuiltInMode={useBuiltInMode}
        setUseBuiltInMode={setUseBuiltInMode}
        builtInModels={builtInModels}
        builtInSelectedModel={builtInSelectedModel}
        builtInValidationStatus={builtInValidationStatus}
        onSelectBuiltInModel={selectBuiltInModel}
        onRefreshBuiltInModels={refreshBuiltInModels}
      />
    </>
  );
}
