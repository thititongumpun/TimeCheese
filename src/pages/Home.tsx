import { useState, useEffect } from 'preact/hooks'
import { writeText } from '@tauri-apps/plugin-clipboard-manager'
import { fetchTimesheets, deleteTimesheet, updateTimesheet } from '../services/timesheets'
import { fetchActiveProjects } from '../services/projects'
import { TimesheetTable } from '../components/timesheets/TimesheetTable'
import { TimesheetFilters } from '../components/timesheets/TimesheetFilters'
import { TimesheetModal } from '../components/timesheets/TimesheetModal'
import type { TimesheetWithProject, TimesheetFilters as Filters, Project } from '../types'

function defaultFilters(): Filters {
  const now = new Date()
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return {
    date_from: firstDay.toISOString().slice(0, 10),
    date_to: lastDay.toISOString().slice(0, 10),
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

  async function loadTimesheets() {
    setLoading(true)
    setError(null)
    const { data, error } = await fetchTimesheets(filters)
    if (error) setError(error.message)
    else setTimesheets((data as TimesheetWithProject[]) ?? [])
    setLoading(false)
  }

  async function loadProjects() {
    const { data, error } = await fetchActiveProjects()
    if (error) setError(error.message)
    else setProjects((data as Project[]) ?? [])
  }

  useEffect(() => { loadProjects() }, [])
  useEffect(() => { loadTimesheets() }, [filters])

  function handleEdit(t: TimesheetWithProject) {
    setEditingTimesheet(t)
    setModalOpen(true)
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Delete this timesheet entry?')) return
    const { error } = await deleteTimesheet(id)
    if (error) setError(error.message)
    else loadTimesheets()
  }

  async function handleCopySummary(summary: string) {
    setActionMessage(null)
    try {
      await writeText(summary)
      setActionMessage('AI summary copied.')
    } catch {
      setError('Could not copy the AI summary.')
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
      {loading ? (
        <div class="flex justify-center py-8">
          <span class="loading loading-spinner loading-md" />
        </div>
      ) : (
        <TimesheetTable
          timesheets={timesheets}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onCopySummary={handleCopySummary}
          onToggleComplete={handleToggleComplete}
          updatingId={updatingId}
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
