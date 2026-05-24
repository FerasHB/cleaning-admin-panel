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
import { Database } from "@/lib/supabase/database.types"

type Job = Database["public"]["Tables"]["jobs"]["Row"]

const STATUS_LABEL: Record<string, string> = {
  open:        "Open",
  in_progress: "In Progress",
  completed:   "Completed",
}

const STATUS_VARIANT: Record<string, "warning" | "info" | "success"> = {
  open:        "warning",
  in_progress: "info",
  completed:   "success",
}

function formatDate(iso: string | null) {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day:   "numeric",
    year:  "numeric",
  })
}

function formatTime(iso: string | null) {
  if (!iso) return "—"
  return new Date(iso).toLocaleTimeString("en-US", {
    hour:   "numeric",
    minute: "2-digit",
    hour12: true,
  })
}

function isToday(iso: string | null) {
  if (!iso) return false
  return new Date(iso).toDateString() === new Date().toDateString()
}

export default function DashboardPage() {
  const { jobs, loading: jobsLoading, counts } = useAdminJobs()
  const recentJobs = jobs.slice(0, 5)

  const todaysJobs = jobs
    .filter((j) => isToday(j.scheduled_start))
    .sort((a, b) => {
      if (!a.scheduled_start) return 1
      if (!b.scheduled_start) return -1
      return new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime()
    })

  const supabase = createClient()
  const [totalEmployees, setTotalEmployees] = useState<number>(0)

  useEffect(() => {
    supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("role", "employee")
      .then(({ count }) => setTotalEmployees(count ?? 0))
  }, [])

  // Proportion bar — derived from existing counts, no new data
  const total = counts.open + counts.inProgress + counts.completed
  const openPct       = total > 0 ? (counts.open        / total) * 100 : 0
  const inProgressPct = total > 0 ? (counts.inProgress  / total) * 100 : 0
  const completedPct  = total > 0 ? (counts.completed   / total) * 100 : 0

  return (
    <div className="space-y-6">

      {/* ── Page header with Live badge ── */}
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
            <span className="flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Live
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Your jobs and team, updated in real time.
          </p>
        </div>
        <Link href="/jobs/new">
          <Button>
            <Briefcase className="mr-2 h-4 w-4" />
            Create Job
          </Button>
        </Link>
      </div>

      {/* ── Top stat row: Jobs Overview (2 cols) + Today + Team ── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">

        {/* Jobs Overview — spans 2 of 4 cols on large screens */}
        <Card className="sm:col-span-2">
          <CardHeader className="px-5 pb-2 pt-4">
            <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Jobs Overview
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            {jobsLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : (
              <>
                {/* Three status counts */}
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div>
                    <p className="text-3xl font-bold text-amber-600">
                      {counts.open}
                    </p>
                    <p className="mt-0.5 text-xs font-medium text-muted-foreground">
                      Open
                    </p>
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-blue-600">
                      {counts.inProgress}
                    </p>
                    <p className="mt-0.5 text-xs font-medium text-muted-foreground">
                      In Progress
                    </p>
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-emerald-600">
                      {counts.completed}
                    </p>
                    <p className="mt-0.5 text-xs font-medium text-muted-foreground">
                      Completed
                    </p>
                  </div>
                </div>

                {/* Proportion bar */}
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  {total > 0 ? (
                    <div className="flex h-full w-full">
                      <div
                        className="h-full bg-amber-400"
                        style={{ width: `${openPct}%` }}
                      />
                      <div
                        className="h-full bg-blue-400"
                        style={{ width: `${inProgressPct}%` }}
                      />
                      <div
                        className="h-full bg-emerald-400"
                        style={{ width: `${completedPct}%` }}
                      />
                    </div>
                  ) : (
                    <div className="h-full w-full bg-muted" />
                  )}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {total > 0 ? `${total} total jobs` : "No jobs yet"}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Today's Jobs */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between p-4 pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Today's Jobs
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
              Scheduled today
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
              Active employees
            </p>
          </CardContent>
        </Card>

      </div>

      {/* ── Today's Schedule ── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between border-b px-5 py-4">
          <div>
            <CardTitle className="text-sm font-semibold">Today's Schedule</CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {jobsLoading
                ? "Loading…"
                : todaysJobs.length > 0
                ? `${todaysJobs.length} job${todaysJobs.length === 1 ? "" : "s"} scheduled today`
                : "No jobs scheduled for today"}
            </p>
          </div>
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-secondary">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {jobsLoading ? (
            <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
              Loading…
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
                      {formatTime(job.scheduled_start)}
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
              <p className="text-sm text-muted-foreground">No jobs scheduled for today.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Recent Jobs — full width ── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between border-b px-5 py-4">
          <div>
            <CardTitle className="text-sm font-semibold">Recent Jobs</CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">
              5 most recent jobs
            </p>
          </div>
          <Link href="/jobs">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground"
            >
              View all
              <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          {jobsLoading ? (
            <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
              Loading…
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
                      {formatDate(job.scheduled_start)}
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
                <p className="text-sm font-medium">No jobs yet</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Create your first job to get started.
                </p>
              </div>
              <Link href="/jobs/new">
                <Button size="sm">Create First Job</Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  )
}
