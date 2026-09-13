"use client"

// app/(admin)/timesheets/page.tsx
// Web-Pendant zu Mobiles features/timesheets/TimesheetScreen.tsx (Admin-Sicht
// — Web ist admin-only, die Mitarbeiter-Eigensicht aus Mobile entfällt hier).
// Mitarbeiter wählen, Monat navigieren, abgeschlossene Aufträge als
// Stundenzettel anzeigen, Summe, Abwesenheiten, Korrektur-Hinweise und
// PDF-Export — exakt dieselbe Ableitung wie Mobile (lib/timesheets/*).

import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertCircle, Calendar, ChevronLeft, ChevronRight, Clock, FileText, Printer, Users } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { PageHeader } from "@/components/ui/page-header"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { SectionCard } from "@/components/dashboard/SectionCard"
import { TimesheetAbsenceSection } from "@/components/timesheets/TimesheetAbsenceSection"
import { TimeCorrectionPanel, type TimeCorrectionTarget } from "@/components/jobs/TimeCorrectionPanel"
import { getEmployees, type EmployeeOption } from "@/lib/jobs/jobs.service"
import { getTimesheet, type TimesheetData, type TimesheetGap } from "@/lib/timesheets/timesheet.service"
import { exportTimesheetPdf } from "@/lib/timesheets/timesheetHtml"

const FALLBACK_COMPANY_NAME = "Cleaning Admin"

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0)
}

// "YYYY-MM-DD" → "Mo 03.06." ohne Zeitzonen-Drift — wie Mobiles formatDayShort.
function formatDayShort(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map((n) => parseInt(n, 10))
  if (!y || !m || !d) return isoDate
  const date = new Date(y, m - 1, d)
  const weekday = date.toLocaleDateString("de-DE", { weekday: "short" })
  return `${weekday} ${String(d).padStart(2, "0")}.${String(m).padStart(2, "0")}.`
}

