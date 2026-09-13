"use client"

// components/jobs/TimeCorrectionPanel.tsx
// Web-Pendant zu Mobiles TimeCorrectionSheet (Phase B1): Korrektur-Formular
// für die Arbeitszeit EINER Zuweisung. Bewusst als inline Panel statt
// Browser-nativem Dialog (AGENTS.md Step 7) — reiht sich wie
// RejectVacationPanel unter die bestehende Detailseite ein.
//
// ZWEI SCHRITTE, BEWUSST (wie Mobile):
//   1. Formular  — Beginn, Ende, Grund
//   2. Bestätigen — Alt → Neu im Klartext, erst dann wird gespeichert
// Eine Abrechnungskorrektur soll nie ein einzelner Klick sein.
//
// GETEILTE AUFTRAGSZEIT IST NUR EIN VORSCHLAG: sie wird ausdrücklich als
// „Vorgeschlagene Zeit aus Auftragszeit" beschriftet und nie als Arbeitszeit
// des Mitarbeiters dargestellt. Übernehmen muss der Admin aktiv.

import { useEffect, useMemo, useState } from "react"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/database.types"
import { Button } from "@/components/ui/button"
import { Notice } from "@/components/auth/AuthShell"
import { formatDateTimeDE } from "@/lib/date"
import {
  correctAssignmentTime,
  validateCorrection,
} from "@/lib/jobs/timeCorrection.service"
import { Lightbulb, X } from "lucide-react"

type DB = SupabaseClient<Database>

export type TimeCorrectionTarget = {
  assignmentId: string
  employeeName: string
  customerName: string
  /** Zusatzinfo (Service), optional. */
  remark?: string | null
  /** Aktuell erfasste Eigenzeit (ISO) — jeweils null, wenn nicht erfasst. */
  employeeStartedAt: string | null
  employeeCompletedAt: string | null
  /** Geteilte Auftragszeit (ISO) als Vorschlag — optional. */
  sharedStartedAt?: string | null
  sharedCompletedAt?: string | null
}

type Props = {
  supabase: DB
  target: TimeCorrectionTarget
  onClose: () => void
  /** Wird nach erfolgreicher Korrektur gerufen (z. B. zum Neuladen). */
  onCorrected: () => void
}

function parseIso(iso: string | null | undefined): Date | null {
  if (!iso) return null
  const d = new Date(iso)
  return isNaN(d.getTime()) ? null : d
}

