import { createClient } from "@/lib/supabase/server"
import { PageHeader } from "@/components/ui/page-header"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"
import { Users } from "lucide-react"
import { Database } from "@/lib/supabase/database.types"

type Profile = Database['public']['Tables']['profiles']['Row']
type Job = Database['public']['Tables']['jobs']['Row']

export default async function EmployeesPage() {
  const supabase = await createClient()

  // Fetch employees
  const { data: employees } = await supabase
    .from("profiles")
    .select("*")
    .eq("role", "employee")
    .order("full_name", { ascending: true })

  // Fetch all jobs to aggregate counts
  // Doing this in memory for simplicity on small datasets.
  const { data: jobs } = await supabase.from("jobs").select("assigned_to, status")

  // Map jobs to employees
  const employeeStats = new Map()

  if (jobs) {
    (jobs as Job[]).forEach(job => {
      if (job.assigned_to) {
        if (!employeeStats.has(job.assigned_to)) {
          employeeStats.set(job.assigned_to, { total: 0, open: 0, in_progress: 0, completed: 0 })
        }
        const stats = employeeStats.get(job.assigned_to)
        stats.total += 1
        stats[job.status] += 1
      }
    })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Employees"
        description="View all registered employees and their assigned jobs. (Read-only)"
      />

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="text-center">Total Jobs</TableHead>
              <TableHead className="text-center">Open/In Progress</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!employees || employees.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-auto p-0 border-b-0">
                  <EmptyState
                    icon={Users}
                    title="No employees found"
                    description="There are currently no users with the employee role."
                  />
                </TableCell>
              </TableRow>
            ) : (
              (employees as Profile[]).map((emp) => {
                const stats = employeeStats.get(emp.id) || { total: 0, open: 0, in_progress: 0, completed: 0 }
                return (
                  <TableRow key={emp.id}>
                    <TableCell className="font-medium">{emp.full_name}</TableCell>

                    <TableCell>
                      <Badge variant="secondary" className="capitalize">{emp.role}</Badge>
                    </TableCell>
                    <TableCell className="text-center">{stats.total}</TableCell>
                    <TableCell className="text-center">
                      <span className="text-muted-foreground">
                        {stats.open} / {stats.in_progress}
                      </span>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
