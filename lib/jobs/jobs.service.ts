// lib/jobs/jobs.service.ts
// Supabase-Operationen für Aufträge — Port von Mobiles
// services/jobs/jobs.service.ts (createJob, updateJob, deleteJob, Lesepfade).
//
// Web schreibt Aufträge damit EXAKT wie Mobile:
//   - jobs.status wird nie aus Formularen geschrieben (neue Aufträge: 'open';
//     Übergänge nur über start_own_job/complete_own_job der Mitarbeiter).
//   - jobs.assigned_to wird nie direkt geschrieben. Die Zuweisungsmenge läuft
//     ausschließlich über set_job_assignments; den Legacy-Zeiger pflegen die
//     Kompatibilitäts-Trigger im Backend.
//   - Daueraufträge: generate_job_occurrences (Anlegen) bzw.
//     update_job_occurrences (Bearbeiten der Regel).
//
// Reihenfolge, Kompensation und Fehlermeldungen folgen Mobile 1:1 — keine
// eigene Recovery-Strategie.

import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/database.types"
import { buildSchedulePayload, type JobType } from "@/lib/jobs/schedule"

type DB = SupabaseClient<Database>

type JobRowBase = Database["public"]["Tables"]["jobs"]["Row"]

// Eine Zeile aus job_assignments, wie sie eingebettet zurückkommt.
// profiles ist der LEBENDE Mitarbeiter; bei gelöschtem Konto ist
// employee_id NULL und profiles fehlt — dann trägt der Snapshot den Namen.
export type JobAssignmentRow = {
  id: string
  employee_id: string | null
  employee_name_snapshot: string | null
  assigned_at: string | null
  employee_started_at: string | null
  employee_completed_at: string | null
  profiles?:
    | { id: string; full_name: string | null }
    | { id: string; full_name: string | null }[]
    | null
}

// Auftrag inkl. eingebetteter Zuweisungsmenge (Alias "assignments").
export type JobWithAssignments = JobRowBase & {
  assignments: JobAssignmentRow[] | null
}

// Anzeigeform eines Zugewiesenen (Port von Mobiles JobAssignee).
export type JobAssignee = {
  assignmentId: string
  employeeId: string | null
  fullName: string
  isDeleted: boolean
  employeeStartedAt: string | null
  employeeCompletedAt: string | null
}

// Wird von updateJob() geworfen, wenn set_job_assignments bereits committed
// wurde, das nachfolgende jobs-UPDATE und/oder update_job_occurrences aber
// fehlschlug. Kein Rollback, sondern ein echter Teilerfolg (wie Mobile).
export class PartialUpdateError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "PartialUpdateError"
  }
}

// EINZIGE Spaltenauswahl für Auftrags-Abfragen — identisch zu Mobiles
// JOB_SELECT (ohne den Legacy-Embed profiles:assigned_to, den Web nicht mehr
// anzeigt). Zuweisungen kommen ausschließlich aus job_assignments.
export const JOB_SELECT = `
  *,
  assignments:job_assignments (
    id,
    employee_id,
    employee_name_snapshot,
    assigned_at,
    employee_started_at,
    employee_completed_at,
    profiles:employee_id (
      id,
      full_name
    )
  )
`

// Filter-Embed für "Mitarbeiter X ist zugewiesen" — wie Mobiles
// ASSIGNEE_FILTER_EMBED: schränkt nur die Zeilenmenge ein, der Anzeige-Embed
// `assignments` liefert weiterhin die VOLLSTÄNDIGE Menge.
const ASSIGNEE_FILTER_EMBED = `,f:job_assignments!inner(employee_id)`

function firstProfileName(profiles: JobAssignmentRow["profiles"]): string | null {
  if (!profiles) return null
  if (Array.isArray(profiles)) return profiles[0]?.full_name ?? null
  return profiles.full_name ?? null
}

