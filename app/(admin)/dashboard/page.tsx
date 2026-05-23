"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { useAdminJobs } from "@/hooks/use-admin-jobs"
import { PageHeader } from "@/components/ui/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Briefcase, CalendarDays, CheckCircle2, Clock, Users, ArrowRight, MapPin } from "lucide-react"
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

export default function DashboardPage() {
  const { jobs, loading: jobsLoading, counts } = useAdminJobs()
  const recentJobs = jobs.slice(0, 5)

  const supabase = createClient()
  const [totalEmployees, setTotalEmployees] = useState<number>(0)

  useEffect(() => {
    supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("role", "employee")
      .then(({ count }) => setTotalEmployees(count ?? 0))
  }, [])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Live overview of jobs, team, and today's schedule."
      >
        <Link href="/jobs/new">
          <Button>
            <Briefcase className="mr-2 h-4 w-4" />
            Create Job
          </Button>
        </Link>
      </PageHeader>

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">

        {/* Open Jobs */}
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader className="flex flex-row items-center justify-between p-4 pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wide text-amber-700">
              Open Jobs
            </CardTitle>
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-amber-100">
              <Clock className="h-3.5 w-3.5 text-amber-600" />
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-0">
            <p className="text-2xl font-bold text-amber-900">
              {jobsLoading ? "—" : counts.open}
            </p>
            <p className="mt-0.5 text-xs text-amber-600">Awaiting assignment</p>
          </CardContent>
        </Card>

        {/* In Progress */}
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader className="flex flex-row items-center justify-between p-4 pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wide text-blue-700">
              In Progress
            </CardTitle>
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-100">
              <Briefcase className="h-3.5 w-3.5 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-0">
            <p className="text-2xl font-bold text-blue-900">
              {jobsLoading ? "—" : counts.inProgress}
            </p>
            <p className="mt-0.5 text-xs text-blue-600">Currently active</p>
          </CardContent>
        </Card>

        {/* Completed */}
        <Card className="border-emerald-200 bg-emerald-50">
          <CardHeader className="flex flex-row items-center justify-between p-4 pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
              Completed
            </CardTitle>
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-100">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-0">
            <p className="text-2xl font-bold text-emerald-900">
              {jobsLoading ? "—" : counts.completed}
            </p>
            <p className="mt-0.5 text-xs text-emerald-600">All time</p>
          </CardContent>
        </Card>

        {/* Total Employees */}
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="flex flex-row items-center justify-between p-4 pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wide text-primary/80">
              Employees
            </CardTitle>
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10">
              <Users className="h-3.5 w-3.5 text-primary" />
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-0">
            <p className="text-2xl font-bold text-primary">{totalEmployees}</p>
            <p className="mt-0.5 text-xs text-primary/60">Team members</p>
          </CardContent>
        </Card>

        {/* Today's Jobs */}
        <Card className="col-span-2 lg:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between p-4 pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Today's Jobs
            </CardTitle>
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-secondary">
              <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-0">
            <p className="text-2xl font-bold">
              {jobsLoading ? "—" : counts.today}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">Scheduled today</p>
          </CardContent>
        </Card>

      </div>

      {/* ── Lower Section ── */}
      <div className="grid gap-4 lg:grid-cols-3">

        {/* Recent Jobs */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between border-b px-5 py-4">
            <div>
              <CardTitle className="text-sm font-semibold">Recent Jobs</CardTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">5 most recent jobs</p>
            </div>
            <Link href="/jobs">
              <Button variant="ghost" size="sm" className="text-xs text-muted-foreground">
                View all
                <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {jobsLoading ? (
              <div className="flex items-center justify-center h-24 text-sm text-muted-foreground">
                Loading…
              </div>
            ) : recentJobs.length > 0 ? (
              <ul className="divide-y">
                {recentJobs.map((job) => (
                  <li key={job.id} className="flex items-center justify-between px-5 py-3 hover:bg-muted/40 transition-colors">
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <p className="truncate text-sm font-medium">{job.customer_name}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{job.service_name}</span>
                        {job.location_address && (
                          <>
                            <span className="text-border">·</span>
                            <MapPin className="h-3 w-3 shrink-0" />
                            <span className="truncate max-w-[160px]">{job.location_address}</span>
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
                  <p className="mt-0.5 text-xs text-muted-foreground">Create your first job to get started.</p>
                </div>
                <Link href="/jobs/new">
                  <Button size="sm">Create First Job</Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader className="border-b px-5 py-4">
            <CardTitle className="text-sm font-semibold">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 p-4">
            <Link href="/jobs/new" className="block">
              <Button variant="outline" className="w-full justify-start gap-2 text-sm font-medium">
                <div className="flex h-6 w-6 items-center justify-center rounded bg-primary/10">
                  <Briefcase className="h-3.5 w-3.5 text-primary" />
                </div>
                Create New Job
              </Button>
            </Link>
            <Link href="/employees" className="block">
              <Button variant="outline" className="w-full justify-start gap-2 text-sm font-medium">
                <div className="flex h-6 w-6 items-center justify-center rounded bg-secondary">
                  <Users className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                View Employees
              </Button>
            </Link>
            <Link href="/jobs?status=open" className="block">
              <Button variant="outline" className="w-full justify-start gap-2 text-sm font-medium">
                <div className="flex h-6 w-6 items-center justify-center rounded bg-amber-50">
                  <Clock className="h-3.5 w-3.5 text-amber-600" />
                </div>
                View Open Jobs
              </Button>
            </Link>
          </CardContent>
        </Card>

      </div>
    </div>
  )
}
