// lib/calendar/calendarMonth.ts
// Monatsraster- und Tagesgruppierungs-Helfer für den Web-Kalender — Port von
// Mobiles utils/calendarMonth.ts (features/jobs/AdminJobsCalendarScreen.tsx
// + MonthGrid.tsx). Reines Rechnen, keine Kalender-Library: sieben gleich
// breite Spalten, 4-6 Wochenzeilen, Montag zuerst.
//
// IMPORTANT: Regeln (job_type='recurring', parent_job_id=null) haben kein
// eigenes Kalenderdatum und tauchen hier nie auf — getJobDateKey liefert für
// sie null (wie Mobile), zusätzlich zur serverseitigen Filterung in
// getJobsInRange (job_type='single').

import { formatDateISO, normalizeTime } from "@/lib/date"
import type { JobWithAssignments } from "@/lib/jobs/jobs.service"
import { STATUS_ORDER, type JobStatus } from "@/lib/jobs/statusMeta"

export type MonthCell = {
  date: Date
  key: string // "YYYY-MM-DD"
  inMonth: boolean
}

export type DaySummary = {
  total: number
  open: number
  inProgress: number
  completed: number
  statuses: JobStatus[]
}

/** monthKey ("YYYY-MM") → Wochenraster inkl. Vor-/Nachlauftage benachbarter Monate. */
export function buildMonthMatrix(monthKey: string): MonthCell[][] {
  const [year, month] = monthKey.split("-").map((n) => parseInt(n, 10))
  const firstOfMonth = new Date(year, month - 1, 1)
  const leadDays = (firstOfMonth.getDay() + 6) % 7 // JS: So=0…Sa=6 → Mo-first
  const daysInMonth = new Date(year, month, 0).getDate()
  const totalCells = Math.ceil((leadDays + daysInMonth) / 7) * 7

  const start = new Date(year, month - 1, 1 - leadDays)
  const cells: MonthCell[] = []
  for (let i = 0; i < totalCells; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
    cells.push({
      date: d,
      key: formatDateISO(d) ?? "",
      inMonth: d.getMonth() === month - 1 && d.getFullYear() === year,
    })
  }

  const weeks: MonthCell[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  return weeks
}

export function monthKeyFromDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
}

export function addMonths(monthKey: string, delta: number): string {
  const [year, month] = monthKey.split("-").map((n) => parseInt(n, 10))
  return monthKeyFromDate(new Date(year, month - 1 + delta, 1))
}

/** Kalendertag eines ausführbaren Auftrags. Regeln haben keinen Tag → null. */
export function getJobDateKey(job: JobWithAssignments): string | null {
  if (job.job_type === "recurring") return null
  return job.date ? job.date.slice(0, 10) : null
}

// Termine ohne Uhrzeit sortieren zuletzt (wie Mobiles compareByDisplayTime).
function displayTimeSortKey(job: JobWithAssignments): string {
  const time = normalizeTime(job.start_time)
  return time ? `0${time}` : "1"
}

/** Gruppiert Aufträge nach Kalendertag, je Tag nach Uhrzeit sortiert. */
export function groupJobsByDateKey(
  jobs: JobWithAssignments[],
): Map<string, JobWithAssignments[]> {
  const map = new Map<string, JobWithAssignments[]>()
  for (const job of jobs) {
    const key = getJobDateKey(job)
    if (!key) continue
    const list = map.get(key)
    if (list) list.push(job)
    else map.set(key, [job])
  }
  for (const list of map.values()) {
    list.sort((a, b) => {
      const timeDiff = displayTimeSortKey(a).localeCompare(displayTimeSortKey(b))
      if (timeDiff !== 0) return timeDiff
      return (a.customer_name ?? "").localeCompare(b.customer_name ?? "", "de")
    })
  }
  return map
}

/** Kompakte Tageszusammenfassung je Kalendertag (für die Rasterzelle). */
export function buildDaySummaries(
  jobsByDay: Map<string, JobWithAssignments[]>,
): Map<string, DaySummary> {
  const summaries = new Map<string, DaySummary>()
  for (const [key, jobs] of jobsByDay) {
    const statuses = new Set<JobStatus>()
    let open = 0
    let inProgress = 0
    let completed = 0
    for (const job of jobs) {
      const status = job.status as JobStatus
      statuses.add(status)
      if (status === "open") open += 1
      else if (status === "in_progress") inProgress += 1
      else if (status === "completed") completed += 1
    }
    summaries.set(key, {
      total: jobs.length,
      open,
      inProgress,
      completed,
      statuses: STATUS_ORDER.filter((s) => statuses.has(s)),
    })
  }
  return summaries
}

export function formatDayLabel(dayKey: string): string {
  const [y, m, d] = dayKey.split("-").map((n) => parseInt(n, 10))
  return new Date(y, m - 1, d).toLocaleDateString("de-DE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

export function formatMonthLabel(monthKey: string): string {
  const [y, m] = monthKey.split("-").map((n) => parseInt(n, 10))
  return new Date(y, m - 1, 1).toLocaleDateString("de-DE", {
    month: "long",
    year: "numeric",
  })
}
