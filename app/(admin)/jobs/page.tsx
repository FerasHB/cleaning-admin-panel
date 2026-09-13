"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { useAdminJobs } from "@/hooks/use-admin-jobs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { SectionCard } from "@/components/dashboard/SectionCard"
import { Calendar, CalendarClock, CheckCircle2, ChevronRight, MapPin, PauseCircle, Plus, Repeat, Search, Users } from "lucide-react"
import { getJobDisplayTime, getRecurringDaysLabel, isJobToday } from "@/lib/jobs/jobSchedule"
import { formatDateISO } from "@/lib/date"
import {
  getAssigneeNames,
  getEmployees,
  isAssignedTo,
  isOccurrence,
  isRecurringRule,
  isStandaloneSingle,
  UNASSIGNED_LABEL,
  type EmployeeOption,
  type JobWithAssignments,
} from "@/lib/jobs/jobs.service"
import { cn } from "@/lib/utils"

type Job = JobWithAssignments
type StatusFilter = "all" | "open" | "in_progress" | "completed"
// Wie Mobiles EmployeeSelection: "all" | "unassigned" | <employeeId>.
type EmployeeSelection = "all" | "unassigned" | string

const STATUS_LABEL: Record<string, string> = {
  open:        "Offen",
  in_progress: "In Arbeit",
  completed:   "Erledigt",
}

const STATUS_VARIANT: Record<string, "warning" | "info" | "success"> = {
  open:        "warning",
  in_progress: "info",
  completed:   "success",
}

const STATUS_DOT: Record<string, string> = {
  open:        "bg-amber-400",
  in_progress: "bg-blue-500",
  completed:   "bg-emerald-500",
}

// Aktive Pill-Töne je Filter (inaktiv = ruhiges gray-100).
const PILL_ACTIVE: Record<StatusFilter, string> = {
  all:         "bg-primary/10 text-primary ring-1 ring-inset ring-primary/15",
  open:        "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200",
  in_progress: "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200",
  completed:   "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200",
}

function formatDate(iso: string | null) {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("de-DE", {
    day:   "2-digit",
    month: "2-digit",
    year:  "numeric",
  })
}

// Datum eines ausführbaren Auftrags: date ist maßgeblich (wie isJobToday),
// scheduled_start nur Fallback für Alt-Daten.
function jobDateLabel(job: Job) {
  return formatDate(job.date ? `${job.date.slice(0, 10)}T00:00` : job.scheduled_start)
}

function initials(name: string | null) {
  if (!name) return "?"
  return (
    name
      .trim()
      .split(/\s+/)
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?"
  )
}

// Sortierschlüssel für Termine: Datum, dann Uhrzeit.
function occurrenceSortKey(job: Job) {
  return `${job.date ?? ""}T${job.start_time ?? ""}`
}

// ── Wiederverwendbare Zell-Bausteine (lokal, kein Shared-UI) ──

// unread: wie Mobiles JobCard-Punkt — reiner Boolean, kein Zähler.
function CustomerCell({ job, unread }: { job: Job; unread?: boolean }) {
  return (
    <TableCell className="py-4 pl-5">
      <Link href={`/jobs/${job.id}`} className="flex items-center gap-3">
        <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
          {initials(job.customer_name)}
          {unread && (
            <span
              aria-label="Ungelesene Kommentare"
              className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-destructive ring-2 ring-card"
            />
          )}
        </span>
        <span className="min-w-0">
          <span className="block truncate font-medium leading-tight text-foreground">
            {job.customer_name}
          </span>
          <span className="block truncate text-xs leading-tight text-muted-foreground">
            {job.service_name}
          </span>
        </span>
      </Link>
    </TableCell>
  )
}

function AddressCell({ job }: { job: Job }) {
  return (
    <TableCell className="hidden max-w-[220px] py-4 text-sm text-muted-foreground lg:table-cell">
      {job.location_address ? (
        <span className="flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
          <span className="truncate">{job.location_address}</span>
        </span>
      ) : (
        <span className="text-muted-foreground/40">—</span>
      )}
    </TableCell>
  )
}

