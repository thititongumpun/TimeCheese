import type { TimesheetFilters, Project } from '../../types'

interface Props {
  filters: TimesheetFilters
  projects: Project[]
  onChange: (filters: TimesheetFilters) => void
}

export function TimesheetFilters({ filters, projects, onChange }: Props) {
  return (
    <div class="flex flex-wrap gap-4 mb-4 items-end">
      <div class="fieldset">
        <label class="label" for="date_from">From</label>
        <input
          id="date_from"
          type="date"
          class="input input-sm"
          value={filters.date_from ?? ''}
          onInput={(e) => onChange({ ...filters, date_from: e.currentTarget.value || null })}
        />
      </div>
      <div class="fieldset">
        <label class="label" for="date_to">To</label>
        <input
          id="date_to"
          type="date"
          class="input input-sm"
          value={filters.date_to ?? ''}
          onInput={(e) => onChange({ ...filters, date_to: e.currentTarget.value || null })}
        />
      </div>
      <div class="fieldset">
        <label class="label" for="project_filter">Project</label>
        <select
          id="project_filter"
          class="select select-sm"
          value={filters.project_id ?? ''}
          onChange={(e) => onChange({ ...filters, project_id: e.currentTarget.value || null })}
        >
          <option value="">All projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.project_name}
            </option>
          ))}
        </select>
      </div>
      <div class="fieldset">
        <label class="label" for="status_filter">Status</label>
        <select
          id="status_filter"
          class="select select-sm"
          value={filters.status}
          onChange={(e) =>
            onChange({ ...filters, status: e.currentTarget.value as TimesheetFilters['status'] })
          }
        >
          <option value="all">All</option>
          <option value="complete">Complete</option>
          <option value="incomplete">Incomplete</option>
        </select>
      </div>
    </div>
  )
}
