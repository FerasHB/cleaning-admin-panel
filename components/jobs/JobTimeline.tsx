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
    { label: "Erstellt", at: createdAt, icon: CalendarPlus },
    { label: "Gestartet", at: startedAt, icon: Play },
    { label: "Erledigt", at: completedAt, icon: CheckCircle2 },
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
                  "flex h-8 w-8 items-center justify-center rounded-full",
                  done
                    ? "bg-primary/10 text-primary"
                    : "bg-muted text-muted-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
              </div>
              {!isLast && (
                <div className="my-1 w-px flex-1 bg-border" aria-hidden />
              )}
            </div>

            {/* Label + Zeit */}
            <div className={cn("pb-5", isLast && "pb-0")}>
              <p
                className={cn(
                  "text-sm font-medium",
                  done ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {step.label}
              </p>
              <p className="text-xs text-muted-foreground">
                {step.at ? formatDateTimeDE(step.at) : "Ausstehend"}
              </p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
