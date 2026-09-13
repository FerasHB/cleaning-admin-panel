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
import {
  getAssignmentStatsByEmployee,
  type EmployeeJobStats,
} from "@/lib/jobs/jobs.service";
import {
  createEmployee,
  getCompanyEmployees,
  getEmployeeStatus,
  type CompanyEmployee,
} from "@/lib/employees/employees.service";
import { formatPhoneForDisplay, isValidEmail, isValidPhone, normalizeEmail } from "@/lib/auth/validation";

type EmployeeStats = EmployeeJobStats;

type InviteErrors = { fullName?: string; email?: string; phone?: string };

const STATUS_BADGE: Record<string, "warning" | "success" | "secondary"> = {
  pending: "warning",
  active: "success",
  inactive: "secondary",
};

export default function EmployeesPage() {
  // Client einmalig halten → stabile Referenz für die Effect-Dependencies.
  const [supabase] = useState(() => createClient());

  const [employees, setEmployees] = useState<CompanyEmployee[]>([]);
  const [statsMap, setStatsMap] = useState<Map<string, EmployeeStats>>(
    new Map(),
  );
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Manueller Refetch-Trigger (z. B. nach dem Einladen) ohne setState im Effect.
  const [reloadKey, setReloadKey] = useState(0);

  // Einladungs-Formular (invite-basiert wie Mobile: kein Passwort)
  const [showForm, setShowForm] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [inviteErrors, setInviteErrors] = useState<InviteErrors>({});
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Daten laden: Fetch-Funktion bewusst im Effect definiert (setState erfolgt
  // erst nach await) — vermeidet die set-state-in-effect-Regel. Refetch über
  // reloadKey, supabase ist stabil → keine fehlenden Dependencies.
  useEffect(() => {
    let mounted = true;

    const load = async () => {
      // Zähler aus der Zuweisungsmenge (job_assignments) — ein Auftrag mit
      // mehreren Mitarbeitern zählt bei JEDEM von ihnen, nicht nur beim
      // Legacy-Primär jobs.assigned_to.
      const [employeesResult, statsResult] = await Promise.all([
        getCompanyEmployees(supabase).then(
          (data) => ({ data, error: null as string | null }),
          (err: unknown) => {
            console.error("Failed to load employees:", err);
            return { data: [] as CompanyEmployee[], error: "Mitarbeiter konnten nicht geladen werden." };
          },
        ),
        getAssignmentStatsByEmployee(supabase).catch((err) => {
          console.error("Failed to load assignment stats:", err);
          return new Map<string, EmployeeStats>();
        }),
      ]);

      if (!mounted) return;

      setEmployees(employeesResult.data);
      setLoadError(employeesResult.error);
      setStatsMap(statsResult);
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
    setPhone("");
    setInviteErrors({});
    setFormError(null);
    setFormSuccess(null);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setFormError(null);
    setFormSuccess(null);
  };

  // Validierung wie Mobile (Name + E-Mail Pflicht, Telefon optional/E.164).
  const validateInvite = () => {
    const next: InviteErrors = {};
    if (!fullName.trim()) next.fullName = "Name ist erforderlich.";
    if (!email.trim()) next.email = "E-Mail ist erforderlich.";
    else if (!isValidEmail(email)) next.email = "Bitte gib eine gültige E-Mail-Adresse ein.";
    if (phone.trim() && !isValidPhone(phone)) next.phone = "Bitte gib eine gültige Telefonnummer ein.";
    setInviteErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);
    if (!validateInvite()) return;

    setFormBusy(true);
    try {
      const created = await createEmployee(supabase, {
        fullName: fullName.trim(),
        email: normalizeEmail(email),
        phone: phone.trim() || null,
      });
      setFormSuccess(
        `${created.fullName} wurde eingeladen. Die Einladung wurde an ${created.email} gesendet.`,
      );
      setFullName("");
      setEmail("");
      setPhone("");
      setReloadKey((k) => k + 1);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Einladung konnte nicht verschickt werden.");
    } finally {
      setFormBusy(false);
    }
  };

  // ── Summary metrics — derived from already-loaded data, no new queries ──
  const activeNow = employees.filter(
    (e) => (statsMap.get(e.id)?.in_progress ?? 0) > 0,
  ).length;
  const openAssignments = Array.from(statsMap.values()).reduce(
    (sum, s) => sum + s.open,
    0,
  );
  const pendingInvites = employees.filter((e) => !e.inviteAcceptedAt).length;

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
          Mitarbeiter einladen
        </Button>
      </div>

      {/* ── Team summary cards ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          icon={Users}
          label="Mitarbeiter gesamt"
          value={loading ? "—" : employees.length}
          hint={loading ? "Teammitglieder" : `${pendingInvites} Einladung${pendingInvites === 1 ? "" : "en"} offen`}
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

      {/* ── Einladungs-Formular ── */}
      {showForm && (
        <SectionCard
          icon={Plus}
          title="Mitarbeiter einladen"
          subtitle="Der Mitarbeiter erhält eine E-Mail und legt sein Passwort in der TaskOps-App selbst fest."
          action={
            <Button
              variant="ghost"
              size="icon"
              aria-label="Formular schließen"
              onClick={closeForm}
              disabled={formBusy}
            >
              <X className="h-4 w-4" />
            </Button>
          }
          noBodyPadding
        >
          <form onSubmit={handleInvite} noValidate>
            <div className="space-y-4 p-5">
              {formError && (
                <div role="alert" className="rounded-md bg-destructive/10 p-3 text-sm font-medium text-destructive">
                  {formError}
                </div>
              )}
              {formSuccess && (
                <div role="status" className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-800">
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
                    value={fullName}
                    onChange={(e) => {
                      setFullName(e.target.value);
                      setInviteErrors({});
                    }}
                    disabled={formBusy}
                  />
                  {inviteErrors.fullName && (
                    <p className="text-xs font-medium text-destructive">{inviteErrors.fullName}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="emp-email">
                    E-Mail
                  </label>
                  <Input
                    id="emp-email"
                    type="email"
                    placeholder="mitarbeiter@firma.de"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setInviteErrors({});
                    }}
                    disabled={formBusy}
                  />
                  {inviteErrors.email && (
                    <p className="text-xs font-medium text-destructive">{inviteErrors.email}</p>
                  )}
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <label className="text-sm font-medium" htmlFor="emp-phone">
                    Telefon <span className="font-normal text-muted-foreground">(optional)</span>
                  </label>
                  <Input
                    id="emp-phone"
                    type="tel"
                    placeholder="0170 1234567"
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value);
                      setInviteErrors({});
                    }}
                    disabled={formBusy}
                    className="sm:max-w-xs"
                  />
                  {inviteErrors.phone && (
                    <p className="text-xs font-medium text-destructive">{inviteErrors.phone}</p>
                  )}
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
                Schließen
              </Button>
              <Button type="submit" disabled={formBusy}>
                {formBusy ? "Einladung wird gesendet…" : "Einladung senden"}
              </Button>
            </div>
          </form>
        </SectionCard>
      )}

      {loadError && (
        <div role="alert" className="rounded-md bg-destructive/10 p-3 text-sm font-medium text-destructive">
          {loadError}
        </div>
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
              <TableHead className="hidden text-xs font-medium uppercase tracking-wide text-muted-foreground sm:table-cell">Status</TableHead>
              <TableHead className="hidden text-xs font-medium uppercase tracking-wide text-muted-foreground lg:table-cell">Telefon</TableHead>
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
                  colSpan={8}
                  className="h-32 text-center text-sm text-muted-foreground"
                >
                  Mitarbeiter werden geladen…
                </TableCell>
              </TableRow>
            ) : employees.length === 0 ? (
              <TableRow className="border-b-0 hover:bg-transparent">
                <TableCell colSpan={8} className="border-b-0 p-0">
                  <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary">
                      <Users className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Noch keine Mitarbeiter</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Lade dein erstes Teammitglied ein, um zu beginnen.
                      </p>
                    </div>
                    <Button size="sm" onClick={openForm}>
                      Mitarbeiter einladen
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
                const working = stats.in_progress > 0;
                const status = getEmployeeStatus(emp);
                const initials = (emp.fullName ?? "?")
                  .split(" ")
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase();
                return (
                  <TableRow
                    key={emp.id}
                    className="group border-gray-100 transition-colors hover:bg-gray-50/70"
                  >
                    {/* Name + E-Mail + Active Now indicator */}
                    <TableCell className="py-3.5 pl-5">
                      <Link href={`/employees/${emp.id}`} className="flex items-center gap-3">
                        <div className="relative shrink-0">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                            {initials}
                          </div>
                          {working && (
                            <span className="absolute -bottom-0.5 -right-0.5 flex h-2.5 w-2.5 items-center justify-center rounded-full border-2 border-card bg-blue-500" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium leading-tight">
                            {emp.fullName}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {emp.email ?? "E-Mail nicht verfügbar"}
                          </p>
                          {working && (
                            <p className="text-[11px] font-medium text-blue-600">
                              Gerade aktiv
                            </p>
                          )}
                        </div>
                      </Link>
                    </TableCell>

                    {/* Einladungs-/Kontostatus */}
                    <TableCell className="hidden py-3.5 sm:table-cell">
                      <Badge variant={STATUS_BADGE[status.variant]}>{status.label}</Badge>
                    </TableCell>

                    {/* Telefon */}
                    <TableCell className="hidden py-3.5 text-sm text-muted-foreground lg:table-cell">
                      {emp.phone ? formatPhoneForDisplay(emp.phone) : (
                        <span className="text-xs text-muted-foreground/50">—</span>
                      )}
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
                      <Link href={`/employees/${emp.id}`} className="inline-flex" aria-label={`${emp.fullName} öffnen`}>
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
