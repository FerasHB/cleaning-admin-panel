import { Badge } from "@/components/ui/badge"
import type { Absence } from "@/lib/absences/absences"

export function AbsenceTypeLabel({ type }: { type: Absence["type"] }) {
  return <>{type === "vacation" ? "Urlaub" : "Krankheit"}</>
}

// Vacation: requested/approved/rejected/cancelled. Sickness: reported/cancelled.
// "cancelled" is the only status shared by both types (chk_employee_absences_status_matches_type).
export function AbsenceStatusBadge({ absence }: { absence: Pick<Absence, "type" | "status"> }) {
  if (absence.status === "cancelled") return <Badge variant="secondary">Storniert</Badge>
  if (absence.type === "vacation") {
    if (absence.status === "requested") return <Badge variant="warning">Beantragt</Badge>
    if (absence.status === "approved") return <Badge variant="success">Genehmigt</Badge>
    return <Badge variant="destructive">Abgelehnt</Badge>
  }
  return <Badge variant="info">Gemeldet</Badge>
}
