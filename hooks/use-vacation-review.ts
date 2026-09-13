"use client"

import { useCallback, useState } from "react"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/database.types"
import { reviewVacation, toAbsenceMessage, type Absence } from "@/lib/absences/absences"
import { isVacationAccountingEnabled } from "@/lib/vacation/vacationLedger"

type DB = SupabaseClient<Database>

type PendingAction =
  | { kind: "confirm-simple" }
  | { kind: "deduction" }
  | { kind: "reject" }

// Web-Pendant zu Mobiles useVacationReview + AdminAbsenceRow.handleApprove:
// vor jedem Genehmigen wird geprüft, ob für den Mitarbeiter ein Urlaubskonto
// geführt wird. Schlägt die Prüfung fehl (Netzwerk etc.), wird "aktiv"
// angenommen (fail-closed) — die RPC lehnt sonst ohnehin ab, das vermeidet
// nur einen falschen Erfolgs-Anschein.
export function useVacationReview(supabase: DB, onReviewed: (updated: Absence) => void) {
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const startApprove = useCallback(
    async (employeeId: string | null, absenceId: string) => {
      setError(null)
      setPendingId(absenceId)
      if (!employeeId) {
        setPendingAction({ kind: "confirm-simple" })
        return
      }
      try {
        const enabled = await isVacationAccountingEnabled(supabase, employeeId)
        setPendingAction(enabled ? { kind: "deduction" } : { kind: "confirm-simple" })
      } catch {
        setPendingAction({ kind: "deduction" })
      }
    },
    [supabase],
  )

  const startReject = useCallback((absenceId: string) => {
    setError(null)
    setPendingId(absenceId)
    setPendingAction({ kind: "reject" })
  }, [])

  const cancel = useCallback(() => {
    setPendingId(null)
    setPendingAction(null)
  }, [])

  const confirmApprove = useCallback(
    async (deductions?: Record<string, number>) => {
      if (!pendingId || busy) return
      setBusy(true)
      try {
        const updated = await reviewVacation(supabase, pendingId, "approved", undefined, deductions)
        onReviewed(updated)
        setPendingId(null)
        setPendingAction(null)
      } catch (err) {
        setError(toAbsenceMessage(err, "Urlaubsantrag konnte nicht genehmigt werden."))
      } finally {
        setBusy(false)
      }
    },
    [pendingId, busy, supabase, onReviewed],
  )

  const confirmReject = useCallback(
    async (adminNote: string) => {
      if (!pendingId || busy) return
      setBusy(true)
      try {
        const updated = await reviewVacation(supabase, pendingId, "rejected", adminNote)
        onReviewed(updated)
        setPendingId(null)
        setPendingAction(null)
      } catch (err) {
        setError(toAbsenceMessage(err, "Urlaubsantrag konnte nicht abgelehnt werden."))
      } finally {
        setBusy(false)
      }
    },
    [pendingId, busy, supabase, onReviewed],
  )

  return { pendingId, pendingAction, busy, error, startApprove, startReject, confirmApprove, confirmReject, cancel }
}
