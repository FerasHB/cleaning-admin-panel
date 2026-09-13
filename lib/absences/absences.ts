// lib/absences/absences.ts
// Absence read/write access for the Web Admin Panel — port of Mobile's
// services/absences/{absences,adminAbsences}.service.ts. Web is admin-only
// (employees use the Mobile app), so this covers only the admin-facing
// surface: company-wide listing, per-employee history, and the vacation
// approve/reject + admin-backfill RPCs. There is deliberately no
// request/report/cancel-own-absence code here — those are employee-only
// flows that stay on Mobile.
//
// Every write goes through the same SECURITY DEFINER RPCs Mobile uses.
// employee_absences/vacation_years/vacation_ledger/absence_evidence have
// SELECT-only RLS policies — there is no other way to write these tables.

import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/database.types"
import { toFriendlyAuthErrorMessage } from "@/lib/auth/authErrorMessages"

type DB = SupabaseClient<Database>

export type AbsenceType = Database["public"]["Enums"]["absence_type"]
export type AbsenceStatus = Database["public"]["Enums"]["absence_status"]
export type AuEvidenceStatus = Database["public"]["Enums"]["au_evidence_status"]

export type Absence = {
  id: string
  companyId: string
  employeeId: string | null
  employeeName: string
  type: AbsenceType
  status: AbsenceStatus
  /** "YYYY-MM-DD" */
  startDate: string
  /** "YYYY-MM-DD", null only for an open-ended sickness report */
  endDate: string | null
  employeeNote: string | null
  adminNote: string | null
  createdBy: string | null
  reviewedBy: string | null
  reviewedAt: string | null
  createdAt: string
  updatedAt: string
  vacationDeductedDaysSnapshot: number | null
}

type AbsenceRow = Database["public"]["Tables"]["employee_absences"]["Row"]

export const ABSENCE_SELECT =
  "id, company_id, employee_id, employee_name_snapshot, type, status, start_date, end_date, employee_note, admin_note, created_by, reviewed_by, reviewed_at, created_at, updated_at, vacation_deducted_days_snapshot"

export function mapAbsence(row: AbsenceRow): Absence {
  return {
    id: row.id,
    companyId: row.company_id,
    employeeId: row.employee_id,
    employeeName: row.employee_name_snapshot,
    type: row.type,
    status: row.status,
    startDate: row.start_date,
    endDate: row.end_date,
    employeeNote: row.employee_note,
    adminNote: row.admin_note,
    createdBy: row.created_by,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    vacationDeductedDaysSnapshot:
      row.vacation_deducted_days_snapshot == null ? null : Number(row.vacation_deducted_days_snapshot),
  }
}

// ── Active-absence rule (single source of truth for this feature) ──────────
// Exactly Mobile's ACTIVE_ABSENCE_FILTER_OR / isOperationallyActiveAbsence:
// only approved vacation or reported sickness. A requested, rejected, or
// cancelled absence is NEVER active, regardless of its dates.
export const ACTIVE_ABSENCE_FILTER_OR =
  "and(type.eq.vacation,status.eq.approved),and(type.eq.sickness,status.eq.reported)"

export function isActiveAbsence(absence: Pick<Absence, "type" | "status">): boolean {
  return (
    (absence.type === "vacation" && absence.status === "approved") ||
    (absence.type === "sickness" && absence.status === "reported")
  )
}

export function isPendingVacation(absence: Pick<Absence, "type" | "status">): boolean {
  return absence.type === "vacation" && absence.status === "requested"
}

