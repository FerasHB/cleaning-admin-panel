"use client"

// Passwort vergessen: fordert per Supabase resetPasswordForEmail einen
// Reset-Link an (Web-Pendant zu Mobiles ForgotPasswordScreen). Der Link führt
// über /auth/recovery (PKCE-Code-Tausch + Recovery-Marker) auf /reset-password.
//
// Backend-Voraussetzung: <Web-Basis-URL>/auth/recovery muss in der
// Redirect-Allow-List des Supabase-Projekts stehen, sonst leitet Supabase auf
// die Site-URL statt ins Web um.

import { Suspense, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { CardContent, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { AuthShell, Field, Notice } from "@/components/auth/AuthShell"
import { isValidEmail, normalizeEmail } from "@/lib/auth/validation"
import { toFriendlyAuthErrorMessage } from "@/lib/auth/authErrorMessages"

function ForgotPasswordContent() {
  const searchParams = useSearchParams()
  const linkState = searchParams.get("link")
  const [supabase] = useState(() => createClient())

  const [email, setEmail] = useState("")
  const [emailError, setEmailError] = useState("")
  const [formError, setFormError] = useState("")
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setEmailError("")
    setFormError("")

    if (!email.trim()) {
      setEmailError("E-Mail ist erforderlich.")
      return
    }
    if (!isValidEmail(email)) {
      setEmailError("Bitte gib eine gültige E-Mail-Adresse ein.")
      return
    }

    setBusy(true)
    const { error } = await supabase.auth.resetPasswordForEmail(normalizeEmail(email), {
      redirectTo: `${window.location.origin}/auth/recovery`,
    })
    setBusy(false)

    if (error) {
      setFormError(
        toFriendlyAuthErrorMessage(error, "Reset fehlgeschlagen. Bitte versuche es erneut."),
      )
      return
    }
    // Neutrale Bestätigung — verrät nicht, ob ein Konto existiert.
    setSent(true)
  }

  return (
    <AuthShell
      heading="Passwort vergessen"
      subheading="Wir senden dir einen Link zum Zurücksetzen."
      title="Link anfordern"
      description="Gib die E-Mail-Adresse deines Kontos ein."
    >
      <form onSubmit={handleSubmit} noValidate>
        <CardContent className="space-y-4">
          {linkState === "expired" && (
            <Notice tone="error">
              Der Link ist abgelaufen oder wurde bereits verwendet. Bitte fordere einen neuen an.
            </Notice>
          )}
          {linkState === "invalid" && (
            <Notice tone="error">
              Der Link ist ungültig. Bitte öffne ihn im selben Browser, in dem du ihn angefordert
              hast, oder fordere einen neuen an.
            </Notice>
          )}
          {formError && <Notice tone="error">{formError}</Notice>}
          {sent ? (
            <Notice tone="success">
              Falls ein Konto mit dieser E-Mail existiert, haben wir dir einen Link zum Zurücksetzen
              geschickt. Bitte öffne ihn in diesem Browser.
            </Notice>
          ) : (
            <Field id="email" label="E-Mail" error={emailError}>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="admin@example.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  setEmailError("")
                  setFormError("")
                }}
                disabled={busy}
              />
            </Field>
          )}
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          {!sent && (
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Wird gesendet…" : "Link senden"}
            </Button>
          )}
          <Link href="/login" className="text-sm text-muted-foreground underline hover:text-foreground">
            Zurück zur Anmeldung
          </Link>
        </CardFooter>
      </form>
    </AuthShell>
  )
}

export default function ForgotPasswordPage() {
  return (
    <Suspense>
      <ForgotPasswordContent />
    </Suspense>
  )
}
