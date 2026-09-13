// app/reset-password/page.tsx
// Neues Passwort setzen — NUR mit einer echten Recovery-Sitzung (aus
// /auth/recovery). Die Prüfung läuft serverseitig: httpOnly-Marker gebunden an
// die verifizierte session_id bzw. amr "recovery". Eine normale Sitzung (oder
// keine) bekommt hier kein Passwort-Formular.

import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { isRecoverySession, RECOVERY_COOKIE } from "@/lib/auth/authState"
import { ResetPasswordForm } from "./ResetPasswordForm"

export default async function ResetPasswordPage() {
  const cookieStore = await cookies()
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const allowed = isRecoverySession(data?.claims, cookieStore.get(RECOVERY_COOKIE)?.value)

  return <ResetPasswordForm allowed={allowed} />
}