// "YYYY-MM-DDTHH:mm" in lokaler Zeit — das Format, das <input type="datetime-local">
// erwartet/liefert. Analog zu Mobiles DateTimeField, nur als Text statt Picker.
function toDateTimeLocalValue(d: Date | null): string {
  if (!d) return ""
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function fromDateTimeLocalValue(value: string): Date | null {
  if (!value) return null
  const d = new Date(value)
  return isNaN(d.getTime()) ? null : d
}

function timeLabel(iso: string | null | undefined): string {
  return formatDateTimeDE(iso) ?? "—"
}

function rangeLabel(startIso: string | null, endIso: string | null): string {
  return startIso || endIso
    ? `${timeLabel(startIso)} → ${timeLabel(endIso)}`
    : "Keine eigene Zeit erfasst"
}

export function TimeCorrectionPanel({ supabase, target, onClose, onCorrected }: Props) {
  const [start, setStart] = useState<Date | null>(() => parseIso(target.employeeStartedAt))
  const [end, setEnd] = useState<Date | null>(() => parseIso(target.employeeCompletedAt))
  const [reason, setReason] = useState("")
  const [confirming, setConfirming] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Beim Wechsel der Zuweisung (anderer Mitarbeiter) mit dessen bereits
  // erfasster Eigenzeit neu vorbelegen — die geteilte Auftragszeit wird
  // NICHT automatisch übernommen, dafür gibt es den Vorschlag-Button unten.
  useEffect(() => {
    setStart(parseIso(target.employeeStartedAt))
    setEnd(parseIso(target.employeeCompletedAt))
    setReason("")
    setConfirming(false)
    setSubmitting(false)
    setError(null)
  }, [target])

  const validationError = validateCorrection({
    newStartedAt: start,
    newCompletedAt: end,
    reason,
  })

  // Save nur aktiv, wenn gültig UND tatsächlich etwas geändert wurde.
  const unchanged =
    (start?.toISOString() ?? null) === target.employeeStartedAt &&
    (end?.toISOString() ?? null) === target.employeeCompletedAt

  const canProceed = validationError === null && !unchanged && !submitting

  const hasSuggestion = !!target.sharedStartedAt && !!target.sharedCompletedAt

  const applySuggestion = () => {
    setStart(parseIso(target.sharedStartedAt))
    setEnd(parseIso(target.sharedCompletedAt))
    setError(null)
  }

  const handleSave = async () => {
    if (!start || !end) return
    setSubmitting(true)
    setError(null)
    try {
      await correctAssignmentTime(supabase, {
        assignmentId: target.assignmentId,
        newStartedAt: start.toISOString(),
        newCompletedAt: end.toISOString(),
        reason,
      })
      onCorrected()
      onClose()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Die Zeitkorrektur konnte nicht gespeichert werden.",
      )
      setConfirming(false)
    } finally {
      setSubmitting(false)
    }
  }

  const oldLabel = useMemo(
    () => rangeLabel(target.employeeStartedAt, target.employeeCompletedAt),
    [target.employeeStartedAt, target.employeeCompletedAt],
  )

  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">Zeit korrigieren</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {target.employeeName} · {target.customerName}
            {target.remark ? ` · ${target.remark}` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Schließen"
          className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3 rounded-lg border border-gray-100 bg-background px-3 py-2">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Aktuell erfasst
        </p>
        <p className="mt-0.5 text-sm font-medium text-foreground">{oldLabel}</p>
      </div>

      {confirming ? (
        /* ── Schritt 2: Bestätigen ── */
        <div className="mt-3 space-y-3">
          <p className="text-sm font-medium text-foreground">Bitte prüfen und bestätigen:</p>

          <div className="rounded-lg border border-gray-100 bg-background p-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Alt</p>
            <p className="text-sm text-muted-foreground line-through">{oldLabel}</p>
            <div className="my-2 h-px bg-gray-100" />
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Neu</p>
            <p className="text-sm font-semibold text-foreground">
              {timeLabel(start?.toISOString())} → {timeLabel(end?.toISOString())}
            </p>
            <div className="my-2 h-px bg-gray-100" />
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Grund</p>
            <p className="text-sm text-foreground">{reason.trim()}</p>
          </div>

          {error && <Notice tone="error">{error}</Notice>}

          <div className="flex gap-2">
            <Button type="button" size="sm" onClick={handleSave} disabled={submitting}>
              {submitting ? "Speichern…" : "Korrektur speichern"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setConfirming(false)}
              disabled={submitting}
            >
              Zurück
            </Button>
          </div>
        </div>
      ) : (
        /* ── Schritt 1: Formular ── */
        <div className="mt-3 space-y-3">
          {hasSuggestion && (
            <button
              type="button"
              onClick={applySuggestion}
              className="flex w-full items-start gap-2 rounded-lg bg-primary/10 p-3 text-left transition-colors hover:bg-primary/15"
            >
              <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>
                <span className="block text-sm font-semibold text-foreground">
                  Vorgeschlagene Zeit aus Auftragszeit
                </span>
                <span className="block text-sm text-foreground">
                  {timeLabel(target.sharedStartedAt)} → {timeLabel(target.sharedCompletedAt)}
                </span>
                <span className="block text-xs text-muted-foreground">
                  Gesamtzeit des Auftrags — nicht zwingend die Arbeitszeit dieser Person. Zum
                  Übernehmen klicken.
                </span>
              </span>
            </button>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="correction-start">
                Beginn *
              </label>
              <input
                id="correction-start"
                type="datetime-local"
                value={toDateTimeLocalValue(start)}
                onChange={(e) => setStart(fromDateTimeLocalValue(e.target.value))}
                disabled={submitting}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="correction-end">
                Ende *
              </label>
              <input
                id="correction-end"
                type="datetime-local"
                value={toDateTimeLocalValue(end)}
                onChange={(e) => setEnd(fromDateTimeLocalValue(e.target.value))}
                disabled={submitting}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="correction-reason">
              Grund *
            </label>
            <textarea
              id="correction-reason"
              rows={3}
              placeholder="z. B. Start vergessen, Zeiten vom Objektleiter bestätigt"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={submitting}
              className="flex min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          {error && <Notice tone="error">{error}</Notice>}
          {!error && validationError && (
            <p className="text-xs text-muted-foreground">{validationError}</p>
          )}
          {!error && !validationError && unchanged && (
            <p className="text-xs text-muted-foreground">
              Es wurde noch nichts geändert.
            </p>
          )}

          <div className="flex gap-2">
            <Button type="button" size="sm" onClick={() => setConfirming(true)} disabled={!canProceed}>
              Weiter
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={onClose}>
              Abbrechen
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
