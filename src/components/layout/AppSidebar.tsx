'use client';

import { usePathname } from 'next/navigation';
import { BookOpen, Compass, Home, Sparkles } from 'lucide-react';
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
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
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

  // 过滤并排序侧栏启用的模块
  const sidebarModules = modules
    .filter((m) => m.manifest.sidebar.enabled)
    .sort((a, b) => a.manifest.sidebar.order - b.manifest.sidebar.order);

  // 处理导航点击
  const handleNavigate = (href: string, e: React.MouseEvent) => {
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
                  <a href="/" onClick={(e) => handleNavigate('/', e)}>
                    <Home />
                    <span>首页</span>
                  </a>
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
                        <a
                          href={module.manifest.route}
                          onClick={(e) => handleNavigate(module.manifest.route, e)}
                        >
                          <IconComponent />
                          <span>{module.manifest.name}</span>
                        </a>
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
        <div className="flex items-center gap-2">
          <Compass className="h-4 w-4" />
          <span>后续一级导航将在此扩展</span>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
