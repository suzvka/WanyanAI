# 添加控件类型

控件（Control）是用户交互组件（下拉、多选等），负责收集用户选择并编译为提示词片段。

## 已有控件

| 类型 | 目录 | 输入格式 |
|------|------|---------|
| `select` | `src/features/controls/select-control/` | 单选下拉 |
| `multi-select` | `src/features/controls/multi-select/` | 多选标签组 |

## 步骤

### 1. 定义类型

```ts
// src/features/controls/my-control/types.ts
export interface MyControlConfig extends ControlConfigBase {
  type: 'my-control';
  promptText: string;
  // ... 自定义字段
}

export interface MyControlOption {
  label: string;
  value?: string;
  defaultSelected?: boolean;
  // ... 自定义字段
}
```

`ControlConfigBase` 提供公共字段：`id`, `title`, `enabled`, `options`。

### 2. 实现模块

```ts
// src/features/controls/my-control/module.ts
import type { ControlModule, ControlDefinition, CompileResult } from '../types';
import type { MyControlConfig } from './types';

export const myControlModule: ControlModule = {
  id: 'my-control',
  name: '我的控件',

  // 从原始配置中提取属于本类型的条目
  extractConfig(raw) {
    if (!Array.isArray(raw)) return null;
    return raw.filter(
      (item): item is MyControlConfig =>
        typeof item === 'object' && item !== null &&
        (item as Record<string, unknown>).type === 'my-control'
    );
  },

  // 预计算含 initialValue 的定义（供 PageContext 初始化读取）
  getDefinitions(config) {
    if (!config || !Array.isArray(config)) return [];
    return config.map((item) => ({
      id: item.id,
      type: 'my-control',
      title: item.title,
      initialValue: /* 根据 options 计算 */,
      data: { promptText: item.promptText, /* ... */ },
    })) satisfies ControlDefinition[];
  },

  // 将用户选择编译为提示词字符串
  compile(config, selections) {
    const value = selections[config.id];
    return { instruction: `${config.promptText}: ${value}` };
  },
};
```

**接口契约** (`ControlModule`)：

| 方法 | 返回值 | 说明 |
|------|--------|------|
| `extractConfig(raw)` | `MyControlConfig[] \| null` | 从混合数组中提取本类型配置 |
| `getDefinitions(config)` | `ControlDefinition[]` | 计算含 `initialValue` 的标准化定义 |
| `compile(config, selections)` | `{ instruction: string }` | 将用户选择转为提示词文本 |

### 3. 创建渲染器

```tsx
// src/features/controls/my-control/renderer.tsx
'use client';

import { useState } from 'react';
import type { ControlDefinition } from '../../types';

interface Props {
  definition: ControlDefinition;
  value: string;
  onChange: (value: string) => void;
}

export function MyControlRenderer({ definition, value, onChange }: Props) {
  const config = definition.data as unknown as MyControlConfig;

  return (
    <div>
      <label>{definition.title}</label>
      {/* 受控组件：值来自 props，变更通过 onChange 上报 */}
    </div>
  );
}
```

渲染器必须是**纯受控组件**：
- 不使用 `useEffect` / `useRef`
- 值从 `props.value` 派生
- 变更通过 `props.onChange` 通知父组件

### 4. 注册到内置控件清单

编辑 `src/features/controls/manifest.ts`，在 `registerBuiltinControls()` 中调用新模块的 `register()`：

```ts
// src/features/controls/manifest.ts
import { register as registerMyControl } from './my-control/module';

// 在 registerBuiltinControls() 中添加：
export function registerBuiltinControls(): void {
  registerSelect();
  registerMultiSelect();
  registerMyControl();
}
```

### 5. 在模块内注册

`src/features/controls/my-control/module.ts` 需导出 `register()` 函数，内部调用注册表单例：

```ts
import { controlRegistry } from '../registry';

export function register(): void {
  controlRegistry.register(myControlModule);
}
```

注册表采用延迟初始化：框架启动时调用 `initializeControls()`（内部调用 `registerBuiltinControls()`），无需其他改动。

### 6. 使用

在 `controls.json` 或 `main.json.controls` 中声明：

```json
{
  "id": "my-field",
  "type": "my-control",
  "title": "我的选项",
  "promptText": "请选择",
  "options": [
    { "label": "选项 A", "defaultSelected": true },
    { "label": "选项 B" }
  ]
}
```

## 约束

- `id` 在同一模块内唯一
- `getDefinitions` 必须计算 `initialValue`（无默认值时返回 `undefined`）
- `compile` 返回的 `instruction` 为空字符串时该控件不参与提示词拼接
