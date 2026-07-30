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

const { mockFetchPrevious } = vi.hoisted(() => ({ mockFetchPrevious: vi.fn() }))

vi.mock('../../services/timesheets', () => ({
  createTimesheet: vi.fn(),
  updateTimesheet: vi.fn(),
  fetchDaySlots: vi.fn().mockResolvedValue({ data: [], error: null }),
  searchArchived: vi.fn().mockResolvedValue({ data: [] }),
  fetchPreviousEntryText: mockFetchPrevious,
}))

const { mockTranslateToEnglish } = vi.hoisted(() => ({ mockTranslateToEnglish: vi.fn() }))

vi.mock('../../services/cloudflare-ai', () => ({
  transcribeAudio: vi.fn(),
  translateToEnglish: mockTranslateToEnglish,
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

describe('TimesheetModal "Same as previous"', () => {
  it('fills the description from the previous entry', async () => {
    mockCheckGrammar.mockResolvedValue([])
    mockFetchPrevious.mockResolvedValue('[IMP] Reviewed the deployment pipeline')

    const { TimesheetModal } = await import('./TimesheetModal')
    render(<TimesheetModal timesheet={null} projects={[]} onClose={vi.fn()} />)

    const textarea = screen.getByLabelText(/description/i) as HTMLTextAreaElement
    expect(textarea.value).toBe('')

    fireEvent.click(screen.getByRole('button', { name: /same as previous/i }))

    await waitFor(() => expect(textarea.value).toBe('[IMP] Reviewed the deployment pipeline'))
  })

  it('reports when there is nothing to copy', async () => {
    mockCheckGrammar.mockResolvedValue([])
    mockFetchPrevious.mockResolvedValue(null)

    const { TimesheetModal } = await import('./TimesheetModal')
    render(<TimesheetModal timesheet={null} projects={[]} onClose={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: /same as previous/i }))

    await screen.findByText(/no previous entry to copy from/i)
  })

  it('is hidden when editing an existing entry', async () => {
    mockCheckGrammar.mockResolvedValue([])

    const { TimesheetModal } = await import('./TimesheetModal')
    const existing = {
      id: '1',
      date_memo: '2026-07-25T00:00:00Z',
      description: 'Existing work',
      project_id: null,
      is_complete: false,
      ai_summary: null,
      start_time: null,
      end_time: null,
    } as any
    render(<TimesheetModal timesheet={existing} projects={[]} onClose={vi.fn()} />)

    // Positive control: the modal really did render in edit mode.
    expect(screen.getByRole('heading', { name: /edit entry/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /same as previous/i })).toBeNull()
  })
})

describe('TimesheetModal "→ EN" translation', () => {
  it('replaces the description with the translated text', async () => {
    mockCheckGrammar.mockResolvedValue([])
    mockTranslateToEnglish.mockResolvedValue('[IMP]\n- Test database')

    const { TimesheetModal } = await import('./TimesheetModal')
    render(<TimesheetModal timesheet={null} projects={[]} onClose={vi.fn()} />)

    const textarea = screen.getByLabelText(/description/i) as HTMLTextAreaElement
    fireEvent.input(textarea, { target: { value: 'ทดสอบฐานข้อมูล' } })

    fireEvent.click(screen.getByRole('button', { name: /→ en/i }))

    await waitFor(() => expect(textarea.value).toBe('[IMP]\n- Test database'))
  })

  it('shows an error and keeps the typed text when translation fails', async () => {
    mockCheckGrammar.mockResolvedValue([])
    mockTranslateToEnglish.mockRejectedValue(new Error('Cloudflare AI returned an empty translation.'))

    const { TimesheetModal } = await import('./TimesheetModal')
    render(<TimesheetModal timesheet={null} projects={[]} onClose={vi.fn()} />)

    const textarea = screen.getByLabelText(/description/i) as HTMLTextAreaElement
    fireEvent.input(textarea, { target: { value: 'ทดสอบฐานข้อมูล' } })

    fireEvent.click(screen.getByRole('button', { name: /→ en/i }))

    await screen.findByText(/cloudflare ai returned an empty translation/i)
    expect(textarea.value).toBe('ทดสอบฐานข้อมูล')
  })
})
