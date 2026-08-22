# OAuth 登录联调需求单（用户中心侧）

> 需求方：WanyanAI 站（`wanyan.coze.site`）
> 对接方：云洲用户中心 / 平台认证服务（`yunzoneuc.coze.site`）
> 类型：**生产环境登录链路联调**（OAuth 2.0 授权码 + PKCE，弹窗模式）
> 日期：2026-08-22

---

## 一、问题现象

生产环境中，用户在本站点击登录后：

1. 弹出登录小窗（指向用户中心 `/oauth/authorize`）；
2. 用户在小窗中完成认证，**可以看到进入了用户中心**；
3. 但**主页面（本站）始终停留在未登录状态**，未收到任何回调结果，仍要求用户登录。

## 二、我方已排查确认的结论

### 1. 我方回调链路完整、端点全部可达

| 环节 | 我方实现 | 生产环境验证 |
|------|---------|--------------|
| 登录页 | `/login` 生成 PKCE + state，弹窗打开 `/oauth/authorize` | `200` |
| 回调页 | `/auth/callback` 收到 code/state 后 `postMessage` 回主窗口（同源），随后自动关闭 | `200` |
| 监听 | 主窗口 `/login` 注册 `message` 监听，校验 origin + state | 代码已确认 |
| 签发 | `POST /api/v1/auth/issue` 用 code+codeVerifier 换 token | `200`（接口可达） |
| 运行时配置 | `GET /api/v1/config` 下发 `platformAuthUrl` + `oauthClientId` | `200`，返回值正确 |

### 2. 我方客户端身份（client_id）有效

我方 `client_id` 为 `e20adf7fd01761ca...`（= SHA-256(apiKey) 派生）。

实测用户中心 `/oauth/authorize`：

- 携带**我方真实 client_id** → 返回 `307` 跳转 `/sign-in?redirect=...`（正常引导登录）；
- 携带**非法 client_id**（如 `test`）→ 返回「授权请求无效 / Invalid client_id」。

结论：**我方 client 已通过用户中心校验，身份标识有效。**

### 3. 关键证据：回调从未到达我方

我方生产运行日志中，**从未出现 `[Auth:Issue]`（签发请求）调用记录**，即：

> 用户中心授权流程结束后，**没有把用户重定向回我方的 `/auth/callback`**（或重定向了但未带有效 code/state）。

这正是"小窗进入了用户中心、主页面仍要求登录"的直接原因——**回调链路断在用户中心侧的回跳环节**。

---

## 三、需要用户中心侧确认 / 配合的事项

### ① redirect_uri 白名单校验（最可能根因）

我方授权请求的 `redirect_uri` 为：

```
https://wanyan.coze.site/auth/callback
```

请确认：

- [ ] 用户中心为该 client 配置的 **redirect_uri 白名单**中，是否包含上述地址？
- [ ] 当 redirect_uri **不在白名单**时，用户中心当前行为是什么？
  - 实测表现为「授权后进入用户中心首页」，疑似白名单校验失败后的**兜底跳转**，而非报错/拒绝。
- [ ] 白名单匹配规则是**精确匹配**还是前缀/域名级匹配？是否有编码（大小写、尾部斜杠）敏感性？

### ② 授权完成后的回跳行为

- [ ] 用户登录成功后，`/sign-in?redirect=...` 中的 `redirect` 参数是否被**正确带回** `/oauth/authorize` 并最终 302 到我方 `redirect_uri`？
- [ ] 授权成功（或已授权过）时，是否立即 302 回跳 `redirect_uri?code=...&state=...`？
- [ ] 授权失败 / 用户取消时，是否回跳 `redirect_uri?error=...`（带 `state`）？

### ③ PKCE 支持确认

我方使用 `code_challenge_method=S256`。请确认：

- [ ] 用户中心是否支持 S256 PKCE 校验？
- [ ] token 端点 `POST /oauth/token` 是否校验 `code_verifier`？校验失败的错误码是？

### ④ token / userinfo 端点

- [ ] `POST /oauth/token`（grant_type=authorization_code）是否正常签发 access_token？
- [ ] `GET /oauth/userinfo` 是否可用？返回字段是否包含 `sub` / `name` / `email`？

---

## 四、联调验收标准

在用户中心侧配合修复/确认后，按以下步骤验收：

1. 本站点击登录 → 弹窗打开用户中心授权页；
2. 完成登录授权 → 弹窗**自动关闭**（或短暂显示「正在返回主窗口...」）；
3. 主窗口出现「登录成功！欢迎回来，xxx」→ 自动跳转首页；
4. 刷新首页/进入用户中心，保持登录态；
5. 打开浏览器开发者工具确认：
   - 用户中心最终 302 到 `https://wanyan.coze.site/auth/callback?code=...&state=...`；
   - 我方 `POST /api/v1/auth/issue` 被调用且返回 200；
   - 我方生产日志出现 `[Auth:Issue] Token 签发成功`。

---

## 五、我方已具备的配合条件

- `/auth/callback`、`/api/v1/auth/issue`、`/api/v1/config` 生产环境全部可访问，随时可联调；
- 我方 client 身份已通过用户中心校验（见第二节第 2 条），无需变更凭证；
- 回调消息类型：`wanyanai:oauth:callback`，payload 含 `code/state/error`，同源 postMessage。

---

*请用户中心侧按第三、四节反馈并配合验证。若白名单缺失，补充配置后即可恢复登录链路。*
