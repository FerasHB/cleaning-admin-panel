"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { SectionCard } from "@/components/dashboard/SectionCard"
import { Badge } from "@/components/ui/badge"
import { CompanySettingsForm } from "@/components/settings/CompanySettingsForm"
import { ChangePasswordForm } from "@/components/settings/ChangePasswordForm"
import type { CompanyContact } from "@/lib/company/company.service"
import { Building2, KeyRound, User } from "lucide-react"

function InfoLine({
  label,
  value,
}: {
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-right text-sm font-medium text-foreground">
        {value}
      </span>
    </div>
  )
}

function formatDate(iso: string | null) {
  if (!iso) return "—"
  const d = new Date(iso)
  if (isNaN(d.getTime())) return "—"
  return d.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  })
}

export default function SettingsPage() {
  // Client einmalig halten → stabile Referenz für die Effect-Dependencies.
  const [supabase] = useState(() => createClient())

  const [loading, setLoading] = useState(true)
  const [fullName, setFullName] = useState<string | null>(null)
  const [email, setEmail] = useState<string | null>(null)
  const [role, setRole] = useState<string | null>(null)
  const [company, setCompany] = useState<CompanyContact | null>(null)
  const [companyCreatedAt, setCompanyCreatedAt] = useState<string | null>(null)
  const [employeeCount, setEmployeeCount] = useState<number>(0)

  useEffect(() => {
    let mounted = true
    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        if (mounted) setLoading(false)
        return
      }
      if (mounted) setEmail(user.email ?? null)

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, role, company_id")
        .eq("id", user.id)
        .single()

      if (mounted) {
        setFullName(profile?.full_name ?? null)
        setRole(profile?.role ?? null)
      }

      const [{ data: companyRow }, { count }] = await Promise.all([
        profile?.company_id
          ? supabase
              .from("companies")
              .select("name, contact_email, contact_phone, created_at")
              .eq("id", profile.company_id)
              .single()
          : Promise.resolve({ data: null }),
        supabase
          .from("profiles")
          .select("*", { count: "exact", head: true })
          .eq("role", "employee"),
      ])

      if (mounted) {
        setCompany(
          companyRow
            ? {
                name: companyRow.name,
                contactEmail: companyRow.contact_email,
                contactPhone: companyRow.contact_phone,
              }
            : null,
        )
        setCompanyCreatedAt(companyRow?.created_at ?? null)
        setEmployeeCount(count ?? 0)
        setLoading(false)
      }
    }

    load()
    return () => {
      mounted = false
    }
  }, [supabase])

  const roleLabel = role === "admin" ? "Administrator" : (role ?? "—")

  return (
    <div className="space-y-5">
      {/* ── Hero ── */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Einstellungen
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Firmen- und Kontoinformationen.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Laden…</p>
      ) : (
        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
          {/* Firmenprofil (inkl. Team) */}
          <SectionCard icon={Building2} title="Firmenprofil">
            {company ? (
              <CompanySettingsForm company={company} />
            ) : (
              <p className="text-sm text-muted-foreground">
                Firmendaten konnten nicht geladen werden.
              </p>
            )}
            <div className="mt-4 divide-y divide-gray-100 border-t border-gray-100 pt-2">
              <InfoLine label="Mitglied seit" value={formatDate(companyCreatedAt)} />
              <InfoLine label="Mitarbeiter im Team" value={employeeCount} />
            </div>
          </SectionCard>

          <div className="space-y-5">
            {/* Konto */}
            <SectionCard icon={User} title="Konto">
              <div className="divide-y divide-gray-100">
                <InfoLine label="Name" value={fullName ?? "—"} />
                <InfoLine label="E-Mail" value={email ?? "—"} />
                <InfoLine
                  label="Rolle"
                  value={
                    <Badge variant="info" className="capitalize">
                      {roleLabel}
                    </Badge>
                  }
                />
              </div>
            </SectionCard>

            <SectionCard icon={KeyRound} title="Passwort ändern">
              <ChangePasswordForm />
            </SectionCard>
          </div>
        </div>
      )}
    </div>
  )
}
