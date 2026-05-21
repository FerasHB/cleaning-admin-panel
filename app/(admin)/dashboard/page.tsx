import { createClient } from "@/lib/supabase/server"
import { PageHeader } from "@/components/ui/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Briefcase, CalendarDays, CheckCircle2, Clock, Users, ArrowRight } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Database } from "@/lib/supabase/database.types"

type Job = Database['public']['Tables']['jobs']['Row']

// Maps raw DB status values → display label and badge variant
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

export default async function DashboardPage() {
  const supabase = await createClient()

  // Date range for "today" — start of day to end of day
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayEnd = new Date()
  todayEnd.setHours(23, 59, 59, 999)

  // Fetch metrics in parallel
  const [
    { count: openJobs },
    { count: inProgressJobs },
    { count: completedJobs },
    { count: totalEmployees },
    { count: todayJobs },
    { data: recentJobs },
  ] = await Promise.all([
    supabase.from("jobs").select("*", { count: "exact", head: true }).eq("status", "open"),
    supabase.from("jobs").select("*", { count: "exact", head: true }).eq("status", "in_progress"),
    supabase.from("jobs").select("*", { count: "exact", head: true }).eq("status", "completed"),
    supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "employee"),
    supabase.from("jobs").select("*", { count: "exact", head: true })
      .gte("scheduled_start", todayStart.toISOString())
      .lte("scheduled_start", todayEnd.toISOString()),
    supabase.from("jobs").select("*").order("scheduled_start", { ascending: false }).limit(5),
  ])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Overview of your cleaning business operations."
      >
        <Link href="/jobs/new">
          <Button>Create Job</Button>
        </Link>
      </PageHeader>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {/* Open Jobs */}
        <Card className="bg-amber-50 border-amber-200">
          <CardHeader className="flex flex-row items-center justify-between p-4 pb-2">
            <CardTitle className="text-sm font-medium text-amber-800">Open Jobs</CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-0">
            <div className="text-2xl font-bold text-amber-900">{openJobs || 0}</div>
          </CardContent>
        </Card>

        {/* In Progress */}
        <Card className="bg-blue-50 border-blue-200">
          <CardHeader className="flex flex-row items-center justify-between p-4 pb-2">
            <CardTitle className="text-sm font-medium text-blue-800">In Progress</CardTitle>
            <Briefcase className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-0">
            <div className="text-2xl font-bold text-blue-900">{inProgressJobs || 0}</div>
          </CardContent>
        </Card>

        {/* Completed */}
        <Card className="bg-emerald-50 border-emerald-200">
          <CardHeader className="flex flex-row items-center justify-between p-4 pb-2">
            <CardTitle className="text-sm font-medium text-emerald-800">Completed</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-0">
            <div className="text-2xl font-bold text-emerald-900">{completedJobs || 0}</div>
          </CardContent>
        </Card>

        {/* Total Employees */}
        <Card className="bg-primary/5 border-primary/20">
          <CardHeader className="flex flex-row items-center justify-between p-4 pb-2">
            <CardTitle className="text-sm font-medium text-primary/80">Total Employees</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-0">
            <div className="text-2xl font-bold text-primary">{totalEmployees || 0}</div>
          </CardContent>
        </Card>

        {/* Today's Jobs */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between p-4 pb-2">
            <CardTitle className="text-sm font-medium">Today's Jobs</CardTitle>
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-0">
            <div className="text-2xl font-bold">{todayJobs || 0}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="col-span-2">
          <CardHeader>
            <CardTitle>Recent Jobs</CardTitle>
            <CardDescription>The 5 most recently created or updated jobs.</CardDescription>
          </CardHeader>
          <CardContent>
            {recentJobs && recentJobs.length > 0 ? (
              <div className="space-y-4">
                {(recentJobs as Job[]).map((job) => (
                  <div key={job.id} className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0">
                    <div className="space-y-1">
                      <p className="font-medium leading-none">{job.customer_name}</p>
                      <p className="text-sm text-muted-foreground">{job.service_name}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <Badge variant={STATUS_VARIANT[job.status] ?? "outline"}>
                        {STATUS_LABEL[job.status] ?? job.status}
                      </Badge>
                      <Link href={`/jobs/${job.id}`}>
                        <Button variant="ghost" size="icon">
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex h-[150px] flex-col items-center justify-center gap-3 rounded-md border border-dashed">
                <p className="text-sm text-muted-foreground">No jobs yet — create your first one to get started.</p>
                <Link href="/jobs/new">
                  <Button variant="outline" size="sm">Create First Job</Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link href="/jobs/new" className="block">
              <Button variant="outline" className="w-full justify-start">
                <Briefcase className="mr-2 h-4 w-4" />
                Create New Job
              </Button>
            </Link>
            <Link href="/employees" className="block">
              <Button variant="outline" className="w-full justify-start">
                <Users className="mr-2 h-4 w-4" />
                View Employees
              </Button>
            </Link>
            <Link href="/jobs?status=open" className="block">
              <Button variant="outline" className="w-full justify-start">
                <Clock className="mr-2 h-4 w-4" />
                View Open Jobs
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
