import { useState, useEffect } from 'preact/hooks'
import { createTimesheet, updateTimesheet, fetchDaySlots, searchArchived, type ArchivedMatch } from '../../services/timesheets'
import { validateTimeslot, DAY_START, DAY_END, type Slot } from '../../lib/timeslot'
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
  const [startTime, setStartTime] = useState(timesheet?.start_time?.slice(0, 5) ?? DAY_START)
  const [endTime, setEndTime] = useState(timesheet?.end_time?.slice(0, 5) ?? DAY_END)
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
    try {
      // No-overlap + 8h/day check against the other entries on this date.
      const { data: dayRows, error: dayError } = await fetchDaySlots(dateMemo, timesheet?.id)
      if (dayError) {
        setError(dayError.message)
        return
      }
      const others = (dayRows ?? []).filter((r): r is typeof r & Slot => !!r.start_time && !!r.end_time)
      const timeError = validateTimeslot(startTime, endTime, others)
      if (timeError) {
        setError(timeError)
        return
      }
      const payload: TimesheetInput = {
        date_memo: dateMemo,
        description: trimmedDescription,
        project_id: projectId || null,
        is_complete: isComplete,
        start_time: startTime,
        end_time: endTime,
      }
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
          <div class="fieldset mb-3">
            <label class="label" for="date_memo">Date</label>
            <input
              id="date_memo"
              type="date"
              class="input w-full"
              value={dateMemo}
              onInput={(e) => setDateMemo(e.currentTarget.value)}
              required
            />
          </div>
          <div class="grid grid-cols-2 gap-3 mb-3">
            <div class="fieldset">
              <label class="label" for="start_time">Start</label>
              <input
                id="start_time"
                type="time"
                class="input w-full"
                min={DAY_START}
                max={DAY_END}
                value={startTime}
                onInput={(e) => setStartTime(e.currentTarget.value)}
                required
              />
            </div>
            <div class="fieldset">
              <label class="label" for="end_time">End</label>
              <input
                id="end_time"
                type="time"
                class="input w-full"
                min={DAY_START}
                max={DAY_END}
                value={endTime}
                onInput={(e) => setEndTime(e.currentTarget.value)}
                required
              />
            </div>
          </div>
          <div class="fieldset mb-3">
            <label class="label" for="description">Description</label>
            <textarea
              id="description"
              class="textarea w-full"
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
          <div class="fieldset mb-3">
            <label class="label" for="project_id">Project</label>
            <input
              id="project_id"
              class="input w-full"
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
          <div class="fieldset mb-4">
            <label class="label cursor-pointer justify-between w-full">
              <span>Complete</span>
              <input
                type="checkbox"
                class="checkbox"
                checked={isComplete}
                onChange={(e) => setIsComplete(e.currentTarget.checked)}
              />
            </label>
          </div>
          {timesheet?.ai_summary && (
            <div class="fieldset mb-4">
              <label class="label">AI Summary</label>
              <textarea
                class="textarea w-full text-base-content/60"
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
