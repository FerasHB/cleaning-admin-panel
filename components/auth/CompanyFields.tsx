"use client"

// Firmen-Felder für Registrierung und Firmeneinrichtung (wie Mobiles
// RegisterScreen/SetupCompanyScreen): Firmenname, Firmen-E-Mail und
// Firmen-Telefon sind Pflicht, die eigene Telefonnummer ist optional.

import { Input } from "@/components/ui/input"
import { Field } from "@/components/auth/AuthShell"
import { isValidEmail, isValidPhone } from "@/lib/auth/validation"

export type CompanyFormValues = {
  companyName: string
  companyEmail: string
  companyPhone: string
  adminPhone: string
}

export type CompanyFormErrors = Partial<Record<keyof CompanyFormValues, string>>

export const EMPTY_COMPANY_FORM: CompanyFormValues = {
  companyName: "",
  companyEmail: "",
  companyPhone: "",
  adminPhone: "",
}

export function validateCompanyForm(values: CompanyFormValues): CompanyFormErrors {
  const errors: CompanyFormErrors = {}
  if (!values.companyName.trim()) errors.companyName = "Firmenname ist erforderlich."
  if (!values.companyEmail.trim()) errors.companyEmail = "Firmen-E-Mail ist erforderlich."
  else if (!isValidEmail(values.companyEmail)) {
    errors.companyEmail = "Bitte gib eine gültige E-Mail-Adresse ein."
  }
  if (!values.companyPhone.trim()) errors.companyPhone = "Firmen-Telefon ist erforderlich."
  else if (!isValidPhone(values.companyPhone)) {
    errors.companyPhone = "Bitte gib eine gültige Telefonnummer ein."
  }
  if (values.adminPhone.trim() && !isValidPhone(values.adminPhone)) {
    errors.adminPhone = "Bitte gib eine gültige Telefonnummer ein."
  }
  return errors
}

export function CompanyFields({
  values,
  errors,
  onChange,
  disabled,
  showAdminPhone = true,
}: {
  values: CompanyFormValues
  errors: CompanyFormErrors
  onChange: (patch: Partial<CompanyFormValues>) => void
  disabled?: boolean
  showAdminPhone?: boolean
}) {
  return (
    <>
      <Field id="company-name" label="Firmenname" error={errors.companyName}>
        <Input
          id="company-name"
          autoComplete="organization"
          placeholder="Meine Reinigungsfirma GmbH"
          value={values.companyName}
          onChange={(e) => onChange({ companyName: e.target.value })}
          disabled={disabled}
        />
      </Field>
      <Field id="company-email" label="Firmen-E-Mail" error={errors.companyEmail}>
        <Input
          id="company-email"
          type="email"
          placeholder="kontakt@meinefirma.de"
          value={values.companyEmail}
          onChange={(e) => onChange({ companyEmail: e.target.value })}
          disabled={disabled}
        />
      </Field>
      <Field
        id="company-phone"
        label="Firmen-Telefon"
        error={errors.companyPhone}
        hint="z. B. 0231 1234567 oder +49 231 1234567"
      >
        <Input
          id="company-phone"
          type="tel"
          autoComplete="tel"
          value={values.companyPhone}
          onChange={(e) => onChange({ companyPhone: e.target.value })}
          disabled={disabled}
        />
      </Field>
      {showAdminPhone && (
        <Field
          id="admin-phone"
          label={
            <>
              Deine Telefonnummer <span className="font-normal text-muted-foreground">(optional)</span>
            </>
          }
          error={errors.adminPhone}
        >
          <Input
            id="admin-phone"
            type="tel"
            value={values.adminPhone}
            onChange={(e) => onChange({ adminPhone: e.target.value })}
            disabled={disabled}
          />
        </Field>
      )}
    </>
  )
}
