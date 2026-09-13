"use client"

// Formular zum Setzen des neuen Passworts (Web-Pendant zu Mobiles
// ResetPasswordScreen). Ablauf nach erfolgreichem updateUser():
//   1. accept_own_invite() — schließt eine offene Mitarbeiter-Einladung ab
//      (serverseitig No-Op für Admins/akzeptierte Konten), wie Mobile.
//   2. Abmelden — aus einem Reset-Link entsteht nie eine App-Sitzung; der
//      Nutzer meldet sich bewusst mit dem neuen Passwort an.
// Den Recovery-Marker entfernt der Route-Guard beim nächsten Request, sobald
// keine passende Sitzung mehr existiert.

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { CardContent, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { AuthShell, Field, Notice } from "@/components/auth/AuthShell"
import { MIN_PASSWORD_LENGTH, validateNewPassword } from "@/lib/auth/validation"
import { toFriendlyAuthErrorMessage } from "@/lib/auth/authErrorMessages"

export function ResetPasswordForm({ allowed }: { allowed: boolean }) {
  const router = useRouter()
  const [supabase] = useState(() => createClient())
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [fieldError, setFieldError] = useState("")
  const [formError, setFormError] = useState("")
  const [busy, setBusy] = useState(false)
  const [acceptRetryNeeded, setAcceptRetryNeeded] = useState(false)

  const leaveToLogin = async (query: string) => {
    await supabase.auth.signOut()
    // Der Route-Guard sieht bei dieser Navigation keine Sitzung mehr und
    // räumt den Recovery-Marker ab.
    router.replace(`/login${query}`)
    router.refresh()
  }

  const finishAfterPasswordSet = async () => {
    const { error: acceptError } = await supabase.rpc("accept_own_invite")
    if (acceptError) {
      // Wie Mobile: Sitzung offen lassen und Retry anbieten, statt still zum
      // Login zu leiten (sonst bliebe eine offene Einladung hängen).
      setAcceptRetryNeeded(true)
      return
    }
    setAcceptRetryNeeded(false)
    await leaveToLogin("?reset=success")
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFieldError("")
    setFormError("")

    const validationError = validateNewPassword(password, confirm)
    if (validationError) {
      setFieldError(validationError)
      return
    }

    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setFormError(
        toFriendlyAuthErrorMessage(error, "Passwort konnte nicht gespeichert werden."),
      )
      setBusy(false)
      return
    }

    await finishAfterPasswordSet()
    setBusy(false)
  }

  const handleRetryAccept = async () => {
    setBusy(true)
    await finishAfterPasswordSet()
    setBusy(false)
  }

  if (!allowed) {
    return (
      <AuthShell
        heading="Passwort zurücksetzen"
        title="Link ungültig"
        description="Diese Seite ist nur über einen gültigen Link aus der E-Mail erreichbar."
      >
        <CardContent>
          <Notice tone="error">
            Der Link ist ungültig oder abgelaufen. Bitte fordere einen neuen Link an.
          </Notice>
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <Link href="/forgot-password" className="w-full">
            <Button className="w-full">Neuen Link anfordern</Button>
          </Link>
          <Link href="/login" className="text-sm text-muted-foreground underline hover:text-foreground">
            Zurück zur Anmeldung
          </Link>
        </CardFooter>
      </AuthShell>
    )
  }

  if (acceptRetryNeeded) {
    return (
      <AuthShell heading="Passwort zurücksetzen" title="Fast geschafft">
        <CardContent>
          <Notice tone="error">
            Dein neues Passwort wurde gespeichert, aber die Einrichtung konnte nicht abgeschlossen
            werden. Bitte versuche es erneut.
          </Notice>
        </CardContent>
        <CardFooter>
          <Button className="w-full" onClick={handleRetryAccept} disabled={busy}>
            {busy ? "Wird abgeschlossen…" : "Erneut versuchen"}
          </Button>
        </CardFooter>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      heading="Passwort zurücksetzen"
      title="Neues Passwort festlegen"
      description={`Mindestens ${MIN_PASSWORD_LENGTH} Zeichen.`}
    >
      <form onSubmit={handleSubmit} noValidate>
        <CardContent className="space-y-4">
          {formError && <Notice tone="error">{formError}</Notice>}
          <Field id="new-password" label="Neues Passwort">
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                setFieldError("")
              }}
              disabled={busy}
            />
          </Field>
          <Field id="confirm-password" label="Passwort bestätigen" error={fieldError}>
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => {
                setConfirm(e.target.value)
                setFieldError("")
              }}
              disabled={busy}
            />
          </Field>
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Wird gespeichert…" : "Passwort speichern"}
          </Button>
          <button
            type="button"
            onClick={() => leaveToLogin("")}
            disabled={busy}
            className="text-sm text-muted-foreground underline hover:text-foreground"
          >
            Abbrechen
          </button>
        </CardFooter>
      </form>
    </AuthShell>
  )
}
