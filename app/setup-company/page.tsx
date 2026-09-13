"use client"

// Firmeneinrichtung für angemeldete Konten ohne Firma (Web-Pendant zu Mobiles
// SetupCompanyScreen). Erreichbar nur über den Route-Guard im Zustand
// "no_company" — z. B. nach Registrierung mit E-Mail-Bestätigung oder wenn die
// Einrichtung direkt nach der Registrierung fehlschlug. Firmendaten aus der
// Registrierung werden aus user_metadata vorbelegt.

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { CardContent, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AuthShell, Notice } from "@/components/auth/AuthShell"
import {
  CompanyFields,
  EMPTY_COMPANY_FORM,
  validateCompanyForm,
  type CompanyFormErrors,
  type CompanyFormValues,
} from "@/components/auth/CompanyFields"
import {
  PENDING_COMPANY_METADATA_KEY,
  SETUP_FAILED_STORAGE_KEY,
  setupCompanyForAdmin,
  type PendingCompanyMetadata,
} from "@/lib/company/setupCompany"

function SetupCompanyContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [supabase] = useState(() => createClient())
  const [values, setValues] = useState<CompanyFormValues>(EMPTY_COMPANY_FORM)
  const [errors, setErrors] = useState<CompanyFormErrors>({})
  const [formError, setFormError] = useState("")
  const [busy, setBusy] = useState(false)
  const [accountEmail, setAccountEmail] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    const setupFailed = searchParams.get("setup") === "failed"

    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return

      // Fehlermeldung aus einem fehlgeschlagenen Einrichtungsversuch direkt
      // nach der Registrierung übernehmen.
      if (setupFailed) {
        let stored: string | null = null
        try {
          stored = sessionStorage.getItem(SETUP_FAILED_STORAGE_KEY)
          sessionStorage.removeItem(SETUP_FAILED_STORAGE_KEY)
        } catch {
          // sessionStorage nicht verfügbar
        }
        setFormError(
          stored ||
            "Dein Konto wurde erstellt, aber die Firma konnte nicht eingerichtet werden. Bitte versuche es erneut.",
        )
      }

      if (!data.user) return
      setAccountEmail(data.user.email ?? null)
      const pending = data.user.user_metadata?.[PENDING_COMPANY_METADATA_KEY] as
        | PendingCompanyMetadata
        | undefined
      if (pending) {
        setValues({
          companyName: pending.companyName ?? "",
          companyEmail: pending.contactEmail ?? "",
          companyPhone: pending.contactPhone ?? "",
          adminPhone: pending.adminPhone ?? "",
        })
      }
    })

    return () => {
      mounted = false
    }
  }, [supabase, searchParams])

  const patch = (next: Partial<CompanyFormValues>) => {
    setValues((prev) => ({ ...prev, ...next }))
    setErrors({})
    setFormError("")
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const nextErrors = validateCompanyForm(values)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setBusy(true)
    setFormError("")
    try {
      await setupCompanyForAdmin(supabase, {
        companyName: values.companyName,
        contactEmail: values.companyEmail,
        contactPhone: values.companyPhone,
        adminPhone: values.adminPhone,
      })
      // Der Route-Guard sieht bei dieser Navigation einen Admin mit Firma.
      router.replace("/dashboard")
      router.refresh()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Firma konnte nicht erstellt werden.")
      setBusy(false)
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.replace("/login")
    router.refresh()
  }

  return (
    <AuthShell
      heading="Einrichtung abschließen"
      subheading="Dein Konto ist angelegt — jetzt fehlt nur noch deine Firma."
      title="Firma erstellen"
      description="Dieser Schritt verknüpft dein Konto mit einem Firmen-Arbeitsbereich."
      wide
    >
      <form onSubmit={handleSubmit} noValidate>
        <CardContent className="space-y-4">
          {formError && <Notice tone="error">{formError}</Notice>}
          <CompanyFields values={values} errors={errors} onChange={patch} disabled={busy} />
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Wird eingerichtet…" : "Einrichtung abschließen"}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            {accountEmail ? <>Angemeldet als {accountEmail}. </> : null}
            <button type="button" onClick={handleSignOut} className="underline hover:text-foreground">
              Abmelden
            </button>
          </p>
        </CardFooter>
      </form>
    </AuthShell>
  )
}

export default function SetupCompanyPage() {
  return (
    <Suspense>
      <SetupCompanyContent />
    </Suspense>
  )
}