// ── Error messages ───────────────────────────────────────────────────────────
// Same substring-match translation Mobile uses (RPC_MESSAGE_MAP +
// ADMIN_RPC_MESSAGE_MAP merged), most-specific first. Never show a raw
// Postgres/PostgREST message to the admin.
const RPC_MESSAGE_MAP: { match: RegExp; message: string }[] = [
  { match: /Overlaps an existing vacation request/i, message: "Dieser Zeitraum überschneidet sich mit einem bereits bestehenden Urlaubsantrag." },
  { match: /Overlaps an existing active sickness report/i, message: "Dieser Zeitraum überschneidet sich mit einer bereits aktiven Krankmeldung." },
  { match: /end_date must not be before start_date/i, message: "Das Enddatum darf nicht vor dem Startdatum liegen." },
  { match: /end_date is required for vacation/i, message: "Bitte ein Enddatum für den Urlaub angeben." },
  { match: /start_date and end_date are required/i, message: "Bitte Von- und Bis-Datum angeben." },
  { match: /start_date is required/i, message: "Bitte ein Startdatum angeben." },
  { match: /Vacation not found, not yours, or no longer cancellable/i, message: "Dieser Urlaub kann nicht mehr storniert werden." },
  { match: /Sickness report not found, not yours, or already closed/i, message: "Diese Krankmeldung wurde nicht gefunden oder ist bereits abgeschlossen." },
  { match: /Only employees can request their own vacation/i, message: "Nur Mitarbeiter können Urlaub beantragen." },
  { match: /Only admins can review vacation requests/i, message: "Nur Admins können Urlaubsanträge bearbeiten." },
  { match: /Vacation request not found, not in your company, or already reviewed/i, message: "Dieser Antrag wurde bereits bearbeitet oder ist nicht mehr verfügbar." },
  { match: /Employee not found in your company/i, message: "Dieser Mitarbeiter wurde nicht gefunden." },
  { match: /decision must be/i, message: "Ungültige Entscheidung." },
  { match: /Vacation accounting is enabled for this employee: a confirmed deduction per year is required/i, message: "Für diesen Mitarbeiter wird ein Urlaubskonto geführt — bitte die Abzugstage je Jahr angeben." },
  { match: /is outside the vacation range/i, message: "Das angegebene Jahr liegt außerhalb des Urlaubszeitraums." },
  { match: /is not initialized for this employee/i, message: "Für dieses Jahr wurde noch kein Urlaubskonto angelegt." },
  { match: /Vacation management is disabled for this employee/i, message: "Für diesen Mitarbeiter ist kein Urlaubskonto aktiv." },
  { match: /No annual entitlement configured/i, message: "Es ist kein Jahresanspruch hinterlegt (weder individuell noch als Firmen-Standard)." },
  { match: /Adjustment amount must be a non-zero number/i, message: "Bitte einen Korrekturwert ungleich null angeben." },
  { match: /A reason is required for a manual adjustment/i, message: "Bitte einen Grund für die Korrektur angeben." },
  { match: /This sickness report already led to restored vacation days/i, message: "Für diese Krankmeldung wurden bereits Urlaubstage zurückgegeben — bitte den Admin kontaktieren." },
  { match: /Only sickness absences can carry an AU/i, message: "Nur Krankmeldungen können eine Arbeitsunfähigkeit tragen." },
  { match: /A cancelled sickness report cannot be reviewed/i, message: "Eine stornierte Krankmeldung kann nicht geprüft werden." },
  { match: /This AU already has posted vacation restorations and can no longer be changed/i, message: "Für diese AU wurden bereits Urlaubstage zurückgegeben — sie kann nicht mehr geändert werden. Bitte das Urlaubskonto manuell korrigieren." },
  { match: /Only admins can review an AU/i, message: "Nur Admins können eine AU prüfen." },
  { match: /Sickness report not found or not in your company/i, message: "Diese Krankmeldung wurde nicht gefunden." },
  { match: /Only admins can inspect restoration candidates/i, message: "Nur Admins können Rückgabe-Kandidaten einsehen." },
  { match: /Evidence not found or not in your company/i, message: "Dieser AU-Nachweis wurde nicht gefunden." },
  { match: /Vacation can only be restored for a CONFIRMED AU/i, message: "Urlaub kann nur bei einer bestätigten AU zurückgegeben werden." },
  { match: /The sickness report was cancelled/i, message: "Diese Krankmeldung wurde storniert." },
  { match: /At least one restoration item is required/i, message: "Bitte mindestens einen Posten angeben." },
  { match: /Restoration days must be greater than 0/i, message: "Die Anzahl der Tage muss größer als 0 sein." },
  { match: /Vacation year \d+ is not initialized/i, message: "Für dieses Urlaubsjahr wurde noch kein Urlaubskonto angelegt." },
  { match: /No approved vacation deduction found for this vacation\/year/i, message: "Für diesen Urlaub und dieses Jahr wurde kein Abzug gefunden." },
  { match: /Vacation does not overlap the sickness period/i, message: "Dieser Urlaub überschneidet sich nicht mit der Krankmeldung." },
  { match: /Restoration exceeds the original deduction/i, message: "Die Rückgabe übersteigt den ursprünglichen Abzug." },
  { match: /Only admins can restore vacation days/i, message: "Nur Admins können Urlaubstage zurückgeben." },
]

function num(value: unknown): number {
  return typeof value === "number" ? value : Number(value ?? 0)
}

