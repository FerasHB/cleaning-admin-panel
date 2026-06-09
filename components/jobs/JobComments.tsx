"use client"

// components/jobs/JobComments.tsx
// Kommentarliste + Eingabe für die Auftrags-Detailseite (append-only,
// online-only). Fehler werden inline angezeigt — keine Browser-alerts.

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { useJobComments } from "@/hooks/use-job-comments"
import { formatDateTimeDE } from "@/lib/date"

function initials(name: string | null): string {
  if (!name) return "?"
  return name
    .trim()
    .split(/\s+/)
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

export function JobComments({ jobId }: { jobId: string }) {
  const { comments, loading, error, submit } = useJobComments(jobId)
  const [message, setMessage] = useState("")
  const [sending, setSending] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = message.trim()
    if (!trimmed) return

    setSending(true)
    setSubmitError(null)
    try {
      await submit(trimmed)
      setMessage("")
    } catch (err) {
      setSubmitError(
        err instanceof Error
          ? err.message
          : "Kommentar konnte nicht gesendet werden.",
      )
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* ── Liste ── */}
      {loading ? (
        <p className="text-sm text-muted-foreground">Kommentare werden geladen…</p>
      ) : error ? (
        <p className="text-sm font-medium text-destructive">{error}</p>
      ) : comments.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Noch keine Kommentare zu diesem Auftrag.
        </p>
      ) : (
        <ul className="space-y-4">
          {comments.map((c) => (
            <li key={c.id} className="flex gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                {initials(c.authorName)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-sm font-medium text-foreground">
                    {c.authorName ?? "Unbekannt"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatDateTimeDE(c.createdAt)}
                  </span>
                </div>
                <p className="whitespace-pre-wrap break-words text-sm text-foreground">
                  {c.message}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* ── Eingabe ── */}
      <form onSubmit={handleSubmit} className="space-y-2 border-t pt-4">
        {submitError && (
          <p className="text-xs font-medium text-destructive">{submitError}</p>
        )}
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          disabled={sending}
          rows={3}
          placeholder="Kommentar schreiben…"
          className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
        />
        <div className="flex justify-end">
          <Button type="submit" size="sm" disabled={sending || !message.trim()}>
            {sending ? "Senden…" : "Senden"}
          </Button>
        </div>
      </form>
    </div>
  )
}