// NAMENSREGEL (wie Mobile): der lebende Profilname gewinnt, solange das Profil
// existiert; erst bei gelöschtem Konto trägt der Schnappschuss den Namen.
// SORTIERUNG: assigned_at, dann Name, dann assignmentId (stabil).
export function mapAssignees(
  rows: JobAssignmentRow[] | null | undefined,
): JobAssignee[] {
  if (!rows || rows.length === 0) return []

  return rows
    .map((row) => {
      const livingName = firstProfileName(row.profiles)
      const snapshot = row.employee_name_snapshot?.trim() || null
      return {
        assignedAt: row.assigned_at ?? "",
        assignee: {
          assignmentId: row.id,
          employeeId: row.employee_id,
          fullName: livingName?.trim() || snapshot || "Unbekannt",
          isDeleted: row.employee_id === null,
          employeeStartedAt: row.employee_started_at,
          employeeCompletedAt: row.employee_completed_at,
        } satisfies JobAssignee,
      }
    })
    .sort((a, b) => {
      const timeDiff = a.assignedAt.localeCompare(b.assignedAt)
      if (timeDiff !== 0) return timeDiff
      const nameDiff = a.assignee.fullName.localeCompare(b.assignee.fullName, "de")
      if (nameDiff !== 0) return nameDiff
      return a.assignee.assignmentId.localeCompare(b.assignee.assignmentId)
    })
    .map((entry) => entry.assignee)
}

export const UNASSIGNED_LABEL = "Nicht zugewiesen"
export const DELETED_SUFFIX = " (ehemalig)"

// Port von Mobiles isCorrectableAssignment (utils/jobAssignees.ts): darf für
// DIESE ZEILE überhaupt admin_correct_assignment_time gerufen werden?
//   1. employeeId muss gesetzt sein — anonymisierte Zeilen (gelöschtes Konto)
//      lehnt die RPC ausdrücklich ab.
//   2. assignmentId muss eine echte job_assignments-UUID sein. Web zeigt
//      (anders als Mobile) keinen Legacy-Fallback mit synthetischen IDs
//      (siehe JOB_SELECT-Kommentar oben), die Prüfung bleibt dennoch als
//      exakter Spiegel der Mobile-Regel bestehen.
// Die Auftrags-Bedingungen (job_type='single', abgeschlossen, nach dem
// Phase-1-Cutoff) prüft weiterhin allein isCorrectableJob — sie sind hier
// nicht zuverlässig bekannt.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isCorrectableAssignment(assignee: Pick<JobAssignee, "employeeId" | "assignmentId">): boolean {
  if (!assignee.employeeId) return false
  return UUID_RE.test(assignee.assignmentId)
}

export function getAssigneeNames(job: Pick<JobWithAssignments, "assignments">): string[] {
  return mapAssignees(job.assignments).map((a) =>
    a.isDeleted ? `${a.fullName}${DELETED_SUFFIX}` : a.fullName,
  )
}

// true, wenn der Mitarbeiter irgendwo in der Zuweisungsmenge steht.
export function isAssignedTo(
  job: Pick<JobWithAssignments, "assignments">,
  employeeId: string | null | undefined,
): boolean {
  if (!employeeId) return false
  return (job.assignments ?? []).some((a) => a.employee_id === employeeId)
}

// ── Klassifikation (Backend-Modell) ─────────────────────────────────────────

// Parent-Regel eines Dauerauftrags: Vorlage, kein startbarer Termin.
export function isRecurringRule(job: Pick<JobRowBase, "job_type" | "parent_job_id">): boolean {
  return job.job_type === "recurring" && job.parent_job_id == null
}

// Generierter Termin einer Regel (job_type='single', parent_job_id gesetzt).
export function isOccurrence(job: Pick<JobRowBase, "parent_job_id">): boolean {
  return job.parent_job_id != null
}

// Eigenständiger Einzelauftrag.
export function isStandaloneSingle(job: Pick<JobRowBase, "job_type" | "parent_job_id">): boolean {
  return job.job_type === "single" && job.parent_job_id == null
}

// Ausführbare Arbeit (Einzelaufträge UND Termine) — hat einen echten Status.
export function isExecutableJob(job: Pick<JobRowBase, "job_type">): boolean {
  return job.job_type === "single"
}

// Schließt PAUSIERTE Dauerauftrags-Termine aus operativen Abfragen aus
// (identisch zu Mobiles excludePausedOccurrences): offene Termine einer
// deaktivierten Regel. Gestartete/abgeschlossene Termine bleiben sichtbar.
export function excludePausedOccurrences<T>(query: T): T {
  // Gleiches Muster wie Mobile — der PostgREST-Builder-Typ ist generisch
  // nicht sauber durchreichbar.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const q = query as any
  return q.or("parent_job_id.is.null,is_active.is.true,status.neq.open")
}

// ── Lesepfade ───────────────────────────────────────────────────────────────

