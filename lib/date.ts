// lib/date.ts
// Datums-/Zeit-Helfer (aus der Mobile-App portiert, RN-frei).
// Single-Job-Felder werden bewusst identisch zu Mobile abgeleitet, damit Web
// und Mobile dieselben Werte schreiben: date = lokales "YYYY-MM-DD",
// start_time = lokales "HH:mm", scheduled_start = UTC-ISO desselben Zeitpunkts.

export function formatToISO(date: Date | string | null | undefined): string | null {
  if (!date) return null
  const d = new Date(date)
  if (isNaN(d.getTime())) return null
  return d.toISOString()
}

export function formatTimeHHmm(date: Date | null | undefined): string | null {
  if (!date) return null
  const d = new Date(date)
  if (isNaN(d.getTime())) return null
  const hours = String(d.getHours()).padStart(2, "0")
  const minutes = String(d.getMinutes()).padStart(2, "0")
  return `${hours}:${minutes}`
}

export function formatDateISO(date: Date | null | undefined): string | null {
  if (!date) return null
  const d = new Date(date)
  if (isNaN(d.getTime())) return null
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

/** Normalisiert eine DB-Zeit ("HH:mm:ss" oder "HH:mm") auf "HH:mm". */
export function normalizeTime(time: string | null | undefined): string | null {
  if (!time) return null
  return time.slice(0, 5)
}

/** Prüft, ob ein "YYYY-MM-DD"-String dem lokalen Datum von `ref` entspricht. */
export function isSameLocalDate(
  dateString: string | null | undefined,
  ref: Date,
): boolean {
  if (!dateString) return false
  return formatDateISO(ref) === dateString.slice(0, 10)
}
