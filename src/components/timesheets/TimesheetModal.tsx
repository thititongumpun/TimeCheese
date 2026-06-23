import { useState, useEffect } from 'preact/hooks'
import { createTimesheet, updateTimesheet, searchArchived, type ArchivedMatch } from '../../services/timesheets'
import type { TimesheetWithProject, Project, TimesheetInput } from '../../types'

interface Props {
  timesheet: TimesheetWithProject | null
  projects: Project[]
  onClose: () => void
}

export function TimesheetModal({ timesheet, projects, onClose }: Props) {
  const [dateMemo, setDateMemo] = useState(
    timesheet ? timesheet.date_memo.slice(0, 10) : new Date().toISOString().slice(0, 10)
  )
  const [description, setDescription] = useState(timesheet?.description ?? '')
  const [projectId, setProjectId] = useState(timesheet?.project_id ?? '')
  const [isComplete, setIsComplete] = useState(timesheet?.is_complete ?? false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<ArchivedMatch[]>([])

  // Autofill (new entries only): debounce the description, surface similar past entries.
  useEffect(() => {
    if (timesheet) return // editing — don't suggest
    const q = description.trim()
    if (q.length < 3) {
      setSuggestions([])
      return
    }
    const timer = setTimeout(async () => {
      try {
        const { data } = await searchArchived(q, 3)
        setSuggestions((data as ArchivedMatch[]) ?? [])
      } catch {
        setSuggestions([]) // worker offline / unindexed — suggestions are optional
      }
    }, 400)
    return () => clearTimeout(timer)
  }, [description, timesheet])

  async function handleSubmit(e: Event) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const payload: TimesheetInput = {
      date_memo: dateMemo,
      description,
      project_id: projectId || null,
      is_complete: isComplete,
    }
    try {
      const { error } = timesheet
        ? await updateTimesheet(timesheet.id, payload)
        : await createTimesheet(payload)
      if (error) setError(error.message)
      else onClose()
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not create the timesheet.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <dialog class="modal modal-open">
      <div class="modal-box">
        <h3 class="font-bold text-lg mb-4">
          {timesheet ? 'Edit Entry' : 'New Entry'}
        </h3>
        <form onSubmit={handleSubmit}>
          {error && (
            <div class="alert alert-error mb-4">
              <span>{error}</span>
            </div>
          )}
          <div class="form-control mb-3">
            <label class="label" for="date_memo">
              <span class="label-text">Date</span>
            </label>
            <input
              id="date_memo"
              type="date"
              class="input input-bordered"
              value={dateMemo}
              onInput={(e) => setDateMemo(e.currentTarget.value)}
              required
            />
          </div>
          <div class="form-control mb-3">
            <label class="label" for="description">
              <span class="label-text">Description</span>
            </label>
            <textarea
              id="description"
              class="textarea textarea-bordered"
              value={description}
              onInput={(e) => setDescription(e.currentTarget.value)}
              rows={3}
              required
            />
            {suggestions.length > 0 && (
              <ul class="menu menu-sm bg-base-200 rounded-box mt-1 p-1">
                <li class="menu-title text-xs">Similar past entries</li>
                {suggestions.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      class="text-left"
                      onClick={() => {
                        setDescription(s.description)
                        setSuggestions([])
                      }}
                    >
                      <span class="line-clamp-1">{s.description}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div class="form-control mb-3">
            <label class="label" for="project_id">
              <span class="label-text">Project</span>
            </label>
            <select
              id="project_id"
              class="select select-bordered"
              value={projectId}
              onChange={(e) => setProjectId(e.currentTarget.value)}
            >
              <option value="">No project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.project_name}
                </option>
              ))}
            </select>
          </div>
          <div class="form-control mb-4">
            <label class="label cursor-pointer">
              <span class="label-text">Complete</span>
              <input
                type="checkbox"
                class="checkbox"
                checked={isComplete}
                onChange={(e) => setIsComplete(e.currentTarget.checked)}
              />
            </label>
          </div>
          {timesheet?.ai_summary && (
            <div class="form-control mb-4">
              <label class="label">
                <span class="label-text">AI Summary</span>
              </label>
              <textarea
                class="textarea textarea-bordered text-base-content/60"
                value={timesheet.ai_summary}
                rows={2}
                disabled
              />
            </div>
          )}
          <div class="modal-action">
            <button type="button" class="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              class="btn btn-primary"
              disabled={loading}
            >
              {loading && <span class="loading loading-spinner loading-xs mr-2" />}
              {timesheet ? 'Save' : 'Create'}
            </button>
          </div>
        </form>
      </div>
      <div class="modal-backdrop" onClick={onClose} />
    </dialog>
  )
}
