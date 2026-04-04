'use client';

import type { ComponentType, MouseEvent } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BookOpen, Compass, History, Home, Sparkles } from 'lucide-react';
import type { ModuleConfig } from '@/types/module';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from '@/components/ui/sidebar';
import { useNavigationGuard } from '@/providers/NavigationGuardContext';

// 图标映射表
const ICON_MAP: Record<string, ComponentType<{ className?: string }>> = {
  BookOpen,
  Compass,
  Home,
  Sparkles,
};

interface AppSidebarProps {
  title: string;
  primaryColor?: string;
  modules?: ModuleConfig[];
}

export default function AppSidebar({ title, primaryColor, modules = [] }: AppSidebarProps) {
  const pathname = usePathname();
  const { requestNavigate } = useNavigationGuard();
  const isHistoryActive = pathname === '/history' || pathname.startsWith('/history/');

  // 过滤并排序侧栏启用的模块
  const sidebarModules = modules
    .filter((m) => m.manifest.sidebar.enabled)
    .sort((a, b) => a.manifest.sidebar.order - b.manifest.sidebar.order);

  // 处理导航点击
  const handleNavigate = (href: string, e: MouseEvent<HTMLAnchorElement>) => {
    if (!requestNavigate(href)) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  return (
    <Sidebar collapsible="offcanvas">
      <SidebarHeader className="px-4 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className="rounded-lg p-1.5"
            style={{ backgroundColor: primaryColor || 'var(--primary)' }}
          >
            <Sparkles className="h-4 w-4 text-white sm:h-5 sm:w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold text-[color:var(--report-text-heading)] sm:text-xl">{title}</h1>
            <p className="truncate text-sm text-[color:var(--report-text-subtle)]">工作区导航</p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarSeparator />
      <SidebarContent>
        {/* 首页入口 */}
        <SidebarGroup>
          <SidebarGroupLabel>导航</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === '/'}>
                  <Link href="/" onClick={(e: MouseEvent<HTMLAnchorElement>) => handleNavigate('/', e)}>
                    <Home />
                    <span>首页</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* 功能模块入口 */}
        {sidebarModules.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>功能模块</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {sidebarModules.map((module) => {
                  const IconComponent = ICON_MAP[module.manifest.sidebar.icon] || Compass;
                  const isActive = pathname === module.manifest.route;

                  return (
                    <SidebarMenuItem key={module.manifest.id}>
                      <SidebarMenuButton asChild isActive={isActive}>
                        <Link
                          href={module.manifest.route}
                          onClick={(e: MouseEvent<HTMLAnchorElement>) => handleNavigate(module.manifest.route, e)}
                        >
                          <IconComponent />
                          <span>{module.manifest.name}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarSeparator />
      <SidebarFooter className="px-4 py-3 text-xs text-sidebar-foreground/70">
        <div className="mb-2 flex items-center gap-2">
          <Compass className="h-4 w-4" />
          <span>扩展</span>
        </div>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={isHistoryActive}>
              <Link href="/history" onClick={(e: MouseEvent<HTMLAnchorElement>) => handleNavigate('/history', e)}>
                <History />
                <span>历史报告</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
