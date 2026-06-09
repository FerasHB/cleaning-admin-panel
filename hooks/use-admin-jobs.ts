"use client"

import { useEffect, useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { isJobToday } from "@/lib/jobs/jobSchedule"
import { Database } from "@/lib/supabase/database.types"

type Job = Database["public"]["Tables"]["jobs"]["Row"]

export type AdminJobCounts = {
  open: number
  inProgress: number
  completed: number
  today: number
}

export type UseAdminJobsResult = {
  jobs: Job[]
  loading: boolean
  error: string | null
  counts: AdminJobCounts
}

function deriveCounts(jobs: Job[]): AdminJobCounts {
  return {
    open: jobs.filter((j) => j.status === "open").length,
    inProgress: jobs.filter((j) => j.status === "in_progress").length,
    completed: jobs.filter((j) => j.status === "completed").length,
    // "Heute fällig" recurring-fähig: single per Datum/scheduled_start,
    // recurring per Wochentag, nur aktive — zentrale Logik aus jobSchedule.
    today: jobs.filter((j) => isJobToday(j)).length,
  }
}

export function useAdminJobs(): UseAdminJobsResult {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = useRef(createClient()).current

  useEffect(() => {
    let mounted = true

    const fetchJobs = async () => {
      const { data, error } = await supabase
        .from("jobs")
        .select("*")
        // created_at statt scheduled_start: recurring Jobs haben kein
        // scheduled_start (NULL) und würden sonst zusammenklumpen.
        .order("created_at", { ascending: false })

      if (!mounted) return
      if (error) {
        setError(error.message)
      } else {
        setJobs(data ?? [])
      }
      setLoading(false)
    }

    fetchJobs()

    const channel = supabase
      .channel("admin-jobs-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "jobs" },
        (payload) => {
          if (!mounted) return
          if (payload.eventType === "INSERT") {
            setJobs((prev) => [payload.new as Job, ...prev])
          } else if (payload.eventType === "UPDATE") {
            setJobs((prev) =>
              prev.map((j) =>
                j.id === (payload.new as Job).id ? (payload.new as Job) : j
              )
            )
          } else if (payload.eventType === "DELETE") {
            setJobs((prev) =>
              prev.filter((j) => j.id !== (payload.old as { id: string }).id)
            )
          }
        }
      )
      .subscribe()

    return () => {
      mounted = false
      supabase.removeChannel(channel)
    }
  }, [])

  return { jobs, loading, error, counts: deriveCounts(jobs) }
}
