"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { formatDateISO } from "@/lib/date"
import { toFriendlyAuthErrorMessage } from "@/lib/auth/authErrorMessages"
import {
  getScheduleKpis,
  type JobWithAssignments,
  type ScheduleKpis,
} from "@/lib/jobs/jobs.service"

const KPI_RELOAD_DEBOUNCE_MS = 300

// Serverseitige KPI-Zähler wie Mobiles AdminDashboardScreen: kein eigener
// Realtime-Kanal — die bereits realtime-aktualisierte Jobliste dient nur als
// Signal, bei Status-/Datums-/Abschlussänderungen die Zähler neu zu laden.
export function useScheduleKpis(jobs: JobWithAssignments[]) {
  const [supabase] = useState(() => createClient())
  const [kpis, setKpis] = useState<ScheduleKpis | null>(null)
  const [error, setError] = useState<string | null>(null)
  const loadingRef = useRef(false)

  const load = useCallback(async () => {
    const todayKey = formatDateISO(new Date())
    if (!todayKey || loadingRef.current) return
    loadingRef.current = true
    try {
      setKpis(await getScheduleKpis(supabase, todayKey))
      setError(null)
    } catch (err) {
      // Wie Mobile: zuvor geladene Werte behalten, Fehler nur einordnen.
      setError(toFriendlyAuthErrorMessage(err, "Die Kennzahlen konnten nicht geladen werden."))
    } finally {
      loadingRef.current = false
    }
  }, [supabase])

  const signature = useMemo(
    () =>
      jobs
        .map((j) => `${j.id}:${j.status}:${j.date ?? ""}:${j.completed_at ?? ""}`)
        .sort()
        .join("|"),
    [jobs],
  )

  useEffect(() => {
    void load()
  }, [load])

  // Erster Übergang "" → geladene Jobliste ist kein Datenwechsel (die Zähler
  // laufen bereits über den Mount-Effect); danach entprellt nachladen.
  const prevSignatureRef = useRef(signature)
  useEffect(() => {
    const prev = prevSignatureRef.current
    prevSignatureRef.current = signature
    if (prev === signature || prev === "") return
    const timeout = setTimeout(() => {
      void load()
    }, KPI_RELOAD_DEBOUNCE_MS)
    return () => clearTimeout(timeout)
  }, [signature, load])

  return { kpis, error, reload: load }
}
