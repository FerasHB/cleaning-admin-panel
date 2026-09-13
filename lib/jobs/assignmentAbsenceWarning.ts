// lib/jobs/assignmentAbsenceWarning.ts
// Zuweisung × Abwesenheit — Port von Mobiles
//   services/absences/absenceConflicts.ts        (gebündelte Abfrage)
//   utils/absenceConflicts.ts                    (Zuordnung Termin × Abwesenheit)
//   utils/recurringOccurrencePreview.ts          (Termin-Vorschau für Regeln)
//   features/jobs/utils/assignmentAbsenceWarning (Orchestrierung + Text)
//
// WARNUNG, NIE SPERRE: Die Prüfung speichert nichts und blockiert nie — ein
// Fehler bei der Prüfung selbst lässt das Speichern zu (siehe
// hooks/use-assignment-absence-guard.ts).
//
// Datumslogik ausschließlich über "YYYY-MM-DD"-Strings (zeitzonenfreie
// Kalendertage), wie Mobile.

import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/database.types"
import { formatDateISO } from "@/lib/date"
import { getWeekdayKey, type WeekdayKey } from "@/lib/recurrence"
import type { EmployeeOption, JobInput } from "@/lib/jobs/jobs.service"

type DB = SupabaseClient<Database>

export type AbsenceType = Database["public"]["Enums"]["absence_type"]

type ActiveAbsence = {
  id: string
  employeeId: string | null
  type: AbsenceType
  startDate: string
  endDate: string | null
}

// "Aktive Abwesenheit": NUR genehmigter Urlaub oder gemeldete Krankheit —
// beantragter/abgelehnter/stornierter Urlaub zählt NICHT (Mobiles
// ACTIVE_ABSENCE_FILTER_OR).
const ACTIVE_ABSENCE_FILTER_OR =
  "and(type.eq.vacation,status.eq.approved),and(type.eq.sickness,status.eq.reported)"

// EIN Query für alle Mitarbeiter-IDs; echte Zeitraum-Überschneidung mit
// [from, to], offene Krankheit (end_date NULL) eingeschlossen. RLS begrenzt
// auf die eigene Firma.
async function getActiveAbsencesForEmployeesInRange(
  supabase: DB,
  params: { employeeIds: string[]; from: string; to: string },
): Promise<ActiveAbsence[]> {
  const uniqueIds = Array.from(new Set(params.employeeIds))
  if (uniqueIds.length === 0) return []

  const { data, error } = await supabase
    .from("employee_absences")
    .select("id, employee_id, type, start_date, end_date")
    .in("employee_id", uniqueIds)
    .or(ACTIVE_ABSENCE_FILTER_OR)
    .lte("start_date", params.to)
    .or(`end_date.is.null,end_date.gte.${params.from}`)

  if (error) throw error
  return (data ?? []).map((row) => ({
    id: row.id,
    employeeId: row.employee_id,
    type: row.type,
    startDate: row.start_date,
    endDate: row.end_date,
  }))
}

export type AssignmentAbsenceConflict = {
  employeeId: string
  employeeName: string
  absenceId: string
  type: AbsenceType
  /** "YYYY-MM-DD" — der kollidierende Termin-Tag. */
  date: string
  startDate: string
  endDate: string | null
}

type CandidateAssignment = { employeeId: string; employeeName: string; date: string }

// Jede Kombination Termin × aktive Abwesenheit desselben Mitarbeiters; nur
// exakte Duplikate (Mitarbeiter, Abwesenheit, Tag) werden einmal gezählt.
function findAssignmentConflicts(
  absences: ActiveAbsence[],
  assignments: CandidateAssignment[],
): AssignmentAbsenceConflict[] {
  const conflicts: AssignmentAbsenceConflict[] = []
  const seen = new Set<string>()

  for (const assignment of assignments) {
    for (const absence of absences) {
      if (absence.employeeId !== assignment.employeeId) continue
      if (assignment.date < absence.startDate) continue
      if (absence.endDate !== null && assignment.date > absence.endDate) continue

      const key = `${assignment.employeeId}|${absence.id}|${assignment.date}`
      if (seen.has(key)) continue
      seen.add(key)

      conflicts.push({
        employeeId: assignment.employeeId,
        employeeName: assignment.employeeName,
        absenceId: absence.id,
        type: absence.type,
        date: assignment.date,
        startDate: absence.startDate,
        endDate: absence.endDate,
      })
    }
  }

  return conflicts
}

