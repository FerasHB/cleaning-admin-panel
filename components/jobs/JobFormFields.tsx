"use client"

// components/jobs/JobFormFields.tsx
// Gemeinsame Formularfelder für Auftrag anlegen/bearbeiten (Web-Pendant zu
// Mobiles JobFormFields). Bewusst OHNE Status-Feld: der Status wird nie aus
// dem Admin-Formular geschrieben (neue Aufträge sind 'open', Übergänge laufen
// über start_own_job/complete_own_job der Mitarbeiter).

import { Input } from "@/components/ui/input"
import { JobScheduleFields } from "@/components/jobs/JobScheduleFields"
import type { JobFormErrors, JobFormValues } from "@/lib/jobs/jobForm"

type Props = {
  values: JobFormValues
  errors: JobFormErrors
  onChange: (patch: Partial<JobFormValues>) => void
  disabled?: boolean
  // Mitarbeiter-Auswahl wird vom Aufrufer gerendert (Anlegen vs. Bearbeiten
  // haben unterschiedliche Picker-Regeln).
  employeeSection: React.ReactNode
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="text-xs font-medium text-destructive">{message}</p>
}

export function JobFormFields({ values, errors, onChange, disabled, employeeSection }: Props) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="job-customer">
          Kundenname
        </label>
        <Input
          id="job-customer"
          value={values.customerName}
          onChange={(e) => onChange({ customerName: e.target.value })}
          disabled={disabled}
          placeholder="z. B. Max Mustermann"
        />
        <FieldError message={errors.customerName} />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="job-service">
          Leistung
        </label>
        <Input
          id="job-service"
          value={values.service}
          onChange={(e) => onChange({ service: e.target.value })}
          disabled={disabled}
          placeholder="z. B. Grundreinigung"
        />
        <FieldError message={errors.service} />
      </div>

      <div className="space-y-2 md:col-span-2">
        <label className="text-sm font-medium" htmlFor="job-location">
          Einsatzort
        </label>
        <Input
          id="job-location"
          value={values.location}
          onChange={(e) => onChange({ location: e.target.value })}
          disabled={disabled}
          placeholder="Musterstraße 1, 12345 Berlin"
        />
        <FieldError message={errors.location} />
      </div>

      <div className="md:col-span-2">
        <JobScheduleFields
          values={values}
          onChange={onChange}
          errors={errors}
          disabled={disabled}
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="job-duration">
          Geplante Dauer (Minuten){" "}
          <span className="font-normal text-muted-foreground">(optional)</span>
        </label>
        <Input
          id="job-duration"
          inputMode="numeric"
          value={values.durationMinutes}
          onChange={(e) => onChange({ durationMinutes: e.target.value.replace(/[^0-9]/g, "") })}
          disabled={disabled}
          placeholder="z. B. 120"
        />
      </div>

      <div className="space-y-2 md:col-span-2">
        <span className="text-sm font-medium">Mitarbeiter zuweisen</span>
        {employeeSection}
      </div>

      <div className="space-y-2 md:col-span-2">
        <label className="text-sm font-medium" htmlFor="job-notes">
          Notizen
        </label>
        <textarea
          id="job-notes"
          className="min-h-[100px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
          value={values.notes}
          onChange={(e) => onChange({ notes: e.target.value })}
          disabled={disabled}
          placeholder="Zusätzliche Hinweise für den Mitarbeiter…"
        />
      </div>
    </div>
  )
}
