"use client"

// app/(admin)/absences/[id]/au/page.tsx
// Web-Pendant zu Mobiles AdminAuReviewScreen (features/absences/admin/AdminAuReviewScreen.tsx):
// eine einzelne Seite, kein Dialog — AU bestätigen/ablehnen, danach bei
// confirmed die Rückgabe-Kandidaten mit editierbaren Mengenfeldern. Backend
// unverändert; diese Seite berechnet nichts selbst und schreibt nie direkt
// in vacation_ledger (siehe lib/absences/absences.ts).

import { useCallback, useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Notice } from "@/components/auth/AuthShell"
import { SectionCard } from "@/components/dashboard/SectionCard"
import { EmptyState } from "@/components/ui/empty-state"
import { ArrowLeft, CalendarOff, CheckCircle2, Stethoscope, XCircle } from "lucide-react"
import {
  getAbsenceById,
  getAbsenceEvidence,
  getRestorationCandidates,
  restoreVacationFromAu,
  reviewAu,
  toAbsenceMessage,
  AU_STATUS_LABEL,
  type Absence,
  type AbsenceEvidence,
  type AuRestorationCandidate,
} from "@/lib/absences/absences"

function formatDayMonthYear(dateKey: string): string {
  const [y, m, d] = dateKey.split("-")
  return `${d}.${m}.${y}`
}

function formatDateTimeDE(iso: string): string {
  return (
    new Date(iso).toLocaleString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }) + " Uhr"
  )
}

function candidateKey(c: Pick<AuRestorationCandidate, "vacationAbsenceId" | "year">): string {
  return `${c.vacationAbsenceId}:${c.year}`
}