// Zugewiesene Mitarbeiter aus der Zuweisungsmenge (job_assignments).
function AssigneesCell({ job }: { job: Job }) {
  const names = getAssigneeNames(job)
  return (
    <TableCell className="hidden max-w-[200px] py-4 text-sm md:table-cell">
      {names.length === 0 ? (
        <span className="text-muted-foreground/60">{UNASSIGNED_LABEL}</span>
      ) : (
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Users className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
          <span className="truncate" title={names.join(", ")}>
            {names.length <= 2 ? names.join(", ") : `${names.slice(0, 2).join(", ")} +${names.length - 2}`}
          </span>
        </span>
      )}
    </TableCell>
  )
}

function StatusCell({ job }: { job: Job }) {
  return (
    <TableCell className="py-4">
      <Badge variant={STATUS_VARIANT[job.status] ?? "outline"} className="gap-1.5">
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            STATUS_DOT[job.status] ?? "bg-muted-foreground",
          )}
        />
        {STATUS_LABEL[job.status] ?? job.status}
      </Badge>
    </TableCell>
  )
}

function DateCell({ job }: { job: Job }) {
  const today = isJobToday(job)
  const time = getJobDisplayTime(job)
  return (
    <TableCell className="hidden py-4 sm:table-cell">
      <div className="flex flex-col gap-0.5">
        <span className="flex items-center gap-1.5 text-sm">
          <Calendar className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
          <span className="tabular-nums text-foreground">{jobDateLabel(job)}</span>
          {today && (
            <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
              Heute
            </span>
          )}
        </span>
        {time && (
          <span className="pl-5 text-xs tabular-nums text-muted-foreground/70">
            {time} Uhr
          </span>
        )}
      </div>
    </TableCell>
  )
}

function ChevronCell({ job }: { job: Job }) {
  return (
    <TableCell className="py-4 pr-5 text-right">
      <Link href={`/jobs/${job.id}`} className="inline-flex" aria-label="Auftrag öffnen">
        <ChevronRight className="h-4 w-4 text-muted-foreground/40 transition-colors group-hover:text-muted-foreground" />
      </Link>
    </TableCell>
  )
}

function LoadingRow({ colSpan }: { colSpan: number }) {
  return (
    <TableRow className="border-gray-100 hover:bg-transparent">
      <TableCell colSpan={colSpan} className="h-24 text-center text-sm text-muted-foreground">
        Aufträge werden geladen…
      </TableCell>
    </TableRow>
  )
}

function EmptyRow({
  colSpan,
  hasActiveFilters,
  emptyTitle,
  emptyHint,
  showCreate = true,
}: {
  colSpan: number
  hasActiveFilters: boolean
  emptyTitle: string
  emptyHint: string
  showCreate?: boolean
}) {
  return (
    <TableRow className="border-b-0 hover:bg-transparent">
      <TableCell colSpan={colSpan} className="border-b-0 p-0">
        <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary">
            <Calendar className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium">
              {hasActiveFilters ? "Keine Aufträge entsprechen den Filtern" : emptyTitle}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {hasActiveFilters ? "Suche oder Statusfilter anpassen." : emptyHint}
            </p>
          </div>
          {!hasActiveFilters && showCreate && (
            <Link href="/jobs/new">
              <Button size="sm">Auftrag erstellen</Button>
            </Link>
          )}
        </div>
      </TableCell>
    </TableRow>
  )
}

const TH = "text-xs font-medium uppercase tracking-wide text-muted-foreground"

