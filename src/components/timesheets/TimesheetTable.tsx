import { useState } from 'preact/hooks'
import type { TimesheetWithProject } from '../../types'
import { ExpandableText } from '../ExpandableText'

interface Props {
  timesheets: TimesheetWithProject[]
  onEdit: (t: TimesheetWithProject) => void
  onDelete: (id: string) => void
  onCopyDescription: (description: string) => void
  onCopySummary: (summary: string) => void
  onToggleComplete: (t: TimesheetWithProject) => void
  updatingId?: string | null
  selectedIds: Set<string>
  onToggleSelect: (id: string) => void
  onToggleSelectAll: (checked: boolean) => void
}

export function TimesheetTable({
  timesheets,
  onEdit,
  onDelete,
  onCopyDescription,
  onCopySummary,
  onToggleComplete,
  updatingId,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
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
              <th class="w-px">
                <input
                  type="checkbox"
                  class="checkbox checkbox-sm"
                  aria-label="Select all timesheets"
                  checked={selectedIds.size === timesheets.length}
                  indeterminate={selectedIds.size > 0 && selectedIds.size < timesheets.length}
                  onChange={(e) => onToggleSelectAll((e.target as HTMLInputElement).checked)}
                />
              </th>
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
              <tr key={t.id} class={selectedIds.has(t.id) ? 'bg-base-200' : undefined}>
                <td class="w-px">
                  <input
                    type="checkbox"
                    class="checkbox checkbox-sm"
                    aria-label={`Select ${t.description}`}
                    checked={selectedIds.has(t.id)}
                    onChange={() => onToggleSelect(t.id)}
                  />
                </td>
                <td class="whitespace-nowrap">
                  {new Date(t.date_memo).toLocaleDateString()}
                </td>
                <td class="max-w-xs">
                  <ExpandableText text={t.description} clampClass="line-clamp-2" />
                </td>
                <td>{t.projects?.project_name ?? <span class="text-base-content/30">—</span>}</td>
                <td>
                  <input type="checkbox" class="checkbox checkbox-sm checkbox-accent" checked={t.is_complete} disabled />
                </td>
                <td class="min-w-64 max-w-md">
                  {t.ai_summary ? (
                    <ExpandableText
                      text={t.ai_summary}
                      clampClass="line-clamp-3"
                      class="text-sm leading-relaxed text-base-content/70"
                    />
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
