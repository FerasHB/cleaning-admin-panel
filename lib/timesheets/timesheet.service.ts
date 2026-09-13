// lib/timesheets/timesheet.service.ts
// Stundenzettel-Operationen: Laden der abgeschlossenen Jobs eines Mitarbeiters
// für einen Monat. 1:1-Port von Mobiles services/timesheets/timesheet.service.ts
// (mapEntry/mapGap/getTimesheet) — gleiche Filter, gleiche Ableitungsregeln,
// gleiche Summe. PDF-Export ist ein separates Modul (lib/timesheets/timesheetHtml.ts),
// da Mobiles expo-print/expo-sharing auf Web nicht existieren.
//
// Quelle ist job_assignments (Phase 2, Worked Time) — keine eigene
// Timesheet-Tabelle, keine RPC. Lesezugriff ist durch dieselben RLS-Policies
// abgesichert, die Job Detail/Time Correction bereits nutzen ("admin read
// assignments in own company").
//
// WARUM job_assignments STATT jobs (die GETEILTE Job-Uhr):
// Bei mehreren Zugewiesenen ist die geteilte Uhr für den Stundenzettel nicht
// aussagekräftig — zwei Mitarbeiter hätten dieselbe Auftragsdauer, obwohl sie
// unterschiedlich lange vor Ort waren. Seit Phase 1 (Migration
// 20260812000000) pflegen start_own_job/complete_own_job zusätzlich die
// EIGENE Zuweisungszeile jedes Mitarbeiters (employee_started_at/
// employee_completed_at). Der Stundenzettel liest genau diese Werte.
//
// RÜCKWÄRTSKOMPATIBILITÄT (siehe mapEntry/isLegacyJob unten):
// Zuweisungszeilen aus der Zeit VOR Phase 1 haben employee_started_at/
// employee_completed_at = null — für SOLCHE Jobs ist der Fallback auf die
// geteilte Job-Uhr (jobs.started_at/completed_at) weiterhin richtig, weil es
// schlicht keine andere Datenquelle gibt.
//
// Für Jobs, die ERST NACH Phase 1 abgeschlossen wurden, ist ein fehlendes
// eigenes Zeitpaar dagegen KEINE Datenlücke, sondern eine Tatsachenaussage:
// die Übergabe wurde von diesem Mitarbeiter nie selbst ausgelöst (z. B. bei
// einem Mehrfach-Auftrag: ein Kollege hat gestartet/abgeschlossen, DIESER
// Mitarbeiter nie). Auf die geteilte Uhr zurückzufallen würde ihm fälschlich
// die volle Auftragsdauer als bezahlte Arbeitszeit gutschreiben — genau das
// darf nicht passieren. Solche Zeilen werden deshalb NICHT angezeigt (kein
// 0:00-Eintrag, kein Fallback), siehe mapEntry.

import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/database.types"
import { diffInMinutes, formatDateISO, formatDurationHm, formatTimeHHmm } from "@/lib/date"
import { isLegacyJob } from "@/lib/jobs/jobCorrection"
import { buildTimesheetAbsence } from "@/lib/timesheets/timesheetAbsence.service"
import type { TimesheetAbsenceSummary, TimesheetNotice } from "@/lib/timesheets/timesheetAbsence.service"

type DB = SupabaseClient<Database>

/**
 * Eine Zeile im Stundenzettel = ein abgeschlossener Job.
 * Mehrere Jobs am selben Tag ergeben mehrere Einträge (mehrere Zeilen).
 */
export type TimesheetEntry = {
  jobId: string
  /** Lokaler Arbeitstag "YYYY-MM-DD", abgeleitet aus dem verwendeten Start. */
  date: string
  /** Beginn als lokale Uhrzeit "HH:mm". */
  beginLabel: string
  /** Ende als lokale Uhrzeit "HH:mm". */
  endLabel: string
  /** Dauer in Minuten (Ende − Beginn, ≥ 0). */
  durationMinutes: number
  /** Dauer formatiert als "H:mm". */
  durationLabel: string
  /** Auftrag/Kunde (customer_name). */
  customerName: string
  /** Bemerkung: Service ggf. mit Ort. */
  remark: string
}

/** Warum eine Zuweisung KEINEN abrechenbaren Eintrag erzeugt. */
export type TimesheetGapReason = "no_time" | "start_only" | "end_only"

/**
 * Eine Zuweisung, die im gewählten Monat KEINEN Stundenzettel-Eintrag ergibt,
 * obwohl der Auftrag abgeschlossen ist (Phase B1-Äquivalent von Mobile).
 *
 * WICHTIG: `sharedStartedAt`/`sharedCompletedAt` sind die GETEILTE Auftragszeit
 * und ausschließlich ein VORSCHLAG für die Korrektur (siehe TimeCorrectionPanel).
 * Sie sind NICHT die Arbeitszeit dieses Mitarbeiters und dürfen nirgends als
 * solche angezeigt oder summiert werden.
 */
