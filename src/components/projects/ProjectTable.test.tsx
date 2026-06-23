import { render, screen, fireEvent } from '@testing-library/preact'
import { describe, it, expect, vi } from 'vitest'
import { ProjectTable } from './ProjectTable'
import type { Project } from '../../types'

const mockProjects: Project[] = [
  {
    id: 'p1',
    project_no: 'P001',
    project_name: 'Alpha',
    is_active: true,
    inserted_at: '2026-01-15T00:00:00Z',
  },
  {
    id: 'p2',
    project_no: 'P002',
    project_name: 'Beta',
    is_active: false,
    inserted_at: '2026-02-01T00:00:00Z',
  },
]

describe('ProjectTable', () => {
  it('renders all project rows', () => {
    render(<ProjectTable projects={mockProjects} onEdit={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.getByText('P001')).toBeInTheDocument()
    expect(screen.getByText('Alpha')).toBeInTheDocument()
    expect(screen.getByText('P002')).toBeInTheDocument()
    expect(screen.getByText('Beta')).toBeInTheDocument()
  })

  it('shows Active badge for active projects and Inactive for inactive', () => {
    render(<ProjectTable projects={mockProjects} onEdit={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.getByText('Active')).toBeInTheDocument()
    expect(screen.getByText('Inactive')).toBeInTheDocument()
  })

  it('calls onEdit with the project when Edit is clicked', () => {
    const onEdit = vi.fn()
    render(<ProjectTable projects={mockProjects} onEdit={onEdit} onDelete={vi.fn()} />)
    fireEvent.click(screen.getAllByText('Edit')[0])
    expect(onEdit).toHaveBeenCalledWith(mockProjects[0])
  })

  it('calls onDelete with project id when Del is clicked', () => {
    const onDelete = vi.fn()
    render(<ProjectTable projects={mockProjects} onEdit={vi.fn()} onDelete={onDelete} />)
    fireEvent.click(screen.getAllByText('Del')[0])
    expect(onDelete).toHaveBeenCalledWith('p1')
  })

  it('renders empty state when no projects', () => {
    render(<ProjectTable projects={[]} onEdit={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.getByText('No projects yet.')).toBeInTheDocument()
  })
})
