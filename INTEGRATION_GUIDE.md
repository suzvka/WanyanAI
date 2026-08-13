# 第三方平台接入指南

> **产品名称**：Token 鉴权服务（Token Authority Service）
> **文档版本**：1.1

---

## 1. 概述

Token 鉴权服务是产品访问凭证（Token）的权威持有者，负责 Token 的生成、存储、验证、吊销和刷新。所有第三方平台通过统一的**客户端凭证（API Key）**进行认证，使用 `product_id` 做隔离边界。

| 概念 | 说明 |
|------|------|
| **客户端凭证（API Key）** | 第三方平台调用鉴权服务的身份凭证，格式 `sk-client-xxxxx` |
| **Token** | 为最终用户签发的访问凭证，不透明随机字符串 |
| **product_id** | 产品标识，隔离边界。一个凭证只能操作一个产品下的 Token |
| **replace 语义** | 同一 (userId, productId) 至多一个活跃 Token，重复签发自动替换旧 Token |

---

## 2. 接入流程概览

```
1. 管理员签发客户端凭证 → 获得 API Key（仅此一次）
2. 使用 API Key 调用 Token 接口 → 为用户签发/校验 Token
3. 在业务中校验 Token → 通过 introspect 确认用户身份
```

---

## 3. 获取客户端凭证

联系鉴权服务管理员，通过管理后台签发。管理员需要提供：

| 字段 | 说明 | 示例 |
|------|------|------|
| `name` | 凭证名称 | `用户中心` |
| `description` | 用途说明（可选） | `用户中心后端服务` |
| `productId` | 产品标识，隔离边界 | `user-center` |
| `expiresInDays` | 有效期（天） | `365` |
| `autoRenew` | 是否自动续签 | `true` |

签发成功后获得证书 JSON，**请立即保存 API Key**，关闭后将无法再次获取明文 Key。

```json
{
  "version": "1.0",
  "type": "client-credential",
  "issuer": "token-authority",
  "client": {
    "id": "a1b2c3d4-...",
    "name": "用户中心",
    "productId": "user-center",
    "status": "active",
    "expiresAt": "2026-01-01T00:00:00.000Z",
    "autoRenew": true,
    "autoRenewDays": 30
  },
  "apiKey": "sk-client-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "endpoints": {
    "issue": "/api/v1/token/issue",
    "revoke": "/api/v1/token/revoke",
    "refresh": "/api/v1/token/refresh",
    "introspect": "/api/v1/token/introspect"
  }
}
```

> ⚠️ `apiKey` 仅在签发时返回一次，DB 仅存加盐哈希。请存入环境变量或密钥管理服务，**严禁**嵌入客户端代码。

---

## 4. 使用凭证调用 API

### 认证方式

所有 API（除健康检查）均需通过 HTTP Bearer 携带客户端凭证：

```
Authorization: Bearer sk-client-xxxxxxxxxxxxxxxxxxxxxxxxxxxx
Content-Type: application/json
```

### 基础 URL

```
https://<auth-server-domain>
```

---

## 5. API 参考

### 5.1 健康检查

**端点**：`GET /api/healthz`

**凭证**：不需要

**用途**：验证服务可用性和数据库连通性。

```bash
curl https://<auth-server-domain>/api/healthz
```

**响应（正常）**：

```json
{ "status": "ok", "db": "ok", "timestamp": "2025-01-01T00:00:00.000Z" }
```

**响应（异常，HTTP 503）**：

```json
{ "status": "error", "db": "unreachable", "timestamp": "2025-01-01T00:00:00.000Z" }
```

---

### 5.2 颁发 Token

**端点**：`POST /api/v1/token/issue`

**凭证**：需要

**用途**：为用户颁发访问 Token。同一 (userId, productId) 重复签发会替换旧 Token（replace 语义）。

scope 是 Token 的权限标签，用于产品服务做权限校验，语义由业务方自行定义 —— 可以是 ["read", "write"]、["product:read", "product:admin"] 等任意字符串数组。

**请求体**：

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `userId` | string | 是 | — | 用户唯一标识 |
| `productId` | string | 是 | — | 产品标识 |
| `scope` | string[] | 否 | `[]` | 权限范围列表 |
| `claims` | object | 否 | `{}` | 自定义声明 |
| `ttl` | number | 否 | `86400` | 有效期（秒），默认 24 小时 |

```bash
curl -X POST https://<auth-server-domain>/api/v1/token/issue \
  -H "Authorization: Bearer sk-client-xxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user_123456",
    "productId": "user-center",
    "scope": ["read", "write"],
    "claims": {"role": "vip"},
    "ttl": 3600
  }'
```

