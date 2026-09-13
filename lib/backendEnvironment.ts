// lib/backendEnvironment.ts
// Derives a purely observational backend-environment label (PROD/STAGING/
// UNKNOWN) from the existing NEXT_PUBLIC_SUPABASE_URL — no new env
// variable, no duplication. Goal: whoever is looking at the admin panel
// should see at a glance which backend a session is actually talking to,
// to avoid silent environment mix-ups (Staging vs. Production).
//
// Ported from the Mobile app's utils/backendEnvironment.ts so Web and
// Mobile agree on the same two project refs and the same label.
//
// The two project refs are NOT secrets: they already appear in plain sight
// in the URL itself (https://<ref>.supabase.co) and in project docs. This
// module never returns the anon/publishable key or anything sensitive —
// only the classification.

export type BackendEnvironmentLabel = "PROD" | "STAGING" | "UNKNOWN"

const PROD_REF = "ivzsbspopudqgobunsdv"
const STAGING_REF = "legzogskvcmicdgowyax"

// Deliberately a substring match on the project ref, not an exact URL
// comparison — survives things like a changed port/protocol in local
// tunneling scenarios, as long as the ref itself is in the host URL.
export function deriveBackendEnvironmentLabel(
  supabaseUrl: string | undefined | null,
): BackendEnvironmentLabel {
  if (typeof supabaseUrl !== "string" || supabaseUrl.trim().length === 0) {
    return "UNKNOWN"
  }
  if (supabaseUrl.includes(PROD_REF)) return "PROD"
  if (supabaseUrl.includes(STAGING_REF)) return "STAGING"
  return "UNKNOWN"
}

// Visibility rule: show the indicator whenever the backend is NOT
// Production. A real Production deployment should never show this badge —
// only STAGING (or an unrecognized/misconfigured backend) does.
export function shouldShowBackendEnvironmentIndicator(
  label: BackendEnvironmentLabel,
): boolean {
  return label !== "PROD"
}
