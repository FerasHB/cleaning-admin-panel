// lib/auth/authErrorMessages.ts
// Übersetzt Supabase-Auth-/Edge-Function-Fehler in deutsche, nutzerfreundliche
// Meldungen — Port von Mobiles utils/authErrorMessages.ts. Technische
// Rohmeldungen (Fetch-/SDK-Interna) werden nie angezeigt.

import { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } from "@supabase/supabase-js"

export const GENERIC_AUTH_ERROR_MESSAGE = "Es ist ein unerwarteter Fehler aufgetreten."
export const OFFLINE_ERROR_MESSAGE =
  "Keine Internetverbindung. Bitte überprüfe deine Verbindung und versuche es erneut."
export const SERVER_UNAVAILABLE_ERROR_MESSAGE =
  "Der Server ist momentan nicht erreichbar. Bitte versuche es später erneut."

const KNOWN_ERROR_CODES: Readonly<Record<string, string>> = {
  invalid_credentials: "E-Mail oder Passwort ist falsch.",
  email_not_confirmed: "Bitte bestätige zuerst deine E-Mail-Adresse.",
  email_address_invalid: "Bitte gib eine gültige E-Mail-Adresse ein.",
  email_address_not_authorized: "Bitte gib eine gültige E-Mail-Adresse ein.",
  user_already_exists: "Für diese E-Mail-Adresse existiert bereits ein Konto.",
  email_exists: "Für diese E-Mail-Adresse existiert bereits ein Konto.",
  weak_password: "Das Passwort erfüllt nicht die Mindestanforderungen.",
  same_password: "Das neue Passwort muss sich vom bisherigen unterscheiden.",
  over_email_send_rate_limit: "Zu viele Versuche. Bitte warte kurz und versuche es erneut.",
  over_request_rate_limit: "Zu viele Versuche. Bitte warte kurz und versuche es erneut.",
  refresh_token_not_found: "Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.",
  session_expired: "Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.",
  session_not_found: "Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.",
}

const KNOWN_ERROR_PATTERNS: readonly { pattern: RegExp; message: string }[] = [
  { pattern: /invalid login credentials/i, message: "E-Mail oder Passwort ist falsch." },
  { pattern: /email not confirmed/i, message: "Bitte bestätige zuerst deine E-Mail-Adresse." },
  {
    pattern: /unable to validate email address|invalid email|email address.{0,60}is invalid/i,
    message: "Bitte gib eine gültige E-Mail-Adresse ein.",
  },
  {
    pattern: /user already registered|already been registered/i,
    message: "Für diese E-Mail-Adresse existiert bereits ein Konto.",
  },
  {
    pattern: /invalid refresh token|refresh_token_not_found|invalid jwt|jwt expired|session.{0,15}(missing|not found)/i,
    message: "Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.",
  },
  { pattern: /rate limit|too many requests/i, message: "Zu viele Versuche. Bitte warte kurz und versuche es erneut." },
  {
    pattern: /password.{0,25}(should be at least|too short|weak)/i,
    message: "Das Passwort erfüllt nicht die Mindestanforderungen.",
  },
  {
    pattern: /should be different from the old password/i,
    message: "Das neue Passwort muss sich vom bisherigen unterscheiden.",
  },
]

const RAW_TECHNICAL_PATTERN =
  /edge function returned a non-2xx|failed to send a request to the edge function|failed to fetch|network request failed|load failed|authapierror|functionshttperror|functionsfetcherror|functionsrelayerror|typeerror:|unexpected error|violates|duplicate key|pgrst|sqlstate/i

function extractMessage(err: unknown): string {
  if (!err) return ""
  if (err instanceof Error) return err.message
  if (typeof err === "string") return err
  const maybeMessage = (err as { message?: unknown })?.message
  return typeof maybeMessage === "string" ? maybeMessage : ""
}

function extractErrorCode(err: unknown): string {
  if (!err || typeof err !== "object") return ""
  const maybeCode = (err as { code?: unknown }).code ?? (err as { error_code?: unknown }).error_code
  return typeof maybeCode === "string" ? maybeCode : ""
}

export function isNetworkError(err: unknown): boolean {
  if (err instanceof FunctionsFetchError) return true
  const message = extractMessage(err)
  return /failed to fetch|network request failed|load failed|networkerror/i.test(message)
}

export function toFriendlyAuthErrorMessage(
  err: unknown,
  fallback: string = GENERIC_AUTH_ERROR_MESSAGE,
): string {
  if (isNetworkError(err)) return OFFLINE_ERROR_MESSAGE

  const code = extractErrorCode(err)
  if (code && KNOWN_ERROR_CODES[code]) return KNOWN_ERROR_CODES[code]

  const message = extractMessage(err)
  if (!message) return fallback

  if (/^5\d{2}\b|internal server error|service unavailable|bad gateway/i.test(message)) {
    return SERVER_UNAVAILABLE_ERROR_MESSAGE
  }

  for (const { pattern, message: friendly } of KNOWN_ERROR_PATTERNS) {
    if (pattern.test(message)) return friendly
  }

  if (RAW_TECHNICAL_PATTERN.test(message)) return fallback
  return message
}

// Edge-Function-Fehler: die Functions liefern ihre (deutschen) Meldungen im
// JSON-Body ({ error, code? }). Der wird gelesen und wie oben gefiltert.
export async function toFriendlyEdgeFunctionErrorMessage(
  error: unknown,
  fallback: string = GENERIC_AUTH_ERROR_MESSAGE,
): Promise<{ message: string; code: string | null; status: number | null }> {
  if (isNetworkError(error)) return { message: OFFLINE_ERROR_MESSAGE, code: null, status: null }
  if (error instanceof FunctionsRelayError) {
    return { message: SERVER_UNAVAILABLE_ERROR_MESSAGE, code: null, status: null }
  }

  if (error instanceof FunctionsHttpError) {
    const response = error.context as Response
    const status = typeof response?.status === "number" ? response.status : null
    try {
      const body = await response.clone().json()
      const bodyMessage = typeof body?.error === "string" ? body.error : ""
      const bodyCode = typeof body?.code === "string" ? body.code : ""
      if (status !== null && status >= 500) {
        return { message: SERVER_UNAVAILABLE_ERROR_MESSAGE, code: bodyCode || null, status }
      }
      if (bodyMessage || bodyCode) {
        return {
          message: toFriendlyAuthErrorMessage({ message: bodyMessage, code: bodyCode }, fallback),
          code: bodyCode || null,
          status,
        }
      }
    } catch {
      // Kein JSON-Body — generische Meldung.
    }
    return { message: fallback, code: null, status }
  }

  return { message: toFriendlyAuthErrorMessage(error, fallback), code: null, status: null }
}
