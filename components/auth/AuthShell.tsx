// components/auth/AuthShell.tsx
// Gemeinsamer Rahmen der öffentlichen Auth-Seiten (Anmelden, Registrieren,
// Firma einrichten, Passwort vergessen/zurücksetzen) — gleiche Optik wie die
// bisherige Login-Seite.

import type * as React from "react"
import { Briefcase } from "lucide-react"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export function AuthShell({
  heading,
  subheading,
  title,
  description,
  wide = false,
  children,
}: {
  heading: string
  subheading?: string
  title: string
  description?: string
  wide?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/20 p-4">
      <div className={cn("w-full", wide ? "max-w-[480px]" : "max-w-[400px]")}>
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Briefcase className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">{heading}</h1>
          {subheading && <p className="mt-2 text-muted-foreground">{subheading}</p>}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{title}</CardTitle>
            {description && <CardDescription>{description}</CardDescription>}
          </CardHeader>
          {children}
        </Card>
      </div>
    </div>
  )
}

export function Notice({
  tone,
  children,
}: {
  tone: "error" | "success" | "info"
  children: React.ReactNode
}) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "rounded-md p-3 text-sm font-medium",
        tone === "error" && "bg-destructive/10 text-destructive",
        tone === "success" && "border border-emerald-200 bg-emerald-50 text-emerald-800",
        tone === "info" && "border border-blue-100 bg-blue-50 text-blue-800",
      )}
    >
      {children}
    </div>
  )
}

export function Field({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string
  label: React.ReactNode
  error?: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium leading-none" htmlFor={id}>
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-xs font-medium text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  )
}
