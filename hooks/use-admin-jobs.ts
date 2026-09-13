"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { isJobToday } from "@/lib/jobs/jobSchedule"
import {
  getJobs,
  isExecutableJob,
  type JobWithAssignments,
} from "@/lib/jobs/jobs.service"

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

export function useAdminJobs(): UseAdminJobsResult {
  const [supabase] = useState(() => createClient())
  const [jobs, setJobs] = useState<JobWithAssignments[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    let debounce: ReturnType<typeof setTimeout> | null = null

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

    return () => {
      mounted = false
      if (debounce) clearTimeout(debounce)
      supabase.removeChannel(channel)
    }
  }, [supabase])

  return { jobs, loading, error, counts: deriveCounts(jobs) }
}
