"use client"

import { useState } from "react"
import Link from "next/link"
import { useAdminJobs } from "@/hooks/use-admin-jobs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { SectionCard } from "@/components/dashboard/SectionCard"
import { Calendar, CheckCircle2, ChevronRight, MapPin, PauseCircle, Plus, Repeat, Search } from "lucide-react"
import { getJobDisplayTime, getRecurringDaysLabel, isJobToday } from "@/lib/jobs/jobSchedule"
import { cn } from "@/lib/utils"
import { Database } from "@/lib/supabase/database.types"

type Job = Database["public"]["Tables"]["jobs"]["Row"]
type StatusFilter = "all" | "open" | "in_progress" | "completed"

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

// ── Wiederverwendbare Zell-Bausteine (lokal, kein Shared-UI) ──

function CustomerCell({ job }: { job: Job }) {
  return (
    <TableCell className="py-4 pl-5">
      <Link href={`/jobs/${job.id}`} className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
          {initials(job.customer_name)}
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
    <TableCell className="hidden max-w-[220px] py-4 text-sm text-muted-foreground md:table-cell">
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

function ChevronCell({ job }: { job: Job }) {
  return (
    <TableCell className="py-4 pr-5 text-right">
      <Link href={`/jobs/${job.id}`} className="inline-flex">
        <ChevronRight className="h-4 w-4 text-muted-foreground/40 transition-colors group-hover:text-muted-foreground" />
      </Link>
    </TableCell>
  )
}

function EmptyRow({
  colSpan,
  hasActiveFilters,
  emptyTitle,
  emptyHint,
}: {
  colSpan: number
  hasActiveFilters: boolean
  emptyTitle: string
  emptyHint: string
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
          {!hasActiveFilters && (
            <Link href="/jobs/new">
              <Button size="sm">Auftrag erstellen</Button>
            </Link>
          )}
        </div>
      </TableCell>
    </TableRow>
  )
}

export default function JobsPage() {
  const { jobs, loading } = useAdminJobs()
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")

  const matches = (job: Job) => {
    const matchesSearch =
      (job.customer_name?.toLowerCase() ?? "").includes(search.toLowerCase()) ||
      (job.service_name?.toLowerCase() ?? "").includes(search.toLowerCase())
    const matchesStatus = statusFilter === "all" || job.status === statusFilter
    return matchesSearch && matchesStatus
  }

  const filtered = jobs.filter(matches)
  const singles = filtered.filter((j) => j.job_type === "single")
  const recurring = filtered.filter((j) => j.job_type === "recurring")

  const hasActiveFilters = search.trim() !== "" || statusFilter !== "all"

  // Counts für die Status-Pills — global über ALLE Jobs (beide Typen).
  const counts = {
    all:         jobs.length,
    open:        jobs.filter((j) => j.status === "open").length,
    in_progress: jobs.filter((j) => j.status === "in_progress").length,
    completed:   jobs.filter((j) => j.status === "completed").length,
  }

  const pills: { key: StatusFilter; label: string }[] = [
    { key: "all",         label: "Alle" },
    { key: "open",        label: "Offen" },
    { key: "in_progress", label: "In Arbeit" },
    { key: "completed",   label: "Erledigt" },
  ]

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

      {/* ── Gemeinsame Toolbar: Suche + Status-Pills (filtern beide Listen) ── */}
      <div className="flex flex-col gap-3 rounded-2xl border border-gray-100 bg-card px-5 py-3.5 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_1px_3px_rgba(16,24,40,0.06)] lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Kunde oder Leistung suchen…"
            className="h-9 w-full pl-9 text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {pills.map((p) => {
            const active = statusFilter === p.key
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => setStatusFilter(p.key)}
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

      {/* ── Section A: Einmalige Aufträge ── */}
      <SectionCard
        icon={Calendar}
        title="Einmalige Aufträge"
        subtitle={loading ? "Laden…" : `${singles.length} Auftr${singles.length === 1 ? "ag" : "äge"}`}
        noBodyPadding
      >
        <Table>
          <TableHeader>
            <TableRow className="border-gray-100 hover:bg-transparent">
              <TableHead className="pl-5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Kunde</TableHead>
              <TableHead className="hidden text-xs font-medium uppercase tracking-wide text-muted-foreground md:table-cell">Adresse</TableHead>
              <TableHead className="hidden text-xs font-medium uppercase tracking-wide text-muted-foreground sm:table-cell">Termin</TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Status</TableHead>
              <TableHead className="w-[44px] pr-5" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow className="border-gray-100 hover:bg-transparent">
                <TableCell colSpan={5} className="h-24 text-center text-sm text-muted-foreground">
                  Aufträge werden geladen…
                </TableCell>
              </TableRow>
            ) : singles.length === 0 ? (
              <EmptyRow
                colSpan={5}
                hasActiveFilters={hasActiveFilters}
                emptyTitle="Noch keine einmaligen Aufträge"
                emptyHint="Erstellen Sie Ihren ersten Auftrag, um zu beginnen."
              />
            ) : (
              singles.map((job) => {
                const today = isJobToday(job)
                const time = getJobDisplayTime(job)
                return (
                  <TableRow
                    key={job.id}
                    className="group cursor-pointer border-gray-100 transition-colors hover:bg-gray-50/70"
                  >
                    <CustomerCell job={job} />
                    <AddressCell job={job} />
                    {/* Termin (Datum + Uhrzeit + Heute) */}
                    <TableCell className="hidden py-4 sm:table-cell">
                      <div className="flex flex-col gap-0.5">
                        <span className="flex items-center gap-1.5 text-sm">
                          <Calendar className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
                          <span className="tabular-nums text-foreground">
                            {formatDate(
                              job.scheduled_start ??
                                (job.date ? `${job.date}T00:00` : null),
                            )}
                          </span>
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
                    <StatusCell job={job} />
                    <ChevronCell job={job} />
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </SectionCard>

      {/* ── Section B: Wiederkehrende Aufträge ── */}
      <SectionCard
        icon={Repeat}
        title="Wiederkehrende Aufträge"
        subtitle={loading ? "Laden…" : `${recurring.length} Auftr${recurring.length === 1 ? "ag" : "äge"}`}
        noBodyPadding
      >
        <Table>
          <TableHeader>
            <TableRow className="border-gray-100 hover:bg-transparent">
              <TableHead className="pl-5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Kunde</TableHead>
              <TableHead className="hidden text-xs font-medium uppercase tracking-wide text-muted-foreground md:table-cell">Adresse</TableHead>
              <TableHead className="hidden text-xs font-medium uppercase tracking-wide text-muted-foreground sm:table-cell">Wochentage</TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Status</TableHead>
              <TableHead className="w-[44px] pr-5" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow className="border-gray-100 hover:bg-transparent">
                <TableCell colSpan={5} className="h-24 text-center text-sm text-muted-foreground">
                  Aufträge werden geladen…
                </TableCell>
              </TableRow>
            ) : recurring.length === 0 ? (
              <EmptyRow
                colSpan={5}
                hasActiveFilters={hasActiveFilters}
                emptyTitle="Noch keine wiederkehrenden Aufträge"
                emptyHint="Legen Sie einen wiederkehrenden Auftrag an, um zu beginnen."
              />
            ) : (
              recurring.map((job) => {
                const time = getJobDisplayTime(job)
                return (
                  <TableRow
                    key={job.id}
                    className="group cursor-pointer border-gray-100 transition-colors hover:bg-gray-50/70"
                  >
                    <CustomerCell job={job} />
                    <AddressCell job={job} />
                    {/* Wochentage + Uhrzeit */}
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
                    {/* Status + Aktiv/Inaktiv */}
                    <TableCell className="py-4">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant={STATUS_VARIANT[job.status] ?? "outline"} className="gap-1.5">
                          <span
                            className={cn(
                              "h-1.5 w-1.5 rounded-full",
                              STATUS_DOT[job.status] ?? "bg-muted-foreground",
                            )}
                          />
                          {STATUS_LABEL[job.status] ?? job.status}
                        </Badge>
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
                      </div>
                    </TableCell>
                    <ChevronCell job={job} />
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </SectionCard>

    </div>
  )
}
