"use client"

// Registrierung Business-Owner (Web-Pendant zu Mobiles RegisterScreen +
// services/auth/registerAdmin.ts):
//   1. supabase.auth.signUp — full_name in user_metadata (handle_new_user legt
//      damit das Profil an: Rolle 'employee', noch ohne Firma). Zusätzlich die
//      Firmendaten als Vorbelegung, falls erst die E-Mail bestätigt werden muss.
//   2. Mit Sitzung: setup_company_for_admin (geschützte RPC) -> Dashboard.
//      Schlägt das fehl, bleibt das Konto angemeldet und die Einrichtung wird
//      auf /setup-company fortgesetzt (keine Sackgasse, kein Abmelden).
//   3. Ohne Sitzung (E-Mail-Bestätigung aktiv): Hinweis auf dem Login; nach
//      Bestätigung + Anmeldung leitet der Route-Guard auf /setup-company.
//
// Die ungeschützte Legacy-RPC register_admin_with_company wird nicht mehr
// verwendet.

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { CardContent, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { AuthShell, Field, Notice } from "@/components/auth/AuthShell"
import {
  CompanyFields,
  EMPTY_COMPANY_FORM,
  validateCompanyForm,
  type CompanyFormErrors,
  type CompanyFormValues,
} from "@/components/auth/CompanyFields"
import {
  isValidEmail,
  MIN_PASSWORD_LENGTH,
  normalizeEmail,
  normalizePhone,
  PASSWORD_MISMATCH_MESSAGE,
  validatePassword,
} from "@/lib/auth/validation"
import { toFriendlyAuthErrorMessage } from "@/lib/auth/authErrorMessages"
import {
  PENDING_COMPANY_METADATA_KEY,
  SETUP_FAILED_STORAGE_KEY,
  setupCompanyForAdmin,
  type PendingCompanyMetadata,
} from "@/lib/company/setupCompany"

type AccountErrors = {
  fullName?: string
  email?: string
  password?: string
  passwordConfirm?: string
}

export default function RegisterPage() {
  const router = useRouter()
  const [supabase] = useState(() => createClient())

  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [passwordConfirm, setPasswordConfirm] = useState("")
  const [company, setCompany] = useState<CompanyFormValues>(EMPTY_COMPANY_FORM)

  const [accountErrors, setAccountErrors] = useState<AccountErrors>({})
  const [companyErrors, setCompanyErrors] = useState<CompanyFormErrors>({})
  const [formError, setFormError] = useState("")
  const [busy, setBusy] = useState(false)

  const clearErrors = () => {
    setAccountErrors({})
    setCompanyErrors({})
    setFormError("")
  }

  // Validierung wie Mobiles RegisterScreen.validate().
  const validate = () => {
    const nextAccount: AccountErrors = {}
    if (!fullName.trim()) nextAccount.fullName = "Name ist erforderlich."
    if (!email.trim()) nextAccount.email = "E-Mail ist erforderlich."
    else if (!isValidEmail(email)) nextAccount.email = "Bitte gib eine gültige E-Mail-Adresse ein."
    const passwordError = validatePassword(password)
    if (passwordError) nextAccount.password = passwordError
    else if (!passwordConfirm) nextAccount.passwordConfirm = "Passwort bestätigen."
    else if (password !== passwordConfirm) nextAccount.passwordConfirm = PASSWORD_MISMATCH_MESSAGE

    const nextCompany = validateCompanyForm(company)
    setAccountErrors(nextAccount)
    setCompanyErrors(nextCompany)
    return Object.keys(nextAccount).length === 0 && Object.keys(nextCompany).length === 0
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError("")
    if (!validate()) return

    setBusy(true)

    const pendingCompany: PendingCompanyMetadata = {
      companyName: company.companyName.trim(),
      contactEmail: normalizeEmail(company.companyEmail),
      contactPhone: normalizePhone(company.companyPhone) ?? company.companyPhone.trim(),
      adminPhone: company.adminPhone.trim()
        ? (normalizePhone(company.adminPhone) ?? company.adminPhone.trim())
        : undefined,
    }

    const { data, error } = await supabase.auth.signUp({
      email: normalizeEmail(email),
      password,
      options: {
        data: {
          full_name: fullName.trim(),
          [PENDING_COMPANY_METADATA_KEY]: pendingCompany,
        },
      },
    })

    if (error) {
      setFormError(toFriendlyAuthErrorMessage(error, "Registrierung fehlgeschlagen."))
      setBusy(false)
      return
    }

    // Bei aktiver E-Mail-Bestätigung verschleiert Supabase bestehende Konten:
    // Nutzer ohne Identitäten = E-Mail ist bereits registriert.
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      setFormError("Für diese E-Mail-Adresse existiert bereits ein Konto.")
      setBusy(false)
      return
    }

    if (!data.session) {
      // Konto angelegt, E-Mail muss bestätigt werden. Keine Sitzung -> nichts
      // abzumelden; die Einrichtung folgt nach Bestätigung + Anmeldung.
      router.replace("/login?registered=confirm")
      return
    }

    try {
      await setupCompanyForAdmin(supabase, {
        companyName: company.companyName,
        contactEmail: company.companyEmail,
        contactPhone: company.companyPhone,
        adminPhone: company.adminPhone,
      })
      router.replace("/dashboard")
      router.refresh()
    } catch (err) {
      // Konto existiert und ist angelegt — NICHT abmelden. Einrichtung auf
      // /setup-company fortsetzen (Firmendaten sind vorbelegt).
      try {
        sessionStorage.setItem(
          SETUP_FAILED_STORAGE_KEY,
          err instanceof Error ? err.message : "Firma konnte nicht erstellt werden.",
        )
      } catch {
        // sessionStorage nicht verfügbar — generische Meldung auf der Zielseite.
      }
      router.replace("/setup-company?setup=failed")
      router.refresh()
    }
  }

  return (
    <AuthShell
      heading="Firma erstellen"
      subheading="Lege deinen Firmen-Arbeitsbereich und dein Admin-Konto an."
      title="Registrieren"
      description="Gib deine Daten ein, um dein Admin-Konto und deine Firma zu erstellen."
      wide
    >
      <form onSubmit={handleRegister} noValidate>
        <CardContent className="space-y-6">
          {formError && <Notice tone="error">{formError}</Notice>}

          <div className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Dein Konto
            </p>
            <Field id="fullName" label="Vollständiger Name" error={accountErrors.fullName}>
              <Input
                id="fullName"
                autoComplete="name"
                placeholder="Jane Smith"
                value={fullName}
                onChange={(e) => {
                  setFullName(e.target.value)
                  clearErrors()
                }}
                disabled={busy}
              />
            </Field>
            <Field id="email" label="E-Mail" error={accountErrors.email}>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="admin@meinefirma.de"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  clearErrors()
                }}
                disabled={busy}
              />
            </Field>
            <Field
              id="password"
              label="Passwort"
              error={accountErrors.password}
              hint={`Mindestens ${MIN_PASSWORD_LENGTH} Zeichen.`}
            >
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  clearErrors()
                }}
                disabled={busy}
              />
            </Field>
            <Field id="passwordConfirm" label="Passwort bestätigen" error={accountErrors.passwordConfirm}>
              <Input
                id="passwordConfirm"
                type="password"
                autoComplete="new-password"
                value={passwordConfirm}
                onChange={(e) => {
                  setPasswordConfirm(e.target.value)
                  clearErrors()
                }}
                disabled={busy}
              />
            </Field>
          </div>

          <div className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Deine Firma
            </p>
            <CompanyFields
              values={company}
              errors={companyErrors}
              onChange={(next) => {
                setCompany((prev) => ({ ...prev, ...next }))
                clearErrors()
              }}
              disabled={busy}
            />
          </div>
        </CardContent>

        <CardFooter className="flex flex-col gap-3">
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Firma wird eingerichtet…" : "Firma & Konto erstellen"}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Bereits ein Konto?{" "}
            <Link href="/login" className="underline hover:text-foreground">
              Anmelden
            </Link>
          </p>
        </CardFooter>
      </form>
    </AuthShell>
  )
}