export type TimesheetGap = {
  /** PK der job_assignments-Zeile — Eingabe für admin_correct_assignment_time. */
  assignmentId: string
  employeeId: string
  employeeName: string
  jobId: string
  customerName: string
  remark: string
  /** Arbeitstag "YYYY-MM-DD", abgeleitet aus der GETEILTEN Startzeit. */
  date: string
  /** Aktuell erfasste Eigenzeit (mindestens eine davon ist null). */
  employeeStartedAt: string | null
  employeeCompletedAt: string | null
  /** Geteilte Auftragszeit — NUR Korrektur-Vorschlag, nie Arbeitszeit. */
  sharedStartedAt: string
  sharedCompletedAt: string
  reason: TimesheetGapReason
  /** Lesbare Kurzbeschreibung des Problems (deutsch). */
  reasonLabel: string
}

/** Vollständiger Stundenzettel für einen Mitarbeiter + Monat. */
export type TimesheetData = {
  companyName: string
  employeeId: string
  employeeName: string
  year: number
  month: number
  /** Anzeige z.B. "Juni 2026". */
  monthLabel: string
  entries: TimesheetEntry[]
  /** Summe aller Dauern in Minuten. */
  totalMinutes: number
  totalLabel: string
  /** Anzahl abgeschlossener Jobs (= Anzahl Einträge). */
  jobCount: number
  /**
   * Zuweisungen im Zeitraum, die KEINEN Eintrag erzeugen konnten. Fließen
   * bewusst NICHT in `entries`, `totalMinutes` oder den PDF-Export ein — sie
   * sind nicht abrechenbar, solange sie nicht korrigiert wurden.
   */
  needsAttention: TimesheetGap[]
  /** Abwesenheits-Zusammenfassung (Urlaub/Krankheit). ADDITIV. */
  absenceSummary: TimesheetAbsenceSummary
  /** Informative Hinweise (z. B. "Arbeit trotz Abwesenheit"). */
  notices: TimesheetNotice[]
}

// So sieht eine für den Stundenzettel benötigte job_assignments-Zeile
// (inkl. eingebettetem Job `j`) aus der DB aus.
type TimesheetAssignmentRow = {
  id: string
  employee_started_at: string | null
  employee_completed_at: string | null
  j: {
    id: string
    customer_name: string
    service_name: string
    location_address: string
    started_at: string
    completed_at: string
  }
}

const JOB_EMBED = `,j:jobs!inner(id,customer_name,service_name,location_address,started_at,completed_at)`

function buildRemark(service: string | null, location: string | null): string {
  const parts = [service?.trim(), location?.trim()].filter((part): part is string => !!part)
  return parts.join(" · ")
}

/**
 * Wandelt eine job_assignments-Zeile in einen Stundenzettel-Eintrag um, oder
 * in `null`, wenn für diesen Mitarbeiter/Auftrag KEINE belastbare Dauer
 * existiert.
 *
 * QUELLE PRO ZEILE, in dieser Reihenfolge:
 *   1. Eigene Zeit (employee_started_at/completed_at), wenn BEIDE gesetzt
 *      sind — unabhängig vom Cutoff. Kein Mischen einzelner Werte.
 *   2. Fehlt das eigene Paar UND der Auftrag wurde VOR Phase 1 abgeschlossen
 *      (isLegacyJob): Fallback auf die geteilte Job-Uhr.
 *   3. Fehlt das eigene Paar bei einem Auftrag NACH Phase 1: KEIN Eintrag.
 */
function mapEntry(row: TimesheetAssignmentRow): TimesheetEntry | null {
  const hasOwnTimes = !!row.employee_started_at && !!row.employee_completed_at

  let startIso: string
  let endIso: string

  if (hasOwnTimes) {
    startIso = row.employee_started_at!
    endIso = row.employee_completed_at!
  } else if (isLegacyJob(row.j.completed_at)) {
    startIso = row.j.started_at
    endIso = row.j.completed_at
  } else {
    return null
  }

  const startedAt = new Date(startIso)
  const durationMinutes = diffInMinutes(startIso, endIso)

  return {
    jobId: row.j.id,
    date: formatDateISO(startedAt) ?? startIso.slice(0, 10),
    beginLabel: formatTimeHHmm(startedAt) ?? "--:--",
    endLabel: formatTimeHHmm(new Date(endIso)) ?? "--:--",
    durationMinutes,
    durationLabel: formatDurationHm(durationMinutes),
    customerName: row.j.customer_name,
    remark: buildRemark(row.j.service_name, row.j.location_address),
  }
}

const GAP_LABELS: Record<TimesheetGapReason, string> = {
  no_time: "Keine eigene Zeit erfasst",
  start_only: "Beginn erfasst, Abschluss fehlt",
  end_only: "Abschluss erfasst, Beginn fehlt",
}

