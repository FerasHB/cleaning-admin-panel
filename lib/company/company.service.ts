// lib/company/company.service.ts
// Eigene Firma lesen/ändern — Port von Mobiles services/company/company.service.ts.
// Lesen über RLS ("read own company"); Schreiben ausschließlich über die
// SECURITY-DEFINER-RPC update_own_company (companies hat bewusst keine
// UPDATE-Policy; Allowlist name/contact_email/contact_phone, Rolle und
// Firmen-Zugehörigkeit prüft der Server).

import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/database.types"
import { normalizeEmail, normalizePhone } from "@/lib/auth/validation"
import { toFriendlyAuthErrorMessage } from "@/lib/auth/authErrorMessages"

type DB = SupabaseClient<Database>

export type CompanyContact = {
  name: string
  contactEmail: string | null
  contactPhone: string | null
}

export type CompanyContactInput = {
  name: string
  contactEmail: string
  contactPhone: string
}

function friendlyUpdateError(err: unknown): string {
  const message =
    err && typeof err === "object" && typeof (err as { message?: unknown }).message === "string"
      ? (err as { message: string }).message
      : ""
  // Meldungen der RPC update_own_company (ASCII-Umlaute im SQL) auf Deutsch.
  if (/Nur Admins duerfen Firmendaten aendern/i.test(message)) {
    return "Nur Admins dürfen Firmendaten ändern."
  }
  if (/Keine Firma zugeordnet/i.test(message)) return "Deinem Konto ist keine Firma zugeordnet."
  if (/Firmenname ist erforderlich/i.test(message)) return "Firmenname ist erforderlich."
  if (/Ungueltige E-Mail-Adresse/i.test(message)) return "Bitte gib eine gültige E-Mail-Adresse ein."
  if (/Ungueltige Telefonnummer/i.test(message)) {
    return "Bitte gib eine gültige Telefonnummer ein (z. B. 0170 1234567)."
  }
  return toFriendlyAuthErrorMessage(err, "Firmendaten konnten nicht gespeichert werden.")
}

// Wie Mobile: Name Pflicht, E-Mail lowercased, Telefon → E.164, leere Felder
// werden serverseitig zu NULL.
export async function updateOwnCompany(
  supabase: DB,
  input: CompanyContactInput,
): Promise<CompanyContact> {
  const name = input.name.trim()
  if (!name) throw new Error("Firmenname ist erforderlich.")

  const rawEmail = input.contactEmail.trim()
  const rawPhone = input.contactPhone.trim()

  const email = rawEmail ? normalizeEmail(rawEmail) : null

  let phone: string | null = null
  if (rawPhone) {
    phone = normalizePhone(rawPhone)
    if (!phone) {
      throw new Error("Bitte gib eine gültige Telefonnummer ein (z. B. 0170 1234567).")
    }
  }

  // "" statt null: die RPC macht nullif(btrim(coalesce(x, '')), '') — beides
  // landet als NULL, "" passt aber zur generierten (nicht-nullbaren) Signatur.
  const { data, error } = await supabase.rpc("update_own_company", {
    p_name: name,
    p_contact_email: email ?? "",
    p_contact_phone: phone ?? "",
  })

  if (error) {
    console.error("update_own_company failed:", error.message)
    throw new Error(friendlyUpdateError(error))
  }

  // RETURNS public.companies → je nach PostgREST-Version Objekt oder Array.
  const row = Array.isArray(data) ? data[0] : data
  if (!row) throw new Error("Firmendaten konnten nicht gespeichert werden.")

  return {
    name: row.name,
    contactEmail: row.contact_email,
    contactPhone: row.contact_phone,
  }
}
