// app/auth/recovery/route.ts
// Einstieg aus dem Passwort-Reset-Link (Supabase PKCE-Flow):
//   <Supabase>/auth/v1/verify?...&redirect_to=<Web>/auth/recovery
//     -> /auth/recovery?code=...
//
// Der Code wird serverseitig eingelöst (der PKCE code_verifier liegt als
// Cookie aus dem "Passwort vergessen"-Request im selben Browser vor). Danach
// wird ein httpOnly-Marker gesetzt, der an die session_id GENAU dieser Sitzung
// gebunden ist: der Route-Guard (lib/supabase/middleware.ts) lässt eine
// Recovery-Sitzung ausschließlich auf /reset-password — nie in den
// Admin-Bereich (Web-Pendant zu Mobiles recoveryMode-Marker).

import { NextResponse, type NextRequest } from "next/server"
import { createRouteClient } from "@/lib/supabase/route"
import { RECOVERY_COOKIE } from "@/lib/auth/authState"

// Recovery-Sitzungen sind kurzlebig; der Marker läuft spätestens nach 1 h ab.
const MARKER_MAX_AGE_SECONDS = 60 * 60

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const code = searchParams.get("code")
  const { supabase, applyCookies } = createRouteClient(request)

  const failure = (reason: "expired" | "invalid") =>
    applyCookies(NextResponse.redirect(new URL(`/forgot-password?link=${reason}`, request.url)))

  // Von Supabase angehängte Fehler (z. B. otp_expired) ohne Code.
  if (!code) {
    const errorCode = searchParams.get("error_code") ?? ""
    const description = searchParams.get("error_description") ?? ""
    return failure(/expired/i.test(errorCode) || /expired/i.test(description) ? "expired" : "invalid")
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    // Typisch: Link abgelaufen/bereits benutzt oder in einem anderen Browser
    // geöffnet (kein code_verifier vorhanden).
    return failure(/expired/i.test(error.message) ? "expired" : "invalid")
  }

  const { data: claimsData } = await supabase.auth.getClaims()
  const sessionId = claimsData?.claims?.session_id
  if (typeof sessionId !== "string" || !sessionId) {
    // Ohne bindbare session_id keine Recovery-Sitzung zulassen (fail closed).
    await supabase.auth.signOut({ scope: "local" })
    return failure("invalid")
  }

  const response = applyCookies(NextResponse.redirect(new URL("/reset-password", request.url)))
  response.cookies.set(RECOVERY_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:",
    path: "/",
    maxAge: MARKER_MAX_AGE_SECONDS,
  })
  return response
}
