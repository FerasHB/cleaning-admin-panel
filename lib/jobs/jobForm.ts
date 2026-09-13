// lib/jobs/jobForm.ts
// Formularmodell für Auftrag anlegen/bearbeiten — Web-Pendant zu Mobiles
// features/jobs/hooks/useJobForm.ts (gleiche Felder, gleiche Validierung)
// und der Eingabe-Aufbereitung aus AdminScreen/EditJobScreen.

import { formatDateISO, formatTimeHHmm, formatToISO, normalizeTime } from "@/lib/date"
import type { WeekdayKey } from "@/lib/recurrence"
import type { JobInput, JobWithAssignments } from "@/lib/jobs/jobs.service"

export type JobFormValues = {
  customerName: string
  location: string
  service: string
  // Zuweisungsmenge. Leer = niemandem zugewiesen.
  employeeIds: string[]
  notes: string

  // ── Terminierung ──
  jobType: "single" | "recurring"
  // single: Wert eines <input type="datetime-local"> ("YYYY-MM-DDTHH:mm")
  dateTimeLocal: string
  // recurring: <input type="time"> ("HH:mm")
  time: string
  recurringDays: WeekdayKey[]
  isActive: boolean
  // recurring: Gültigkeitszeitraum ("YYYY-MM-DD"; Start Pflicht, Ende optional)
  recurrenceStartDate: string
  recurrenceEndDate: string
  // Geplante Dauer in Minuten als Rohtext (nur Ziffern), leer = keine Dauer.
  durationMinutes: string
}

export type JobFormErrors = Partial<Record<keyof JobFormValues, string>>

export const EMPTY_JOB_FORM: JobFormValues = {
  customerName: "",
  location: "",
  service: "",
  employeeIds: [],
  notes: "",
  jobType: "single",
  dateTimeLocal: "",
  time: "",
  recurringDays: [],
  isActive: true,
  recurrenceStartDate: "",
  recurrenceEndDate: "",
  durationMinutes: "",
}

// Validierung wie Mobiles useJobForm.validate().
export function validateJobForm(values: JobFormValues): JobFormErrors {
  const errors: JobFormErrors = {}

  if (!values.customerName.trim()) errors.customerName = "Kunde ist erforderlich."
  if (!values.location.trim()) errors.location = "Adresse ist erforderlich."
  if (!values.service.trim()) errors.service = "Service ist erforderlich."

  if (values.jobType === "single") {
    if (!values.dateTimeLocal) {
      errors.dateTimeLocal = "Bitte wähle Datum und Uhrzeit."
    }
  } else {
    if (values.recurringDays.length === 0) {
      errors.recurringDays = "Bitte wähle mindestens einen Wochentag."
    }
    if (!values.time) {
      errors.time = "Bitte wähle eine Uhrzeit."
    }
    if (!values.recurrenceStartDate) {
      errors.recurrenceStartDate = "Bitte wähle ein Startdatum."
    }
    if (
      values.recurrenceStartDate &&
      values.recurrenceEndDate &&
      values.recurrenceEndDate < values.recurrenceStartDate
    ) {
      errors.recurrenceEndDate = "Enddatum darf nicht vor dem Startdatum liegen."
    }
  }

  return errors
}

