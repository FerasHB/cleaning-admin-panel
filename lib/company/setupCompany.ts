// lib/company/setupCompany.ts
// Firma anlegen und den aktuellen Nutzer zum Admin machen — Port von Mobiles
// services/company/setupCompanyForAdmin.ts. Einziger Schreibpfad ist die
// geschützte RPC setup_company_for_admin (4 Argumente): sie lehnt Nutzer ab,
// die bereits zu einer Firma gehören. Die unge­schützte Legacy-RPC
// register_admin_with_company wird vom Web NICHT mehr verwendet.

import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/database.types"
import { normalizeEmail, normalizePhone } from "@/lib/auth/validation"
import { toFriendlyAuthErrorMessage } from "@/lib/auth/authErrorMessages"

type DB = SupabaseClient<Database>

export type SetupCompanyInput = {
  companyName: string
  // Pflicht in der Registrierungs-UX (wie Mobile).
  contactEmail: string
  contactPhone: string
  // Persönliche Rufnummer des Admins, optional.
  adminPhone?: string | null
}

// Firmen-Vorbelegung, die bei der Registrierung in user_metadata abgelegt wird,
// damit ein Konto, das erst die E-Mail bestätigen muss, die Einrichtung nach
// der Anmeldung ohne erneute Eingabe fortsetzen kann. Nur Vorbelegung — die
// RPC validiert unabhängig davon.
export const PENDING_COMPANY_METADATA_KEY = "pending_company"

// sessionStorage-Schlüssel: Fehlermeldung eines direkt nach der Registrierung
// fehlgeschlagenen Einrichtungsversuchs, angezeigt auf /setup-company.
export const SETUP_FAILED_STORAGE_KEY = "taskops-setup-company-error"

export type PendingCompanyMetadata = {
  companyName?: string
  contactEmail?: string
  contactPhone?: string
  adminPhone?: string
}

function friendlySetupError(err: unknown): string {
  const message =
    err && typeof err === "object" && typeof (err as { message?: unknown }).message === "string"
      ? (err as { message: string }).message
      : ""
  // Bekannte RPC-Meldungen (setup_company_for_admin) auf Deutsch.
  if (/already belongs to a company/i.test(message)) {
    return "Dein Konto ist bereits einer Firma zugeordnet."
  }
  if (/not authenticated/i.test(message)) {
    return "Deine Sitzung ist abgelaufen. Bitte melde dich erneut an."
  }
  if (/company name is required/i.test(message)) return "Bitte gib einen Firmennamen ein."
  if (/Ungueltige Firmen-E-Mail/i.test(message)) return "Bitte gib eine gültige Firmen-E-Mail ein."
  if (/Ungueltige Firmen-Telefonnummer/i.test(message)) {
    return "Bitte gib eine gültige Firmen-Telefonnummer ein."
  }
  if (/Ungueltige Telefonnummer/i.test(message)) return "Bitte gib eine gültige Telefonnummer ein."
  return toFriendlyAuthErrorMessage(err, "Firma konnte nicht erstellt werden.")
}

export async function setupCompanyForAdmin(supabase: DB, input: SetupCompanyInput): Promise<string> {
  const companyName = input.companyName.trim()
  if (!companyName) throw new Error("Firmenname fehlt.")

  const contactEmail = input.contactEmail.trim() ? normalizeEmail(input.contactEmail) : null

  let contactPhone: string | null = null
  if (input.contactPhone.trim()) {
    contactPhone = normalizePhone(input.contactPhone)
    if (!contactPhone) throw new Error("Bitte gib eine gültige Firmen-Telefonnummer ein.")
  }

  let adminPhone: string | null = null
  if (input.adminPhone?.trim()) {
    adminPhone = normalizePhone(input.adminPhone)
    if (!adminPhone) throw new Error("Bitte gib eine gültige Telefonnummer ein.")
  }

  const { data, error } = await supabase.rpc("setup_company_for_admin", {
    company_name: companyName,
    p_contact_email: contactEmail ?? undefined,
    p_contact_phone: contactPhone ?? undefined,
    p_admin_phone: adminPhone ?? undefined,
  })

  if (error) {
    console.error("setup_company_for_admin failed:", error.message)
    throw new Error(friendlySetupError(error))
  }
  if (typeof data !== "string" || !data) {
    throw new Error("Firma konnte nicht erstellt werden.")
  }
  return data
}