// Spiegelt den Horizont von generate_job_occurrences: Start = max(Regel-Start,
// heute); Ende = min(Regel-Ende bzw. Start+3 Monate, Start+730 Tage); inklusiv.
const HARD_LIMIT_DAYS = 730
const DEFAULT_HORIZON_MONTHS = 3

function keyToDate(key: string): Date {
  const [y, m, d] = key.split("-").map((n) => parseInt(n, 10))
  return new Date(y, (m || 1) - 1, d || 1)
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)
}

function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, date.getDate())
}

export function previewRecurringOccurrenceDates(params: {
  recurringDays: WeekdayKey[]
  recurrenceStartDate: string | null
  recurrenceEndDate: string | null
}): string[] {
  if (params.recurringDays.length === 0) return []

  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const ruleStart = params.recurrenceStartDate ? keyToDate(params.recurrenceStartDate) : today

  const generationStart = ruleStart.getTime() > today.getTime() ? ruleStart : today
  const hardLimit = addDays(generationStart, HARD_LIMIT_DAYS)
  const ruleEnd = params.recurrenceEndDate
    ? keyToDate(params.recurrenceEndDate)
    : addMonths(generationStart, DEFAULT_HORIZON_MONTHS)
  const generationEnd = ruleEnd.getTime() < hardLimit.getTime() ? ruleEnd : hardLimit

  const days = new Set(params.recurringDays)
  const dates: string[] = []
  for (let cursor = generationStart; cursor.getTime() <= generationEnd.getTime(); cursor = addDays(cursor, 1)) {
    if (days.has(getWeekdayKey(cursor))) {
      const key = formatDateISO(cursor)
      if (key) dates.push(key)
    }
  }
  return dates
}

export type AssignmentAbsenceCheckInput = {
  employeeIds: string[]
  employees: EmployeeOption[]
  jobType: "single" | "recurring"
  /** "YYYY-MM-DD" — nur bei single relevant. */
  singleDate: string | null
  recurringDays: WeekdayKey[]
  recurrenceStartDate: string | null
  recurrenceEndDate: string | null
}

// Prüf-Eingabe aus derselben Service-Eingabe, die gleich gespeichert wird
// (also bereits nur die sendbaren, aktiven Mitarbeiter-IDs).
export function toAbsenceCheckInput(
  jobInput: JobInput,
  employees: EmployeeOption[],
): AssignmentAbsenceCheckInput {
  return {
    employeeIds: jobInput.employeeIds ?? [],
    employees,
    jobType: jobInput.jobType,
    singleDate: jobInput.date ?? null,
    recurringDays: (jobInput.recurringDays ?? []) as WeekdayKey[],
    recurrenceStartDate: jobInput.recurrenceStartDate ?? null,
    recurrenceEndDate: jobInput.recurrenceEndDate ?? null,
  }
}

