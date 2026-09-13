"use client"

// components/jobs/JobPhotos.tsx
// Foto-Galerie + Upload für die Auftrags-Detailseite — portiert aus Mobiles
// JobPhotos.tsx (features/jobs/components/JobPhotos.tsx). Kein Löschen —
// Fotos sind Nachweise (append-only). Web ist admin-only, daher immer
// hochladeberechtigt (keine isAssignedTo/isPrimaryAssignee-Prüfung nötig).

import { useEffect, useRef, useState } from "react"
import { CheckCircle2, ImageOff, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useJobPhotos } from "@/hooks/use-job-photos"
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES } from "@/lib/photos/photos.service"

const SUCCESS_DISPLAY_MS = 3000
const ACCEPT = ALLOWED_MIME_TYPES.join(",")

function validateFile(file: File): string | null {
  if (!ALLOWED_MIME_TYPES.includes(file.type as (typeof ALLOWED_MIME_TYPES)[number])) {
    return "Nur JPEG-, PNG- oder WebP-Bilder sind erlaubt."
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return "Das Foto darf höchstens 10 MB groß sein."
  }
  return null
}

export function JobPhotos({ jobId }: { jobId: string }) {
  const { photos, loading, uploading, error, upload } = useJobPhotos(jobId)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [showSuccess, setShowSuccess] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const successTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current)
    }
  }, [])

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return

    setUploadError(null)
    const validationError = validateFile(file)
    if (validationError) {
      setUploadError(validationError)
      return
    }

    try {
      await upload(file)
      setShowSuccess(true)
      if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current)
      successTimeoutRef.current = setTimeout(() => setShowSuccess(false), SUCCESS_DISPLAY_MS)
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : "Das Foto konnte nicht hochgeladen werden.",
      )
    }
  }

  const displayError = uploadError ?? error

  return (
    <div className="space-y-3">
      {/* ── Kopfzeile ── */}
      <div className="flex items-center justify-end gap-3">
        {photos.length > 0 && (
          <p className="mr-auto text-sm text-muted-foreground">
            {photos.length} {photos.length === 1 ? "Foto" : "Fotos"}
          </p>
        )}
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPT}
            onChange={handleFileChange}
            disabled={uploading}
            className="hidden"
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? "Wird hochgeladen…" : "Foto hinzufügen"}
          </Button>
        </div>
      </div>

      {/* ── Fehler ── */}
      {displayError && (
        <p className="text-sm font-medium text-destructive">{displayError}</p>
      )}

      {/* ── Erfolg ── */}
      {showSuccess && (
        <p className="flex items-center gap-1.5 text-sm font-medium text-emerald-700">
          <CheckCircle2 className="h-4 w-4" />
          Foto erfolgreich hochgeladen.
        </p>
      )}

      {/* ── Ladezustand ── */}
      {loading ? (
        <p className="text-sm text-muted-foreground">Fotos werden geladen…</p>
      ) : photos.length === 0 ? (
        <p className="text-sm text-muted-foreground">Noch keine Fotos vorhanden.</p>
      ) : (
        <div className="flex gap-2.5 overflow-x-auto pb-1">
          {photos.map((photo) => (
            <button
              key={photo.id}
              type="button"
              disabled={!photo.signedUrl}
              onClick={() => photo.signedUrl && setPreviewUrl(photo.signedUrl)}
              className="h-[88px] w-[88px] shrink-0 overflow-hidden rounded-lg border border-gray-100 bg-gray-50 disabled:cursor-default"
            >
              {photo.signedUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photo.signedUrl}
                  alt={photo.fileName}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center">
                  <ImageOff className="h-5 w-5 text-muted-foreground" />
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* ── Vollbild-Vorschau ── */}
      {previewUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-6"
          onClick={() => setPreviewUrl(null)}
        >
          <button
            type="button"
            aria-label="Schließen"
            onClick={() => setPreviewUrl(null)}
            className="absolute right-5 top-5 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
          >
            <X className="h-5 w-5" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt="Foto-Vorschau"
            className="max-h-full max-w-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  )
}
