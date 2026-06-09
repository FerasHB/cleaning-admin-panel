"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { SectionCard } from "@/components/dashboard/SectionCard"
import { ArrowRight, MessageSquare } from "lucide-react"
import {
  getRecentCompanyComments,
  type RecentComment,
} from "@/lib/comments/comments"
import { formatDateTimeDE } from "@/lib/date"

function initials(name: string | null) {
  if (!name) return "?"
  return (
    name
      .trim()
      .split(/\s+/)
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?"
  )
}

export default function MessagesPage() {
  const supabase = useRef(createClient()).current
  const [comments, setComments] = useState<RecentComment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    const load = async () => {
      try {
        const data = await getRecentCompanyComments(supabase, 20)
        if (mounted) setComments(data)
      } catch (err) {
        console.error("Failed to load messages:", err)
        if (mounted)
          setError(
            err instanceof Error
              ? err.message
              : "Nachrichten konnten nicht geladen werden.",
          )
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => {
      mounted = false
    }
  }, [supabase])

  return (
    <div className="space-y-5">
      {/* ── Hero ── */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Nachrichten
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Letzte Kommentare aus allen Aufträgen.
        </p>
      </div>

      <SectionCard
        icon={MessageSquare}
        title="Kommentar-Verlauf"
        subtitle={
          loading
            ? "Laden…"
            : comments.length > 0
              ? `${comments.length} neueste Nachrichten`
              : "Keine Nachrichten"
        }
        noBodyPadding
      >
        {loading ? (
          <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
            Laden…
          </div>
        ) : error ? (
          <div className="px-5 py-6 text-sm font-medium text-destructive">
            {error}
          </div>
        ) : comments.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-14 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary">
              <MessageSquare className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">Noch keine Nachrichten</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Kommentare zu Aufträgen erscheinen hier.
              </p>
            </div>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {comments.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/jobs/${c.jobId}`}
                  className="flex items-start gap-3 px-5 py-4 transition-colors hover:bg-gray-50/70"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    {initials(c.authorName)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span className="text-sm font-medium text-foreground">
                        {c.authorName ?? "Unbekannt"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Kunde: {c.customerName ?? "—"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        · {formatDateTimeDE(c.createdAt)}
                      </span>
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
                      {c.message}
                    </p>
                  </div>
                  <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground/50" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  )
}
