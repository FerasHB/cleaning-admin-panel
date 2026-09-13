// components/timesheets/TimesheetAbsenceSection.tsx
// Abwesenheiten-Abschnitt im Stundenzettel — Web-Port von Mobiles
// features/timesheets/components/TimesheetAbsenceSection.tsx. Additiv, für
// den gewählten Mitarbeiter/Monat.
//
// WICHTIG (wie Mobile): geplante Minuten werden NIE als "Arbeitszeit"/
// "Bezahlte Zeit"/"Entgeltfortzahlung" beschriftet — ausschließlich als
// "Geplante Einsatzzeit". Kalendertage werden NIE als verbrauchte
// Urlaubstage/Urlaubskonto dargestellt, sondern als reine Kalendertag-Zahl,
// getrennt von der Zahl der Tage mit tatsächlich geplanten Einsätzen.

import { Info } from "lucide-react"
import { SectionCard } from "@/components/dashboard/SectionCard"
import { formatDurationHm } from "@/lib/date"
import type { TimesheetAbsenceSummary, TimesheetNotice } from "@/lib/timesheets/timesheetAbsence.service"

function typeLabel(type: "vacation" | "sickness"): string {
  return type === "vacation" ? "Urlaub" : "Krank"
}

// "YYYY-MM-DD" → "03.06." ohne Zeitzonen-Drift.
function formatDayMonth(isoDate: string): string {
  const [, m, d] = isoDate.split("-")
  if (!m || !d) return isoDate
  return `${d}.${m}.`
}

function AbsenceTypeRow({
  label,
  calendarDays,
  plannedWorkDays,
  plannedMinutes,
}: {
  label: string
  calendarDays: number
  plannedWorkDays: number
  plannedMinutes: number
}) {
  return (
    <div className="px-4 py-3">
      <p className="text-sm font-semibold text-foreground">{label}</p>
      <p className="mt-0.5 text-sm text-foreground">
        {plannedWorkDays > 0
          ? `${plannedWorkDays} geplante${plannedWorkDays === 1 ? "r" : ""} Einsatztag${plannedWorkDays === 1 ? "" : "e"} · Geplante Einsatzzeit ${formatDurationHm(plannedMinutes)} h`
          : "Keine geplanten Einsätze"}
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {calendarDays} Kalendertag{calendarDays === 1 ? "" : "e"}
      </p>
    </div>
  )
}

export function TimesheetAbsenceSection({
  summary,
  notices,
}: {
  summary: TimesheetAbsenceSummary | undefined
  notices: TimesheetNotice[] | undefined
}) {
  const hasVacation = !!summary && summary.vacationCalendarDays > 0
  const hasSickness = !!summary && summary.sicknessCalendarDays > 0
  const hasNotices = !!notices && notices.length > 0

  if (!hasVacation && !hasSickness && !hasNotices) return null

  return (
    <div className="space-y-5">
      {hasNotices && (
        <SectionCard title="Hinweise" subtitle="Erfordert keine Aktion, nur zur Information" noBodyPadding>
          <ul className="divide-y divide-gray-100">
            {notices!.map((notice) => (
              <li key={`${notice.date}-${notice.type}`} className="flex items-start gap-2.5 px-4 py-3">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <p className="text-sm text-foreground">
                  Arbeit trotz {notice.absenceType === "vacation" ? "Urlaub" : "gemeldeter Abwesenheit"} am{" "}
                  {formatDayMonth(notice.date)} ({typeLabel(notice.absenceType)})
                </p>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      {(hasVacation || hasSickness) && (
        <SectionCard title="Abwesenheiten" subtitle="Urlaub und Krankheit im gewählten Zeitraum" noBodyPadding>
          <div className="divide-y divide-gray-100">
            {hasVacation && (
              <AbsenceTypeRow
                label="Urlaub"
                calendarDays={summary!.vacationCalendarDays}
                plannedWorkDays={summary!.vacationPlannedWorkDays}
                plannedMinutes={summary!.vacationPlannedMinutes}
              />
            )}
            {hasSickness && (
              <AbsenceTypeRow
                label="Krank"
                calendarDays={summary!.sicknessCalendarDays}
                plannedWorkDays={summary!.sicknessPlannedWorkDays}
                plannedMinutes={summary!.sicknessPlannedMinutes}
              />
            )}
          </div>
        </SectionCard>
      )}
    </div>
  )
}
