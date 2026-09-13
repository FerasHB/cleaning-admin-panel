"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field, Notice } from "@/components/auth/AuthShell"
import { isValidEmail, isValidPhone } from "@/lib/auth/validation"
import { updateOwnCompany, type CompanyContact } from "@/lib/company/company.service"

type Values = { name: string; contactEmail: string; contactPhone: string }
type Errors = Partial<Record<keyof Values, string>>

function toValues(company: CompanyContact): Values {
  return {
    name: company.name ?? "",
    contactEmail: company.contactEmail ?? "",
    contactPhone: company.contactPhone ?? "",
  }
}

// Validierung wie Mobiles CompanySettingsScreen.
function validate(values: Values): Errors {
  const errors: Errors = {}
  if (!values.name.trim()) errors.name = "Firmenname ist erforderlich."
  if (values.contactEmail.trim() && !isValidEmail(values.contactEmail)) {
    errors.contactEmail = "Bitte gib eine gültige E-Mail-Adresse ein."
  }
  if (values.contactPhone.trim() && !isValidPhone(values.contactPhone)) {
    errors.contactPhone = "Bitte gib eine gültige Telefonnummer ein (z. B. 0170 1234567)."
  }
  return errors
}

const FIELDS: {
  key: keyof Values
  id: string
  label: string
  placeholder: string
  type: string
  autoComplete: string
}[] = [
  { key: "name", id: "company-name", label: "Firmenname", placeholder: "Muster Reinigung GmbH", type: "text", autoComplete: "organization" },
  { key: "contactEmail", id: "company-email", label: "Firmen-E-Mail", placeholder: "kontakt@firma.de", type: "email", autoComplete: "email" },
  { key: "contactPhone", id: "company-phone", label: "Firmen-Telefon", placeholder: "0170 1234567", type: "tel", autoComplete: "tel" },
]

export function CompanySettingsForm({ company }: { company: CompanyContact }) {
  const [supabase] = useState(() => createClient())
  const [baseline, setBaseline] = useState<Values>(() => toValues(company))
  const [values, setValues] = useState<Values>(baseline)
  const [errors, setErrors] = useState<Errors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const isDirty = (Object.keys(values) as (keyof Values)[]).some(
    (k) => values[k].trim() !== baseline[k].trim(),
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (saving || !isDirty) return

    setFormError(null)
    setSaved(false)
    const nextErrors = validate(values)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setSaving(true)
    try {
      const updated = await updateOwnCompany(supabase, values)
      // Server-normalisierte Werte (z. B. Telefon in E.164) übernehmen.
      const next = toValues(updated)
      setBaseline(next)
      setValues(next)
      setSaved(true)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Firmendaten konnten nicht gespeichert werden.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {formError && <Notice tone="error">{formError}</Notice>}
      {saved && <Notice tone="success">Firmendaten gespeichert.</Notice>}

      {FIELDS.map((field) => (
        <Field key={field.key} id={field.id} label={field.label} error={errors[field.key]}>
          <Input
            id={field.id}
            type={field.type}
            autoComplete={field.autoComplete}
            placeholder={field.placeholder}
            value={values[field.key]}
            onChange={(e) => {
              const text = e.target.value
              setValues((prev) => ({ ...prev, [field.key]: text }))
              setErrors((prev) => ({ ...prev, [field.key]: undefined }))
              setFormError(null)
              setSaved(false)
            }}
            disabled={saving}
            aria-invalid={!!errors[field.key]}
          />
        </Field>
      ))}

      <p className="text-xs text-muted-foreground">
        Die Firmen-E-Mail ist unabhängig von deiner Anmelde-Adresse.
      </p>

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setValues(baseline)
            setErrors({})
            setFormError(null)
          }}
          disabled={saving || !isDirty}
        >
          Verwerfen
        </Button>
        <Button type="submit" disabled={saving || !isDirty}>
          {saving ? "Wird gespeichert…" : "Speichern"}
        </Button>
      </div>
    </form>
  )
}
