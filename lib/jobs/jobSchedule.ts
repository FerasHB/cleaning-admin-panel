// lib/jobs/jobSchedule.ts
// Terminierungs-Helfer für Web (snake_case-Row), portiert aus Mobiles
// utils/jobSchedule.ts. Beantwortet "heute fällig?" und liefert Anzeige-Zeit /
// Wochentags-Label — genutzt von Jobs-Liste, Dashboard und use-admin-jobs.
//
// Hinweis (bewusst wie Mobile): recurring Jobs sind Regeln, kein pro-Tag-Status.
// isJobToday() beantwortet nur "ist heute fällig?", nicht "heute erledigt?".

import { isSameLocalDate, normalizeTime } from "@/lib/date"
import { formatRecurringDays, isWeekdayInList } from "@/lib/recurrence"
import type { Database } from "@/lib/supabase/database.types"

type JobRow = Database["public"]["Tables"]["jobs"]["Row"]

// Vergleicht einen ISO-Zeitstempel mit dem Kalendertag von `ref` (lokal).
function isSameDayISO(iso: string | null | undefined, ref: Date): boolean {
  if (!iso) return false
  const d = new Date(iso)
  if (isNaN(d.getTime())) return false
  return (
    d.getFullYear() === ref.getFullYear() &&
    d.getMonth() === ref.getMonth() &&
    d.getDate() === ref.getDate()
  )
}

// Extrahiert "HH:mm" (lokal) aus einem ISO-Zeitstempel.
function timeFromISO(iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (isNaN(d.getTime())) return null
  const h = String(d.getHours()).padStart(2, "0")
  const m = String(d.getMinutes()).padStart(2, "0")
  return `${h}:${m}`
}

/**
 * Ist dieser Job heute fällig?
 * - nur aktive Jobs (is_active !== false)
 * - single:    date == heute (Fallback: scheduled_start == heute, für Alt-Daten)
 * - recurring: heutiger Wochentag in recurring_days enthalten
 */
export function isJobToday(job: JobRow, ref: Date = new Date()): boolean {
  if (job.is_active === false) return false

  if (job.job_type === "recurring") {
    return isWeekdayInList(ref, job.recurring_days)
  }

  // single
  if (job.date) return isSameLocalDate(job.date, ref)
  return isSameDayISO(job.scheduled_start, ref)
}

/**
 * Anzeige-Uhrzeit "HH:mm": bevorzugt das strukturierte start_time,
 * sonst Fallback auf scheduled_start (Alt-Daten / single ohne start_time).
 */
export function getJobDisplayTime(job: JobRow): string | null {
  return normalizeTime(job.start_time) ?? timeFromISO(job.scheduled_start)
}

/**
 * Lesbares Wochentags-Label für recurring Jobs ("Mo, Do").
 * Für single Jobs leerer String.
 */
export function getRecurringDaysLabel(job: JobRow): string {
  if (job.job_type !== "recurring") return ""
  return formatRecurringDays(job.recurring_days)
}
