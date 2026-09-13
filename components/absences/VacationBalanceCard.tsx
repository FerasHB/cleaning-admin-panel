"use client"

import { useCallback, useEffect, useState } from "react"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/database.types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field, Notice } from "@/components/auth/AuthShell"
import {
  addVacationAdjustment,
  buildVacationBalance,
  formatLedgerAmount,
  getVacationLedger,
  getVacationYearId,
  initializeVacationYear,
  LEDGER_ENTRY_LABELS,
  resolveEffectiveVacationConfig,
  type VacationBalance,
  type VacationConfig,
  type VacationLedgerEntry,
} from "@/lib/vacation/vacationLedger"

type DB = SupabaseClient<Database>

function formatDateTimeDE(iso: string): string {
  return new Date(iso).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) + " Uhr"
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex items-center justify-between py-1.5 text-sm ${strong ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  )
}

// Web-Pendant zu Mobiles AdminVacationAccountScreen — drei Zustände
// (disabled/not_initialized/ready), keine erfundene Nullwert-Anzeige. Der
// Saldo ist IMMER eine live SUM über vacation_ledger, nie eine gespeicherte
// Zahl (siehe lib/vacation/vacationLedger.ts::buildVacationBalance).
export function VacationBalanceCard({ supabase, employeeId }: { supabase: DB; employeeId: string }) {
  const year = new Date().getFullYear()
  const [config, setConfig] = useState<VacationConfig | null>(null)
  const [vacationYearId, setVacationYearId] = useState<string | null>(null)
  const [entries, setEntries] = useState<VacationLedgerEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [initializing, setInitializing] = useState(false)
  const [showAdjustment, setShowAdjustment] = useState(false)
  const [adjustAmount, setAdjustAmount] = useState("")
  const [adjustNote, setAdjustNote] = useState("")
  const [adjustError, setAdjustError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const cfg = await resolveEffectiveVacationConfig(supabase, employeeId)
      setConfig(cfg)
      if (cfg.status !== "configured") {
        setVacationYearId(null)
        setEntries([])
        return
      }
      const yearId = await getVacationYearId(supabase, employeeId, year)
      setVacationYearId(yearId)
      setEntries(yearId ? await getVacationLedger(supabase, yearId) : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Urlaubskonto konnte nicht geladen werden.")
    } finally {
      setLoading(false)
    }
  }, [supabase, employeeId, year])

  useEffect(() => {
    void load()
  }, [load])

  const handleInitialize = async () => {
    setInitializing(true)
    setError(null)
    try {
      await initializeVacationYear(supabase, employeeId, year)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Jahresanspruch konnte nicht angelegt werden.")
    } finally {
      setInitializing(false)
    }
  }

  const handleAdjust = async (e: React.FormEvent) => {
    e.preventDefault()
    if (saving) return
    setAdjustError(null)

    const amount = Number(adjustAmount.trim().replace(",", "."))
    if (!Number.isFinite(amount) || amount === 0) {
      setAdjustError("Bitte einen Korrekturwert ungleich null angeben.")
      return
    }
    if (!adjustNote.trim()) {
      setAdjustError("Bitte einen Grund für die Korrektur angeben.")
      return
    }

    setSaving(true)
    try {
      await addVacationAdjustment(supabase, employeeId, year, amount, adjustNote)
      setAdjustAmount("")
      setAdjustNote("")
      setShowAdjustment(false)
      await load()
    } catch (err) {
      setAdjustError(err instanceof Error ? err.message : "Korrektur konnte nicht gespeichert werden.")
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground">Urlaubskonto wird geladen…</p>
  if (error) return <Notice tone="error">{error}</Notice>
  if (!config) return null

  if (config.status === "disabled") {
    return (
      <p className="text-sm text-muted-foreground">
        Urlaubskonto nicht aktiv. Urlaubsanträge funktionieren unabhängig davon weiterhin.
      </p>
    )
  }

  if (config.status === "incomplete") {
    return (
      <p className="text-sm text-muted-foreground">
        Für diesen Mitarbeiter ist kein Jahresanspruch hinterlegt (weder individuell noch als Firmen-Standard).
      </p>
    )
  }

  if (!vacationYearId) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Für {year} wurde noch kein Urlaubskonto angelegt.
        </p>
        <Button size="sm" onClick={() => void handleInitialize()} disabled={initializing}>
          {initializing ? "Wird angelegt…" : `Jahresanspruch für ${year} anlegen`}
        </Button>
      </div>
    )
  }

  const balance: VacationBalance = buildVacationBalance(entries)

  return (
    <div className="space-y-4">
      <div>
        <Row label="Jahresanspruch" value={formatLedgerAmount(balance.annualEntitlement)} />
        {balance.carryOver !== 0 && <Row label="Übertrag" value={formatLedgerAmount(balance.carryOver)} />}
        <Row label="Verbraucht" value={formatLedgerAmount(-balance.usedDays)} />
        <Row label="Korrekturen" value={formatLedgerAmount(balance.adjustments)} />
        <div className="mt-1 border-t border-gray-100 pt-1.5">
          <Row label="Resturlaub" value={formatLedgerAmount(balance.remaining)} strong />
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Verlauf</p>
        {entries.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Noch keine Einträge.</p>
        ) : (
          <ul className="mt-2 divide-y divide-gray-100">
            {entries.map((entry) => (
              <li key={entry.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <div className="min-w-0">
                  <p className="font-medium text-foreground">{LEDGER_ENTRY_LABELS[entry.entryType]}</p>
                  {entry.note && <p className="truncate text-xs text-muted-foreground">{entry.note}</p>}
                  <p className="text-xs text-muted-foreground">{formatDateTimeDE(entry.createdAt)}</p>
                </div>
                <span className="shrink-0 tabular-nums font-medium">{formatLedgerAmount(entry.amountDays)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {!showAdjustment ? (
        <Button size="sm" variant="outline" onClick={() => setShowAdjustment(true)}>
          Manuelle Korrektur
        </Button>
      ) : (
        <form onSubmit={handleAdjust} noValidate className="space-y-3 rounded-xl border border-gray-100 bg-gray-50/60 p-3">
          {adjustError && <Notice tone="error">{adjustError}</Notice>}
          <div className="grid gap-3 sm:grid-cols-[140px_1fr]">
            <Field id="adjust-amount" label="Tage (± )">
              <Input
                id="adjust-amount"
                inputMode="decimal"
                placeholder="z. B. -2 oder 1,5"
                value={adjustAmount}
                onChange={(e) => setAdjustAmount(e.target.value)}
                disabled={saving}
              />
            </Field>
            <Field id="adjust-note" label="Grund">
              <Input
                id="adjust-note"
                value={adjustNote}
                onChange={(e) => setAdjustNote(e.target.value)}
                disabled={saving}
              />
            </Field>
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? "Wird gespeichert…" : "Speichern"}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setShowAdjustment(false)} disabled={saving}>
              Abbrechen
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}
