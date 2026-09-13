// lib/auth/authState.ts
// Reine Routing-Entscheidung für den Web-Route-Guard (proxy.ts ->
// lib/supabase/middleware.ts). Keine Seiteneffekte, kein Supabase-Zugriff —
// dadurch isoliert nachvollziehbar.
//
// Spiegelt Mobiles Routing-Gate (app/index.tsx), angepasst an das Web, das
// ausschließlich Admins bedient:
//   Recovery-Sitzung            -> nur /reset-password (nie in die App)
//   keine Sitzung               -> /login
//   Profil deaktiviert          -> abmelden, /login?error=inactive
//   keine Firma (company_id)    -> /setup-company (Onboarding fortsetzen)
//   Firma + Rolle admin         -> Admin-Bereich
//   Firma + andere Rolle        -> abmelden, /login?error=not_admin
//
// Reihenfolge wie Mobile: company_id wird VOR der Rolle geprüft — frisch
// registrierte Konten tragen per handle_new_user die Default-Rolle 'employee'
// und werden erst durch setup_company_for_admin zum Admin.
//
// WICHTIG: Das ist reines Routing/UX. Die eigentliche Autorisierung erzwingen
// RLS, RPCs und Edge Functions im Backend.

export const RECOVERY_COOKIE = "taskops-recovery-session"

type AmrEntry = string | { method?: string }

// Stammt die Sitzung aus einem Passwort-Reset-Link? Zwei unabhängige Signale:
//   1. Marker-Cookie, den /auth/recovery beim Code-Tausch setzt — gebunden an
//      die session_id GENAU dieser Sitzung (eine spätere normale Anmeldung hat
//      eine andere session_id und gilt damit nicht mehr als Recovery).
//   2. amr-Claim des verifizierten Tokens mit Methode "recovery".
// `claims` MUSS aus einem verifizierten Token stammen (auth.getClaims()).
export function isRecoverySession(
  claims: { session_id?: unknown; amr?: unknown } | null | undefined,
  markerValue: string | undefined,
): boolean {
  if (!claims) return false
  const sessionId = typeof claims.session_id === "string" ? claims.session_id : null
  if (markerValue && sessionId && markerValue === sessionId) return true
  const amr = Array.isArray(claims.amr) ? (claims.amr as AmrEntry[]) : []
  return amr.some((entry) =>
    typeof entry === "string" ? entry === "recovery" : entry?.method === "recovery",
  )
}

export type ProfileSnapshot = {
  role: string | null
  company_id: string | null
  is_active: boolean | null
}

export type AuthState =
  | { kind: "anonymous" }
  | { kind: "recovery" }
  | { kind: "profile_error" }
  | { kind: "inactive" }
  | { kind: "no_company" }
  | { kind: "not_admin" }
  | { kind: "admin" }

export function resolveAuthState(input: {
  hasUser: boolean
  isRecovery: boolean
  profile: ProfileSnapshot | null
  profileLoadFailed: boolean
}): AuthState {
  if (!input.hasUser) return { kind: "anonymous" }
  if (input.isRecovery) return { kind: "recovery" }
  if (input.profileLoadFailed || !input.profile) return { kind: "profile_error" }
  if (input.profile.is_active === false) return { kind: "inactive" }
  if (!input.profile.company_id) return { kind: "no_company" }
  if (input.profile.role !== "admin") return { kind: "not_admin" }
  return { kind: "admin" }
}

// Öffentliche Seiten ohne Sitzungspflicht.
export const PUBLIC_AUTH_PATHS = ["/login", "/register", "/forgot-password"] as const
// Recovery-Einstieg (Route Handler) und Passwort-Setzen.
export const RECOVERY_PATHS = ["/auth/recovery", "/reset-password"] as const
export const SETUP_COMPANY_PATH = "/setup-company"
export const ADMIN_PATH_PREFIXES = [
  "/dashboard",
  "/jobs",
  "/employees",
  "/messages",
  "/settings",
] as const

function matches(pathname: string, base: string) {
  return pathname === base || pathname.startsWith(`${base}/`)
}

export type RouteDecision =
  | { action: "next" }
  | { action: "redirect"; to: string; signOut?: boolean }

// Entscheidet für einen Pfad + Zustand, ob weitergeleitet wird. Jede
// Weiterleitung zielt auf einen Pfad, den derselbe Zustand ohne erneute
// Weiterleitung passieren darf — dadurch sind Redirect-Schleifen strukturell
// ausgeschlossen.
export function decideRoute(pathname: string, state: AuthState): RouteDecision {
  const isPublicAuth = PUBLIC_AUTH_PATHS.some((p) => matches(pathname, p))
  const isRecoveryPath = RECOVERY_PATHS.some((p) => matches(pathname, p))
  const isSetup = matches(pathname, SETUP_COMPANY_PATH)
  const isAdminArea = ADMIN_PATH_PREFIXES.some((p) => matches(pathname, p))

  // Recovery-Einstieg darf immer durch (tauscht den Code, setzt den Marker).
  if (matches(pathname, "/auth/recovery")) return { action: "next" }

  switch (state.kind) {
    case "recovery":
      // Eine Passwort-Reset-Sitzung führt nie in die App.
      return isRecoveryPath ? { action: "next" } : { action: "redirect", to: "/reset-password" }

    case "anonymous":
      if (isAdminArea || isSetup) return { action: "redirect", to: "/login" }
      return { action: "next" }

    case "profile_error":
      // Nicht abmelden (evtl. nur vorübergehend) — Login zeigt Hinweis mit
      // Abmelden-Option. Login selbst leitet in diesem Zustand nicht weiter.
      if (isAdminArea || isSetup) return { action: "redirect", to: "/login?error=profile" }
      return { action: "next" }

    // Deaktiviert / kein Admin: Sitzung beenden (wie Mobiles
    // forceSignOutDueToDeactivation). Die Weiterleitung selbst trägt die
    // gelöschten Cookies — der Folge-Request ist "anonymous" und bleibt auf
    // /login, also keine Schleife.
    case "inactive":
      return { action: "redirect", to: "/login?error=inactive", signOut: true }

    case "not_admin":
      return { action: "redirect", to: "/login?error=not_admin", signOut: true }

    case "no_company":
      if (isSetup || matches(pathname, "/reset-password")) return { action: "next" }
      return { action: "redirect", to: SETUP_COMPANY_PATH }

    case "admin":
      if (isPublicAuth || isSetup) return { action: "redirect", to: "/dashboard" }
      return { action: "next" }
  }
}
