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

type JobRow = {
  id: string
  customer_name: string | null
  created_at: string
  started_at: string | null
  completed_at: string | null
  assignee?: { full_name: string | null } | { full_name: string | null }[] | null
  creator?: { full_name: string | null } | { full_name: string | null }[] | null
}

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

  const [commentsRes, jobsRes] = await Promise.all([
    supabase
      .from("job_comments")
      .select(
        "id, job_id, created_at, profiles:author_id(full_name), jobs(customer_name)",
      )
      .order("created_at", { ascending: false })
      .limit(fetchN),
    supabase
      .from("jobs")
      .select(
        "id, customer_name, created_at, started_at, completed_at, assignee:profiles!jobs_assigned_to_fkey(full_name), creator:profiles!jobs_created_by_fkey(full_name)",
      )
      .order("created_at", { ascending: false })
      .limit(fetchN),
  ])

  if (commentsRes.error) throw commentsRes.error
  if (jobsRes.error) throw jobsRes.error

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

  for (const j of (jobsRes.data ?? []) as unknown as JobRow[]) {
    if (j.completed_at) {
      items.push({
        id: `completed-${j.id}`,
        type: "completed",
        actorName: firstName(j.assignee),
        customerName: j.customer_name,
        jobId: j.id,
        at: j.completed_at,
      })
    }
    if (j.started_at) {
      items.push({
        id: `started-${j.id}`,
        type: "started",
        actorName: firstName(j.assignee),
        customerName: j.customer_name,
        jobId: j.id,
        at: j.started_at,
      })
    }
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
