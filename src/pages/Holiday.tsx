import { useState, useEffect } from 'preact/hooks'
import { getLatestHolidayPdfUrl } from '../services/holidays'

export function Holiday() {
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getLatestHolidayPdfUrl().then(({ url, error }) => {
      if (error) setError(error.message)
      else setUrl(url)
      setLoading(false)
    })
  }, [])

  return (
    <div>
      <h1 class="text-2xl font-bold mb-4">Holiday</h1>
      {error && (
        <div class="alert alert-error mb-4">
          <span>{error}</span>
        </div>
      )}
      {loading ? (
        <div class="flex justify-center py-8">
          <span class="loading loading-spinner loading-md" />
        </div>
      ) : url ? (
        <iframe
          src={`https://docs.google.com/viewer?embedded=true&url=${encodeURIComponent(url)}`}
          class="w-full h-[80vh] rounded-lg border border-base-300"
          title="Holiday calendar"
        />
      ) : (
        <p class="text-base-content/50 py-8 text-center">No holiday calendar uploaded yet.</p>
      )}
    </div>
  )
}
