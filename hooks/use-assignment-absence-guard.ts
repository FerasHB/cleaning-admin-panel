"use client"

import { useCallback, useRef, useState } from "react"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/database.types"
import {
  checkAssignmentAbsenceConflicts,
  formatAssignmentAbsenceWarning,
  type AssignmentAbsenceCheckInput,
  type AssignmentAbsenceConflict,
  type AssignmentAbsenceWarningText,
} from "@/lib/jobs/assignmentAbsenceWarning"

export type PendingAbsenceWarning = AssignmentAbsenceWarningText & {
  proceed: () => Promise<void>
}

// Web-Pendant zu Mobiles useAssignmentAbsenceGuard: prüft vor dem Speichern
// (single/recurring, anlegen/bearbeiten) einmal Zuweisung × Abwesenheit.
//   keine Konflikte        → performSave()        → "saved"
//   Konflikte              → Warnung vormerken    → "warned"
//     bestätigt            → performSave()
//     abgebrochen          → nichts
// Statt Mobiles modalem Dialog hält Web die Warnung als State, das Formular
// zeigt sie inline an. Prüf-Fehler blockieren nie (Warnung, keine Sperre).
export function useAssignmentAbsenceGuard(supabase: SupabaseClient<Database>) {
  const [warning, setWarning] = useState<PendingAbsenceWarning | null>(null)
  const checkingRef = useRef(false)

  const guardSave = useCallback(
    async (
      input: AssignmentAbsenceCheckInput,
      performSave: () => Promise<void>,
    ): Promise<"saved" | "warned" | "busy"> => {
      if (checkingRef.current) return "busy"
      checkingRef.current = true
      let conflicts: AssignmentAbsenceConflict[]
      try {
        conflicts = await checkAssignmentAbsenceConflicts(supabase, input)
      } catch (err) {
        console.error("[absence-guard] Prüfung fehlgeschlagen, speichere ohne Warnung:", err)
        conflicts = []
      } finally {
        checkingRef.current = false
      }

      if (conflicts.length === 0) {
        await performSave()
        return "saved"
      }

      setWarning({ ...formatAssignmentAbsenceWarning(conflicts, input.jobType), proceed: performSave })
      return "warned"
    },
    [supabase],
  )

  const confirmWarning = useCallback(async () => {
    const pending = warning
    setWarning(null)
    if (pending) await pending.proceed()
  }, [warning])

  const dismissWarning = useCallback(() => setWarning(null), [])

  return { guardSave, warning, confirmWarning, dismissWarning }
}
