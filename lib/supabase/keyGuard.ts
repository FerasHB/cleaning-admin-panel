// lib/supabase/keyGuard.ts
// Security guard (pure logic, no side effects): classifies the Supabase
// client key by its VALUE — not by the name of the env var carrying it.
// Ported from the Mobile app's lib/supabaseKeyGuard.ts (same concept,
// same acceptance rules) so Web and Mobile agree on what a "safe" client
// key looks like.
//
// This module never returns or logs the key value (or any part of it) —
// only the classification. The app-wide fail-closed behavior (throw, no
// createClient) lives in lib/supabase/client.ts and lib/supabase/server.ts,
// not here.

// Classification result:
//   "public"  → an acceptable client key (publishable or legacy anon key)
//   "secret"  → a secret/service-role key → FORBIDDEN in the browser/client
//   "unknown" → unrecognized format → rejected fail-closed (could be a secret)
//   "missing" → no key set → configuration error (createClient reports it)
export type ClientKeyVerdict = "public" | "secret" | "unknown" | "missing";

// Accepted public key formats:
//   1. New publishable format: prefix "sb_publishable_".
//   2. Legacy anon key: a JWT (3 parts) with role claim "anon".
// Forbidden formats:
//   - New secret format: prefix "sb_secret_"
//   - Legacy service_role key: a JWT with role claim "service_role"
const PUBLISHABLE_PREFIX = "sb_publishable_";
const SECRET_PREFIX = "sb_secret_";

// Extracts the role claim from a JWT without a crypto library. Returns the
// role string, or null if the key isn't a decodable JWT with a role claim.
// Only the payload segment (base64url) is decoded — no signature check is
// performed (not needed: we only classify the format, not its authenticity).
export function jwtRoleClaim(key: string): string | null {
  const parts = key.split(".");
  if (parts.length !== 3) return null;
  try {
    let b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4) b64 += "="
    const g = globalThis as { atob?: (s: string) => string }
    const json = typeof g.atob === "function" ? g.atob(b64) : Buffer.from(b64, "base64").toString("utf8")
    const m = json.match(/"role"\s*:\s*"([^"]+)"/)
    return m ? m[1] : null
  } catch {
    return null
  }
}

// Classifies a client key by its value (fail-closed: anything not reliably
// recognized as "public" counts as unusable).
export function classifyClientKey(key: string | undefined | null): ClientKeyVerdict {
  const trimmed = typeof key === "string" ? key.trim() : ""
  if (trimmed.length === 0) return "missing"

  // New formats are unambiguous by prefix.
  if (trimmed.startsWith(SECRET_PREFIX)) return "secret"
  if (trimmed.startsWith(PUBLISHABLE_PREFIX)) return "public"

  // Distinguish legacy JWT formats via the role claim.
  const role = jwtRoleClaim(trimmed)
  if (role === "service_role") return "secret"
  if (role === "anon") return "public"

  // Neither a known public prefix nor an unambiguous anon JWT: deliberately
  // not let through. An undecodable service_role JWT (or a future secret
  // format) must never be treated as "public".
  return "unknown"
}

// True when the key may be used in the client. Only "public" is
// allowed — "secret", "unknown" and "missing" are not.
export function isAcceptablePublicClientKey(key: string | undefined | null): boolean {
  return classifyClientKey(key) === "public"
}
