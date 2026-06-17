import { useState, useEffect } from 'preact/hooks'
import { fetchArchivedTimesheets } from '../services/timesheets'
import type { TimesheetWithProject } from '../types'

const PAGE_SIZE = 20

export function Archived() {
  const [rows, setRows] = useState<TimesheetWithProject[]>([])
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetchArchivedTimesheets(page, PAGE_SIZE).then(({ data, error, count }) => {
      if (error) setError(error.message)
      else {
        setRows((data as TimesheetWithProject[]) ?? [])
        setTotal(count ?? 0)
      }
      setLoading(false)
    })
  }, [page])

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))

  // page numbers to render: first, last, current ±1, with '…' gaps
  const pageItems: (number | '…')[] = []
  for (let i = 0; i < pageCount; i++) {
    if (i === 0 || i === pageCount - 1 || Math.abs(i - page) <= 1) pageItems.push(i)
    else if (pageItems[pageItems.length - 1] !== '…') pageItems.push('…')
  }

  return (
    <div>
      <h1 class="text-2xl font-bold mb-4">Archived</h1>
      {error && (
        <div class="alert alert-error mb-4">
          <span>{error}</span>
        </div>
      )}
      {loading ? (
        <div class="flex justify-center py-8">
          <span class="loading loading-spinner loading-md" />
        </div>
      ) : rows.length === 0 ? (
        <p class="text-base-content/50 py-8 text-center">No archived entries found.</p>
      ) : (
        <>
          <div class="overflow-x-auto">
            <table class="table table-zebra">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Project</th>
                  <th>Complete</th>
                  <th>AI Summary</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((t) => (
                  <tr key={t.id}>
                    <td class="whitespace-nowrap">{new Date(t.date_memo).toLocaleDateString()}</td>
                    <td class="max-w-xs"><span class="line-clamp-2 cursor-help hover:line-clamp-none">{t.description}</span></td>
                    <td>{t.projects?.project_name ?? <span class="text-base-content/30">—</span>}</td>
                    <td>
                      <input type="checkbox" class="checkbox checkbox-sm" checked={t.is_complete} disabled />
                    </td>
                    <td class="min-w-64 max-w-md">
                      {t.ai_summary ? (
                        <p class="line-clamp-3 cursor-help text-sm leading-relaxed text-base-content/70 hover:line-clamp-none">{t.ai_summary}</p>
                      ) : (
                        <span class="text-base-content/30">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div class="mt-4 flex items-center justify-between">
            <span class="text-sm opacity-60">
              Page {page + 1} of {pageCount} · {total} entries
            </span>
            <div class="join">
              <button
                class="btn btn-sm join-item"
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
              >
                «
              </button>
              {pageItems.map((item, i) =>
                item === '…' ? (
                  <button key={`gap-${i}`} class="btn btn-sm join-item btn-disabled">…</button>
                ) : (
                  <button
                    key={item}
                    class={`btn btn-sm join-item${item === page ? ' btn-active' : ''}`}
                    onClick={() => setPage(item)}
                  >
                    {item + 1}
                  </button>
                ),
              )}
              <button
                class="btn btn-sm join-item"
                disabled={page + 1 >= pageCount}
                onClick={() => setPage((p) => p + 1)}
              >
                »
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
