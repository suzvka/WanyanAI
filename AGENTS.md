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
- **API 路由**: `/api/v1/admin/verify` | `/api/v1/admin/stations` | `/api/v1/admin/config` | `/api/v1/admin/toggles`
- **认证方式**: 环境变量 `ADMIN_PASSWORD`，未设置时返回 503
- **会话管理**: httpOnly cookie，有效期由 `ADMIN_SESSION_MAX_AGE` 控制（默认 86400 秒 / 24 小时）

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
| `GenericDbConfigStore` | `CONFIG_STORE=db` | 通用 PostgreSQL `runtime_config` 表（DATABASE_PROVIDER 分派连接串） |

### 数据库

- `runtime_config` 表 - key-value 存储，用于 Admin 运行时配置持久化
- 连接串经 `resolveDatabaseUrl()`（`DATABASE_PROVIDER=postgres` 走 `DATABASE_URL`；`DATABASE_PROVIDER=coze` 走平台注入 `PG*` 组）
- 建表/迁移：`scripts/db-setup.sql`（幂等 DDL，`psql "$DATABASE_URL" -f scripts/db-setup.sql`）

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

### 平台认证登录（OAuth 2.0 授权码 + PKCE）

- **登录页面**: `/login`（生成 PKCE + state，弹窗打开平台认证服务 `/oauth/authorize`，授权后回跳 `/auth/callback`，回调页经 `postMessage` 把 code + state 回传主窗口）
- **Token 签发**: `POST /api/v1/auth/issue`（接收 `code` + `codeVerifier`，服务端用平台服务凭证换 access token → 取 userinfo → 以真实用户身份向鉴权中心签发 station token；客户端不提交任何用户信息）
- **登出吊销**: `POST /api/v1/auth/revoke`（委托鉴权中心 revokeToken，useAuth.logout 联动调用）
- **环境变量**: `PLATFORM_AUTH_URL`（平台认证面，以平台为本位命名，不绑定具体子服务）；凭证复用鉴权中心唯一凭证 `AUTH_CENTER_API_KEY`（client_secret = apiKey 明文，client_id = SHA-256(apiKey) 服务端派生，即 token_hash；单一凭证体系，不独立签发 OAuth 客户端凭证）。`PLATFORM_AUTH_URL` 与派生 client_id 经 `/api/v1/config` 运行时下发给浏览器

### 权限解析流程

```
客户端 Authorization: Bearer <token>
  → resolvePermission(key)
    → POST /api/v1/token/introspect { token }
      → { active, userId, claims.membershipLevel }
      → 映射为 permissionLevel
```
