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
    onCopyDescription: vi.fn(),
    onCopySummary: vi.fn(),
    onToggleComplete: vi.fn(),
    onMarkDoneAndCloseJira: vi.fn(),
    selectedIds: new Set<string>(),
    onToggleSelect: vi.fn(),
    onToggleSelectAll: vi.fn(),
    ...overrides,
  }
  render(<TimesheetTable {...props} />)
  return props
}

describe('TimesheetTable', () => {
  it('opens row actions in a modal outside the table overflow container', () => {
    renderTable()

    const trigger = screen.getByRole('button', { name: 'Actions for Prepare client report' })
    fireEvent.click(trigger)

    const dialog = screen.getByRole('dialog', { name: 'Timesheet actions' })
    expect(dialog).toBeInTheDocument()
    expect(trigger.closest('.overflow-x-auto')).not.toContainElement(dialog)
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument()
  })

  it('copies a row AI summary', () => {
    const props = renderTable()

    fireEvent.click(screen.getByRole('button', { name: 'Actions for Prepare client report' }))
    fireEvent.click(screen.getByRole('button', { name: 'Copy AI summary' }))

    expect(props.onCopySummary).toHaveBeenCalledWith('Prepared the weekly client report.')
  })

  it('toggles completion with the correct action label', () => {
    const props = renderTable()

    fireEvent.click(screen.getByRole('button', { name: 'Actions for Prepare client report' }))
    fireEvent.click(screen.getByRole('button', { name: 'Mark done' }))
    fireEvent.click(screen.getByRole('button', { name: 'Actions for Internal meeting' }))
    fireEvent.click(screen.getByRole('button', { name: 'Mark incomplete' }))

    expect(props.onToggleComplete).toHaveBeenNthCalledWith(1, timesheets[0])
    expect(props.onToggleComplete).toHaveBeenNthCalledWith(2, timesheets[1])
  })

  it('renders AI summaries clamped and click-to-expand', () => {
    renderTable()

    const summary = screen.getByText('Prepared the weekly client report.')
    expect(summary).toHaveClass('line-clamp-3')
    expect(summary).toHaveClass('cursor-pointer')

    fireEvent.click(summary)
    expect(summary).not.toHaveClass('line-clamp-3')
  })

  it('renders the empty state', () => {
    renderTable({ timesheets: [] })

    expect(screen.getByText('No timesheet entries found.')).toBeInTheDocument()
  })
})
