import type { TimesheetWithProject } from '../../types'

interface Props {
  timesheets: TimesheetWithProject[]
  onEdit: (t: TimesheetWithProject) => void
  onDelete: (id: string) => void
  onCopySummary: (summary: string) => void
  onToggleComplete: (t: TimesheetWithProject) => void
  updatingId?: string | null
}

export function TimesheetTable({
  timesheets,
  onEdit,
  onDelete,
  onCopySummary,
  onToggleComplete,
  updatingId,
}: Props) {
  if (timesheets.length === 0) {
    return <p class="text-base-content/50 py-8 text-center">No timesheet entries found.</p>
  }

  return (
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
                <input type="checkbox" class="checkbox checkbox-sm" checked={t.is_complete} disabled />
              </td>
              <td class="max-w-xs">
                {t.ai_summary ? (
                  <div class="tooltip" data-tip={t.ai_summary}>
                    <span class="line-clamp-1 text-sm text-base-content/60">{t.ai_summary}</span>
                  </div>
                ) : (
                  <span class="text-base-content/30">—</span>
                )}
              </td>
              <td>
                <details class="dropdown dropdown-end">
                  <summary
                    class="btn btn-ghost btn-sm btn-square"
                    role="button"
                    aria-label={`Actions for ${t.description}`}
                  >
                    {updatingId === t.id
                      ? <span class="loading loading-spinner loading-xs" />
                      : <span class="text-lg leading-none">...</span>}
                  </summary>
                  <ul class="menu dropdown-content z-20 mt-1 w-48 rounded-box bg-base-100 p-2 shadow">
                    <li>
                      <button onClick={() => onToggleComplete(t)} disabled={updatingId === t.id}>
                        {t.is_complete ? 'Mark incomplete' : 'Mark done'}
                      </button>
                    </li>
                    <li>
                      <button
                        onClick={() => t.ai_summary && onCopySummary(t.ai_summary)}
                        disabled={!t.ai_summary}
                      >
                        Copy AI summary
                      </button>
                    </li>
                    <li>
                      <button onClick={() => onEdit(t)}>Edit</button>
                    </li>
                    <li>
                      <button class="text-error" onClick={() => onDelete(t.id)}>Delete</button>
                    </li>
                  </ul>
                </details>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
