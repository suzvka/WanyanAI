/**
 * 鉴权响应验证器 - 示例
 *
 * 入参：{
 *   key: string,              // 原始请求 key
 *   permissionLevel: number,  // 认证服务器返回的权限等级（唯一必填业务字段）
 *   identityId?: string,      // 认证服务器返回的身份标识
 *   authPayload: unknown      // 认证服务器返回的所有额外字段（原样透传）
 * }
 * 返回：boolean（true = 认证有效，false = 降级为 fallback 权限）
 *
 * authPayload 包含认证服务器响应中除 valid、identityId、permissionLevel
 * 之外的全部字段。认证服务器可以通过此字段传递验证码、签名等自定义数据。
 *
 * 用法：
 *   1. 复制此文件夹，重命名为你的策略名
 *   2. 修改 main.js 中的验证逻辑
 *   3. 部署即可生效，无需修改项目代码
 *
 * 系统会扫描 auth-verifiers/ 下所有子文件夹中的 main.js，
 * 依次执行，全部返回 true 才视为通过。
 * 如果没有任何验证器（目录为空或不存在），默认放行。
 */

module.exports = function verifyAuth(params) {
  const { key, permissionLevel, identityId, authPayload } = params;

  // 示例：验证 authPayload 中的 verificationCode 或 signature
  // 请根据认证服务器返回的实际字段替换此逻辑
  //
  // 例如认证服务返回了：
  // { valid: true, permissionLevel: 3, identityId: "user_123", code: "abc", sign: "xyz" }
  // 那么 authPayload = { code: "abc", sign: "xyz" }
  //
  // const { code, sign } = authPayload || {};
  // return verifyHMAC(key + code, sign);

  // 默认示例：只要有 authPayload 且 permissionLevel > 0 就通过
  if (!authPayload || permissionLevel < 1) {
    return false;
  }
  return true;
};
