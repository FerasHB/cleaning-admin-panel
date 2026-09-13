import { createBrowserClient } from "@supabase/ssr"
import { Database } from "./database.types"
import { classifyClientKey } from "./keyGuard"

// Fail-closed guard: refuse to build a browser Supabase client with
// anything other than a recognized public (anon/publishable) key. This
// value ends up in the browser bundle — a secret/service-role key here
// would hand out full database access to every visitor.
function assertSafeClientKey(key: string | undefined): asserts key is string {
  const verdict = classifyClientKey(key)
  if (verdict !== "public") {
    throw new Error(
      "Unsafe Supabase key detected in Web client configuration."
    )
  }
}

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  assertSafeClientKey(anonKey)

  return createBrowserClient<Database>(url!, anonKey)
}
