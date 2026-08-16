# 云洲用户中心 API 文档

> 云洲作为用户中心，对外提供标准化的**认证服务**（OAuth 2.0）和**用户管理服务**（SCIM 2.0）。

---

## 目录

- [OAuth 2.0 认证服务](#oauth-20-认证服务)
  - [注册客户端](#注册客户端)
  - [授权登录 (GET /oauth/authorize)](#1-授权登录-get-oauthauthorize)
  - [令牌交换 (POST /api/oauth/token)](#2-令牌交换-post-apioauthtoken)
  - [刷新令牌 (POST /api/oauth/token)](#3-刷新令牌-post-apioauthtoken)
  - [用户信息 (GET /api/oauth/userinfo)](#4-用户信息-get-apioauthuserinfo)
  - [令牌吊销 (POST /api/oauth/revoke)](#5-令牌吊销-post-apioauthrevoke)
- [SCIM 2.0 用户管理](#scim-20-用户管理)
  - [鉴权方式](#鉴权方式)
  - [服务配置 (GET /api/scim/v2/ServiceProviderConfig)](#1-服务配置-get-apiscimv2serviceproviderconfig)
  - [Schema 查询 (GET /api/scim/v2/Schemas)](#2-schema-查询-get-apiscimv2schemas)
  - [用户列表 (GET /api/scim/v2/Users)](#3-用户列表-get-apiscimv2users)
  - [创建用户 (POST /api/scim/v2/Users)](#4-创建用户-post-apiscimv2users)
  - [用户详情 (GET /api/scim/v2/Users/{id})](#5-用户详情-get-apiscimv2usersid)
  - [全量更新 (PUT /api/scim/v2/Users/{id})](#6-全量更新-put-apiscimv2usersid)
  - [部分更新 (PATCH /api/scim/v2/Users/{id})](#7-部分更新-patch-apiscimv2usersid)
  - [删除用户 (DELETE /api/scim/v2/Users/{id})](#8-删除用户-delete-apiscimv2usersid)
- [接入示例](#接入示例)
  - [用户登录流程](#用户登录流程)
  - [用户管理流程](#用户管理流程)
- [附录](#附录)
  - [错误码速查](#错误码速查)
  - [SCIM 用户字段映射](#scim-用户字段映射)

---

## OAuth 2.0 认证服务

### 基础信息

| 项目 | 值 |
|------|-----|
| 协议标准 | RFC 6749 + RFC 7636 (PKCE) |
| 授权方式 | Authorization Code + PKCE (S256) |
| Access Token 格式 | Token Authority Service 签发证书 |
| Access Token 有效期 | 24 小时（用户令牌） |
| Refresh Token 有效期 | 30 天 |
| PKCE | **强制**，仅支持 `S256` |

### 注册客户端

业务系统接入前，需先在云洲注册 OAuth 客户端：

```sql
-- 示例：注册 AI 文本分析平台
INSERT INTO oauth_client (client_id, client_secret, client_name, redirect_uris, allowed_grants, is_confidential)
VALUES (
  'ai-text-analysis',                    -- 客户端标识（唯一）
  '生成的随机密钥',                        -- 机密客户端必填，公开客户端为 NULL
  'AI 文本分析平台',                       -- 展示名称
  ARRAY['https://ai-platform.com/oauth/callback'],  -- 允许的回调地址
  ARRAY['authorization_code', 'client_credentials'],  -- 允许的授权类型
  true                                    -- 是否机密客户端
);
```

| 字段 | 说明 |
|------|------|
| `client_id` | 业务系统唯一标识，建议使用英文短横线风格 |
| `client_secret` | 机密客户端使用，公开客户端为 `null` |
| `is_confidential` | `true` = 后端有 client_secret 保护；`false` = 纯前端应用 |
| `redirect_uris` | 允许的 OAuth 回调地址列表，域名必须匹配 |

---

### 1. 授权登录 (GET /oauth/authorize)

**用途：** 用户授权入口，业务系统将用户重定向到此地址。

**请求方式：** 浏览器 302 跳转

**URL：**

```
GET https://yunzone.com/oauth/authorize
```

**查询参数：**

| 参数 | 必填 | 说明 |
|------|------|------|
| `response_type` | ✅ | 固定为 `code` |
| `client_id` | ✅ | 注册时分配的 client_id |
| `redirect_uri` | ✅ | 回调地址，必须匹配注册时的白名单 |
| `code_challenge` | ✅ | PKCE S256 摘要，由业务系统前端生成 |
| `code_challenge_method` | ✅ | 固定为 `S256` |
| `state` | ✅ | CSRF 令牌，回跳时原样返回 |

**流程：**

```
业务系统前端
  │
  ├─ 生成 code_verifier (43~128 位随机字符串)
  ├─ SHA256(code_verifier) → Base64URL → code_challenge
  │
  └─ 302 跳转到云洲:
     https://yunzone.com/oauth/authorize
       ?response_type=code
       &client_id=ai-text-analysis
       &redirect_uri=https://ai-platform.com/oauth/callback
       &code_challenge=xxxxx
       &code_challenge_method=S256
       &state=random-csrf-token
       │
       ▼
     云洲处理:
       1. 验证 response_type / client_id / redirect_uri / code_challenge_method
       2. 未登录 → 302 到 /sign-in
       3. 已登录 → 渲染授权页 (展示客户端名称 + 权限)
       4. 用户点击"授权" → 生成授权码
       5. 302 回跳: {redirect_uri}?code={code}&state={state}
```

**授权页示例：**

```
┌────────────────────────────────┐
│  「AI 文本分析平台」请求访问你的   │
│  √ 查看你的基本信息              │
│  √ 验证你的身份                  │
│                                │
│      [ 拒绝 ]  [ 授权 ]         │
└────────────────────────────────┘
```

**响应（成功）：**

```
302 Found
Location: https://ai-platform.com/oauth/callback?code=abc123def456&state=random-csrf-token
```

**响应（错误）：**

```
302 Found
Location: https://ai-platform.com/oauth/callback?error=access_denied&error_description=User+denied+authorization&state=random-csrf-token
```

---

### 2. 令牌交换 (POST /api/oauth/token)

**用途：** 业务系统后端用授权码交换 access_token。

**请求方式：** Server-to-Server，`application/x-www-form-urlencoded`

**URL：**

```
POST https://yunzone.com/api/oauth/token
```

#### 2.1 Authorization Code 模式（用户登录）

**请求体：**

| 参数 | 必填 | 说明 |
|------|------|------|
| `grant_type` | ✅ | `authorization_code` |
| `code` | ✅ | 上一步获取的授权码 |
| `code_verifier` | ✅ | 步骤 1 生成的原始 code_verifier |
| `redirect_uri` | ✅ | 必须与授权请求一致 |
| `client_id` | ✅ | 客户端标识 |
| `client_secret` | 视情况 | 机密客户端必填 |

**成功响应 (200)：**

```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIs...",
  "token_type": "Bearer",
  "expires_in": 86400,
  "refresh_token": "550e8400-e29b-41d4-a716-446655440000",
  "scope": "openid profile"
}
```

#### 2.2 Client Credentials 模式（服务间调用）

**用途：** 用于 SCIM 用户管理 API 的鉴权。

**请求体：**

| 参数 | 必填 | 说明 |
|------|------|------|
| `grant_type` | ✅ | `client_credentials` |
| `client_id` | ✅ | 注册时分配的 client_id |
| `client_secret` | 视情况 | 机密客户端必填 |
| `scope` | 可选 | 仅支持 `scim`，默认 `scim` |

**成功响应 (200)：**

```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIs...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "scope": "scim"
}
```

> `client_credentials` 的 token 仅用于调用 SCIM 接口，有效期为 1 小时。

**错误响应 (400)：**

```json
{
  "error": "invalid_grant",
  "error_description": "Authorization code not found"
}
```

| 错误码 | 说明 |
|--------|------|
| `invalid_request` | 缺少必填参数 |
| `invalid_grant` | 授权码无效、已使用、或 code_verifier 不匹配 |
| `invalid_client` | client_id 或 client_secret 错误 |
| `unauthorized_client` | 该 grant_type 未被客户端授权 |
| `unsupported_grant_type` | 不支持的 grant_type |
| `invalid_scope` | scope 参数无效 |
| `server_error` | 服务器内部错误 |

---

### 3. 刷新令牌 (POST /api/oauth/token)

**用途：** 使用 refresh_token 获取新的 access_token，避免用户频繁重新登录。

**请求方式：** Server-to-Server，`application/x-www-form-urlencoded`

**URL：**

```
POST https://yunzone.com/api/oauth/token
```

**请求体：**

| 参数 | 必填 | 说明 |
|------|------|------|
| `grant_type` | ✅ | `refresh_token` |
| `refresh_token` | ✅ | 之前获取的 refresh_token |
| `client_id` | ✅ | 客户端标识 |
| `client_secret` | 视情况 | 机密客户端必填 |

**成功响应 (200)：**

```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIs...",
  "token_type": "Bearer",
  "expires_in": 86400,
  "refresh_token": "660e8400-e29b-41d4-a716-446655440001",
  "scope": "openid profile"
}
```

> 每次刷新会同时签发新的 access_token 和新的 refresh_token，旧的 refresh_token 被吊销。

---

### 4. 用户信息 (GET /api/oauth/userinfo)

**用途：** 凭 access_token 获取已登录用户的基本信息。

**请求方式：** GET

**URL：**

```
GET https://yunzone.com/api/oauth/userinfo
```

**请求头：**

```
Authorization: Bearer {access_token}
```

**成功响应 (200)：**

```json
{
  "sub": "user-uuid",
  "name": "张三",
  "preferred_username": "zhangsan@example.com",
  "email": "zhangsan@example.com",
  "email_verified": true,
  "updated_at": 1704067200
}
```

> 邮箱从 `socialAccount` 渠道（`provider=email`）获取，非 `user` 表字段。

**错误响应 (401)：**

```json
{
  "error": "invalid_token",
  "error_description": "Token expired or revoked"
}
```

---

### 5. 令牌吊销 (POST /api/oauth/revoke)

**用途：** 主动吊销 access_token 或 refresh_token（如用户登出）。

**请求方式：** POST，`application/x-www-form-urlencoded`

**URL：**

```
POST https://yunzone.com/api/oauth/revoke
```

**请求体：**

| 参数 | 必填 | 说明 |
|------|------|------|
| `token` | ✅ | 要吊销的令牌 |
| `token_type_hint` | 可选 | `access_token` 或 `refresh_token` |

**成功响应：** `200 OK`（空 body）

```json
{}
```

> 按 RFC 7009 规范，无论 token 是否存在，均返回 `200 OK`。

---

## SCIM 2.0 用户管理

### 基础信息

| 项目 | 值 |
|------|-----|
| 协议标准 | RFC 7644 (SCIM 2.0) |
| 基础路径 | `/api/scim/v2` |
| 鉴权方式 | `Bearer {access_token}` (来自 client_credentials grant) |
| Content-Type | `application/scim+json` |
| 分页参数 | `startIndex` (1-based), `count` (默认 20, 最大 100) |
| 过滤语法 | 仅支持 `eq` 操作符：`userName eq "xxx"` 或 `emails eq "xxx"` |

### 鉴权方式

所有 SCIM 请求必须在 `Authorization` 头中携带通过 `client_credentials` 获取的 access_token：

```
POST https://yunzone.com/api/oauth/token
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials
&client_id=ai-text-analysis
&client_secret=your-secret-here
&scope=scim
```

```
GET https://yunzone.com/api/scim/v2/Users
Authorization: Bearer {scim-access-token}
```

---

### 1. 服务配置 (GET /api/scim/v2/ServiceProviderConfig)

**用途：** 获取 SCIM 服务提供商的能力信息。

**成功响应 (200)：**

```json
{
  "schemas": ["urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig"],
  "patch": { "supported": true },
  "bulk": { "supported": false },
  "filter": { "supported": true, "maxResults": 100 },
  "changePassword": { "supported": false },
  "authenticationSchemes": [
    {
      "type": "oauthbearertoken",
      "name": "OAuth Bearer Token",
      "description": "Authentication via OAuth 2.0 Bearer Token (client_credentials grant)"
    }
  ]
}
```

---

### 2. Schema 查询 (GET /api/scim/v2/Schemas)

**用途：** 获取 SCIM 资源类型的 Schema 定义，包含 User 核心 Schema 和企业扩展 Schema。

**成功响应 (200)：**

```json
{
  "schemas": ["urn:ietf:params:scim:api:messages:2.0:ListResponse"],
  "totalResults": 2,
  "Resources": [
    {
      "id": "urn:ietf:params:scim:schemas:core:2.0:User",
      "name": "User",
      "description": "User Account",
      "attributes": [
        { "name": "id", "type": "string", "required": true, "mutability": "readOnly", "return": "always" },
        { "name": "userName", "type": "string", "required": true, "mutability": "readWrite", "return": "default" },
        { "name": "displayName", "type": "string", "required": false, "mutability": "readWrite", "return": "default" },
        { "name": "emails", "type": "complex", "required": false, "mutability": "readWrite", "return": "default" },
        { "name": "active", "type": "boolean", "required": false, "mutability": "readWrite", "return": "default" }
      ]
    },
    {
      "id": "urn:ietf:params:scim:schemas:extension:enterprise:2.0:User",
      "name": "EnterpriseUser",
      "description": "Enterprise User Extension",
      "attributes": [
        { "name": "department", "type": "string", "required": false, "mutability": "readWrite", "return": "default" }
      ]
    }
  ]
}
```

---

### 3. 用户列表 (GET /api/scim/v2/Users)

**用途：** 获取用户列表，支持搜索和分页。

**查询参数：**

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `filter` | 过滤条件，支持 `userName eq "xxx"` 或 `emails eq "xxx"` | 无 |
| `startIndex` | 起始索引 (1-based) | 1 |
| `count` | 每页数量 (最大 100) | 20 |

**成功响应 (200)：**

```json
{
  "schemas": ["urn:ietf:params:scim:api:messages:2.0:ListResponse"],
  "totalResults": 42,
  "startIndex": 1,
  "itemsPerPage": 20,
  "Resources": [
    {
      "schemas": ["urn:ietf:params:scim:schemas:core:2.0:User"],
      "id": "a1b2c3d4-...",
      "userName": "user@example.com",
      "displayName": "张三",
      "emails": [{ "value": "user@example.com", "primary": true }],
      "active": true,
      "meta": {
        "resourceType": "User",
        "created": "2024-01-01T00:00:00Z",
        "lastModified": "2024-01-01T00:00:00Z"
      },
      "urn:ietf:params:scim:schemas:extension:enterprise:2.0:User": {
        "department": "User"
      }
    }
  ]
}
```

> 注意：`userName` 和 `emails` 的值来自 `socialAccount` 渠道（`provider=email` 的 `providerOpenid`），而非 `user` 表。

**搜索示例：**

```
GET /api/scim/v2/Users?filter=userName eq "zhangsan@example.com"
GET /api/scim/v2/Users?filter=emails eq "zhangsan@example.com"
GET /api/scim/v2/Users?startIndex=1&count=50
```

---

### 4. 创建用户 (POST /api/scim/v2/Users)

**用途：** 创建新用户。

**请求体：**

```json
{
  "schemas": ["urn:ietf:params:scim:schemas:core:2.0:User"],
  "userName": "newuser@example.com",
  "displayName": "新用户",
  "emails": [{ "value": "newuser@example.com", "primary": true }],
  "active": true,
  "urn:ietf:params:scim:schemas:extension:enterprise:2.0:User": {
    "department": "Administrator"
  }
}
```

| 字段 | 必填 | 说明 |
|------|------|------|
| `userName` | ✅ | 用户名，通常为邮箱 |
| `displayName` | 可选 | 显示名称 |
| `emails[0].value` | 可选 | 邮箱地址 |
| `active` | 可选 | 默认 `true` |
| `department` | 可选 | `"User"` 或 `"Administrator"`（对应 `user.role` 字段，默认 `"User"`） |

**成功响应 (201)：**

```json
{
  "schemas": ["urn:ietf:params:scim:schemas:core:2.0:User"],
  "id": "newly-created-uuid",
  "userName": "newuser@example.com",
  "displayName": "新用户",
  "emails": [{ "value": "newuser@example.com", "primary": true }],
  "active": true,
  "meta": {
    "resourceType": "User",
    "created": "2024-01-01T00:00:00Z",
    "lastModified": "2024-01-01T00:00:00Z"
  },
  "urn:ietf:params:scim:schemas:extension:enterprise:2.0:User": {
    "department": "Administrator"
  }
}
```

**错误响应 (409)：**

```json
{
  "schemas": ["urn:ietf:params:scim:api:messages:2.0:Error"],
  "detail": "User with this email already exists",
  "status": 409
}
```

---

### 5. 用户详情 (GET /api/scim/v2/Users/{id})

**用途：** 获取单个用户的详细信息。

**成功响应 (200)：**

```json
{
  "schemas": ["urn:ietf:params:scim:schemas:core:2.0:User"],
  "id": "a1b2c3d4-...",
  "userName": "user@example.com",
  "displayName": "张三",
  "emails": [{ "value": "user@example.com", "primary": true }],
  "active": true,
  "meta": {
    "resourceType": "User",
    "created": "2024-01-01T00:00:00Z",
    "lastModified": "2024-01-01T00:00:00Z"
  },
  "urn:ietf:params:scim:schemas:extension:enterprise:2.0:User": {
    "department": "User"
  }
}
```

**错误响应 (404)：**

```json
{
  "schemas": ["urn:ietf:params:scim:api:messages:2.0:Error"],
  "detail": "User not found",
  "status": 404
}
```

---

### 6. 全量更新 (PUT /api/scim/v2/Users/{id})

**用途：** 全量替换用户信息（缺失字段将被重置）。

**请求体：**

```json
{
  "schemas": ["urn:ietf:params:scim:schemas:core:2.0:User"],
  "userName": "user@example.com",
  "displayName": "张三（已更新）",
  "emails": [{ "value": "new-email@example.com", "primary": true }],
  "active": true,
  "urn:ietf:params:scim:schemas:extension:enterprise:2.0:User": {
    "department": "Administrator"
  }
}
```

**成功响应 (200)：** 返回更新后的完整用户对象。

> 支持更新的字段：`displayName`（映射到 `user.name`）、`active`（映射到 `user.emailVerified`）、`emails`（更新 `socialAccount` 渠道邮箱）、`department`（映射到 `user.role`）。

---

### 7. 部分更新 (PATCH /api/scim/v2/Users/{id})

**用途：** 部分更新用户信息（如修改角色、禁用账号）。

**请求体：**

```json
{
  "schemas": ["urn:ietf:params:scim:api:messages:2.0:PatchOp"],
  "Operations": [
    {
      "op": "replace",
      "path": "active",
      "value": false
    }
  ]
}
```

**支持的操作：**

| op | 说明 |
|----|------|
| `replace` | 替换指定字段的值 |
| `add` | 仅支持 `emails` 数组追加 |

**支持路径 (replace)：**

| path | 说明 |
|------|------|
| `active` | `true` / `false`，映射到 `user.emailVerified` |
| `displayName` | 显示名称，映射到 `user.name` |
| `urn:ietf:params:scim:schemas:extension:enterprise:2.0:User:department` | 角色，`"User"` 或 `"Administrator"`，映射到 `user.role` |

**支持路径 (add)：**

| path | 说明 |
|------|------|
| `emails` | 追加邮箱（替换 `socialAccount` 渠道的邮箱） |

**常用场景：**

```json
// 禁用用户
{ "Operations": [{ "op": "replace", "path": "active", "value": false }] }

// 修改显示名称
{ "Operations": [{ "op": "replace", "path": "displayName", "value": "新名称" }] }

// 升级为管理员
{ "Operations": [{ "op": "replace", "path": "urn:ietf:params:scim:schemas:extension:enterprise:2.0:User:department", "value": "Administrator" }] }

// 更新邮箱
{ "Operations": [{ "op": "add", "path": "emails", "value": { "value": "new-email@example.com" } }] }
```

**成功响应 (200)：** 返回更新后的完整用户对象。

---

### 8. 删除用户 (DELETE /api/scim/v2/Users/{id})

**用途：** 删除指定用户。

**注意：** 删除用户会级联删除其关联的会话、社交账号绑定和 OAuth 令牌记录。

**成功响应：** `204 No Content`（无 body）

**错误响应 (404)：**

```json
{
  "schemas": ["urn:ietf:params:scim:api:messages:2.0:Error"],
  "detail": "User not found",
  "status": 404
}
```

---

## 接入示例

### 用户登录流程

```
1. 用户点击"使用云洲账号登录"
     │
2.  AI 平台前端生成 code_verifier (43 位随机字符串)
     │
3.  AI 平台前端计算 code_challenge:
     Base64URL(SHA256(code_verifier))
     │
4.  302 跳转至云洲 OAuth 授权页:
     https://yunzone.com/oauth/authorize
       ?response_type=code
       &client_id=ai-text-analysis
       &redirect_uri=https://ai-platform.com/oauth/callback
       &code_challenge=xxxxx
       &code_challenge_method=S256
       &state=random-csrf-token
     │
5.  用户在云洲登录（或已有 session 则跳过）
     │
6.  用户点击"授权"→ 云洲生成授权码
     │
7.  302 回跳至 AI 平台:
     https://ai-platform.com/oauth/callback
       ?code=abc123&state=random-csrf-token
     │
8.  AI 平台后端:
     POST https://yunzone.com/api/oauth/token
     Content-Type: application/x-www-form-urlencoded

     grant_type=authorization_code
     &code=abc123
     &code_verifier=the-original-verifier
     &client_id=ai-text-analysis
     &client_secret=generated-secret
     &redirect_uri=https://ai-platform.com/oauth/callback
     │
9.  云洲返回:
     {
       "access_token": "eyJhbGciOiJSUzI1NiIs...",
       "token_type": "Bearer",
       "expires_in": 86400,
       "refresh_token": "550e8400-...",
       "scope": "openid profile"
     }
     │
10. AI 平台获取用户信息:
     GET https://yunzone.com/api/oauth/userinfo
     Authorization: Bearer {access_token}
     │
11. 云洲返回:
     {
       "sub": "user-uuid",
       "name": "张三",
       "email": "zhangsan@example.com",
       "email_verified": true,
       "updated_at": 1704067200
     }
     │
12. AI 平台创建本地 session，完成登录
```

### 用户管理流程

```
1. AI 平台后端获取 SCIM 令牌:
     POST https://yunzone.com/api/oauth/token
     Content-Type: application/x-www-form-urlencoded

     grant_type=client_credentials
     &client_id=ai-text-analysis
     &client_secret=generated-secret
     &scope=scim
     │
2. 云洲返回:
     {
       "access_token": "eyJhbGciOiJSUzI1NiIs...",
       "token_type": "Bearer",
       "expires_in": 3600,
       "scope": "scim"
     }
     │
3. 查询用户列表:
     GET https://yunzone.com/api/scim/v2/Users?startIndex=1&count=20
     Authorization: Bearer {scim-access-token}
     │
4. 创建用户:
     POST https://yunzone.com/api/scim/v2/Users
     Authorization: Bearer {scim-access-token}
     Content-Type: application/json

     {
       "schemas": ["urn:ietf:params:scim:schemas:core:2.0:User"],
       "userName": "newuser@example.com",
       "displayName": "新用户",
       "emails": [{ "value": "newuser@example.com", "primary": true }],
       "active": true
     }
     │
5. 禁用用户:
     PATCH https://yunzone.com/api/scim/v2/Users/{id}
     Authorization: Bearer {scim-access-token}
     Content-Type: application/json

     {
       "schemas": ["urn:ietf:params:scim:api:messages:2.0:PatchOp"],
       "Operations": [
         { "op": "replace", "path": "active", "value": false }
       ]
     }
```

---

## 附录

### 错误码速查

#### OAuth 2.0 错误

| HTTP 状态码 | error | 说明 |
|-----------|-------|------|
| 400 | `invalid_request` | 缺少必填参数或参数格式错误 |
| 400 | `invalid_grant` | 授权码无效、已使用、已过期，或 code_verifier 不匹配 |
| 400 | `invalid_client` | client_id 不存在或 client_secret 错误 |
| 400 | `unauthorized_client` | 该 grant_type 未被客户端授权 |
| 400 | `unsupported_grant_type` | 不支持的 grant_type 值 |
| 400 | `invalid_scope` | scope 参数无效 |
| 401 | `invalid_token` | access_token 已过期或已被吊销 |
| 500 | `server_error` | 服务器内部错误，请稍后重试 |

#### SCIM 2.0 错误

| HTTP 状态码 | detail | 说明 |
|-----------|--------|------|
| 400 | 描述信息 | 请求参数错误（如无效的 filter 语法、缺少必填字段） |
| 401 | 描述信息 | 认证失败（token 无效或已过期） |
| 404 | `User not found` | 用户不存在 |
| 409 | `User with this email already exists` | 创建用户时邮箱已存在 |
| 500 | `Internal server error` | 服务器内部错误 |

### SCIM 用户字段映射

| SCIM 字段 | 数据库/业务字段 | 类型 | 说明 |
|-----------|---------------|------|------|
| `id` | `user.id` | UUID | 用户唯一标识 |
| `userName` | `socialAccount.providerOpenid` (provider=email) | String | 用户名（邮箱），从 email 渠道获取 |
| `displayName` | `user.name` | String | 显示名称 |
| `emails[0].value` | `socialAccount.providerOpenid` (provider=email) | String | 邮箱地址，从 email 渠道获取 |
| `active` | `user.emailVerified` | Boolean | 用户是否激活（邮箱已验证） |
| `meta.created` | `user.createdAt` | DateTime | 创建时间 |
| `meta.lastModified` | `user.updatedAt` | DateTime | 最后修改时间 |
| `department` | `user.role` | String | `"User"` 或 `"Administrator"`，映射到 `user.role` |

> **注意**：omni-auth v5.0.0 已将 `user.email` 列移除，邮箱信息统一存储在 `socialAccount` 表（`provider=email` 渠道的 `providerOpenid` 字段）中。因此 `userName` 和 `emails` 的值均从 `socialAccount` 渠道获取，而非 `user` 表。