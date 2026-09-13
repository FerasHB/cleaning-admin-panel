// lib/vacation/vacationLedger.ts
// Vacation year/ledger/balance access for the Web Admin Panel — port of
// Mobile's services/vacation/vacationLedger.service.ts + utils/vacationBalance.ts
// + utils/vacationConfig.ts. The ledger is append-only with SELECT-only RLS;
// every write goes through admin_initialize_vacation_year /
// admin_add_vacation_adjustment. The balance itself is NEVER a stored value —
// it is always a live SUM over vacation_ledger, computed client-side exactly
// like Mobile (no separate server aggregate exists).

import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/database.types"
import { toAbsenceMessage } from "@/lib/absences/absences"

type DB = SupabaseClient<Database>

export type VacationLedgerEntryType = Database["public"]["Enums"]["vacation_ledger_entry_type"]

export type VacationLedgerEntry = {
  id: string
  entryType: VacationLedgerEntryType
  amountDays: number
  absenceId: string | null
  createdBy: string | null
  note: string | null
  createdAt: string
}

// PostgREST returns `numeric` as a string — every numeric field must be
// coerced, or balance sums silently do string concatenation.
function num(value: unknown): number {
  return typeof value === "number" ? value : Number(value ?? 0)
}

export const LEDGER_ENTRY_LABELS: Record<VacationLedgerEntryType, string> = {
  annual_entitlement: "Jahresanspruch",
  approved_vacation: "Genehmigter Urlaub",
  vacation_cancellation: "Stornierung",
  manual_adjustment: "Manuelle Korrektur",
  carry_over: "Übertrag",
  au_restoration: "Rückgabe nach AU",
}

export async function isVacationAccountingEnabled(supabase: DB, employeeId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("profiles")
    .select("vacation_management_enabled")
    .eq("id", employeeId)
    .single()

  if (error) throw error
  return data?.vacation_management_enabled === true
}

export type VacationConfig =
  | { status: "disabled" }
  | { status: "incomplete" }
  | { status: "configured"; annualEntitlementDays: number; referenceDaysPerWeek: number | null }

// Employee override falls back to the company default — identisch zu
// Mobiles resolveEffectiveVacationConfig / admin_initialize_vacation_year.
export async function resolveEffectiveVacationConfig(
  supabase: DB,
  employeeId: string,
): Promise<VacationConfig> {
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("vacation_management_enabled, vacation_annual_entitlement_days, vacation_reference_days_per_week, company_id")
    .eq("id", employeeId)
    .single()
  if (profileError) throw profileError
  if (!profile?.vacation_management_enabled) return { status: "disabled" }
  if (!profile.company_id) throw new Error("Kein company_id im Profil gefunden.")

  const { data: company, error: companyError } = await supabase
    .from("companies")
    .select("default_vacation_annual_entitlement_days, default_vacation_reference_days_per_week")
    .eq("id", profile.company_id)
    .single()
  if (companyError) throw companyError

  const annualEntitlementDays =
    profile.vacation_annual_entitlement_days ?? company?.default_vacation_annual_entitlement_days ?? null
  if (annualEntitlementDays == null) return { status: "incomplete" }

  const referenceDaysPerWeek =
    profile.vacation_reference_days_per_week ?? company?.default_vacation_reference_days_per_week ?? null

  return { status: "configured", annualEntitlementDays: num(annualEntitlementDays), referenceDaysPerWeek: referenceDaysPerWeek == null ? null : num(referenceDaysPerWeek) }
}

export async function getVacationYearId(
  supabase: DB,
  employeeId: string,
  year: number,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("vacation_years")
    .select("id")
    .eq("employee_id", employeeId)
    .eq("year", year)
    .maybeSingle()

  if (error) throw error
  return data?.id ?? null
}

export async function getVacationLedger(supabase: DB, vacationYearId: string): Promise<VacationLedgerEntry[]> {
  const { data, error } = await supabase
    .from("vacation_ledger")
    .select("id, entry_type, amount_days, absence_id, created_by, note, created_at")
    .eq("vacation_year_id", vacationYearId)
    .order("created_at", { ascending: true })

  if (error) throw error
  return (data ?? []).map((row) => ({
    id: row.id,
    entryType: row.entry_type,
    amountDays: num(row.amount_days),
    absenceId: row.absence_id,
    createdBy: row.created_by,
    note: row.note,
    createdAt: row.created_at,
  }))
}

// admin_initialize_vacation_year — idempotent (on conflict do nothing server-
// side); resolves entitlement server-side so the client cannot dictate it.
export async function initializeVacationYear(supabase: DB, employeeId: string, year: number): Promise<string> {
  const { data, error } = await supabase.rpc("admin_initialize_vacation_year", {
    p_employee_id: employeeId,
    p_year: year,
  })
  if (error) throw new Error(toAbsenceMessage(error, "Jahresanspruch konnte nicht angelegt werden."))
  return data as string
}

// admin_add_vacation_adjustment — jede Zeile bleibt stehen; eine falsche
// Korrektur wird durch eine weitere, gegenläufige geheilt, nie editiert.
export async function addVacationAdjustment(
  supabase: DB,
  employeeId: string,
  year: number,
  amountDays: number,
  note: string,
): Promise<void> {
  const { error } = await supabase.rpc("admin_add_vacation_adjustment", {
    p_employee_id: employeeId,
    p_year: year,
    p_amount_days: amountDays,
    p_note: note.trim(),
  })
  if (error) throw new Error(toAbsenceMessage(error, "Korrektur konnte nicht gespeichert werden."))
}

export type VacationBalance = {
  annualEntitlement: number
  carryOver: number
  usedDays: number
  adjustments: number
  remaining: number
}

// Exakt Mobiles utils/vacationBalance.ts::buildVacationBalance — die Salden
// sind IMMER eine SUM über die Ledger-Zeilen, nie eine gespeicherte Zahl.
export function buildVacationBalance(entries: VacationLedgerEntry[]): VacationBalance {
  const sumOf = (type: VacationLedgerEntryType) =>
    entries.filter((e) => e.entryType === type).reduce((acc, e) => acc + e.amountDays, 0)

  const annualEntitlement = sumOf("annual_entitlement")
  const carryOver = sumOf("carry_over")
  const approvedVacation = sumOf("approved_vacation")
  const vacationCancellation = sumOf("vacation_cancellation")
  const manualAdjustment = sumOf("manual_adjustment")
  const auRestoration = sumOf("au_restoration")

  const usedDays = -(approvedVacation + vacationCancellation)
  const adjustments = manualAdjustment + auRestoration
  const remaining = entries.reduce((acc, e) => acc + e.amountDays, 0)

  return { annualEntitlement, carryOver, usedDays, adjustments, remaining }
}

export function formatLedgerAmount(amountDays: number): string {
  const sign = amountDays > 0 ? "+" : amountDays < 0 ? "−" : "±"
  return `${sign}${Math.abs(amountDays).toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`
}
