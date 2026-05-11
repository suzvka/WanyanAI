# 添加容器

容器（Container）是页面布局单元，每个容器负责渲染一个区域。框架按 `main.json` 中 `containers` 数组的顺序依次渲染。

## 已有容器

| 类型 | 文件 | 用途 |
|------|------|------|
| `analysis-controls` | `src/containers/analysis-controls/` | 控件面板 + 提交按钮 |
| `text-blocks` | `src/containers/text-blocks/` | 可编辑文本块列表 |

## 步骤

### 1. 创建容器组件

```tsx
// src/containers/my-container/index.tsx
'use client';

import type { ContainerComponentProps } from '@/containers/registry';

interface MyContainerParams {
  title: string;
}

export function MyContainerRenderer({
  config,
  data,
  onDataChange,
}: ContainerComponentProps<MyContainerParams>) {
  return (
    <section>
      <h2>{config.params.title}</h2>
      {/* 渲染内容 */}
    </section>
  );
}
```

Props 来自 `ContainerComponentProps<TParams, TData>`：

| Prop | 类型 | 说明 |
|------|------|------|
| `config` | `ContainerConfig & { params: TParams }` | 容器配置（含 `params`） |
| `index` | `number` | 在容器列表中的位置 |
| `isLast` | `boolean` | 是否最后一个容器 |
| `data` | `TData \| undefined` | 容器数据 |
| `onDataChange` | `(data: TData) => void` | 数据变更回调 |

### 2. 注册容器

编辑 `src/containers/registry.tsx`：

```tsx
import { MyContainerRenderer } from '@/containers/my-container';

// 在 registerAll() 中添加：
containerRegistry.register({
  type: 'my-container',
  component: MyContainerRenderer,
  defaultParams: { title: '默认标题' },
});
```

### 3. 在模块配置中使用

```json
{
  "containers": [
    { "type": "analysis-controls" },
    { "type": "my-container", "params": { "title": "自定义标题" } }
  ]
}
```

## 约束

- 组件必须用 `'use client'` 标记
- `register()` 的 `type` 值即为 `main.json` 中引用的标识
- `defaultParams` 与 `validateParams` 可选