**成功响应**：

```json
{
  "token": "9XkLqR3mZvW7pB2nF5cH8jA1sD4gY6eT0uI",
  "expiresAt": "2025-01-01T01:00:00.000Z",
  "userId": "user_123456",
  "productId": "user-center",
  "scope": ["read", "write"]
}
```

**失败响应**：

| HTTP | code | 场景 |
|------|------|------|
| 400 | `INVALID_REQUEST` | 参数缺失或格式错误 |
| 401 | `UNAUTHENTICATED` | 客户端凭证无效 |
| 429 | `RATE_LIMITED` | 请求频率超限 |

---

### 5.3 校验 Token

**端点**：`POST /api/v1/token/introspect`

**凭证**：需要

**用途**：校验 Token 有效性，获取关联的用户信息和权限。对无效 Token 统一返回 `200 + {"active": false}`，防枚举攻击。

**请求体**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `token` | string | 是 | 待校验的 Token |
| `scope` | string[] | 否 | 检查 Token 是否包含指定权限（子集校验） |

```bash
# 仅校验有效性
curl -X POST https://<auth-server-domain>/api/v1/token/introspect \
  -H "Authorization: Bearer sk-client-xxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{"token": "9XkLqR3mZvW7pB2nF5cH8jA1sD4gY6eT0uI"}'

# 带 scope 校验
curl -X POST https://<auth-server-domain>/api/v1/token/introspect \
  -H "Authorization: Bearer sk-client-xxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{"token": "9XkLqR3mZvW7pB2nF5cH8jA1sD4gY6eT0uI", "scope": ["read"]}'
```

**响应（Token 有效）**：

```json
{
  "active": true,
  "userId": "user_123456",
  "productId": "user-center",
  "scope": ["read", "write"],
  "claims": {"role": "vip"},
  "expiresAt": "2025-01-01T01:00:00.000Z"
}
```

**响应（Token 无效 / 过期 / 吊销 / 权限不足 — 统一返回 200）**：

```json
{ "active": false }
```

---

### 5.4 刷新 Token

**端点**：`POST /api/v1/token/refresh`

**凭证**：需要

**用途**：延长 Token 过期时间。Token 必须为 `active` 状态。

**请求体**：

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `token` | string | 是 | — | 待续期的 Token |
| `ttl` | number | 否 | `86400` | 续期后有效期（秒） |

```bash
curl -X POST https://<auth-server-domain>/api/v1/token/refresh \
  -H "Authorization: Bearer sk-client-xxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{"token": "9XkLqR3mZvW7pB2nF5cH8jA1sD4gY6eT0uI", "ttl": 7200}'
```

**成功响应**：

```json
{ "success": true, "expiresAt": "2025-01-01T03:00:00.000Z" }
```

**失败响应**：

| HTTP | code | 场景 |
|------|------|------|
| 404 | `TOKEN_NOT_FOUND` | Token 不存在 |
| 400 | `TOKEN_NOT_ACTIVE` | Token 不处于活跃状态 |

---

### 5.5 吊销 Token

**端点**：`POST /api/v1/token/revoke`

**凭证**：需要

**用途**：吊销 Token。支持两种方式（二选一）：
- 按 Token 值吊销单个
- 按 userId + productId 批量吊销该用户所有活跃 Token

**请求体**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `token` | string | 二选一 | 按 Token 值吊销 |
| `userId` | string | 二选一 | 按用户批量吊销 |
| `productId` | string | 是 | 产品标识 |

**按 Token 值吊销**：

```bash
curl -X POST https://<auth-server-domain>/api/v1/token/revoke \
  -H "Authorization: Bearer sk-client-xxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{"token": "9XkLqR3mZvW7pB2nF5cH8jA1sD4gY6eT0uI", "productId": "user-center"}'
```

**按 userId + productId 批量吊销**：

```bash
curl -X POST https://<auth-server-domain>/api/v1/token/revoke \
  -H "Authorization: Bearer sk-client-xxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{"userId": "user_123456", "productId": "user-center"}'
```

**成功响应**：

```json
{ "success": true }
```

**失败响应**：

| HTTP | code | 场景 |
|------|------|------|
| 404 | `TOKEN_NOT_FOUND` | Token 不存在（按 token 吊销时） |
| 400 | `INVALID_REQUEST` | 未指定 token 或 userId |

---

## 6. 代码示例（Node.js / TypeScript）

