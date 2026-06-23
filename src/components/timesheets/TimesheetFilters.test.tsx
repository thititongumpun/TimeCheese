import { render, screen, fireEvent } from '@testing-library/preact'
import { describe, it, expect, vi } from 'vitest'
import { TimesheetFilters } from './TimesheetFilters'
import type { TimesheetFilters as Filters, Project } from '../../types'

const filters: Filters = {
  date_from: '2026-06-01',
  date_to: '2026-06-30',
  project_id: null,
  status: 'all',
}

const projects: Project[] = [
  { id: 'p1', project_no: 'P001', project_name: 'Alpha', is_active: true, inserted_at: '' },
]

describe('TimesheetFilters', () => {
  it('renders date inputs and filter dropdowns', () => {
    render(<TimesheetFilters filters={filters} projects={projects} onChange={vi.fn()} />)
    expect(screen.getByLabelText(/from/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/to/i)).toBeInTheDocument()
    expect(screen.getByText('All projects')).toBeInTheDocument()
    expect(screen.getByDisplayValue('All')).toBeInTheDocument()
  })

  it('renders project options in the project dropdown', () => {
    render(<TimesheetFilters filters={filters} projects={projects} onChange={vi.fn()} />)
    expect(screen.getByText('Alpha')).toBeInTheDocument()
  })

  it('calls onChange with updated status when status dropdown changes', () => {
    const onChange = vi.fn()
    render(<TimesheetFilters filters={filters} projects={[]} onChange={onChange} />)
    fireEvent.change(screen.getByDisplayValue('All'), { target: { value: 'complete' } })
    expect(onChange).toHaveBeenCalledWith({ ...filters, status: 'complete' })
  })

  it('calls onChange with updated date_from when date input changes', () => {
    const onChange = vi.fn()
    render(<TimesheetFilters filters={filters} projects={[]} onChange={onChange} />)
    fireEvent.input(screen.getByLabelText(/from/i), { target: { value: '2026-05-01' } })
    expect(onChange).toHaveBeenCalledWith({ ...filters, date_from: '2026-05-01' })
  })
})
