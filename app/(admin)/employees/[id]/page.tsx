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
  Mail,
  MailCheck,
  MapPin,
  MessageSquare,
  PauseCircle,
  Phone,
  PlayCircle,
  Repeat,
  Send,
  Users,
} from "lucide-react"
import { getJobDisplayTime, getRecurringDaysLabel, isJobToday } from "@/lib/jobs/jobSchedule"
import { formatDateTimeDE } from "@/lib/date"
import { cn } from "@/lib/utils"
import type { Database } from "@/lib/supabase/database.types"
import {
  getExecutableJobsForEmployee,
  type JobWithAssignments,
} from "@/lib/jobs/jobs.service"
import {
  getEmployeeEmailMap,
  getEmployeeStatus,
  resendInvite,
  setEmployeeActive,
} from "@/lib/employees/employees.service"
import { formatPhoneForDisplay } from "@/lib/auth/validation"

type Profile = Database["public"]["Tables"]["profiles"]["Row"]
type Job = JobWithAssignments

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
              {formatDate(job.date ? `${job.date.slice(0, 10)}T00:00` : job.scheduled_start)}
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
  const [email, setEmail] = useState<string | null>(null)

  // Aktionen: Einladung erneut senden, (De)aktivieren (wie Mobiles
  // EmployeeDetailScreen, mit Sicherheitsabfrage vor dem Statuswechsel).
  const [actionMessage, setActionMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null)
  const [resending, setResending] = useState(false)
  const [updatingActive, setUpdatingActive] = useState(false)
  const [confirmingActiveChange, setConfirmingActiveChange] = useState(false)

  useEffect(() => {
    let mounted = true
    const load = async () => {
      // Aufträge über die Zuweisungsmenge (job_assignments), nicht über den
      // Legacy-Zeiger assigned_to — sonst fehlen alle Aufträge, bei denen der
      // Mitarbeiter nicht der erste Zugewiesene ist. Nur ausführbare Arbeit
      // (Einzelaufträge + Termine), wie Mobiles Mitarbeiter-Detail.
      const [profileRes, jobsResult, commentsRes, emailMap] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", employeeId).single(),
        getExecutableJobsForEmployee(supabase, employeeId).then(
          (data) => ({ data, error: null as unknown }),
          (error: unknown) => ({ data: [] as Job[], error }),
        ),
        supabase
          .from("job_comments")
          .select("id, job_id, message, created_at, jobs(customer_name)")
          .eq("author_id", employeeId)
          .order("created_at", { ascending: false })
          .limit(8),
        // E-Mail liegt nur in auth.users — RPC get_company_employee_emails.
        getEmployeeEmailMap(supabase),
      ])

      if (!mounted) return

      if (profileRes.error || !profileRes.data) {
        setNotFound(true)
        setLoading(false)
        return
      }

      setProfile(profileRes.data as Profile)
      setEmail(emailMap.get(employeeId) ?? null)
      if (jobsResult.error) {
        console.error("Failed to load employee jobs:", jobsResult.error)
      }
      setJobs(jobsResult.data)
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
  const isEmployee = profile.role === "employee"
  const accountActive = profile.is_active !== false
  const status = getEmployeeStatus({
    isActive: accountActive,
    inviteAcceptedAt: profile.invite_accepted_at,
  })
  const invitePending = status.variant === "pending"
  const busy = resending || updatingActive

  // Einladung erneut senden — nur solange sie noch nicht angenommen wurde
  // (serverseitig in resend-invite zusätzlich abgesichert).
  const handleResendInvite = async () => {
    if (busy) return
    setActionMessage(null)
    setResending(true)
    try {
      const mode = await resendInvite(supabase, profile.id)
      setActionMessage({
        tone: "success",
        text:
          mode === "recovery"
            ? `${profile.full_name} hat einen Link zum Passwort-Setzen erhalten.`
            : `${profile.full_name} hat eine neue Einladungs-E-Mail erhalten.`,
      })
      if (mode === "invite") {
        // invited_at wird von der Function aktualisiert.
        setProfile({ ...profile, invited_at: new Date().toISOString() })
      }
    } catch (err) {
      setActionMessage({
        tone: "error",
        text: err instanceof Error ? err.message : "Einladung konnte nicht erneut verschickt werden.",
      })
    } finally {
      setResending(false)
    }
  }

  // Deaktivieren/Reaktivieren nach Bestätigung. Kein Löschen: Aufträge,
  // Zuweisungen und Kommentare bleiben erhalten.
  const applyActiveChange = async () => {
    const nextActive = !accountActive
    setConfirmingActiveChange(false)
    setActionMessage(null)
    setUpdatingActive(true)
    try {
      await setEmployeeActive(supabase, profile.id, nextActive)
      setProfile({ ...profile, is_active: nextActive, expo_push_token: nextActive ? profile.expo_push_token : null })
      setActionMessage({
        tone: "success",
        text: nextActive ? "Mitarbeiter wurde reaktiviert." : "Mitarbeiter wurde deaktiviert.",
      })
    } catch (err) {
      setActionMessage({
        tone: "error",
        text: err instanceof Error ? err.message : "Status konnte nicht geändert werden.",
      })
    } finally {
      setUpdatingActive(false)
    }
  }

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
              {/* Einladungs-/Kontostatus wie Mobile: Eingeladen / Aktiv / Inaktiv */}
              {status.variant === "pending" ? (
                <Badge variant="warning" className="gap-1">
                  <Mail className="h-3 w-3" />
                  Eingeladen
                </Badge>
              ) : status.variant === "active" ? (
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
              {/* Eingeladen UND deaktiviert: Konto-Sperre zusätzlich sichtbar */}
              {invitePending && !accountActive && (
                <Badge variant="secondary" className="gap-1">
                  <PauseCircle className="h-3 w-3" />
                  Inaktiv
                </Badge>
              )}
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 shrink-0" />
                {email ?? "E-Mail nicht verfügbar"}
              </span>
              {profile.phone && (
                <span className="flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 shrink-0" />
                  {formatPhoneForDisplay(profile.phone)}
                </span>
              )}
              {profile.invite_accepted_at ? (
                <span className="flex items-center gap-1.5">
                  <MailCheck className="h-3.5 w-3.5 shrink-0" />
                  Einladung angenommen am {formatDate(profile.invite_accepted_at)}
                </span>
              ) : profile.invited_at ? (
                <span className="flex items-center gap-1.5">
                  <Send className="h-3.5 w-3.5 shrink-0" />
                  Eingeladen am {formatDate(profile.invited_at)}
                </span>
              ) : null}
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

        {isEmployee && (
          <div className="flex shrink-0 flex-wrap gap-2">
            {invitePending && (
              <Button variant="outline" onClick={handleResendInvite} disabled={busy}>
                <Send className="mr-2 h-4 w-4" />
                {resending ? "Wird gesendet…" : "Einladung erneut senden"}
              </Button>
            )}
            <Button
              variant={accountActive ? "outline" : "default"}
              onClick={() => {
                setActionMessage(null)
                setConfirmingActiveChange(true)
              }}
              disabled={busy || confirmingActiveChange}
              className={accountActive ? "text-destructive hover:text-destructive" : undefined}
            >
              {accountActive ? (
                <PauseCircle className="mr-2 h-4 w-4" />
              ) : (
                <PlayCircle className="mr-2 h-4 w-4" />
              )}
              {updatingActive
                ? "Wird gespeichert…"
                : accountActive
                  ? "Deaktivieren"
                  : "Reaktivieren"}
            </Button>
          </div>
        )}
      </div>

      {/* ── Sicherheitsabfrage (De)aktivieren ── */}
      {confirmingActiveChange && (
        <div
          role="alertdialog"
          aria-labelledby="active-change-title"
          className={cn(
            "rounded-xl border p-4",
            accountActive ? "border-destructive/30 bg-destructive/5" : "border-primary/20 bg-primary/5",
          )}
        >
          <p id="active-change-title" className="text-sm font-semibold text-foreground">
            {accountActive ? "Mitarbeiter deaktivieren?" : "Mitarbeiter reaktivieren?"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {accountActive
              ? `${profile.full_name} wird deaktiviert, verliert den Zugang zur App und kann keinen neuen Aufträgen mehr zugewiesen werden. Bestehende Aufträge, Zuweisungen und Verlauf bleiben unverändert erhalten.`
              : `${profile.full_name} wird wieder aktiv und kann erneut Aufträgen zugewiesen werden.`}
          </p>
          <div className="mt-3 flex gap-2">
            <Button
              size="sm"
              variant={accountActive ? "destructive" : "default"}
              onClick={applyActiveChange}
              disabled={updatingActive}
            >
              {accountActive ? "Deaktivieren" : "Reaktivieren"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setConfirmingActiveChange(false)}
              disabled={updatingActive}
            >
              Abbrechen
            </Button>
          </div>
        </div>
      )}

      {actionMessage && (
        <div
          role={actionMessage.tone === "error" ? "alert" : "status"}
          className={
            actionMessage.tone === "error"
              ? "rounded-md bg-destructive/10 p-3 text-sm font-medium text-destructive"
              : "rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-800"
          }
        >
          {actionMessage.text}
        </div>
      )}

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