export default function TimesheetsPage() {
  const [supabase] = useState(() => createClient())

  const [companyName, setCompanyName] = useState(FALLBACK_COMPANY_NAME)
  const [employees, setEmployees] = useState<EmployeeOption[]>([])
  const [employeesError, setEmployeesError] = useState<string | null>(null)
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("")

  const [monthDate, setMonthDate] = useState<Date>(() => startOfMonth(new Date()))
  const isCurrentMonth = useMemo(() => {
    const now = startOfMonth(new Date())
    return monthDate.getFullYear() === now.getFullYear() && monthDate.getMonth() === now.getMonth()
  }, [monthDate])
  const monthLabel = useMemo(
    () => monthDate.toLocaleDateString("de-DE", { month: "long", year: "numeric" }),
    [monthDate],
  )

  const [data, setData] = useState<TimesheetData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)

  // Zähler als Lade-Auslöser: nach einer Korrektur muss derselbe Monat für
  // denselben Mitarbeiter neu geladen werden, ohne dass sich Mitarbeiter/
  // Monat selbst ändern — wie Mobiles reloadToken.
  const [reloadToken, setReloadToken] = useState(0)

  const [correctionTarget, setCorrectionTarget] = useState<TimeCorrectionTarget | null>(null)

  // ── Firma + Mitarbeiterliste (einmalig) ──────────────────────────────
  useEffect(() => {
    let mounted = true
    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user || !mounted) return

      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", user.id)
        .single()
      if (!mounted || !profile?.company_id) return

      const { data: company } = await supabase
        .from("companies")
        .select("name")
        .eq("id", profile.company_id)
        .single()
      if (mounted && company?.name) setCompanyName(company.name)
    }
    void load()
    return () => {
      mounted = false
    }
  }, [supabase])

  useEffect(() => {
    let mounted = true
    getEmployees(supabase)
      .then((rows) => {
        if (!mounted) return
        setEmployees(rows)
        if (!selectedEmployeeId && rows.length > 0) setSelectedEmployeeId(rows[0].id)
      })
      .catch((err) => {
        console.error("Failed to fetch employees:", err)
        if (mounted) setEmployeesError("Mitarbeiter konnten nicht geladen werden.")
      })
    return () => {
      mounted = false
    }
    // selectedEmployeeId bewusst NICHT in den Deps: nur die Erstauswahl nach
    // dem Laden soll greifen, kein Reset bei jeder Auswahländerung.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase])

  const goToPrevMonth = useCallback(() => {
    setMonthDate((prev) => startOfMonth(new Date(prev.getFullYear(), prev.getMonth() - 1, 1)))
  }, [])
  const goToNextMonth = useCallback(() => {
    setMonthDate((prev) => {
      const next = startOfMonth(new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
      const current = startOfMonth(new Date())
      return next > current ? prev : next
    })
  }, [])

  // ── Stundenzettel laden, sobald Mitarbeiter + Monat feststehen ──────
  useEffect(() => {
    if (!selectedEmployeeId) {
      setData(null)
      setError(null)
      return
    }
    const employee = employees.find((e) => e.id === selectedEmployeeId)
    const employeeName = employee?.fullName ?? "Mitarbeiter"

    let cancelled = false
    setLoading(true)
    setError(null)

    getTimesheet(supabase, {
      companyName,
      employeeId: selectedEmployeeId,
      employeeName,
      year: monthDate.getFullYear(),
      month: monthDate.getMonth() + 1,
    })
      .then((result) => {
        if (!cancelled) setData(result)
      })
      .catch((err) => {
        console.error("Failed to fetch timesheet:", err)
        if (!cancelled) {
          setError("Stundenzettel konnte nicht geladen werden.")
          setData(null)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [supabase, selectedEmployeeId, monthDate, employees, companyName, reloadToken])

  const hasEntries = !!data && data.entries.length > 0
  const gaps: TimesheetGap[] = data?.needsAttention ?? []

  const openCorrection = (gap: TimesheetGap) => {
    setCorrectionTarget({
      assignmentId: gap.assignmentId,
      employeeName: gap.employeeName,
      customerName: gap.customerName,
      remark: gap.remark,
      employeeStartedAt: gap.employeeStartedAt,
      employeeCompletedAt: gap.employeeCompletedAt,
      sharedStartedAt: gap.sharedStartedAt,
      sharedCompletedAt: gap.sharedCompletedAt,
    })
  }

  const handleExportPdf = () => {
    if (!data || data.entries.length === 0) return
    setExportError(null)
    try {
      exportTimesheetPdf(data)
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "PDF-Export fehlgeschlagen.")
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Stundenzettel" description="Arbeitszeitnachweis je Mitarbeiter und Monat." />

      {/* ── Mitarbeiter + Monat ── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <SectionCard className="lg:col-span-2" icon={Users} title="Mitarbeiter">
          {employeesError ? (
            <p className="text-sm font-medium text-destructive">{employeesError}</p>
          ) : employees.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Lege zuerst Mitarbeiter an, um einen Nachweis zu erstellen.
            </p>
          ) : (
            <select
              aria-label="Mitarbeiter auswählen"
              value={selectedEmployeeId}
              onChange={(e) => setSelectedEmployeeId(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-transparent px-2.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary sm:max-w-xs"
            >
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.fullName}
                  {emp.isActive === false ? " (inaktiv)" : ""}
                </option>
              ))}
            </select>
          )}
        </SectionCard>

        <SectionCard icon={Calendar} title="Monat">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={goToPrevMonth}
              aria-label="Vorheriger Monat"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-foreground transition-colors hover:bg-secondary/80"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-semibold capitalize text-foreground">{monthLabel}</span>
            <button
              type="button"
              onClick={goToNextMonth}
              disabled={isCurrentMonth}
              aria-label="Nächster Monat"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-foreground transition-colors hover:bg-secondary/80 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </SectionCard>
      </div>

      {/* ── Zusammenfassung ── */}
      {data && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <SummaryCard icon={Clock} label="Gesamtstunden" value={`${data.totalLabel} h`} />
          <SummaryCard icon={FileText} label="Aufträge" value={String(data.jobCount)} />
          <SummaryCard
            icon={AlertCircle}
            label="Korrekturen nötig"
            value={String(gaps.length)}
            tone={gaps.length > 0 ? "warning" : undefined}
          />
          <SummaryCard
            icon={Calendar}
            label="Urlaub / Krank"
            value={`${data.absenceSummary.vacationCalendarDays} / ${data.absenceSummary.sicknessCalendarDays}`}
          />
        </div>
      )}

      {/* ── Zeitkorrekturen erforderlich — bewusst ÜBER der Vorschau: diese
          Zuweisungen erzeugen keinen Eintrag und fehlen daher in der Summe
          darunter. Wer erst die Summe sieht, hält sie für vollständig. ── */}
      {gaps.length > 0 && (
        <SectionCard
          icon={AlertCircle}
          title="Zeitkorrekturen erforderlich"
          subtitle="Diese Aufträge zählen noch nicht zur Arbeitszeit"
          noBodyPadding
        >
          <ul className="divide-y divide-gray-100">
            {gaps.map((gap) => (
              <li key={gap.assignmentId} className="flex items-center gap-3 px-4 py-3">
                <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {formatDayShort(gap.date)} · {gap.customerName}
                  </p>
                  <p className="text-xs font-medium text-destructive">{gap.reasonLabel}</p>
                  {gap.remark && <p className="truncate text-xs text-muted-foreground">{gap.remark}</p>}
                </div>
                <Button size="sm" variant="outline" onClick={() => openCorrection(gap)}>
                  Zeit korrigieren
                </Button>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      {correctionTarget && (
        <TimeCorrectionPanel
          supabase={supabase}
          target={correctionTarget}
          onClose={() => setCorrectionTarget(null)}
          onCorrected={() => setReloadToken((t) => t + 1)}
        />
      )}

      {/* ── Abwesenheiten ── */}
      {data && <TimesheetAbsenceSection summary={data.absenceSummary} notices={data.notices} />}

      {/* ── Vorschau ── */}
      <SectionCard icon={FileText} title="Vorschau" subtitle="Abgeschlossene Aufträge im Zeitraum" noBodyPadding>
        {!selectedEmployeeId ? (
          <EmptyState icon={Users} title="Mitarbeiter wählen" description="Bitte zuerst einen Mitarbeiter auswählen." />
        ) : loading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Lade Stundenzettel…</div>
        ) : error ? (
          <div className="p-4 text-sm font-medium text-destructive">{error}</div>
        ) : !hasEntries ? (
          <EmptyState icon={Calendar} title="Keine Einträge" description="Keine abgeschlossenen Jobs in diesem Zeitraum." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2.5">Tag</th>
                  <th className="px-4 py-2.5 text-center">Beginn</th>
                  <th className="px-4 py-2.5 text-center">Ende</th>
                  <th className="px-4 py-2.5 text-right">Dauer</th>
                  <th className="px-4 py-2.5">Auftrag</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data!.entries.map((entry) => (
                  <tr key={entry.jobId}>
                    <td className="whitespace-nowrap px-4 py-2.5 text-foreground">{formatDayShort(entry.date)}</td>
                    <td className="px-4 py-2.5 text-center text-foreground">{entry.beginLabel}</td>
                    <td className="px-4 py-2.5 text-center text-foreground">{entry.endLabel}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-foreground">{entry.durationLabel}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      <span className="text-foreground">{entry.customerName}</span>
                      {entry.remark ? ` · ${entry.remark}` : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-gray-100 bg-gray-50/60 font-semibold text-foreground">
                  <td colSpan={3} className="px-4 py-3 text-right">
                    Summe · {data!.jobCount} Job{data!.jobCount === 1 ? "" : "s"}
                  </td>
                  <td className="px-4 py-3 text-right">{data!.totalLabel} h</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </SectionCard>

      {exportError && <p className="text-sm font-medium text-destructive">{exportError}</p>}

      <Button onClick={handleExportPdf} disabled={!hasEntries || loading}>
        <Printer className="mr-2 h-4 w-4" />
        PDF exportieren
      </Button>
    </div>
  )
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Clock
  label: string
  value: string
  tone?: "warning"
}) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-card p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_1px_3px_rgba(16,24,40,0.06)]">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className={tone === "warning" ? "h-4 w-4 text-destructive" : "h-4 w-4"} />
        <span className="text-[11px] font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <p className={cnValue(tone)}>{value}</p>
    </div>
  )
}

function cnValue(tone?: "warning"): string {
  return tone === "warning"
    ? "mt-1.5 text-2xl font-bold text-destructive"
    : "mt-1.5 text-2xl font-bold text-foreground"
}
