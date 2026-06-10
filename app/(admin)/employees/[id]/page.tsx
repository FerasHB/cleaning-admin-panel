"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { EmptyState } from "@/components/ui/empty-state"
import { SectionCard } from "@/components/dashboard/SectionCard"
import { StatCard } from "@/components/dashboard/StatCard"
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Inbox,
  Loader,
  MapPin,
  MessageSquare,
  PauseCircle,
  Phone,
  Repeat,
  Users,
} from "lucide-react"
import { getJobDisplayTime, getRecurringDaysLabel, isJobToday } from "@/lib/jobs/jobSchedule"
import { formatDateTimeDE } from "@/lib/date"
import { cn } from "@/lib/utils"
import type { Database } from "@/lib/supabase/database.types"

type Profile = Database["public"]["Tables"]["profiles"]["Row"]
type Job = Database["public"]["Tables"]["jobs"]["Row"]

type CommentRow = {
  id: string
  job_id: string
  message: string
  created_at: string
  jobs?: { customer_name: string | null } | { customer_name: string | null }[] | null
}

type EmployeeComment = {
  id: string
  jobId: string
  message: string
  createdAt: string
  customerName: string | null
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

function formatDate(iso: string | null) {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  })
}

// ── Auftrags-Zeile (wiederverwendet in beiden Auftrags-Sections) ──
function JobRowItem({ job }: { job: Job }) {
  const today = isJobToday(job)
  const time = getJobDisplayTime(job)
  const isRecurring = job.job_type === "recurring"
  return (
    <li>
      <Link
        href={`/jobs/${job.id}`}
        className="group flex items-center gap-3 px-5 py-3 transition-colors hover:bg-gray-50/70"
      >
        <span
          className={cn(
            "flex h-2 w-2 shrink-0 rounded-full",
            STATUS_DOT[job.status] ?? "bg-muted-foreground",
          )}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">
            {job.customer_name}
          </p>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="truncate">{job.service_name}</span>
            {job.location_address && (
              <>
                <span>·</span>
                <MapPin className="h-3 w-3 shrink-0" />
                <span className="max-w-[140px] truncate">{job.location_address}</span>
              </>
            )}
          </div>
        </div>
        <div className="hidden flex-col items-end gap-0.5 sm:flex">
          {isRecurring ? (
            <Badge variant="secondary" className="gap-1 font-medium">
              <Repeat className="h-3 w-3" />
              {getRecurringDaysLabel(job)}
            </Badge>
          ) : (
            <span className="flex items-center gap-1.5 text-xs tabular-nums text-muted-foreground">
              <Calendar className="h-3 w-3" />
              {formatDate(job.scheduled_start ?? (job.date ? `${job.date}T00:00` : null))}
              {today && (
                <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                  Heute
                </span>
              )}
            </span>
          )}
          {time && (
            <span className="text-[11px] tabular-nums text-muted-foreground/70">
              {time} Uhr
            </span>
          )}
        </div>
        <Badge variant={STATUS_VARIANT[job.status] ?? "outline"} className="gap-1.5">
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              STATUS_DOT[job.status] ?? "bg-muted-foreground",
            )}
          />
          {STATUS_LABEL[job.status] ?? job.status}
        </Badge>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/40 transition-colors group-hover:text-muted-foreground" />
      </Link>
    </li>
  )
}

function JobsEmpty({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 px-5 py-6 text-sm text-muted-foreground">
      <Inbox className="h-4 w-4" />
      {label}
    </div>
  )
}

