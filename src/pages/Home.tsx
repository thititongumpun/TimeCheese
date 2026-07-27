import { useState, useEffect } from 'preact/hooks'
import { writeText } from '@tauri-apps/plugin-clipboard-manager'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { fetchTimesheets, fetchArchivedTimesheetsInRange, deleteTimesheet, updateTimesheet, updateTimesheets, createTimesheet, fetchDaySlots } from '../services/timesheets'
import { fetchActiveProjects } from '../services/projects'
import { agentProvider, modelFor, type AgentReply } from '../lib/agent'
import { fetchHolidays } from '../services/holidays'
import { confirmDialog } from '../lib/confirm'
import { tidySummary } from '../lib/summaryText'
import { APPSMITH_URL } from '../lib/appsmith'
import { ymd, periodStart, missingWorkdays } from '../lib/missing-days'
import { isHolidayRow, upcomingHolidays, HOLIDAY_PROJECT_NAME } from '../lib/holiday'
import { validateTimeslot, DAY_START, DAY_END, type Slot } from '../lib/timeslot'
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

// Next occurrence of the 26th at 00:00 local time (this month, or next if already past).
function nextCutoff(from: Date): Date {
  const d = new Date(from.getFullYear(), from.getMonth(), 26)
  if (from >= d) d.setMonth(d.getMonth() + 1)
  return d
}

function CutoffCountdown() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(id)
  }, [])

  const target = nextCutoff(now)
  const secs = Math.max(0, Math.floor((target.getTime() - now.getTime()) / 1000))
  const days = Math.floor(secs / 86400)
  const hours = Math.floor(secs / 3600) % 24
  const mins = Math.floor(secs / 60) % 60

  const units: [string, number][] = [['days', days], ['hours', hours], ['min', mins]]

  return (
    <div class="flex flex-col items-center gap-2 mb-4">
      <span class="text-xs opacity-60">
        Timesheet cutoff — {target.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
      </span>
      <div class="grid auto-cols-max grid-flow-col gap-3 text-center text-xs">
        {units.map(([label, value]) => (
          <div key={label} class="bg-neutral rounded-box text-neutral-content flex flex-col p-2">
            <span class="countdown font-mono text-2xl">
              <span style={`--value:${value}`} aria-live="polite" aria-label={`${value}`}>{value}</span>
            </span>
            {label}
          </div>
        ))}
      </div>
    </div>
  )
}

// Holidays don't change mid-session; cache the fetch (cleared on error so a flaky feed can retry).
let holidaysCache: ReturnType<typeof fetchHolidays> | null = null

