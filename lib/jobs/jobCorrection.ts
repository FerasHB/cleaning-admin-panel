// lib/jobs/jobCorrection.ts
// Ist ein Auftrag überhaupt für eine Admin-Zeitkorrektur zugänglich?
// 1:1-Port von Mobiles utils/jobCorrection.ts — dieselbe Konstante, dieselben
// Prädikate, damit Web und Mobile bei der Frage "darf korrigiert werden?"
// nicht auseinanderlaufen. Maßgeblich bleibt in jedem Fall die RPC
// admin_correct_assignment_time (Migration 20260814000000); hier geht es nur
// darum, dem Admin gar nicht erst eine Aktion anzubieten, die serverseitig
// zwingend abgelehnt würde.

import type { Database } from "@/lib/supabase/database.types"

type JobRow = Database["public"]["Tables"]["jobs"]["Row"]

/**
 * Zeitpunkt, ab dem start_own_job/complete_own_job die individuellen
 * Zeitstempel (job_assignments.employee_started_at/employee_completed_at)
 * überhaupt schreiben — entspricht Migration 20260812000000 ("Phase 1
 * Worked Time"). Aufträge, die davor abgeschlossen wurden, kennen keine
 * individuelle Zeit; der Stundenzettel rechnet dort mit der geteilten
 * Job-Uhr.
 */
export const PHASE1_CUTOFF_ISO = "2026-08-12T00:00:00.000Z"

/**
 * true, wenn dieser Auftrag VOR Phase 1 abgeschlossen wurde — dann gilt der
 * Legacy-Fallback auf die geteilte Job-Uhr.
 */
export function isLegacyJob(jobCompletedAtIso: string): boolean {
  return new Date(jobCompletedAtIso).getTime() < Date.parse(PHASE1_CUTOFF_ISO)
}

/**
 * Darf für diesen AUFTRAG eine Zeitkorrektur angeboten werden?
 *
 * Drei Bedingungen, alle deckungsgleich mit der RPC:
 *  1. abgeschlossen — an offenen/laufenden Aufträgen ist eine fehlende
 *     Eigenzeit KEIN Fehler, sondern der Normalzustand.
 *  2. vollständige geteilte Uhr — ohne sie lehnt die RPC ohnehin ab.
 *  3. nach dem Phase-1-Grenzwert — für Alt-Aufträge gilt der
 *     Legacy-Fallback, eine fehlende Eigenzeit ist dort weder Mangel noch
 *     korrigierbar.
 *
 * BEWUSST NICHT geprüft: job_type='single'. Recurring-Parent-Regeln zeigen
 * in der Web-Detailseite ohnehin keine Zuweisungsliste mit Zeitstatus
 * (siehe AssigneeList); die RPC lehnt sie zusätzlich zuverlässig ab.
 */
export function isCorrectableJob(
  job: Pick<JobRow, "status" | "started_at" | "completed_at">,
): boolean {
  if (job.status !== "completed") return false
  if (!job.started_at || !job.completed_at) return false
  return !isLegacyJob(job.completed_at)
}
