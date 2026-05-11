/**
 * Bootstrap 模块入口
 *
 * 提供服务端注册表统一初始化能力
 */

export {
  ensureServerRegistriesInitialized,
  isServerInitialized,
  resetServerInitialized,
} from './registry-init';
