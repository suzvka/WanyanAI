'use client';

import { Compass, PanelLeft, Sparkles } from 'lucide-react';
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

interface AppSidebarProps {
  title: string;
  primaryColor?: string;
}

export default function AppSidebar({ title, primaryColor }: AppSidebarProps) {
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
        <SidebarGroup>
          <SidebarGroupLabel>导航</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton type="button" isActive>
                  <Compass />
                  <span>当前工作区</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarSeparator />
      <SidebarFooter className="px-4 py-3 text-xs text-sidebar-foreground/70">
        <div className="flex items-center gap-2">
          <PanelLeft className="h-4 w-4" />
          <span>后续一级导航将在此扩展</span>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
