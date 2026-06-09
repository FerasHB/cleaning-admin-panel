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
    <div className="flex items-start gap-3 py-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-secondary">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="break-words text-sm font-medium text-foreground">{value}</p>
      </div>
    </div>
  )
}
