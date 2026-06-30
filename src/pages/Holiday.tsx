import { useRef, useEffect, useState } from 'preact/hooks'
import { Calendar } from 'vanilla-calendar-pro'
import 'vanilla-calendar-pro/styles/index.css' // DaisyUI v4 doesn't auto-style .vc (that's v5), so ship the lib's own CSS
import { fetchHolidays } from '../services/holidays'

export function Holiday() {
  const ref = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cal: Calendar | null = null
    fetchHolidays().then(({ data, error }) => {
      setLoading(false)
      if (error) return setError(error.message)
      const popups = Object.fromEntries(
        (data ?? []).map((h) => [
          h.date,
          { modifier: 'bg-error text-error-content rounded-full', html: h.name },
        ])
      )
      if (!ref.current) return
      cal = new Calendar(ref.current, { popups })
      cal.init()
    })
    return () => cal?.destroy()
  }, [])

  return (
    <div>
      <h1 class="text-2xl font-bold mb-4">Holiday</h1>
      {error && (
        <div class="alert alert-error mb-4">
          <span>{error}</span>
        </div>
      )}
      {loading && (
        <div class="flex justify-center py-8">
          <span class="loading loading-spinner loading-md" />
        </div>
      )}
      <div ref={ref} />
    </div>
  )
}
