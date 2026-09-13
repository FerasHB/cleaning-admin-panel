// lib/jobs/schedule.ts
// Validiert & normalisiert die Terminierungs-Felder für die jobs-Tabelle —
// 1:1-Port von Mobiles buildSchedulePayload (services/jobs/jobs.service.ts).
// Wirft bei ungültiger Kombination, damit Web und Mobile exakt dieselbe
// Validierung haben und dieselben Spalten schreiben.
//
// single:    date + start_time gesetzt, recurring_days/recurrence_* null, aktiv
// recurring: recurring_days + start_time + recurrence_start_date (Pflicht)
//            + recurrence_end_date (optional) + is_active, date null
//
// scheduled_start ist NICHT Teil dieses Payloads (wie Mobile): der Aufrufer
// reicht ihn für single zusätzlich aus Datum + Uhrzeit abgeleitet mit.

export type JobType = "single" | "recurring"

export type JobScheduleInput = {
  jobType: JobType
  date?: string | null
  startTime?: string | null
  recurringDays?: string[] | null
  isActive?: boolean
  recurrenceStartDate?: string | null
  recurrenceEndDate?: string | null
}

export type JobSchedulePayload = {
  job_type: JobType
  date: string | null
  start_time: string | null
  recurring_days: string[] | null
  is_active: boolean
  recurrence_start_date: string | null
  recurrence_end_date: string | null
}

export function buildSchedulePayload(input: JobScheduleInput): JobSchedulePayload {
  const startTime = input.startTime?.trim() || null

  if (!startTime) {
    throw new Error("Uhrzeit fehlt.")
  }

  if (input.jobType === "recurring") {
    const days = (input.recurringDays ?? []).filter(Boolean)
    if (days.length === 0) {
      throw new Error("Bitte mindestens einen Wochentag auswählen.")
    }
    if (!input.recurrenceStartDate) {
      throw new Error("Startdatum fehlt.")
    }
    return {
      job_type: "recurring",
      date: null,
      start_time: startTime,
      recurring_days: days,
      is_active: input.isActive ?? true,
      recurrence_start_date: input.recurrenceStartDate,
      recurrence_end_date: input.recurrenceEndDate ?? null,
    }
  }

  // single
  if (!input.date) {
    throw new Error("Datum fehlt.")
  }
  return {
    job_type: "single",
    date: input.date,
    start_time: startTime,
    recurring_days: null,
    is_active: true,
    recurrence_start_date: null,
    recurrence_end_date: null,
  }
}
