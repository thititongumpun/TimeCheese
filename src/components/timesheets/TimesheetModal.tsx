import { useState, useEffect, useRef } from 'preact/hooks'
import { createTimesheet, updateTimesheet, fetchDaySlots, searchArchived, fetchPreviousEntryText, type ArchivedMatch } from '../../services/timesheets'
import { validateTimeslot, DAY_START, DAY_END, type Slot } from '../../lib/timeslot'
import { checkGrammar, applyLint, type GrammarLint } from '../../lib/grammar'
import { startRecording, type Recorder } from '../../lib/recorder'
import { transcribeAudio, translateToEnglish } from '../../services/cloudflare-ai'
import { DatePicker } from '../DatePicker'
import 'daisyui-timepicker'
import 'daisyui-timepicker/preact' // JSX types only, no runtime
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
  const [loadingPrevious, setLoadingPrevious] = useState(false)
  // Lints are kept with the exact text they were computed from — spans are offsets into
  // that text, so applying one against newer text would splice the wrong characters.
  const [linted, setLinted] = useState<{ text: string; lints: GrammarLint[] }>({ text: '', lints: [] })
  const [recorder, setRecorder] = useState<Recorder | null>(null)
  const [transcribing, setTranscribing] = useState(false)
  const [translating, setTranslating] = useState(false)
  const streamRef = useRef<MediaStream | null>(null)
  // Ref mirror of `recorder` so the unmount cleanup can reach the live instance.
  const recorderRef = useRef<Recorder | null>(null)

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

  // Grammar check (Harper, on-device via Rust). Runs when editing too, unlike the autofill above.
  useEffect(() => {
    const timer = setTimeout(async () => {
      const lints = await checkGrammar(description)
      setLinted({ text: description, lints })
    }, 400)
    return () => clearTimeout(timer)
  }, [description])

  // Release the mic if the modal closes mid-recording. Stopping the recorder matters on
  // the ScriptProcessor fallback, where stopping tracks alone leaves the AudioContext running.
  useEffect(() => {
    return () => {
      recorderRef.current?.stop().catch(() => {}) // blob discarded
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  async function toggleRecording() {
    if (recorder) {
      setRecorder(null)
      recorderRef.current = null
      setTranscribing(true)
      setError(null)
      try {
        const blob = await recorder.stop()
        // The blob is complete — release the mic now instead of after transcription.
        streamRef.current?.getTracks().forEach((t) => t.stop())
        streamRef.current = null
        const text = await transcribeAudio(blob)
        setDescription((prev) => (prev.trim() ? prev.trimEnd() + '\n' + text : text))
      } catch (e) {
        // Reached with the stream still live only if recorder.stop() rejected.
        streamRef.current?.getTracks().forEach((t) => t.stop())
        streamRef.current = null
        setError(e instanceof Error ? e.message : 'Transcription failed.')
      } finally {
        setTranscribing(false)
      }
      return
    }
    setError(null)
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Microphone recording is not supported in this browser.')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      try {
        const rec = startRecording(stream)
        recorderRef.current = rec
        setRecorder(rec)
      } catch (e) {
        stream.getTracks().forEach((t) => t.stop())
        streamRef.current = null
        setError(e instanceof Error ? e.message : 'Could not start recording.')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not access the microphone.')
    }
  }

  async function handleTranslate() {
    setTranslating(true)
    setError(null)
    try {
      setDescription(await translateToEnglish(description))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Translation failed.')
    } finally {
      setTranslating(false)
    }
  }

  async function usePreviousEntry() {
    setLoadingPrevious(true)
    setError(null)
    try {
      const text = await fetchPreviousEntryText()
      if (text) setDescription(text)
      else setError('No previous entry to copy from.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the previous entry.')
    } finally {
      setLoadingPrevious(false)
    }
  }

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
    <dialog
      ref={(el) => el?.showModal()}
      class="modal"
      onCancel={(e) => {
        e.preventDefault() // avoid a duplicate native "close" firing onClose again
        onClose()
      }}
    >
      <div class="modal-box">
        <h3 class="font-display font-bold text-lg mb-4">
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
            <DatePicker id="date_memo" value={dateMemo} onChange={setDateMemo} triggerClass="btn-block justify-start font-normal" />
          </div>
          <div class="grid grid-cols-2 gap-3 mb-3">
            <div class="fieldset">
              <label class="label" for="start_time">Start</label>
              <daisy-time-picker
                id="start_time"
                label="Start"
                hour-cycle="24"
                min={DAY_START}
                max={DAY_END}
                step={1800}
                value={startTime}
                onChange={(e) => setStartTime(e.currentTarget.value)}
                required
              />
            </div>
            <div class="fieldset">
              <label class="label" for="end_time">End</label>
              <daisy-time-picker
                id="end_time"
                label="End"
                hour-cycle="24"
                min={DAY_START}
                max={DAY_END}
                step={1800}
                value={endTime}
                onChange={(e) => setEndTime(e.currentTarget.value)}
                required
              />
            </div>
          </div>
          <div class="fieldset mb-3">
            <div class="flex items-center justify-between gap-2">
              <label class="label" for="description">Description</label>
              <div class="flex items-center gap-1">
                {!timesheet && (
                  <button
                    type="button"
                    class="btn btn-ghost btn-xs"
                    disabled={loadingPrevious}
                    onClick={usePreviousEntry}
                  >
                    {loadingPrevious && <span class="loading loading-spinner loading-xs" />}
                    Same as previous
                  </button>
                )}
                <button
                  type="button"
                  class={`btn btn-ghost btn-xs ${recorder ? 'text-error animate-pulse' : ''}`}
                  disabled={transcribing}
                  onClick={toggleRecording}
                >
                  {transcribing && <span class="loading loading-spinner loading-xs" />}
                  🎤 {recorder ? 'Stop' : 'Record'}
                </button>
                <button
                  type="button"
                  class="btn btn-ghost btn-xs"
                  disabled={translating || transcribing || !description.trim()}
                  onClick={handleTranslate}
                >
                  {translating && <span class="loading loading-spinner loading-xs" />}
                  → EN
                </button>
              </div>
            </div>
            {/* Grows with the text (native field-sizing) instead of standing tall and making
                the whole modal scroll. rows is the fallback where field-sizing is unsupported. */}
            <textarea
              id="description"
              class="textarea w-full resize-y field-sizing-content min-h-24 max-h-[40vh]"
              value={description}
              onInput={(e) => setDescription(e.currentTarget.value)}
              rows={4}
              required
              autofocus
            />
            {/* Chips, not stacked menus — suggestions used to push the textarea off-screen. */}
            {suggestions.length > 0 && (
              <div class="flex flex-wrap items-center gap-1 mt-1">
                <span class="text-xs opacity-60">Similar:</span>
                {suggestions.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    class="btn btn-xs btn-ghost bg-base-200 min-w-0 max-w-full"
                    title={s.description}
                    onClick={() => {
                      setDescription(s.description)
                      setSuggestions([])
                    }}
                  >
                    <span class="min-w-0 truncate">{s.description}</span>
                  </button>
                ))}
              </div>
            )}
            {linted.text === description && linted.lints.length > 0 && (
              <div class="flex flex-wrap items-center gap-1 mt-1">
                <span class="text-xs opacity-60">Grammar:</span>
                {linted.lints.map((lint, i) => (
                  <button
                    key={`${lint.start}-${lint.end}-${i}`}
                    type="button"
                    class="btn btn-xs btn-ghost bg-base-200 min-w-0 max-w-full"
                    title={lint.message}
                    onClick={() => setDescription(applyLint(description, lint))}
                  >
                    <span class="min-w-0 truncate">{lint.message}</span>
                    {lint.replacement !== null && (
                      <span class="badge badge-warning badge-xs">{lint.replacement}</span>
                    )}
                  </button>
                ))}
              </div>
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
