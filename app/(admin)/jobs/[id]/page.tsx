"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { PageHeader } from "@/components/ui/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { ArrowLeft, Trash2 } from "lucide-react"
import {
  JobScheduleFields,
  type JobScheduleValue,
  type JobScheduleErrors,
} from "@/components/jobs/JobScheduleFields"
import { buildJobSchedulePayload } from "@/lib/jobs/schedule"
import { normalizeTime } from "@/lib/date"
import type { WeekdayKey } from "@/lib/recurrence"
import { Database } from "@/lib/supabase/database.types"

type JobUpdate = Database["public"]["Tables"]["jobs"]["Update"]
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"]
type JobStatus = Database["public"]["Enums"]["job_status"]

type EmployeeRow = Pick<ProfileRow, "id" | "full_name">

type FormDataState = {
  customer_name: string
  location_address: string
  service_name: string
  status: JobStatus
  assigned_to: string
  notes: string
}

const EMPTY_SCHEDULE: JobScheduleValue = {
  jobType: "single",
  dateTimeLocal: "",
  recurringDays: [],
  time: "",
  isActive: true,
}

// Wandelt einen UTC-ISO-Zeitstempel in den lokalen Wert eines
// <input type="datetime-local"> ("YYYY-MM-DDTHH:mm") um.
function isoToDateTimeLocal(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ""
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16)
}

