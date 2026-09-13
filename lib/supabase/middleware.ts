import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { Database } from "./database.types"
import { classifyClientKey } from "./keyGuard"
import {
  decideRoute,
  isRecoverySession,
  RECOVERY_COOKIE,
  resolveAuthState,
  type ProfileSnapshot,
} from "@/lib/auth/authState"

// Same fail-closed guard as lib/supabase/client.ts and server.ts: the proxy
// runs on every request, so a misconfigured secret key here would be the
// worst place to miss it.
function assertSafeClientKey(key: string | undefined): asserts key is string {
  const verdict = classifyClientKey(key)
  if (verdict !== "public") {
    throw new Error(
      "Unsafe Supabase key detected in Web client configuration."
    )
  }
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  assertSafeClientKey(anonKey)

  const supabase = createServerClient<Database>(
    url!,
    anonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value)
          })

          supabaseResponse = NextResponse.next({
            request,
          })

          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  // getClaims() verifiziert das JWT (und frischt die Sitzung bei Bedarf auf).
  const { data: claimsData } = await supabase.auth.getClaims()
  const claims = claimsData?.claims ?? null
  const userId = typeof claims?.sub === "string" ? claims.sub : null

  const markerValue = request.cookies.get(RECOVERY_COOKIE)?.value
  const isRecovery = isRecoverySession(claims, markerValue)

  let profile: ProfileSnapshot | null = null
  let profileLoadFailed = false
  if (userId && !isRecovery) {
    // Eigenes Profil ist über "employee read own profile" (id = auth.uid())
    // lesbar — auch für deaktivierte Konten, deshalb ist is_active hier sichtbar.
    const { data, error } = await supabase
      .from("profiles")
      .select("role, company_id, is_active")
      .eq("id", userId)
      .maybeSingle()
    if (error) profileLoadFailed = true
    profile = data
  }

  const state = resolveAuthState({
    hasUser: !!userId,
    isRecovery,
    profile,
    profileLoadFailed,
  })

  const decision = decideRoute(request.nextUrl.pathname, state)

  // Veralteter Marker (keine passende Recovery-Sitzung mehr) wird entfernt.
  const clearStaleMarker = !!markerValue && !isRecovery

  if (decision.action === "next") {
    if (clearStaleMarker) supabaseResponse.cookies.delete(RECOVERY_COOKIE)
    return supabaseResponse
  }

  if (decision.signOut) {
    // Nur diese Sitzung beenden (scope "local"); setAll schreibt die
    // gelöschten Auth-Cookies in supabaseResponse.
    await supabase.auth.signOut({ scope: "local" })
  }

  const redirect = NextResponse.redirect(new URL(decision.to, request.url))
  // Aufgefrischte bzw. gelöschte Auth-Cookies MÜSSEN mit der Weiterleitung
  // mitgehen — sonst bliebe ein Sign-out wirkungslos (Redirect-Schleife).
  supabaseResponse.cookies.getAll().forEach((cookie) => {
    redirect.cookies.set(cookie)
  })
  if (clearStaleMarker || decision.signOut) redirect.cookies.delete(RECOVERY_COOKIE)
  return redirect
}
