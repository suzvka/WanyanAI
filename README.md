# WanyanAI

这是一个基于 [Next.js 16](https://nextjs.org) + [shadcn/ui](https://ui.shadcn.com) 的模块化文本评估应用。项目使用 `pnpm` 管理依赖，并通过 `src/server.ts` 启动自定义 Node.js Server 承载 Next.js。

## 快速开始

### 启动开发服务器

```bash
pnpm install
pnpm dev
```

启动后，在浏览器中打开 [http://localhost:5000](http://localhost:5000) 查看应用。

开发服务器支持热更新，修改代码后页面会自动刷新。

> 当前 `package.json` 中的脚本实际调用 `bash ./scripts/*.sh`。本地运行需具备兼容 `bash` 的环境（例如 Git Bash、WSL 或类 Unix 环境）。

### 构建生产版本

```bash
pnpm build
```

### 启动生产服务器

```bash
pnpm start
```

## 项目结构

```
src/
├── app/                                 # Next.js App Router 目录
│   ├── (landing)/page.tsx               # 首页
│   ├── (evaluate)/evaluate/[moduleId]/page.tsx  # 模块评估页
│   ├── api/instructions/compile/route.ts        # 动态指令编译 API
│   ├── api/templates/compile/route.ts           # 模板编译 API
│   ├── globals.css                       # 全局样式
│   └── layout.tsx                        # 根布局组件
├── components/                           # React 组件目录
├── containers/                           # 页面容器注册与渲染
├── features/                             # 业务功能模块
├── lib/                                  # 工具函数库
├── server/                               # 服务端配置、模块与指令逻辑
└── server.ts                             # 自定义 Node.js Server 入口

app-modules/
└── <module-id>/                          # 功能页面模块目录
    ├── main.json                         # 页面模块注册信息（必需）
    ├── site.json                         # 页面文案配置（可选）
    └── analysis-controls.json            # 分析选项与 promptText（可选）

platform-config/
├── manifest.json                         # 平台配置版本信息
├── appearance.json                       # 品牌与主题配置
├── feature-flags.json                    # 平台功能开关
├── forward.json                          # 站内代理转发配置
├── rate-limit.json                       # 站内代理限流配置
└── prompt-blocks/                        # 预留目录，当前运行时未直接接入

scripts/
├── dev.sh
├── build.sh
└── start.sh

dist/                                     # 生产构建后的服务端输出目录
```

## 核心开发规范

### 1. 组件开发

**优先使用 shadcn/ui 基础组件**

本项目已预装完整的 shadcn/ui 组件库，位于 `src/components/ui/` 目录。开发时应优先使用这些组件作为基础：

```tsx
// ✅ 推荐：使用 shadcn 基础组件
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

export default function MyComponent() {
  return (
    <Card>
      <CardHeader>标题</CardHeader>
      <CardContent>
        <Input placeholder="输入内容" />
        <Button>提交</Button>
      </CardContent>
    </Card>
  );
}
```

**可用的 shadcn 组件清单**

- 表单：`button`, `input`, `textarea`, `select`, `checkbox`, `radio-group`, `switch`, `slider`
- 布局：`card`, `separator`, `tabs`, `accordion`, `collapsible`, `scroll-area`
- 反馈：`alert`, `alert-dialog`, `dialog`, `toast`, `sonner`, `progress`
- 导航：`dropdown-menu`, `menubar`, `navigation-menu`, `context-menu`
- 数据展示：`table`, `avatar`, `badge`, `hover-card`, `tooltip`, `popover`
- 其他：`calendar`, `command`, `carousel`, `resizable`, `sidebar`

详见 `src/components/ui/` 目录下的具体组件实现。

### 2. 路由开发

Next.js 使用文件系统路由，在 `src/app/` 目录下创建文件夹即可添加路由：

```bash
# 创建新路由 /about
src/app/about/page.tsx

# 创建动态路由 /posts/[id]
src/app/posts/[id]/page.tsx

# 创建路由组（不影响 URL）
src/app/(marketing)/about/page.tsx

# 创建 API 路由
src/app/api/users/route.ts
```

**页面组件示例**

```tsx
// src/app/about/page.tsx
import { Button } from '@/components/ui/button';

export const metadata = {
  title: '关于我们',
  description: '关于页面描述',
};

export default function AboutPage() {
  return (
    <div>
      <h1>关于我们</h1>
      <Button>了解更多</Button>
    </div>
  );
}
```

**动态路由示例**

```tsx
// src/app/posts/[id]/page.tsx
export default async function PostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <div>文章 ID: {id}</div>;
}
```

**API 路由示例**

```tsx
// src/app/api/users/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ users: [] });
}

export async function POST(request: Request) {
  const body = await request.json();
  return NextResponse.json({ success: true });
}
```

### 3. 依赖管理

**必须使用 pnpm 管理依赖**

```bash
# ✅ 安装依赖
pnpm install

# ✅ 添加新依赖
pnpm add package-name

# ✅ 添加开发依赖
pnpm add -D package-name

# ❌ 禁止使用 npm 或 yarn
# npm install  # 错误！
# yarn add     # 错误！
```

项目已配置 `preinstall` 脚本，使用其他包管理器会报错。

### 4. 样式开发

**使用 Tailwind CSS v4**

本项目使用 Tailwind CSS v4 进行样式开发，并已配置 shadcn 主题变量。

```tsx
// 使用 Tailwind 类名
<div className="flex items-center gap-4 p-4 rounded-lg bg-background">
  <Button className="bg-primary text-primary-foreground">
    主要按钮
  </Button>
</div>

// 使用 cn() 工具函数合并类名
import { cn } from '@/lib/utils';

<div className={cn(
  "base-class",
  condition && "conditional-class",
  className
)}>
  内容
</div>
```

**主题变量**

主题变量定义在 `src/app/globals.css` 中，支持亮色/暗色模式：

- `--background`, `--foreground`
- `--primary`, `--primary-foreground`
- `--secondary`, `--secondary-foreground`
- `--muted`, `--muted-foreground`
- `--accent`, `--accent-foreground`
- `--destructive`, `--destructive-foreground`
- `--border`, `--input`, `--ring`

### 5. 表单开发

推荐使用 `react-hook-form` + `zod` 进行表单开发：

```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const formSchema = z.object({
  username: z.string().min(2, '用户名至少 2 个字符'),
  email: z.string().email('请输入有效的邮箱'),
});

export default function MyForm() {
  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: { username: '', email: '' },
  });

  const onSubmit = (data: z.infer<typeof formSchema>) => {
    console.log(data);
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <Input {...form.register('username')} />
      <Input {...form.register('email')} />
      <Button type="submit">提交</Button>
    </form> 
  );
}
```

### 6. 数据获取

**服务端组件（推荐）**

```tsx
// src/app/posts/page.tsx
async function getPosts() {
  const res = await fetch('https://api.example.com/posts', {
    cache: 'no-store', // 或 'force-cache'
  });
  return res.json();
}

export default async function PostsPage() {
  const posts = await getPosts();

  return (
    <div>
      {posts.map(post => (
        <div key={post.id}>{post.title}</div>
      ))}
    </div>
  );
}
```

**客户端组件**

```tsx
'use client';

import { useEffect, useState } from 'react';

export default function ClientComponent() {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch('/api/data')
      .then(res => res.json())
      .then(setData);
  }, []);

  return <div>{JSON.stringify(data)}</div>;
}
```

### 7. 平台配置与动态指令

当前程序运行时使用两级配置：

- 平台级配置位于 `platform-config/`
  - `manifest.json`：配置版本与环境信息
  - `appearance.json`：品牌名称、口号、主题色
  - `feature-flags.json`：平台级功能开关
  - `forward.json`：站内代理模型与 challenge 配置
  - `rate-limit.json`：站内代理限流配置
  - `prompt-blocks/`：预留目录，当前运行时未直接接入
- 模块级配置位于 `app-modules/<module-id>/`
  - `main.json`：页面模块 `slug`、`title`、`description`、`entry`、`route`、容器声明与输出模式
  - `site.json`：输入页与进度文案
  - `analysis-controls.json`：分析选项、默认值与各选项对应的 `promptText`

动态指令的当前实现方式：

- 页面根据模块的 `analysis-controls.json` 渲染分析选项
- 用户选择后，请求 `/api/instructions/compile`
- 服务端将所选项对应的 `promptText` 按顺序拼接成最终动态指令

`platform-config/prompt-blocks/` 目录当前为预留目录，运行时尚未直接使用该目录组装提示词。

### 8. 站内代理鉴权说明

站内代理当前保持与普通 OpenAI-compatible 调用一致的表面形态：

- 调用方仍传入 `baseUrl`、`key`、`model`
- Bearer `key` 使用动态代理凭证，格式为 `proof.userRef`
- 未登录时，客户端会生成浏览器级 `userRef` 并拼接到 `key` 后缀
- 该 `userRef` 仅作为权限查询索引，不单独承担验证功能
- 在账户系统接入前，服务端默认按**游客权限**处理站内代理请求

当前协议已移除对 `X-Browser-Id` 的依赖。

站内代理中的 challenge 现已降级为**纯辅助防刷语义**：

- 不参与主身份鉴权
- 主鉴权仍由 Bearer `key` 完成
- 仅当请求显式携带 challenge 参数时，服务端才执行额外校验

## 常见开发场景

### 添加新页面

1. 在 `src/app/` 下创建文件夹和 `page.tsx`
2. 使用 shadcn 组件构建 UI
3. 根据需要添加 `layout.tsx` 和 `loading.tsx`

### 添加新评估模块

1. 在 `app-modules/` 下创建新的独立目录
2. 添加 `main.json` 作为模块注册信息
3. 按需添加 `site.json` 与 `analysis-controls.json`
4. 在 `main.json` 中声明 `slug`、`title`、`description`、`entry`、`route`、`containers` 与 `outputMode`
5. 页面会在运行时自动扫描并加载包含 `main.json` 的模块目录

### 创建业务组件

1. 在 `src/components/` 下创建组件文件（非 UI 组件）
2. 优先组合使用 `src/components/ui/` 中的基础组件
3. 使用 TypeScript 定义 Props 类型

### 添加全局状态

推荐使用 React Context 或 Zustand：

```tsx
// src/lib/store.ts
import { create } from 'zustand';

interface Store {
  count: number;
  increment: () => void;
}

export const useStore = create<Store>((set) => ({
  count: 0,
  increment: () => set((state) => ({ count: state.count + 1 })),
}));
```

### 集成数据库

推荐使用 Prisma 或 Drizzle ORM，在 `src/lib/db.ts` 中配置。

## 技术栈

- **框架**: Next.js 16.1.1 (App Router)
- **服务端入口**: 自定义 Node.js Server (`src/server.ts`)
- **UI 组件**: shadcn/ui (基于 Radix UI)
- **样式**: Tailwind CSS v4
- **表单**: React Hook Form + Zod
- **图标**: Lucide React
- **字体**: `next/font/google` 的 `Inter`
- **包管理器**: pnpm 9+
- **TypeScript**: 5.x

## 参考文档

- [Next.js 官方文档](https://nextjs.org/docs)
- [shadcn/ui 组件文档](https://ui.shadcn.com)
- [Tailwind CSS 文档](https://tailwindcss.com/docs)
- [React Hook Form](https://react-hook-form.com)

## 重要提示

1. **必须使用 pnpm** 作为包管理器
2. **优先使用 shadcn/ui 组件** 而不是从零开发基础组件
3. **遵循 Next.js App Router 规范**，正确区分服务端/客户端组件
4. **使用 TypeScript** 进行类型安全开发
5. **使用 `@/` 路径别名** 导入模块（已配置）
6. **颜色统一规则**：除黑白外，其余颜色应从单一主题色派生，优先通过 CSS 变量和语义 token 表达
7. **新增评估能力优先走模块配置**：复用 `app-modules/<module-id>/` 下的 `main.json`、`site.json`、`analysis-controls.json`
8. **动态指令当前来自 `analysis-controls.json` 的 `promptText`**，而不是 `platform-config/prompt-blocks/`
9. **平台配置目录统一为 `platform-config/`**，不再保留 `ops-config/` 兼容读取
10. **页面模块公开字段仅限 `slug`、`title`、`description`**，入口展示由 `entry` 声明控制
