import { useRef, useEffect, useState } from 'preact/hooks'
import { Calendar } from 'vanilla-calendar-pro'
import 'vanilla-calendar-pro/styles/index.css' // DaisyUI v4 doesn't auto-style .vc (that's v5), so ship the lib's own CSS
import { fetchHolidays } from '../services/holidays'
import type { Holiday as HolidayType } from '../types'

export function Holiday() {
  const ref = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [holidays, setHolidays] = useState<HolidayType[]>([])

  useEffect(() => {
    let cal: Calendar | null = null
    fetchHolidays().then(({ data, error }) => {
      setLoading(false)
      if (error) return setError(error.message)
      const list = data ?? []
      setHolidays(list)
      if (!ref.current) return
      cal = new Calendar(ref.current, {
        // highlight every gist date (adds data-vc-date-holiday → styled by the lib)
        selectedHolidays: list.map((h) => h.date),
        // click/hover a highlighted date → show its holiday name
        popups: Object.fromEntries(list.map((h) => [h.date, { html: h.name }])),
      })
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
      {/* always mounted so ref.current exists when fetch resolves and inits the calendar */}
      <div ref={ref} />

      {holidays.length > 0 && (
        <div class="overflow-x-auto mt-4">
          <table class="table table-zebra">
            <thead>
              <tr>
                <th class="w-40">Date</th>
                <th>Holiday</th>
              </tr>
            </thead>
            <tbody>
              {holidays.map((h) => (
                <tr key={h.date}>
                  <td class="font-mono text-sm opacity-70 whitespace-nowrap">{h.date}</td>
                  <td>{h.name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