export default function JobsPage() {
  const { jobs, loading, error, unreadJobIds } = useAdminJobs()
  const [search, setSearch] = useState("")
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
        // still — der Filter bleibt einfach leer, keine Blockade der Liste.
      })
    return () => {
      mounted = false
    }
  }, [])

  // Picker-Liste wie Mobiles AdminJobsScreen: nur aktive Mitarbeiter, auch
  // wenn getEmployees() alle liefert.
  const activeEmployees = employees.filter((e) => e.isActive)

  const matchesSearch = (job: Job) => {
    const q = search.toLowerCase()
    return (
      (job.customer_name?.toLowerCase() ?? "").includes(q) ||
      (job.service_name?.toLowerCase() ?? "").includes(q)
    )
  }
  const matchesStatus = (job: Job) => statusFilter === "all" || job.status === statusFilter
  // Eine gemeinsame Funktion für alle drei Sections (Einzelaufträge, Regeln,
  // Termine) — wie Mobile über job_assignments, nie über den Legacy-Zeiger.
  // Bei Regeln mit mehreren Mitarbeitern reicht EIN passender Eintrag (wie
  // Mobiles isAssignedTo/matchesRuleFilters-OR-Semantik).
  const matchesEmployee = (job: Job) => {
    if (employeeFilter === "all") return true
    if (employeeFilter === "unassigned") return (job.assignments ?? []).length === 0
    return isAssignedTo(job, employeeFilter)
  }

  // Backend-Modell: drei getrennte Gruppen.
  //   Einzelaufträge: job_type='single' ohne parent_job_id
  //   Termine:        generierte Occurrences (parent_job_id gesetzt)
  //   Daueraufträge:  Regeln (job_type='recurring' ohne parent_job_id)
  const singles = jobs.filter(isStandaloneSingle)
  const occurrences = jobs.filter(isOccurrence)
  const rules = jobs.filter(isRecurringRule)

  const filteredSingles = singles.filter((j) => matchesSearch(j) && matchesStatus(j) && matchesEmployee(j))
  const filteredOccurrences = occurrences
    .filter((j) => matchesSearch(j) && matchesStatus(j) && matchesEmployee(j))
    .sort((a, b) => occurrenceSortKey(a).localeCompare(occurrenceSortKey(b)))
  // Regeln haben keinen Arbeitsstatus — der Statusfilter gilt nur für Aufträge/Termine.
  const filteredRules = rules.filter((j) => matchesSearch(j) && matchesEmployee(j))

  // Nächster anstehender Termin je Regel (aus den bereits geladenen Terminen).
  const todayKey = formatDateISO(new Date()) ?? ""
  const upcomingByRule = new Map<string, { next: Job | null; count: number }>()
  for (const occ of [...occurrences].sort((a, b) => occurrenceSortKey(a).localeCompare(occurrenceSortKey(b)))) {
    if (!occ.parent_job_id || !occ.date || occ.date.slice(0, 10) < todayKey) continue
    const entry = upcomingByRule.get(occ.parent_job_id) ?? { next: null, count: 0 }
    entry.count += 1
    if (!entry.next) entry.next = occ
    upcomingByRule.set(occ.parent_job_id, entry)
  }

  const hasActiveFilters = search.trim() !== "" || statusFilter !== "all" || employeeFilter !== "all"
  const hasActiveRuleFilters = search.trim() !== "" || employeeFilter !== "all"

  // Counts für die Status-Pills — über alle AUSFÜHRBAREN Aufträge (Einzelaufträge + Termine).
  const executable = [...singles, ...occurrences]
  const counts = {
    all:         executable.length,
    open:        executable.filter((j) => j.status === "open").length,
    in_progress: executable.filter((j) => j.status === "in_progress").length,
    completed:   executable.filter((j) => j.status === "completed").length,
  }

  const pills: { key: StatusFilter; label: string }[] = [
    { key: "all",         label: "Alle" },
    { key: "open",        label: "Offen" },
    { key: "in_progress", label: "In Arbeit" },
    { key: "completed",   label: "Erledigt" },
  ]

  const countLabel = (n: number) => `${n} Auftr${n === 1 ? "ag" : "äge"}`

  return (
    <div className="space-y-5">

      {/* ── Page header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Aufträge
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Alle Reinigungsaufträge verwalten und verfolgen.
          </p>
        </div>
        <Link href="/jobs/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Auftrag erstellen
          </Button>
        </Link>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm font-medium text-destructive">
          Aufträge konnten nicht geladen werden: {error}
        </div>
      )}

      {/* ── Gemeinsame Toolbar: Suche + Status-Pills ── */}
      <div className="flex flex-col gap-3 rounded-2xl border border-gray-100 bg-card px-5 py-3.5 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_1px_3px_rgba(16,24,40,0.06)] lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            aria-label="Aufträge durchsuchen"
            placeholder="Kunde oder Leistung suchen…"
            className="h-9 w-full pl-9 text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Mitarbeiter-Filter: wie Mobiles EmployeeFilterControl — all /
              unassigned / eine bestimmte ID, über job_assignments. */}
          <label className="sr-only" htmlFor="employee-filter">
            Nach Mitarbeiter filtern
          </label>
          <select
            id="employee-filter"
            value={employeeFilter}
            onChange={(e) => setEmployeeFilter(e.target.value)}
            className="h-9 rounded-md border border-input bg-transparent px-2.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
          >
            <option value="all">Alle Mitarbeiter</option>
            <option value="unassigned">Nicht zugewiesen</option>
            {activeEmployees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.fullName}
              </option>
            ))}
          </select>

          <div className="flex flex-wrap items-center gap-1.5">
          {pills.map((p) => {
            const active = statusFilter === p.key
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => setStatusFilter(p.key)}
                aria-pressed={active}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                  active
                    ? PILL_ACTIVE[p.key]
                    : "text-muted-foreground hover:bg-gray-100 hover:text-foreground",
                )}
              >
                {p.label}
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
                    active ? "bg-white/70" : "bg-gray-100 text-muted-foreground",
                  )}
                >
                  {counts[p.key]}
                </span>
              </button>
            )
          })}
          </div>
        </div>
      </div>

      {/* ── Section A: Einzelaufträge ── */}
      <SectionCard
        icon={Calendar}
        title="Einmalige Aufträge"
        subtitle={loading ? "Laden…" : countLabel(filteredSingles.length)}
        noBodyPadding
      >
        <Table>
          <TableHeader>
            <TableRow className="border-gray-100 hover:bg-transparent">
              <TableHead className={cn("pl-5", TH)}>Kunde</TableHead>
              <TableHead className={cn("hidden md:table-cell", TH)}>Mitarbeiter</TableHead>
              <TableHead className={cn("hidden lg:table-cell", TH)}>Adresse</TableHead>
              <TableHead className={cn("hidden sm:table-cell", TH)}>Termin</TableHead>
              <TableHead className={TH}>Status</TableHead>
              <TableHead className="w-[44px] pr-5" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <LoadingRow colSpan={6} />
            ) : filteredSingles.length === 0 ? (
              <EmptyRow
                colSpan={6}
                hasActiveFilters={hasActiveFilters}
                emptyTitle="Noch keine einmaligen Aufträge"
                emptyHint="Erstellen Sie Ihren ersten Auftrag, um zu beginnen."
              />
            ) : (
              filteredSingles.map((job) => (
                <TableRow key={job.id} className="group border-gray-100 transition-colors hover:bg-gray-50/70">
                  <CustomerCell job={job} unread={unreadJobIds.has(job.id)} />
                  <AssigneesCell job={job} />
                  <AddressCell job={job} />
                  <DateCell job={job} />
                  <StatusCell job={job} />
                  <ChevronCell job={job} />
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </SectionCard>

      {/* ── Section B: Daueraufträge (Regeln) ── */}
      <SectionCard
        icon={Repeat}
        title="Daueraufträge"
        subtitle={
          loading
            ? "Laden…"
            : `${filteredRules.length} Regel${filteredRules.length === 1 ? "" : "n"} · Statusfilter gilt nur für Termine`
        }
        noBodyPadding
      >
        <Table>
          <TableHeader>
            <TableRow className="border-gray-100 hover:bg-transparent">
              <TableHead className={cn("pl-5", TH)}>Kunde</TableHead>
              <TableHead className={cn("hidden md:table-cell", TH)}>Mitarbeiter</TableHead>
              <TableHead className={cn("hidden sm:table-cell", TH)}>Wochentage</TableHead>
              <TableHead className={cn("hidden lg:table-cell", TH)}>Nächster Termin</TableHead>
              <TableHead className={TH}>Regel</TableHead>
              <TableHead className="w-[44px] pr-5" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <LoadingRow colSpan={6} />
            ) : filteredRules.length === 0 ? (
              <EmptyRow
                colSpan={6}
                hasActiveFilters={hasActiveRuleFilters}
                emptyTitle="Noch keine Daueraufträge"
                emptyHint="Legen Sie einen wiederkehrenden Auftrag an, um zu beginnen."
              />
            ) : (
              filteredRules.map((job) => {
                const time = getJobDisplayTime(job)
                const upcoming = upcomingByRule.get(job.id)
                return (
                  <TableRow key={job.id} className="group border-gray-100 transition-colors hover:bg-gray-50/70">
                    <CustomerCell job={job} unread={unreadJobIds.has(job.id)} />
                    <AssigneesCell job={job} />
                    <TableCell className="hidden py-4 sm:table-cell">
                      <div className="flex flex-col gap-1">
                        <Badge variant="secondary" className="w-fit gap-1 font-medium">
                          <Repeat className="h-3 w-3" />
                          {getRecurringDaysLabel(job)}
                        </Badge>
                        {time && (
                          <span className="text-xs tabular-nums text-muted-foreground/70">
                            {time} Uhr
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="hidden py-4 text-sm lg:table-cell">
                      {upcoming?.next ? (
                        <div className="flex flex-col gap-0.5">
                          <span className="tabular-nums text-foreground">{jobDateLabel(upcoming.next)}</span>
                          <span className="text-xs text-muted-foreground/70">
                            {upcoming.count} anstehend
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground/60">Keine anstehenden Termine</span>
                      )}
                    </TableCell>
                    <TableCell className="py-4">
                      {job.is_active ? (
                        <Badge variant="success" className="gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Aktiv
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="gap-1">
                          <PauseCircle className="h-3 w-3" />
                          Inaktiv
                        </Badge>
                      )}
                    </TableCell>
                    <ChevronCell job={job} />
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </SectionCard>

      {/* ── Section C: Termine aus Daueraufträgen ── */}
      <SectionCard
        icon={CalendarClock}
        title="Termine aus Daueraufträgen"
        subtitle={loading ? "Laden…" : `${filteredOccurrences.length} Termin${filteredOccurrences.length === 1 ? "" : "e"}`}
        noBodyPadding
      >
        <Table>
          <TableHeader>
            <TableRow className="border-gray-100 hover:bg-transparent">
              <TableHead className={cn("pl-5", TH)}>Kunde</TableHead>
              <TableHead className={cn("hidden md:table-cell", TH)}>Mitarbeiter</TableHead>
              <TableHead className={cn("hidden lg:table-cell", TH)}>Adresse</TableHead>
              <TableHead className={cn("hidden sm:table-cell", TH)}>Termin</TableHead>
              <TableHead className={TH}>Status</TableHead>
              <TableHead className="w-[44px] pr-5" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <LoadingRow colSpan={6} />
            ) : filteredOccurrences.length === 0 ? (
              <EmptyRow
                colSpan={6}
                hasActiveFilters={hasActiveFilters}
                emptyTitle="Keine Termine"
                emptyHint="Termine werden aus aktiven Daueraufträgen automatisch erzeugt."
                showCreate={false}
              />
            ) : (
              filteredOccurrences.map((job) => (
                <TableRow key={job.id} className="group border-gray-100 transition-colors hover:bg-gray-50/70">
                  <CustomerCell job={job} unread={unreadJobIds.has(job.id)} />
                  <AssigneesCell job={job} />
                  <AddressCell job={job} />
                  <DateCell job={job} />
                  <StatusCell job={job} />
                  <ChevronCell job={job} />
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </SectionCard>

    </div>
  )
}
