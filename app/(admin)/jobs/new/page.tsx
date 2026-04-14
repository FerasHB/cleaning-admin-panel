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
import { Database } from "@/lib/supabase/database.types"



export default function NewJobPage() {
  const [loading, setLoading] = useState(false)
  const [employees, setEmployees] = useState<any[]>([])
  const router = useRouter()
  const supabase = createClient()

  const [formData, setFormData] = useState({
    customer_name: "",
    location_address: "",
    service_name: "",
    scheduled_start: "",
    status: "open" as "open" | "in_progress" | "completed",
    assigned_to: "",
    notes: "",
  })

  useEffect(() => {
    const fetchEmployees = async () => {
      const { data } = await supabase.from("profiles").select("*").eq("role", "employee")
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
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

    const payload = {
      company_id: profile.company_id,
      created_by: user.id,
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
        <PageHeader title="Create New Job" />
      </div>

      <Card>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4 pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Customer Name</label>
                <Input
                  name="customer_name"
                  required
                  value={formData.customer_name}
                  onChange={handleChange}
                  placeholder="e.g. John Doe"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Service</label>
                <Input
                  name="service_name"
                  required
                  value={formData.service_name}
                  onChange={handleChange}
                  placeholder="e.g. Deep Cleaning"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium">Location</label>
                <Input
                  name="location_address"
                  required
                  value={formData.location_address}
                  onChange={handleChange}
                  placeholder="123 Main St, City"
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
                      {emp.full_name} ({emp.email})
                    </option>
                  ))}
                </Select>
                <p className="text-xs text-muted-foreground">Select an existing employee to assign this job. You can leave it unassigned.</p>
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium">Notes</label>
                <textarea
                  name="notes"
                  className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50 min-h-[100px]"
                  value={formData.notes}
                  onChange={handleChange}
                  placeholder="Any additional notes for the employee..."
                />
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-end gap-2 border-t p-6">
            <Button variant="outline" type="button" onClick={() => router.back()}>Cancel</Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create Job"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