// "Mon 7 Jul" from a YYYY-MM-DD key, parsed in local time (no UTC shift).
function formatMissingDate(key: string): string {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

function MissingDaysBanner({ days, onDismiss }: { days: string[]; onDismiss: () => void }) {
  if (days.length === 0) return null
  const shown = days.slice(0, 6).map(formatMissingDate).join(', ')
  const extra = days.length > 6 ? ` and ${days.length - 6} more` : ''
  return (
    <div class="alert alert-warning mb-4">
      <span>⚠ No entries on {days.length} working day{days.length === 1 ? '' : 's'}: {shown}{extra}</span>
      <button class="btn btn-ghost btn-xs" onClick={onDismiss} aria-label="Dismiss">✕</button>
    </div>
  )
}

type Holiday = ReturnType<typeof upcomingHolidays>[number]

// One row per unbooked holiday — a long weekend needs both days addable, not one per day.
function HolidayBanner(
  { holidays, addingDate, onAdd, onDismiss }:
  { holidays: Holiday[]; addingDate: string | null; onAdd: (h: Holiday) => void; onDismiss: () => void },
) {
  if (holidays.length === 0) return null
  return (
    <div class="alert alert-info mb-4">
      <div class="flex w-full flex-col gap-2">
        {holidays.map((h) => (
          <div key={h.date} class="flex items-center justify-between gap-3">
            <span>{h.when} is {h.name}</span>
            <button class="btn btn-sm" onClick={() => onAdd(h)} disabled={addingDate !== null}>
              {addingDate === h.date && <span class="loading loading-spinner loading-xs" />}
              Add to timesheet
            </button>
          </div>
        ))}
      </div>
      <button class="btn btn-ghost btn-xs" onClick={onDismiss} aria-label="Dismiss">✕</button>
    </div>
  )
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
  const [missingDays, setMissingDays] = useState<string[]>([])
  const [missingDismissed, setMissingDismissed] = useState(false)
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [holidayDismissed, setHolidayDismissed] = useState(false)
  const [addingHolidayDate, setAddingHolidayDate] = useState<string | null>(null)

  async function loadTimesheets() {
    if (timesheets.length === 0) setLoading(true)
    setError(null)
    const { data, error } = await fetchTimesheets(filters)
    if (error) setError(error.message)
    else setTimesheets((data as TimesheetWithProject[]) ?? [])
    setSelectedIds(new Set())
    setLoading(false)
    loadMissingDays()
    loadHolidayBanner()
  }

  // Every holiday in the upcoming run that has no row yet — a long weekend must offer all its
  // days at once. One fetchDaySlots per candidate; the run is a handful of days, so no batching.
  // The check hits the DB rather than `timesheets` state so it survives a
  // reload and ignores the active filters.
  async function loadHolidayBanner() {
    holidaysCache ??= fetchHolidays().then((res) => {
      if (res.error) holidaysCache = null
      return res
    })
    const { data: feed, error: holidaysError } = await holidaysCache
    if (holidaysError) {
      setHolidays([])
      return
    }
    const unbooked: Holiday[] = []
    for (const next of upcomingHolidays(feed ?? [], new Date())) {
      const { data, error } = await fetchDaySlots(next.date)
      if (!error && (data ?? []).length === 0) unbooked.push(next)
    }
    setHolidays(unbooked)
  }

  // Past working days in the current cutoff period with zero entries. Skipped entirely
  // (no false-positive banner) if the holiday feed is down.
  async function loadMissingDays() {
    const today = new Date()
    const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1)
    const start = periodStart(today)

    holidaysCache ??= fetchHolidays().then((res) => {
      if (res.error) holidaysCache = null
      return res
    })
    const { data: holidays, error: holidaysError } = await holidaysCache
    if (holidaysError) {
      setMissingDays([])
      return
    }

    // Rows move to archived_timesheets every Sunday, so a recorded day may live in either table.
    const [current, archived] = await Promise.all([
      fetchTimesheets({
        date_from: ymd(start),
        date_to: ymd(yesterday),
        project_id: null,
        status: 'all',
      }),
      fetchArchivedTimesheetsInRange(ymd(start), ymd(yesterday)),
    ])
    if (current.error || archived.error) {
      setMissingDays([])
      return
    }

    const rows = [...(current.data ?? []), ...(archived.data ?? [])] as TimesheetWithProject[]
    const recorded = new Set(rows.map((t) => t.date_memo.slice(0, 10)))
    const holidaySet = new Set((holidays ?? []).map((h) => h.date))
    setMissingDays(missingWorkdays(start, yesterday, recorded, holidaySet))
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
      await writeText(tidySummary(text))
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

    // Live progress from the streaming agent run lands in the action banner.
    const unlisten = await listen<string>('agent-progress', (ev) => {
      setActionMessage(`Jira: ${ev.payload}`)
    })
    try {
      // 'auto' provider has no resolved model here (no agent_status probe like the Jira
      // tab has) — modelFor returns undefined for it, so the CLI's own default applies.
      const out = await invoke<AgentReply>('ask_agent', {
        prompt: `Find the Jira issue for this work and transition it to Done. Work: "${timesheet.description}"`,
        provider: agentProvider.value,
        model: modelFor(agentProvider.value),
      })
      setActionMessage(`Timesheet marked done. Jira: ${out.answer.slice(0, 200) || 'done.'}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg === 'AGENT_NOT_INSTALLED'
        ? 'Timesheet marked done. Jira not set up — open the Jira tab to connect an AI CLI.'
        : `Timesheet marked done, but the Jira step failed: ${msg}`)
    } finally {
      unlisten()
      setUpdatingId(null)
    }
  }

  // Full-day 09:00–18:00 row on the user's existing "Holiday" project.
  async function handleAddHoliday(holiday: Holiday) {
    const project = projects.find((p) => p.project_name === HOLIDAY_PROJECT_NAME)
    if (!project) {
      setError('No active project named "Holiday" — create or reactivate it on the Projects page.')
      return
    }
    setAddingHolidayDate(holiday.date)
    setError(null)
    setActionMessage(null)
    try {
      // Same no-overlap + 8h/day check the modal runs; 09:00–18:00 is exactly 8 worked hours,
      // so this only blocks when the day already has an entry.
      const { data: dayRows, error: dayError } = await fetchDaySlots(holiday.date)
      if (dayError) {
        setError(dayError.message)
        return
      }
      const others = (dayRows ?? []).filter((r): r is typeof r & Slot => !!r.start_time && !!r.end_time)
      const timeError = validateTimeslot(DAY_START, DAY_END, others)
      if (timeError) {
        setError(timeError)
        return
      }
      // No AI summary — the summarizer would rewrite the holiday's Thai name.
      const { error } = await createTimesheet({
        date_memo: holiday.date,
        description: holiday.name,
        project_id: project.id,
        is_complete: true,
        start_time: DAY_START,
        end_time: DAY_END,
      }, { summarize: false })
      if (error) {
        setError(error.message)
        return
      }
      setHolidays((current) => current.filter((h) => h.date !== holiday.date))
      setActionMessage(`${holiday.name} added to your timesheet.`)
      loadTimesheets()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the holiday entry.')
    } finally {
      setAddingHolidayDate(null)
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
    // Holiday rows are dropped — Msync fills holidays itself, sending them would double-book.
    const selected = timesheets.filter((t) => selectedIds.has(t.id))
    const sent = selected.filter((t) => !isHolidayRow(t))
    if (sent.length === 0) {
      setError('Only Holiday entries selected — Msync fills those automatically.')
      return
    }
    const skipped = selected.length - sent.length
    const rows = sent.map((t) => ({
      date: t.date_memo, // raw ISO — the fill script formats it for the date picker
      projectNo: t.projects?.project_no ?? '',
      // Non-project rows (project_no MFE260055) pick the task by this name; ignored otherwise.
      taskName: t.projects?.project_name ?? '',
      // Msync's Memo gets the AI summary; fall back to the raw description when absent.
      description: t.ai_summary || t.description,
      // "HH:MM:SS" or null (pre-v4.1.0 rows) — null leaves Msync's 09:00/18:00 defaults.
      startTime: t.start_time,
      endTime: t.end_time,
    }))
    setActionMessage(null)
    try {
      await invoke('open_appsmith_filler', { url: APPSMITH_URL, rowsJson: JSON.stringify(rows) })
      setActionMessage(`Appsmith opened with ${rows.length} entr${rows.length === 1 ? 'y' : 'ies'} — click "Fill" on the form page.${skipped ? ` — ${skipped} holiday entr${skipped === 1 ? 'y' : 'ies'} skipped.` : ''}`)
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
            description: t.ai_summary || t.description, // what was actually pasted into Memo
          })),
        }
        const log = [run, ...fillLog].slice(0, 50)
        localStorage.setItem('appsmith_fill_log', JSON.stringify(log))
        setFillLog(log)
        if (done.length === 0) {
          setError('Msync fill failed — no entries were created.')
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

  const monthLabel = filters.date_from
    ? new Date(filters.date_from + 'T00:00:00').toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
    : 'All dates'

  return (
    <div>
      <CutoffCountdown />
      {!missingDismissed && (
        <MissingDaysBanner days={missingDays} onDismiss={() => setMissingDismissed(true)} />
      )}
      {!holidayDismissed && (
        <HolidayBanner
          holidays={holidays}
          addingDate={addingHolidayDate}
          onAdd={handleAddHoliday}
          onDismiss={() => setHolidayDismissed(true)}
        />
      )}
      <header class="flex items-end justify-between gap-4 mb-6">
        <div>
          <h1 class="font-display text-2xl font-bold">Timesheets</h1>
          <p class="font-mono text-xs tracking-wide opacity-60">
            {timesheets.length} {timesheets.length === 1 ? 'entry' : 'entries'} · {monthLabel}
          </p>
        </div>
        <button class="btn btn-primary" onClick={() => setModalOpen(true)}>
          New entry
        </button>
      </header>
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
          <button class="btn btn-secondary btn-sm" onClick={handleMarkSelectedDone}>
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
      ) : timesheets.length === 0 ? (
        <div class="py-16 text-center">
          <p class="font-mono text-sm opacity-60">No entries for this period.</p>
          <button class="btn btn-ghost btn-sm mt-4" onClick={() => setModalOpen(true)}>
            New entry
          </button>
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
