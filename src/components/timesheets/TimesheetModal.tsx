import { useState, useEffect } from 'preact/hooks'
import { createTimesheet, updateTimesheet, searchArchived, type ArchivedMatch } from '../../services/timesheets'
import type { TimesheetWithProject, Project, TimesheetInput } from '../../types'

interface Props {
  timesheet: TimesheetWithProject | null
  projects: Project[]
  onClose: () => void
}

function projectLabel(p: Project): string {
  return p.project_no ? `${p.project_no} — ${p.project_name}` : p.project_name
}

export function TimesheetModal({ timesheet, projects, onClose }: Props) {
  const [dateMemo, setDateMemo] = useState(
    timesheet ? timesheet.date_memo.slice(0, 10) : new Date().toISOString().slice(0, 10)
  )
  const [description, setDescription] = useState(timesheet?.description ?? '')
  const [projectId, setProjectId] = useState(timesheet?.project_id ?? '')
  // Free-text mirror of the project picker so the native datalist can search by typing.
  const [projectQuery, setProjectQuery] = useState(() => {
    const p = projects.find((proj) => proj.id === timesheet?.project_id)
    return p ? projectLabel(p) : ''
  })
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
    const trimmedDescription = description.trim()
    if (!trimmedDescription) {
      setError('Description is required.')
      return
    }
    if (!projectId) {
      setError('Project is required.')
      return
    }
    setLoading(true)
    setError(null)
    const payload: TimesheetInput = {
      date_memo: dateMemo,
      description: trimmedDescription,
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
            <input
              id="project_id"
              class="input input-bordered"
              list="project-options"
              placeholder="Search a project…"
              value={projectQuery}
              onInput={(e) => {
                const value = e.currentTarget.value
                setProjectQuery(value)
                // Map the typed/picked label back to a real project id; '' fails validation.
                const match = projects.find((p) => projectLabel(p) === value)
                setProjectId(match ? match.id : '')
              }}
              required
            />
            <datalist id="project-options">
              {projects.map((p) => (
                <option key={p.id} value={projectLabel(p)} />
              ))}
            </datalist>
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