export default function EditJobPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [employees, setEmployees] = useState<EmployeeRow[]>([])

  const router = useRouter()
  const params = useParams()
  const jobId = params.id as string

  const supabase = createClient()

  const [formData, setFormData] = useState<FormDataState>({
    customer_name: "",
    location_address: "",
    service_name: "",
    status: "open",
    assigned_to: "",
    notes: "",
  })

  const [schedule, setSchedule] = useState<JobScheduleValue>(EMPTY_SCHEDULE)
  const [scheduleErrors, setScheduleErrors] = useState<JobScheduleErrors>({})

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)

      const [{ data: empData, error: empError }, { data: jobData, error: jobError }] =
        await Promise.all([
          supabase
            .from("profiles")
            .select("id, full_name")
            .eq("role", "employee"),
          supabase.from("jobs").select("*").eq("id", jobId).single(),
        ])

      if (empError) {
        console.error("Failed to fetch employees:", empError)
      } else if (empData) {
        setEmployees(empData)
      }

      if (jobError) {
        console.error("Failed to fetch job:", jobError)
        alert("Auftrag konnte nicht geladen werden.")
        setLoading(false)
        return
      }

      if (jobData) {
        setFormData({
          customer_name: jobData.customer_name ?? "",
          location_address: jobData.location_address ?? "",
          service_name: jobData.service_name ?? "",
          status: jobData.status ?? "open",
          assigned_to: jobData.assigned_to ?? "",
          notes: jobData.notes ?? "",
        })

        // Terminierung in den Formular-State laden (single vs. recurring).
        if (jobData.job_type === "recurring") {
          setSchedule({
            jobType: "recurring",
            dateTimeLocal: "",
            recurringDays: (jobData.recurring_days ?? []) as WeekdayKey[],
            time: normalizeTime(jobData.start_time) ?? "",
            isActive: jobData.is_active ?? true,
          })
        } else {
          // single: bevorzugt scheduled_start, Fallback date + start_time (Alt-Daten)
          let dateTimeLocal = ""
          if (jobData.scheduled_start) {
            dateTimeLocal = isoToDateTimeLocal(jobData.scheduled_start)
          } else if (jobData.date) {
            dateTimeLocal = `${jobData.date}T${normalizeTime(jobData.start_time) ?? "00:00"}`
          }
          setSchedule({
            jobType: "single",
            dateTimeLocal,
            recurringDays: [],
            time: "",
            isActive: true,
          })
        }
      }

      setLoading(false)
    }

    if (jobId) {
      fetchData()
    }
  }, [jobId, supabase])

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target

    setFormData((prev) => ({
      ...prev,
      [name]: name === "status" ? (value as JobStatus) : value,
    }))
  }

  const patchSchedule = (patch: Partial<JobScheduleValue>) => {
    setSchedule((prev) => ({ ...prev, ...patch }))
    setScheduleErrors({})
  }

  // Validierung wie Mobile (single: Datum+Uhrzeit; recurring: ≥1 Wochentag + Uhrzeit)
  const validateSchedule = (): boolean => {
    const next: JobScheduleErrors = {}
    if (schedule.jobType === "single") {
      if (!schedule.dateTimeLocal) {
        next.dateTimeLocal = "Bitte Datum und Uhrzeit wählen."
      }
    } else {
      if (schedule.recurringDays.length === 0) {
        next.recurringDays = "Bitte mindestens einen Wochentag wählen."
      }
      if (!schedule.time) {
        next.time = "Bitte eine Uhrzeit wählen."
      }
    }
    setScheduleErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateSchedule()) return
    setSaving(true)

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      console.error(userError)
      alert("Not authenticated")
      setSaving(false)
      return
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, role, company_id")
      .eq("id", user.id)
      .single()

    if (profileError || !profile) {
      console.error(profileError)
      alert("Profile not found")
      setSaving(false)
      return
    }

    if (profile.role !== "admin") {
      alert("Only admins can update jobs")
      setSaving(false)
      return
    }

    if (!profile.company_id) {
      alert("Admin has no company assigned")
      setSaving(false)
      return
    }

    let schedulePayload
    try {
      schedulePayload = buildJobSchedulePayload(
        schedule.jobType === "single"
          ? { jobType: "single", dateTimeLocal: schedule.dateTimeLocal }
          : {
              jobType: "recurring",
              recurringDays: schedule.recurringDays,
              time: schedule.time,
              isActive: schedule.isActive,
            }
      )
    } catch (err) {
      alert(err instanceof Error ? err.message : "Ungültige Terminierung")
      setSaving(false)
      return
    }

    const payload: JobUpdate = {
      customer_name: formData.customer_name,
      location_address: formData.location_address,
      service_name: formData.service_name,
      status: formData.status,
      assigned_to: formData.assigned_to === "" ? null : formData.assigned_to,
      notes: formData.notes,
      ...schedulePayload,
    }

    const { error } = await supabase
      .from("jobs")
      .update(payload)
      .eq("id", jobId)

    if (error) {
      console.error(error)
      alert("Failed to update job")
      setSaving(false)
      return
    }

    router.push("/jobs")
    router.refresh()
  }

  const handleDelete = async () => {
    if (!confirm("Auftrag wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.")) {
      return
    }

    setDeleting(true)

    const { error } = await supabase.from("jobs").delete().eq("id", jobId)

    if (error) {
      console.error(error)
      alert("Failed to delete job")
      setDeleting(false)
      return
    }

    router.push("/jobs")
    router.refresh()
  }

  if (loading) {
    return <div className="p-8 text-center">Auftrag wird geladen…</div>
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <PageHeader title="Auftrag bearbeiten" />
        </div>

        <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
          <Trash2 className="mr-2 h-4 w-4" />
          {deleting ? "Wird gelöscht…" : "Auftrag löschen"}
        </Button>
      </div>

      <Card>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4 pt-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Kundenname</label>
                <Input
                  name="customer_name"
                  required
                  value={formData.customer_name}
                  onChange={handleChange}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Leistung</label>
                <Input
                  name="service_name"
                  required
                  value={formData.service_name}
                  onChange={handleChange}
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium">Einsatzort</label>
                <Input
                  name="location_address"
                  required
                  value={formData.location_address}
                  onChange={handleChange}
                />
              </div>

              {/* ── Terminierung (single / recurring) ── */}
              <div className="md:col-span-2">
                <JobScheduleFields
                  value={schedule}
                  onChange={patchSchedule}
                  errors={scheduleErrors}
                  disabled={saving}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Status</label>
                <Select name="status" value={formData.status} onChange={handleChange}>
                  <option value="open">Offen</option>
                  <option value="in_progress">In Arbeit</option>
                  <option value="completed">Erledigt</option>
                </Select>
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium">Mitarbeiter zuweisen</label>
                <Select name="assigned_to" value={formData.assigned_to} onChange={handleChange}>
                  <option value="">Nicht zugewiesen</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.full_name}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium">Notizen</label>
                <textarea
                  name="notes"
                  className="min-h-[100px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
                  value={formData.notes}
                  onChange={handleChange}
                />
              </div>
            </div>
          </CardContent>

          <CardFooter className="flex justify-end gap-2 border-t p-6">
            <Button variant="outline" type="button" onClick={() => router.back()}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Wird gespeichert…" : "Änderungen speichern"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
