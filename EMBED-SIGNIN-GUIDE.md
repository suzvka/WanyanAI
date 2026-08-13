# 嵌入登录组件接入指南

## 概述

本项目提供一套**开箱即用的嵌入登录方案**，第三方网站可通过 `<iframe>` 将登录组件嵌入到自己的页面中，登录结果通过 **postMessage** 跨域通信返回。

**核心优势**：
- 无需自行实现登录 UI 和认证逻辑
- 天然跨域，postMessage 是浏览器标准跨域通信方案
- 支持密码登录和验证码登录两种模式
- 支持邮箱 / 手机号多渠道
- 支持自定义默认渠道和登录模式

---

## 快速开始

### 1. 嵌入 iframe

在第三方网页中插入 iframe：

```html
<iframe
  id="login-frame"
  src="https://<本服务域名>/embed/sign-in"
  width="420"
  height="520"
  style="border: none; border-radius: 16px; box-shadow: 0 8px 32px rgba(0,0,0,0.12);"
></iframe>
```

### 2. 监听登录结果

```html
<script>
  window.addEventListener("message", (e) => {
    // 安全校验：务必验证消息来源！
    if (e.origin !== "https://<本服务域名>") return;

    const { type, payload } = e.data;

    switch (type) {
      case "auth:iframe:ready":
        console.log("登录组件已加载完成");
        break;

      case "auth:sign-in:success":
        // 登录成功
        const { token, user } = payload;
        console.log("登录成功", user);
        // 你可以：
        // 1. 将 token 发送给自己的后端建立会话
        // 2. 存储到 localStorage 做前端鉴权
        // 3. 跳转到应用首页
        break;

      case "auth:sign-in:error":
        // 登录失败
        console.error("登录失败:", payload.message);
        break;
    }
  });
</script>
```

---

## 参数配置

通过 iframe URL 的查询参数可自定义登录组件的默认行为：

| 参数 | 说明 | 可选值 | 默认值 | 示例 |
|---|---|---|---|---|
| `provider` | 默认登录渠道 | `email`、`phone` | 系统默认 | `?provider=phone` |
| `mode` | 默认登录模式 | `password`、`code` | `password` | `?mode=code` |

**示例**：

```html
<!-- 默认手机号 + 验证码登录 -->
<iframe src="https://<本服务域名>/embed/sign-in?provider=phone&mode=code"></iframe>

<!-- 默认邮箱 + 密码登录 -->
<iframe src="https://<本服务域名>/embed/sign-in?provider=email&mode=password"></iframe>
```

---

## 事件参考

### 完整事件列表

| 事件类型 | 方向 | 触发时机 | Payload |
|---|---|---|---|
| `auth:iframe:ready` | iframe → 父窗口 | iframe 加载完成 | 无 |
| `auth:sign-in:success` | iframe → 父窗口 | 登录成功 | `{ token, user }` |
| `auth:sign-in:error` | iframe → 父窗口 | 登录失败 | `{ message }` |

### `auth:sign-in:success` Payload 说明

```typescript
{
  token: string;        // 会话令牌（HttpOnly Cookie 的等同物）
  user: {
    id: string;         // 用户唯一 ID
    name: string;       // 用户昵称
    email: string;      // 用户邮箱（来自登录渠道）
    role: string;       // 用户角色（"user" | "admin"）
  }
}
```

### `auth:sign-in:error` Payload 说明

```typescript
{
  message: string;      // 错误描述（如"密码错误"、"验证码不正确"等）
}
```

---

## 安全最佳实践

### 1. 必须校验消息来源

```javascript
// ❌ 不安全：不校验来源，任何网站都可向你的页面发送伪造消息
window.addEventListener("message", (e) => {
  // 危险！恶意页面可伪造 login:success 让你误以为用户已登录
});

// ✅ 安全：只信任你的项目域名
window.addEventListener("message", (e) => {
  if (e.origin !== "https://<本服务域名>") return;
  // 安全处理
});
```

### 2. 合理使用 token

拿到 `token` 后，建议：

- **方案 A（推荐）**：将 token 发送给自己的后端 API，由后端调用本项目的 `/api/me` 接口验证 token 有效性，并建立自己的会话体系
- **方案 B**：将 token 存入 `sessionStorage`（注意不要存入 localStorage 以免 XSS 窃取），后续请求以 `Authorization: Bearer <token>` 或 Cookie 形式携带
- **方案 C**：直接使用本项目 Cookie 体系（`omni-auth.token` 已设为 HttpOnly），但跨域下 Cookie 需要额外配置

### 3. iframe 安全属性

推荐给 iframe 添加安全属性：

