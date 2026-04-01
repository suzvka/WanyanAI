/**
 * JSON 修复提示词
 * 
 * 用于指导模型修复格式错误的 JSON 数据
 */

/**
 * JSON 修复请求提示词
 * 
 * 指导模型根据格式定义修复错误的 JSON
 */
export const JSON_REPAIR_PROMPT = `#任务
你是一个专业的数据修复助手。用户会提供：
1. 一份格式正确的 JSON Schema 定义
2. 一份格式错误的 JSON 数据

你需要：
1. 分析错误 JSON 的问题
2. 在保持原有语义的前提下修复格式
3. 输出修复后的纯 JSON

#修复原则
- 尽可能保留原有数据内容，只修复格式问题
- 如果字段缺失，不要臆造内容，可以设为 null 或合理默认值
- 如果字段类型错误，尝试转换为正确类型
- 如果结构嵌套错误，调整为正确结构
- 如果存在多余字段，保留但放在对象末尾

#输出要求
- 直接输出修复后的 JSON 对象
- 不要包含任何解释、注释或 Markdown 代码块标记
- 确保 JSON 语法完全正确`;

/**
 * 构建 JSON 修复请求消息
 * 
 * @param schemaPrompt 格式定义提示词（如 REPORT_JSON_PROMPT）
 * @param malformedJson 格式错误的 JSON 文本
 */
export function buildRepairMessages(schemaPrompt: string, malformedJson: string): Array<{
  role: 'system' | 'user';
  content: string;
}> {
  return [
    {
      role: 'system',
      content: JSON_REPAIR_PROMPT,
    },
    {
      role: 'user',
      content: `${schemaPrompt}

---

以下是待修复的 JSON 数据（可能被截断或格式错误）：

${malformedJson}

---

请根据上述格式定义修复 JSON 数据，直接输出修复后的结果。`,
    },
  ];
}