// Alle Aufträge der Firma (RLS) ohne pausierte Termine — wie Mobiles getJobs.
export async function getJobs(supabase: DB): Promise<JobWithAssignments[]> {
  const { data, error } = await excludePausedOccurrences(
    supabase.from("jobs").select(JOB_SELECT),
  ).order("created_at", { ascending: false })

  if (error) throw error
  return (data ?? []) as unknown as JobWithAssignments[]
}

export async function getJobById(
  supabase: DB,
  jobId: string,
): Promise<JobWithAssignments | null> {
  const { data, error } = await supabase
    .from("jobs")
    .select(JOB_SELECT)
    .eq("id", jobId)
    .maybeSingle()

  if (error) throw error
  return (data as unknown as JobWithAssignments | null) ?? null
}

// Generierte Termine einer Regel, nach Datum/Uhrzeit (wie Mobiles
// getJobOccurrences — inkl. pausierter, weil Regel-Verwaltung sie zeigen muss).
export async function getJobOccurrences(
  supabase: DB,
  parentJobId: string,
): Promise<JobWithAssignments[]> {
  const { data, error } = await supabase
    .from("jobs")
    .select(JOB_SELECT)
    .eq("parent_job_id", parentJobId)
    .order("date", { ascending: true })
    .order("start_time", { ascending: true })

  if (error) throw error
  return (data ?? []) as unknown as JobWithAssignments[]
}

// Ausführbare Aufträge in einem Datumsfenster (für den Kalender) — wie
// Mobiles getScheduleOccurrences: job_type='single' schließt Regeln aus
// (Regeln haben kein date), excludePausedOccurrences blendet pausierte
// offene Termine aus. from/to: lokale "YYYY-MM-DD" (inklusive).
export async function getJobsInRange(
  supabase: DB,
  fromDateKey: string,
  toDateKey: string,
): Promise<JobWithAssignments[]> {
  const { data, error } = await excludePausedOccurrences(
    supabase
      .from("jobs")
      .select(JOB_SELECT)
      .eq("job_type", "single")
      .gte("date", fromDateKey)
      .lte("date", toDateKey),
  )
    .order("date", { ascending: true })
    .order("start_time", { ascending: true })

  if (error) throw error
  return (data ?? []) as unknown as JobWithAssignments[]
}

// Ausführbare Aufträge EINES Mitarbeiters in einem Datumsfenster — Kombination
// aus getJobsInRange (Datumsfenster) und getExecutableJobsForEmployee
// (Zuweisungsfilter), wie Mobiles getScheduleOccurrences({employee}). Für den
// Stundenzettel: liefert planned_duration_minutes je zugewiesener Occurrence,
// NIE aus tatsächlicher Arbeitszeit abgeleitet (siehe lib/timesheets).
export async function getJobsInRangeForEmployee(
  supabase: DB,
  employeeId: string,
  fromDateKey: string,
  toDateKey: string,
): Promise<JobWithAssignments[]> {
  const { data, error } = await excludePausedOccurrences(
    supabase
      .from("jobs")
      .select(JOB_SELECT + ASSIGNEE_FILTER_EMBED)
      .eq("job_type", "single")
      .eq("f.employee_id", employeeId)
      .gte("date", fromDateKey)
      .lte("date", toDateKey),
  )
    .order("date", { ascending: true })
    .order("start_time", { ascending: true })

  if (error) throw error
  return (data ?? []) as unknown as JobWithAssignments[]
}

// Ausführbare Aufträge, denen ein Mitarbeiter zugewiesen ist (Zuweisungsmenge,
// nicht Legacy-Zeiger) — serverseitiger Filter wie Mobiles applyEmployeeFilter.
export async function getExecutableJobsForEmployee(
  supabase: DB,
  employeeId: string,
): Promise<JobWithAssignments[]> {
  const { data, error } = await excludePausedOccurrences(
    supabase
      .from("jobs")
      .select(JOB_SELECT + ASSIGNEE_FILTER_EMBED)
      .eq("job_type", "single")
      .eq("f.employee_id", employeeId),
  ).order("created_at", { ascending: false })

  if (error) throw error
  return (data ?? []) as unknown as JobWithAssignments[]
}

// ── Dashboard-KPIs ──────────────────────────────────────────────────────────
// 1:1-Port von Mobiles getScheduleKpis (services/jobs/jobs.service.ts): reine
// count/head-Abfragen mit Mobiles operativen Fenstern — unabhängig von der
// Zeilenmenge der Jobliste. Regeln sind über job_type='single' ausgeschlossen,
// pausierte offene Termine über excludePausedOccurrences, date-NULL-Zeilen
// fallen durch die Datumsvergleiche heraus.
//   Heute     : date = heute (alle Status)
//   Offen     : status=open UND morgen ≤ date ≤ heute+30
//   In Arbeit : status=in_progress
//   Erledigt  : status=completed UND completed_at ≥ heute−30
// Mobiles fünfter Zähler (Überfällig) speist dort nur ein Banner, das Web
// (noch) nicht hat — deshalb hier nicht abgefragt.

