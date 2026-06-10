"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { useAdminJobs } from "@/hooks/use-admin-jobs"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { StatCard } from "@/components/dashboard/StatCard"
import { SectionCard } from "@/components/dashboard/SectionCard"
import { ActivityList } from "@/components/dashboard/ActivityList"
import { getRecentActivity, type ActivityItem } from "@/lib/activity/activity"
import {
  Activity,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock,
  Inbox,
  Loader,
  MapPin,
  Plus,
  Users,
} from "lucide-react"
import {
  getJobDisplayTime,
  getRecurringDaysLabel,
  isJobToday,
} from "@/lib/jobs/jobSchedule"
import { cn } from "@/lib/utils"
import { Database } from "@/lib/supabase/database.types"

type Job = Database["public"]["Tables"]["jobs"]["Row"]

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

function formatDate(iso: string | null) {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

function initials(name: string | null) {
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

export default function DashboardPage() {
  const { jobs, loading: jobsLoading, counts } = useAdminJobs()
  const recentJobs = jobs.slice(0, 4)

  // "Heute" recurring-fähig (single per Datum/scheduled_start, recurring per
  // Wochentag, nur aktive); Sortierung nach Anzeige-Uhrzeit.
  const todaysJobs = jobs
    .filter((j) => isJobToday(j))
    .sort((a, b) =>
      (getJobDisplayTime(a) ?? "").localeCompare(getJobDisplayTime(b) ?? ""),
    )

  const [supabase] = useState(() => createClient())
  const [totalEmployees, setTotalEmployees] = useState<number>(0)

  useEffect(() => {
    supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("role", "employee")
      .then(({ count }) => setTotalEmployees(count ?? 0))
  }, [supabase])

  // Aktivitäts-Feed (echte Events: Kommentare, gestartet, abgeschlossen,
  // erstellt) — firmenweit, RLS-scoped.
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [activityLoading, setActivityLoading] = useState(true)
  const [activityError, setActivityError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    const load = async () => {
      try {
        const data = await getRecentActivity(supabase, 3)
        if (mounted) setActivity(data)
      } catch (err) {
        if (mounted)
          setActivityError(
            err instanceof Error
              ? err.message
              : "Aktivität konnte nicht geladen werden.",
          )
      } finally {
        if (mounted) setActivityLoading(false)
      }
    }
    load()
    return () => {
      mounted = false
    }
  }, [supabase])

  const total = counts.open + counts.inProgress + counts.completed
  const pct = (v: number) => (total > 0 ? Math.round((v / total) * 100) : 0)
  const todayCompleted = todaysJobs.filter(
    (j) => j.status === "completed",
  ).length

  // "Gerade aktiv": Mitarbeiter mit mindestens einem laufenden Job — abgeleitet
  // aus den bereits geladenen Jobs (keine zusätzliche Query, keine Fake-Daten).
  const activeNow = new Set(
    jobs
      .filter((j) => j.status === "in_progress" && j.assigned_to)
      .map((j) => j.assigned_to),
  ).size

  const now = new Date()
  const dateLabel = now.toLocaleDateString("de-DE", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  })
  const timeLabel = now.toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
  })

  const segments = [
    { label: "Offen", value: counts.open, bar: "bg-amber-400" },
    { label: "In Arbeit", value: counts.inProgress, bar: "bg-blue-500" },
    { label: "Erledigt", value: counts.completed, bar: "bg-emerald-500" },
  ]

  return (
    <div className="space-y-5">
      {/* ── Hero ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Übersicht
            </h1>
            <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Live
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Aufträge und Team – immer aktuell.
          </p>
        </div>

        <div className="flex flex-col items-start gap-2 sm:items-end">
          <Link href="/jobs/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Auftrag erstellen
            </Button>
          </Link>
          <p className="text-xs capitalize text-muted-foreground">
            {dateLabel} · Stand {timeLabel} Uhr
          </p>
        </div>
      </div>

      {/* ── KPI-Reihe ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Inbox}
          label="Offen"
          value={jobsLoading ? "—" : counts.open}
          hint={jobsLoading ? undefined : `${pct(counts.open)} % aller Aufträge`}
          tone="amber"
        />
        <StatCard
          icon={Loader}
          label="In Arbeit"
          value={jobsLoading ? "—" : counts.inProgress}
          hint={
            jobsLoading ? undefined : `${pct(counts.inProgress)} % aller Aufträge`
          }
          tone="blue"
        />
        <StatCard
          icon={CheckCircle2}
          label="Erledigt"
          value={jobsLoading ? "—" : counts.completed}
          hint={jobsLoading ? undefined : `${pct(counts.completed)} % abgeschlossen`}
          tone="emerald"
        />
        <StatCard
          icon={CalendarDays}
          label="Heute"
          value={jobsLoading ? "—" : counts.today}
          hint={
            jobsLoading
              ? undefined
              : counts.today > 0
                ? `${todayCompleted} bereits erledigt`
                : "nichts geplant"
          }
          tone="primary"
        />
      </div>

      {/* ── Hauptbereich: zwei gleichwertige Spalten ── */}
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
        {/* Linke Spalte: Aktuelle Aufträge + Aktivität */}
        <div className="space-y-5">
        {/* Aktuelle Aufträge */}
        <SectionCard
          icon={Inbox}
          title="Aktuelle Aufträge"
          subtitle="Die neuesten Aufträge"
          action={
            <Link href="/jobs">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground"
              >
                Alle anzeigen
                <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </Link>
          }
          noBodyPadding
        >
          {jobsLoading ? (
            <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
              Laden…
            </div>
          ) : recentJobs.length > 0 ? (
            <ul className="divide-y divide-gray-100">
              {recentJobs.map((job: Job) => (
                <li key={job.id}>
                  <Link
                    href={`/jobs/${job.id}`}
                    className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-gray-50/70"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                      {initials(job.customer_name)}
                    </div>
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
                            <span className="max-w-[160px] truncate">
                              {job.location_address}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <span className="hidden text-xs text-muted-foreground sm:block">
                      {job.job_type === "recurring"
                        ? getRecurringDaysLabel(job)
                        : formatDate(job.scheduled_start)}
                    </span>
                    <Badge variant={STATUS_VARIANT[job.status] ?? "outline"}>
                      {STATUS_LABEL[job.status] ?? job.status}
                    </Badge>
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground/50" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary">
                <Inbox className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">Noch keine Aufträge</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Erstellen Sie Ihren ersten Auftrag, um zu beginnen.
                </p>
              </div>
              <Link href="/jobs/new">
                <Button size="sm">Ersten Auftrag erstellen</Button>
              </Link>
            </div>
          )}
        </SectionCard>

        {/* Aktivität (echte Events) */}
        <SectionCard
          icon={Activity}
          title="Aktivität"
          subtitle="Letzte Ereignisse im Team"
          noBodyPadding
        >
          <ActivityList
            items={activity}
            loading={activityLoading}
            error={activityError}
          />
        </SectionCard>
        </div>

        {/* Rechte Spalte: Status + Tagesplan + Team (kompakt) */}
        <div className="space-y-5">
          {/* Auftragsstatus */}
          <SectionCard title="Auftragsstatus">
            {total > 0 ? (
              <>
                <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
                  {segments.map(
                    (s) =>
                      s.value > 0 && (
                        <div
                          key={s.label}
                          className={s.bar}
                          style={{ width: `${(s.value / total) * 100}%` }}
                        />
                      ),
                  )}
                </div>
                <ul className="mt-4 space-y-2.5">
                  {segments.map((s) => (
                    <li
                      key={s.label}
                      className="flex items-center justify-between gap-2 text-sm"
                    >
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <span className={cn("h-2 w-2 rounded-full", s.bar)} />
                        {s.label}
                      </span>
                      <span className="flex items-baseline gap-1.5">
                        <span className="font-semibold tabular-nums text-foreground">
                          {s.value}
                        </span>
                        <span className="w-9 text-right text-xs tabular-nums text-muted-foreground">
                          {pct(s.value)} %
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-4 border-t border-gray-100 pt-3 text-xs text-muted-foreground">
                  {total} Aufträge gesamt
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Noch keine Aufträge.</p>
            )}
          </SectionCard>

          {/* Tagesplan (kompakt) */}
          <SectionCard
            icon={Clock}
            title="Tagesplan"
            subtitle={
              jobsLoading
                ? "Laden…"
                : todaysJobs.length > 0
                  ? `${todaysJobs.length} heute geplant`
                  : "Heute frei"
            }
            noBodyPadding
          >
            {jobsLoading ? (
              <div className="flex h-16 items-center justify-center text-sm text-muted-foreground">
                Laden…
              </div>
            ) : todaysJobs.length > 0 ? (
              <ul className="max-h-[300px] divide-y divide-gray-100 overflow-y-auto">
                {todaysJobs.map((job: Job) => (
                  <li key={job.id}>
                    <Link
                      href={`/jobs/${job.id}`}
                      className="flex items-center gap-2.5 px-4 py-2.5 transition-colors hover:bg-gray-50/70"
                    >
                      <span className="w-11 shrink-0 text-xs font-semibold tabular-nums text-foreground">
                        {getJobDisplayTime(job) ?? "—"}
                      </span>
                      <span
                        className={cn(
                          "h-2 w-2 shrink-0 rounded-full",
                          STATUS_DOT[job.status] ?? "bg-muted-foreground",
                        )}
                      />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                        {job.customer_name}
                      </span>
                      <Badge variant={STATUS_VARIANT[job.status] ?? "outline"}>
                        {STATUS_LABEL[job.status] ?? job.status}
                      </Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex items-center gap-2 px-4 py-6 text-sm text-muted-foreground">
                <CalendarDays className="h-4 w-4" />
                Heute keine Aufträge geplant.
              </div>
            )}
          </SectionCard>

          {/* Team */}
          <SectionCard icon={Users} title="Team">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-3xl font-semibold tracking-tight text-foreground">
                  {totalEmployees}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Mitarbeiter im Team
                </p>
              </div>
              <span className="flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                <Activity className="h-3.5 w-3.5" />
                {activeNow} gerade aktiv
              </span>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  )
}
