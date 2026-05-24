"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
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
import { Users, Plus, X, Activity } from "lucide-react";
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
      setFormError("Ihre Sitzung ist abgelaufen. Bitte melden Sie sich erneut an.");
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
      setFormError(result.error ?? "Mitarbeiter konnte nicht erstellt werden.");
      setFormBusy(false);
      return;
    }

    setFormSuccess(`${result.full_name} wurde erfolgreich hinzugefügt.`);
    setFormBusy(false);
    await fetchData();

    // Auto-close form after a short delay so the admin sees the success message
    setTimeout(() => {
      setShowForm(false);
      setFormSuccess(null);
    }, 2000);
  };

  // ── Summary metrics — derived from already-loaded data, no new queries ──
  const activeNow = employees.filter(
    (e) => (statsMap.get(e.id)?.in_progress ?? 0) > 0,
  ).length;
  const openAssignments = Array.from(statsMap.values()).reduce(
    (sum, s) => sum + s.open,
    0,
  );

  return (
    <div className="space-y-6">

      {/* ── Page header ── */}
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Mitarbeiter</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Team verwalten und Auftragszuweisungen verfolgen.
          </p>
        </div>
        <Button onClick={openForm}>
          <Plus className="mr-2 h-4 w-4" />
          Mitarbeiter hinzufügen
        </Button>
      </div>

      {/* ── Team summary cards ── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {/* Total Employees */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between p-4 pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Mitarbeiter gesamt
            </CardTitle>
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-secondary">
              <Users className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-0">
            <p className="text-3xl font-bold">
              {loading ? "—" : employees.length}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">Teammitglieder</p>
          </CardContent>
        </Card>

        {/* Active Now */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between p-4 pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Gerade aktiv
            </CardTitle>
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-50">
              <Activity className="h-3.5 w-3.5 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-0">
            <p className="text-3xl font-bold text-blue-600">
              {loading ? "—" : activeNow}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Aufträge in Arbeit
            </p>
          </CardContent>
        </Card>

        {/* Open Assignments */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between p-4 pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Offene Zuweisungen
            </CardTitle>
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-amber-50">
              <Users className="h-3.5 w-3.5 text-amber-600" />
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-0">
            <p className="text-3xl font-bold text-amber-600">
              {loading ? "—" : openAssignments}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Offene zugewiesene Aufträge
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── Add Employee Form ── */}
      {showForm && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
            <CardTitle className="text-sm font-semibold">Neuen Mitarbeiter hinzufügen</CardTitle>
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
            <CardContent className="space-y-4 pt-4">
              {formError && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm font-medium text-destructive">
                  {formError}
                </div>
              )}
              {formSuccess && (
                <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-800">
                  {formSuccess}
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="emp-name">
                    Vollständiger Name
                  </label>
                  <Input
                    id="emp-name"
                    type="text"
                    placeholder="Jane Smith"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    disabled={formBusy}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="emp-email">
                    E-Mail
                  </label>
                  <Input
                    id="emp-email"
                    type="email"
                    placeholder="employee@company.com"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={formBusy}
                  />
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <label className="text-sm font-medium" htmlFor="emp-password">
                    Temporäres Passwort
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
                      Generieren
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Dieses Passwort an den Mitarbeiter weitergeben. Es kann nach der
                    ersten Anmeldung geändert werden.
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
                Abbrechen
              </Button>
              <Button type="submit" disabled={formBusy}>
                {formBusy ? "Wird erstellt…" : "Mitarbeiter hinzufügen"}
              </Button>
            </CardFooter>
          </form>
        </Card>
      )}

      {/* ── Employee Table ── */}
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b px-5 py-3.5">
          <p className="text-sm font-semibold">Teammitglieder</p>
          {!loading && (
            <p className="text-xs text-muted-foreground">
              {employees.length}{" "}
              {employees.length === 1 ? "Mitarbeiter" : "Mitarbeiter"}
            </p>
          )}
        </div>
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="pl-5 font-semibold text-foreground">Name</TableHead>
              <TableHead className="hidden font-semibold text-foreground sm:table-cell">Rolle</TableHead>
              <TableHead className="text-center font-semibold text-foreground">Offen</TableHead>
              <TableHead className="text-center font-semibold text-foreground">In Arbeit</TableHead>
              <TableHead className="text-center font-semibold text-foreground">Erledigt</TableHead>
              <TableHead className="pr-5 text-center font-semibold text-foreground">Gesamt</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="h-32 text-center text-sm text-muted-foreground"
                >
                  Mitarbeiter werden geladen…
                </TableCell>
              </TableRow>
            ) : employees.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="border-b-0 p-0">
                  <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                      <Users className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Noch keine Mitarbeiter</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Fügen Sie Ihr erstes Teammitglied hinzu, um zu beginnen.
                      </p>
                    </div>
                    <Button size="sm" onClick={openForm}>
                      Mitarbeiter hinzufügen
                    </Button>
                  </div>
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
                const isActive = stats.in_progress > 0;
                const initials = (emp.full_name ?? "?")
                  .split(" ")
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase();
                return (
                  <TableRow
                    key={emp.id}
                    className="transition-colors hover:bg-muted/40"
                  >
                    {/* Name + Active Now indicator */}
                    <TableCell className="py-3.5 pl-5">
                      <div className="flex items-center gap-3">
                        <div className="relative shrink-0">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                            {initials}
                          </div>
                          {isActive && (
                            <span className="absolute -bottom-0.5 -right-0.5 flex h-2.5 w-2.5 items-center justify-center rounded-full border-2 border-card bg-blue-500" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium leading-tight">
                            {emp.full_name}
                          </p>
                          {isActive && (
                            <p className="text-[11px] font-medium text-blue-600">
                              Gerade aktiv
                            </p>
                          )}
                        </div>
                      </div>
                    </TableCell>

                    {/* Email — not in profiles schema; show role instead */}
                    <TableCell className="hidden py-3.5 text-sm text-muted-foreground sm:table-cell capitalize">
                      {emp.role}
                    </TableCell>

                    {/* Open */}
                    <TableCell className="py-3.5 text-center">
                      {stats.open > 0 ? (
                        <Badge variant="warning">{stats.open}</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground/50">—</span>
                      )}
                    </TableCell>

                    {/* In Progress */}
                    <TableCell className="py-3.5 text-center">
                      {stats.in_progress > 0 ? (
                        <Badge variant="info">{stats.in_progress}</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground/50">—</span>
                      )}
                    </TableCell>

                    {/* Completed */}
                    <TableCell className="py-3.5 text-center">
                      {stats.completed > 0 ? (
                        <Badge variant="success">{stats.completed}</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground/50">—</span>
                      )}
                    </TableCell>

                    {/* Total */}
                    <TableCell className="py-3.5 pr-5 text-center">
                      <span className="text-sm font-semibold">
                        {stats.total > 0 ? stats.total : (
                          <span className="font-normal text-muted-foreground/50">—</span>
                        )}
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
