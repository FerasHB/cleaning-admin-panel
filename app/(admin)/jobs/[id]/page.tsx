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
import { Database } from "@/lib/supabase/database.types"

type JobRow = Database["public"]["Tables"]["jobs"]["Row"]
type JobUpdate = Database["public"]["Tables"]["jobs"]["Update"]
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"]
type JobStatus = Database["public"]["Enums"]["job_status"]

type EmployeeRow = Pick<ProfileRow, "id" | "full_name" | "role" | "company_id">

type FormDataState = {
  customer_name: string
  location_address: string
  service_name: string
  scheduled_start: string
  status: JobStatus
  assigned_to: string
  notes: string
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
    scheduled_start: "",
    status: "open",
    assigned_to: "",
    notes: "",
  })

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)

      const [{ data: empData, error: empError }, { data: jobData, error: jobError }] =
        await Promise.all([
          supabase
            .from("profiles")
            .select("id, full_name, role, company_id")
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
        alert("Failed to load job")
        setLoading(false)
        return
      }

      if (jobData) {
        let formattedDate = ""

        if (jobData.scheduled_start) {
          const d = new Date(jobData.scheduled_start)
          formattedDate = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
            .toISOString()
            .slice(0, 16)
        }

        setFormData({
          customer_name: jobData.customer_name ?? "",
          location_address: jobData.location_address ?? "",
          service_name: jobData.service_name ?? "",
          scheduled_start: formattedDate,
          status: jobData.status ?? "open",
          assigned_to: jobData.assigned_to ?? "",
          notes: jobData.notes ?? "",
        })
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
      [name]:
        name === "status"
          ? (value as JobStatus)
          : value,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
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

    const payload: JobUpdate = {
      customer_name: formData.customer_name,
      location_address: formData.location_address,
      service_name: formData.service_name,
      scheduled_start: formData.scheduled_start
        ? new Date(formData.scheduled_start).toISOString()
        : null,
      status: formData.status,
      assigned_to: formData.assigned_to === "" ? null : formData.assigned_to,
      notes: formData.notes,
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
    if (!confirm("Are you sure you want to delete this job? This action cannot be undone.")) {
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
    return <div className="p-8 text-center">Loading job data...</div>
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <PageHeader title="Edit Job" />
        </div>

        <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
          <Trash2 className="mr-2 h-4 w-4" />
          {deleting ? "Deleting..." : "Delete Job"}
        </Button>
      </div>

      <Card>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4 pt-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Customer Name</label>
                <Input
                  name="customer_name"
                  required
                  value={formData.customer_name}
                  onChange={handleChange}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Service</label>
                <Input
                  name="service_name"
                  required
                  value={formData.service_name}
                  onChange={handleChange}
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium">Location</label>
                <Input
                  name="location_address"
                  required
                  value={formData.location_address}
                  onChange={handleChange}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Scheduled Start</label>
                <Input
                  name="scheduled_start"
                  type="datetime-local"
                  value={formData.scheduled_start}
                  onChange={handleChange}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Status</label>
                <Select name="status" value={formData.status} onChange={handleChange}>
                  <option value="open">Open</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                </Select>
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium">Assign To Employee</label>
                <Select name="assigned_to" value={formData.assigned_to} onChange={handleChange}>
                  <option value="">Unassigned</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.full_name}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium">Notes</label>
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
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}