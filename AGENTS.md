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

### 用户中心登录（OAuth 2.0 + PKCE）

采用标准 OAuth 2.0 Authorization Code + PKCE (S256) 流程，由云洲用户中心提供认证服务。

**登录流程**：

```
1. 用户点击"使用云洲账号登录"
     │
2.  前端生成 code_verifier（64~95 位随机字符串）
     │
3.  前端计算 code_challenge: Base64URL(SHA256(code_verifier))
     │
4.  302 跳转到云洲 OAuth 授权页:
     {providerUrl}/oauth/authorize
       ?response_type=code
       &client_id={clientId}
       &redirect_uri={origin}/oauth/callback
       &code_challenge=xxxxx
       &code_challenge_method=S256
       &state=random-csrf-token
     │
5.  用户在云洲认证（或已有 session 则跳过）
     │
6.  302 回跳至 /oauth/callback?code=xxx&state=yyy
     │
7.  前端回调页:
     - 校验 state（防 CSRF）
     - 读取 sessionStorage 中的 code_verifier
     - POST /api/v1/oauth/callback { code, code_verifier, redirect_uri }
     │
8.  后端:
     - 向云洲 POST /api/oauth/token 交换 access_token
     - 用 access_token 调云洲 GET /api/oauth/userinfo 获取用户信息
     - 调用鉴权中心签发 station token
     - 返回 station token + 用户信息
     │
9.  前端存储 station token 到 sessionStorage
     │
10. 跳转首页，登录完成
```

**核心文件**：

| 文件 | 说明 |
|------|------|
| `src/app/(auth)/login/page.tsx` | 登录页，生成 PKCE 参数并跳转到云洲 |
| `src/app/(auth)/oauth/callback/page.tsx` | OAuth 回调页，接收 code 并调用后端 |
| `src/app/api/v1/oauth/callback/route.ts` | 后端令牌交换 + 用户信息获取 + station token 签发 |
| `src/app/api/v1/auth/issue/route.ts` | 仍保留，用于直接签发 station token |
| `src/app/api/v1/config/route.ts` | 返回 OAuth 配置给前端 |

**环境变量**：

| 变量 | 说明 |
|------|------|
| `OAUTH_PROVIDER_URL` | 云洲 OAuth 服务 base URL（如 `https://yunzone.com`） |
| `OAUTH_CLIENT_ID` | 注册时分配的 client_id |
| `OAUTH_CLIENT_SECRET` | 注册时分配的 client_secret（机密客户端） |
| `AUTH_CENTER_URL` | 我方鉴权中心 base URL |
| `AUTH_CENTER_API_KEY` | 鉴权中心客户端凭证 |
| `AUTH_CENTER_PRODUCT_ID` | 产品标识 |

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

### 登录页 postMessage origin 校验导致第三方登录回调丢失（2026-08-23 → 已迁移至 OAuth 2.0）

**问题**：原 postMessage 弹窗模式下，用户中心域名 301 重定向到后台域名时，`e.origin` 校验失败，消息被静默丢弃。

**修复**：已从 postMessage + 弹窗模式**全面迁移至 OAuth 2.0 Authorization Code + PKCE 标准流程**，不再依赖 `e.origin` 做安全边界。详见上方「用户中心登录（OAuth 2.0 + PKCE）」章节。
