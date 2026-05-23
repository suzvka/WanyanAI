/**
 * Agent 工作区（客户端内存沙箱）
 *
 * 存储 Agent 执行过程中各中间步骤的分析产物。
 * Agent LLM 通过 workspace_list / workspace_read 工具按需浏览和选取上下文，
 * 终端步骤执行时只注入被选中的产物，避免上下文全量膨胀。
 *
 * 生命周期：与单次 runAgent() 调用绑定，函数返回后自动 GC。
 */

/** 分析产物 */
export interface Artifact {
  /** 产物唯一 ID（通常为 outputMode ID，如 "checklist"） */
  stepId: string;
  /** 输出模式 ID */
  outputMode: string;
  /** 步骤显示标签 */
  label: string;
  /** 完整上下文文本 */
  content: string;
  /** 创建时间戳 */
  timestamp: number;
}

/** 摘要截断长度 */
const SUMMARY_MAX_LENGTH = 200;

export class AgentWorkspace {
  private artifacts = new Map<string, Artifact>();

  // ─── 写入 ────────────────────────────────────────────

  /** 存入分析产物（同一 stepId 重复写入会覆盖） */
  put(artifact: Artifact): void {
    this.artifacts.set(artifact.stepId, artifact);
  }

  // ─── 读取 ────────────────────────────────────────────

  /** 获取单个产物 */
  get(stepId: string): Artifact | undefined {
    return this.artifacts.get(stepId);
  }

  /** 获取所有产物 */
  getAll(): Artifact[] {
    return Array.from(this.artifacts.values());
  }

  // ─── 供工具使用 ──────────────────────────────────────

  /**
   * 生成产物列表摘要（供 workspace_list 工具）
   *
   * 格式：
   *   [stepId] label
   *   <前200字>
   */
  summarize(): string {
    if (this.artifacts.size === 0) {
      return '(尚无已完成的分析步骤)';
    }

    return this.getAll()
      .map((a) => {
        const preview =
          a.content.length > SUMMARY_MAX_LENGTH
            ? a.content.slice(0, SUMMARY_MAX_LENGTH) + '...'
            : a.content;
        return `[${a.stepId}] ${a.label}\n${preview}`;
      })
      .join('\n\n---\n\n');
  }

  /**
   * 获取指定产物的拼接上下文（供终端步骤注入）
   *
   * @param stepIds 要包含的产物 ID 列表，不传则包含全部
   * @returns 格式化的上下文字符串，直接附加到 system prompt 前
   */
  getContent(stepIds?: string[]): string {
    const targets = stepIds
      ? stepIds
          .map((id) => this.artifacts.get(id))
          .filter((a): a is Artifact => a !== undefined)
      : this.getAll();

    if (targets.length === 0) return '';

    return [
      '## 前置分析上下文',
      '(以下内容来自前置分析步骤，请参考这些分析结果产出最终报告)',
      '',
      ...targets.map(
        (a) => `### [${a.stepId}] ${a.label}\n\n${a.content}`,
      ),
    ].join('\n');
  }

  // ─── 生命周期 ────────────────────────────────────────

  /** 清空所有产物 */
  clear(): void {
    this.artifacts.clear();
  }
}
