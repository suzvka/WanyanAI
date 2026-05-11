/**
 * Multi-select (多选) 控件类型定义
 *
 * 配置示例：
 * {
 *   "id": "review_aspects",
 *   "type": "multi-select",
 *   "title": "评审维度",
 *   "promptText": "请从以下维度进行评审",
 *   "maxSelections": 3,
 *   "options": [
 *     { "label": "语言表达", "promptText": "关注语言的准确性和表现力", "defaultSelected": true },
 *     { "label": "结构布局", "promptText": "分析文章的组织结构" }
 *   ]
 * }
 */

export interface MultiSelectOption {
  label: string;
  promptText: string;
  /** 是否默认选中（由数据层在初始化时解析，渲染器不处理） */
  defaultSelected?: boolean;
}

export interface MultiSelectConfig {
  id: string;
  type: 'multi-select';
  title?: string;
  promptText: string;
  /** 最大可选择数量，0 或不填表示不限制 */
  maxSelections?: number;
  options: MultiSelectOption[];
}
