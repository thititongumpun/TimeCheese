import { useState } from 'preact/hooks'
import type { TimesheetWithProject } from '../../types'

interface Props {
  timesheets: TimesheetWithProject[]
  onEdit: (t: TimesheetWithProject) => void
  onDelete: (id: string) => void
  onCopyDescription: (description: string) => void
  onCopySummary: (summary: string) => void
  onToggleComplete: (t: TimesheetWithProject) => void
  updatingId?: string | null
}

export function TimesheetTable({
  timesheets,
  onEdit,
  onDelete,
  onCopyDescription,
  onCopySummary,
  onToggleComplete,
  updatingId,
}: Props) {
  const [actionTimesheet, setActionTimesheet] = useState<TimesheetWithProject | null>(null)

  if (timesheets.length === 0) {
    return <p class="text-base-content/50 py-8 text-center">No timesheet entries found.</p>
  }

  return (
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
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {timesheets.map((t) => (
              <tr key={t.id}>
                <td class="whitespace-nowrap">
                  {new Date(t.date_memo).toLocaleDateString()}
                </td>
                <td class="max-w-xs">
                  <span class="line-clamp-2">{t.description}</span>
                </td>
                <td>{t.projects?.project_name ?? <span class="text-base-content/30">—</span>}</td>
                <td>
                  <input type="checkbox" class="checkbox checkbox-sm checkbox-accent" checked={t.is_complete} disabled />
                </td>
                <td class="min-w-64 max-w-md">
                  {t.ai_summary ? (
                    <p class="whitespace-pre-wrap text-sm leading-relaxed text-base-content/70">
                      {t.ai_summary}
                    </p>
                  ) : (
                    <span class="text-base-content/30">—</span>
                  )}
                </td>
                <td>
                  <button
                    class="btn btn-ghost btn-sm btn-square"
                    aria-label={`Actions for ${t.description}`}
                    onClick={() => setActionTimesheet(t)}
                  >
                    {updatingId === t.id
                      ? <span class="loading loading-spinner loading-xs" />
                      : <span class="text-lg leading-none">...</span>}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {actionTimesheet && (
        <div
          class="modal modal-open"
          role="dialog"
          aria-modal="true"
          aria-labelledby="timesheet-actions-title"
        >
          <div class="modal-box max-w-sm">
            <div class="flex items-center justify-between gap-4">
              <h2 id="timesheet-actions-title" class="text-lg font-bold">Timesheet actions</h2>
              <button
                class="btn btn-circle btn-ghost btn-sm"
                aria-label="Close timesheet actions"
                onClick={() => setActionTimesheet(null)}
              >
                X
              </button>
            </div>
            <p class="mt-2 line-clamp-2 text-sm text-base-content/60">
              {actionTimesheet.description}
            </p>
            <div class="mt-5 grid gap-2">
              <button
                class="btn btn-outline justify-start"
                disabled={updatingId === actionTimesheet.id}
                onClick={() => {
                  onToggleComplete(actionTimesheet)
                  setActionTimesheet(null)
                }}
              >
                {actionTimesheet.is_complete ? 'Mark incomplete' : 'Mark done'}
              </button>
              <button
                class="btn btn-outline justify-start"
                onClick={() => {
                  onCopyDescription(actionTimesheet.description)
                  setActionTimesheet(null)
                }}
              >
                Copy description
              </button>
              <button
                class="btn btn-outline justify-start"
                disabled={!actionTimesheet.ai_summary}
                onClick={() => {
                  if (actionTimesheet.ai_summary) onCopySummary(actionTimesheet.ai_summary)
                  setActionTimesheet(null)
                }}
              >
                Copy AI summary
              </button>
              <button
                class="btn btn-outline justify-start"
                onClick={() => {
                  onEdit(actionTimesheet)
                  setActionTimesheet(null)
                }}
              >
                Edit
              </button>
              <button
                class="btn btn-outline btn-error justify-start"
                onClick={() => {
                  onDelete(actionTimesheet.id)
                  setActionTimesheet(null)
                }}
              >
                Delete
              </button>
            </div>
          </div>
          <button
            class="modal-backdrop"
            aria-label="Close timesheet actions"
            onClick={() => setActionTimesheet(null)}
          />
        </div>
      )}
    </>
  )
}
