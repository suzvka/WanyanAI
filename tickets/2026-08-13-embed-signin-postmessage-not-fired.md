# 工单：用户中心嵌入登录弹窗登录成功后未通过 postMessage 通知主窗口

## 严重程度

**P0 / Blocker** —— 用户登录完成后主窗口无法进入登录态，所有依赖登录态的页面（包括用户中心 `/account`）都不可用。

## 复现步骤

1. 打开本项目 `/login` 页面
2. 点击「打开登录窗口」，弹出用户中心的嵌入登录弹窗
3. 在弹窗中完成登录
4. **预期**：弹窗通过 `postMessage` 把登录结果（`accountToken` + `user`）发给主窗口，主窗口调用 `/api/v1/auth/issue` 签发 station token，写入 `sessionStorage`，跳转到首页
5. **实际**：弹窗显示「登录成功 你可以关闭此窗口了」，但**主窗口一直卡在"请在新窗口中完成登录..."的 loading 状态**，没有任何响应

## 现象截图

主窗口状态：标题为「登录」，正文显示「请在新窗口中完成登录...」并持续转圈。

弹窗状态：标题为「登录 | 嵌入 | Yunzone - 个人 - Microsoft Edge」，URL 为 `https://jcvs3fpmzc.coze.site/embed/sign-in`，正文显示「✓ 登录成功 你可以关闭此窗口了」。

## 技术分析

主窗口侧已经在 `src/app/(auth)/login/page.tsx` 的 `handleMessage` 里注册了 `message` 事件监听器，并按以下约定接收消息：

```typescript
// 主窗口侧 - 期望收到的消息格式
{
  type: 'auth:sign-in:success',
  payload: {
    token: string,  // accountToken
    user: { id: string; name: string; email: string; role: string },
  }
}
```

`handleMessage` 收到的消息后会做：
1. 校验 `e.origin === userCenterUrl`（当前 `userCenterUrl = https://jcvs3fpmzc.coze.site`）
2. 关闭弹窗
3. 调用 `POST /api/v1/auth/issue` 用 `accountToken` + `user` 换取 station token
4. 把 station token 写入 `sessionStorage`，跳转首页

但**主窗口的 `handleMessage` 一直未被触发**，从控制台看 message 事件根本没有派发（没有收到任何 `MessageEvent`），说明弹窗侧**没有向 `window.opener` 发送 `postMessage`**，或者发送了但没有发到 `window.opener`。

## 请求排查方向

请在用户中心的 `/embed/sign-in` 嵌入登录页面（`https://jcvs3fpmzc.coze.site/embed/sign-in`）中确认：

1. 登录成功后的回调中是否调用了 `window.opener.postMessage(...)`？
2. 如果调用了，`targetOrigin` 参数是否正确（应该是 `https://<主站域名>` 或 `'*'`，**不能**是 `null` 或具体的用户中心域名）？
3. 是否在调用 `postMessage` 之前检查了 `window.opener` 是否存在（某些浏览器策略下 `opener` 可能为 `null`，需要先判断再发）？
4. 是否使用了 `window.parent.postMessage` 而非 `window.opener.postMessage`？（如果嵌入方式是 iframe 而不是弹窗则用 `parent`，但我们用的是 `window.open` 弹窗，必须用 `opener`）
5. 发送的 `type` 字段是否严格等于 `auth:sign-in:success`？（主窗口是按这个字符串 switch 的，大小写敏感）

## 参考代码

主窗口侧的处理逻辑（`src/app/(auth)/login/page.tsx`）：

```typescript
const handleMessage = useCallback(
  (e: MessageEvent<PostMessageEvent>) => {
    if (!userCenterUrl || e.origin !== userCenterUrl) return;

    const { type, payload } = e.data;
    if (!type) return;

    switch (type) {
      case 'auth:sign-in:success': {
        if (!payload?.token || !payload?.user) return;
        popupRef.current?.close();
        popupRef.current = null;
        issueToken(payload.token, payload.user);
        break;
      }
      case 'auth:sign-in:error': {
        setStatus('error');
        setStatusMessage(payload?.message || '登录失败');
        popupRef.current?.close();
        popupRef.current = null;
        break;
      }
    }
  },
  [issueToken, userCenterUrl],
);
```

主窗口侧通过 `window.open` 打开弹窗：

```typescript
popupRef.current = window.open(
  `${userCenterUrl}/embed/sign-in`,  // https://jcvs3fpmzc.coze.site/embed/sign-in
  'login-popup',
  `width=${POPUP_WIDTH},height=${POPUP_HEIGHT},left=${left},top=${top}`,
);
```

## 期望修复后

弹窗登录成功后：
1. 调用 `window.opener.postMessage({ type: 'auth:sign-in:success', payload: { token, user } }, '<主站 origin>')`
2. 主窗口 `handleMessage` 收到消息后弹窗会自动关闭，登录流程完成

---

**工单发起方**：本项目（station）开发方
**关联域名**：`https://jcvs3fpmzc.coze.site`（用户中心）/ `https://<本项目域名>`（主站）
