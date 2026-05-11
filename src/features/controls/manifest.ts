/**
 * 内置控件清单
 *
 * 所有内置控件模块在此注册
 */

// 静态导入确保同步初始化
import { register as registerSelect } from './select-control/module';
import { register as registerMultiSelect } from './multi-select/module';

/**
 * 初始化所有内置控件
 *
 * 此函数由框架在启动时调用
 */
export function registerBuiltinControls(): void {
  registerSelect();
  registerMultiSelect();
}
