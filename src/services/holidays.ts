import { supabase } from '../lib/supabase'

const BUCKET = 'holidays'

// Returns the public URL of the most recently uploaded PDF in the bucket.
// Swap the holiday calendar by uploading a new PDF in the Supabase dashboard — no rebuild.
export async function getLatestHolidayPdfUrl() {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .list('', { sortBy: { column: 'created_at', order: 'desc' } })
  if (error) return { url: null, error }

  const file = data?.find((f) => f.name.toLowerCase().endsWith('.pdf'))
  if (!file) return { url: null, error: null }

  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(file.name)
  return { url: pub.publicUrl, error: null }
}
