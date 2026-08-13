# 项目上下文

---

## ⚠️  重要提醒

**本项目的默认分支是 `master`，不是 `main`。**

在开始开发前，请确保你在正确的分支上

---

## 项目架构

### 中转站（Station）系统

`src/stations/` 目录管理所有 LLM 模型转发中转站：

| 文件 | 说明 |
|------|------|
| `types.ts` | `Station`, `AdminManagedStation`, `CredentialField`, `ModelToggle` 等核心类型 |
| `registry.ts` | `StationRegistry` - 注册/查找中转站，提供 `getAdminManagedStations()` |
| `loader.ts` | 初始化所有中转站 |
| `openai-forward/index.ts` | 从 `keys/*.json` 读取配置，转发到 OpenAI 兼容 API |
| `coze/index.ts` | Coze 内部模型，通过 `coze-coding-dev-sdk` 调用 |

### Admin 管理控制台

- **页面**: `/admin`（需手动输入 URL 访问）
- **API 路由**: `/api/v1/admin/verify` | `/stations` | `/config` | `/toggles`
- **认证方式**: 环境变量 `ADMIN_PASSWORD`，未设置时返回 503
- **会话管理**: httpOnly cookie，30 分钟过期

### 子站接入 Admin 管理

子站实现 `AdminManagedStation` 接口（可选），主入口自动发现并渲染配置 UI：

| 方法 | 说明 |
|------|------|
| `getCredentialSchema()` | 声明凭证字段定义（表单渲染用） |
| `getCredentialConfig()` | 读取当前凭证配置 |
| `updateCredentialConfig()` | 更新凭证配置，子站自行持久化 + 生效 |
| `getModelToggles()` | 读取模型启停状态 |
| `updateModelToggle()` | 更新单个模型启停状态 |

### ConfigStore（配置存储层）

`src/config-store/` 提供 KV 存储抽象：

| 实现 | 触发条件 | 说明 |
|------|---------|------|
| `FileConfigStore` | `CONFIG_STORE=file`（默认） | 写入 `runtime-config/<key>.json` |
| `CozeDbConfigStore` | `CONFIG_STORE=coze-db` | 写入 Supabase `runtime_config` 表 |
| `GenericDbConfigStore` | 预留 | 通用 PostgreSQL |

### 数据库

- `src/storage/database/shared/schema.ts` - Drizzle ORM 表定义
- `runtime_config` 表 - key-value 存储，用于 Admin 运行时配置持久化
- 使用 `coze-coding-ai db upgrade` 同步 schema 变更

---

## 产品线接入

### 鉴权中心（Token Authority Service）

`src/lib/auth-center/` 模块封装鉴权中心 API 调用（服务端专用）：

| 文件 | 说明 |
|------|------|
| `types.ts` | 请求/响应类型、会员等级→权限等级映射 |
| `client.ts` | HTTP 客户端：`issueToken` / `introspectToken` / `refreshToken` / `revokeToken` / `healthCheck` |

**环境变量**：

| 变量 | 说明 |
|------|------|
| `AUTH_CENTER_URL` | 鉴权服务 base URL |
| `AUTH_CENTER_API_KEY` | 客户端凭证（`sk-client-xxx`） |
| `AUTH_CENTER_PRODUCT_ID` | 产品标识（隔离边界） |

**会员等级映射**（`claims.membershipLevel` → `permissionLevel`）：

| membershipLevel | permissionLevel |
|-----------------|-----------------|
| `free` | 1 |
| `vip` | 2 |
| `svip` | 3 |
| `admin` | 99 |

### 用户中心登录

- **登录页面**: `/login`（iframe 嵌入用户中心登录组件）
- **Token 签发**: `POST /api/v1/auth/issue`（接收 accountToken + user，调用鉴权中心签发 station token）
- **环境变量**: `NEXT_PUBLIC_USER_CENTER_URL`（用户中心域名，用于 iframe src 和 postMessage origin 校验）

### 权限解析流程

```
客户端 Authorization: Bearer <token>
  → resolvePermission(key)
    → POST /api/v1/token/introspect { token }
      → { active, userId, claims.membershipLevel }
      → 映射为 permissionLevel
```
