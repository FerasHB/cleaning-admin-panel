// lib/employees/employees.service.ts
// Mitarbeiter-Lebenszyklus — Port der Mobile-Services
// (services/employees/createEmployee.ts, resendInvite.ts,
// services/jobs/jobs.service.ts getEmployees/setEmployeeActive).
//
// Schreibpfade ausschließlich über das bestehende Backend:
//   - Einladen:          Edge Function create-employee  { fullName, email, phone? }
//   - Erneut einladen:   Edge Function resend-invite    { employeeId }
//   - (De)aktivieren:    profiles.update(is_active) unter RLS
//                        "admin update profiles in own company"
// Kein Hard-Delete, keine eigenen Invite-/Reset-Mechanismen.

import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/database.types"
import {
  toFriendlyAuthErrorMessage,
  toFriendlyEdgeFunctionErrorMessage,
} from "@/lib/auth/authErrorMessages"

type DB = SupabaseClient<Database>

export type CompanyEmployee = {
  id: string
  fullName: string
  email: string | null
  phone: string | null
  isActive: boolean
  invitedAt: string | null
  inviteAcceptedAt: string | null
  createdAt: string
}

// Wie Mobiles getEmployees: alle Mitarbeiter der Firma (inkl. inaktiver) —
// gefiltert wird gezielt am Zuweisungs-Picker. E-Mails kommen best effort aus
// der RPC get_company_employee_emails (profiles hat keine email-Spalte).
export async function getCompanyEmployees(supabase: DB): Promise<CompanyEmployee[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, phone, is_active, invited_at, invite_accepted_at, created_at")
    .eq("role", "employee")
    .order("is_active", { ascending: false })
    .order("full_name", { ascending: true })

  if (error) throw error

  const emailById = await getEmployeeEmailMap(supabase)

  return (data ?? []).map((row) => ({
    id: row.id,
    fullName: row.full_name ?? "Unbenannt",
    email: emailById.get(row.id) ?? null,
    phone: row.phone ?? null,
    isActive: row.is_active !== false,
    invitedAt: row.invited_at ?? null,
    inviteAcceptedAt: row.invite_accepted_at ?? null,
    createdAt: row.created_at,
  }))
}

// E-Mails der Firmen-Mitarbeiter. Schlägt der Aufruf fehl, bleibt die Liste
// benutzbar (E-Mail = null), wie in Mobile.
export async function getEmployeeEmailMap(supabase: DB): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  try {
    const { data, error } = await supabase.rpc("get_company_employee_emails")
    if (error) throw error
    for (const row of data ?? []) map.set(row.id, row.email)
  } catch (err) {
    console.error("Failed to load employee emails:", err)
  }
  return map
}

// ── Status (Port von Mobiles utils/employeeStatus.ts) ─────────────────────

export type EmployeeStatusVariant = "pending" | "active" | "inactive"

export function getEmployeeStatus(
  employee: Pick<CompanyEmployee, "isActive" | "inviteAcceptedAt">,
): { label: string; variant: EmployeeStatusVariant } {
  if (!employee.inviteAcceptedAt) return { label: "Eingeladen", variant: "pending" }
  if (!employee.isActive) return { label: "Inaktiv", variant: "inactive" }
  return { label: "Aktiv", variant: "active" }
}

// ── Einladen ──────────────────────────────────────────────────────────────

export class EmployeeActionError extends Error {
  readonly code: string | null
  constructor(message: string, code: string | null = null) {
    super(message)
    this.name = "EmployeeActionError"
    this.code = code
  }
}

export type CreatedEmployee = {
  id: string
  fullName: string
  email: string
  invitedAt: string | null
}

const CREATE_DEFAULT_ERROR = "Einladung konnte nicht verschickt werden."

export async function createEmployee(
  supabase: DB,
  input: { fullName: string; email: string; phone?: string | null },
): Promise<CreatedEmployee> {
  const { data, error } = await supabase.functions.invoke("create-employee", {
    body: {
      fullName: input.fullName,
      email: input.email,
      phone: input.phone?.trim() || undefined,
    },
  })

  if (error) {
    const friendly = await toFriendlyEdgeFunctionErrorMessage(error, CREATE_DEFAULT_ERROR)
    throw new EmployeeActionError(
      friendly.status === 401 || friendly.status === 403
        ? "Keine Berechtigung. Bitte melde dich erneut als Administrator an."
        : friendly.message,
      friendly.code,
    )
  }
  if (data?.error) {
    throw new EmployeeActionError(
      toFriendlyAuthErrorMessage({ message: data.error, code: data.code }, CREATE_DEFAULT_ERROR),
      typeof data.code === "string" ? data.code : null,
    )
  }

  const employee = data?.employee
  return {
    id: employee?.id ?? "",
    fullName: employee?.fullName ?? input.fullName,
    email: employee?.email ?? input.email,
    invitedAt: employee?.invitedAt ?? null,
  }
}

// ── Erneut einladen ───────────────────────────────────────────────────────

export type ResendInviteMode = "invite" | "recovery"

const RESEND_DEFAULT_ERROR = "Einladung konnte nicht erneut verschickt werden."

// "invite":   Konto noch nicht bestätigt -> neue Einladungs-E-Mail.
// "recovery": Konto bereits bestätigt (abgelaufene Einladungs-Sitzung) ->
//             die Function verschickt einen Link zum Passwort-Setzen.
export async function resendInvite(supabase: DB, employeeId: string): Promise<ResendInviteMode> {
  const { data, error } = await supabase.functions.invoke("resend-invite", {
    body: { employeeId },
  })

  if (error) {
    const friendly = await toFriendlyEdgeFunctionErrorMessage(error, RESEND_DEFAULT_ERROR)
    throw new EmployeeActionError(
      friendly.status === 401 || friendly.status === 403
        ? "Keine Berechtigung. Bitte melde dich erneut als Administrator an."
        : friendly.message,
      friendly.code,
    )
  }
  if (data?.error) {
    throw new EmployeeActionError(
      toFriendlyAuthErrorMessage({ message: data.error }, RESEND_DEFAULT_ERROR),
    )
  }
  return data?.mode === "recovery" ? "recovery" : "invite"
}

// ── Deaktivieren / Reaktivieren ───────────────────────────────────────────

// Identisch zu Mobiles setEmployeeActive: is_active setzen, beim Deaktivieren
// zusätzlich den Push-Token löschen. Guard role='employee' verhindert Updates
// an Admin-Profilen; die Firmenzugehörigkeit erzwingt RLS. Kein Löschen —
// historische Aufträge und Zuweisungen bleiben erhalten.
export async function setEmployeeActive(
  supabase: DB,
  employeeId: string,
  active: boolean,
): Promise<void> {
  const payload: { is_active: boolean; expo_push_token?: null } = { is_active: active }
  if (!active) payload.expo_push_token = null

  const { data, error } = await supabase
    .from("profiles")
    .update(payload)
    .eq("id", employeeId)
    .eq("role", "employee")
    .select("id")

  if (error) {
    throw new EmployeeActionError(
      toFriendlyAuthErrorMessage(error, "Status konnte nicht geändert werden."),
    )
  }
  // RLS filtert fremde/unerlaubte Zeilen still heraus -> 0 Zeilen = nicht erlaubt.
  if (!data || data.length === 0) {
    throw new EmployeeActionError("Status konnte nicht geändert werden.")
  }
}
