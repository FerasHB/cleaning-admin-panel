"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Field, Notice } from "@/components/auth/AuthShell"

export function RejectVacationPanel({
  onConfirm,
  onCancel,
  disabled,
}: {
  onConfirm: (adminNote: string) => void
  onCancel: () => void
  disabled?: boolean
}) {
  const [note, setNote] = useState("")
  const [error, setError] = useState<string | null>(null)

  const handleConfirm = () => {
    if (!note.trim()) {
      setError("Bitte einen Grund für die Ablehnung angeben.")
      return
    }
    setError(null)
    onConfirm(note.trim())
  }

  return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
      <p className="text-sm font-semibold text-foreground">Urlaubsantrag ablehnen</p>
      {error && (
        <div className="mt-2">
          <Notice tone="error">{error}</Notice>
        </div>
      )}
      <div className="mt-3">
        <Field id="reject-note" label="Grund (für den Mitarbeiter sichtbar)">
          <textarea
            id="reject-note"
            className="flex min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
            value={note}
            onChange={(e) => {
              setNote(e.target.value)
              setError(null)
            }}
            disabled={disabled}
          />
        </Field>
      </div>
      <div className="mt-3 flex gap-2">
        <Button type="button" size="sm" variant="destructive" onClick={handleConfirm} disabled={disabled}>
          Ablehnen
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onCancel} disabled={disabled}>
          Abbrechen
        </Button>
      </div>
    </div>
  )
}