// Kandidaten-Termine aus den AKTUELLEN Formularwerten, eine gebündelte
// Abfrage, dann Zuordnung. Leer bei: keine Zuweisung, keine Termine, keine
// Konflikte.
export async function checkAssignmentAbsenceConflicts(
  supabase: DB,
  input: AssignmentAbsenceCheckInput,
): Promise<AssignmentAbsenceConflict[]> {
  if (input.employeeIds.length === 0) return []

  const candidateDates =
    input.jobType === "single"
      ? input.singleDate
        ? [input.singleDate]
        : []
      : previewRecurringOccurrenceDates(input)

  if (candidateDates.length === 0) return []

  let from = candidateDates[0]
  let to = candidateDates[0]
  for (const date of candidateDates) {
    if (date < from) from = date
    if (date > to) to = date
  }

  const absences = await getActiveAbsencesForEmployeesInRange(supabase, {
    employeeIds: input.employeeIds,
    from,
    to,
  })
  if (absences.length === 0) return []

  const nameById = new Map(input.employees.map((e) => [e.id, e.fullName]))
  const assignments = input.employeeIds.flatMap((employeeId) =>
    candidateDates.map((date) => ({
      employeeId,
      employeeName: nameById.get(employeeId) ?? "Unbekannt",
      date,
    })),
  )

  return findAssignmentConflicts(absences, assignments)
}

export type AssignmentAbsenceWarningText = {
  title: string
  message: string
  confirmLabel: string
}

const MAX_PREVIEW_ROWS = 5

function formatDayMonth(dateIso: string): string {
  const [, m, d] = dateIso.split("-")
  return `${d}.${m}.`
}

function typeLabel(type: AbsenceType): string {
  return type === "vacation" ? "Urlaub" : "Krank"
}

// Zeitraum der Abwesenheit ("18.08.–22.08.", offene Krankheit "ab 18.08.").
function formatAbsenceRange(c: AssignmentAbsenceConflict): string {
  if (c.endDate === null) return `ab ${formatDayMonth(c.startDate)}`
  if (c.endDate === c.startDate) return formatDayMonth(c.startDate)
  return `${formatDayMonth(c.startDate)}–${formatDayMonth(c.endDate)}`
}

// EINE Warnung für alle Konflikte — Texte wie Mobile, ergänzt um den
// Abwesenheitszeitraum in Klammern.
export function formatAssignmentAbsenceWarning(
  conflicts: AssignmentAbsenceConflict[],
  jobType: "single" | "recurring",
): AssignmentAbsenceWarningText {
  if (jobType === "recurring") {
    const rows = conflicts
      .slice(0, MAX_PREVIEW_ROWS)
      .map(
        (c) =>
          `• ${formatDayMonth(c.date)} — ${c.employeeName} (${typeLabel(c.type)} ${formatAbsenceRange(c)})`,
      )
    const remaining = conflicts.length - rows.length
    const lines = [
      `Bei ${conflicts.length} geplanten ${conflicts.length === 1 ? "Einsatz" : "Einsätzen"} gibt es Abwesenheiten:`,
      "",
      ...rows,
      ...(remaining > 0 ? [`+ ${remaining} weitere`] : []),
    ]
    return {
      title: "Abwesenheiten gefunden",
      message: lines.join("\n"),
      confirmLabel: "Trotzdem speichern",
    }
  }

  if (conflicts.length === 1) {
    const c = conflicts[0]
    return {
      title: "Abwesenheit gefunden",
      message: `${c.employeeName} ist am ${formatDayMonth(c.date)} ${
        c.type === "vacation" ? "im Urlaub" : "krank gemeldet"
      } (${formatAbsenceRange(c)}).`,
      confirmLabel: "Trotzdem zuweisen",
    }
  }

  const uniqueEmployees = new Set(conflicts.map((c) => c.employeeId)).size
  const rows = conflicts
    .slice(0, MAX_PREVIEW_ROWS)
    .map((c) => `• ${c.employeeName} — ${typeLabel(c.type)} (${formatAbsenceRange(c)})`)
  const remaining = conflicts.length - rows.length
  const lines = [
    `${uniqueEmployees} Mitarbeiter sind an diesem Tag abwesend:`,
    "",
    ...rows,
    ...(remaining > 0 ? [`+ ${remaining} weitere`] : []),
  ]
  return {
    title: "Abwesenheiten gefunden",
    message: lines.join("\n"),
    confirmLabel: "Trotzdem zuweisen",
  }
}
