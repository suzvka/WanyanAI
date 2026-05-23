## Coze 内部模型

当项目部署到 Coze 内部环境（`COZE_PROJECT_ENV=PROD`）时，`src/stations/coze/` 中转站会自动启用：

**模型 ID 格式**：`coze://{model_id}`，如 `coze://doubao-seed-1-8-251228`

**可用模型**：
- `coze://doubao-seed-2-0-pro-260215` - 旗舰级全能通用模型
- `coze://doubao-seed-2-0-lite-260215` - 均衡型模型
- `coze://doubao-seed-2-0-mini-260215` - 轻量级模型
- `coze://doubao-seed-1-8-251228` - 多模态 Agent 优化模型（默认）
- `coze://doubao-seed-1-6-251015` - 通用模型
- `coze://doubao-seed-1-6-vision-250815` - 视觉理解模型
- `coze://doubao-seed-1-6-lite-251015` - 高性价比模型
- `coze://deepseek-v3-2-251201` - DeepSeek V3.2
- `coze://deepseek-r1-250528` - DeepSeek R1
- `coze://kimi-k2-5-260127` - Kimi 最强模型
- `coze://glm-5-0-260211` - GLM-5
- `coze://glm-5-turbo-260316` - GLM-5 Turbo
- `coze://glm-4-7-251222` - GLM-4.7
- `coze://minimax-m2-5-260212` - MiniMax M2.5
- `coze://minimax-m2-7-260318` - MiniMax M2.7
- `coze://qwen-3-5-plus-260215` - Qwen 3.5 Plus

**调用流程**：
1. 用户选择 `coze://` 前缀模型
2. 请求到达 `/api/v1/chat/completions`（框架鉴权）
3. `StationRegistry` 查找 `coze` 中转站
4. 中转站调用 `coze-coding-dev-sdk`，返回 OpenAI 兼容格式流