// Rohtext -> positive Ganzzahl oder null (wie AdminScreen/EditJobScreen).
function parseDuration(raw: string): number | null {
  const parsed = parseInt(raw, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

// Formularwerte -> Service-Eingabe, exakt wie Mobiles AdminScreen/EditJobScreen:
// single: date + startTime + scheduledStart aus EINEM lokalen Datum/Uhrzeit-Wert;
// recurring: startTime + Wochentage + Aktiv + Gültigkeitszeitraum, kein
// scheduledStart.
export function toJobInput(values: JobFormValues, employeeIds: string[]): JobInput {
  const base = {
    customerName: values.customerName.trim(),
    location: values.location.trim(),
    service: values.service.trim(),
    employeeIds,
    notes: values.notes.trim() || null,
    plannedDurationMinutes: parseDuration(values.durationMinutes),
  }

  if (values.jobType === "single") {
    const dt = values.dateTimeLocal ? new Date(values.dateTimeLocal) : null
    const valid = dt && !isNaN(dt.getTime()) ? dt : null
    return {
      ...base,
      jobType: "single",
      date: formatDateISO(valid),
      startTime: formatTimeHHmm(valid),
      scheduledStart: formatToISO(valid),
    }
  }

  return {
    ...base,
    jobType: "recurring",
    startTime: values.time || null,
    recurringDays: values.recurringDays,
    isActive: values.isActive,
    recurrenceStartDate: values.recurrenceStartDate || null,
    recurrenceEndDate: values.recurrenceEndDate || null,
    scheduledStart: null,
  }
}

// Lokalen "YYYY-MM-DDTHH:mm"-Wert für <input type="datetime-local"> aus einem
// ISO-Zeitstempel.
function isoToDateTimeLocal(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ""
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

// Zugewiesene LEBENDE Mitarbeiter-IDs (gelöschte Konten fallen heraus — sie
// können nicht erneut ausgewählt werden), wie Mobiles EditJobScreen.
export function assignedEmployeeIdsOf(job: Pick<JobWithAssignments, "assignments">): string[] {
  return (job.assignments ?? [])
    .map((a) => a.employee_id)
    .filter((id): id is string => !!id)
}

// Seed der Formularwerte aus einem bestehenden Auftrag.
//
// Abweichung zu Mobile NUR beim Seeden des Einzeltermins: Mobile seedet aus
// scheduled_start. Für generierte Termine berechnet generate_job_occurrences
// scheduled_start aber in der DB-Session-Zeitzone (UTC) — ein Seed daraus
// würde Uhrzeit/Datum um die Zeitzonen-Differenz verschieben und beim
// Speichern zurückschreiben. date + start_time sind die maßgeblichen Felder
// (gleiche Priorität wie getJobDisplayTime/isJobToday), scheduled_start ist
// nur Fallback für Alt-Daten ohne date/start_time. Die geschriebenen Felder
// sind identisch zu Mobile.
export function jobToFormValues(job: JobWithAssignments): JobFormValues {
  const startTime = normalizeTime(job.start_time)

  let dateTimeLocal = ""
  if (job.job_type !== "recurring") {
    if (job.date && startTime) {
      dateTimeLocal = `${job.date.slice(0, 10)}T${startTime}`
    } else if (job.scheduled_start) {
      dateTimeLocal = isoToDateTimeLocal(job.scheduled_start)
    }
  }

  return {
    customerName: job.customer_name ?? "",
    location: job.location_address ?? "",
    service: job.service_name ?? "",
    employeeIds: assignedEmployeeIdsOf(job),
    notes: job.notes ?? "",
    jobType: job.job_type === "recurring" ? "recurring" : "single",
    dateTimeLocal,
    time: job.job_type === "recurring" ? (startTime ?? "") : "",
    recurringDays: (job.recurring_days ?? []) as WeekdayKey[],
    isActive: job.is_active ?? true,
    recurrenceStartDate: job.recurrence_start_date ?? "",
    recurrenceEndDate: job.recurrence_end_date ?? "",
    durationMinutes:
      job.planned_duration_minutes != null ? String(job.planned_duration_minutes) : "",
  }
}

// Ordnungsunabhängiger Vergleich zweier ID-Mengen (wie Mobiles sameIdSet).
export function sameIdSet(a: string[], b: string[]): boolean {
  const normalize = (ids: string[]) => Array.from(new Set(ids)).sort()
  const na = normalize(a)
  const nb = normalize(b)
  return na.length === nb.length && na.every((id, i) => id === nb[i])
}

// Hat sich gegenüber dem Ausgangsstand etwas geändert? (Speichern-Button wie
// Mobile nur bei echten Änderungen aktiv.)
export function hasJobFormChanges(values: JobFormValues, baseline: JobFormValues): boolean {
  const { employeeIds, recurringDays, ...rest } = values
  const { employeeIds: baseIds, recurringDays: baseDays, ...baseRest } = baseline
  if (!sameIdSet(employeeIds, baseIds)) return true
  if (!sameIdSet(recurringDays, baseDays)) return true
  return (Object.keys(rest) as (keyof typeof rest)[]).some((k) => rest[k] !== baseRest[k])
}
