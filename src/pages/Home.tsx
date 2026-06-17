import { useState, useEffect } from 'preact/hooks'
import { writeText } from '@tauri-apps/plugin-clipboard-manager'
import { fetchTimesheets, deleteTimesheet, updateTimesheet, updateTimesheets } from '../services/timesheets'
import { fetchActiveProjects } from '../services/projects'
import { confirmDialog } from '../lib/confirm'
import { TimesheetTable } from '../components/timesheets/TimesheetTable'
import { TimesheetFilters } from '../components/timesheets/TimesheetFilters'
import { TimesheetModal } from '../components/timesheets/TimesheetModal'
import type { TimesheetWithProject, TimesheetFilters as Filters, Project } from '../types'

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
          class="btn btn-primary btn-circle text-xl"
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
        <div class="alert alert-success mb-4" role="status">
          <span>{actionMessage}</span>
        </div>
      )}
      <TimesheetFilters filters={filters} projects={projects} onChange={setFilters} />
      {selectedIds.size > 0 && (
        <div class="mb-4 flex items-center gap-3 rounded-lg bg-base-200 px-4 py-2">
          <span class="text-sm">{selectedIds.size} selected</span>
          <button class="btn btn-primary btn-sm" onClick={handleMarkSelectedDone}>
            Mark done
          </button>
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
          updatingId={updatingId}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onToggleSelectAll={toggleSelectAll}
        />
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
