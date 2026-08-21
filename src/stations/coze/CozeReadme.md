## Coze 内部模型

当项目部署到 Coze 内部环境（部署环境为 PROD，经中立键 `DEPLOY_ENV=PROD` 判定；平台注入的 `COZE_PROJECT_ENV` 由 TICKET-001 适配层映射）时，`src/stations/coze/` 中转站会自动启用：

**模型 ID 格式**：`coze://{model_id}`，如 `coze://doubao-seed-1-8-251228`

**可用模型（清单，来源 = LLM 集成技能注入的 Available Models，平台变更时随技能同步）**：
- `coze://doubao-seed-2-0-pro-260215` - 旗舰级全能通用模型
- `coze://doubao-seed-2-0-lite-260215` - 均衡型模型
- `coze://doubao-seed-2-0-mini-260215` - 轻量级模型
- `coze://doubao-seed-1-8-251228` - 多模态 Agent 优化模型（默认）
- `coze://glm-5-0-260211` - GLM-5
- `coze://glm-5-turbo-260316` - GLM-5 Turbo
- `coze://glm-4-7-251222` - GLM-4.7
- `coze://minimax-m2-5-260212` - MiniMax M2.5
- `coze://minimax-m2-7-260318` - MiniMax M2.7
- `coze://qwen-3-5-plus-260215` - Qwen 3.5 Plus

> **动态透传（方案 B）**：以上清单仅约束"展示 / Admin 启停开关 / 默认行为"。转发层对**不在清单内且未显式停用**的 `coze://` 模型默认放行（由平台侧校验模型有效性），因此平台新上线模型**无需重新部署**即可被调用；显式停用过的模型始终被拦截。

**调用流程**：
1. 用户选择 `coze://` 前缀模型
2. 请求到达 `/api/v1/chat/completions`（框架鉴权）
3. `StationRegistry` 查找 `coze` 中转站
4. 中转站调用 `coze-coding-dev-sdk`，返回 OpenAI 兼容格式流