"use client"

// components/jobs/JobScheduleFields.tsx
// Terminierungs-Felder für das Job-Formular (Anlegen + Bearbeiten).
// Spiegel von Mobiles JobFormFields: Auftragstyp-Umschalter (Einmalig/
// Wiederkehrend), single = Datum+Uhrzeit, recurring = Wochentage+Uhrzeit+Aktiv.
// Kontrollierte Komponente: hält keinen eigenen State, alles über value/onChange.

import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { WEEKDAYS, type WeekdayKey } from "@/lib/recurrence"

export type JobScheduleValue = {
  jobType: "single" | "recurring"
  // single: Wert eines <input type="datetime-local"> ("YYYY-MM-DDTHH:mm")
  dateTimeLocal: string
  // recurring: ausgewählte Wochentage
  recurringDays: WeekdayKey[]
  // recurring: Wert eines <input type="time"> ("HH:mm")
  time: string
  // recurring: aktiv/inaktiv
  isActive: boolean
}

export type JobScheduleErrors = {
  dateTimeLocal?: string
  recurringDays?: string
  time?: string
}

type Props = {
  value: JobScheduleValue
  onChange: (patch: Partial<JobScheduleValue>) => void
  errors?: JobScheduleErrors
  disabled?: boolean
}

const JOB_TYPE_OPTIONS: { key: JobScheduleValue["jobType"]; label: string }[] = [
  { key: "single", label: "Einmalig" },
  { key: "recurring", label: "Wiederkehrend" },
]

export function JobScheduleFields({
  value,
  onChange,
  errors,
  disabled = false,
}: Props) {
  const toggleWeekday = (key: WeekdayKey) => {
    const selected = value.recurringDays.includes(key)
    const next = selected
      ? value.recurringDays.filter((d) => d !== key)
      : [...value.recurringDays, key]
    onChange({ recurringDays: next })
  }

  return (
    <div className="space-y-4">
      {/* ── Auftragstyp (Segmented Control) ── */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Auftragstyp</label>
        <div className="inline-flex w-full rounded-md border border-input bg-secondary p-0.5 sm:w-auto">
          {JOB_TYPE_OPTIONS.map((opt) => {
            const active = value.jobType === opt.key
            return (
              <button
                key={opt.key}
                type="button"
                disabled={disabled}
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

      {/* ── Einmalig: Datum + Uhrzeit ── */}
      {value.jobType === "single" ? (
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="job-datetime">
            Datum &amp; Uhrzeit
          </label>
          <Input
            id="job-datetime"
            type="datetime-local"
            value={value.dateTimeLocal}
            onChange={(e) => onChange({ dateTimeLocal: e.target.value })}
            disabled={disabled}
          />
          {errors?.dateTimeLocal && (
            <p className="text-xs font-medium text-destructive">
              {errors.dateTimeLocal}
            </p>
          )}
        </div>
      ) : (
        /* ── Wiederkehrend: Wochentage + Uhrzeit + Aktiv ── */
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Wochentage</label>
            <div className="flex flex-wrap gap-2">
              {WEEKDAYS.map((w) => {
                const active = value.recurringDays.includes(w.key)
                return (
                  <button
                    key={w.key}
                    type="button"
                    disabled={disabled}
                    onClick={() => toggleWeekday(w.key)}
                    aria-pressed={active}
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
            {errors?.recurringDays && (
              <p className="text-xs font-medium text-destructive">
                {errors.recurringDays}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="job-time">
              Uhrzeit
            </label>
            <Input
              id="job-time"
              type="time"
              value={value.time}
              onChange={(e) => onChange({ time: e.target.value })}
              disabled={disabled}
              className="sm:w-[160px]"
            />
            {errors?.time && (
              <p className="text-xs font-medium text-destructive">
                {errors.time}
              </p>
            )}
          </div>

          <label className="flex items-start gap-3 rounded-lg border border-input p-3">
            <input
              type="checkbox"
              checked={value.isActive}
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
