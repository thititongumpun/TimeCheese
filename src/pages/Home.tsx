import { useState, useEffect } from 'preact/hooks'
import { writeText } from '@tauri-apps/plugin-clipboard-manager'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { fetchTimesheets, deleteTimesheet, updateTimesheet, updateTimesheets } from '../services/timesheets'
import { fetchActiveProjects } from '../services/projects'
import { confirmDialog } from '../lib/confirm'
import { APPSMITH_URL } from '../lib/appsmith'
import { TimesheetTable } from '../components/timesheets/TimesheetTable'
import { TimesheetFilters } from '../components/timesheets/TimesheetFilters'
import { TimesheetModal } from '../components/timesheets/TimesheetModal'
import type { TimesheetWithProject, TimesheetFilters as Filters, Project } from '../types'

const isTauri = '__TAURI_INTERNALS__' in window

// One "Send to Appsmith" run: what landed in msync and when.
type FillRun = {
  at: string
  filled: number
  total: number
  entries: { date: string; projectNo: string; description: string }[]
}

function readFillLog(): FillRun[] {
  try { return JSON.parse(localStorage.getItem('appsmith_fill_log') ?? '[]') } catch { return [] }
}

// Local YYYY-MM-DD — toISOString() would shift to UTC and roll the date back a day in +07.
function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function defaultFilters(): Filters {
  const now = new Date()
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return {
    date_from: ymd(firstDay),
    date_to: ymd(lastDay),
    project_id: null,
    status: 'all',
  }
}

