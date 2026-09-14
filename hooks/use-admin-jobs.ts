"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { isJobToday } from "@/lib/jobs/jobSchedule"
import {
  getJobs,
  isExecutableJob,
  type JobWithAssignments,
} from "@/lib/jobs/jobs.service"
import { getUnreadCommentJobIds } from "@/lib/comments/unread"

export type AdminJobCounts = {
  open: number
  inProgress: number
  completed: number
  today: number
}

export type UseAdminJobsResult = {
  jobs: JobWithAssignments[]
  loading: boolean
  error: string | null
  counts: AdminJobCounts
  // Ungelesene Kommentare — aktualisiert über jobs-Realtime-Events (gleicher
  // Kanal/Debounce wie die Liste) UND ein eigenes leichtgewichtiges
  // Poll-Intervall, da ein reiner Kommentar-Schreibvorgang kein jobs-Event
  // auslöst (job_comments ist nicht realtime-publiziert).
  unreadJobIds: Set<string>
}

// Zähler nur über AUSFÜHRBARE Arbeit (Einzelaufträge + generierte Termine).
// Dauerauftrags-Regeln sind Vorlagen ohne eigenen Arbeitsstatus — ihre Termine
// sind bereits als eigene Zeilen enthalten und würden sonst doppelt zählen.
function deriveCounts(jobs: JobWithAssignments[]): AdminJobCounts {
  const executable = jobs.filter(isExecutableJob)
  return {
    open: executable.filter((j) => j.status === "open").length,
    inProgress: executable.filter((j) => j.status === "in_progress").length,
    completed: executable.filter((j) => j.status === "completed").length,
    today: executable.filter((j) => isJobToday(j)).length,
  }
}

// Wartezeit, um mehrere Realtime-Events (z. B. Regel + Termine + Zuweisungen
// eines Speichervorgangs) zu EINEM Nachladen zusammenzufassen.
const REALTIME_REFETCH_DEBOUNCE_MS = 400

// job_comments ist NICHT Teil der supabase_realtime-Publication (siehe
// hooks/use-job-detail-realtime.ts) — ein reiner Kommentar-Schreibvorgang
// löst daher KEIN jobs-Event aus und die Ungelesen-Menge oben würde sonst
// erst beim nächsten jobs-Event oder vollständigen Neuladen der Seite
// auffrischen. Gleiches leichtgewichtiges Poll-Intervall wie in der
// Detailansicht, NUR für get_unread_comment_job_ids — keine neue
// Backend-Anfrage, kein Ersatz für die RLS-/RPC-Quelle der Wahrheit.
const UNREAD_POLL_INTERVAL_MS = 20_000

export function useAdminJobs(): UseAdminJobsResult {
  const [supabase] = useState(() => createClient())
  const [jobs, setJobs] = useState<JobWithAssignments[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [unreadJobIds, setUnreadJobIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    let mounted = true
    let debounce: ReturnType<typeof setTimeout> | null = null

    // Ungelesene Kommentare separat laden (best-effort, wie Mobile) — ein
    // Fehler hier darf die Jobliste nicht blockieren.
    const fetchUnread = async () => {
      try {
        const unread = await getUnreadCommentJobIds(supabase)
        if (mounted) setUnreadJobIds(unread)
      } catch {
        // still
      }
    }

    const fetchJobs = async () => {
      try {
        const data = await getJobs(supabase)
        if (!mounted) return
        setJobs(data)
        setError(null)
      } catch (err) {
        if (!mounted) return
        setError(err instanceof Error ? err.message : "Aufträge konnten nicht geladen werden.")
      } finally {
        if (mounted) setLoading(false)
      }
      await fetchUnread()
    }

    fetchJobs()

    // Wie Mobile (JobContext): jedes jobs-Event lädt die Liste neu, statt die
    // Payload-Zeile einzumischen. Die Payload trägt keine Zuweisungsmenge;
    // Zuweisungsänderungen kommen über touch_job_on_assignment_change als
    // jobs-UPDATE an und brauchen den frischen Embed.
    const channel = supabase
      .channel("admin-jobs-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "jobs" }, () => {
        if (!mounted) return
        if (debounce) clearTimeout(debounce)
        debounce = setTimeout(fetchJobs, REALTIME_REFETCH_DEBOUNCE_MS)
      })
      .subscribe()

    // Fallback nur für Ungelesen-Status: ein reiner Kommentar-Schreibvorgang
    // löst kein jobs-Event aus (s. o.), daher hier ein eigenes, von der
    // Job-Liste unabhängiges Poll-Intervall statt eines weiteren
    // Realtime-Kanals.
    const unreadInterval = setInterval(fetchUnread, UNREAD_POLL_INTERVAL_MS)

    return () => {
      mounted = false
      if (debounce) clearTimeout(debounce)
      clearInterval(unreadInterval)
      supabase.removeChannel(channel)
    }
  }, [supabase])

  return { jobs, loading, error, counts: deriveCounts(jobs), unreadJobIds }
}
