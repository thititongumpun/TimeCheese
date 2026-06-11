import { fireEvent, render, screen } from '@testing-library/preact'
import { describe, expect, it, vi } from 'vitest'
import type { TimesheetWithProject } from '../../types'
import { TimesheetTable } from './TimesheetTable'

const timesheets: TimesheetWithProject[] = [
  {
    id: 't1',
    user_id: 'u1',
    date_memo: '2026-06-11T00:00:00Z',
    description: 'Prepare client report',
    project_id: 'p1',
    inserted_at: '2026-06-11T00:00:00Z',
    is_complete: false,
    ai_summary: 'Prepared the weekly client report.',
    projects: { project_name: 'Alpha', project_no: 'P001' },
  },
  {
    id: 't2',
    user_id: 'u1',
    date_memo: '2026-06-10T00:00:00Z',
    description: 'Internal meeting',
    project_id: null,
    inserted_at: '2026-06-10T00:00:00Z',
    is_complete: true,
    ai_summary: null,
    projects: null,
  },
]

function renderTable(overrides: Partial<Parameters<typeof TimesheetTable>[0]> = {}) {
  const props = {
    timesheets,
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    onCopySummary: vi.fn(),
    onToggleComplete: vi.fn(),
    ...overrides,
  }
  render(<TimesheetTable {...props} />)
  return props
}

describe('TimesheetTable', () => {
  it('bundles row actions in an actions menu', () => {
    renderTable()

    expect(screen.getByRole('button', { name: 'Actions for Prepare client report' })).toBeInTheDocument()
    expect(screen.getAllByText('Edit')).toHaveLength(2)
    expect(screen.getAllByText('Delete')).toHaveLength(2)
  })

  it('copies a row AI summary', () => {
    const props = renderTable()

    fireEvent.click(screen.getAllByText('Copy AI summary')[0])

    expect(props.onCopySummary).toHaveBeenCalledWith('Prepared the weekly client report.')
    expect(screen.getAllByText('Copy AI summary')[1]).toBeDisabled()
  })

  it('toggles completion with the correct action label', () => {
    const props = renderTable()

    fireEvent.click(screen.getByText('Mark done'))
    fireEvent.click(screen.getByText('Mark incomplete'))

    expect(props.onToggleComplete).toHaveBeenNthCalledWith(1, timesheets[0])
    expect(props.onToggleComplete).toHaveBeenNthCalledWith(2, timesheets[1])
  })

  it('renders the empty state', () => {
    renderTable({ timesheets: [] })

    expect(screen.getByText('No timesheet entries found.')).toBeInTheDocument()
  })
})
