import { useState, useEffect } from 'preact/hooks'
import { fetchArchivedTimesheetsInRange, getOrCreateMonthlySummary } from '../services/timesheets'
import type { TimesheetWithProject } from '../types'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

// ponytail: current year + 3 back is enough; widen if anyone keeps >4 years of archive.
const NOW_YEAR = new Date().getFullYear()
const YEARS = [NOW_YEAR, NOW_YEAR - 1, NOW_YEAR - 2, NOW_YEAR - 3]

type DigestState = { status: 'loading' | 'done' | 'error'; text: string }

export function Timeline() {
  const [year, setYear] = useState(NOW_YEAR)
  const [rows, setRows] = useState<TimesheetWithProject[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // keyed by month number 1-12
  const [digests, setDigests] = useState<Record<number, DigestState>>({})

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    setDigests({})
    fetchArchivedTimesheetsInRange(`${year}-01-01`, `${year}-12-31`).then(({ data, error }) => {
      if (cancelled) return
      if (error) setError(error.message)
      else setRows((data as TimesheetWithProject[]) ?? [])
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [year])

  // Group rows by calendar month, newest month first.
  const byMonth = new Map<number, TimesheetWithProject[]>()
  for (const r of rows) {
    const m = new Date(r.date_memo).getMonth() + 1
    if (!byMonth.has(m)) byMonth.set(m, [])
    byMonth.get(m)!.push(r)
  }
  const months = [...byMonth.keys()].sort((a, b) => b - a)

  async function loadDigest(month: number, force = false) {
    const entries = byMonth.get(month) ?? []
    setDigests((d) => ({ ...d, [month]: { status: 'loading', text: '' } }))
    try {
      const text = await getOrCreateMonthlySummary(year, month, entries, { force })
      setDigests((d) => ({ ...d, [month]: { status: 'done', text } }))
    } catch (err) {
      setDigests((d) => ({ ...d, [month]: { status: 'error', text: err instanceof Error ? err.message : 'Could not generate summary.' } }))
    }
  }

  // Kick off each month's digest once rows load. Independent per-month so the timeline
  // renders immediately and each card fills in on its own. Cache makes repeat views instant.
  useEffect(() => {
    for (const m of byMonth.keys()) {
      if (!digests[m]) loadDigest(m)
    }
  }, [rows])

  return (
    <div class="p-4 max-w-3xl mx-auto">
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-2xl font-bold">Timeline</h1>
        <select
          class="select select-sm"
          value={year}
          onInput={(e) => setYear(Number((e.target as HTMLSelectElement).value))}
        >
          {YEARS.map((y) => <option value={y}>{y}</option>)}
        </select>
      </div>

      {error && <div class="alert alert-error mb-4"><span>{error}</span></div>}

      {loading ? (
        <div class="flex justify-center py-12"><span class="loading loading-spinner loading-lg" /></div>
      ) : months.length === 0 ? (
        <p class="text-base-content/60 py-12 text-center">No archived entries for {year}.</p>
      ) : (
        <ul class="timeline timeline-vertical">
          {months.map((m, i) => {
            const entries = byMonth.get(m)!
            const d = digests[m]
            return (
              <li>
                {i > 0 && <hr />}
                <div class="timeline-middle">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-5 w-5 text-primary">
                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clip-rule="evenodd" />
                  </svg>
                </div>
                <div class={`${i % 2 === 0 ? 'timeline-start' : 'timeline-end'} timeline-box`}>
                  <div class="flex items-center justify-between gap-2 mb-1">
                    <span class="font-semibold">{MONTHS[m - 1]} {year}</span>
                    <span class="text-xs text-base-content/60">{entries.length} entr{entries.length === 1 ? 'y' : 'ies'}</span>
                  </div>
                  {(!d || d.status === 'loading') && <span class="loading loading-spinner loading-xs" />}
                  {d?.status === 'error' && (
                    <div class="text-error text-sm">
                      {d.text} <button class="link" onClick={() => loadDigest(m, true)}>retry</button>
                    </div>
                  )}
                  {d?.status === 'done' && (
                    <>
                      <div class="whitespace-pre-line text-sm">{d.text}</div>
                      <button class="btn btn-ghost btn-xs mt-2" onClick={() => loadDigest(m, true)}>Regenerate</button>
                    </>
                  )}
                </div>
                {i < months.length - 1 && <hr />}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
