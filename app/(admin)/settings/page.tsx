"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { SectionCard } from "@/components/dashboard/SectionCard"
import { Badge } from "@/components/ui/badge"
import { Building2, User, Users } from "lucide-react"

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
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [fullName, setFullName] = useState<string | null>(null)
  const [email, setEmail] = useState<string | null>(null)
  const [role, setRole] = useState<string | null>(null)
  const [companyName, setCompanyName] = useState<string | null>(null)
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

      const [{ data: company }, { count }] = await Promise.all([
        profile?.company_id
          ? supabase
              .from("companies")
              .select("name, created_at")
              .eq("id", profile.company_id)
              .single()
          : Promise.resolve({ data: null }),
        supabase
          .from("profiles")
          .select("*", { count: "exact", head: true })
          .eq("role", "employee"),
      ])

      if (mounted) {
        setCompanyName(company?.name ?? null)
        setCompanyCreatedAt(company?.created_at ?? null)
        setEmployeeCount(count ?? 0)
        setLoading(false)
      }
    }

    load()
    return () => {
      mounted = false
    }
  }, [])

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
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {/* Firmenprofil */}
          <SectionCard icon={Building2} title="Firmenprofil">
            <div className="divide-y divide-gray-100">
              <InfoLine label="Firmenname" value={companyName ?? "—"} />
              <InfoLine label="Mitglied seit" value={formatDate(companyCreatedAt)} />
            </div>
          </SectionCard>

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

          {/* Team */}
          <SectionCard icon={Users} title="Team">
            <div className="divide-y divide-gray-100">
              <InfoLine label="Mitarbeiter im Team" value={employeeCount} />
            </div>
          </SectionCard>
        </div>
      )}
    </div>
  )
}