export function toAbsenceMessage(err: unknown, fallback: string): string {
  const message =
    err && typeof err === "object" && typeof (err as { message?: unknown }).message === "string"
      ? (err as { message: string }).message
      : ""
  for (const { match, message: friendly } of RPC_MESSAGE_MAP) {
    if (match.test(message)) return friendly
  }
  return toFriendlyAuthErrorMessage(err, fallback)
}

// ── Grouping (employee detail — current/upcoming/past) ──────────────────────
// Exactly Mobile's utils/absenceGrouping.ts: cancelled/rejected always
// "past" regardless of date; then by end/start date relative to today.
export type AbsenceGroup = "current" | "upcoming" | "past"

export function groupAbsence(absence: Absence, todayKey: string): AbsenceGroup {
  if (absence.status === "cancelled" || absence.status === "rejected") return "past"
  if (absence.endDate !== null && absence.endDate < todayKey) return "past"
  if (absence.startDate <= todayKey) return "current"
  return "upcoming"
}

export function groupAbsences(
  absences: Absence[],
  todayKey: string,
): { current: Absence[]; upcoming: Absence[]; past: Absence[] } {
  const current: Absence[] = []
  const upcoming: Absence[] = []
  const past: Absence[] = []
  for (const a of absences) {
    const group = groupAbsence(a, todayKey)
    if (group === "current") current.push(a)
    else if (group === "upcoming") upcoming.push(a)
    else past.push(a)
  }
  current.sort((a, b) => a.startDate.localeCompare(b.startDate))
  upcoming.sort((a, b) => a.startDate.localeCompare(b.startDate))
  past.sort((a, b) => b.startDate.localeCompare(a.startDate))
  return { current, upcoming, past }
}

// ── Read paths ────────────────────────────────────────────────────────────

// Company-wide, active-today only (approved vacation / reported sickness) —
// wie Mobiles getCurrentCompanyAbsences, treibt den Dashboard-Chip und die
// "Abwesend"-Tab.
export async function getCurrentCompanyAbsences(supabase: DB, todayKey: string): Promise<Absence[]> {
  const { data, error } = await supabase
    .from("employee_absences")
    .select(ABSENCE_SELECT)
    .or(ACTIVE_ABSENCE_FILTER_OR)
    .lte("start_date", todayKey)
    .or(`end_date.is.null,end_date.gte.${todayKey}`)
    .order("start_date", { ascending: true })

  if (error) throw error
  return (data ?? []).map((row) => mapAbsence(row as AbsenceRow))
}

// type='vacation' AND status='requested', oldest first (FIFO-Warteschlange).
export async function getPendingVacationRequests(supabase: DB): Promise<Absence[]> {
  const { data, error } = await supabase
    .from("employee_absences")
    .select(ABSENCE_SELECT)
    .eq("type", "vacation")
    .eq("status", "requested")
    .order("created_at", { ascending: true })

  if (error) throw error
  return (data ?? []).map((row) => mapAbsence(row as AbsenceRow))
}

// count-only, für den Dashboard-Chip.
export async function getPendingVacationCount(supabase: DB): Promise<number> {
  const { count, error } = await supabase
    .from("employee_absences")
    .select("id", { count: "exact", head: true })
    .eq("type", "vacation")
    .eq("status", "requested")

  if (error) throw error
  return count ?? 0
}

// aktive + kürzlich stornierte Krankmeldungen, read-only (keine Genehmigung).
export async function getSicknessReports(supabase: DB): Promise<Absence[]> {
  const { data, error } = await supabase
    .from("employee_absences")
    .select(ABSENCE_SELECT)
    .eq("type", "sickness")
    .in("status", ["reported", "cancelled"])
    .order("start_date", { ascending: false })

  if (error) throw error
  return (data ?? []).map((row) => mapAbsence(row as AbsenceRow))
}

// Alle Abwesenheiten eines Mitarbeiters (RLS-scoped) — wie Mobiles
// getEmployeeAbsences, NICHT durch is_active gefiltert (auch für inzwischen
// deaktivierte Mitarbeiter sichtbar).
export async function getEmployeeAbsences(supabase: DB, employeeId: string): Promise<Absence[]> {
  const { data, error } = await supabase
    .from("employee_absences")
    .select(ABSENCE_SELECT)
    .eq("employee_id", employeeId)
    .order("start_date", { ascending: false })

  if (error) throw error
  return (data ?? []).map((row) => mapAbsence(row as AbsenceRow))
}

