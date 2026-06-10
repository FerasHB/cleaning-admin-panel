"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { EmptyState } from "@/components/ui/empty-state"
import { SectionCard } from "@/components/dashboard/SectionCard"
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
import { cn } from "@/lib/utils"
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

const STATUS_DOT: Record<string, string> = {
  open: "bg-amber-400",
  in_progress: "bg-blue-500",
  completed: "bg-emerald-500",
}

function employeeName(job: JobDetail): string {
  const a = job.assignee
  const name = Array.isArray(a) ? a[0]?.full_name : a?.full_name
  return name ?? "Nicht zugewiesen"
}

function initials(name: string | null): string {
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
    <div className="space-y-5">
      {/* ── Zurück-Link ── */}
      <button
        type="button"
        onClick={() => router.push("/jobs")}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Aufträge
      </button>

      {/* ── Kopfzeile ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3.5">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-base font-semibold text-primary">
            {initials(job.customer_name)}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                {job.customer_name}
              </h1>
              <Badge variant={STATUS_VARIANT[job.status] ?? "outline"} className="gap-1.5">
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    STATUS_DOT[job.status] ?? "bg-muted-foreground",
                  )}
                />
                {STATUS_LABEL[job.status] ?? job.status}
              </Badge>
            </div>
            {/* Meta-Zeile: Leistung · Termin · Ort */}
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Briefcase className="h-3.5 w-3.5 shrink-0" />
                {job.service_name}
              </span>
              <span className="flex items-center gap-1.5">
                {isRecurring ? (
                  <Repeat className="h-3.5 w-3.5 shrink-0" />
                ) : (
                  <Calendar className="h-3.5 w-3.5 shrink-0" />
                )}
                {terminText}
              </span>
              {job.location_address && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  <span className="max-w-[220px] truncate">{job.location_address}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        <Link href={`/jobs/${jobId}/edit`} className="shrink-0">
          <Button variant="outline">
            <Pencil className="mr-2 h-4 w-4" />
            Bearbeiten
          </Button>
        </Link>
      </div>

      {/* ── Details + Timeline ── */}
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-3">
        {/* Details */}
        <SectionCard
          className="lg:col-span-2"
          icon={Briefcase}
          title="Auftragsdetails"
          noBodyPadding
        >
          <div className="grid grid-cols-1 gap-x-6 px-5 sm:grid-cols-2">
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
        </SectionCard>

        {/* Timeline */}
        <SectionCard icon={History} title="Verlauf">
          <JobTimeline
            createdAt={job.created_at}
            startedAt={job.started_at}
            completedAt={job.completed_at}
          />
        </SectionCard>
      </div>

      {/* ── Notizen ── */}
      {job.notes && (
        <SectionCard icon={FileText} title="Notizen">
          <p className="whitespace-pre-wrap break-words text-sm text-foreground">
            {job.notes}
          </p>
        </SectionCard>
      )}

      {/* ── Kommentare ── */}
      <SectionCard icon={MessageSquare} title="Kommentare">
        <JobComments jobId={jobId} />
      </SectionCard>
    </div>
  )
}