```typescript
const AUTH_SERVER = 'https://<auth-server-domain>';
const API_KEY = 'sk-client-xxxxxxxxxxxxxxxxxxxxxxxxxxxx';

const headers = {
  'Authorization': `Bearer ${API_KEY}`,
  'Content-Type': 'application/json',
};

/** 颁发 Token */
async function issueToken(params: {
  userId: string; productId: string; scope?: string[];
  claims?: Record<string, unknown>; ttl?: number;
}) {
  const res = await fetch(`${AUTH_SERVER}/api/v1/token/issue`, {
    method: 'POST', headers, body: JSON.stringify(params),
  });
  if (!res.ok) { const err = await res.json(); throw new Error(`[${err.code}] ${err.message}`); }
  return res.json();
}

/** 校验 Token */
async function introspectToken(token: string, scope?: string[]) {
  const res = await fetch(`${AUTH_SERVER}/api/v1/token/introspect`, {
    method: 'POST', headers, body: JSON.stringify({ token, scope }),
  });
  return res.json();
}

/** 刷新 Token */
async function refreshToken(token: string, ttl?: number) {
  const res = await fetch(`${AUTH_SERVER}/api/v1/token/refresh`, {
    method: 'POST', headers, body: JSON.stringify({ token, ttl }),
  });
  if (!res.ok) { const err = await res.json(); throw new Error(`[${err.code}] ${err.message}`); }
  return res.json();
}

/** 吊销 Token */
async function revokeToken(params: { token?: string; userId?: string; productId: string }) {
  const res = await fetch(`${AUTH_SERVER}/api/v1/token/revoke`, {
    method: 'POST', headers, body: JSON.stringify(params),
  });
  if (!res.ok) { const err = await res.json(); throw new Error(`[${err.code}] ${err.message}`); }
  return res.json();
}

// 使用示例
async function example() {
  const { token } = await issueToken({ userId: 'user_123456', productId: 'user-center', scope: ['read'], ttl: 3600 });
  const info = await introspectToken(token);
  if (info.active) console.log(`用户 ${info.userId} 验证通过`);
  await revokeToken({ token, productId: 'user-center' });
}
```

---

## 7. 错误处理

所有错误响应统一格式：

```json
{ "code": "MACHINE_READABLE_CODE", "message": "人类可读描述" }
```

| 错误码 | HTTP | 说明 | 重试策略 |
|--------|------|------|----------|
| `INVALID_REQUEST` | 400 | 参数缺失或格式错误 | 不重试，检查参数 |
| `UNAUTHENTICATED` | 401 | 客户端凭证无效 | 不重试，检查凭证 |
| `TOKEN_NOT_FOUND` | 404 | Token 不存在 | 不重试 |
| `TOKEN_NOT_ACTIVE` | 400 | Token 不处于活跃状态 | 不重试 |
| `RATE_LIMITED` | 429 | 请求频率超限 | 等待 `Retry-After` 秒后重试 |
| `INTERNAL` | 502 | 内部服务错误 | 等 1-3 秒后重试，最多 3 次 |

---

## 8. 安全要求

1. **服务端使用**：API Key 仅用于服务端到服务端通信，**严禁**嵌入客户端代码（浏览器、移动 App）
2. **安全存储**：API Key 存入环境变量或密钥管理服务，不得硬编码入仓库
3. **最小权限**：每个产品使用独立 `productId` 和凭证，避免一个凭证泄露影响所有产品
4. **Token 短期有效**：TTL 建议设为 1 小时，降低泄露风险
5. **服务端校验**：所有受保护接口必须在服务端调用 `introspect` 校验 Token，不要信任客户端传来的任何信息

---

## 9. 常见问题

**Q: 如何判断 Token 过期？**
调用 `introspect`，返回 `{active: false}` 即表示无效。不要依赖 Token 字符串本身（Token 不透明，不包含业务信息）。

**Q: 用户登录后应该签发 Token 还是 API Key？**
Token 给最终用户，API Key 给你的后端服务。用户登录 → 调用 `issue` 签发 Token → 返回客户端。后端调用鉴权服务 → 使用 API Key 认证。

**Q: 一个用户可以拥有多个 Token 吗？**
同一 (userId, productId) 至多一个活跃 Token。重复签发会自动替换旧的。

**Q: 凭证过期了怎么办？**
开启自动续签的凭证会在过期时自动续期。未开启的需联系管理员手动续期。

**Q: 如何批量吊销某用户的所有 Token？**
调用 `revoke` 接口，传入 `userId` + `productId`（不传 `token`）。