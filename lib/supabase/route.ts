import { createServerClient } from "@supabase/ssr"
import type { NextRequest, NextResponse } from "next/server"
import { Database } from "./database.types"
import { classifyClientKey } from "./keyGuard"

type CookieToSet = { name: string; value: string; options?: Parameters<NextResponse["cookies"]["set"]>[2] }

// Supabase-Client für Route Handler, die mit einer eigenen Antwort (z. B.
// NextResponse.redirect) antworten. Von Supabase gesetzte Auth-Cookies werden
// gesammelt und über applyCookies() explizit auf DIESE Antwort geschrieben —
// unabhängig davon, wie Next.js cookies()-Mutationen mit eigenen Responses
// zusammenführt.
export function createRouteClient(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // Gleicher fail-closed Guard wie client.ts/server.ts/middleware.ts.
  if (classifyClientKey(anonKey) !== "public") {
    throw new Error("Unsafe Supabase key detected in Web client configuration.")
  }

  const pending: CookieToSet[] = []

  const supabase = createServerClient<Database>(url!, anonKey!, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach((cookie) => {
          request.cookies.set(cookie.name, cookie.value)
          pending.push(cookie)
        })
      },
    },
  })

  const applyCookies = (response: NextResponse) => {
    pending.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
    return response
  }

  return { supabase, applyCookies }
}