export default function AuReviewPage() {
  const params = useParams()
  const router = useRouter()
  const absenceId = params.id as string
  const [supabase] = useState(() => createClient())

  const [absence, setAbsence] = useState<Absence | null>(null)
  const [evidence, setEvidence] = useState<AbsenceEvidence | null>(null)
  const [candidates, setCandidates] = useState<AuRestorationCandidate[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reviewBusy, setReviewBusy] = useState(false)

  const [values, setValues] = useState<Record<string, string>>({})
  const [restoreError, setRestoreError] = useState<string | null>(null)
  const [restoreNotice, setRestoreNotice] = useState<string | null>(null)
  const [restoring, setRestoring] = useState(false)

  const load = useCallback(async () => {
    setError(null)
    try {
      const a = await getAbsenceById(supabase, absenceId)
      if (!a) {
        setNotFound(true)
        return
      }
      setAbsence(a)
      const ev = await getAbsenceEvidence(supabase, absenceId)
      setEvidence(ev)

      if (ev?.status === "confirmed") {
        const c = await getRestorationCandidates(supabase, absenceId)
        setCandidates(c)
        // Nur bei voller Abdeckung vorbelegen — bei Teilüberschneidung ist
        // die Menge nicht berechenbar (siehe get_au_restoration_candidates).
        setValues((prev) => {
          const next = { ...prev }
          for (const cand of c) {
            const key = candidateKey(cand)
            if (key in next) continue
            next[key] = cand.fullCoverage && cand.restorableDays > 0 ? String(cand.restorableDays) : ""
          }
          return next
        })
      } else {
        setCandidates([])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "AU-Nachweis konnte nicht geladen werden.")
    } finally {
      setLoading(false)
    }
  }, [supabase, absenceId])

  useEffect(() => {
    void load()
  }, [load])

  const handleReview = async (decision: "confirmed" | "rejected") => {
    if (reviewBusy) return
    setReviewBusy(true)
    setError(null)
    try {
      await reviewAu(supabase, absenceId, decision)
      await load()
    } catch (err) {
      setError(toAbsenceMessage(err, "AU konnte nicht geprüft werden."))
    } finally {
      setReviewBusy(false)
    }
  }

  const handleRestore = async () => {
    if (restoring || !evidence) return
    setRestoreError(null)
    setRestoreNotice(null)

    const items: { vacation_absence_id: string; year: number; days: number }[] = []
    for (const c of candidates) {
      const key = candidateKey(c)
      const raw = (values[key] ?? "").trim().replace(",", ".")
      if (!raw) continue
      const days = Number(raw)
      if (!Number.isFinite(days) || days <= 0) {
        setRestoreError(`Bitte eine gültige Tageszahl für ${formatDayMonthYear(c.vacationStart)} – ${formatDayMonthYear(c.vacationEnd)} (${c.year}) angeben.`)
        return
      }
      if (days > c.restorableDays) {
        setRestoreError(
          `Für ${formatDayMonthYear(c.vacationStart)} – ${formatDayMonthYear(c.vacationEnd)} (${c.year}) können höchstens ${c.restorableDays} Tage zurückgegeben werden.`,
        )
        return
      }
      items.push({ vacation_absence_id: c.vacationAbsenceId, year: c.year, days })
    }

    if (items.length === 0) {
      setRestoreError("Bitte mindestens einen Wert eintragen.")
      return
    }

    setRestoring(true)
    try {
      const created = await restoreVacationFromAu(supabase, evidence.id, items)
      setRestoreNotice(created > 0 ? `${created} Rückgabe(n) gebucht.` : "Diese Rückgabe war bereits gebucht.")
      await load()
    } catch (err) {
      setRestoreError(toAbsenceMessage(err, "Urlaubstage konnten nicht zurückgegeben werden."))
    } finally {
      setRestoring(false)
    }
  }

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground">Wird geladen…</div>
  }

  if (notFound || !absence) {
    return (
      <EmptyState
        icon={Stethoscope}
        title="Krankmeldung nicht gefunden"
        description="Diese Krankmeldung ist nicht (mehr) verfügbar."
        action={
          <Button onClick={() => router.push("/absences")}>Zu den Abwesenheiten</Button>
        }
      />
    )
  }

  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={() => router.back()}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Zurück
      </button>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Arbeitsunfähigkeit</h1>
        <p className="text-muted-foreground">
          {absence.employeeName} · {formatDayMonthYear(absence.startDate)}
          {absence.endDate ? ` – ${formatDayMonthYear(absence.endDate)}` : " (offen)"}
        </p>
      </div>

      {error && <Notice tone="error">{error}</Notice>}

      <SectionCard title="AU-Status">
        <div className="space-y-3">
          <p className="text-sm font-medium text-foreground">
            {evidence ? AU_STATUS_LABEL[evidence.status] : "Nicht geprüft"}
            {evidence?.confirmedAt && (
              <span className="ml-2 font-normal text-muted-foreground">seit {formatDateTimeDE(evidence.confirmedAt)}</span>
            )}
          </p>
          <p className="text-sm text-muted-foreground">
            Eine Krankmeldung allein gibt keinen Urlaub zurück. Erst eine hier ausdrücklich bestätigte
            Arbeitsunfähigkeit berechtigt zu einer Gutschrift.
          </p>
          {evidence?.note && <p className="text-sm text-muted-foreground">Notiz: {evidence.note}</p>}
          <div className="flex gap-2">
            <Button size="sm" className="gap-1.5" onClick={() => void handleReview("confirmed")} disabled={reviewBusy}>
              <CheckCircle2 className="h-3.5 w-3.5" />
              AU bestätigen
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-destructive hover:text-destructive"
              onClick={() => void handleReview("rejected")}
              disabled={reviewBusy}
            >
              <XCircle className="h-3.5 w-3.5" />
              AU ablehnen
            </Button>
          </div>
        </div>
      </SectionCard>

      {evidence?.status === "confirmed" && (
        <SectionCard title="Urlaubstage zurückgeben" subtitle="Menge je Urlaub und Jahr selbst bestätigen">
          {candidates.length === 0 ? (
            <EmptyState
              icon={CalendarOff}
              title="Nichts zurückzugeben"
              description="Keine abgezogenen Urlaubstage überschneiden sich mit dieser Krankmeldung."
            />
          ) : (
            <div className="space-y-4">
              {restoreError && <Notice tone="error">{restoreError}</Notice>}
              {restoreNotice && <Notice tone="success">{restoreNotice}</Notice>}
              <div className="space-y-3">
                {candidates.map((c) => {
                  const key = candidateKey(c)
                  const fullyRestored = c.restorableDays <= 0
                  return (
                    <div key={key} className="rounded-xl border border-gray-100 p-4">
                      <p className="text-sm font-medium text-foreground">
                        {formatDayMonthYear(c.vacationStart)} – {formatDayMonthYear(c.vacationEnd)} ({c.year})
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Abgezogen: {c.deductedDays} Tage · Bereits zurückgegeben: {c.alreadyRestored} Tage
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Überschneidung mit der AU: {formatDayMonthYear(c.overlapStart)} – {formatDayMonthYear(c.overlapEnd)}
                      </p>
                      {!c.fullCoverage && !fullyRestored && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Die AU deckt den Urlaub nur teilweise ab — wie viele der abgezogenen Tage betroffen sind, lässt
                          sich nicht berechnen. Bitte selbst festlegen.
                        </p>
                      )}
                      {fullyRestored ? (
                        <p className="mt-2 text-sm font-medium text-muted-foreground">Bereits vollständig zurückgegeben.</p>
                      ) : (
                        <div className="mt-2 flex items-center gap-2">
                          <Input
                            inputMode="decimal"
                            placeholder={c.fullCoverage ? undefined : "Bitte eintragen"}
                            className="w-28"
                            value={values[key] ?? ""}
                            onChange={(e) => setValues((prev) => ({ ...prev, [key]: e.target.value }))}
                            disabled={restoring}
                          />
                          <span className="text-xs text-muted-foreground">max. {c.restorableDays} Tage</span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
              <Button onClick={() => void handleRestore()} disabled={restoring}>
                {restoring ? "Wird gebucht…" : "Urlaubstage zurückgeben"}
              </Button>
              <p className="text-xs text-muted-foreground">
                Gutschriften werden nie gelöscht. Eine Korrektur läuft über eine sichtbare manuelle Anpassung im
                Urlaubskonto.
              </p>
            </div>
          )}
        </SectionCard>
      )}
    </div>
  )
}