```html
<iframe
  src="https://<本服务域名>/embed/sign-in"
  sandbox="allow-scripts allow-same-origin allow-forms"
></iframe>
```

> **注意**：`allow-same-origin` 是必需的，否则无法发送网络请求；
> 如果不需要 Cookie 共享，可省略 `allow-same-origin`，但登录请求会失败。

---

## 常见问题

### Q: postMessage 能解决跨域吗？

**能。** postMessage 是 HTML5 标准 API，天然支持跨域通信。iframe 内部通过 `window.parent.postMessage(data, "*")` 发送消息，父窗口通过 `message` 事件接收，并校验 `e.origin` 确保安全。这是业界嵌入登录的通用方案（如 Google、GitHub 的 OAuth 弹窗/iframe 流程）。

### Q: 为什么登录成功后有 HttpOnly Cookie，但第三方页面拿不到？

`omni-auth.token` 被设置为 `HttpOnly`、`SameSite=Lax`，浏览器不会在跨域 iframe 中自动设置 Cookie。因此通过 postMessage 显式传递 `token` 字符串，由第三方自行处理存储和传递。

### Q: 登录成功后 iframe 里显示什么？

登录成功后 iframe 内部会显示一个"登录成功"的确认页面，提示用户可关闭窗口。

### Q: 如何自定义 iframe 尺寸？

根据你的布局需要调整 `width` 和 `height`。推荐最小宽度 `380px`，最小高度 `480px`，以免内容被截断。

### Q: 支持哪些登录方式？

目前支持两种模式：
- **密码登录**：输入邮箱/手机号 + 密码
- **验证码登录**：输入邮箱/手机号 → 获取验证码 → 输入验证码

支持两种渠道：
- **邮箱**（email）
- **手机号**（phone）

---

## 完整接入示例

以下是一个完整的第三方接入页面示例：

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>第三方应用 - 登录</title>
  <style>
    body {
      margin: 0;
      min-height: 100vh;
      background: #f5f5f5;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: system-ui, -apple-system, sans-serif;
    }
    .container {
      text-align: center;
    }
    h2 {
      margin-bottom: 24px;
      color: #333;
    }
    iframe {
      border: none;
      border-radius: 16px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.1);
      background: #fff;
    }
    #status {
      margin-top: 16px;
      padding: 12px 20px;
      border-radius: 8px;
      font-size: 14px;
      display: none;
    }
    #status.success {
      display: block;
      background: #e8f5e9;
      color: #2e7d32;
    }
    #status.error {
      display: block;
      background: #ffebee;
      color: #c62828;
    }
  </style>
</head>
<body>
  <div class="container">
    <h2>请登录以继续</h2>
    <iframe
      id="login-frame"
      src="https://<本服务域名>/embed/sign-in?provider=email&mode=password"
      width="420"
      height="520"
    ></iframe>
    <div id="status"></div>
  </div>

  <script>
    const statusEl = document.getElementById("status");

    window.addEventListener("message", (e) => {
      // 安全校验：只接受来自本服务域名的消息
      if (e.origin !== "https://<本服务域名>") return;

      const { type, payload } = e.data;

      if (type === "auth:sign-in:success") {
        const { token, user } = payload;
        statusEl.className = "success";
        statusEl.textContent = `登录成功！欢迎回来，${user.name}`;

        // 将 token 发送给后端建立会话
        fetch("/api/set-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        }).then(() => {
          // 跳转到应用首页
          // window.location.href = "/dashboard";
        });
      }

      if (type === "auth:sign-in:error") {
        statusEl.className = "error";
        statusEl.textContent = `登录失败：${payload.message}`;
      }
    });
  </script>
</body>
</html>
```

---

## 技术架构说明

```
┌──────────────────────────────┐
│      第三方宿主页面            │
│  ┌────────────────────────┐  │
│  │  <iframe>              │  │
│  │  ┌──────────────────┐  │  │
│  │  │  SignInForm 组件  │  │  │
│  │  │  (共享表单逻辑)   │  │  │
│  │  │                   │  │  │
│  │  │  ┌─────────────┐  │  │  │
│  │  │  │ API 请求     │  │  │  │
│  │  │  │ /api/auth/*  │  │  │  │
│  │  │  └──────┬──────┘  │  │  │
│  │  │         │         │  │  │
│  │  │  postMessage      │  │  │
│  │  │  (跨域)           │  │  │
│  │  └─────────┼─────────┘  │  │
│  └────────────┼────────────┘  │
│               │               │
│  window.addEventListener("message", ...)  │
└───────────────┼───────────────┘
                │
        ┌───────┴───────┐
        │   你的后端服务   │
        │  (API 验证)     │
        └───────────────┘
```