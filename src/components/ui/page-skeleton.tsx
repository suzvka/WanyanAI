'use client';

import { Skeleton } from '@/components/ui/skeleton';

interface PageSkeletonProps {
  type: 'landing' | 'evaluate';
}

/**
 * 页面骨架屏组件
 * 
 * 根据页面类型显示对应的骨架屏
 * 只在首次加载时显示
 */
export function PageSkeleton({ type }: PageSkeletonProps) {
  if (type === 'landing') {
    return <LandingSkeleton />;
  }

  if (type === 'evaluate') {
    return <EvaluateSkeleton />;
  }

  return null;
}

/**
 * 首页骨架屏
 */
function LandingSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      {/* 顶部导航栏骨架 */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto max-w-7xl px-2.5 py-2 sm:px-6 lg:px-8">
          <div className="flex min-h-12 items-center gap-2 sm:gap-3">
            <Skeleton className="h-9 w-9 rounded-md" />
            <Skeleton className="h-9 w-40 rounded-md" />
            <div className="flex-1" />
            <Skeleton className="h-9 w-9 rounded-md" />
          </div>
        </div>
      </header>

      <main className="flex min-h-[70vh] flex-col items-center justify-center px-4">
        {/* 品牌名骨架 */}
        <Skeleton className="h-14 w-64 mb-6" />
        {/* slogan 骨架 */}
        <Skeleton className="h-5 w-80 mb-10" />
        {/* CTA 按钮骨架 */}
        <Skeleton className="h-12 w-40 rounded-full" />
      </main>
    </div>
  );
}

/**
 * 评估页面骨架屏
 */
function EvaluateSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      {/* 顶部导航栏骨架 */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto max-w-7xl px-2.5 py-2 sm:px-6 lg:px-8">
          <div className="flex min-h-12 items-center gap-2 sm:gap-3">
            <Skeleton className="h-9 w-9 rounded-md" />
            <Skeleton className="h-9 w-40 rounded-md" />
            <div className="flex-1" />
            <Skeleton className="h-9 w-9 rounded-md" />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="space-y-6">
          {/* 分析设置面板骨架 */}
          <div className="rounded-xl border border-border overflow-hidden">
            <div className="flex h-14 items-center justify-between px-4 bg-background border-b border-border">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-4 w-4 rounded-full" />
            </div>
            <div className="p-4">
              <div className="flex items-center justify-between py-2">
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-10 w-[200px]" />
              </div>
            </div>
          </div>

          {/* 文本块容器面板骨架 */}
          <div className="rounded-xl border border-border overflow-hidden">
            {/* 标题栏 */}
            <div className="flex h-14 items-center justify-between px-4 bg-background border-b border-border">
              <div className="flex items-center gap-2">
                <Skeleton className="h-6 w-24" />
                <span className="text-muted-foreground">·</span>
                <Skeleton className="h-4 w-16" />
              </div>
              <Skeleton className="h-4 w-4 rounded-full" />
            </div>
            {/* 内容区 */}
            <div className="p-4 space-y-4">
              {/* 文本块骨架 */}
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-border p-4 space-y-3"
                >
                  {/* 文本块标题 */}
                  <Skeleton className="h-5 w-20" />
                  {/* 文本块内容 */}
                  <Skeleton className="h-24 w-full" />
                  {/* 操作栏 */}
                  <div className="flex justify-between items-center pt-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-8 w-8 rounded-md" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 分析按钮骨架 */}
          <div className="pt-2">
            <Skeleton className="h-14 w-full rounded-lg" />
          </div>
        </div>
      </main>
    </div>
  );
}
