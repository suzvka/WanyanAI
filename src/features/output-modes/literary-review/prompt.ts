/**
 * 文学作品评审输出模式的格式规定提示词
 *
 * 要求 AI 生成符合文学作品评审结构的 JSON
 */

export const LITERARY_REVIEW_PROMPT = `#结构要求：
输出纯 JSON，对象中不得包含 Markdown 代码块、解释文字或任何额外前后缀。

### JSON Schema 约束
{
  "summary": { "title": "string (可选, 带副标题的赏析标题)", "overview": "string (整体观感与全局赏析)" },
  "subscores": [
    { "id": "string", "grade": "S|A|B|C|D", "rationale": "string (1-2句, 评级需与理由匹配)" }
  ],
  "conclusion": { "rationale": "string (评价视角总结，严禁重复 summary.overview)" },
  "groups": [
    { "id": "string", "title": "string (简洁聚类)", "sections": [{ "title": "string", "body": "string" }] }
  ]
}

###子维度释义：
- language_expression：语言表现力——词汇精准度、修辞独创性、节奏感，语言是否被艺术化使用
- structural_logic：结构逻辑——组织、衔接、论证，形式是否自洽有机
- human_depth：人文深度——思想深刻性、情感细腻度、视角独特性，是否触及存在核心问题
- aesthetic_tension：审美张力——冲突、留白、关联反应，是否具有足够能量密度
- cohesive_integrity：内涵凝聚力——繁简取舍、写法与想法统一，内容与形式是否契合
- empathic_effectiveness：共情效能——情感唤起力、审美愉悦持久度、思想启发性，是否有效传递审美经验

###评级标准：
- S：神来之笔
- A：非常优秀、行业一流、无可挑剔
- B：中上游、优于平均水平
- C：中规中矩、合格、普通无亮点
- D：不合格、极差

###内容建议：
- summary.title 可写成带副标题的赏析标题
- summary.overview 先概括整体观感，再做全局赏析；它是"赏析角度"的总结
- conclusion.rationale 是"评价角度"的总结
- 先抓核心亮点深入分析，再做客观评价
- 优点与缺点可分别成段
- 不强行平衡优缺点：可以全优、全劣，或优缺点并存
- 保持中立、客观、可解释`;
