// lib/auth/validation.ts
// Eingabe-Validierung für Auth-/Onboarding-/Mitarbeiter-Formulare — Port von
// Mobiles utils/email.ts, utils/phone.ts und utils/passwordValidation.ts, damit
// Web und Mobile dieselben Regeln anwenden (Server validiert zusätzlich).

// ── E-Mail ────────────────────────────────────────────────────────────────

/** Trimmt Whitespace und normalisiert die Groß-/Kleinschreibung für Supabase Auth. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Grobe Format-Prüfung für UI-Feedback (Supabase validiert serverseitig). */
export function isValidEmail(email: string): boolean {
  return EMAIL_PATTERN.test(email.trim())
}

// ── Telefon (E.164, DE-Default) ───────────────────────────────────────────

export const E164_PATTERN = /^\+[1-9]\d{6,14}$/

/**
 * Wandelt eine Roh-Eingabe in E.164 um oder gibt `null` zurück.
 *   1. Trenner entfernen: Leerzeichen, `/`, `-`, `.`, `(`, `)`
 *   2. `00…` → `+…`
 *   3. `+…`  → unverändert
 *   4. `0…`  → `+49` + Rest ohne führende 0
 *   5. reine Ziffern → `+` davor
 *   6. Ergebnis muss E164_PATTERN erfüllen
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (raw == null) return null
  let value = String(raw).replace(/[\s/().-]/g, "")
  if (value === "") return null

  if (value.startsWith("00")) {
    value = "+" + value.slice(2)
  } else if (value.startsWith("+")) {
    // wie eingegeben
  } else if (value.startsWith("0")) {
    value = "+49" + value.slice(1)
  } else if (/^\d+$/.test(value)) {
    value = "+" + value
  }

  return E164_PATTERN.test(value) ? value : null
}

export function isValidPhone(raw: string | null | undefined): boolean {
  return normalizePhone(raw) !== null
}

/** Anzeige-Formatierung, wirft nie. DE: `+49 170 1234567`. */
export function formatPhoneForDisplay(value: string | null | undefined): string {
  if (!value) return ""
  const e164 = normalizePhone(value)
  if (!e164) return String(value)
  if (e164.startsWith("+49") && e164.length > 5) {
    const rest = e164.slice(3)
    return `+49 ${rest.slice(0, 3)} ${rest.slice(3)}`.trimEnd()
  }
  const cc = e164.slice(1, e164.length - 10) || e164.slice(1, 3)
  const subscriber = e164.slice(1 + cc.length)
  const grouped = subscriber.replace(/(\d{3})(?=\d)/g, "$1 ").trim()
  return `+${cc} ${grouped}`.trim()
}

// ── Passwort ──────────────────────────────────────────────────────────────

export const MIN_PASSWORD_LENGTH = 10
export const MAX_PASSWORD_BYTES = 72
export const PASSWORD_MISMATCH_MESSAGE = "Die Passwörter stimmen nicht überein."

function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).length
}

/** Null bei gültigem Passwort, sonst eine deutsche Fehlermeldung. */
export function validatePassword(password: string): string | null {
  if (!password.trim()) return "Bitte ein Passwort eingeben."
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Das Passwort muss mindestens ${MIN_PASSWORD_LENGTH} Zeichen lang sein.`
  }
  if (utf8ByteLength(password) > MAX_PASSWORD_BYTES) return "Das Passwort ist zu lang."
  return null
}

/** Wie validatePassword, plus Abgleich mit der Bestätigung. */
export function validateNewPassword(password: string, confirmPassword: string): string | null {
  const error = validatePassword(password)
  if (error) return error
  if (password !== confirmPassword) return PASSWORD_MISMATCH_MESSAGE
  return null
}
