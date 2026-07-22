import { useState } from 'preact/hooks'
import type { SortDir } from '../../lib/sortDate'
import type { Project } from '../../types'

interface Props {
  projects: Project[]
  onEdit: (p: Project) => void
  onDelete: (id: string) => void
}

export function ProjectTable({ projects, onEdit, onDelete }: Props) {
  const [sortDir, setSortDir] = useState<SortDir | null>(null) // null = server order (newest first)

  if (projects.length === 0) {
    return <p class="font-mono text-sm opacity-60 py-8 text-center">No projects yet.</p>
  }

  // asc = Inactive first, desc = Active first.
  const sorted = sortDir === null
    ? projects
    : [...projects].sort((a, b) =>
        (sortDir === 'asc' ? 1 : -1) * (Number(a.is_active) - Number(b.is_active)))

  return (
    <div class="overflow-x-auto border-2 border-base-300 rounded-box">
      <table class="table">
        <thead>
          <tr class="text-xs tracking-wide uppercase opacity-60">
            <th>Project No.</th>
            <th>Project Name</th>
            <th aria-sort={sortDir === null ? 'none' : sortDir === 'asc' ? 'ascending' : 'descending'}>
              <button class="flex items-center gap-1 uppercase tracking-wide hover:opacity-100"
                      onClick={() => setSortDir(sortDir === 'desc' ? 'asc' : 'desc')}>
                Status <span aria-hidden="true">{sortDir === 'asc' ? '▲' : sortDir === 'desc' ? '▼' : '↕'}</span>
              </button>
            </th>
            <th>Created At</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((p) => (
            <tr key={p.id} class="hover:bg-base-200">
              <td class="font-mono">{p.project_no}</td>
              <td>{p.project_name}</td>
              <td>
                <span class={`badge ${p.is_active ? 'badge-success' : 'badge-ghost'}`}>
                  {p.is_active ? 'Active' : 'Inactive'}
                </span>
              </td>
              <td class="font-mono">{new Date(p.inserted_at).toLocaleDateString()}</td>
              <td class="flex gap-1">
                <button class="btn btn-ghost btn-xs" onClick={() => onEdit(p)}>
                  Edit
                </button>
                <button class="btn btn-ghost btn-xs text-error" onClick={() => onDelete(p.id)}>
                  Del
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
