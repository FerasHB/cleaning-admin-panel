"use client"

import { useEffect, useState } from "react"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/database.types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field, Notice } from "@/components/auth/AuthShell"
import { createAbsence, toAbsenceMessage, type Absence, type AbsenceType } from "@/lib/absences/absences"
import { getEmployees, type EmployeeOption } from "@/lib/jobs/jobs.service"

type DB = SupabaseClient<Database>

// "Abwesenheit erfassen" — Web-Pendant zu Mobiles AdminCreateAbsenceScreen.
// Erlaubt bewusst Backdating und deaktivierte Mitarbeiter (historische
// Nacherfassung) — die RPC admin_create_absence prüft das serverseitig
// identisch, hier wird nichts zusätzlich eingeschränkt.
export function CreateAbsenceForm({
  supabase,
  employeeId,
  employeeName,
  onCreated,
  onCancel,
}: {
  supabase: DB
  /** Vorgewählter Mitarbeiter (z. B. von der Mitarbeiter-Detailseite) — Picker entfällt dann. */
  employeeId?: string
  employeeName?: string
  onCreated: (absence: Absence) => void
  onCancel: () => void
}) {
  const [employees, setEmployees] = useState<EmployeeOption[]>([])
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(employeeId ?? "")
  const [type, setType] = useState<AbsenceType>("vacation")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [note, setNote] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (employeeId) return
    let mounted = true
    getEmployees(supabase)
      .then((data) => {
        if (mounted) setEmployees(data)
      })
      .catch(() => {
        if (mounted) setError("Mitarbeiter konnten nicht geladen werden.")
      })
    return () => {
      mounted = false
    }
  }, [supabase, employeeId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (saving) return
    setError(null)
    setSuccess(null)

    if (!selectedEmployeeId) {
      setError("Bitte einen Mitarbeiter auswählen.")
      return
    }
    if (!startDate) {
      setError("Bitte ein Startdatum angeben.")
      return
    }
    if (type === "vacation" && !endDate) {
      setError("Bitte ein Enddatum für den Urlaub angeben.")
      return
    }
    if (endDate && endDate < startDate) {
      setError("Das Enddatum darf nicht vor dem Startdatum liegen.")
      return
    }

    setSaving(true)
    try {
      const created = await createAbsence(supabase, {
        employeeId: selectedEmployeeId,
        type,
        startDate,
        endDate: endDate || null,
        note: note || null,
      })
      // Statusabhängige Meldung wie Mobile — keine Annahme, dass Urlaub immer genehmigt landet.
      setSuccess(
        created.type === "sickness"
          ? "Die Krankmeldung wurde erfasst."
          : created.status === "approved"
            ? "Der Urlaub wurde als genehmigt erfasst."
            : "Der Urlaub wurde erfasst. Für diesen Mitarbeiter wird ein Urlaubskonto geführt — die Genehmigung samt Abzugsbestätigung erfolgt über die Urlaubsanträge-Liste.",
      )
      setStartDate("")
      setEndDate("")
      setNote("")
      onCreated(created)
    } catch (err) {
      setError(toAbsenceMessage(err, "Abwesenheit konnte nicht erfasst werden."))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4 rounded-xl border border-gray-100 bg-card p-4">
      <p className="text-sm font-semibold text-foreground">Abwesenheit erfassen</p>

      {error && <Notice tone="error">{error}</Notice>}
      {success && <Notice tone="success">{success}</Notice>}

      {!employeeId && (
        <Field id="absence-employee" label="Mitarbeiter">
          <select
            id="absence-employee"
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
            value={selectedEmployeeId}
            onChange={(e) => setSelectedEmployeeId(e.target.value)}
            disabled={saving}
          >
            <option value="">Bitte wählen…</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.fullName}
                {!emp.isActive ? " (inaktiv)" : ""}
              </option>
            ))}
          </select>
        </Field>
      )}
      {employeeId && employeeName && (
        <p className="text-sm text-muted-foreground">Für {employeeName}</p>
      )}

      <Field id="absence-type" label="Art">
        <div className="flex gap-2">
          <Button
            type="button"
            variant={type === "vacation" ? "default" : "outline"}
            size="sm"
            onClick={() => setType("vacation")}
            disabled={saving}
          >
            Urlaub
          </Button>
          <Button
            type="button"
            variant={type === "sickness" ? "default" : "outline"}
            size="sm"
            onClick={() => setType("sickness")}
            disabled={saving}
          >
            Krankheit
          </Button>
        </div>
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field id="absence-start" label={type === "sickness" ? "Krank ab" : "Von"}>
          <Input
            id="absence-start"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            disabled={saving}
          />
        </Field>
        <Field
          id="absence-end"
          label={type === "sickness" ? "Voraussichtlich bis (optional)" : "Bis"}
        >
          <Input
            id="absence-end"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            disabled={saving}
            placeholder={type === "sickness" ? "Noch nicht bekannt" : undefined}
          />
        </Field>
      </div>

      <Field id="absence-note" label="Notiz (optional)">
        <textarea
          id="absence-note"
          className="flex min-h-16 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          disabled={saving}
        />
      </Field>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          Abbrechen
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Wird gespeichert…" : "Erfassen"}
        </Button>
      </div>
    </form>
  )
}
