// lib/timesheets/resolveEffectiveAbsenceDays.ts
// Port von Mobiles utils/resolveEffectiveAbsenceDays.ts — reine Ableitung
// "welche Abwesenheitsart gilt an diesem Kalendertag?", ohne Supabase-
// Abhängigkeit. Nutzt Webs bestehende isActiveAbsence (lib/absences/absences.ts,
// exakt Mobiles isOperationallyActiveAbsence) als Standard-Prädikat — die
// Aktiv-Regel wird hier NICHT erneut definiert.
//
// ZEITZONEN-SEMANTIK: ausschließlich "YYYY-MM-DD"-String-Vergleiche/-Iteration.
// KEIN `new Date("YYYY-MM-DD")` (verschiebt in manchen Zeitzonen auf den
// Vor-/Folgetag) — Datumskomponenten werden einzeln geparst und über
// `new Date(y, m-1, d)` (lokal, sicher) konstruiert.
//
// PRIORITÄT BEI ÜBERSCHNEIDUNG: Krank > Urlaub. Ein Kalendertag hat NIE zwei
// wirksame Abwesenheitsarten. Beide zugrunde liegenden employee_absences-
// Zeilen bleiben dabei unverändert in der DB — diese Funktion verändert
// nichts, sie ordnet nur zu.
//
// WICHTIG — KEINE RECHTLICHE AUSSAGE: "wirksam" bedeutet hier ausschließlich
// "für die Stundenzettel-Anzeige berücksichtigt". Eine gemeldete Krankheit
// (status=reported) ist kein medizinischer Nachweis (Arbeitsunfähigkeit) und
// stellt keinen Urlaubsanspruch wieder her.

import { isActiveAbsence, type Absence, type AbsenceType } from "@/lib/absences/absences"
import { formatDateISO } from "@/lib/date"

export type AbsenceEligibilityPredicate = (absence: Absence) => boolean

/**
 * Ein Kalendertag, an dem für einen Mitarbeiter genau EINE Abwesenheitsart
 * "wirksam" ist. `absences` sollte bereits auf diesen Mitarbeiter eingegrenzt
 * sein (Aufrufer-Verantwortung) — diese Funktion filtert nur nach `isActive`
 * und Zeitraum, nicht nach employee_id.
 */
export type EffectiveAbsenceDay = {
  /** "YYYY-MM-DD", lokal */
  date: string
  type: "vacation" | "sickness"
  /** IDs der employee_absences-Zeilen, aus denen dieser Tag resultiert. */
  sourceAbsenceIds: string[]
}

// Ordnet, welcher Typ bei Überschneidung gewinnt. Krank zuerst = höhere Prio.
const TYPE_PRIORITY: AbsenceType[] = ["sickness", "vacation"]

// "YYYY-MM-DD" → Folgetag als "YYYY-MM-DD", lokal berechnet (kein UTC-Drift).
function nextDateKey(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map((n) => parseInt(n, 10))
  const next = new Date(year, month - 1, day + 1)
  return formatDateISO(next)!
}

// Deckt eine Abwesenheit den gegebenen Kalendertag ab? Offene Krankheit
// (endDate = null) deckt ab startDate jeden Folgetag ab.
function covers(absence: Absence, dateKey: string): boolean {
  if (dateKey < absence.startDate) return false
  if (absence.endDate !== null && dateKey > absence.endDate) return false
  return true
}

/**
 * Leitet für jeden Kalendertag in [from, to] (inklusive, lokal) die wirksame
 * Abwesenheitsart eines EINZELNEN Mitarbeiters ab. Tage ohne wirksame
 * Abwesenheit fehlen im Ergebnis. Iteration ist strikt auf [from, to]
 * begrenzt — eine Abwesenheit, die vor `from` beginnt oder nach `to` endet,
 * trägt nur innerhalb dieses Fensters bei.
 */
export function resolveEffectiveAbsenceDays(
  absences: Absence[],
  from: string,
  to: string,
  isActive: AbsenceEligibilityPredicate = isActiveAbsence,
): EffectiveAbsenceDay[] {
  if (from > to) return []

  const active = absences.filter(isActive)
  if (active.length === 0) return []

  const result: EffectiveAbsenceDay[] = []

  for (let dateKey = from; dateKey <= to; dateKey = nextDateKey(dateKey)) {
    const covering = active.filter((absence) => covers(absence, dateKey))
    if (covering.length === 0) continue

    const winningType = TYPE_PRIORITY.find((type) =>
      covering.some((absence) => absence.type === type),
    )!

    const sourceAbsenceIds = covering
      .filter((absence) => absence.type === winningType)
      .map((absence) => absence.id)

    result.push({ date: dateKey, type: winningType, sourceAbsenceIds })
  }

  return result
}
