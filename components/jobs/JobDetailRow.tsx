import type * as React from "react"
import type { LucideIcon } from "lucide-react"

// components/jobs/JobDetailRow.tsx
// Label/Wert-Zeile mit Icon für die Auftrags-Detailseite (Web-Pendant zu
// Mobiles InfoRow).

export function JobDetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-3 py-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/5 ring-1 ring-inset ring-primary/10">
        <Icon className="h-4 w-4 text-primary/70" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-0.5 break-words text-sm font-medium text-foreground">{value}</p>
      </div>
    </div>
  )
}
