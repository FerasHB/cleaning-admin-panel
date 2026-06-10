// components/dashboard/ActivityList.tsx
// Aktivitäts-Liste fürs Dashboard (Light SaaS): Icon pro Event-Typ, kurzer Text
// und Zeit, ganze Zeile klickbar zum Job. Empty-/Lade-/Fehlerzustand inklusive.
// Dashboard-lokal — ändert kein geteiltes UI.

import Link from "next/link"
import { Activity, CalendarPlus, CheckCircle2, MessageSquare, Play } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatDateTimeDE } from "@/lib/date"
import type { ActivityItem, ActivityType } from "@/lib/activity/activity"

const ICON: Record<ActivityType, LucideIcon> = {
  comment: MessageSquare,
  started: Play,
  completed: CheckCircle2,
  created: CalendarPlus,
}

const TONE: Record<ActivityType, string> = {
  comment: "bg-blue-50 text-blue-600 ring-blue-100",
  started: "bg-amber-50 text-amber-600 ring-amber-100",
  completed: "bg-emerald-50 text-emerald-600 ring-emerald-100",
  created: "bg-gray-50 text-muted-foreground ring-gray-100",
}

const VERB: Record<ActivityType, string> = {
  comment: "hat kommentiert bei",
  started: "hat gestartet",
  completed: "hat abgeschlossen",
  created: "hat erstellt",
}

function renderText(item: ActivityItem) {
  const actor = item.actorName ?? "Unbekannt"
  const customer = item.customerName ?? "Auftrag"
  // comment liest sich natürlicher als "… bei {Kunde}"
  if (item.type === "comment") {
    return (
      <>
        <span className="font-medium text-foreground">{actor}</span>
        {" hat bei "}
        <span className="font-medium text-foreground">{customer}</span>
        {" kommentiert"}
      </>
    )
  }
  return (
    <>
      <span className="font-medium text-foreground">{actor}</span>
      {` ${VERB[item.type]} `}
      <span className="font-medium text-foreground">{customer}</span>
    </>
  )
}

export function ActivityList({
  items,
  loading,
  error,
}: {
  items: ActivityItem[]
  loading: boolean
  error: string | null
}) {
  if (loading) {
    return (
      <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
        Laden…
      </div>
    )
  }

  if (error) {
    return (
      <div className="px-5 py-6 text-sm font-medium text-destructive">{error}</div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary">
          <Activity className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm font-medium">Noch keine Aktivität</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Kommentare und Auftragsänderungen erscheinen hier.
          </p>
        </div>
      </div>
    )
  }

  return (
    <ul className="divide-y divide-gray-100">
      {items.map((item) => {
        const Icon = ICON[item.type]
        return (
          <li key={item.id}>
            <Link
              href={`/jobs/${item.jobId}`}
              className="flex items-center gap-2.5 px-4 py-2 transition-colors hover:bg-gray-50/70"
            >
              <span
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full ring-1 ring-inset",
                  TONE[item.type],
                )}
              >
                <Icon className="h-3 w-3" />
              </span>
              <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                {renderText(item)}
              </p>
              <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground/70">
                {formatDateTimeDE(item.at)}
              </span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
