"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { PageHeader } from "@/components/ui/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { ArrowLeft } from "lucide-react"
import { JobFormFields } from "@/components/jobs/JobFormFields"
import { EmployeeMultiSelect } from "@/components/jobs/EmployeeMultiSelect"
import { AbsenceWarningPanel } from "@/components/jobs/AbsenceWarningPanel"
import { useAssignmentAbsenceGuard } from "@/hooks/use-assignment-absence-guard"
import { toAbsenceCheckInput } from "@/lib/jobs/assignmentAbsenceWarning"
import {
  createJob,
  getEmployees,
  type EmployeeOption,
} from "@/lib/jobs/jobs.service"
import {
  EMPTY_JOB_FORM,
  toJobInput,
  validateJobForm,
  type JobFormErrors,
  type JobFormValues,
} from "@/lib/jobs/jobForm"

export default function NewJobPage() {
  const router = useRouter()
  const [supabase] = useState(() => createClient())

  const [employees, setEmployees] = useState<EmployeeOption[]>([])
  const [employeesError, setEmployeesError] = useState<string | null>(null)
  const [values, setValues] = useState<JobFormValues>(EMPTY_JOB_FORM)
  const [errors, setErrors] = useState<JobFormErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  // Synchrone Sperre gegen Doppel-Absendung (wie Mobile).
  const submittingRef = useRef(false)
  const { guardSave, warning, confirmWarning, dismissWarning } =
    useAssignmentAbsenceGuard(supabase)

  useEffect(() => {
    let mounted = true
    getEmployees(supabase)
      .then((data) => {
        if (mounted) setEmployees(data)
      })
      .catch((err) => {
        console.error("Failed to load employees:", err)
        if (mounted) setEmployeesError("Mitarbeiter konnten nicht geladen werden.")
      })
    return () => {
      mounted = false
    }
  }, [supabase])

  // Beim Anlegen nur aktive Mitarbeiter anbieten (wie Mobiles AdminScreen).
  const activeEmployees = employees.filter((e) => e.isActive)

  const patch = (next: Partial<JobFormValues>) => {
    setValues((prev) => ({ ...prev, ...next }))
    setErrors({})
    setSubmitError(null)
    // Geänderte Eingaben → eine offene Warnung ist veraltet, beim nächsten
    // Absenden wird neu geprüft.
    dismissWarning()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submittingRef.current) return

    const nextErrors = validateJobForm(values)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    submittingRef.current = true
    setSubmitting(true)
    setSubmitError(null)

    // Nur aktive IDs senden (set_job_assignments lehnt inaktive ohnehin ab).
    const activeIds = new Set(activeEmployees.map((emp) => emp.id))
    const employeeIds = values.employeeIds.filter((id) => activeIds.has(id))
    const jobInput = toJobInput(values, employeeIds)

    const performSave = async () => {
      try {
        const { jobId, recurringOccurrencesFailed } = await createJob(supabase, jobInput)
        router.push(
          recurringOccurrencesFailed
            ? `/jobs/${jobId}?notice=occurrences-failed`
            : `/jobs/${jobId}`,
        )
        router.refresh()
      } catch (err) {
        setSubmitError(
          err instanceof Error ? err.message : "Job konnte nicht erstellt werden.",
        )
        submittingRef.current = false
        setSubmitting(false)
      }
    }

    const outcome = await guardSave(toAbsenceCheckInput(jobInput, activeEmployees), performSave)
    if (outcome !== "saved") {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  const handleConfirmWarning = async () => {
    if (submittingRef.current) return
    submittingRef.current = true
    setSubmitting(true)
    await confirmWarning()
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" aria-label="Zurück" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <PageHeader title="Auftrag erstellen" />
      </div>

      <Card>
        <form onSubmit={handleSubmit} noValidate>
          <CardContent className="space-y-4 pt-6">
            {submitError && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm font-medium text-destructive">
                {submitError}
              </div>
            )}

            <JobFormFields
              values={values}
              errors={errors}
              onChange={patch}
              disabled={submitting}
              employeeSection={
                employeesError ? (
                  <p className="text-sm font-medium text-destructive">{employeesError}</p>
                ) : (
                  <EmployeeMultiSelect
                    employees={activeEmployees}
                    selectedIds={values.employeeIds}
                    onChange={(ids) => patch({ employeeIds: ids })}
                    disabled={submitting}
                  />
                )
              }
            />

            {warning && (
              <AbsenceWarningPanel
                warning={warning}
                onConfirm={() => void handleConfirmWarning()}
                onCancel={dismissWarning}
                disabled={submitting}
              />
            )}
          </CardContent>
          <CardFooter className="flex justify-end gap-2 border-t p-6">
            <Button variant="outline" type="button" onClick={() => router.back()} disabled={submitting}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Wird erstellt…" : "Auftrag erstellen"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
