import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { Database } from "./database.types"
import { classifyClientKey } from "./keyGuard"

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

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname
  const isAuthPage = pathname.startsWith("/login") || pathname.startsWith("/register")
  const isProtectedPage =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/jobs") ||
    pathname.startsWith("/employees") ||
    pathname.startsWith("/messages") ||
    pathname.startsWith("/settings")

  if (!user && isProtectedPage) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, company_id")
      .eq("id", user.id)
      .single()

    // Non-admin or missing profile: block access and sign out
    if (profile?.role !== "admin" && isProtectedPage) {
      await supabase.auth.signOut()
      return NextResponse.redirect(new URL("/login?error=access_denied", request.url))
    }

    // Admin with no company_id: setup did not complete — send to register
    // so they can complete company creation. Exempt /register itself to avoid a loop.
    if (
      profile?.role === "admin" &&
      !profile.company_id &&
      isProtectedPage
    ) {
      return NextResponse.redirect(new URL("/register?incomplete=true", request.url))
    }

    // Authenticated users should not see login or register pages —
    // EXCEPT an admin with no company_id is allowed to stay on /register
    // so they can complete company setup (the ?incomplete=true recovery path).
    const isCompanySetupPage =
      pathname.startsWith("/register") &&
      profile?.role === "admin" &&
      !profile.company_id
    if (isAuthPage && !isCompanySetupPage) {
      return NextResponse.redirect(new URL("/dashboard", request.url))
    }
  }

  return supabaseResponse
}