"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { PageHeader } from "@/components/ui/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { EmptyState } from "@/components/ui/empty-state"
import { Briefcase, Edit, Plus, Search } from "lucide-react"

type Job = any // You can type this better using Database['public']['Tables']['jobs']['Row']

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

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")


  const supabase = createClient()
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "in_progress" | "completed">("all")
  const fetchJobs = async () => {
    setLoading(true)

    let query = supabase
      .from("jobs")
      .select("*")
      .order("scheduled_start", { ascending: false })

    if (statusFilter !== "all") {
      query = query.eq("status", statusFilter)
    }

    const { data, error } = await query

    if (error) {
      console.error(error)
    } else {
      setJobs(data ?? [])
    }

    setLoading(false)
  }

  useEffect(() => {
    fetchJobs()

    // Realtime subscription
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'jobs',
        },
        () => {
          fetchJobs() // Re-fetch all on any change
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [statusFilter]) // re-run when status filter changes

  // Client side search filter
  const filteredJobs = jobs.filter(
    (job) =>
      (job.customer_name?.toLowerCase() || "").includes(search.toLowerCase()) ||
      (job.service_name?.toLowerCase() || "").includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <PageHeader title="Jobs" description="Manage and assign cleaning jobs.">
        <Link href="/jobs/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Create Job
          </Button>
        </Link>
      </PageHeader>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search customer or service…"
            className="h-8 pl-8 text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select
          className="h-8 w-full text-sm sm:w-[160px]"
          onChange={(e) =>
            setStatusFilter(e.target.value as "all" | "open" | "in_progress" | "completed")
          }
        >
          <option value="all">All Statuses</option>
          <option value="open">Open</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
        </Select>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Customer</TableHead>
              <TableHead>Service</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  Loading jobs...
                </TableCell>
              </TableRow>
            ) : filteredJobs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-auto p-0 border-b-0">
                  <EmptyState
                    icon={Briefcase}
                    title="No jobs found"
                    description="Get started by creating a new job or try adjusting your filters."
                    action={
                      <Link href="/jobs/new">
                        <Button variant="outline">Create Job</Button>
                      </Link>
                    }
                  />
                </TableCell>
              </TableRow>
            ) : (
              filteredJobs.map((job) => (
                <TableRow key={job.id}>
                  <TableCell className="font-medium">{job.customer_name}</TableCell>
                  <TableCell>{job.service_name}</TableCell>
                  <TableCell className="truncate max-w-[200px]">{job.location_address}</TableCell>
                  <TableCell>
                    {job.scheduled_start ? new Date(job.scheduled_start).toLocaleDateString() : 'N/A'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[job.status] ?? "outline"}>
                      {STATUS_LABEL[job.status] ?? job.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Link href={`/jobs/${job.id}`}>
                      <Button variant="ghost" size="icon">
                        <Edit className="h-4 w-4" />
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
