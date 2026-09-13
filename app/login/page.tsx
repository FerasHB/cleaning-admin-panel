"use client"

// Anmeldung (E-Mail/Passwort). Wohin es danach geht, entscheidet ausschließlich
// der serverseitige Route-Guard (lib/supabase/middleware.ts): aktiver Admin
// mit Firma -> Dashboard, ohne Firma -> Firmeneinrichtung, deaktiviert oder
// kein Admin -> Abmeldung mit Hinweis hier auf der Login-Seite.

import { Suspense, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { CardContent, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { AuthShell, Field, Notice } from "@/components/auth/AuthShell"
import { isValidEmail, normalizeEmail } from "@/lib/auth/validation"
import { toFriendlyAuthErrorMessage } from "@/lib/auth/authErrorMessages"

const STATE_MESSAGES: Record<string, { tone: "error" | "success" | "info"; text: string }> = {
  inactive: {
    tone: "error",
    text: "Dein Zugang wurde von einem Administrator deaktiviert. Bitte wende dich an deine Firma.",
  },
  not_admin: {
    tone: "error",
    text: "Das Admin-Portal ist nur für Administratoren. Mitarbeiter nutzen bitte die TaskOps-App.",
  },
  profile: {
    tone: "error",
    text: "Dein Konto konnte nicht geladen werden. Bitte versuche es erneut oder melde dich ab.",
  },
  // Ältere Weiterleitung (vor PR3) — gleiche Bedeutung wie not_admin.
  access_denied: {
    tone: "error",
    text: "Zugriff verweigert. Bitte mit einem Admin-Konto anmelden.",
  },
}

function LoginContent() {
  const searchParams = useSearchParams()
  const errorParam = searchParams.get("error")
  const resetDone = searchParams.get("reset") === "success"
  const confirmPending = searchParams.get("registered") === "confirm"
  const stateMessage = errorParam ? STATE_MESSAGES[errorParam] : undefined

  const router = useRouter()
  const [supabase] = useState(() => createClient())
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [emailError, setEmailError] = useState("")
  const [passwordError, setPasswordError] = useState("")
  const [formError, setFormError] = useState("")
  const [loading, setLoading] = useState(false)

  const validate = () => {
    let ok = true
    setEmailError("")
    setPasswordError("")
    setFormError("")
    if (!email.trim()) {
      setEmailError("E-Mail ist erforderlich.")
      ok = false
    } else if (!isValidEmail(email)) {
      setEmailError("Bitte gib eine gültige E-Mail-Adresse ein.")
      ok = false
    }
    if (!password) {
      setPasswordError("Passwort ist erforderlich.")
      ok = false
    }
    return ok
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: normalizeEmail(email),
        password,
      })
      if (error) {
        setFormError(toFriendlyAuthErrorMessage(error, "E-Mail oder Passwort ist falsch."))
        setLoading(false)
        return
      }
      // Der Route-Guard wertet die frische Sitzung bei dieser Navigation aus
      // und leitet passend weiter (Dashboard, Firmeneinrichtung oder Hinweis).
      router.replace("/dashboard")
      router.refresh()
    } catch (err) {
      setFormError(
        toFriendlyAuthErrorMessage(err, "Anmeldung fehlgeschlagen. Bitte erneut versuchen."),
      )
      setLoading(false)
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.replace("/login")
    router.refresh()
  }

  return (
    <AuthShell
      heading="Admin-Portal"
      subheading="Mitarbeiterverwaltung für Reinigungsunternehmen"
      title="Anmelden"
      description="E-Mail und Passwort eingeben, um zur Übersicht zu gelangen."
    >
      <form onSubmit={handleLogin} noValidate>
        <CardContent className="space-y-4">
          {resetDone && (
            <Notice tone="success">
              Dein Passwort wurde geändert. Bitte melde dich mit dem neuen Passwort an.
            </Notice>
          )}
          {confirmPending && (
            <Notice tone="info">
              Konto erstellt. Bitte bestätige deine E-Mail-Adresse über den Link in der E-Mail und
              melde dich danach an — die Firmeneinrichtung wird anschließend fortgesetzt.
            </Notice>
          )}
          {stateMessage && (
            <Notice tone={stateMessage.tone}>
              {stateMessage.text}
              {errorParam === "profile" && (
                <>
                  {" "}
                  <button type="button" onClick={handleSignOut} className="underline">
                    Abmelden
                  </button>
                </>
              )}
            </Notice>
          )}
          {formError && <Notice tone="error">{formError}</Notice>}

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
              disabled={loading}
            />
          </Field>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium leading-none" htmlFor="password">
                Passwort
              </label>
              <Link
                href="/forgot-password"
                className="text-xs font-medium text-muted-foreground underline hover:text-foreground"
              >
                Passwort vergessen?
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                setPasswordError("")
                setFormError("")
              }}
              disabled={loading}
            />
            {passwordError && <p className="text-xs font-medium text-destructive">{passwordError}</p>}
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Wird angemeldet…" : "Anmelden"}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Neu hier?{" "}
            <Link href="/register" className="font-medium underline hover:text-foreground">
              Firma erstellen
            </Link>
          </p>
        </CardFooter>
      </form>
    </AuthShell>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  )
}
