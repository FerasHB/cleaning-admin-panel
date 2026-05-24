"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Briefcase } from "lucide-react"

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
  const suffix = Math.random().toString(36).slice(2, 7)
  return `${base}-${suffix}`
}

function RegisterContent() {
  const searchParams = useSearchParams()
  const isIncomplete = searchParams.get("incomplete") === "true"

  const [fullName, setFullName] = useState("")
  const [companyName, setCompanyName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [existingName, setExistingName] = useState<string | null>(null)

  const router = useRouter()
  const supabase = createClient()

  // When arriving via ?incomplete=true, load the authenticated user's name
  // so we can pre-fill it and skip the auth step.
  useEffect(() => {
    if (!isIncomplete) return
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        // Session expired — fall back to full registration
        router.replace("/register")
      }
    })
    supabase
      .from("profiles")
      .select("full_name")
      .then(({ data }) => {
        if (data?.[0]?.full_name) setExistingName(data[0].full_name)
      })
  }, [isIncomplete])

  // Full registration: create auth user + company + profile
  const handleFullRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setBusy(true)

    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
    })

    if (signUpError) {
      setError(signUpError.message)
      setBusy(false)
      return
    }

    if (!authData.session) {
      setError(
        "A confirmation email has been sent. Please confirm your email address, then sign in. " +
          "(Note: for the registration to complete automatically, email confirmation must be disabled in your Supabase project.)"
      )
      await supabase.auth.signOut()
      setBusy(false)
      return
    }

    await runCompanySetup(fullName.trim(), companyName.trim())
  }

  // Partial recovery: authenticated admin with no company — only create company + update profile
  const handleCompleteSetup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    await runCompanySetup(existingName ?? fullName.trim(), companyName.trim())
  }

  // Shared: call the atomic RPC, handle errors, redirect on success
  const runCompanySetup = async (name: string, company: string) => {
    const { error: rpcError } = await supabase.rpc("register_admin_with_company", {
      p_full_name: name,
      p_company_name: company,
      p_company_slug: slugify(company),
    })

    if (rpcError) {
      if (!isIncomplete) {
        // Auth user was just created — sign them out so they are not stuck
        await supabase.auth.signOut()
      }
      setError(
        "Company setup failed: " +
          rpcError.message +
          (isIncomplete
            ? " — Please try again."
            : " — Your account was created but setup did not complete. Please try registering again.")
      )
      setBusy(false)
      return
    }

    router.push("/dashboard")
    router.refresh()
  }

  // ── Incomplete-setup mode ────────────────────────────────────────────────
  if (isIncomplete) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4 bg-muted/20">
        <div className="w-full max-w-[440px]">
          <div className="mb-8 flex flex-col items-center text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Briefcase className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-2xl font-bold">Einrichtung abschließen</h1>
            <p className="text-muted-foreground mt-2">
              Ihr Konto existiert bereits, aber der Firmen-Arbeitsbereich wurde noch nicht erstellt.
              Geben Sie den Firmennamen ein, um die Einrichtung abzuschließen.
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Firma erstellen</CardTitle>
              <CardDescription>
                Dieser Schritt verknüpft Ihr Konto mit einem Firmen-Arbeitsbereich.
              </CardDescription>
            </CardHeader>

            <form onSubmit={handleCompleteSetup}>
              <CardContent className="space-y-4">
                {error && (
                  <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive font-medium">
                    {error}
                  </div>
                )}

                {!existingName && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium leading-none" htmlFor="fullNameIncomplete">
                      Vollständiger Name
                    </label>
                    <Input
                      id="fullNameIncomplete"
                      type="text"
                      placeholder="Jane Smith"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      disabled={busy}
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-sm font-medium leading-none" htmlFor="companyNameIncomplete">
                    Firmenname
                  </label>
                  <Input
                    id="companyNameIncomplete"
                    type="text"
                    placeholder="Meine Reinigungsfirma GmbH"
                    required
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    disabled={busy}
                  />
                </div>
              </CardContent>

              <CardFooter className="flex flex-col gap-3">
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? "Wird eingerichtet…" : "Einrichtung abschließen"}
                </Button>
                <p className="text-sm text-muted-foreground text-center">
                  Falsches Konto?{" "}
                  <Link href="/login" className="underline hover:text-foreground">
                    Abmelden und neu anmelden
                  </Link>
                </p>
              </CardFooter>
            </form>
          </Card>
        </div>
      </div>
    )
  }

  // ── Full registration mode ───────────────────────────────────────────────
  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-muted/20">
      <div className="w-full max-w-[440px]">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Briefcase className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">Firma erstellen</h1>
          <p className="text-muted-foreground mt-2">
            Create your company workspace and admin account.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Registrieren</CardTitle>
            <CardDescription>
              Geben Sie Ihre Daten ein, um Ihr Admin-Konto und Ihre Firma zu erstellen.
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleFullRegister}>
            <CardContent className="space-y-4">
              {error && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive font-medium">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium leading-none" htmlFor="fullName">
                  Vollständiger Name
                </label>
                <Input
                  id="fullName"
                  type="text"
                  placeholder="Jane Smith"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  disabled={busy}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium leading-none" htmlFor="companyName">
                  Firmenname
                </label>
                <Input
                  id="companyName"
                  type="text"
                  placeholder="Meine Reinigungsfirma GmbH"
                  required
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  disabled={busy}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium leading-none" htmlFor="email">
                  E-Mail
                </label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@meinefirma.de"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={busy}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium leading-none" htmlFor="password">
                  Passwort
                </label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Mindestens 8 Zeichen"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={busy}
                />
              </div>
            </CardContent>

            <CardFooter className="flex flex-col gap-3">
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? "Firma wird eingerichtet…" : "Firma & Konto erstellen"}
              </Button>
              <p className="text-sm text-muted-foreground text-center">
                Bereits ein Konto?{" "}
                <Link href="/login" className="underline hover:text-foreground">
                  Anmelden
                </Link>
              </p>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  )
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterContent />
    </Suspense>
  )
}
