"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
import { SectionCard } from "@/components/dashboard/SectionCard";
import { StatCard } from "@/components/dashboard/StatCard";
import { Users, Plus, X, Activity, Inbox, ChevronRight } from "lucide-react";
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
  // Client einmalig halten → stabile Referenz für die Effect-Dependencies.
  const [supabase] = useState(() => createClient());

  const [employees, setEmployees] = useState<Profile[]>([]);
  const [statsMap, setStatsMap] = useState<Map<string, EmployeeStats>>(
    new Map(),
  );
  const [loading, setLoading] = useState(true);
  // Manueller Refetch-Trigger (z. B. nach dem Anlegen) ohne setState im Effect.
  const [reloadKey, setReloadKey] = useState(0);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Daten laden: Fetch-Funktion bewusst im Effect definiert (setState erfolgt
  // erst nach await) — vermeidet die set-state-in-effect-Regel. Refetch über
  // reloadKey, supabase ist stabil → keine fehlenden Dependencies.
  useEffect(() => {
    let mounted = true;

    const load = async () => {
      const [{ data: empData }, { data: jobData }] = await Promise.all([
        supabase
          .from("profiles")
          .select("*")
          .eq("role", "employee")
          .order("full_name", { ascending: true }),
        supabase.from("jobs").select("assigned_to, status"),
      ]);

      if (!mounted) return;

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
          if (job.status === "open") s.open += 1;
          else if (job.status === "in_progress") s.in_progress += 1;
          else if (job.status === "completed") s.completed += 1;
        });
      }
      setStatsMap(map);

      setLoading(false);
    };

    void load();
    return () => {
      mounted = false;
    };
  }, [supabase, reloadKey]);

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
    setReloadKey((k) => k + 1);

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
    <div className="space-y-5">

      {/* ── Page header ── */}
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Mitarbeiter
          </h1>
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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          icon={Users}
          label="Mitarbeiter gesamt"
          value={loading ? "—" : employees.length}
          hint="Teammitglieder"
          tone="primary"
        />
        <StatCard
          icon={Activity}
          label="Gerade aktiv"
          value={loading ? "—" : activeNow}
          hint="Aufträge in Arbeit"
          tone="blue"
        />
        <StatCard
          icon={Inbox}
          label="Offene Zuweisungen"
          value={loading ? "—" : openAssignments}
          hint="Offene zugewiesene Aufträge"
          tone="amber"
        />
      </div>

      {/* ── Add Employee Form ── */}
      {showForm && (
        <SectionCard
          icon={Plus}
          title="Neuen Mitarbeiter hinzufügen"
          action={
            <Button
              variant="ghost"
              size="icon"
              onClick={closeForm}
              disabled={formBusy}
            >
              <X className="h-4 w-4" />
            </Button>
          }
          noBodyPadding
        >
          <form onSubmit={handleCreateEmployee}>
            <div className="space-y-4 p-5">
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
            </div>

            <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-4">
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
            </div>
          </form>
        </SectionCard>
      )}

      {/* ── Employee Table ── */}
      <SectionCard
        icon={Users}
        title="Teammitglieder"
        subtitle={
          loading
            ? "Laden…"
            : `${employees.length} Mitarbeiter`
        }
        noBodyPadding
      >
        <Table>
          <TableHeader>
            <TableRow className="border-gray-100 hover:bg-transparent">
              <TableHead className="pl-5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Name</TableHead>
              <TableHead className="hidden text-xs font-medium uppercase tracking-wide text-muted-foreground sm:table-cell">Rolle</TableHead>
              <TableHead className="text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">Offen</TableHead>
              <TableHead className="text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">In Arbeit</TableHead>
              <TableHead className="text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">Erledigt</TableHead>
              <TableHead className="text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">Gesamt</TableHead>
              <TableHead className="w-[44px] pr-5" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow className="border-gray-100 hover:bg-transparent">
                <TableCell
                  colSpan={7}
                  className="h-32 text-center text-sm text-muted-foreground"
                >
                  Mitarbeiter werden geladen…
                </TableCell>
              </TableRow>
            ) : employees.length === 0 ? (
              <TableRow className="border-b-0 hover:bg-transparent">
                <TableCell colSpan={7} className="border-b-0 p-0">
                  <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary">
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
                    className="group cursor-pointer border-gray-100 transition-colors hover:bg-gray-50/70"
                  >
                    {/* Name + Active Now indicator */}
                    <TableCell className="py-3.5 pl-5">
                      <Link href={`/employees/${emp.id}`} className="flex items-center gap-3">
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
                      </Link>
                    </TableCell>

                    {/* Email — not in profiles schema; show role as badge instead */}
                    <TableCell className="hidden py-3.5 sm:table-cell">
                      <Badge variant="secondary">Mitarbeiter</Badge>
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
                    <TableCell className="py-3.5 text-center">
                      <span className="text-sm font-semibold">
                        {stats.total > 0 ? stats.total : (
                          <span className="font-normal text-muted-foreground/50">—</span>
                        )}
                      </span>
                    </TableCell>

                    {/* Chevron */}
                    <TableCell className="py-3.5 pr-5 text-right">
                      <Link href={`/employees/${emp.id}`} className="inline-flex">
                        <ChevronRight className="h-4 w-4 text-muted-foreground/40 transition-colors group-hover:text-muted-foreground" />
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </SectionCard>

    </div>
  );
}
