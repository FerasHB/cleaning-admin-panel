"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field, Notice } from "@/components/auth/AuthShell"
import {
  MIN_PASSWORD_LENGTH,
  PASSWORD_MISMATCH_MESSAGE,
  validateNewPassword,
  validatePassword,
} from "@/lib/auth/validation"
import { toFriendlyAuthErrorMessage } from "@/lib/auth/authErrorMessages"

// Passwort ändern in der laufenden Sitzung — wie Mobiles ChangePasswordScreen:
// neues Passwort + Bestätigung (keine Abfrage des aktuellen Passworts, die
// Mobile/Backend nicht vorsehen), supabase.auth.updateUser, Sitzung bleibt
// bestehen. Getrennt vom Recovery-Flow (/reset-password): Recovery-Sitzungen
// erreichen die Admin-Routen gar nicht (Middleware).
export function ChangePasswordForm() {
  const [supabase] = useState(() => createClient())
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [passwordError, setPasswordError] = useState<string | undefined>()
  const [confirmError, setConfirmError] = useState<string | undefined>()
  const [formError, setFormError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [saving, setSaving] = useState(false)

  const clearFeedback = () => {
    setPasswordError(undefined)
    setConfirmError(undefined)
    setFormError(null)
    setSuccess(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (saving) return
    clearFeedback()

    const error = validateNewPassword(password, confirm)
    if (error) {
      if (error === PASSWORD_MISMATCH_MESSAGE) setConfirmError(error)
      else setPasswordError(error)
      return
    }

    setSaving(true)
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) {
        setFormError(
          toFriendlyAuthErrorMessage(updateError, "Passwort konnte nicht geändert werden."),
        )
        return
      }
      setPassword("")
      setConfirm("")
      setSuccess(true)
    } catch (err) {
      setFormError(toFriendlyAuthErrorMessage(err, "Passwort konnte nicht geändert werden."))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {formError && <Notice tone="error">{formError}</Notice>}
      {success && <Notice tone="success">Dein Passwort wurde erfolgreich geändert.</Notice>}

      <Field
        id="new-password"
        label="Neues Passwort"
        error={passwordError}
        hint={`Mindestens ${MIN_PASSWORD_LENGTH} Zeichen.`}
      >
        <Input
          id="new-password"
          type="password"
          autoComplete="new-password"
          placeholder={`Mindestens ${MIN_PASSWORD_LENGTH} Zeichen`}
          value={password}
          onChange={(e) => {
            setPassword(e.target.value)
            clearFeedback()
          }}
          onBlur={() => {
            if (password) setPasswordError(validatePassword(password) ?? undefined)
          }}
          disabled={saving}
          aria-invalid={!!passwordError}
        />
      </Field>

      <Field id="confirm-password" label="Passwort bestätigen" error={confirmError}>
        <Input
          id="confirm-password"
          type="password"
          autoComplete="new-password"
          placeholder="Passwort wiederholen"
          value={confirm}
          onChange={(e) => {
            setConfirm(e.target.value)
            clearFeedback()
          }}
          onBlur={() => {
            if (confirm && password && confirm !== password) {
              setConfirmError(PASSWORD_MISMATCH_MESSAGE)
            }
          }}
          disabled={saving}
          aria-invalid={!!confirmError}
        />
      </Field>

      <div className="flex justify-end">
        <Button type="submit" disabled={saving || !password || !confirm}>
          {saving ? "Wird gespeichert…" : "Passwort speichern"}
        </Button>
      </div>
    </form>
  )
}