/**
 * Wandelt eine Zeile, die KEINEN Eintrag ergibt, in einen Korrektur-Hinweis
 * um. Gibt `null` zurück, wenn die Zeile abrechenbar ist — exakte Umkehrung
 * von `mapEntry`, ohne dessen Logik zu duplizieren:
 *
 *   mapEntry != null  → abrechenbar        → KEINE Lücke
 *   mapEntry == null  → nicht abrechenbar  → Lücke
 */
function mapGap(row: TimesheetAssignmentRow, employeeId: string, employeeName: string): TimesheetGap | null {
  const hasStart = !!row.employee_started_at
  const hasEnd = !!row.employee_completed_at

  if (hasStart && hasEnd) return null
  if (isLegacyJob(row.j.completed_at)) return null

  const reason: TimesheetGapReason = hasStart ? "start_only" : hasEnd ? "end_only" : "no_time"
  const startedAt = new Date(row.j.started_at)

  return {
    assignmentId: row.id,
    employeeId,
    employeeName,
    jobId: row.j.id,
    customerName: row.j.customer_name,
    remark: buildRemark(row.j.service_name, row.j.location_address),
    date: formatDateISO(startedAt) ?? row.j.started_at.slice(0, 10),
    employeeStartedAt: row.employee_started_at,
    employeeCompletedAt: row.employee_completed_at,
    sharedStartedAt: row.j.started_at,
    sharedCompletedAt: row.j.completed_at,
    reason,
    reasonLabel: GAP_LABELS[reason],
  }
}

/**
 * Lädt die abgeschlossenen Zuweisungen eines Mitarbeiters für einen Monat und
 * baut daraus den vollständigen Stundenzettel.
 *
 * Filter (alle serverseitig):
 *  - job_assignments.employee_id = der gewählte Mitarbeiter
 *  - j.status = 'completed'
 *  - j.job_type = 'single' (schließt Recurring-Parent-Regeln aus)
 *  - j.started_at / j.completed_at vorhanden
 *  - Arbeitstag (j.started_at, lokal) im gewählten Monat
 *
 * Bewusst NICHT gefiltert (wie Mobile): counts_for_timesheet, attendance,
 * review, profiles.is_active — historische Stundenzettel müssen auch für
 * inzwischen deaktivierte Mitarbeiter abrufbar bleiben.
 *
 * @param year   z.B. 2026
 * @param month  1–12
 */
export async function getTimesheet(
  supabase: DB,
  params: {
    companyName: string
    employeeId: string
    employeeName: string
    year: number
    month: number
  },
): Promise<TimesheetData> {
  const { companyName, employeeId, employeeName, year, month } = params

  const monthStart = new Date(year, month - 1, 1, 0, 0, 0, 0)
  const nextMonthStart = new Date(year, month, 1, 0, 0, 0, 0)

  const { data, error } = await supabase
    .from("job_assignments")
    .select(`id,employee_started_at,employee_completed_at` + JOB_EMBED)
    .eq("employee_id", employeeId)
    .eq("j.status", "completed")
    .eq("j.job_type", "single")
    .not("j.started_at", "is", null)
    .not("j.completed_at", "is", null)
    .gte("j.started_at", monthStart.toISOString())
    .lt("j.started_at", nextMonthStart.toISOString())

  if (error) throw error

  const rows = (data ?? []) as unknown as TimesheetAssignmentRow[]

  const entries = rows
    .map((row) => mapEntry(row))
    .filter((entry): entry is TimesheetEntry => entry !== null)
    .sort((a, b) => (a.date + a.beginLabel < b.date + b.beginLabel ? -1 : a.date + a.beginLabel > b.date + b.beginLabel ? 1 : 0))

  const needsAttention = rows
    .map((row) => mapGap(row, employeeId, employeeName))
    .filter((gap): gap is TimesheetGap => gap !== null)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))

  const totalMinutes = entries.reduce((sum, e) => sum + e.durationMinutes, 0)

  const monthLabel = monthStart.toLocaleDateString("de-DE", { month: "long", year: "numeric" })

  // ── Abwesenheiten ─────────────────────────────────────────────────────
  // Vollständig ADDITIV und von der obigen Ist-Zeit-Berechnung entkoppelt.
  const monthStartKey = formatDateISO(monthStart)!
  const monthEndKey = formatDateISO(new Date(year, month, 0))!

  const { summary: absenceSummary, notices } = await buildTimesheetAbsence(supabase, {
    employeeId,
    from: monthStartKey,
    to: monthEndKey,
    entries,
  })

  return {
    companyName,
    employeeId,
    employeeName,
    year,
    month,
    monthLabel,
    entries,
    totalMinutes,
    totalLabel: formatDurationHm(totalMinutes),
    jobCount: entries.length,
    needsAttention,
    absenceSummary,
    notices,
  }
}
