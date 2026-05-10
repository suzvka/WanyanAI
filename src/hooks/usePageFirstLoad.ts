'use client';

import { useEffect, useState } from 'react';

/**
 * 检测页面是否首次加载
 * 
 * 使用场景：骨架屏只在页面首次加载时显示
 * 后续导航返回时直接渲染真实内容
 * 
 * @param duration 骨架屏最小显示时长（毫秒），默认 300ms
 * @returns isFirstLoad - 是否为首次加载
 */
export function usePageFirstLoad(duration = 300): boolean {
  const [isFirstLoad, setIsFirstLoad] = useState(true);

  useEffect(() => {
    // 首次加载：等待最小时长后隐藏骨架屏
    const timer = setTimeout(() => {
      setIsFirstLoad(false);
    }, duration);

    return () => clearTimeout(timer);
  }, [duration]);

  return isFirstLoad;
}