export default function EmployeeDetailPage() {
  const params = useParams()
  const router = useRouter()
  const employeeId = params.id as string
  const [supabase] = useState(() => createClient())

  const [profile, setProfile] = useState<Profile | null>(null)
  const [jobs, setJobs] = useState<Job[]>([])
  const [comments, setComments] = useState<EmployeeComment[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    let mounted = true
    const load = async () => {
      const [profileRes, jobsRes, commentsRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", employeeId).single(),
        supabase
          .from("jobs")
          .select("*")
          .eq("assigned_to", employeeId)
          .order("created_at", { ascending: false }),
        supabase
          .from("job_comments")
          .select("id, job_id, message, created_at, jobs(customer_name)")
          .eq("author_id", employeeId)
          .order("created_at", { ascending: false })
          .limit(8),
      ])

      if (!mounted) return

      if (profileRes.error || !profileRes.data) {
        setNotFound(true)
        setLoading(false)
        return
      }

      setProfile(profileRes.data as Profile)
      setJobs((jobsRes.data as Job[]) ?? [])
      setComments(
        ((commentsRes.data ?? []) as unknown as CommentRow[]).map((c) => ({
          id: c.id,
          jobId: c.job_id,
          message: c.message,
          createdAt: c.created_at,
          customerName: Array.isArray(c.jobs)
            ? c.jobs[0]?.customer_name ?? null
            : c.jobs?.customer_name ?? null,
        })),
      )
      setLoading(false)
    }

    if (employeeId) load()
    return () => {
      mounted = false
    }
  }, [employeeId, supabase])

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground">Mitarbeiter wird geladen…</div>
  }

  if (notFound || !profile) {
    return (
      <EmptyState
        icon={Users}
        title="Mitarbeiter nicht gefunden"
        description="Dieser Mitarbeiter ist nicht (mehr) verfügbar."
        action={
          <Link href="/employees">
            <Button>Zur Mitarbeiterliste</Button>
          </Link>
        }
      />
    )
  }

  const counts = {
    open: jobs.filter((j) => j.status === "open").length,
    in_progress: jobs.filter((j) => j.status === "in_progress").length,
    completed: jobs.filter((j) => j.status === "completed").length,
    total: jobs.length,
  }

  const currentJobs = jobs.filter(
    (j) => j.status === "open" || j.status === "in_progress",
  )
  const completedJobs = jobs.filter((j) => j.status === "completed")

  // Letzte Aktivität aus vorhandenen Daten ableiten (started/completed/Kommentar).
  const activityTimestamps: string[] = [
    ...jobs.flatMap((j) => [j.started_at, j.completed_at].filter(Boolean) as string[]),
    ...comments.map((c) => c.createdAt),
  ]
  const lastActivity =
    activityTimestamps.length > 0
      ? activityTimestamps.sort((a, b) => b.localeCompare(a))[0]
      : null

  const roleLabel = profile.role === "admin" ? "Administrator" : "Mitarbeiter"

  return (
    <div className="space-y-5">
      {/* ── Zurück-Link ── */}
      <button
        type="button"
        onClick={() => router.push("/employees")}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Mitarbeiter
      </button>

      {/* ── Kopfzeile ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3.5">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-base font-semibold text-primary">
            {initials(profile.full_name)}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                {profile.full_name}
              </h1>
              <Badge variant="info">{roleLabel}</Badge>
              {profile.is_active ? (
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
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              {profile.phone && (
                <span className="flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 shrink-0" />
                  {profile.phone}
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 shrink-0" />
                Mitarbeiter seit {formatDate(profile.created_at)}
              </span>
              {lastActivity && (
                <span className="flex items-center gap-1.5">
                  <Loader className="h-3.5 w-3.5 shrink-0" />
                  Zuletzt aktiv {formatDateTimeDE(lastActivity)}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Job-Statistik ── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={Inbox} label="Offen" value={counts.open} tone="amber" />
        <StatCard icon={Loader} label="In Arbeit" value={counts.in_progress} tone="blue" />
        <StatCard icon={CheckCircle2} label="Erledigt" value={counts.completed} tone="emerald" />
        <StatCard icon={Users} label="Gesamt" value={counts.total} tone="primary" />
      </div>

      {/* ── Aktuelle Aufträge ── */}
      <SectionCard
        icon={Inbox}
        title="Aktuelle Aufträge"
        subtitle={`${currentJobs.length} offen oder in Arbeit`}
        noBodyPadding
      >
        {currentJobs.length > 0 ? (
          <ul className="divide-y divide-gray-100">
            {currentJobs.map((job) => (
              <JobRowItem key={job.id} job={job} />
            ))}
          </ul>
        ) : (
          <JobsEmpty label="Keine aktuellen Aufträge." />
        )}
      </SectionCard>

      {/* ── Abgeschlossene Aufträge ── */}
      <SectionCard
        icon={CheckCircle2}
        title="Abgeschlossene Aufträge"
        subtitle={`${completedJobs.length} erledigt`}
        noBodyPadding
      >
        {completedJobs.length > 0 ? (
          <ul className="divide-y divide-gray-100">
            {completedJobs.map((job) => (
              <JobRowItem key={job.id} job={job} />
            ))}
          </ul>
        ) : (
          <JobsEmpty label="Noch keine abgeschlossenen Aufträge." />
        )}
      </SectionCard>

      {/* ── Aktivität / Kommentare ── */}
      <SectionCard
        icon={MessageSquare}
        title="Aktivität"
        subtitle="Letzte Kommentare dieses Mitarbeiters"
        noBodyPadding
      >
        {comments.length > 0 ? (
          <ul className="divide-y divide-gray-100">
            {comments.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/jobs/${c.jobId}`}
                  className="group flex items-start gap-3 px-5 py-3 transition-colors hover:bg-gray-50/70"
                >
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600 ring-1 ring-inset ring-blue-100">
                    <MessageSquare className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span className="text-sm font-medium text-foreground">
                        {c.customerName ?? "Auftrag"}
                      </span>
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {formatDateTimeDE(c.createdAt)}
                      </span>
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
                      {c.message}
                    </p>
                  </div>
                  <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground/40 transition-colors group-hover:text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary">
              <MessageSquare className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">Noch keine Kommentare</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Kommentare dieses Mitarbeiters erscheinen hier.
              </p>
            </div>
          </div>
        )}
      </SectionCard>
    </div>
  )
}
