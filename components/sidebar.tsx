"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Briefcase, LayoutDashboard, LogOut, Users } from "lucide-react"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"

const sidebarItems = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Jobs",
    href: "/jobs",
    icon: Briefcase,
  },
  {
    title: "Employees",
    href: "/employees",
    icon: Users,
  },
]

const FALLBACK = "Cleaning Admin"

export function Sidebar({ className }: React.HTMLAttributes<HTMLDivElement>) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const [companyName, setCompanyName] = useState<string | null>(null)

  useEffect(() => {
    const fetchCompanyName = async () => {
      // Step 1: get the current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Step 2: get profile (which has company_id)
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", user.id)
        .single()

      if (!profile?.company_id) return

      // Step 3: get company name
      const { data: company } = await supabase
        .from("companies")
        .select("name")
        .eq("id", profile.company_id)
        .single()

      if (company?.name) {
        setCompanyName(company.name)
      }
    }

    fetchCompanyName()
  }, []) // runs once on mount

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  const displayName = companyName ?? FALLBACK
  const initial = displayName.trim()[0]?.toUpperCase() ?? "C"

  return (
    <div className={cn("fixed hidden h-screen w-64 flex-col border-r bg-card md:flex", className)}>

      {/* ── Workspace header ── */}
      <div className="flex h-[60px] items-center gap-3 border-b px-4">
        {/* Company initial avatar */}
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
          {initial}
        </div>
        {/* Company name + label */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold leading-tight text-foreground">
            {displayName}
          </p>
          <p className="text-[11px] font-medium leading-tight text-muted-foreground">
            Admin workspace
          </p>
        </div>
      </div>

      {/* ── Navigation ── */}
      <div className="flex-1 overflow-auto py-3">
        <nav className="grid gap-0.5 px-3">
          {sidebarItems.map((item, index) => {
            const Icon = item.icon
            const isActive = pathname.startsWith(item.href)
            return (
              <Link
                key={index}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                  isActive
                    ? "bg-primary/10 font-semibold text-primary"
                    : "font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-primary" : "text-muted-foreground")} />
                {item.title}
              </Link>
            )
          })}
        </nav>
      </div>

      {/* ── Sign out ── */}
      <div className="border-t px-3 py-3">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-destructive/8 hover:text-destructive"
        >
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted">
            <LogOut className="h-3.5 w-3.5" />
          </div>
          <span>Sign out</span>
        </button>
      </div>

    </div>
  )
}
