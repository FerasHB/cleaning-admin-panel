"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field, Notice } from "@/components/auth/AuthShell"

// Ein Eingabefeld pro Kalenderjahr, das der Urlaubszeitraum berührt — wie
// Mobiles VacationDeductionSheet. Verhindert strukturell, dass ein Urlaub
// über einen Jahreswechsel alle Tage stillschweigend im Startjahr abbucht.
function yearsInRange(startDate: string, endDate: string): number[] {
  const startYear = Number(startDate.slice(0, 4))
  const endYear = Number(endDate.slice(0, 4))
  const years: number[] = []
  for (let y = startYear; y <= endYear; y++) years.push(y)
  return years
}

export function VacationDeductionPanel({
  startDate,
  endDate,
  onConfirm,
  onCancel,
  disabled,
}: {
  startDate: string
  endDate: string
  onConfirm: (deductions: Record<string, number>) => void
  onCancel: () => void
  disabled?: boolean
}) {
  const years = yearsInRange(startDate, endDate)
  const [values, setValues] = useState<Record<number, string>>(() =>
    Object.fromEntries(years.map((y) => [y, ""])),
  )
  const [error, setError] = useState<string | null>(null)

  const handleConfirm = () => {
    const deductions: Record<string, number> = {}
    for (const y of years) {
      const raw = (values[y] ?? "").trim().replace(",", ".")
      const parsed = raw === "" ? 0 : Number(raw)
      if (!Number.isFinite(parsed) || parsed < 0) {
        setError(`Bitte eine gültige Tageszahl für ${y} angeben (0 oder mehr).`)
        return
      }
      deductions[String(y)] = parsed
    }
    setError(null)
    onConfirm(deductions)
  }

  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
      <p className="text-sm font-semibold text-foreground">Abzugstage bestätigen</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Für diesen Mitarbeiter wird ein Urlaubskonto geführt. Bitte die abzuziehenden Tage je Jahr angeben.
      </p>
      {error && (
        <div className="mt-2">
          <Notice tone="error">{error}</Notice>
        </div>
      )}
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {years.map((y) => (
          <Field key={y} id={`deduction-${y}`} label={String(y)}>
            <Input
              id={`deduction-${y}`}
              inputMode="decimal"
              placeholder="0"
              value={values[y] ?? ""}
              onChange={(e) => setValues((prev) => ({ ...prev, [y]: e.target.value }))}
              disabled={disabled}
            />
          </Field>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <Button type="button" size="sm" onClick={handleConfirm} disabled={disabled}>
          Genehmigen
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onCancel} disabled={disabled}>
          Abbrechen
        </Button>
      </div>
    </div>
  )
}
