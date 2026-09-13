// lib/jobs/statusMeta.ts
// Einzige Quelle für Status-Label/Farbe (Badge-Variant, Punktfarbe, Pill-Ton).
// Vorher lokal in app/(admin)/jobs/page.tsx dupliziert — hier zentralisiert,
// damit Jobs-Liste und Kalender nie auseinanderlaufen (wie Mobiles
// getJobStatusMeta/utils/jobStatus.ts als einzige Quelle).

import type { Database } from "@/lib/supabase/database.types"

export type JobStatus = Database["public"]["Enums"]["job_status"]

export const STATUS_ORDER: JobStatus[] = ["open", "in_progress", "completed"]

export const STATUS_LABEL: Record<JobStatus, string> = {
  open: "Offen",
  in_progress: "In Arbeit",
  completed: "Erledigt",
}

export const STATUS_VARIANT: Record<JobStatus, "warning" | "info" | "success"> = {
  open: "warning",
  in_progress: "info",
  completed: "success",
}

export const STATUS_DOT: Record<JobStatus, string> = {
  open: "bg-amber-400",
  in_progress: "bg-blue-500",
  completed: "bg-emerald-500",
}

// Aktive Pill-Töne je Filter (inaktiv = ruhiges gray-100).
export const STATUS_PILL_ACTIVE: Record<"all" | JobStatus, string> = {
  all: "bg-primary/10 text-primary ring-1 ring-inset ring-primary/15",
  open: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200",
  in_progress: "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200",
  completed: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200",
}
