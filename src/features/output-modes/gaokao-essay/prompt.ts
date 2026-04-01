/**
 * 高考作文评分报告的格式规定提示词
 * 
 * 要求 AI 生成符合高考作文评分报告结构的 JSON
 */

export const GAOKAO_ESSAY_PROMPT = `#结构要求：
输出纯 JSON，对象中不得包含 Markdown 代码块、解释文字或任何额外前后缀。

### JSON Schema 约束
{
  "summary": { "title": "string (可选, 试卷标题或作文题目)", "overview": "string (整体评价与核心观点)" },
  "subscores": [
    { "id": "string", "grade": "S|A|B|C|D", "rationale": "string (1-2句, 评级需与理由匹配)" }
  ],
  "conclusion": { "rationale": "string (综合评价与提升建议，严禁重复 summary.overview)" },
  "groups": [
    { "id": "string", "title": "string (简洁聚类)", "sections": [{ "title": "string", "body": "string" }] }
  ]
}

###子维度释义：
- theme_positioning：审题立意——符合题意、中心突出。无偏离题意必须S。反社会必须D。
- content_richness：内容充实——论据典型、材料丰富、论证充分。
- structure_logic：结构逻辑——结构完整、条理清晰、首尾呼应。重点在首尾，中间部分微小瑕疵可忽略。
- language_expression：语言表达——语言流畅、用词准确、有文采。语言流畅、用词准确即可A。
- development_depth：发展等级·深刻——揭示事物内在联系、观点有启发性。表现出思辨性即可A。
- development_innovation：发展等级·创新——见解新颖、材料新鲜、构思精巧、表达有个性。无过错即可A。

###通用评级标准：
- S：无任何过错，甚至十分精彩
- A：有微小瑕疵，但不影响大局
- B：平平无奇
- C：意义断层，已影响阅读
- D：不合格、完全无法理解

###内容建议：
- summary.title 可写成试卷标题或作文题目
- summary.overview 先概括整体观感，再做核心评价
- conclusion.rationale 考虑到学生的接受能力，在开始正式点评前用这一段铺垫(或做引子)
- 任何时候必须考虑：高考时间异常紧张，考生没有时间仔细打磨。因此，细节不完美不是扣分项
- 学生不是受过文学训练的成人，因此任何论点都优先向学生有利的方向解读，除非实在没办法才扣分
- 学生视野和见识有限，因此必须优先适应学生的理解，按照学生逻辑看待世界。除非学生不合逻辑或严重反社会。
- 优点与缺点可分别成段
- 不强行平衡优缺点：可以全优、全劣，或优缺点并存
- 保持中立、客观、可解释`;
