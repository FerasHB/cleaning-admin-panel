"use client"

import { Suspense, useEffect, useState } from "react"
import Link from "next/link"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { EmptyState } from "@/components/ui/empty-state"
import { SectionCard } from "@/components/dashboard/SectionCard"
import {
  ArrowLeft,
  Briefcase,
  Calendar,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  History,
  MapPin,
  MessageSquare,
  PauseCircle,
  Pencil,
  Repeat,
  Timer,
  User,
} from "lucide-react"
import { JobDetailRow } from "@/components/jobs/JobDetailRow"
import { JobTimeline } from "@/components/jobs/JobTimeline"
import { JobComments } from "@/components/jobs/JobComments"
import { useJobDetailRealtime } from "@/hooks/use-job-detail-realtime"
import { useUnreadCommentIds } from "@/hooks/use-unread-comment-ids"
import { getJobDisplayTime, getRecurringDaysLabel } from "@/lib/jobs/jobSchedule"
import { formatDateISO, formatDateTimeDE } from "@/lib/date"
import {
  DELETED_SUFFIX,
  getJobById,
  getJobOccurrences,
  isOccurrence,
  isRecurringRule,
  mapAssignees,
  UNASSIGNED_LABEL,
  type JobWithAssignments,
} from "@/lib/jobs/jobs.service"
import { cn } from "@/lib/utils"

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

function formatDateDE(dateKey: string | null) {
  if (!dateKey) return null
  return new Date(`${dateKey.slice(0, 10)}T00:00`).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={STATUS_VARIANT[status] ?? "outline"} className="gap-1.5">
      <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_DOT[status] ?? "bg-muted-foreground")} />
      {STATUS_LABEL[status] ?? status}
    </Badge>
  )
}

// Zugewiesene Mitarbeiter mit individuellem Arbeitsstand (aus job_assignments,
// nicht aus der geteilten Job-Uhr abgeleitet).
function AssigneeList({ job }: { job: JobWithAssignments }) {
  const assignees = mapAssignees(job.assignments)
  if (assignees.length === 0) {
    return <span className="text-muted-foreground">{UNASSIGNED_LABEL}</span>
  }
  return (
    <span className="flex flex-col gap-1">
      {assignees.map((a) => (
        <span key={a.assignmentId} className="flex flex-wrap items-center gap-x-2">
          <span>
            {a.fullName}
            {a.isDeleted ? DELETED_SUFFIX : ""}
          </span>
          {a.employeeCompletedAt ? (
            <span className="text-xs font-normal text-emerald-700">
              erledigt {formatDateTimeDE(a.employeeCompletedAt)}
            </span>
          ) : a.employeeStartedAt ? (
            <span className="text-xs font-normal text-blue-700">
              gestartet {formatDateTimeDE(a.employeeStartedAt)}
            </span>
          ) : null}
        </span>
      ))}
    </span>
  )
}

