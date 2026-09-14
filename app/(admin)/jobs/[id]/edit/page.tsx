"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { PageHeader } from "@/components/ui/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"
import { ArrowLeft, Briefcase, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { JobFormFields } from "@/components/jobs/JobFormFields"
import { EmployeeMultiSelect } from "@/components/jobs/EmployeeMultiSelect"
import { AbsenceWarningPanel } from "@/components/jobs/AbsenceWarningPanel"
import { useAssignmentAbsenceGuard } from "@/hooks/use-assignment-absence-guard"
import { toAbsenceCheckInput } from "@/lib/jobs/assignmentAbsenceWarning"
import {
  deleteJob,
  getEmployees,
  getJobById,
  PartialUpdateError,
  updateJob,
  type EmployeeOption,
  type JobWithAssignments,
} from "@/lib/jobs/jobs.service"
import {
  assignedEmployeeIdsOf,
  EMPTY_JOB_FORM,
  hasJobFormChanges,
  jobToFormValues,
  toJobInput,
  validateJobForm,
  type JobFormErrors,
  type JobFormValues,
} from "@/lib/jobs/jobForm"

export default function EditJobPage() {
  const router = useRouter()
  const params = useParams()
  const jobId = params.id as string
  const [supabase] = useState(() => createClient())

  const [job, setJob] = useState<JobWithAssignments | null>(null)
  const [employees, setEmployees] = useState<EmployeeOption[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [values, setValues] = useState<JobFormValues>(EMPTY_JOB_FORM)
  const [baseline, setBaseline] = useState<JobFormValues>(EMPTY_JOB_FORM)
  const [errors, setErrors] = useState<JobFormErrors>({})

  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [message, setMessage] = useState<{ tone: "error" | "warning"; text: string } | null>(null)
  const { guardSave, warning, confirmWarning, dismissWarning } =
    useAssignmentAbsenceGuard(supabase)

  const applyJob = useCallback((fresh: JobWithAssignments) => {
    const seeded = jobToFormValues(fresh)
    setJob(fresh)
    setValues(seeded)
    setBaseline(seeded)
    setErrors({})
  }, [])

  useEffect(() => {
    let mounted = true
    const load = async () => {
      try {
        const [fresh, emps] = await Promise.all([
          getJobById(supabase, jobId),
          getEmployees(supabase),
        ])
        if (!mounted) return
        setEmployees(emps)
        if (fresh) applyJob(fresh)
      } catch (err) {
        console.error("Failed to load job for editing:", err)
        if (mounted) setLoadError("Auftrag konnte nicht geladen werden.")
      } finally {
        if (mounted) setLoading(false)
      }
    }
    if (jobId) load()
    return () => {
      mounted = false
    }
  }, [jobId, supabase, applyJob])

  // Aktuell zugewiesene lebende Mitarbeiter-IDs.
  const assignedIds = useMemo(() => (job ? assignedEmployeeIdsOf(job) : []), [job])

  // Picker beim Bearbeiten (wie Mobile): aktive Mitarbeiter + ALLE aktuell
  // zugewiesenen, auch wenn inzwischen inaktiv — damit bestehende Zuweisungen
  // sichtbar bleiben und nicht still verschwinden.
  const pickerEmployees = useMemo(() => {
    const active = employees.filter((e) => e.isActive)
    const activeIds = new Set(active.map((e) => e.id))
    const assignedButInactive = employees.filter(
      (e) => assignedIds.includes(e.id) && !activeIds.has(e.id),
    )
    return [...active, ...assignedButInactive]
  }, [employees, assignedIds])

  // Wie Mobile: Speichern ist vollständig gesperrt, solange der Auftrag einem
  // INAKTIVEN Mitarbeiter zugewiesen ist. set_job_assignments lehnt inaktive IDs
  // ab (mitschicken = Fehler) und löscht spurenfreie Zuweisungen, die fehlen
  // (weglassen = stille Löschung) — es gibt keinen sicheren Weg.
  const inactiveAssigned = pickerEmployees.filter((e) => !e.isActive)
  const hasInactiveAssigned = inactiveAssigned.length > 0

  const hasChanges = job ? hasJobFormChanges(values, baseline) : false

  const patch = (next: Partial<JobFormValues>) => {
    setValues((prev) => ({ ...prev, ...next }))
    setErrors({})
    setMessage(null)
    dismissWarning()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!job || saving) return

    const nextErrors = validateJobForm(values)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    if (hasInactiveAssigned) {
      setMessage({
        tone: "error",
        text:
          "Dieser Auftrag ist mindestens einem inaktiven Mitarbeiter zugewiesen " +
          `(${inactiveAssigned.map((emp) => emp.fullName).join(", ")}). ` +
          "Aus Datensicherheitsgründen kann der Auftrag aktuell nicht bearbeitet " +
          "werden, da jedes Speichern diese Zuweisung unbeabsichtigt entfernen könnte.",
      })
      return
    }

    // Defense-in-depth (wie Mobile): nie inaktive IDs senden.
    const activeIds = new Set(employees.filter((emp) => emp.isActive).map((emp) => emp.id))
    const submittableIds = values.employeeIds.filter((id) => activeIds.has(id))

    setSaving(true)
    setMessage(null)
    const jobInput = toJobInput(values, submittableIds)

    const performSave = async () => {
      try {
        await updateJob(supabase, { jobId: job.id, ...jobInput })
        router.push(`/jobs/${job.id}`)
        router.refresh()
      } catch (err) {
        if (err instanceof PartialUpdateError) {
          // Teilerfolg: Zuweisung steht bereits. Frischen Serverstand nachladen,
          // im Formular bleiben, NICHT automatisch erneut speichern.
          setMessage({ tone: "warning", text: err.message })
          try {
            const fresh = await getJobById(supabase, job.id)
            if (fresh) applyJob(fresh)
          } catch (reloadErr) {
            console.error("Failed to reload job after partial update:", reloadErr)
          }
        } else {
          setMessage({
            tone: "error",
            text: err instanceof Error ? err.message : "Job konnte nicht gespeichert werden.",
          })
        }
        setSaving(false)
      }
    }

    // Wie Mobiles EditJobScreen: mit dem AKTUELLEN Formularstand prüfen, auch
    // wenn Zuweisung/Termin unverändert sind.
    const outcome = await guardSave(toAbsenceCheckInput(jobInput, employees), performSave)
    if (outcome !== "saved") setSaving(false)
  }

  const handleConfirmWarning = async () => {
    if (saving) return
    setSaving(true)
    await confirmWarning()
  }

  const handleDelete = async () => {
    if (!job || deleting) return

    setConfirmingDelete(false)
    setDeleting(true)
    setMessage(null)
    try {
      await deleteJob(supabase, job.id)
      router.push("/jobs")
      router.refresh()
    } catch (err) {
      // z. B. protect_recurring_job_history: Regel mit Historie nicht löschbar.
      setMessage({
        tone: "error",
        text: err instanceof Error ? err.message : "Job konnte nicht gelöscht werden.",
      })
      setDeleting(false)
    }
  }

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground">Auftrag wird geladen…</div>
  }

  if (loadError || !job) {
    return (
      <EmptyState
        icon={Briefcase}
        title={loadError ? "Auftrag konnte nicht geladen werden" : "Auftrag nicht gefunden"}
        description={loadError ?? "Dieser Auftrag ist nicht (mehr) verfügbar."}
        action={
          <Link href="/jobs">
            <Button>Zur Auftragsliste</Button>
          </Link>
        }
      />
    )
  }

  const busy = saving || deleting

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Zurück zum Auftrag"
            onClick={() => router.push(`/jobs/${job.id}`)}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <PageHeader title="Auftrag bearbeiten" />
        </div>

        <Button
          variant="destructive"
          onClick={() => setConfirmingDelete(true)}
          disabled={busy || confirmingDelete}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          {deleting ? "Wird gelöscht…" : "Auftrag löschen"}
        </Button>
      </div>

      {/* ── Sicherheitsabfrage Löschen ── */}
      {confirmingDelete && (
        <div
          role="alertdialog"
          aria-labelledby="delete-job-title"
          className={cn("rounded-xl border p-4", "border-destructive/30 bg-destructive/5")}
        >
          <p id="delete-job-title" className="text-sm font-semibold text-foreground">
            Auftrag wirklich löschen?
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Diese Aktion kann nicht rückgängig gemacht werden. Der Auftrag wird endgültig entfernt.
          </p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Wird gelöscht…" : "Endgültig löschen"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setConfirmingDelete(false)}
              disabled={deleting}
            >
              Abbrechen
            </Button>
          </div>
        </div>
      )}

      <Card>
        <form onSubmit={handleSubmit} noValidate>
          <CardContent className="space-y-4 pt-6">
            {message && (
              <div
                className={
                  message.tone === "error"
                    ? "rounded-md bg-destructive/10 p-3 text-sm font-medium text-destructive"
                    : "rounded-md border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-800"
                }
              >
                {message.text}
              </div>
            )}

            <JobFormFields
              values={values}
              errors={errors}
              onChange={patch}
              disabled={busy}
              employeeSection={
                <div className="space-y-2">
                  {hasInactiveAssigned && (
                    <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs font-medium text-amber-800">
                      Dieser Auftrag ist mindestens einem inaktiven Mitarbeiter zugewiesen (
                      {inactiveAssigned.map((emp) => emp.fullName).join(", ")}). Der Auftrag kann
                      aktuell nicht bearbeitet werden, da jedes Speichern diese Zuweisung
                      unbeabsichtigt entfernen könnte.
                    </div>
                  )}
                  <EmployeeMultiSelect
                    employees={pickerEmployees}
                    selectedIds={values.employeeIds}
                    onChange={(ids) => patch({ employeeIds: ids })}
                    disabled={busy}
                    emptyLabel="Keine Mitarbeiter verfügbar."
                  />
                </div>
              }
            />

            {warning && (
              <AbsenceWarningPanel
                warning={warning}
                onConfirm={() => void handleConfirmWarning()}
                onCancel={dismissWarning}
                disabled={busy}
              />
            )}
          </CardContent>

          <CardFooter className="flex justify-end gap-2 border-t p-6">
            <Button
              variant="outline"
              type="button"
              onClick={() => router.push(`/jobs/${job.id}`)}
              disabled={busy}
            >
              Abbrechen
            </Button>
            <Button type="submit" disabled={busy || !hasChanges || hasInactiveAssigned}>
              {saving
                ? "Wird gespeichert…"
                : hasInactiveAssigned
                  ? "Bearbeiten derzeit nicht möglich"
                  : hasChanges
                    ? "Änderungen speichern"
                    : "Keine Änderungen"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
