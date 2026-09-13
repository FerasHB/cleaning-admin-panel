// lib/timesheets/timesheetAbsence.service.ts
// Stundenzettel-Abwesenheiten: Orchestrierung getrennt von der bestehenden
// Ist-Zeit-Berechnung (lib/timesheets/timesheet.service.ts). Port von
// Mobiles services/timesheets/timesheetAbsence.service.ts.
//
// WARUM EINE EIGENE DATEI: die bestehende Ist-Zeit-Logik (mapEntry/mapGap,
// Legacy-Cutoff, geteilte Job-Uhr) ist abrechnungskritisch und darf durch
// diese rein additive Abwesenheits-Ableitung nicht berührt werden.
// getTimesheet() ruft am Ende lediglich buildTimesheetAbsence() zusätzlich
// auf und merged das Ergebnis additiv in TimesheetData.
//
// QUELLEN:
//   * employee_absences (via getEmployeeAbsencesInRange, RLS-skopiert)
//   * jobs.planned_duration_minutes der zugewiesenen Occurrences im Zeitraum
//     (via getJobsInRangeForEmployee, NIE aus tatsächlicher Arbeitszeit oder
//     scheduled_end abgeleitet)
//
// KEINE Occurrence-Abfrage, wenn es im Zeitraum keinen wirksamen
// Abwesenheitstag gibt — der Regelfall "Mitarbeiter ohne Abwesenheit in
// diesem Monat" kostet damit keine zusätzliche Anfrage.

import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/database.types"
import { getEmployeeAbsencesInRange } from "@/lib/absences/absences"
import { getJobsInRangeForEmployee } from "@/lib/jobs/jobs.service"
import type { TimesheetEntry } from "@/lib/timesheets/timesheet.service"
import {
  resolveEffectiveAbsenceDays,
  type EffectiveAbsenceDay,
} from "@/lib/timesheets/resolveEffectiveAbsenceDays"

type DB = SupabaseClient<Database>

/**
 * Ein effektiver Abwesenheitstag angereichert um die geplante Einsatzzeit
 * (Summe von jobs.planned_duration_minutes der an diesem Tag zugewiesenen
 * Occurrences, NIE aus tatsächlicher Arbeitszeit oder scheduled_end
 * abgeleitet).
 */
export type TimesheetAbsenceDay = EffectiveAbsenceDay & {
  /** Summe der geplanten Minuten zugewiesener Occurrences an diesem Tag. */
  plannedMinutes: number
  /** true, wenn an diesem Tag mindestens eine Occurrence mit geplanter Dauer existiert. */
  hasPlannedWork: boolean
}

/**
 * Zusammenfassung für einen Mitarbeiter/Monat. Trennt bewusst:
 *   * Kalendertage    — reine Abwesenheits-Kalendertage (KEINE Urlaubskonto-Aussage).
 *   * PlannedWorkDays — Tage mit tatsächlich geplanten Einsätzen an diesem Tag.
 *   * PlannedMinutes  — die daraus resultierende geplante Einsatzzeit.
 * Niemals als "Arbeitszeit"/"Bezahlte Zeit" beschriften.
 */
export type TimesheetAbsenceSummary = {
  vacationCalendarDays: number
  sicknessCalendarDays: number
  vacationPlannedWorkDays: number
  sicknessPlannedWorkDays: number
  vacationPlannedMinutes: number
  sicknessPlannedMinutes: number
  days: TimesheetAbsenceDay[]
}

/** Informativer Hinweis, KEIN Korrektur-Datensatz (siehe TimesheetGap). */
export type TimesheetNotice = {
  type: "work_during_absence"
  /** "YYYY-MM-DD" — der Tag mit sowohl Ist-Zeit-Eintrag als auch wirksamer Abwesenheit. */
  date: string
  absenceType: "vacation" | "sickness"
}

function emptySummary(): TimesheetAbsenceSummary {
  return {
    vacationCalendarDays: 0,
    sicknessCalendarDays: 0,
    vacationPlannedWorkDays: 0,
    sicknessPlannedWorkDays: 0,
    vacationPlannedMinutes: 0,
    sicknessPlannedMinutes: 0,
    days: [],
  }
}

/**
 * Lädt Abwesenheiten + geplante Einsatzzeit für einen Mitarbeiter/Zeitraum
 * und baut daraus Zusammenfassung + Hinweise.
 *
 * @param entries Bereits geladene Ist-Zeit-Einträge desselben Aufrufs
 *   (getTimesheet) — ausschließlich für den "Arbeit trotz Abwesenheit"-
 *   Hinweis genutzt, NIE für die Planzeit-Berechnung.
 */
export async function buildTimesheetAbsence(
  supabase: DB,
  params: {
    employeeId: string
    /** "YYYY-MM-DD", inklusive — identische Monatsgrenzen wie getTimesheet. */
    from: string
    /** "YYYY-MM-DD", inklusive */
    to: string
    entries: TimesheetEntry[]
  },
): Promise<{ summary: TimesheetAbsenceSummary; notices: TimesheetNotice[] }> {
  const { employeeId, from, to, entries } = params

  const absences = await getEmployeeAbsencesInRange(supabase, { employeeId, from, to })
  const effectiveDays = resolveEffectiveAbsenceDays(absences, from, to)

  if (effectiveDays.length === 0) {
    return { summary: emptySummary(), notices: [] }
  }

  const occurrences = await getJobsInRangeForEmployee(supabase, employeeId, from, to)

  // Geplante Minuten je Kalendertag, NUR aus planned_duration_minutes
  // zugewiesener Occurrences — null-Dauer wird ignoriert.
  const plannedMinutesByDate = new Map<string, number>()
  for (const job of occurrences) {
    if (!job.date) continue
    if (job.planned_duration_minutes == null) continue
    plannedMinutesByDate.set(job.date, (plannedMinutesByDate.get(job.date) ?? 0) + job.planned_duration_minutes)
  }

  const days: TimesheetAbsenceDay[] = effectiveDays.map((day) => {
    const plannedMinutes = plannedMinutesByDate.get(day.date) ?? 0
    return { ...day, plannedMinutes, hasPlannedWork: plannedMinutes > 0 }
  })

  const summary = days.reduce<TimesheetAbsenceSummary>((acc, day) => {
    if (day.type === "vacation") {
      acc.vacationCalendarDays += 1
      if (day.hasPlannedWork) acc.vacationPlannedWorkDays += 1
      acc.vacationPlannedMinutes += day.plannedMinutes
    } else {
      acc.sicknessCalendarDays += 1
      if (day.hasPlannedWork) acc.sicknessPlannedWorkDays += 1
      acc.sicknessPlannedMinutes += day.plannedMinutes
    }
    return acc
  }, emptySummary())
  summary.days = days

  // "Arbeit trotz Abwesenheit": Schnittmenge Ist-Zeit-Einträge × wirksame
  // Abwesenheitstage. Rein informativ — ändert weder entries noch
  // totalMinutes noch die Abwesenheits-Klassifizierung.
  const effectiveByDate = new Map(effectiveDays.map((d) => [d.date, d.type]))
  const notices: TimesheetNotice[] = []
  const seenNoticeDates = new Set<string>()
  for (const entry of entries) {
    const absenceType = effectiveByDate.get(entry.date)
    if (!absenceType || seenNoticeDates.has(entry.date)) continue
    seenNoticeDates.add(entry.date)
    notices.push({ type: "work_during_absence", date: entry.date, absenceType })
  }
  notices.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))

  return { summary, notices }
}
