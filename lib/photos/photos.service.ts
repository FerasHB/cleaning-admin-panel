// lib/photos/photos.service.ts
// Supabase-Operationen für Job-Fotos (append-only, online-only) — portiert
// aus Mobiles services/photos/photos.service.ts. Gleicher Bucket
// ("job-photos", privat), gleiche Pfadkonvention, gleiche Signed-URL-Logik.
// Kein Löschen — Fotos sind Nachweise.

import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/database.types"

type DB = SupabaseClient<Database>

export type JobPhoto = {
  id: string
  jobId: string
  companyId: string
  uploadedBy: string | null
  storagePath: string
  fileName: string
  fileSize: number | null
  mimeType: string | null
  createdAt: string
  signedUrl: string | null
}

export type UploadPhotoInput = {
  jobId: string
  companyId: string
  file: File
}

type JobPhotoRow = Database["public"]["Tables"]["job_photos"]["Row"]

const BUCKET = "job-photos"
const SIGNED_URL_EXPIRES_IN = 60 * 60 // 1 Stunde, wie mobil
export const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB, entspricht dem Bucket-Limit

const EXTENSION_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
}

function validateUploadInput(mimeType: string, fileSize: number) {
  if (!ALLOWED_MIME_TYPES.includes(mimeType as (typeof ALLOWED_MIME_TYPES)[number])) {
    throw new Error("Nur JPEG-, PNG- oder WebP-Bilder sind erlaubt.")
  }
  if (fileSize > MAX_FILE_SIZE_BYTES) {
    throw new Error("Das Foto darf höchstens 10 MB groß sein.")
  }
}

function buildStoragePath(companyId: string, jobId: string, mimeType: string): string {
  const ext = EXTENSION_BY_MIME[mimeType] ?? "jpg"
  const random = Math.random().toString(36).slice(2, 8)
  return `${companyId}/${jobId}/${Date.now()}_${random}.${ext}`
}

function mapPhoto(row: JobPhotoRow, signedUrl: string | null): JobPhoto {
  return {
    id: row.id,
    jobId: row.job_id,
    companyId: row.company_id,
    uploadedBy: row.uploaded_by,
    storagePath: row.storage_path,
    fileName: row.file_name,
    fileSize: row.file_size,
    mimeType: row.mime_type,
    createdAt: row.created_at,
    signedUrl,
  }
}

// Lädt ein Foto hoch: Storage-Objekt zuerst, danach die Metadaten-Zeile.
// Schlägt der DB-Insert fehl, wird das bereits hochgeladene Objekt per
// Best-Effort-Rollback wieder entfernt (spiegelt die Mobile-Logik).
export async function uploadJobPhoto(
  supabase: DB,
  input: UploadPhotoInput,
): Promise<JobPhoto> {
  const { jobId, companyId, file } = input
  const mimeType = file.type
  const fileSize = file.size

  validateUploadInput(mimeType, fileSize)

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError) throw authError
  if (!user) throw new Error("Kein eingeloggter Benutzer gefunden.")

  const storagePath = buildStoragePath(companyId, jobId, mimeType)

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, file, { contentType: mimeType, upsert: false })

  if (uploadError) {
    throw new Error("Das Foto konnte nicht hochgeladen werden.")
  }

  const { data, error: insertError } = await supabase
    .from("job_photos")
    .insert({
      job_id: jobId,
      company_id: companyId,
      uploaded_by: user.id,
      storage_path: storagePath,
      file_name: file.name,
      file_size: fileSize,
      mime_type: mimeType,
    })
    .select()
    .single()

  if (insertError || !data) {
    await supabase.storage.from(BUCKET).remove([storagePath])
    throw new Error("Das Foto konnte nicht gespeichert werden. Bitte versuche es erneut.")
  }

  let signedUrl: string | null = null
  const { data: signed } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_EXPIRES_IN)
  if (signed?.signedUrl) signedUrl = signed.signedUrl

  return mapPhoto(data, signedUrl)
}

// Holt alle Fotos eines Jobs (neueste zuerst) inkl. Signed URLs. Schlägt die
// Signed-URL-Erzeugung fehl, werden die Fotos trotzdem zurückgegeben
// (signedUrl bleibt null — UI zeigt einen Platzhalter statt eines Fehlers).
export async function getJobPhotos(supabase: DB, jobId: string): Promise<JobPhoto[]> {
  const { data, error } = await supabase
    .from("job_photos")
    .select("*")
    .eq("job_id", jobId)
    .order("created_at", { ascending: false })

  if (error) throw error
  const rows = data ?? []
  if (rows.length === 0) return []

  const paths = rows.map((row) => row.storage_path)
  const { data: signedUrls } = await supabase.storage
    .from(BUCKET)
    .createSignedUrls(paths, SIGNED_URL_EXPIRES_IN)

  const signedByPath = new Map<string, string>()
  for (const entry of signedUrls ?? []) {
    if (entry.path && entry.signedUrl) signedByPath.set(entry.path, entry.signedUrl)
  }

  return rows.map((row) => mapPhoto(row, signedByPath.get(row.storage_path) ?? null))
}
