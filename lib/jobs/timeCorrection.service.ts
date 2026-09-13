// lib/jobs/timeCorrection.service.ts
// Admin-Zeitkorrektur: dünner Client-Wrapper um die RPC
// admin_correct_assignment_time (Migration 20260814000000). 1:1-Port von
// Mobiles services/timesheets/timeCorrection.service.ts — gleiche Validierung,
// gleiche Fehlermeldungen (Deutsch), gleiche RPC-Argumente.
//
// EINZIGER SCHREIBPFAD. Es gibt bewusst KEIN direktes UPDATE auf
// job_assignments: authenticated hat dort ausschließlich SELECT. Die RPC ist
// SECURITY DEFINER und prüft Rolle, Firma und alle fachlichen
// Vorbedingungen selbst — dieser Wrapper ist reine Bequemlichkeit für die
// UI, keine zweite Sicherheitsebene.
//
// GETEILTE JOB-UHR: jobs.started_at/completed_at werden hier NIRGENDS
// angefasst. Die Korrektur betrifft ausschließlich die eigene
// Zuweisungszeile des Mitarbeiters.

import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/database.types"

type DB = SupabaseClient<Database>

export type CorrectAssignmentTimeInput = {
  /** PK der job_assignments-Zeile. */
  assignmentId: string
  /** Neuer Beginn (ISO). Pflicht. */
  newStartedAt: string
  /** Neues Ende (ISO). Pflicht. */
  newCompletedAt: string
  /** Begründung. Pflicht, darf nicht leer sein. */
  reason: string
}

// Fachliche Ablehnungen der RPC kommen mit SQLSTATE 22023 bzw. 23514 und
// englischem Text — Originaltexte richten sich an Entwickler. Deshalb hier
// eine gezielte Übersetzung: der Admin soll erfahren, WARUM eine Korrektur
// nicht möglich ist, statt eine technische Meldung zu sehen. Identisch zu
// Mobiles RPC_MESSAGE_MAP.
const RPC_MESSAGE_MAP: { match: string; message: string }[] = [
  {
    match: "Only admins can correct",
    message: "Nur Admins dürfen Arbeitszeiten korrigieren.",
  },
  {
    match: "Assignment not found or not accessible",
    message:
      "Diese Zuweisung wurde nicht gefunden oder gehört nicht zu deiner Firma.",
  },
  {
    match: "Only single jobs can be corrected",
    message:
      "Daueraufträge (Regeln) können nicht korrigiert werden — nur einzelne Termine erscheinen im Stundenzettel.",
  },
  {
    match: "Cannot correct an anonymised assignment",
    message:
      "Diese Zuweisung gehört zu einem gelöschten Mitarbeiterkonto und kann nicht mehr korrigiert werden.",
  },
  {
    match: "Only completed jobs can be corrected",
    message:
      "Nur abgeschlossene Aufträge können korrigiert werden. Dieser Auftrag ist noch nicht abgeschlossen.",
  },
  {
    match: "cannot be corrected",
    message:
      "Dieser Auftrag wurde vor der Umstellung auf individuelle Arbeitszeiten abgeschlossen und kann nicht korrigiert werden.",
  },
  {
    match: "Both new_started_at and new_completed_at are required",
    message: "Bitte Beginn UND Ende angeben.",
  },
  {
    match: "new_completed_at must be after new_started_at",
    message: "Das Ende muss nach dem Beginn liegen.",
  },
  {
    match: "A reason is required",
    message: "Bitte einen Grund für die Korrektur angeben.",
  },
]

function translateRpcError(err: unknown): string {
  const raw =
    typeof err === "object" && err !== null && "message" in err
      ? String((err as { message?: unknown }).message ?? "")
      : ""

  const hit = RPC_MESSAGE_MAP.find((entry) => raw.includes(entry.match))
  if (hit) return hit.message

  return "Die Zeitkorrektur konnte nicht gespeichert werden."
}

/**
 * Prüft die Eingabe clientseitig, BEVOR die RPC gerufen wird.
 *
 * Bewusst dieselben Regeln wie serverseitig (die RPC bleibt die maßgebliche
 * Instanz) — hier geht es nur darum, dem Admin sofortiges Feedback im
 * Formular zu geben, statt ihn in einen Serverfehler laufen zu lassen.
 *
 * ZUSÄTZLICH clientseitig: keine Zeitstempel in der Zukunft — dieselbe
 * bewusst offene Produktentscheidung wie in Mobile (RPC lässt es derzeit
 * zu; das Formular fängt einen Vertipper wenigstens ab).
 *
 * @returns Fehlermeldung oder null, wenn die Eingabe gültig ist.
 */
export function validateCorrection(input: {
  newStartedAt: Date | null
  newCompletedAt: Date | null
  reason: string
  now?: Date
}): string | null {
  const { newStartedAt, newCompletedAt, reason } = input
  const now = input.now ?? new Date()

  if (!newStartedAt || !newCompletedAt) {
    return "Bitte Beginn UND Ende angeben."
  }
  if (newCompletedAt.getTime() <= newStartedAt.getTime()) {
    return "Das Ende muss nach dem Beginn liegen."
  }
  if (
    newStartedAt.getTime() > now.getTime() ||
    newCompletedAt.getTime() > now.getTime()
  ) {
    return "Zeiten dürfen nicht in der Zukunft liegen."
  }
  if (!reason.trim()) {
    return "Bitte einen Grund für die Korrektur angeben."
  }
  return null
}

/**
 * Speichert eine Zeitkorrektur über die RPC.
 *
 * Wirft mit einer bereits nutzerlesbaren, deutschen Meldung — Aufrufer
 * können sie direkt anzeigen und brauchen kein eigenes Error-Mapping.
 */
export async function correctAssignmentTime(
  supabase: DB,
  input: CorrectAssignmentTimeInput,
): Promise<void> {
  const reason = input.reason.trim()

  // Letzte Absicherung: niemals eine Teilkorrektur senden. Die RPC lehnt sie
  // ohnehin ab (sie würde den jeweils anderen Wert auf NULL setzen und damit
  // die Stundenzettel-Zeile löschen), aber ein solcher Aufruf soll gar nicht
  // erst gesendet werden.
  if (!input.newStartedAt || !input.newCompletedAt) {
    throw new Error("Bitte Beginn UND Ende angeben.")
  }
  if (!reason) {
    throw new Error("Bitte einen Grund für die Korrektur angeben.")
  }

  const { error } = await supabase.rpc("admin_correct_assignment_time", {
    assignment_id_input: input.assignmentId,
    new_started_at: input.newStartedAt,
    new_completed_at: input.newCompletedAt,
    reason_input: reason,
  })

  if (error) {
    throw new Error(translateRpcError(error))
  }
}
