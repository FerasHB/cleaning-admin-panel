"use client"

// hooks/use-job-photos.ts
// Lokaler State für Job-Fotos (online-only, kein Löschen) — portiert aus
// Mobiles useJobPhotos. Lädt beim Mount; neue Fotos werden nach
// erfolgreichem Upload vorne eingefügt (sofortiges Feedback ohne Neuabruf).

import { useCallback, useEffect, useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import {
  getJobPhotos,
  uploadJobPhoto,
  type JobPhoto,
} from "@/lib/photos/photos.service"

export function useJobPhotos(jobId: string) {
  const supabase = useRef(createClient()).current
  const [photos, setPhotos] = useState<JobPhoto[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setError(null)
      const data = await getJobPhotos(supabase, jobId)
      setPhotos(data)
    } catch (err) {
      console.error("Failed to load job photos:", err)
      setError(
        err instanceof Error ? err.message : "Fotos konnten nicht geladen werden.",
      )
    } finally {
      setLoading(false)
    }
  }, [jobId, supabase])

  useEffect(() => {
    setLoading(true)
    load()
  }, [load])

  // Lädt ein Foto hoch und legt die company_id aus dem Profil des
  // eingeloggten Nutzers zugrunde (wird für RLS-Scoping benötigt).
  const upload = useCallback(
    async (file: File) => {
      setUploading(true)
      setError(null)
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!user) throw new Error("Kein eingeloggter Benutzer gefunden.")

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("company_id")
          .eq("id", user.id)
          .single()

        if (profileError || !profile?.company_id) {
          throw new Error("Kein Unternehmen verknüpft. Bitte neu einloggen.")
        }

        const photo = await uploadJobPhoto(supabase, {
          jobId,
          companyId: profile.company_id,
          file,
        })
        setPhotos((prev) => [photo, ...prev])
        return photo
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Das Foto konnte nicht hochgeladen werden.",
        )
        throw err
      } finally {
        setUploading(false)
      }
    },
    [jobId, supabase],
  )

  return { photos, loading, uploading, error, upload, reload: load }
}