// Abwesenheiten eines Mitarbeiters, die einen Zeitraum ÜBERSCHNEIDEN (nicht
// nur darin beginnen) — wie Mobiles getEmployeeAbsencesInRange. Für den
// Stundenzettel: eine offene Krankmeldung (end_date = null) deckt jeden
// Folgetag ab, muss also auch dann gefunden werden, wenn sie vor `from`
// begann.
export async function getEmployeeAbsencesInRange(
  supabase: DB,
  params: { employeeId: string; from: string; to: string },
): Promise<Absence[]> {
  const { data, error } = await supabase
    .from("employee_absences")
    .select(ABSENCE_SELECT)
    .eq("employee_id", params.employeeId)
    .lte("start_date", params.to)
    .or(`end_date.is.null,end_date.gte.${params.from}`)
    .order("start_date", { ascending: true })

  if (error) throw error
  return (data ?? []).map((row) => mapAbsence(row as AbsenceRow))
}

// Einzelne Abwesenheit per id (AU-Prüfseite) — RLS-scoped wie jede andere Lesung.
export async function getAbsenceById(supabase: DB, absenceId: string): Promise<Absence | null> {
  const { data, error } = await supabase
    .from("employee_absences")
    .select(ABSENCE_SELECT)
    .eq("id", absenceId)
    .maybeSingle()

  if (error) throw error
  return data ? mapAbsence(data as AbsenceRow) : null
}

// AU-Beleg-Status (read-only Anzeige, keine Prüf-Aktionen in diesem PR).
export type AbsenceEvidence = {
  id: string
  absenceId: string
  status: AuEvidenceStatus
  submittedAt: string
  confirmedBy: string | null
  confirmedAt: string | null
  note: string | null
}

export async function getAbsenceEvidenceMap(
  supabase: DB,
  absenceIds: string[],
): Promise<Map<string, AbsenceEvidence>> {
  const uniqueIds = Array.from(new Set(absenceIds))
  if (uniqueIds.length === 0) return new Map()

  const { data, error } = await supabase
    .from("absence_evidence")
    .select("id, absence_id, status, submitted_at, confirmed_by, confirmed_at, note")
    .in("absence_id", uniqueIds)

  if (error) throw error
  const map = new Map<string, AbsenceEvidence>()
  for (const row of data ?? []) {
    map.set(row.absence_id, {
      id: row.id,
      absenceId: row.absence_id,
      status: row.status,
      submittedAt: row.submitted_at,
      confirmedBy: row.confirmed_by,
      confirmedAt: row.confirmed_at,
      note: row.note,
    })
  }
  return map
}

export const AU_STATUS_LABEL: Record<AuEvidenceStatus, string> = {
  pending: "AU offen",
  confirmed: "AU bestätigt",
  rejected: "AU abgelehnt",
}

// Einzelner Beleg zu genau einer Krankmeldung — für die AU-Prüfseite, die
// nach jeder Aktion neu lädt (kein Refetch der ganzen Liste nötig).
export async function getAbsenceEvidence(supabase: DB, absenceId: string): Promise<AbsenceEvidence | null> {
  const { data, error } = await supabase
    .from("absence_evidence")
    .select("id, absence_id, status, submitted_at, confirmed_by, confirmed_at, note")
    .eq("absence_id", absenceId)
    .maybeSingle()

  if (error) throw error
  if (!data) return null
  return {
    id: data.id,
    absenceId: data.absence_id,
    status: data.status,
    submittedAt: data.submitted_at,
    confirmedBy: data.confirmed_by,
    confirmedAt: data.confirmed_at,
    note: data.note,
  }
}

// ── Write paths (RPC only) ──────────────────────────────────────────────────

// admin_review_vacation(absence_id, decision, admin_note?, p_deductions?).
// decision: "approved" | "rejected". p_deductions: { "2026": 2, "2027": 3 } —
// nur bei Genehmigung UND aktivem Urlaubskonto des Mitarbeiters Pflicht (die
// RPC selbst entscheidet und lehnt sonst ab).
export async function reviewVacation(
  supabase: DB,
  absenceId: string,
  decision: "approved" | "rejected",
  adminNote?: string,
  deductions?: Record<string, number>,
): Promise<Absence> {
  const { data, error } = await supabase.rpc("admin_review_vacation", {
    absence_id_input: absenceId,
    decision_input: decision,
    admin_note_input: adminNote?.trim() ? adminNote.trim() : undefined,
    p_deductions: deductions && Object.keys(deductions).length > 0 ? deductions : undefined,
  })

  if (error) throw error
  const row = Array.isArray(data) ? data[0] : data
  if (!row) throw new Error("Urlaubsantrag konnte nicht aktualisiert werden.")
  return mapAbsence(row as AbsenceRow)
}

