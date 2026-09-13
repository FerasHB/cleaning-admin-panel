"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { formatDateISO } from "@/lib/date"
import { getCurrentCompanyAbsences, getPendingVacationCount, type Absence } from "@/lib/absences/absences"

// Web-Pendant zu Mobiles loadAbsenceSignals: zwei leichte Signale für den
// Dashboard-Chip (offene Urlaubsanträge, heute aktive Abwesenheiten) — eine
// Abfrage für die ganze Firma, kein Loop pro Mitarbeiter. Fehler hier
// scheitern still (wie Mobile): die KPI-Sektion hat bereits ein Banner für
// den wichtigeren Fall, zwei Nebeninfos rechtfertigen kein eigenes.
export function useAbsenceSignals() {
  const [supabase] = useState(() => createClient())
  const [pendingVacationCount, setPendingVacationCount] = useState<number | null>(null)
  const [currentAbsences, setCurrentAbsences] = useState<Absence[]>([])

  useEffect(() => {
    let mounted = true
    const load = async () => {
      const todayKey = formatDateISO(new Date()) ?? ""
      if (!todayKey) return
      try {
        const [count, active] = await Promise.all([
          getPendingVacationCount(supabase),
          getCurrentCompanyAbsences(supabase, todayKey),
        ])
        if (!mounted) return
        setPendingVacationCount(count)
        setCurrentAbsences(active)
      } catch {
        // still — vorherige Werte bleiben stehen.
      }
    }
    load()
    return () => {
      mounted = false
    }
  }, [supabase])

  return { pendingVacationCount, currentAbsences }
}
