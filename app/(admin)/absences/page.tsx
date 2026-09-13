"use client"

import { Suspense, useCallback, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { PageHeader } from "@/components/ui/page-header"
import { Button } from "@/components/ui/button"
import { SectionCard } from "@/components/dashboard/SectionCard"
import { EmptyState } from "@/components/ui/empty-state"
import { CalendarOff, Plus, Stethoscope, Users } from "lucide-react"
import { AdminAbsenceRow } from "@/components/absences/AdminAbsenceRow"
import { CreateAbsenceForm } from "@/components/absences/CreateAbsenceForm"
import { useVacationReview } from "@/hooks/use-vacation-review"
import { formatDateISO } from "@/lib/date"
import {
  getAbsenceEvidenceMap,
  getCurrentCompanyAbsences,
  getPendingVacationRequests,
  getSicknessReports,
  type Absence,
  type AbsenceEvidence,
} from "@/lib/absences/absences"

type Tab = "active" | "vacation" | "sickness"

const TABS: { key: Tab; label: string; icon: typeof Users }[] = [
  { key: "active", label: "Abwesend", icon: Users },
  { key: "vacation", label: "Urlaubsanträge", icon: CalendarOff },
  { key: "sickness", label: "Krankmeldungen", icon: Stethoscope },
]

// Web-Pendant zu Mobiles AdminAbsencesScreen — drei Tabs (Kategorie, nicht
// Datums-Bucket, wie dort): Abwesend (heute aktiv), Urlaubsanträge
// (requested, FIFO), Krankmeldungen (read-only, keine Genehmigung nötig).
const TAB_PARAM: Record<string, Tab> = { active: "active", vacation: "vacation", sickness: "sickness" }

function AbsencesPageContent() {
  const [supabase] = useState(() => createClient())
  const searchParams = useSearchParams()
  const initialTab = TAB_PARAM[searchParams.get("tab") ?? ""] ?? "active"
  const [tab, setTab] = useState<Tab>(initialTab)
  const [active, setActive] = useState<Absence[]>([])
  const [pendingVacations, setPendingVacations] = useState<Absence[]>([])
  const [sicknessReports, setSicknessReports] = useState<Absence[]>([])
  const [evidence, setEvidence] = useState<Map<string, AbsenceEvidence>>(new Map())
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  const load = useCallback(async () => {
    setLoadError(null)
    try {
      const todayKey = formatDateISO(new Date()) ?? ""
      const [activeData, pendingData, sicknessData] = await Promise.all([
        getCurrentCompanyAbsences(supabase, todayKey),
        getPendingVacationRequests(supabase),
        getSicknessReports(supabase),
      ])
      setActive(activeData)
      setPendingVacations(pendingData)
      setSicknessReports(sicknessData)
      setEvidence(await getAbsenceEvidenceMap(supabase, sicknessData.map((a) => a.id)))
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Abwesenheiten konnten nicht geladen werden.")
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    void load()
  }, [load])

  const review = useVacationReview(supabase, (updated) => {
    setPendingVacations((prev) => prev.filter((a) => a.id !== updated.id))
  })

  const list = tab === "active" ? active : tab === "vacation" ? pendingVacations : sicknessReports

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader
          title="Abwesenheiten"
          description="Urlaub und Krankmeldungen im Unternehmen."
        />
        <Button onClick={() => setShowCreate((v) => !v)}>
          <Plus className="mr-2 h-4 w-4" />
          Abwesenheit erfassen
        </Button>
      </div>

      {showCreate && (
        <CreateAbsenceForm
          supabase={supabase}
          onCreated={() => {
            setShowCreate(false)
            void load()
          }}
          onCancel={() => setShowCreate(false)}
        />
      )}

      <div className="flex gap-2 border-b border-gray-100">
        {TABS.map((t) => {
          const count = t.key === "vacation" ? pendingVacations.length : null
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                tab === t.key
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
              {count !== null && count > 0 && (
                <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[11px] font-semibold text-primary">
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <SectionCard title={TABS.find((t) => t.key === tab)?.label ?? ""} noBodyPadding>
        {loading ? (
          <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">Laden…</div>
        ) : loadError ? (
          <div className="p-5">
            <p className="text-sm font-medium text-destructive">{loadError}</p>
            <Button size="sm" variant="outline" className="mt-2" onClick={() => void load()}>
              Erneut versuchen
            </Button>
          </div>
        ) : list.length === 0 ? (
          <EmptyState
            icon={CalendarOff}
            title="Keine Einträge"
            description={
              tab === "active"
                ? "Aktuell ist niemand im Urlaub oder krankgemeldet."
                : tab === "vacation"
                  ? "Keine offenen Urlaubsanträge."
                  : "Keine Krankmeldungen."
            }
          />
        ) : (
          <ul className="divide-y divide-gray-100">
            {list.map((absence) => (
              <AdminAbsenceRow
                key={absence.id}
                absence={absence}
                evidence={evidence.get(absence.id)}
                review={review}
              />
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  )
}

export default function AbsencesPage() {
  return (
    <Suspense>
      <AbsencesPageContent />
    </Suspense>
  )
}
