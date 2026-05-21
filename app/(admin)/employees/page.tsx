"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Users, Plus, X } from "lucide-react";
import { Database } from "@/lib/supabase/database.types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type Job = Database["public"]["Tables"]["jobs"]["Row"];

type EmployeeStats = {
  total: number;
  open: number;
  in_progress: number;
  completed: number;
};

function generatePassword(): string {
  const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#";
  return Array.from(
    { length: 12 },
    () => chars[Math.floor(Math.random() * chars.length)],
  ).join("");
}

export default function EmployeesPage() {
  const supabase = createClient();

  const [employees, setEmployees] = useState<Profile[]>([]);
  const [statsMap, setStatsMap] = useState<Map<string, EmployeeStats>>(
    new Map(),
  );
  const [loading, setLoading] = useState(true);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);

    const [{ data: empData }, { data: jobData }] = await Promise.all([
      supabase
        .from("profiles")
        .select("*")
        .eq("role", "employee")
        .order("full_name", { ascending: true }),
      supabase.from("jobs").select("assigned_to, status"),
    ]);

    setEmployees((empData as Profile[]) ?? []);

    const map = new Map<string, EmployeeStats>();
    if (jobData) {
      (jobData as Pick<Job, "assigned_to" | "status">[]).forEach((job) => {
        if (!job.assigned_to) return;
        if (!map.has(job.assigned_to)) {
          map.set(job.assigned_to, {
            total: 0,
            open: 0,
            in_progress: 0,
            completed: 0,
          });
        }
        const s = map.get(job.assigned_to)!;
        s.total += 1;
        (s as any)[job.status] += 1;
      });
    }
    setStatsMap(map);

    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openForm = () => {
    setFullName("");
    setEmail("");
    setPassword(generatePassword());
    setFormError(null);
    setFormSuccess(null);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setFormError(null);
    setFormSuccess(null);
  };

  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormBusy(true);
    setFormError(null);
    setFormSuccess(null);

    // Get the current session JWT to pass to the Edge Function
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      setFormError("Your session has expired. Please sign in again.");
      setFormBusy(false);
      return;
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const res = await fetch(`${supabaseUrl}/functions/v1/create-employee`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        password,
      }),
    });

    const result = await res.json();

    if (!res.ok) {
      setFormError(result.error ?? "Employee creation failed.");
      setFormBusy(false);
      return;
    }

    setFormSuccess(`${result.full_name} was added successfully.`);
    setFormBusy(false);
    await fetchData();

    // Auto-close form after a short delay so the admin sees the success message
    setTimeout(() => {
      setShowForm(false);
      setFormSuccess(null);
    }, 2000);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mitarbeiter"
        description="Manage your company's employees."
      >
        <Button onClick={openForm}>
          <Plus className="mr-2 h-4 w-4" />
          Mitarbeiter hinzufügen
        </Button>
      </PageHeader>

      {/* Add Employee Form */}
      {showForm && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">Add new employee</CardTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={closeForm}
              disabled={formBusy}
            >
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>

          <form onSubmit={handleCreateEmployee}>
            <CardContent className="space-y-4">
              {formError && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive font-medium">
                  {formError}
                </div>
              )}
              {formSuccess && (
                <div className="rounded-md bg-green-50 border border-green-200 p-3 text-sm text-green-800 font-medium">
                  {formSuccess}
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="emp-name">
                    Full Name
                  </label>
                  <Input
                    id="emp-name"
                    type="text"
                    placeholder="Max Mustermann"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    disabled={formBusy}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="emp-email">
                    Email
                  </label>
                  <Input
                    id="emp-email"
                    type="email"
                    placeholder="mitarbeiter@firma.de"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={formBusy}
                  />
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <label className="text-sm font-medium" htmlFor="emp-password">
                    Temporary Password
                  </label>
                  <div className="flex gap-2">
                    <Input
                      id="emp-password"
                      type="text"
                      required
                      minLength={8}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={formBusy}
                      className="font-mono"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setPassword(generatePassword())}
                      disabled={formBusy}
                    >
                      Generate
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Share this password with the employee. They can change it
                    after first login.
                  </p>
                </div>
              </div>
            </CardContent>

            <CardFooter className="flex justify-end gap-2 border-t pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={closeForm}
                disabled={formBusy}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={formBusy}>
                {formBusy ? "Creating..." : "Add Employee"}
              </Button>
            </CardFooter>
          </form>
        </Card>
      )}

      {/* Employee Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="text-center">Total Jobs</TableHead>
              <TableHead className="text-center">Open / In Progress</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="h-24 text-center text-muted-foreground"
                >
                  Loading employees...
                </TableCell>
              </TableRow>
            ) : employees.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-auto p-0 border-b-0">
                  <EmptyState
                    icon={Users}
                    title="No employees yet"
                    description='Click "Mitarbeiter hinzufügen" to add your first employee.'
                  />
                </TableCell>
              </TableRow>
            ) : (
              employees.map((emp) => {
                const stats = statsMap.get(emp.id) ?? {
                  total: 0,
                  open: 0,
                  in_progress: 0,
                  completed: 0,
                };
                return (
                  <TableRow key={emp.id}>
                    <TableCell className="font-medium">
                      {emp.full_name}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="capitalize">
                        {emp.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">{stats.total}</TableCell>
                    <TableCell className="text-center">
                      <span className="text-muted-foreground">
                        {stats.open} / {stats.in_progress}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
