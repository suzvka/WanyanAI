import * as React from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  // 订阅 matchMedia 断点变化：SSR 时返回 false，客户端挂载后自动切换为真实值
  const subscribe = React.useCallback((onChange: () => void) => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    mql.addEventListener("change", onChange)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  const getSnapshot = React.useCallback(
    () => window.innerWidth < MOBILE_BREAKPOINT,
    [],
  )

  const getServerSnapshot = React.useCallback(() => false, [])

  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
