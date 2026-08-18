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
| `GenericDbConfigStore` | `CONFIG_STORE=db` | 通用 PostgreSQL `runtime_config` 表（DATABASE_PROVIDER 分派连接串） |

### 数据库

- `src/storage/database/shared/schema.ts` - Drizzle ORM 表定义（`runtime_config` / `health_check`）
- `runtime_config` 表 - key-value 存储，用于 Admin 运行时配置持久化
- 连接串经 `resolveDatabaseUrl()`（`DATABASE_PROVIDER=postgres` 走 `DATABASE_URL`；`DATABASE_PROVIDER=coze` 走平台注入 `PG*` 组）
- 建表/迁移：`scripts/db-setup.sql`（幂等 DDL，`psql "$DATABASE_URL" -f scripts/db-setup.sql`）或 drizzle-kit

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

- **登录页面**: `/login`（弹窗打开用户中心嵌入登录页，`postMessage` 回传登录结果）
- **Token 签发**: `POST /api/v1/auth/issue`（接收 accountToken + user，调用鉴权中心签发 station token）
- **环境变量**: `USER_CENTER_URL`（用户中心服务端地址，经 `/api/v1/config` 运行时下发给浏览器，用于弹窗 src 与 postMessage origin 校验）

### 权限解析流程

```
客户端 Authorization: Bearer <token>
  → resolvePermission(key)
    → POST /api/v1/token/introspect { token }
      → { active, userId, claims.membershipLevel }
      → 映射为 permissionLevel
```

---

## 已知问题与修复记录

### SSR 场景下 `useAuth` 读取不到 sessionStorage（2026-08-13）

**问题**：用户登录后页面仍显示"未登录状态"。

**根因**：`useAuth` 使用 `useState(readInitialState)` 初始化，但 Next.js App Router 中 `useState` 初始化器在服务端 SSR/RSC 渲染时执行，此时 `typeof window === 'undefined'`，无法读取 `sessionStorage`。服务端序列化的状态在客户端水合时直接使用，初始化器不会再次执行。

**修复**：在 `useAuth` 中添加 `useEffect`，客户端挂载后重新调用 `readInitialState()` 从 `sessionStorage` 读取实际状态，与服务端状态不一致时更新 React state。
