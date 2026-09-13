// lib/activity/activity.ts
// Firmenweiter Aktivitäts-Feed fürs Dashboard. Mischt echte Events aus
// job_comments (kommentiert), jobs.started_at (gestartet), jobs.completed_at
// (abgeschlossen) und jobs.created_at (erstellt), sortiert nach Zeit absteigend
// und liefert die neuesten Einträge. RLS-scoped: Admin sieht firmenweit.
// Read-only, keine Fake-Daten.

import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/database.types"

type DB = SupabaseClient<Database>

export type ActivityType = "comment" | "started" | "completed" | "created"

export type ActivityItem = {
  id: string
  type: ActivityType
  actorName: string | null
  customerName: string | null
  jobId: string
  at: string
}

function firstName(
  rel:
    | { full_name: string | null }
    | { full_name: string | null }[]
    | null
    | undefined,
): string | null {
  if (!rel) return null
  return Array.isArray(rel) ? rel[0]?.full_name ?? null : rel.full_name ?? null
}

type CommentRow = {
  id: string
  job_id: string
  created_at: string
  profiles?: { full_name: string | null } | { full_name: string | null }[] | null
  jobs?: { customer_name: string | null } | { customer_name: string | null }[] | null
}

type ActorRel = { full_name: string | null } | { full_name: string | null }[] | null

type StartedRow = { id: string; customer_name: string | null; started_at: string; starter?: ActorRel }
type CompletedRow = { id: string; customer_name: string | null; completed_at: string; completer?: ActorRel }
type CreatedRow = { id: string; customer_name: string | null; created_at: string; creator?: ActorRel }

function jobCustomer(
  rel:
    | { customer_name: string | null }
    | { customer_name: string | null }[]
    | null
    | undefined,
): string | null {
  if (!rel) return null
  return Array.isArray(rel)
    ? rel[0]?.customer_name ?? null
    : rel.customer_name ?? null
}

// Holt die neuesten Aktivitäten (Standard: 5). Zieht jeweils etwas mehr Rohdaten
// pro Quelle, mischt und schneidet dann auf das Limit zu.
export async function getRecentActivity(
  supabase: DB,
  limit = 5,
): Promise<ActivityItem[]> {
  const fetchN = Math.max(limit * 2, 10)

  // Je Ereignisart eine eigene, nach ihrem Zeitstempel sortierte Abfrage:
  //  - gestartet/abgeschlossen: Akteur ist started_by/completed_by (wer den
  //    Übergang tatsächlich ausgelöst hat) — nicht der Legacy-Zeiger
  //    assigned_to, der bei Mehrfachzuweisung eine andere Person sein kann.
  //  - erstellt: nur vom Admin angelegte Aufträge/Regeln (parent_job_id IS
  //    NULL). Generierte Dauerauftrags-Termine entstehen gebündelt und würden
  //    den Feed sonst verdrängen.
  const [commentsRes, startedRes, completedRes, createdRes] = await Promise.all([
    supabase
      .from("job_comments")
      .select(
        "id, job_id, created_at, profiles:author_id(full_name), jobs(customer_name)",
      )
      .order("created_at", { ascending: false })
      .limit(fetchN),
    supabase
      .from("jobs")
      .select("id, customer_name, started_at, starter:profiles!jobs_started_by_fkey(full_name)")
      .not("started_at", "is", null)
      .order("started_at", { ascending: false })
      .limit(fetchN),
    supabase
      .from("jobs")
      .select("id, customer_name, completed_at, completer:profiles!jobs_completed_by_fkey(full_name)")
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: false })
      .limit(fetchN),
    supabase
      .from("jobs")
      .select("id, customer_name, created_at, creator:profiles!jobs_created_by_fkey(full_name)")
      .is("parent_job_id", null)
      .order("created_at", { ascending: false })
      .limit(fetchN),
  ])

  if (commentsRes.error) throw commentsRes.error
  if (startedRes.error) throw startedRes.error
  if (completedRes.error) throw completedRes.error
  if (createdRes.error) throw createdRes.error

  const items: ActivityItem[] = []

  for (const c of (commentsRes.data ?? []) as unknown as CommentRow[]) {
    items.push({
      id: `comment-${c.id}`,
      type: "comment",
      actorName: firstName(c.profiles),
      customerName: jobCustomer(c.jobs),
      jobId: c.job_id,
      at: c.created_at,
    })
  }

  for (const j of (completedRes.data ?? []) as unknown as CompletedRow[]) {
    items.push({
      id: `completed-${j.id}`,
      type: "completed",
      actorName: firstName(j.completer),
      customerName: j.customer_name,
      jobId: j.id,
      at: j.completed_at,
    })
  }

  for (const j of (startedRes.data ?? []) as unknown as StartedRow[]) {
    items.push({
      id: `started-${j.id}`,
      type: "started",
      actorName: firstName(j.starter),
      customerName: j.customer_name,
      jobId: j.id,
      at: j.started_at,
    })
  }

  for (const j of (createdRes.data ?? []) as unknown as CreatedRow[]) {
    items.push({
      id: `created-${j.id}`,
      type: "created",
      actorName: firstName(j.creator),
      customerName: j.customer_name,
      jobId: j.id,
      at: j.created_at,
    })
  }

  return items
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, limit)
}
