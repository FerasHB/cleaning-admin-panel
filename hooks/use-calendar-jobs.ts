"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { getJobsInRange, type JobWithAssignments } from "@/lib/jobs/jobs.service"

export type UseCalendarJobsResult = {
  jobs: JobWithAssignments[]
  loading: boolean
  error: string | null
}

// Wartezeit, um mehrere Realtime-Events zu EINEM Nachladen zusammenzufassen
// (wie use-admin-jobs.ts / Mobiles JobContext).
const REALTIME_REFETCH_DEBOUNCE_MS = 400

// Lädt ausführbare Aufträge (job_type='single') im sichtbaren Rasterfenster
// [fromKey, toKey] neu, sobald sich das Fenster ändert, und hält sie über
// den gleichen unfilterten "jobs"-Realtime-Kanal wie die Jobliste aktuell —
// kein eigener Occurrence-Kanal, keine eigene Business-Logik.
export function useCalendarJobs(fromKey: string, toKey: string): UseCalendarJobsResult {
  const [supabase] = useState(() => createClient())
  const [jobs, setJobs] = useState<JobWithAssignments[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    let debounce: ReturnType<typeof setTimeout> | null = null

    const fetchJobs = async () => {
      try {
        const data = await getJobsInRange(supabase, fromKey, toKey)
        if (!mounted) return
        setJobs(data)
        setError(null)
      } catch (err) {
        if (!mounted) return
        setError(err instanceof Error ? err.message : "Kalender konnte nicht geladen werden.")
      } finally {
        if (mounted) setLoading(false)
      }
    }

    setLoading(true)
    fetchJobs()

    const channel = supabase
      .channel("calendar-jobs-realtime")
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
  }, [supabase, fromKey, toKey])

  return { jobs, loading, error }
}
