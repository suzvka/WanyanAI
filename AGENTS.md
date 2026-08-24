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
| `openai-forward/index.ts` | 模型配置经 ConfigStore 读写（`keys/*.json` 仅作首次种子导入），转发到 OpenAI 兼容 API |
| `coze/index.ts` | Coze 内部模型，通过 `coze-coding-dev-sdk` 调用 |

### Admin 管理控制台

- **页面**: `/admin`（需手动输入 URL 访问）
  - 前端按模块拆分于 `src/app/admin/`：`page.tsx`（认证 + Shell 双栏布局）、`login.tsx`（登录页）、`station-nav.tsx`（左侧站点导航）、`credential-editor.tsx`（凭证配置：Collapsible 模型卡片 + Dialog 添加 + AlertDialog 删除 + Sticky 保存栏 + sonner toast）、`model-toggles.tsx`（模型启停：状态徽章 + 统计概览 + 即时保存）、`types.ts`（共享类型）
- **API 路由**: `/api/v1/admin/verify` | `/api/v1/admin/stations` | `/api/v1/admin/config` | `/api/v1/admin/toggles`
- **认证方式**: 环境变量 `ADMIN_PASSWORD`，未设置时返回 503
- **会话管理**: httpOnly cookie（无状态 HMAC 签名，不存服务端会话；改密码即全部失效），有效期由 `ADMIN_SESSION_MAX_AGE` 控制（默认 86400 秒 / 24 小时）

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

`src/config-store/` 提供 KV 存储，**统一构建在数据库抽象（SqlDb）之上，无独立存储开关**：

| 实现 | 渠道（DATABASE_PROVIDER） | 说明 |
|------|---------|------|
| `SqlDbConfigStore` | 全部 | `runtime_config` 表 KV 视图，底层 `SqlDb` 由工厂注入 |
| `PgSqlDb`（kit） | `postgres` / `coze` | 官方 PostgreSQL 适配（凭证按渠道解析） |
| `FileSqlDb` | `none` | 本地 json 文件模拟数据库行为（`runtime-config/db.json`），无需真实库 |

渠道唯一来源 = `DATABASE_PROVIDER`（`postgres` / `coze` / `none`），经 `resolveDatabaseChannel()` 解析后由 `getConfigStore()` 分派。

### 数据库

- `runtime_config` 表 - key-value 存储，用于 Admin 运行时配置持久化
- 渠道经 `resolveDatabaseChannel()`（`DATABASE_PROVIDER=postgres` 走 `DATABASE_URL`；`DATABASE_PROVIDER=coze` 走平台注入 `PG*` 组；`none` 走 `FileSqlDb` 本地 json 模拟）
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
- **登出（单点登出联动）**: `useAuth.logout` 三段式——① 等待 `POST /api/v1/auth/revoke`（委托鉴权中心 revokeToken，失败降级仅本地登出）② 清空本地登录态（sessionStorage + 内存缓存）③ 浏览器跳转平台登出端点 `${PLATFORM_AUTH_URL}/api/oauth/logout?client_id=...&redirect_uri=...&state=...` 销毁平台会话。**登出回跳复用已登记的授权回调 `/auth/callback`**（OIDC 允许登出回跳复用授权回调白名单地址，避免平台端 redirect_uri 白名单校验失败返回 400）；回调页凭参数区分场景——授权回调带 `code`/`error`（弹窗回传 + close），登出回跳仅带 `state`（顶层导航，校验 state 防伪造后展示已退出，**不可 close**）。平台未配置时降级为仅本地登出并回首页
- **环境变量**: `PLATFORM_AUTH_URL`（平台认证面，以平台为本位命名，不绑定具体子服务）；凭证复用鉴权中心唯一凭证 `AUTH_CENTER_API_KEY`（client_secret = apiKey 明文，client_id = SHA-256(apiKey) 服务端派生，即 token_hash；单一凭证体系，不独立签发 OAuth 客户端凭证）。`PLATFORM_AUTH_URL` 与派生 client_id 经 `/api/v1/config` 运行时下发给浏览器

### 权限解析流程

```
客户端 Authorization: Bearer <token>
  → resolvePermission(key)
    → POST /api/v1/token/introspect { token }
      → { active, userId, claims.membershipLevel }
      → 映射为 permissionLevel
```
