"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { PageHeader } from "@/components/ui/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { ArrowLeft } from "lucide-react"
import {
  JobScheduleFields,
  type JobScheduleValue,
  type JobScheduleErrors,
} from "@/components/jobs/JobScheduleFields"
import { buildJobSchedulePayload } from "@/lib/jobs/schedule"
import type { Database } from "@/lib/supabase/database.types"

type EmployeeOption = Pick<
  Database["public"]["Tables"]["profiles"]["Row"],
  "id" | "full_name"
>
type JobStatus = Database["public"]["Enums"]["job_status"]

const EMPTY_SCHEDULE: JobScheduleValue = {
  jobType: "single",
  dateTimeLocal: "",
  recurringDays: [],
  time: "",
  isActive: true,
}

export default function NewJobPage() {
  const [loading, setLoading] = useState(false)
  const [employees, setEmployees] = useState<EmployeeOption[]>([])
  const router = useRouter()
  const supabase = createClient()

  const [formData, setFormData] = useState({
    customer_name: "",
    location_address: "",
    service_name: "",
    status: "open" as JobStatus,
    assigned_to: "",
    notes: "",
  })

  const [schedule, setSchedule] = useState<JobScheduleValue>(EMPTY_SCHEDULE)
  const [scheduleErrors, setScheduleErrors] = useState<JobScheduleErrors>({})

  useEffect(() => {
    const fetchEmployees = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("role", "employee")
      if (data) {
        setEmployees(data)
      }
    }
    fetchEmployees()
  }, [])

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
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
    setLoading(true)

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      console.error(userError)
      alert("Not authenticated")
      setLoading(false)
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
      setLoading(false)
      return
    }

    if (profile.role !== "admin") {
      alert("Only admins can create jobs")
      setLoading(false)
      return
    }

    if (!profile.company_id) {
      alert("Admin has no company assigned")
      setLoading(false)
      return
    }

    // Terminierung (single/recurring) wie Mobile aufbauen — schreibt
    // job_type/date/start_time/recurring_days/is_active/scheduled_start.
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
      setLoading(false)
      return
    }

    const payload = {
      company_id: profile.company_id,
      created_by: user.id,
      customer_name: formData.customer_name,
      location_address: formData.location_address,
      service_name: formData.service_name,
      status: formData.status,
      assigned_to: formData.assigned_to === "" ? null : formData.assigned_to,
      notes: formData.notes,
      ...schedulePayload,
    }

    const { error } = await supabase.from("jobs").insert([payload])

    if (error) {
      console.error(error)
      alert("Failed to create job")
      setLoading(false)
      return
    }

    router.push("/jobs")
    router.refresh()
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <PageHeader title="Auftrag erstellen" />
      </div>

      <Card>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4 pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Kundenname</label>
                <Input
                  name="customer_name"
                  required
                  value={formData.customer_name}
                  onChange={handleChange}
                  placeholder="z. B. Max Mustermann"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Leistung</label>
                <Input
                  name="service_name"
                  required
                  value={formData.service_name}
                  onChange={handleChange}
                  placeholder="z. B. Grundreinigung"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium">Einsatzort</label>
                <Input
                  name="location_address"
                  required
                  value={formData.location_address}
                  onChange={handleChange}
                  placeholder="Musterstraße 1, 12345 Berlin"
                />
              </div>

              {/* ── Terminierung (single / recurring) ── */}
              <div className="md:col-span-2">
                <JobScheduleFields
                  value={schedule}
                  onChange={patchSchedule}
                  errors={scheduleErrors}
                  disabled={loading}
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
                <p className="text-xs text-muted-foreground">Wählen Sie einen Mitarbeiter für diesen Auftrag. Sie können das Feld auch leer lassen.</p>
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium">Notizen</label>
                <textarea
                  name="notes"
                  className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50 min-h-[100px]"
                  value={formData.notes}
                  onChange={handleChange}
                  placeholder="Zusätzliche Hinweise für den Mitarbeiter…"
                />
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-end gap-2 border-t p-6">
            <Button variant="outline" type="button" onClick={() => router.back()}>Abbrechen</Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Wird erstellt…" : "Auftrag erstellen"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
