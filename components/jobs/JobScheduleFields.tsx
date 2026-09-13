"use client"

// components/jobs/JobScheduleFields.tsx
// Terminierungs-Felder für das Job-Formular (Anlegen + Bearbeiten).
// Spiegel von Mobiles JobFormFields: Auftragstyp-Umschalter (Einmalig/
// Wiederkehrend), single = Datum+Uhrzeit, recurring = Wochentage + Uhrzeit +
// Gültigkeitszeitraum (Start Pflicht, Ende optional) + Aktiv.
// Kontrollierte Komponente: hält keinen eigenen State.

import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { WEEKDAYS, type WeekdayKey } from "@/lib/recurrence"
import type { JobFormErrors, JobFormValues } from "@/lib/jobs/jobForm"

type Props = {
  values: JobFormValues
  onChange: (patch: Partial<JobFormValues>) => void
  errors?: JobFormErrors
  disabled?: boolean
}

const JOB_TYPE_OPTIONS: { key: JobFormValues["jobType"]; label: string }[] = [
  { key: "single", label: "Einmalig" },
  { key: "recurring", label: "Wiederkehrend" },
]

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="text-xs font-medium text-destructive">{message}</p>
}

export function JobScheduleFields({ values, onChange, errors, disabled = false }: Props) {
  const toggleWeekday = (key: WeekdayKey) => {
    const selected = values.recurringDays.includes(key)
    onChange({
      recurringDays: selected
        ? values.recurringDays.filter((d) => d !== key)
        : [...values.recurringDays, key],
    })
  }

  return (
    <div className="space-y-4">
      {/* ── Auftragstyp (Segmented Control) ── */}
      <div className="space-y-2">
        <span className="text-sm font-medium">Auftragstyp</span>
        <div className="inline-flex w-full rounded-md border border-input bg-secondary p-0.5 sm:w-auto">
          {JOB_TYPE_OPTIONS.map((opt) => {
            const active = values.jobType === opt.key
            return (
              <button
                key={opt.key}
                type="button"
                disabled={disabled}
                aria-pressed={active}
                onClick={() => onChange({ jobType: opt.key })}
                className={cn(
                  "flex-1 rounded px-4 py-1.5 text-sm font-medium transition-colors sm:flex-none sm:px-6",
                  active
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
      </div>

      {values.jobType === "single" ? (
        /* ── Einmalig: Datum + Uhrzeit ── */
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="job-datetime">
            Datum &amp; Uhrzeit
          </label>
          <Input
            id="job-datetime"
            type="datetime-local"
            value={values.dateTimeLocal}
            onChange={(e) => onChange({ dateTimeLocal: e.target.value })}
            disabled={disabled}
          />
          <FieldError message={errors?.dateTimeLocal} />
        </div>
      ) : (
        /* ── Wiederkehrend ── */
        <div className="space-y-4">
          <div className="space-y-2">
            <span className="text-sm font-medium">Wochentage</span>
            <div className="flex flex-wrap gap-2">
              {WEEKDAYS.map((w) => {
                const active = values.recurringDays.includes(w.key)
                return (
                  <button
                    key={w.key}
                    type="button"
                    disabled={disabled}
                    onClick={() => toggleWeekday(w.key)}
                    aria-pressed={active}
                    aria-label={w.label}
                    className={cn(
                      "min-w-[44px] rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                      active
                        ? "border-primary/30 bg-primary/10 text-primary"
                        : "border-input text-muted-foreground hover:bg-secondary",
                    )}
                  >
                    {w.short}
                  </button>
                )
              })}
            </div>
            <FieldError message={errors?.recurringDays} />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="job-time">
              Uhrzeit
            </label>
            <Input
              id="job-time"
              type="time"
              value={values.time}
              onChange={(e) => onChange({ time: e.target.value })}
              disabled={disabled}
              className="sm:w-[160px]"
            />
            <FieldError message={errors?.time} />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="job-recurrence-start">
                Startdatum
              </label>
              <Input
                id="job-recurrence-start"
                type="date"
                value={values.recurrenceStartDate}
                onChange={(e) => onChange({ recurrenceStartDate: e.target.value })}
                disabled={disabled}
              />
              <FieldError message={errors?.recurrenceStartDate} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="job-recurrence-end">
                Enddatum <span className="font-normal text-muted-foreground">(optional)</span>
              </label>
              <Input
                id="job-recurrence-end"
                type="date"
                value={values.recurrenceEndDate}
                min={values.recurrenceStartDate || undefined}
                onChange={(e) => onChange({ recurrenceEndDate: e.target.value })}
                disabled={disabled}
              />
              <FieldError message={errors?.recurrenceEndDate} />
            </div>
          </div>

          <label className="flex items-start gap-3 rounded-lg border border-input p-3">
            <input
              type="checkbox"
              checked={values.isActive}
              onChange={(e) => onChange({ isActive: e.target.checked })}
              disabled={disabled}
              className="mt-0.5 h-4 w-4 accent-primary"
            />
            <span className="space-y-0.5">
              <span className="block text-sm font-medium">Aktiv</span>
              <span className="block text-xs text-muted-foreground">
                Inaktive Aufträge werden Mitarbeitern nicht angezeigt.
              </span>
            </span>
          </label>
        </div>
      )}
    </div>
  )
}
