import { AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { AssignmentAbsenceWarningText } from "@/lib/jobs/assignmentAbsenceWarning"

// Inline-Sicherheitsabfrage (gleiche Bauform wie die (De)aktivieren-Abfrage
// der Mitarbeiter-Detailseite) für die Zuweisungs-Abwesenheitswarnung.
export function AbsenceWarningPanel({
  warning,
  onConfirm,
  onCancel,
  disabled,
}: {
  warning: AssignmentAbsenceWarningText
  onConfirm: () => void
  onCancel: () => void
  disabled?: boolean
}) {
  return (
    <div
      role="alertdialog"
      aria-labelledby="absence-warning-title"
      aria-describedby="absence-warning-message"
      className="rounded-xl border border-amber-200 bg-amber-50 p-4"
    >
      <p
        id="absence-warning-title"
        className="flex items-center gap-2 text-sm font-semibold text-amber-900"
      >
        <AlertTriangle className="h-4 w-4 shrink-0" />
        {warning.title}
      </p>
      <p
        id="absence-warning-message"
        className="mt-1 whitespace-pre-line text-sm text-amber-900/90"
      >
        {warning.message}
      </p>
      <div className="mt-3 flex gap-2">
        <Button type="button" size="sm" onClick={onConfirm} disabled={disabled}>
          {warning.confirmLabel}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onCancel} disabled={disabled}>
          Abbrechen
        </Button>
      </div>
    </div>
  )
}
