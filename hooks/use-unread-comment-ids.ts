"use client"

import { useCallback, useState } from "react"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/database.types"
import { getUnreadCommentJobIds, markJobCommentsAsRead } from "@/lib/comments/unread"

type DB = SupabaseClient<Database>

// Geteilter Zustand für "hat ungelesene Kommentare" — von der Detailseite
// genutzt (die Jobliste bezieht ihn direkt über use-admin-jobs, das denselben
// Kanal für Jobs UND Ungelesen-Status wiederverwendet). Besitzt selbst KEINEN
// Realtime-Kanal: der Aufrufer ruft refresh() aus seinem eigenen
// jobs-Kanal/Tick auf (siehe use-job-detail-realtime), damit pro Seite nur
// EIN Abonnement auf "jobs" existiert — inklusive des initialen Ladens, das
// der Aufrufer-Effect (der ohnehin beim Mount feuert) mit übernimmt.
export function useUnreadCommentIds(supabase: DB) {
  const [unreadJobIds, setUnreadJobIds] = useState<Set<string>>(new Set())

  const refresh = useCallback(async () => {
    try {
      setUnreadJobIds(await getUnreadCommentJobIds(supabase))
    } catch {
      // still — wie Mobiles JobContext (best-effort, blockiert nichts).
    }
  }, [supabase])

  // Optimistisches Entfernen wie Mobiles markJobCommentsAsRead-Callback,
  // dann der eigentliche Upsert.
  const markAsRead = useCallback(
    async (jobId: string) => {
      setUnreadJobIds((prev) => {
        if (!prev.has(jobId)) return prev
        const next = new Set(prev)
        next.delete(jobId)
        return next
      })
      await markJobCommentsAsRead(supabase, jobId)
    },
    [supabase],
  )

  return { unreadJobIds, refresh, markAsRead }
}
