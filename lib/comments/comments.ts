// lib/comments/comments.ts
// Supabase-Operationen für Job-Kommentare (append-only, online-only) — portiert
// aus Mobiles services/comments/comments.service.ts. Mappt DB-Rows (snake_case)
// auf das App-Format (camelCase). Schreibrechte werden zusätzlich per RLS
// geprüft (admin read/insert comments in own company).

import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/database.types"

type DB = SupabaseClient<Database>

export type JobComment = {
  id: string
  jobId: string
  authorId: string | null
  authorName: string | null
  message: string
  createdAt: string
}

// So sieht ein Kommentar (mit Autor-Join) aus der DB aus.
type JobCommentRow = {
  id: string
  job_id: string
  author_id: string | null
  message: string
  created_at: string
  profiles?:
    | { id: string; full_name: string | null }
    | { id: string; full_name: string | null }[]
    | null
}

const COMMENT_SELECT = `
  id,
  job_id,
  author_id,
  message,
  created_at,
  profiles:author_id (
    id,
    full_name
  )
`

function mapComment(row: JobCommentRow): JobComment {
  return {
    id: row.id,
    jobId: row.job_id,
    authorId: row.author_id,
    authorName: Array.isArray(row.profiles)
      ? row.profiles[0]?.full_name ?? null
      : row.profiles?.full_name ?? null,
    message: row.message,
    createdAt: row.created_at,
  }
}

// Holt alle Kommentare zu einem Job (älteste zuerst, chronologisch).
export async function getJobComments(
  supabase: DB,
  jobId: string,
): Promise<JobComment[]> {
  const { data, error } = await supabase
    .from("job_comments")
    .select(COMMENT_SELECT)
    .eq("job_id", jobId)
    .order("created_at", { ascending: true })

  if (error) {
    throw error
  }

  return (data ?? []).map((item) =>
    mapComment(item as unknown as JobCommentRow),
  )
}

// Legt einen neuen Kommentar an und gibt ihn im App-Format zurück.
export async function addJobComment(
  supabase: DB,
  input: { jobId: string; message: string },
): Promise<JobComment> {
  const message = input.message.trim()
  if (!message) {
    throw new Error("Bitte eine Nachricht eingeben.")
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError) {
    throw authError
  }
  if (!user) {
    throw new Error("Kein eingeloggter Benutzer gefunden.")
  }

  // company_id aus dem Profil laden — wird für RLS (company-Scope) benötigt.
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("id", user.id)
    .single()

  if (profileError) {
    throw new Error("Profil konnte nicht geladen werden.")
  }
  if (!profile?.company_id) {
    throw new Error("Kein company_id im Profil gefunden.")
  }

  const { data, error } = await supabase
    .from("job_comments")
    .insert({
      company_id: profile.company_id,
      job_id: input.jobId,
      author_id: user.id,
      message,
    })
    .select(COMMENT_SELECT)
    .single()

  if (error) {
    throw error
  }

  return mapComment(data as unknown as JobCommentRow)
}

// ── Firmenweiter Kommentar-Feed (für die Nachrichten-Seite) ──

export type RecentComment = {
  id: string
  jobId: string
  message: string
  createdAt: string
  authorName: string | null
  customerName: string | null
}

type RecentCommentRow = {
  id: string
  job_id: string
  message: string
  created_at: string
  jobs?:
    | { customer_name: string | null }
    | { customer_name: string | null }[]
    | null
  profiles?:
    | { full_name: string | null }
    | { full_name: string | null }[]
    | null
}

function mapRecent(row: RecentCommentRow): RecentComment {
  const job = Array.isArray(row.jobs) ? row.jobs[0] : row.jobs
  const author = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
  return {
    id: row.id,
    jobId: row.job_id,
    message: row.message,
    createdAt: row.created_at,
    authorName: author?.full_name ?? null,
    customerName: job?.customer_name ?? null,
  }
}

// Liefert die neuesten Kommentare der eigenen Firma (RLS-scoped: Admin sieht
// firmenweit). Join auf Job (Kundenname) + Autor (Name).
export async function getRecentCompanyComments(
  supabase: DB,
  limit = 20,
): Promise<RecentComment[]> {
  const { data, error } = await supabase
    .from("job_comments")
    .select(
      "id, job_id, message, created_at, jobs(customer_name), profiles:author_id(full_name)",
    )
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) {
    throw error
  }

  return (data ?? []).map((item) =>
    mapRecent(item as unknown as RecentCommentRow),
  )
}
