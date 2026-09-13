"use client"

import Link from "next/link"
import { Calendar, CheckCircle2, User2, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Notice } from "@/components/auth/AuthShell"
import { AbsenceStatusBadge, AbsenceTypeLabel } from "@/components/absences/AbsenceStatusBadge"
import { VacationDeductionPanel } from "@/components/absences/VacationDeductionPanel"
import { RejectVacationPanel } from "@/components/absences/RejectVacationPanel"
import { AU_STATUS_LABEL, isPendingVacation, type Absence, type AbsenceEvidence } from "@/lib/absences/absences"
import type { useVacationReview } from "@/hooks/use-vacation-review"

function formatDayMonthYear(dateKey: string): string {
  const [y, m, d] = dateKey.split("-")
  return `${d}.${m}.${y}`
}

function formatRange(absence: Absence): string {
  if (absence.endDate === null) return `ab ${formatDayMonthYear(absence.startDate)}`
  if (absence.endDate === absence.startDate) return formatDayMonthYear(absence.startDate)
  return `${formatDayMonthYear(absence.startDate)} – ${formatDayMonthYear(absence.endDate)}`
}

export function AdminAbsenceRow({
  absence,
  showEmployeeName = true,
  evidence,
  review,
}: {
  absence: Absence
  showEmployeeName?: boolean
  /** AU-Beleg-Status; der Link führt zur eigentlichen Prüf-/Rückgabeseite. */
  evidence?: AbsenceEvidence
  review: ReturnType<typeof useVacationReview>
}) {
  const pending = isPendingVacation(absence)
  const isRowPending = review.pendingId === absence.id
  const showAuLabel = absence.type === "sickness" && absence.status === "reported"

  return (
    <li className="px-5 py-3">
      <div className="flex flex-wrap items-center gap-3">
        {showEmployeeName && (
          <span className="flex min-w-0 items-center gap-1.5 text-sm font-medium text-foreground">
            <User2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            {absence.employeeId ? (
              <Link href={`/employees/${absence.employeeId}`} className="truncate hover:underline">
                {absence.employeeName}
              </Link>
            ) : (
              <span className="truncate">{absence.employeeName} (ehemalig)</span>
            )}
          </span>
        )}
        <span className="text-sm text-muted-foreground">
          <AbsenceTypeLabel type={absence.type} />
        </span>
        <span className="flex items-center gap-1.5 text-sm tabular-nums text-muted-foreground">
          <Calendar className="h-3.5 w-3.5 shrink-0" />
          {formatRange(absence)}
        </span>
        <AbsenceStatusBadge absence={absence} />
        {showAuLabel && (
          <Link
            href={`/absences/${absence.id}/au`}
            className="text-xs font-medium text-primary underline-offset-2 hover:underline"
          >
            {evidence ? AU_STATUS_LABEL[evidence.status] : "Nicht geprüft"} · prüfen
          </Link>
        )}
        {pending && !isRowPending && (
          <div className="ml-auto flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => void review.startApprove(absence.employeeId, absence.id)}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Genehmigen
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-destructive hover:text-destructive"
              onClick={() => review.startReject(absence.id)}
            >
              <XCircle className="h-3.5 w-3.5" />
              Ablehnen
            </Button>
          </div>
        )}
      </div>

      {(absence.employeeNote || absence.adminNote) && (
        <div className="mt-1.5 space-y-0.5 pl-5 text-xs text-muted-foreground">
          {absence.employeeNote && <p>Notiz Mitarbeiter: {absence.employeeNote}</p>}
          {absence.adminNote && <p>Notiz Admin: {absence.adminNote}</p>}
        </div>
      )}

      {isRowPending && review.pendingAction?.kind === "deduction" && absence.endDate && (
        <div className="mt-3">
          <VacationDeductionPanel
            startDate={absence.startDate}
            endDate={absence.endDate}
            onConfirm={(deductions) => void review.confirmApprove(deductions)}
            onCancel={review.cancel}
            disabled={review.busy}
          />
        </div>
      )}
      {isRowPending && review.pendingAction?.kind === "confirm-simple" && (
        <div className="mt-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
          <p className="text-sm text-foreground">
            Urlaubsantrag von {absence.employeeName} ({formatRange(absence)}) genehmigen?
          </p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={() => void review.confirmApprove()} disabled={review.busy}>
              Genehmigen
            </Button>
            <Button size="sm" variant="outline" onClick={review.cancel} disabled={review.busy}>
              Abbrechen
            </Button>
          </div>
        </div>
      )}
      {isRowPending && review.pendingAction?.kind === "reject" && (
        <div className="mt-3">
          <RejectVacationPanel
            onConfirm={(note) => void review.confirmReject(note)}
            onCancel={review.cancel}
            disabled={review.busy}
          />
        </div>
      )}
      {isRowPending && review.error && (
        <div className="mt-2">
          <Notice tone="error">{review.error}</Notice>
        </div>
      )}
    </li>
  )
}
