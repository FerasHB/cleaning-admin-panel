"use client"

import * as React from "react"
import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  Briefcase,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Settings,
  Users,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"

const navGroups = [
  {
    label: "Übersicht",
    items: [{ title: "Dashboard", href: "/dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Verwaltung",
    items: [
      { title: "Aufträge", href: "/jobs", icon: Briefcase },
      { title: "Mitarbeiter", href: "/employees", icon: Users },
    ],
  },
  {
    label: "Kommunikation",
    items: [{ title: "Nachrichten", href: "/messages", icon: MessageSquare }],
  },
  {
    label: "System",
    items: [{ title: "Einstellungen", href: "/settings", icon: Settings }],
  },
]

const FALLBACK = "Cleaning Admin"

function initials(value: string): string {
  return (
    value
      .trim()
      .split(/\s+/)
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "A"
  )
}

export function Sidebar({ className }: React.HTMLAttributes<HTMLDivElement>) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const [companyName, setCompanyName] = useState<string | null>(null)
  const [adminName, setAdminName] = useState<string | null>(null)
  const [adminEmail, setAdminEmail] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      setAdminEmail(user.email ?? null)

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, company_id")
        .eq("id", user.id)
        .single()

      if (profile?.full_name) setAdminName(profile.full_name)
      if (!profile?.company_id) return

      const { data: company } = await supabase
        .from("companies")
        .select("name")
        .eq("id", profile.company_id)
        .single()

      if (company?.name) setCompanyName(company.name)
    }

    load()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  const displayCompany = companyName ?? FALLBACK
  const companyInitial = displayCompany.trim()[0]?.toUpperCase() ?? "C"
  const accountLabel = adminName ?? adminEmail ?? "Admin"

  return (
    <div
      className={cn(
        "fixed hidden h-screen w-64 flex-col border-r border-gray-100 bg-background md:flex",
        className,
      )}
    >
      {/* ── Workspace header ── */}
      <div className="flex h-[60px] items-center gap-3 border-b border-gray-100 px-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
          {companyInitial}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold leading-tight text-foreground">
            {displayCompany}
          </p>
          <p className="text-[11px] font-medium leading-tight text-muted-foreground">
            Admin-Bereich
          </p>
        </div>
      </div>

      {/* ── Navigation (gruppiert) ── */}
      <div className="flex-1 overflow-auto py-4">
        <nav className="space-y-5 px-3">
          {navGroups.map((group) => (
            <div key={group.label}>
              <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon
                  const isActive = pathname.startsWith(item.href)
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                        isActive
                          ? "border border-primary/15 bg-primary/10 font-semibold text-primary shadow-sm"
                          : "border border-transparent font-medium text-muted-foreground hover:bg-gray-100 hover:text-foreground",
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-4 w-4 shrink-0",
                          isActive ? "text-primary" : "text-muted-foreground",
                        )}
                      />
                      {item.title}
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>

      {/* ── Account-Block ── */}
      <div className="border-t border-gray-100 p-3">
        <div className="flex items-center gap-3 rounded-lg px-2 py-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
            {initials(accountLabel)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">
              {adminName ?? "Admin"}
            </p>
            {adminEmail && (
              <p className="truncate text-xs text-muted-foreground">
                {adminEmail}
              </p>
            )}
          </div>
          <button
            onClick={handleLogout}
            title="Abmelden"
            aria-label="Abmelden"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