function JobDetailContent() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const jobId = params.id as string
  const [supabase] = useState(() => createClient())

  const [job, setJob] = useState<JobWithAssignments | null>(null)
  const [occurrences, setOccurrences] = useState<JobWithAssignments[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  // EIN Kanal für diese Seite (job-status/-zeiten/-zuweisungen kommen über
  // "jobs" realtime; Kommentare/Ungelesen-Status über das darin enthaltene
  // Poll-Intervall — siehe hooks/use-job-detail-realtime.ts).
  const realtimeTick = useJobDetailRealtime(supabase, jobId)
  const { unreadJobIds, refresh: refreshUnread, markAsRead } = useUnreadCommentIds(supabase)

  useEffect(() => {
    let mounted = true
    const fetchJob = async () => {
      try {
        const data = await getJobById(supabase, jobId)
        if (!mounted) return
        setJob(data)
        // Regel: generierte Termine mitladen (read-only Übersicht).
        if (data && isRecurringRule(data)) {
          const occ = await getJobOccurrences(supabase, data.id)
          if (mounted) setOccurrences(occ)
        }
      } catch (err) {
        console.error("Failed to fetch job:", err)
        if (mounted) setLoadError("Auftrag konnte nicht geladen werden.")
      } finally {
        if (mounted) setLoading(false)
      }
    }

    if (jobId) fetchJob()
    return () => {
      mounted = false
    }
    // realtimeTick bewusst in den Deps: jede Änderung löst denselben
    // Neuabruf aus wie der initiale Mount (kein separater Reducer nötig).
  }, [jobId, supabase, realtimeTick])

  // Ungelesen-Status bei jedem Realtime-/Poll-Tick neu laden (deckt auch
  // Kommentare anderer Nutzer ab, die keine jobs-Zeile berühren).
  useEffect(() => {
    void refreshUnread()
  }, [realtimeTick, refreshUnread])

  // Wie Mobiles JobDetailScreen: beim Öffnen als gelesen markieren (Web ist
  // admin-only, daher immer erlaubt — kein isAssignedTo/isPrimaryAssignee-
  // Zweig nötig). Läuft erst NACH dem ersten Laden, damit der Punkt kurz
  // sichtbar ist, bevor er verschwindet.
  useEffect(() => {
    if (job && jobId) void markAsRead(jobId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId, !!job])

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground">Auftrag wird geladen…</div>
  }

  if (loadError || !job) {
    return (
      <EmptyState
        icon={Briefcase}
        title={loadError ? "Auftrag konnte nicht geladen werden" : "Auftrag nicht gefunden"}
        description={loadError ?? "Dieser Auftrag ist nicht (mehr) verfügbar."}
        action={
          <Link href="/jobs">
            <Button>Zur Auftragsliste</Button>
          </Link>
        }
      />
    )
  }

  const isRule = isRecurringRule(job)
  const isOcc = isOccurrence(job)
  const displayTime = getJobDisplayTime(job)
  const terminText = isRule
    ? `${getRecurringDaysLabel(job)}${displayTime ? ` · ${displayTime} Uhr` : ""}`
    : job.date
      ? `${formatDateDE(job.date)}${displayTime ? `, ${displayTime} Uhr` : ""}`
      : formatDateTimeDE(job.scheduled_start) ?? "Kein Termin geplant"

  const todayKey = formatDateISO(new Date()) ?? ""
  const upcomingOccurrences = occurrences.filter((o) => (o.date ?? "").slice(0, 10) >= todayKey)
  const occurrencesFailed = searchParams.get("notice") === "occurrences-failed"

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

      {occurrencesFailed && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-800">
          Der Job wurde angelegt, aber die Termine konnten nicht vollständig erzeugt werden.
          Bitte prüfe die Terminierung.
        </div>
      )}

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
              {/* Regeln haben keinen eigenen Arbeitsstatus — nur Termine/Einzelaufträge. */}
              {isRule ? (
                <Badge variant="secondary" className="gap-1">
                  <Repeat className="h-3 w-3" />
                  Dauerauftrag
                </Badge>
              ) : (
                <StatusBadge status={job.status} />
              )}
            </div>
            {/* Meta-Zeile: Leistung · Termin · Ort */}
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Briefcase className="h-3.5 w-3.5 shrink-0" />
                {job.service_name}
              </span>
              <span className="flex items-center gap-1.5">
                {isRule ? (
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
            {isOcc && job.parent_job_id && (
              <Link
                href={`/jobs/${job.parent_job_id}`}
                className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                <Repeat className="h-3 w-3" />
                Termin aus Dauerauftrag — Regel öffnen
              </Link>
            )}
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
            <JobDetailRow icon={User} label="Mitarbeiter" value={<AssigneeList job={job} />} />
            <JobDetailRow
              icon={isRule ? Repeat : Calendar}
              label="Auftragstyp"
              value={isRule ? "Dauerauftrag (Regel)" : isOcc ? "Termin eines Dauerauftrags" : "Einmalig"}
            />
            <JobDetailRow
              icon={Clock}
              label={isRule ? "Wochentage & Uhrzeit" : "Termin"}
              value={terminText}
            />
            {job.planned_duration_minutes != null && (
              <JobDetailRow
                icon={Timer}
                label="Geplante Dauer"
                value={`${job.planned_duration_minutes} Minuten`}
              />
            )}
            {isRule && (
              <>
                <JobDetailRow
                  icon={job.is_active ? CheckCircle2 : PauseCircle}
                  label="Status der Regel"
                  value={job.is_active ? "Aktiv" : "Inaktiv"}
                />
                <JobDetailRow
                  icon={Calendar}
                  label="Gültigkeit"
                  value={
                    job.recurrence_start_date
                      ? `ab ${formatDateDE(job.recurrence_start_date)}${
                          job.recurrence_end_date ? ` bis ${formatDateDE(job.recurrence_end_date)}` : ""
                        }`
                      : "—"
                  }
                />
              </>
            )}
          </div>
        </SectionCard>

        {/* Timeline (nur für ausführbare Aufträge sinnvoll) */}
        <SectionCard icon={History} title="Verlauf">
          {isRule ? (
            <p className="text-sm text-muted-foreground">
              Daueraufträge werden über ihre einzelnen Termine gestartet und abgeschlossen.
            </p>
          ) : (
            <JobTimeline
              createdAt={job.created_at}
              startedAt={job.started_at}
              completedAt={job.completed_at}
            />
          )}
        </SectionCard>
      </div>

      {/* ── Termine einer Regel ── */}
      {isRule && (
        <SectionCard
          icon={CalendarClock}
          title="Anstehende Termine"
          subtitle={`${upcomingOccurrences.length} ab heute`}
          noBodyPadding
        >
          {upcomingOccurrences.length === 0 ? (
            <p className="px-5 py-6 text-sm text-muted-foreground">
              Keine anstehenden Termine vorhanden.
            </p>
          ) : (
            <ul className="max-h-[360px] divide-y divide-gray-100 overflow-y-auto">
              {upcomingOccurrences.map((occ) => (
                <li key={occ.id}>
                  <Link
                    href={`/jobs/${occ.id}`}
                    className="group flex items-center gap-3 px-5 py-2.5 transition-colors hover:bg-gray-50/70"
                  >
                    <span className="w-24 shrink-0 text-sm tabular-nums text-foreground">
                      {formatDateDE(occ.date)}
                    </span>
                    <span className="w-14 shrink-0 text-xs tabular-nums text-muted-foreground">
                      {getJobDisplayTime(occ) ?? "—"}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                      {mapAssignees(occ.assignments).map((a) => a.fullName).join(", ") || UNASSIGNED_LABEL}
                    </span>
                    {occ.is_active === false && occ.status === "open" ? (
                      <Badge variant="secondary">Pausiert</Badge>
                    ) : (
                      <StatusBadge status={occ.status} />
                    )}
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/40 group-hover:text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      )}

      {/* ── Notizen ── */}
      {job.notes && (
        <SectionCard icon={FileText} title="Notizen">
          <p className="whitespace-pre-wrap break-words text-sm text-foreground">
            {job.notes}
          </p>
        </SectionCard>
      )}

      {/* ── Kommentare ── */}
      <SectionCard
        icon={MessageSquare}
        title="Kommentare"
        action={
          unreadJobIds.has(jobId) ? (
            <span
              aria-label="Ungelesene Kommentare"
              className="h-2.5 w-2.5 shrink-0 rounded-full bg-destructive"
            />
          ) : undefined
        }
      >
        <JobComments jobId={jobId} refreshToken={realtimeTick} />
      </SectionCard>
    </div>
  )
}

export default function JobDetailPage() {
  return (
    <Suspense>
      <JobDetailContent />
    </Suspense>
  )
}
