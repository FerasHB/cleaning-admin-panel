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

    try {
      // Nur aktive IDs senden (set_job_assignments lehnt inaktive ohnehin ab).
      const activeIds = new Set(activeEmployees.map((emp) => emp.id))
      const employeeIds = values.employeeIds.filter((id) => activeIds.has(id))

      const { jobId, recurringOccurrencesFailed } = await createJob(
        supabase,
        toJobInput(values, employeeIds),
      )

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
