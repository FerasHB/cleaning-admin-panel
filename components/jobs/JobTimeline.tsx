// components/jobs/JobTimeline.tsx
// Verlauf eines Auftrags aus den Lebenszyklus-Zeitstempeln (Erstellt →
// Gestartet → Erledigt). Read-only Anzeige für die Detailseite.

import { CalendarPlus, CheckCircle2, Play } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatDateTimeDE } from "@/lib/date"

type Props = {
  createdAt: string
  startedAt: string | null
  completedAt: string | null
}

export function JobTimeline({ createdAt, startedAt, completedAt }: Props) {
  const steps = [
    { label: "Erstellt", at: createdAt, icon: CalendarPlus, tone: "bg-blue-50 text-blue-600 ring-blue-100" },
    { label: "Gestartet", at: startedAt, icon: Play, tone: "bg-amber-50 text-amber-600 ring-amber-100" },
    { label: "Erledigt", at: completedAt, icon: CheckCircle2, tone: "bg-emerald-50 text-emerald-600 ring-emerald-100" },
  ]

  return (
    <ol className="space-y-1">
      {steps.map((step, index) => {
        const done = !!step.at
        const isLast = index === steps.length - 1
        const Icon = step.icon
        return (
          <li key={step.label} className="flex gap-3">
            {/* Icon + Verbindungslinie */}
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full ring-1 ring-inset transition-colors",
                  done
                    ? step.tone
                    : "bg-gray-50 text-muted-foreground/50 ring-gray-100",
                )}
              >
                <Icon className="h-4 w-4" />
              </div>
              {!isLast && (
                <div
                  className={cn(
                    "my-1 w-px flex-1",
                    done ? "bg-primary/20" : "bg-gray-100",
                  )}
                  aria-hidden
                />
              )}
            </div>

            {/* Label + Zeit */}
            <div className={cn("pb-5", isLast && "pb-0")}>
              <p
                className={cn(
                  "text-sm font-semibold",
                  done ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {step.label}
              </p>
              <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
                {step.at ? formatDateTimeDE(step.at) : "Ausstehend"}
              </p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