export type CreateAbsenceInput = {
  employeeId: string
  type: AbsenceType
  /** "YYYY-MM-DD" */
  startDate: string
  /** "YYYY-MM-DD"; required for vacation, optional (open-ended) for sickness */
  endDate?: string | null
  note?: string | null
}

// admin_create_absence — erlaubt Backdating und deaktivierte Mitarbeiter
// (historische Nacherfassung), exakt wie Mobile. Bei aktivem Urlaubskonto
// landet eine erfasste Vacation als 'requested' (muss über die
// Urlaubsanträge-Liste genehmigt werden), sonst direkt als 'approved'.
export async function createAbsence(supabase: DB, input: CreateAbsenceInput): Promise<Absence> {
  const { data, error } = await supabase.rpc("admin_create_absence", {
    employee_id_input: input.employeeId,
    type_input: input.type,
    start_date_input: input.startDate,
    end_date_input: input.endDate ?? undefined,
    note_input: input.note?.trim() ? input.note.trim() : undefined,
  })

  if (error) throw error
  const row = Array.isArray(data) ? data[0] : data
  if (!row) throw new Error("Abwesenheit konnte nicht erfasst werden.")
  return mapAbsence(row as AbsenceRow)
}

// ── AU-Prüfung + Urlaubs-Rückgabe (Port von Mobiles auEvidence.service.ts) ──
// Backend unverändert (20260825000000_au_confirmation_restoration.sql):
// admin_review_au / get_au_restoration_candidates / admin_restore_vacation_from_au
// sind die EINZIGEN Schreibpfade — hier wird nichts selbst berechnet oder
// in vacation_ledger geschrieben, exakt wie Mobile.

// admin_review_au(p_absence_id, p_decision, p_note?) — Rückgabe ist die
// absence_evidence.id. Idempotent bei gleicher Entscheidung; eine bereits
// bestätigte AU mit gebuchten Rückgaben ist serverseitig gesperrt.
export async function reviewAu(
  supabase: DB,
  absenceId: string,
  decision: "confirmed" | "rejected",
  note?: string,
): Promise<string> {
  const { data, error } = await supabase.rpc("admin_review_au", {
    p_absence_id: absenceId,
    p_decision: decision,
    p_note: note?.trim() ? note.trim() : undefined,
  })
  if (error) throw error
  return data as string
}

export type AuRestorationCandidate = {
  vacationAbsenceId: string
  vacationStart: string
  vacationEnd: string
  year: number
  deductedDays: number
  alreadyRestored: number
  restorableDays: number
  overlapStart: string
  overlapEnd: string
  fullCoverage: boolean
}

// get_au_restoration_candidates(p_absence_id) — p_absence_id ist die
// KRANKMELDUNG, nicht der Beleg. Nur auf Basis tatsächlich gebuchter
// Abzüge im Ledger, nie ein blosser Urlaubszeitraum.
export async function getRestorationCandidates(
  supabase: DB,
  absenceId: string,
): Promise<AuRestorationCandidate[]> {
  const { data, error } = await supabase.rpc("get_au_restoration_candidates", {
    p_absence_id: absenceId,
  })
  if (error) throw error
  return (data ?? []).map((row) => ({
    vacationAbsenceId: row.vacation_absence_id,
    vacationStart: row.vacation_start,
    vacationEnd: row.vacation_end,
    year: row.year,
    deductedDays: num(row.deducted_days),
    alreadyRestored: num(row.already_restored),
    restorableDays: num(row.restorable_days),
    overlapStart: row.overlap_start,
    overlapEnd: row.overlap_end,
    fullCoverage: row.full_coverage,
  }))
}

export type AuRestorationInput = {
  vacation_absence_id: string
  year: number
  days: number
}

// admin_restore_vacation_from_au(p_evidence_id, p_restorations) — ein Posten
// je (Urlaub, Jahr). Rückgabe ist die Anzahl NEU gebuchter Zeilen; ein
// bereits gebuchter Posten wird serverseitig übersprungen (on conflict do
// nothing) und zählt nicht mit — der Aufrufer erkennt daran ein "war
// bereits gebucht" ohne eigene Duplikatsprüfung.
export async function restoreVacationFromAu(
  supabase: DB,
  evidenceId: string,
  restorations: AuRestorationInput[],
): Promise<number> {
  if (restorations.length === 0) {
    throw new Error("Bitte mindestens einen Posten angeben.")
  }
  const { data, error } = await supabase.rpc("admin_restore_vacation_from_au", {
    p_evidence_id: evidenceId,
    p_restorations: restorations,
  })
  if (error) throw error
  return (data as number) ?? 0
}
