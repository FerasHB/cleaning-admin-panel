import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

// components/dashboard/StatCard.tsx
// KPI-Karte für das Dashboard (Light SaaS): getönter Icon-Chip + Label inline,
// große Zahl, kleine Kontextzeile. Dashboard-lokal — ändert kein geteiltes UI.

type Tone = "amber" | "blue" | "emerald" | "primary"

const TONE_CHIP: Record<Tone, string> = {
  amber: "bg-amber-50 text-amber-600",
  blue: "bg-blue-50 text-blue-600",
  emerald: "bg-emerald-50 text-emerald-600",
  primary: "bg-primary/10 text-primary",
}

export function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = "primary",
}: {
  icon: LucideIcon
  label: string
  value: React.ReactNode
  hint?: React.ReactNode
  tone?: Tone
}) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-card p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_1px_3px_rgba(16,24,40,0.06)] transition-shadow hover:shadow-[0_2px_6px_rgba(16,24,40,0.06),0_8px_16px_rgba(16,24,40,0.06)]">
      <div className="flex items-center gap-2.5">
        <div
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
            TONE_CHIP[tone],
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
      </div>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
        {value}
      </p>
      {hint && (
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  )
}
