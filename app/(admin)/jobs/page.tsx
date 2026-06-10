"use client"

import { useState } from "react"
import Link from "next/link"
import { useAdminJobs } from "@/hooks/use-admin-jobs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { SectionCard } from "@/components/dashboard/SectionCard"
import { Briefcase, ChevronRight, Inbox, MapPin, Plus, Repeat, Search } from "lucide-react"
import { getJobDisplayTime, getRecurringDaysLabel } from "@/lib/jobs/jobSchedule"
import { cn } from "@/lib/utils"
import { Database } from "@/lib/supabase/database.types"

type Job = Database["public"]["Tables"]["jobs"]["Row"]

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

export default function JobsPage() {
  const { jobs, loading } = useAdminJobs()
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "in_progress" | "completed">("all")

  const filteredJobs = jobs.filter((job: Job) => {
    const matchesSearch =
      (job.customer_name?.toLowerCase() ?? "").includes(search.toLowerCase()) ||
      (job.service_name?.toLowerCase() ?? "").includes(search.toLowerCase())
    const matchesStatus = statusFilter === "all" || job.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const hasActiveFilters = search.trim() !== "" || statusFilter !== "all"

  const subtitle = loading
    ? "Laden…"
    : jobs.length === 0
      ? "Noch keine Aufträge"
      : hasActiveFilters
        ? `${filteredJobs.length} von ${jobs.length} Aufträgen`
        : `${jobs.length} Auftr${jobs.length === 1 ? "ag" : "äge"} gesamt`

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

      {/* ── Tabelle in Dashboard-SectionCard ── */}
      <SectionCard
        icon={Inbox}
        title="Alle Aufträge"
        subtitle={subtitle}
        action={
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {/* Suche */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Kunde oder Leistung suchen…"
                className="h-8 w-full pl-8 text-sm sm:w-56"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {/* Statusfilter */}
            <Select
              className="h-8 w-full text-sm sm:w-[150px]"
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as "all" | "open" | "in_progress" | "completed")
              }
            >
              <option value="all">Alle Status</option>
              <option value="open">Offen</option>
              <option value="in_progress">In Arbeit</option>
              <option value="completed">Erledigt</option>
            </Select>
          </div>
        }
        noBodyPadding
      >
        <Table>
          <TableHeader>
            <TableRow className="border-gray-100 hover:bg-transparent">
              <TableHead className="w-[240px] text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Kunde
              </TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Leistung
              </TableHead>
              <TableHead className="hidden text-xs font-medium uppercase tracking-wide text-muted-foreground md:table-cell">
                Adresse
              </TableHead>
              <TableHead className="hidden text-xs font-medium uppercase tracking-wide text-muted-foreground sm:table-cell">
                Termin
              </TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Status
              </TableHead>
              <TableHead className="w-[44px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow className="border-gray-100 hover:bg-transparent">
                <TableCell colSpan={6} className="h-32 text-center text-sm text-muted-foreground">
                  Aufträge werden geladen…
                </TableCell>
              </TableRow>
            ) : filteredJobs.length === 0 ? (
              <TableRow className="border-b-0 hover:bg-transparent">
                <TableCell colSpan={6} className="border-b-0 p-0">
                  <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary">
                      <Briefcase className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {hasActiveFilters ? "Keine Aufträge entsprechen den Filtern" : "Noch keine Aufträge"}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {hasActiveFilters
                          ? "Suche oder Statusfilter anpassen."
                          : "Erstellen Sie Ihren ersten Auftrag, um zu beginnen."}
                      </p>
                    </div>
                    {!hasActiveFilters && (
                      <Link href="/jobs/new">
                        <Button size="sm">Ersten Auftrag erstellen</Button>
                      </Link>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredJobs.map((job: Job) => (
                <TableRow
                  key={job.id}
                  className="group cursor-pointer border-gray-100 transition-colors hover:bg-gray-50/70"
                >
                  {/* Kunde mit Avatar */}
                  <TableCell className="py-3">
                    <Link href={`/jobs/${job.id}`} className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                        {initials(job.customer_name)}
                      </span>
                      <span className="truncate font-medium text-foreground">
                        {job.customer_name}
                      </span>
                    </Link>
                  </TableCell>

                  {/* Leistung */}
                  <TableCell className="py-3 text-sm text-muted-foreground">
                    {job.service_name}
                  </TableCell>

                  {/* Adresse */}
                  <TableCell className="hidden max-w-[200px] truncate py-3 text-sm text-muted-foreground md:table-cell">
                    {job.location_address ? (
                      <span className="flex items-center gap-1.5">
                        <MapPin className="h-3 w-3 shrink-0 text-muted-foreground/60" />
                        <span className="truncate">{job.location_address}</span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground/40">—</span>
                    )}
                  </TableCell>

                  {/* Termin + Recurring */}
                  <TableCell className="hidden py-3 text-sm text-muted-foreground sm:table-cell">
                    {job.job_type === "recurring" ? (
                      <span className="flex items-center gap-1.5">
                        <Badge variant="secondary" className="gap-1 font-medium">
                          <Repeat className="h-3 w-3" />
                          {getRecurringDaysLabel(job)}
                        </Badge>
                        {getJobDisplayTime(job) ? (
                          <span className="text-muted-foreground/70 tabular-nums">
                            {getJobDisplayTime(job)} Uhr
                          </span>
                        ) : null}
                      </span>
                    ) : (
                      <span className="tabular-nums">
                        {formatDate(
                          job.scheduled_start ??
                            (job.date ? `${job.date}T00:00` : null)
                        )}
                        {getJobDisplayTime(job) ? (
                          <span className="text-muted-foreground/70">
                            {" · "}
                            {getJobDisplayTime(job)} Uhr
                          </span>
                        ) : null}
                      </span>
                    )}
                  </TableCell>

                  {/* Status mit Dot */}
                  <TableCell className="py-3">
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

                  {/* Chevron */}
                  <TableCell className="py-3 text-right">
                    <Link href={`/jobs/${job.id}`} className="inline-flex">
                      <ChevronRight className="h-4 w-4 text-muted-foreground/40 transition-colors group-hover:text-muted-foreground" />
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </SectionCard>

    </div>
  )
}
