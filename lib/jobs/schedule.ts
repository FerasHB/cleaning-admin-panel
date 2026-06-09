// lib/jobs/schedule.ts
// Baut das Schedule-Payload (snake_case) für die jobs-Tabelle — Spiegel von
// Mobiles buildSchedulePayload, zusätzlich mit scheduled_start. Wirft bei
// ungültiger Kombination (wie Mobile), damit das Web dieselbe Validierung hat.
//
// single:    date + start_time + scheduled_start gesetzt, recurring_days null
// recurring: recurring_days + start_time + is_active gesetzt, scheduled_start null

import { formatDateISO, formatTimeHHmm, formatToISO } from "@/lib/date"
import type { WeekdayKey } from "@/lib/recurrence"

export type JobScheduleInput =
  | { jobType: "single"; dateTimeLocal: string }
  | {
      jobType: "recurring"
      recurringDays: WeekdayKey[]
      time: string
      isActive: boolean
    }

export type JobSchedulePayload = {
  job_type: "single" | "recurring"
  date: string | null
  start_time: string | null
  recurring_days: string[] | null
  is_active: boolean
  scheduled_start: string | null
}

export function buildJobSchedulePayload(
  input: JobScheduleInput,
): JobSchedulePayload {
  if (input.jobType === "recurring") {
    const days = (input.recurringDays ?? []).filter(Boolean)
    if (days.length === 0) {
      throw new Error("Bitte mindestens einen Wochentag auswählen.")
    }
    const startTime = input.time?.trim()
    if (!startTime) {
      throw new Error("Bitte eine Uhrzeit wählen.")
    }
    return {
      job_type: "recurring",
      date: null,
      start_time: startTime,
      recurring_days: days,
      // recurring darf inaktiv sein; Default true
      is_active: input.isActive ?? true,
      scheduled_start: null,
    }
  }

  // single
  const dt = input.dateTimeLocal?.trim()
  if (!dt) {
    throw new Error("Bitte Datum und Uhrzeit wählen.")
  }
  const parsed = new Date(dt)
  if (isNaN(parsed.getTime())) {
    throw new Error("Ungültiges Datum bzw. ungültige Uhrzeit.")
  }
  return {
    job_type: "single",
    date: formatDateISO(parsed),
    start_time: formatTimeHHmm(parsed),
    recurring_days: null,
    // einmalige Aufträge sind immer aktiv
    is_active: true,
    scheduled_start: formatToISO(parsed),
  }
}
