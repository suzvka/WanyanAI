const jsonFencePattern = /```(?:json)?\s*([\s\S]*?)```/i;

/**
 * 解析模型响应结果
 */
export type ParseModelResponseResult = {
  /** 是否成功解析 */
  success: boolean;
  /** 解析后的数据 */
  data: unknown;
  /** 原始文本 */
  rawText: string;
  /** 提取的 JSON 文本 */
  jsonText: string;
  /** 是否使用了 fence 提取 */
  usedFenceExtraction: boolean;
  /** 是否使用了括号提取 */
  usedBracketExtraction: boolean;
  /** 是否使用了修复 */
  usedRepair: boolean;
};

/**
 * 解析模型响应内容
 * 
 * 尝试从模型返回的内容中提取有效的 JSON 数据
 */
export function parseModelResponse(content: string): ParseModelResponseResult {
  const extracted = extractJsonCandidate(content);
  
  // 尝试直接解析
  const directParsed = tryParseJson(extracted.jsonText);
  if (directParsed !== null) {
    return {
      success: true,
      data: directParsed,
      rawText: extracted.rawText,
      jsonText: extracted.jsonText,
      usedFenceExtraction: extracted.usedFence,
      usedBracketExtraction: extracted.usedBracket,
      usedRepair: false,
    };
  }

  // 尝试修复后解析
  const repairedJson = repairMalformedJson(extracted.jsonText);
  if (repairedJson !== extracted.jsonText) {
    const repairedParsed = tryParseJson(repairedJson);
    if (repairedParsed !== null) {
      return {
        success: true,
        data: repairedParsed,
        rawText: extracted.rawText,
        jsonText: repairedJson,
        usedFenceExtraction: extracted.usedFence,
        usedBracketExtraction: extracted.usedBracket,
        usedRepair: true,
      };
    }
  }

  return {
    success: false,
    data: null,
    rawText: extracted.rawText,
    jsonText: extracted.jsonText,
    usedFenceExtraction: extracted.usedFence,
    usedBracketExtraction: extracted.usedBracket,
    usedRepair: false,
  };
}

/**
 * 提取 JSON 候选内容
 */
function extractJsonCandidate(content: string): {
  rawText: string;
  jsonText: string;
  usedFence: boolean;
  usedBracket: boolean;
} {
  const rawText = content.replace(/^\uFEFF/, '').trim();
  let jsonText = rawText;
  let usedFence = false;
  let usedBracket = false;

  // 尝试从代码块中提取
  const fenced = rawText.match(jsonFencePattern)?.[1]?.trim();
  if (fenced) {
    jsonText = fenced;
    usedFence = true;
  }

  // 尝试提取括号内的 JSON
  const bracketed = extractBracketedJson(jsonText);
  if (bracketed) {
    jsonText = bracketed;
    usedBracket = true;
  }

  return {
    rawText,
    jsonText: jsonText.trim(),
    usedFence,
    usedBracket,
  };
}

/**
 * 提取括号内的 JSON
 * 
 * 从结尾往前读取，提取最后一个完整的 JSON 对象
 * 这样可以避免提取到提示词中的示例 JSON，而是提取模型实际生成的结果
 */
function extractBracketedJson(content: string): string | null {
  // 找到最后一个 }
  const objectEnd = content.lastIndexOf('}');
  
  if (objectEnd === -1) {
    return null;
  }

  // 从最后的 } 往前找匹配的 {
  let depth = 0;
  let inString = false;
  let escapeNext = false;
  
  for (let i = objectEnd; i >= 0; i--) {
    const char = content[i];
    
    if (escapeNext) {
      escapeNext = false;
      continue;
    }
    
    // 检查转义字符 - 注意往前遍历时需要看前一个字符
    if (i > 0 && content[i - 1] === '\\' && inString) {
      escapeNext = true;
      continue;
    }
    
    if (char === '"') {
      inString = !inString;
      continue;
    }
    
    if (!inString) {
      if (char === '}') {
        depth++;
      } else if (char === '{') {
        depth--;
        if (depth === 0) {
          // 找到匹配的开始括号
          return content.slice(i, objectEnd + 1).trim();
        }
      }
    }
  }

  // 如果没有找到匹配的开始括号，尝试使用第一个 {
  const objectStart = content.indexOf('{');
  if (objectStart !== -1 && objectStart < objectEnd) {
    return content.slice(objectStart, objectEnd + 1).trim();
  }

  return null;
}

/**
 * 尝试解析 JSON
 */
function tryParseJson(content: string): unknown | null {
  if (!content.trim()) {
    return null;
  }

  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * 修复格式错误的 JSON
 */
function repairMalformedJson(content: string): string {
  return content
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```$/i, '')
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/,\s*([}\]])/g, '$1')
    .trim();
}
