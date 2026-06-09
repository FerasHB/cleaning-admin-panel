"use client"

// hooks/use-job-comments.ts
// Lokaler State für Job-Kommentare (online-only, keine Offline-Queue) — portiert
// aus Mobiles useJobComments. Lädt beim Mount und nach jedem erfolgreichen Submit.

import { useCallback, useEffect, useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import {
  addJobComment,
  getJobComments,
  type JobComment,
} from "@/lib/comments/comments"

export function useJobComments(jobId: string) {
  const supabase = useRef(createClient()).current
  const [comments, setComments] = useState<JobComment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setError(null)
      const data = await getJobComments(supabase, jobId)
      setComments(data)
    } catch (err) {
      console.error("Failed to load comments:", err)
      setError(
        err instanceof Error
          ? err.message
          : "Kommentare konnten nicht geladen werden.",
      )
    } finally {
      setLoading(false)
    }
  }, [jobId, supabase])

  useEffect(() => {
    setLoading(true)
    load()
  }, [load])

  // Legt einen Kommentar an und lädt danach neu. Wirft bei Fehler weiter,
  // damit die UI ihn am Eingabefeld anzeigen kann.
  const submit = useCallback(
    async (message: string) => {
      await addJobComment(supabase, { jobId, message })
      await load()
    },
    [jobId, load, supabase],
  )

  return { comments, loading, error, submit }
}
