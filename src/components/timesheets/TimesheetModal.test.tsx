import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/preact'
import type { GrammarLint } from '../../lib/grammar'

const { mockCheckGrammar } = vi.hoisted(() => ({ mockCheckGrammar: vi.fn() }))

// Keep the real applyLint — the point is to prove the span actually splices correctly
// through the component, not just that a mock was called.
vi.mock('../../lib/grammar', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/grammar')>()),
  checkGrammar: mockCheckGrammar,
}))

vi.mock('../../services/timesheets', () => ({
  createTimesheet: vi.fn(),
  updateTimesheet: vi.fn(),
  fetchDaySlots: vi.fn().mockResolvedValue({ data: [], error: null }),
  searchArchived: vi.fn().mockResolvedValue({ data: [] }),
}))

beforeAll(() => {
  // jsdom has no dialog implementation; the modal calls showModal() on mount. The stub must
  // set `open` like the real thing — a closed <dialog> is hidden from the accessibility tree,
  // so every by-role query inside it would come back empty.
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
    this.open = true
  })
})

const TEH_LINT: GrammarLint = { start: 6, end: 9, message: 'Did you mean “the”?', replacement: 'the' }

describe('TimesheetModal grammar check', () => {
  it('lists a lint and applies it to the description on click', async () => {
    mockCheckGrammar.mockResolvedValue([TEH_LINT])

    const { TimesheetModal } = await import('./TimesheetModal')
    render(<TimesheetModal timesheet={null} projects={[]} onClose={vi.fn()} />)

    const textarea = screen.getByLabelText(/description/i) as HTMLTextAreaElement
    fireEvent.input(textarea, { target: { value: 'Fixed teh login bug' } })

    const fix = await screen.findByRole('button', { name: /did you mean/i }, { timeout: 2000 })
    // The replacement rides in a badge-warning chip, not bare `text-warning` text (2.14:1 contrast).
    expect(fix.querySelector('.badge-warning')?.textContent).toBe('the')
    fireEvent.click(fix)

    await waitFor(() => expect(textarea.value).toBe('Fixed the login bug'))
  })

  it('hides stale lints while the text is newer than the check they came from', async () => {
    mockCheckGrammar.mockResolvedValue([TEH_LINT])

    const { TimesheetModal } = await import('./TimesheetModal')
    render(<TimesheetModal timesheet={null} projects={[]} onClose={vi.fn()} />)

    const textarea = screen.getByLabelText(/description/i) as HTMLTextAreaElement
    fireEvent.input(textarea, { target: { value: 'Fixed teh login bug' } })
    await screen.findByRole('button', { name: /did you mean/i }, { timeout: 2000 })

    // Typing again invalidates the spans — the list must disappear rather than
    // offer a fix that would splice at the wrong offset.
    mockCheckGrammar.mockResolvedValue([])
    fireEvent.input(textarea, { target: { value: 'Rewrote everything from scratch' } })

    await waitFor(() => expect(screen.queryByRole('button', { name: /did you mean/i })).toBeNull())
  })
})
