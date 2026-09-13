"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { useCalendarJobs } from "@/hooks/use-calendar-jobs"
import { Badge } from "@/components/ui/badge"
import { SectionCard } from "@/components/dashboard/SectionCard"
import { ChevronLeft, ChevronRight, MapPin, Users } from "lucide-react"
import { getJobDisplayTime } from "@/lib/jobs/jobSchedule"
import { formatDateISO } from "@/lib/date"
import {
  getAssigneeNames,
  getEmployees,
  isAssignedTo,
  UNASSIGNED_LABEL,
  type EmployeeOption,
  type JobWithAssignments,
} from "@/lib/jobs/jobs.service"
import {
  STATUS_DOT,
  STATUS_LABEL,
  STATUS_PILL_ACTIVE,
  STATUS_VARIANT,
  type JobStatus,
} from "@/lib/jobs/statusMeta"
import {
  addMonths,
  buildDaySummaries,
  buildMonthMatrix,
  formatDayLabel,
  formatMonthLabel,
  groupJobsByDateKey,
  monthKeyFromDate,
} from "@/lib/calendar/calendarMonth"
import { cn } from "@/lib/utils"

type Job = JobWithAssignments
type StatusFilter = "all" | JobStatus
// Wie Mobiles EmployeeSelection: "all" | "unassigned" | <employeeId>.
type EmployeeSelection = "all" | "unassigned" | string

const WEEKDAY_HEADERS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"]

