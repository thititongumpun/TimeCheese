import { useState, useEffect } from 'preact/hooks'
import * as XLSX from 'xlsx'
import { save } from '@tauri-apps/plugin-dialog'
import { writeFile } from '@tauri-apps/plugin-fs'
import { fetchArchivedTimesheetsInRange } from '../services/timesheets'
import { ExpandableText } from '../components/ExpandableText'
import type { TimesheetWithProject } from '../types'

const isTauri = '__TAURI_INTERNALS__' in window

const PAGE_SIZE = 20

// Local YYYY-MM-DD — toISOString() would shift to UTC and roll the date back a day in +07.
function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function currentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

// Cutoff billing period: a month M covers the 26th of M-1 through the 25th of M.
// A start..end month range therefore spans 26th-before-start through 25th-of-end.
export function periodRange(startMonth: string, endMonth: string): { from: string; to: string } {
  const [sy, sm] = startMonth.split('-').map(Number)
  const [ey, em] = endMonth.split('-').map(Number)
  return {
    from: ymd(new Date(sy, sm - 2, 26)), // 26th of the month before `start`
    to: ymd(new Date(ey, em - 1, 25)),   // 25th of `end`
  }
}

export function Archived() {
  const [rows, setRows] = useState<TimesheetWithProject[]>([])
  const [startMonth, setStartMonth] = useState(currentMonth())
  const [endMonth, setEndMonth] = useState(currentMonth())
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)

  const { from, to } = periodRange(startMonth, endMonth)

  useEffect(() => {
    setLoading(true)
    setError(null)
    setPage(0)
    fetchArchivedTimesheetsInRange(from, to).then(({ data, error }) => {
      if (error) setError(error.message)
      else setRows((data as TimesheetWithProject[]) ?? [])
      setLoading(false)
    })
  }, [startMonth, endMonth])

  async function handleExport() {
    if (rows.length === 0) {
      setError('No archived entries in this period.')
      return
    }
    setExporting(true)
    setError(null)
    const sheet = XLSX.utils.json_to_sheet(rows.map((t) => ({
      Date: new Date(t.date_memo).toLocaleDateString(),
      Description: t.description,
      Project: t.projects?.project_name ?? '',
      Complete: t.is_complete ? 'Yes' : 'No',
      'AI Summary': t.ai_summary ?? '',
    })))
    const book = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(book, sheet, 'Timesheets')
    const filename = `timesheets-${from}_${to}.xlsx`

    // Tauri webview ignores blob downloads, so save through the fs plugin; fall back to download in browser dev.
    if (isTauri) {
      const path = await save({ defaultPath: filename, filters: [{ name: 'Excel', extensions: ['xlsx'] }] })
      if (path) {
        const bytes = XLSX.write(book, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
        await writeFile(path, new Uint8Array(bytes))
      }
    } else {
      XLSX.writeFile(book, filename)
    }
    setExporting(false)
  }

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const visible = rows.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)

  // page numbers to render: first, last, current ±1, with '…' gaps
  const pageItems: (number | '…')[] = []
  for (let i = 0; i < pageCount; i++) {
    if (i === 0 || i === pageCount - 1 || Math.abs(i - page) <= 1) pageItems.push(i)
    else if (pageItems[pageItems.length - 1] !== '…') pageItems.push('…')
  }

  return (
    <div>
      <div class="mb-4 flex flex-wrap items-end justify-between gap-3">
        <h1 class="text-2xl font-bold">Archived</h1>
        <div class="flex flex-wrap items-end gap-2">
          <label class="form-control">
            <span class="label-text text-xs">Start month</span>
            <input
              type="month"
              class="input input-bordered input-sm"
              value={startMonth}
              max={endMonth}
              onInput={(e) => {
                const v = (e.target as HTMLInputElement).value
                setStartMonth(v)
                if (v > endMonth) setEndMonth(v)
              }}
            />
          </label>
          <label class="form-control">
            <span class="label-text text-xs">End month</span>
            <input
              type="month"
              class="input input-bordered input-sm"
              value={endMonth}
              min={startMonth}
              onInput={(e) => {
                const v = (e.target as HTMLInputElement).value
                setEndMonth(v)
                if (v < startMonth) setStartMonth(v)
              }}
            />
          </label>
          <button class="btn btn-primary btn-sm" disabled={exporting || rows.length === 0} onClick={handleExport}>
            {exporting ? <span class="loading loading-spinner loading-xs" /> : 'Export XLSX'}
          </button>
        </div>
      </div>
      <p class="mb-4 text-sm opacity-60">
        Cutoff period: {new Date(from).toLocaleDateString()} – {new Date(to).toLocaleDateString()}
      </p>
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
        <p class="text-base-content/50 py-8 text-center">No archived entries in this period.</p>
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
                {visible.map((t) => (
                  <tr key={t.id}>
                    <td class="whitespace-nowrap">{new Date(t.date_memo).toLocaleDateString()}</td>
                    <td class="max-w-xs"><ExpandableText text={t.description} clampClass="line-clamp-2" /></td>
                    <td>{t.projects?.project_name ?? <span class="text-base-content/30">—</span>}</td>
                    <td>
                      <input type="checkbox" class="checkbox checkbox-sm" checked={t.is_complete} disabled />
                    </td>
                    <td class="min-w-64 max-w-md">
                      {t.ai_summary ? (
                        <ExpandableText text={t.ai_summary} clampClass="line-clamp-3" class="text-sm leading-relaxed text-base-content/70" />
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
              Page {page + 1} of {pageCount} · {rows.length} entries
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
