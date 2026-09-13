"use client"

import { useEffect, useState } from "react"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/database.types"

type DB = SupabaseClient<Database>

// Wartezeit, um mehrere Realtime-Events (z. B. Regel + Zuweisungen eines
// Speichervorgangs) zu EINEM Nachladen zusammenzufassen — gleiches Muster
// wie use-admin-jobs.
const REALTIME_REFETCH_DEBOUNCE_MS = 400

// Kommentare (job_comments) sind NICHT Teil der supabase_realtime-Publication
// (geprüft: nur "jobs" und "profiles" sind es, siehe Migrationen ab
// 20260713000000/20260714000000) — Mobile hat dafür ohnehin keinen Live-Push,
// nur einen Neuabruf bei jedem Öffnen/Fokussieren der Detailseite. Web hat
// keine Navigations-Fokus-Entsprechung für eine dauerhaft offene Seite,
// deshalb hier ein leichtgewichtiges Poll-Intervall NUR für Kommentare/
// Ungelesen-Status — ausdrücklich als Ersatz erlaubt, wenn eine Tabelle
// nicht realtime-publiziert ist. Die Backend-Publication wird dabei nicht
// verändert.
const COMMENT_POLL_INTERVAL_MS = 20_000

// EIN Kanal pro Detailseite (gefiltert auf genau diesen Job), statt eines
// weiteren, ungefilterten "jobs"-Abos wie auf der Liste — vermeidet
// doppelte Abonnements. Ein monoton steigender Zähler ("tick") ist das
// einzige Signal nach außen: der Aufrufer entscheidet selbst, was er bei
// einer Änderung neu lädt (Job, Kommentare, Ungelesen-Status).
export function useJobDetailRealtime(supabase: DB, jobId: string): number {
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!jobId) return

    let debounce: ReturnType<typeof setTimeout> | null = null
    const bump = () => {
      if (debounce) clearTimeout(debounce)
      debounce = setTimeout(() => setTick((t) => t + 1), REALTIME_REFETCH_DEBOUNCE_MS)
    }

    // Deckt ab: status, started_at/completed_at, started_by/completed_by,
    // sowie Zuweisungsänderungen (touch_job_on_assignment_change-Trigger
    // aktualisiert jobs.updated_at bei jeder job_assignments-Änderung).
    const channel = supabase
      .channel(`job-detail-realtime-${jobId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "jobs", filter: `id=eq.${jobId}` },
        bump,
      )
      .subscribe()

    // Leichtgewichtiger Fallback nur für Kommentare/Ungelesen-Status (s. o.).
    const interval = setInterval(() => setTick((t) => t + 1), COMMENT_POLL_INTERVAL_MS)

    return () => {
      if (debounce) clearTimeout(debounce)
      clearInterval(interval)
      supabase.removeChannel(channel)
    }
  }, [supabase, jobId])

  return tick
}
