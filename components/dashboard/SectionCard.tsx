import type * as React from "react"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

// components/dashboard/SectionCard.tsx
// Sektions-Karte für das Dashboard (Light SaaS): weicher Rahmen + dezenter
// Schatten, Header mit Titel/Subtitle/Icon und optionalem Action-Slot.
// Dashboard-lokal — ändert kein geteiltes UI.

export function SectionCard({
  title,
  subtitle,
  icon: Icon,
  action,
  children,
  className,
  bodyClassName,
  noBodyPadding = false,
}: {
  title: string
  subtitle?: string
  icon?: LucideIcon
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
  bodyClassName?: string
  noBodyPadding?: boolean
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-gray-100 bg-card shadow-[0_1px_2px_rgba(16,24,40,0.04),0_1px_3px_rgba(16,24,40,0.06)]",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />}
          <div>
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
            {subtitle && (
              <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
            )}
          </div>
        </div>
        {action}
      </div>
      <div className={cn(noBodyPadding ? "" : "p-5", bodyClassName)}>
        {children}
      </div>
    </div>
  )
}