export default function CalendarPage() {
  const today = new Date()
  const todayKey = formatDateISO(today) ?? ""

  const [monthKey, setMonthKey] = useState(() => monthKeyFromDate(today))
  const [selectedKey, setSelectedKey] = useState(todayKey)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [employeeFilter, setEmployeeFilter] = useState<EmployeeSelection>("all")
  const [employees, setEmployees] = useState<EmployeeOption[]>([])

  useEffect(() => {
    const supabase = createClient()
    let mounted = true
    getEmployees(supabase)
      .then((data) => {
        if (mounted) setEmployees(data)
      })
      .catch(() => {
        // still — der Filter bleibt einfach leer, keine Blockade des Kalenders.
      })
    return () => {
      mounted = false
    }
  }, [])

  const activeEmployees = employees.filter((e) => e.isActive)

  // Rasterfenster inkl. Vor-/Nachlauftage — wie Mobile wird genau dieses
  // Fenster geladen, nicht nur der strenge Monat.
  const weeks = useMemo(() => buildMonthMatrix(monthKey), [monthKey])
  const fromKey = weeks[0][0].key
  const toKey = weeks[weeks.length - 1][6].key

  const { jobs, loading, error } = useCalendarJobs(fromKey, toKey)

  // Mitarbeiter- UND Status-Filter laufen client-seitig auf den bereits im
  // Fenster geladenen Aufträgen — kein Request pro Filterwechsel (wie Mobile).
  const visibleJobs = useMemo(() => {
    return jobs.filter((job) => {
      if (statusFilter !== "all" && job.status !== statusFilter) return false
      if (employeeFilter === "all") return true
      if (employeeFilter === "unassigned") return (job.assignments ?? []).length === 0
      return isAssignedTo(job, employeeFilter)
    })
  }, [jobs, statusFilter, employeeFilter])

  const jobsByDay = useMemo(() => groupJobsByDateKey(visibleJobs), [visibleJobs])
  const daySummaries = useMemo(() => buildDaySummaries(jobsByDay), [jobsByDay])
  const selectedJobs = jobsByDay.get(selectedKey) ?? []

  const hasActiveFilters = statusFilter !== "all" || employeeFilter !== "all"

  const goToday = () => {
    setMonthKey(monthKeyFromDate(today))
    setSelectedKey(todayKey)
  }
  const goPrevMonth = () => setMonthKey((k) => addMonths(k, -1))
  const goNextMonth = () => setMonthKey((k) => addMonths(k, 1))

  const handleSelectDay = (key: string, inMonth: boolean) => {
    setSelectedKey(key)
    if (!inMonth) {
      // Klick auf einen Vor-/Nachlauftag wechselt den angezeigten Monat.
      setMonthKey(key.slice(0, 7))
    }
  }

  const statusPills: { key: StatusFilter; label: string }[] = [
    { key: "all", label: "Alle" },
    { key: "open", label: STATUS_LABEL.open },
    { key: "in_progress", label: STATUS_LABEL.in_progress },
    { key: "completed", label: STATUS_LABEL.completed },
  ]

  return (
    <div className="space-y-5">
      {/* ── Page header ── */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Kalender
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Monatsübersicht aller Aufträge und Termine.
        </p>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm font-medium text-destructive">
          Kalender konnte nicht geladen werden: {error}
        </div>
      )}

      {/* ── Toolbar: Monatsnavigation + Filter ── */}
      <div className="flex flex-col gap-3 rounded-2xl border border-gray-100 bg-card px-5 py-3.5 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_1px_3px_rgba(16,24,40,0.06)] lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={goPrevMonth}
            aria-label="Vorheriger Monat"
            className="flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 text-muted-foreground transition-colors hover:bg-gray-100 hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[160px] text-center text-sm font-semibold capitalize text-foreground">
            {formatMonthLabel(monthKey)}
          </span>
          <button
            type="button"
            onClick={goNextMonth}
            aria-label="Nächster Monat"
            className="flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 text-muted-foreground transition-colors hover:bg-gray-100 hover:text-foreground"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={goToday}
            className={cn(
              "ml-1 h-8 rounded-md px-3 text-xs font-medium transition-colors",
              monthKey === monthKeyFromDate(today)
                ? "border border-gray-200 text-muted-foreground hover:bg-gray-100 hover:text-foreground"
                : "bg-primary/10 text-primary hover:bg-primary/15",
            )}
          >
            Heute
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="sr-only" htmlFor="calendar-employee-filter">
            Nach Mitarbeiter filtern
          </label>
          <select
            id="calendar-employee-filter"
            value={employeeFilter}
            onChange={(e) => setEmployeeFilter(e.target.value)}
            className="h-9 rounded-md border border-input bg-transparent px-2.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
          >
            <option value="all">Alle Mitarbeiter</option>
            <option value="unassigned">{UNASSIGNED_LABEL}</option>
            {activeEmployees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.fullName}
              </option>
            ))}
          </select>

          <div className="flex flex-wrap items-center gap-1.5">
            {statusPills.map((p) => {
              const active = statusFilter === p.key
              return (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setStatusFilter(p.key)}
                  aria-pressed={active}
                  className={cn(
                    "inline-flex items-center rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                    active
                      ? STATUS_PILL_ACTIVE[p.key]
                      : "text-muted-foreground hover:bg-gray-100 hover:text-foreground",
                  )}
                >
                  {p.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── Monatsraster + Tagesagenda ── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <SectionCard
          title={loading ? "Kalender wird geladen…" : "Monatsübersicht"}
          subtitle={
            !loading && visibleJobs.length === 0
              ? hasActiveFilters
                ? "Keine Aufträge für die aktuelle Filterauswahl in diesem Monat."
                : "In diesem Monat sind keine Aufträge geplant."
              : undefined
          }
          className="lg:col-span-2"
          bodyClassName={cn(loading && "opacity-60 transition-opacity")}
        >
          <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-gray-100 bg-gray-100">
            {WEEKDAY_HEADERS.map((label) => (
              <div
                key={label}
                className="bg-card px-2 py-1.5 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
              >
                {label}
              </div>
            ))}
            {weeks.flatMap((week) =>
              week.map((cell) => {
                const summary = daySummaries.get(cell.key)
                const isToday = cell.key === todayKey
                const isSelected = cell.key === selectedKey
                return (
                  <button
                    key={cell.key}
                    type="button"
                    onClick={() => handleSelectDay(cell.key, cell.inMonth)}
                    className={cn(
                      "flex min-h-[84px] flex-col items-start gap-1 bg-card p-1.5 text-left transition-colors hover:bg-gray-50",
                      !cell.inMonth && "opacity-45",
                      isSelected && "bg-primary/5 ring-1 ring-inset ring-primary/40",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-6 w-6 items-center justify-center rounded-full text-xs tabular-nums",
                        isToday
                          ? "bg-primary font-semibold text-primary-foreground"
                          : "text-foreground",
                      )}
                    >
                      {cell.date.getDate()}
                    </span>
                    {summary && summary.total > 0 && (
                      <>
                        <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-secondary-foreground">
                          {summary.total} {summary.total === 1 ? "Job" : "Jobs"}
                        </span>
                        <span className="flex items-center gap-1">
                          {summary.statuses.map((status) => (
                            <span
                              key={status}
                              className={cn("h-1.5 w-1.5 rounded-full", STATUS_DOT[status])}
                            />
                          ))}
                        </span>
                      </>
                    )}
                  </button>
                )
              }),
            )}
          </div>
        </SectionCard>

        {/* ── Tagesagenda ── */}
        <SectionCard
          title={formatDayLabel(selectedKey)}
          subtitle={
            loading
              ? "Laden…"
              : `${selectedJobs.length} Auftr${selectedJobs.length === 1 ? "ag" : "äge"}`
          }
          noBodyPadding
        >
          {loading ? (
            <p className="px-5 py-8 text-center text-sm text-muted-foreground">
              Aufträge werden geladen…
            </p>
          ) : selectedJobs.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-muted-foreground">
              {hasActiveFilters
                ? "Keine Aufträge für diesen Tag mit der aktuellen Filterauswahl."
                : "Keine Aufträge an diesem Tag."}
            </p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {selectedJobs.map((job) => (
                <AgendaRow key={job.id} job={job} />
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
    </div>
  )
}

function AgendaRow({ job }: { job: Job }) {
  const time = getJobDisplayTime(job)
  const names = getAssigneeNames(job)
  return (
    <li>
      <Link
        href={`/jobs/${job.id}`}
        className="flex items-start justify-between gap-3 px-5 py-3.5 transition-colors hover:bg-gray-50/70"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {time && (
              <span className="text-xs font-medium tabular-nums text-muted-foreground">
                {time}
              </span>
            )}
            <span className="truncate text-sm font-medium text-foreground">
              {job.customer_name}
            </span>
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{job.service_name}</p>
          {job.location_address && (
            <span className="mt-1 flex items-center gap-1 text-xs text-muted-foreground/70">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{job.location_address}</span>
            </span>
          )}
          <span className="mt-1 flex items-center gap-1 text-xs text-muted-foreground/70">
            <Users className="h-3 w-3 shrink-0" />
            <span className="truncate">
              {names.length === 0 ? UNASSIGNED_LABEL : names.join(", ")}
            </span>
          </span>
        </div>
        <Badge variant={STATUS_VARIANT[job.status as JobStatus] ?? "outline"} className="shrink-0 gap-1.5">
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              STATUS_DOT[job.status as JobStatus] ?? "bg-muted-foreground",
            )}
          />
          {STATUS_LABEL[job.status as JobStatus] ?? job.status}
        </Badge>
      </Link>
    </li>
  )
}