export function Home() {
  const [timesheets, setTimesheets] = useState<TimesheetWithProject[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [filters, setFilters] = useState<Filters>(defaultFilters())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingTimesheet, setEditingTimesheet] = useState<TimesheetWithProject | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [fillLog, setFillLog] = useState<FillRun[]>(readFillLog)

  async function loadTimesheets() {
    setLoading(true)
    setError(null)
    const { data, error } = await fetchTimesheets(filters)
    if (error) setError(error.message)
    else setTimesheets((data as TimesheetWithProject[]) ?? [])
    setSelectedIds(new Set())
    setLoading(false)
  }

  async function loadProjects() {
    const { data, error } = await fetchActiveProjects()
    if (error) setError(error.message)
    else setProjects((data as Project[]) ?? [])
  }

  useEffect(() => { loadProjects() }, [])
  useEffect(() => { loadTimesheets() }, [filters])

  // ponytail: auto-dismiss the action banner after 5s
  useEffect(() => {
    if (!actionMessage) return
    const id = setTimeout(() => setActionMessage(null), 5000)
    return () => clearTimeout(id)
  }, [actionMessage])

  function handleEdit(t: TimesheetWithProject) {
    setEditingTimesheet(t)
    setModalOpen(true)
  }

  async function handleDelete(id: string) {
    if (!(await confirmDialog('Delete this timesheet entry?'))) return
    const { error } = await deleteTimesheet(id)
    if (error) setError(error.message)
    else loadTimesheets()
  }

  async function handleCopy(text: string, label: string) {
    setActionMessage(null)
    try {
      await writeText(text)
      setActionMessage(`${label} copied.`)
    } catch {
      setError(`Could not copy the ${label.toLowerCase()}.`)
    }
  }

  async function handleToggleComplete(timesheet: TimesheetWithProject) {
    const isComplete = !timesheet.is_complete
    setUpdatingId(timesheet.id)
    setActionMessage(null)
    const { error } = await updateTimesheet(timesheet.id, { is_complete: isComplete })

    if (error) {
      setError(error.message)
    } else {
      setError(null)
      setTimesheets((current) => current
        .map((item) => item.id === timesheet.id ? { ...item, is_complete: isComplete } : item)
        .filter((item) => {
          if (filters.status === 'complete') return item.is_complete
          if (filters.status === 'incomplete') return !item.is_complete
          return true
        }))
      setActionMessage(isComplete ? 'Timesheet marked done.' : 'Timesheet marked incomplete.')
    }
    setUpdatingId(null)
  }

  // Two independent steps: flip the timesheet in-app (RLS-safe), then ask the local Claude
  // CLI to close the Jira issue. The timesheet flip stands even if the Jira step fails.
  async function handleMarkDoneAndCloseJira(timesheet: TimesheetWithProject) {
    setUpdatingId(timesheet.id)
    setError(null)
    setActionMessage(null)

    if (!timesheet.is_complete) {
      const { error } = await updateTimesheet(timesheet.id, { is_complete: true })
      if (error) {
        setError(error.message)
        setUpdatingId(null)
        return
      }
      setTimesheets((current) => current
        .map((item) => item.id === timesheet.id ? { ...item, is_complete: true } : item)
        .filter((item) => filters.status === 'incomplete' ? !item.is_complete : true))
    }

    // Live progress from the streaming claude run lands in the action banner.
    const unlisten = await listen<string>('claude-progress', (ev) => {
      setActionMessage(`Jira: ${ev.payload}`)
    })
    try {
      const out = await invoke<string>('ask_claude', {
        prompt: `Find the Jira issue for this work and transition it to Done. Work: "${timesheet.description}"`,
      })
      setActionMessage(`Timesheet marked done. Jira: ${out.slice(0, 200) || 'done.'}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg === 'CLAUDE_NOT_INSTALLED'
        ? 'Timesheet marked done. Jira not set up — open the Jira tab to connect Claude Code.'
        : `Timesheet marked done, but the Jira step failed: ${msg}`)
    } finally {
      unlisten()
      setUpdatingId(null)
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleSelectAll(checked: boolean) {
    setSelectedIds(checked ? new Set(timesheets.map((t) => t.id)) : new Set())
  }

  async function handleMarkSelectedDone() {
    const ids = [...selectedIds]
    setActionMessage(null)
    const { error } = await updateTimesheets(ids, { is_complete: true })
    if (error) {
      setError(error.message)
      return
    }
    setError(null)
    setActionMessage(`${ids.length} timesheet${ids.length === 1 ? '' : 's'} marked done.`)
    loadTimesheets()
  }

  // Opens Appsmith in a Tauri webview with a fill script injected (Rust command).
  async function handleSendToAppsmith() {
    // Same order as ROWS in the fill script, so "first n filled" maps back to these.
    const sent = timesheets.filter((t) => selectedIds.has(t.id))
    const rows = sent.map((t) => ({
      date: t.date_memo, // raw ISO — the fill script formats it for the date picker
      projectNo: t.projects?.project_no ?? '',
      description: t.description,
    }))
    setActionMessage(null)
    try {
      await invoke('open_appsmith_filler', { url: APPSMITH_URL, rowsJson: JSON.stringify(rows) })
      setActionMessage(`Appsmith opened with ${rows.length} entr${rows.length === 1 ? 'y' : 'ies'} — click "Fill" on the form page.`)
      // Fired by Rust with the number of rows the fill script actually created in msync.
      const unlisten = await listen<number>('appsmith-filled', async ({ payload: filled }) => {
        unlisten()
        const done = sent.slice(0, filled)
        const run: FillRun = {
          at: new Date().toISOString(),
          filled: done.length,
          total: sent.length,
          entries: done.map((t) => ({
            date: t.date_memo.slice(0, 10),
            projectNo: t.projects?.project_no ?? '',
            description: t.description,
          })),
        }
        const log = [run, ...fillLog].slice(0, 50)
        localStorage.setItem('appsmith_fill_log', JSON.stringify(log))
        setFillLog(log)
        if (done.length === 0) {
          setError('Appsmith fill failed — no entries were created.')
          return
        }
        const { error } = await updateTimesheets(done.map((t) => t.id), { is_complete: true })
        if (error) setError(error.message)
        else {
          setActionMessage(`Appsmith: ${done.length}/${sent.length} entries created in msync — marked done.`)
          loadTimesheets()
        }
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  function handleModalClose() {
    setModalOpen(false)
    setEditingTimesheet(null)
    loadTimesheets()
  }

  return (
    <div>
      <div class="flex items-center justify-between mb-4">
        <h1 class="text-2xl font-bold">Timesheets</h1>
        <button
          class="btn btn-primary btn-circle text-xl tooltip tooltip-left"
          data-tip="New entry"
          onClick={() => setModalOpen(true)}
        >
          +
        </button>
      </div>
      {error && (
        <div class="alert alert-error mb-4">
          <span>{error}</span>
        </div>
      )}
      {actionMessage && (
        <div class="toast toast-end toast-bottom z-50">
          <div class="alert alert-success" role="status">
            <span>{actionMessage}</span>
          </div>
        </div>
      )}
      <TimesheetFilters filters={filters} projects={projects} onChange={setFilters} />
      {selectedIds.size > 0 && (
        <div class="mb-4 flex items-center gap-3 rounded-lg bg-base-200 px-4 py-2">
          <span class="text-sm">{selectedIds.size} selected</span>
          <button class="btn btn-primary btn-sm" onClick={handleMarkSelectedDone}>
            Mark done
          </button>
          {isTauri && (
            <div class="aura aura-glow">
              <button class="btn btn-secondary btn-sm" onClick={handleSendToAppsmith}>
                Send to Msync
              </button>
            </div>
          )}
          <button class="btn btn-ghost btn-sm" onClick={() => setSelectedIds(new Set())}>
            Clear
          </button>
        </div>
      )}
      {loading ? (
        <div class="flex justify-center py-8">
          <span class="loading loading-spinner loading-md" />
        </div>
      ) : (
        <TimesheetTable
          timesheets={timesheets}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onCopyDescription={(d) => handleCopy(d, 'Description')}
          onCopySummary={(s) => handleCopy(s, 'AI summary')}
          onToggleComplete={handleToggleComplete}
          onMarkDoneAndCloseJira={handleMarkDoneAndCloseJira}
          updatingId={updatingId}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onToggleSelectAll={toggleSelectAll}
        />
      )}
      {isTauri && fillLog.length > 0 && (
        <details class="collapse collapse-arrow bg-base-200 mt-6">
          <summary class="collapse-title text-sm font-medium">
            Msync fill log ({fillLog.length} run{fillLog.length === 1 ? '' : 's'})
          </summary>
          <div class="collapse-content space-y-3 text-sm">
            <button
              class="btn btn-ghost btn-xs text-error"
              onClick={() => {
                localStorage.removeItem('appsmith_fill_log')
                setFillLog([])
              }}
            >
              Clear log
            </button>
            {fillLog.map((run) => (
              <div>
                <div class="font-medium">
                  {new Date(run.at).toLocaleString()} — {run.filled}/{run.total} created
                </div>
                <ul class="ml-5 list-disc opacity-70">
                  {run.entries.map((e) => (
                    <li>{e.date} · {e.projectNo} · {e.description}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </details>
      )}
      {modalOpen && (
        <TimesheetModal
          timesheet={editingTimesheet}
          projects={projects}
          onClose={handleModalClose}
        />
      )}
    </div>
  )
}
