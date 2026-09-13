import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { Database } from "./database.types"
import { classifyClientKey } from "./keyGuard"

// Same fail-closed guard as lib/supabase/client.ts: this client is built
// from the public NEXT_PUBLIC_SUPABASE_ANON_KEY (RLS-scoped, per-user via
// cookies) — it must never be misconfigured with a secret/service-role key.
function assertSafeClientKey(key: string | undefined): asserts key is string {
  const verdict = classifyClientKey(key)
  if (verdict !== "public") {
    throw new Error(
      "Unsafe Supabase key detected in Web client configuration."
    )
  }
}

export async function createClient() {
  const cookieStore = await cookies()

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  assertSafeClientKey(anonKey)

  return createServerClient<Database>(url!, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        } catch {
          // The `setAll` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing
          // user sessions.
        }
      },
    },
  })
}
