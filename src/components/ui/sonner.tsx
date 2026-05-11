"use client"

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4 text-[color:var(--destructive)]" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
          // 错误提示样式：背景跟随主题，红色仅用于图标和边框
          "--error-bg": "var(--popover)",
          "--error-text": "var(--popover-foreground)",
          "--error-border": "var(--destructive)",
          // 警告提示样式
          "--warning-bg": "var(--popover)",
          "--warning-text": "var(--popover-foreground)",
          "--warning-border": "color-mix(in oklab, var(--theme-primary) 60%, var(--border))",
          // 成功提示样式
          "--success-bg": "var(--popover)",
          "--success-text": "var(--popover-foreground)",
          "--success-border": "color-mix(in oklab, oklch(0.64 0.16 145) 60%, var(--border))",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: 'group-[.toaster]:pr-6',
          error: '!border-[var(--error-border)] !border-2',
          warning: '!border-[var(--warning-border)]',
          success: '!border-[var(--success-border)]',
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
