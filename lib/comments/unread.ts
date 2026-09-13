// lib/comments/unread.ts
// Ungelesene Kommentare — Port von Mobiles services/comments/comments.service.ts
// (getUnreadCommentJobIds, markJobCommentsAsRead). Web ist admin-only, daher
// entfällt die Mitarbeiter-Zweig-Prüfung aus Mobiles canMarkCommentsRead
// (isAssignedTo/isPrimaryAssignee) — ein Web-Admin darf laut RLS/RPC ohnehin
// immer lesen und als gelesen markieren.
//
// Kein neuer Lese-Zustand wird erfunden: beide Operationen sind exakt die
// RPC bzw. der Tabellen-Upsert, die Mobile bereits verwendet.

import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/database.types"

type DB = SupabaseClient<Database>

// get_unread_comment_job_ids(): setof uuid — Jobs mit Kommentaren, die neuer
// sind als der eigene last_seen_at-Eintrag (oder gar keiner existiert).
// Eigene Kommentare zählen serverseitig nie als ungelesen.
export async function getUnreadCommentJobIds(supabase: DB): Promise<Set<string>> {
  const { data, error } = await supabase.rpc("get_unread_comment_job_ids")
  if (error) throw error
  return new Set((data ?? []) as string[])
}

// Markiert einen Job als gelesen (eigener Cursor). Direkter Tabellen-Upsert
// wie Mobile — keine RPC dafür, RLS schützt bereits ausreichend
// ("insert/update own comment-read state").
export async function markJobCommentsAsRead(supabase: DB, jobId: string): Promise<void> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError) throw authError
  if (!user) throw new Error("Kein eingeloggter Benutzer gefunden.")

  const { error } = await supabase
    .from("job_comment_reads")
    .upsert(
      { job_id: jobId, user_id: user.id, last_seen_at: new Date().toISOString() },
      { onConflict: "job_id,user_id" },
    )
  if (error) throw error
}
