"use client"

import { useState } from "react"
import Link from "next/link"
import { useAdminJobs } from "@/hooks/use-admin-jobs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Briefcase, MapPin, Plus, Search, Pencil } from "lucide-react"
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

  return (
    <div className="space-y-6">

      {/* ── Page header ── */}
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Jobs</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage and track all cleaning jobs.
          </p>
        </div>
        <Link href="/jobs/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Create Job
          </Button>
        </Link>
      </div>

      {/* ── Toolbar: search + status filter + results count ── */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search customer or service…"
              className="h-8 w-full pl-8 text-sm sm:w-64"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Status filter */}
          <Select
            className="h-8 w-full text-sm sm:w-[160px]"
            value={statusFilter}
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

        {/* Results count */}
        {!loading && jobs.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {hasActiveFilters
              ? `Showing ${filteredJobs.length} of ${jobs.length} job${jobs.length === 1 ? "" : "s"}`
              : `${jobs.length} job${jobs.length === 1 ? "" : "s"} total`}
          </p>
        )}
      </div>

      {/* ── Table ── */}
      <div className="rounded-lg border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="w-[200px] font-semibold text-foreground">Customer</TableHead>
              <TableHead className="font-semibold text-foreground">Service</TableHead>
              <TableHead className="hidden font-semibold text-foreground md:table-cell">Location</TableHead>
              <TableHead className="hidden font-semibold text-foreground sm:table-cell">Date</TableHead>
              <TableHead className="font-semibold text-foreground">Status</TableHead>
              <TableHead className="w-[60px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-sm text-muted-foreground">
                  Loading jobs…
                </TableCell>
              </TableRow>
            ) : filteredJobs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="border-b-0 p-0">
                  <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                      <Briefcase className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {hasActiveFilters ? "No jobs match your filters" : "No jobs yet"}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {hasActiveFilters
                          ? "Try adjusting your search or status filter."
                          : "Create your first job to get started."}
                      </p>
                    </div>
                    {!hasActiveFilters && (
                      <Link href="/jobs/new">
                        <Button size="sm">Create First Job</Button>
                      </Link>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredJobs.map((job: Job) => (
                <TableRow
                  key={job.id}
                  className="transition-colors hover:bg-muted/40"
                >
                  <TableCell className="py-3.5 font-medium">{job.customer_name}</TableCell>
                  <TableCell className="py-3.5 text-sm text-muted-foreground">
                    {job.service_name}
                  </TableCell>
                  <TableCell className="hidden max-w-[200px] truncate py-3.5 text-sm text-muted-foreground md:table-cell">
                    {job.location_address ? (
                      <span className="flex items-center gap-1.5">
                        <MapPin className="h-3 w-3 shrink-0 text-muted-foreground/60" />
                        <span className="truncate">{job.location_address}</span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground/40">—</span>
                    )}
                  </TableCell>
                  <TableCell className="hidden py-3.5 text-sm text-muted-foreground sm:table-cell">
                    {formatDate(job.scheduled_start)}
                  </TableCell>
                  <TableCell className="py-3.5">
                    <Badge variant={STATUS_VARIANT[job.status] ?? "outline"}>
                      {STATUS_LABEL[job.status] ?? job.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-3.5 text-right">
                    <Link href={`/jobs/${job.id}`}>
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <Pencil className="h-3.5 w-3.5" />
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