export const KPI_OPEN_WINDOW_DAYS = 30
export const KPI_COMPLETED_LOOKBACK_DAYS = 30

export type ScheduleKpis = {
  heute: number
  offen: number
  inArbeit: number
  erledigt: number
}

function addDaysToKey(key: string, days: number): string {
  const [y, m, d] = key.split("-").map((n) => parseInt(n, 10))
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + days)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`
}

async function countJobs(
  supabase: DB,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  build: (q: any) => any,
): Promise<number> {
  const base = excludePausedOccurrences(
    supabase.from("jobs").select("id", { count: "exact", head: true }).eq("job_type", "single"),
  )
  const { count, error } = await build(base)
  if (error) throw error
  return count ?? 0
}

// todayKey: lokales "YYYY-MM-DD" (wie Mobiles formatDateISO(new Date())).
export async function getScheduleKpis(supabase: DB, todayKey: string): Promise<ScheduleKpis> {
  const tomorrowKey = addDaysToKey(todayKey, 1)
  const openEndKey = addDaysToKey(todayKey, KPI_OPEN_WINDOW_DAYS)
  const completedSinceKey = addDaysToKey(todayKey, -KPI_COMPLETED_LOOKBACK_DAYS)

  const [heute, offen, inArbeit, erledigt] = await Promise.all([
    countJobs(supabase, (q) => q.eq("date", todayKey)),
    countJobs(supabase, (q) =>
      q.eq("status", "open").gte("date", tomorrowKey).lte("date", openEndKey),
    ),
    countJobs(supabase, (q) => q.eq("status", "in_progress")),
    countJobs(supabase, (q) =>
      q.eq("status", "completed").gte("completed_at", completedSinceKey),
    ),
  ])

  return { heute, offen, inArbeit, erledigt }
}

export type EmployeeJobStats = {
  total: number
  open: number
  in_progress: number
  completed: number
}

type AssignmentStatsRow = {
  employee_id: string | null
  job:
    | Pick<JobRowBase, "status" | "job_type" | "parent_job_id" | "is_active">
    | Pick<JobRowBase, "status" | "job_type" | "parent_job_id" | "is_active">[]
    | null
}

// Auftragszähler je Mitarbeiter aus der Zuweisungsmenge (job_assignments),
// nicht aus dem Legacy-Zeiger jobs.assigned_to. Gezählt wird nur ausführbare
// Arbeit (Einzelaufträge + Termine); Regeln sind Vorlagen und pausierte offene
// Termine keine operative Arbeit (wie excludePausedOccurrences).
export async function getAssignmentStatsByEmployee(
  supabase: DB,
): Promise<Map<string, EmployeeJobStats>> {
  const { data, error } = await supabase
    .from("job_assignments")
    .select("employee_id, job:jobs!inner(status, job_type, parent_job_id, is_active)")
    .not("employee_id", "is", null)

  if (error) throw error

  const map = new Map<string, EmployeeJobStats>()
  for (const row of (data ?? []) as unknown as AssignmentStatsRow[]) {
    const job = Array.isArray(row.job) ? row.job[0] : row.job
    if (!row.employee_id || !job) continue
    if (!isExecutableJob(job)) continue
    if (job.parent_job_id != null && job.is_active === false && job.status === "open") continue

    const stats = map.get(row.employee_id) ?? { total: 0, open: 0, in_progress: 0, completed: 0 }
    stats.total += 1
    if (job.status === "open") stats.open += 1
    else if (job.status === "in_progress") stats.in_progress += 1
    else if (job.status === "completed") stats.completed += 1
    map.set(row.employee_id, stats)
  }
  return map
}

export type EmployeeOption = {
  id: string
  fullName: string
  isActive: boolean
}

// Alle Mitarbeiter der Firma inkl. inaktiver (wie Mobiles getEmployees) —
// gefiltert wird gezielt am Zuweisungs-Picker, nicht in der Datenquelle.
export async function getEmployees(supabase: DB): Promise<EmployeeOption[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, is_active")
    .eq("role", "employee")
    .order("is_active", { ascending: false })
    .order("full_name", { ascending: true })

  if (error) throw error
  return (data ?? []).map((row) => ({
    id: row.id,
    fullName: row.full_name ?? "Unbenannt",
    isActive: row.is_active !== false,
  }))
}

// ── Schreibpfade ────────────────────────────────────────────────────────────

export type JobInput = {
  customerName: string
  location: string
  service: string
  // Zuweisungsmenge. Leer = niemandem zugewiesen.
  employeeIds?: string[]
  notes?: string | null
  jobType: JobType
  date?: string | null
  startTime?: string | null
  recurringDays?: string[] | null
  isActive?: boolean
  recurrenceStartDate?: string | null
  recurrenceEndDate?: string | null
  // single: aus Datum + Uhrzeit abgeleiteter ISO-Zeitstempel; recurring: null
  scheduledStart?: string | null
  plannedDurationMinutes?: number | null
}

export type UpdateJobInput = JobInput & { jobId: string }

export type CreateJobResult = {
  jobId: string
  // true nur bei recurring, wenn generate_job_occurrences fehlschlug.
  recurringOccurrencesFailed: boolean
}

function normalizeEmployeeIds(ids: string[] | null | undefined): string[] {
  return Array.from(new Set((ids ?? []).filter((id): id is string => !!id)))
}

async function callSetJobAssignments(
  supabase: DB,
  jobId: string,
  employeeIds: string[],
): Promise<void> {
  const { error } = await supabase.rpc("set_job_assignments", {
    p_job_id: jobId,
    p_employee_ids: employeeIds,
  })
  if (error) throw error
}

async function requireAdminProfile(supabase: DB, deniedMessage: string) {
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError) throw authError

  const userId = authData.user?.id
  if (!userId) {
    throw new Error("Kein eingeloggter Benutzer gefunden.")
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("company_id, role")
    .eq("id", userId)
    .single()

  if (profileError) {
    throw new Error("Profil konnte nicht geladen werden.")
  }
  if (!profile) {
    throw new Error("Kein Profil für den aktuellen Benutzer gefunden.")
  }
  if (profile.role !== "admin") {
    throw new Error(deniedMessage)
  }

  return { userId, companyId: profile.company_id }
}

function requireTrimmedBasics(input: JobInput) {
  const customerName = input.customerName.trim()
  const serviceName = input.service.trim()
  const locationAddress = input.location.trim()

  if (!customerName) throw new Error("Kundenname fehlt.")
  if (!locationAddress) throw new Error("Adresse fehlt.")
  if (!serviceName) throw new Error("Service fehlt.")

  return { customerName, serviceName, locationAddress }
}

// Erstellt einen Auftrag — Reihenfolge wie Mobile:
//   1. jobs INSERT (status 'open', KEIN assigned_to)
//   2. set_job_assignments — schlägt es fehl, wird der neue Auftrag wieder
//      gelöscht (Kompensation), damit kein "Geister-Job" liegen bleibt
//   3. recurring: generate_job_occurrences (Fehler bricht nicht ab)
export async function createJob(
  supabase: DB,
  input: JobInput,
): Promise<CreateJobResult> {
  const { userId, companyId } = await requireAdminProfile(
    supabase,
    "Nur Admins dürfen Jobs erstellen.",
  )

  if (!companyId) {
    throw new Error("Kein company_id im Profil gefunden.")
  }

  const { customerName, serviceName, locationAddress } = requireTrimmedBasics(input)
  const schedule = buildSchedulePayload(input)
  const employeeIds = normalizeEmployeeIds(input.employeeIds)

  const payload = {
    company_id: companyId,
    created_by: userId,
    customer_name: customerName,
    service_name: serviceName,
    location_address: locationAddress,
    scheduled_start: input.scheduledStart ?? null,
    planned_duration_minutes: input.plannedDurationMinutes ?? null,
    notes: input.notes?.trim() ? input.notes.trim() : null,
    status: "open" as const,
    ...schedule,
  }

  const { data, error } = await supabase
    .from("jobs")
    .insert(payload)
    .select("id")
    .single()

  if (error) throw error
  if (!data) {
    throw new Error("Job wurde angelegt, aber kein Datensatz zurückgegeben.")
  }

  try {
    await callSetJobAssignments(supabase, data.id, employeeIds)
  } catch (assignError) {
    // Kompensation wie Mobile: den unvollständigen Auftrag wieder löschen.
    const { error: deleteError } = await supabase
      .from("jobs")
      .delete()
      .eq("id", data.id)

    if (deleteError) {
      console.error("[createJob] Kompensations-Löschung fehlgeschlagen:", deleteError)
      throw new Error(
        "Der Auftrag wurde angelegt, aber die Mitarbeiterzuweisung ist " +
          "fehlgeschlagen. Bitte prüfe den Auftrag in der Jobliste.",
      )
    }

    console.error("[createJob] Zuweisung fehlgeschlagen:", assignError)
    throw new Error(
      "Der Auftrag konnte nicht mit den gewählten Mitarbeitern angelegt " +
        "werden. Es wurde nichts gespeichert — bitte erneut versuchen.",
    )
  }

  let recurringOccurrencesFailed = false
  if (schedule.job_type === "recurring") {
    const { error: occurrenceError } = await supabase.rpc(
      "generate_job_occurrences",
      { parent_job_id_input: data.id },
    )
    if (occurrenceError) {
      recurringOccurrencesFailed = true
      console.error(
        "[createJob] generate_job_occurrences fehlgeschlagen:",
        occurrenceError.message,
      )
    }
  }

  return { jobId: data.id, recurringOccurrencesFailed }
}

// Aktualisiert einen Auftrag — Reihenfolge wie Mobile:
//   1. set_job_assignments ZUERST (damit die Regel-Synchronisierung die neue
//      Menge sieht)
//   2. jobs UPDATE (KEIN status, KEIN assigned_to)
//   3. recurring Parent-Regel: update_job_occurrences
// Schritt 2/3 sind nicht transaktional mit Schritt 1 — ein Fehlschlag dort ist
// ein Teilerfolg (PartialUpdateError), kein Rollback, kein automatischer Retry.
export async function updateJob(supabase: DB, input: UpdateJobInput): Promise<void> {
  await requireAdminProfile(supabase, "Nur Admins dürfen Jobs bearbeiten.")

  const { customerName, serviceName, locationAddress } = requireTrimmedBasics(input)
  // Validierung VOR jedem Schreibvorgang — ein Fehler darf keine halb
  // angewandte Änderung hinterlassen.
  const schedule = buildSchedulePayload(input)
  const employeeIds = normalizeEmployeeIds(input.employeeIds)

  await callSetJobAssignments(supabase, input.jobId, employeeIds)

  const payload = {
    customer_name: customerName,
    service_name: serviceName,
    location_address: locationAddress,
    scheduled_start: input.scheduledStart ?? null,
    notes: input.notes?.trim() ? input.notes.trim() : null,
    planned_duration_minutes: input.plannedDurationMinutes ?? null,
    ...schedule,
  }

  const { data, error } = await supabase
    .from("jobs")
    .update(payload)
    .eq("id", input.jobId)
    .select("id, parent_job_id")
    .single()

  let occurrenceError: { message: string } | null = null
  if (!error && input.jobType === "recurring" && data && !data.parent_job_id) {
    const { error: occErr } = await supabase.rpc("update_job_occurrences", {
      parent_job_id_input: input.jobId,
    })
    if (occErr) {
      occurrenceError = occErr
      console.error("[updateJob] update_job_occurrences fehlgeschlagen:", occErr.message)
    }
  }

  if (error || occurrenceError) {
    const reasons: string[] = []
    if (error) {
      reasons.push(
        "die übrigen Änderungen an diesem Auftrag (z. B. Kunde, Ort, Termin) wurden NICHT gespeichert",
      )
    }
    if (occurrenceError) {
      reasons.push(
        "die Termine des Dauerauftrags konnten nicht an die neue Zuweisung angeglichen werden",
      )
    }
    throw new PartialUpdateError(
      `Die Mitarbeiterzuweisung wurde gespeichert, aber ${reasons.join(" und ")}. ` +
        `Bitte prüfen Sie den aktuellen Stand und speichern Sie bei Bedarf erneut.`,
    )
  }
}

// Löscht einen Auftrag (wie Mobile). Regeln mit bereits gestarteten oder
// abgeschlossenen Terminen schützt der Backend-Trigger
// protect_recurring_job_history — dessen Meldung wird an die UI durchgereicht.
export async function deleteJob(supabase: DB, jobId: string): Promise<void> {
  await requireAdminProfile(supabase, "Nur Admins dürfen Jobs löschen.")

  const { error } = await supabase.from("jobs").delete().eq("id", jobId)
  if (error) throw error
}
