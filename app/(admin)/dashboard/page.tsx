"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { useAdminJobs } from "@/hooks/use-admin-jobs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Briefcase,
  CalendarDays,
  ArrowRight,
  MapPin,
  Users,
  Clock,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  getJobDisplayTime,
  getRecurringDaysLabel,
  isJobToday,
} from "@/lib/jobs/jobSchedule"
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

function formatDate(iso: string | null) {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("de-DE", {
    day:   "2-digit",
    month: "2-digit",
    year:  "numeric",
  })
}

export default function DashboardPage() {
  const { jobs, loading: jobsLoading, counts } = useAdminJobs()
  const recentJobs = jobs.slice(0, 5)

  // "Heute" recurring-fähig (single per Datum/scheduled_start, recurring per
  // Wochentag, nur aktive); Sortierung nach Anzeige-Uhrzeit.
  const todaysJobs = jobs
    .filter((j) => isJobToday(j))
    .sort((a, b) =>
      (getJobDisplayTime(a) ?? "").localeCompare(getJobDisplayTime(b) ?? ""),
    )

  const supabase = createClient()
  const [totalEmployees, setTotalEmployees] = useState<number>(0)

  useEffect(() => {
    supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("role", "employee")
      .then(({ count }) => setTotalEmployees(count ?? 0))
  }, [])

  // Total — used for the "X Aufträge gesamt" footer
  const total = counts.open + counts.inProgress + counts.completed

  return (
    <div className="space-y-6">

      {/* ── Page header with Live badge ── */}
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-3xl font-bold tracking-tight">Übersicht</h1>
            <span className="flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Live
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Aufträge und Team – immer aktuell.
          </p>
        </div>
        <Link href="/jobs/new">
          <Button>
            <Briefcase className="mr-2 h-4 w-4" />
            Auftrag erstellen
          </Button>
        </Link>
      </div>

      {/* ── Top stat row: Jobs Overview (2 cols) + Today + Team ── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">

        {/* Jobs Overview — spans 2 of 4 cols on large screens */}
        <Card className="sm:col-span-2">
          <CardHeader className="px-5 pb-2 pt-4">
            <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Aktueller Auftragsstatus
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            {jobsLoading ? (
              <p className="text-sm text-muted-foreground">Laden…</p>
            ) : (
              <>
                <div className="space-y-2">
                  {/* Offen */}
                  <div className="flex items-center justify-between rounded-lg bg-amber-50 px-4 py-2.5">
                    <div>
                      <p className="text-sm font-semibold text-amber-800">Offen</p>
                      <p className="text-xs text-amber-600">wartet auf Bearbeitung</p>
                    </div>
                    <span className="text-2xl font-bold text-amber-700">
                      {counts.open}
                    </span>
                  </div>

                  {/* In Arbeit */}
                  <div className="flex items-center justify-between rounded-lg bg-blue-50 px-4 py-2.5">
                    <div>
                      <p className="text-sm font-semibold text-blue-800">In Arbeit</p>
                      <p className="text-xs text-blue-600">wird gerade ausgeführt</p>
                    </div>
                    <span className="text-2xl font-bold text-blue-700">
                      {counts.inProgress}
                    </span>
                  </div>

                  {/* Erledigt */}
                  <div className="flex items-center justify-between rounded-lg bg-emerald-50 px-4 py-2.5">
                    <div>
                      <p className="text-sm font-semibold text-emerald-800">Erledigt</p>
                      <p className="text-xs text-emerald-600">abgeschlossen</p>
                    </div>
                    <span className="text-2xl font-bold text-emerald-700">
                      {counts.completed}
                    </span>
                  </div>
                </div>

                <p className="mt-3 text-xs text-muted-foreground">
                  {total > 0 ? `${total} Aufträge gesamt` : "Noch keine Aufträge"}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Today's Jobs */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between p-4 pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Heutige Aufträge
            </CardTitle>
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-secondary">
              <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-5 pt-0">
            <p className="text-3xl font-bold">
              {jobsLoading ? "—" : counts.today}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Heute geplant
            </p>
          </CardContent>
        </Card>

        {/* Team */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between p-4 pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Team
            </CardTitle>
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10">
              <Users className="h-3.5 w-3.5 text-primary" />
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-5 pt-0">
            <p className="text-3xl font-bold text-primary">{totalEmployees}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Aktive Mitarbeiter
            </p>
          </CardContent>
        </Card>

      </div>

      {/* ── Today's Schedule ── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between border-b px-5 py-4">
          <div>
            <CardTitle className="text-sm font-semibold">Tagesplan</CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {jobsLoading
                ? "Laden…"
                : todaysJobs.length > 0
                ? `${todaysJobs.length} Auftrag${todaysJobs.length === 1 ? "" : "träge"} heute geplant`
                : "Heute keine Aufträge geplant"}
            </p>
          </div>
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-secondary">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {jobsLoading ? (
            <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
              Laden…
            </div>
          ) : todaysJobs.length > 0 ? (
            <ul className="divide-y">
              {todaysJobs.map((job: Job) => (
                <li
                  key={job.id}
                  className="flex items-center justify-between px-5 py-3.5 transition-colors hover:bg-muted/40"
                >
                  {/* Time column */}
                  <div className="mr-4 flex w-16 shrink-0 flex-col items-start">
                    <span className="text-sm font-semibold tabular-nums text-foreground">
                      {getJobDisplayTime(job) ? `${getJobDisplayTime(job)} Uhr` : "—"}
                    </span>
                  </div>

                  {/* Details */}
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <p className="truncate text-sm font-medium">{job.customer_name}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{job.service_name}</span>
                      {job.location_address && (
                        <>
                          <span className="text-border">·</span>
                          <MapPin className="h-3 w-3 shrink-0" />
                          <span className="max-w-[160px] truncate">
                            {job.location_address}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Status + link */}
                  <div className="ml-4 flex shrink-0 items-center gap-3">
                    <Badge variant={STATUS_VARIANT[job.status] ?? "outline"}>
                      {STATUS_LABEL[job.status] ?? job.status}
                    </Badge>
                    <Link href={`/jobs/${job.id}`}>
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
                <CalendarDays className="h-4.5 w-4.5 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">Heute keine Aufträge geplant.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Recent Jobs — full width ── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between border-b px-5 py-4">
          <div>
            <CardTitle className="text-sm font-semibold">Aktuelle Aufträge</CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Die 5 neuesten Aufträge
            </p>
          </div>
          <Link href="/jobs">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground"
            >
              Alle anzeigen
              <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          {jobsLoading ? (
            <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
              Laden…
            </div>
          ) : recentJobs.length > 0 ? (
            <ul className="divide-y">
              {recentJobs.map((job: Job) => (
                <li
                  key={job.id}
                  className="flex items-center justify-between px-5 py-3.5 transition-colors hover:bg-muted/40"
                >
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <p className="truncate text-sm font-medium">
                      {job.customer_name}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{job.service_name}</span>
                      {job.location_address && (
                        <>
                          <span className="text-border">·</span>
                          <MapPin className="h-3 w-3 shrink-0" />
                          <span className="max-w-[160px] truncate">
                            {job.location_address}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="ml-4 flex shrink-0 items-center gap-3">
                    <span className="hidden text-xs text-muted-foreground sm:block">
                      {job.job_type === "recurring"
                        ? getRecurringDaysLabel(job)
                        : formatDate(job.scheduled_start)}
                    </span>
                    <Badge variant={STATUS_VARIANT[job.status] ?? "outline"}>
                      {STATUS_LABEL[job.status] ?? job.status}
                    </Badge>
                    <Link href={`/jobs/${job.id}`}>
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                <Briefcase className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">Noch keine Aufträge</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Erstellen Sie Ihren ersten Auftrag, um zu beginnen.
                </p>
              </div>
              <Link href="/jobs/new">
                <Button size="sm">Ersten Auftrag erstellen</Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  )
}
