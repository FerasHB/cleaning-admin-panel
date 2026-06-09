"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { EmptyState } from "@/components/ui/empty-state"
import {
  ArrowLeft,
  Briefcase,
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  History,
  MapPin,
  MessageSquare,
  PauseCircle,
  Pencil,
  Repeat,
  User,
} from "lucide-react"
import { JobDetailRow } from "@/components/jobs/JobDetailRow"
import { JobTimeline } from "@/components/jobs/JobTimeline"
import { JobComments } from "@/components/jobs/JobComments"
import { getJobDisplayTime, getRecurringDaysLabel } from "@/lib/jobs/jobSchedule"
import { formatDateTimeDE } from "@/lib/date"
import type { Database } from "@/lib/supabase/database.types"

type JobRow = Database["public"]["Tables"]["jobs"]["Row"]
type JobDetail = JobRow & {
  assignee:
    | { full_name: string | null }
    | { full_name: string | null }[]
    | null
}

const STATUS_LABEL: Record<string, string> = {
  open: "Offen",
  in_progress: "In Arbeit",
  completed: "Erledigt",
}

const STATUS_VARIANT: Record<string, "warning" | "info" | "success"> = {
  open: "warning",
  in_progress: "info",
  completed: "success",
}

function employeeName(job: JobDetail): string {
  const a = job.assignee
  const name = Array.isArray(a) ? a[0]?.full_name : a?.full_name
  return name ?? "Nicht zugewiesen"
}

export default function JobDetailPage() {
  const params = useParams()
  const router = useRouter()
  const jobId = params.id as string
  const supabase = createClient()

  const [job, setJob] = useState<JobDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    const fetchJob = async () => {
      const { data, error } = await supabase
        .from("jobs")
        .select("*, assignee:profiles!jobs_assigned_to_fkey(full_name)")
        .eq("id", jobId)
        .single()

      if (!mounted) return
      if (error) {
        console.error("Failed to fetch job:", error)
        setJob(null)
      } else {
        setJob(data as unknown as JobDetail)
      }
      setLoading(false)
    }

    if (jobId) fetchJob()
    return () => {
      mounted = false
    }
  }, [jobId, supabase])

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground">Auftrag wird geladen…</div>
  }

  if (!job) {
    return (
      <EmptyState
        icon={Briefcase}
        title="Auftrag nicht gefunden"
        description="Dieser Auftrag ist nicht (mehr) verfügbar."
        action={
          <Link href="/jobs">
            <Button>Zur Auftragsliste</Button>
          </Link>
        }
      />
    )
  }

  const isRecurring = job.job_type === "recurring"
  const displayTime = getJobDisplayTime(job)
  const terminText = isRecurring
    ? `${getRecurringDaysLabel(job)}${displayTime ? ` · ${displayTime} Uhr` : ""}`
    : formatDateTimeDE(job.scheduled_start) ??
      (job.date
        ? `${job.date}${displayTime ? `, ${displayTime} Uhr` : ""}`
        : "Kein Termin geplant")

  return (
    <div className="space-y-6">
      {/* ── Kopfzeile ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/jobs")}
            className="mt-0.5"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight">
                {job.customer_name}
              </h1>
              <Badge variant={STATUS_VARIANT[job.status] ?? "outline"}>
                {STATUS_LABEL[job.status] ?? job.status}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{job.service_name}</p>
          </div>
        </div>

        <Link href={`/jobs/${jobId}/edit`}>
          <Button variant="outline">
            <Pencil className="mr-2 h-4 w-4" />
            Bearbeiten
          </Button>
        </Link>
      </div>

      {/* ── Details + Timeline ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Details */}
        <Card className="lg:col-span-2">
          <CardHeader className="border-b px-6 py-4">
            <CardTitle className="text-sm font-semibold">Auftragsdetails</CardTitle>
          </CardHeader>
          <CardContent className="px-6 py-2">
            <div className="divide-y">
              <JobDetailRow icon={Briefcase} label="Leistung" value={job.service_name} />
              <JobDetailRow
                icon={MapPin}
                label="Einsatzort"
                value={job.location_address || "—"}
              />
              <JobDetailRow icon={User} label="Mitarbeiter" value={employeeName(job)} />
              <JobDetailRow
                icon={isRecurring ? Repeat : Calendar}
                label="Auftragstyp"
                value={isRecurring ? "Wiederkehrend" : "Einmalig"}
              />
              <JobDetailRow
                icon={Clock}
                label={isRecurring ? "Wochentage & Uhrzeit" : "Termin"}
                value={terminText}
              />
              {isRecurring && (
                <JobDetailRow
                  icon={job.is_active ? CheckCircle2 : PauseCircle}
                  label="Status der Regel"
                  value={job.is_active ? "Aktiv" : "Inaktiv"}
                />
              )}
            </div>
          </CardContent>
        </Card>

        {/* Timeline */}
        <Card>
          <CardHeader className="flex flex-row items-center gap-2 border-b px-6 py-4">
            <History className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-semibold">Verlauf</CardTitle>
          </CardHeader>
          <CardContent className="px-6 py-5">
            <JobTimeline
              createdAt={job.created_at}
              startedAt={job.started_at}
              completedAt={job.completed_at}
            />
          </CardContent>
        </Card>
      </div>

      {/* ── Notizen ── */}
      {job.notes && (
        <Card>
          <CardHeader className="flex flex-row items-center gap-2 border-b px-6 py-4">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-semibold">Notizen</CardTitle>
          </CardHeader>
          <CardContent className="px-6 py-5">
            <p className="whitespace-pre-wrap break-words text-sm text-foreground">
              {job.notes}
            </p>
          </CardContent>
        </Card>
      )}

      {/* ── Kommentare ── */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-2 border-b px-6 py-4">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-sm font-semibold">Kommentare</CardTitle>
        </CardHeader>
        <CardContent className="px-6 py-5">
          <JobComments jobId={jobId} />
        </CardContent>
      </Card>
    </div>
  )
}
