import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/preact'
import type { Project } from '../types'

const m = vi.hoisted(() => ({
  fetchTimesheets: vi.fn(),
  fetchArchivedTimesheetsInRange: vi.fn(),
  deleteTimesheet: vi.fn(),
  updateTimesheet: vi.fn(),
  updateTimesheets: vi.fn(),
  createTimesheet: vi.fn(),
  fetchDaySlots: vi.fn(),
  fetchActiveProjects: vi.fn(),
  fetchHolidays: vi.fn(),
}))

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn().mockResolvedValue(vi.fn()) }))
vi.mock('@tauri-apps/plugin-clipboard-manager', () => ({ writeText: vi.fn().mockResolvedValue(undefined) }))
vi.mock('../services/timesheets', () => ({
  fetchTimesheets: m.fetchTimesheets,
  fetchArchivedTimesheetsInRange: m.fetchArchivedTimesheetsInRange,
  deleteTimesheet: m.deleteTimesheet,
  updateTimesheet: m.updateTimesheet,
  updateTimesheets: m.updateTimesheets,
  createTimesheet: m.createTimesheet,
  fetchDaySlots: m.fetchDaySlots,
}))
vi.mock('../services/projects', () => ({ fetchActiveProjects: m.fetchActiveProjects }))
vi.mock('../services/holidays', () => ({ fetchHolidays: m.fetchHolidays }))

const HOLIDAY_DATE = '2026-07-28' // Tuesday — the day after the fixed system time
const HOLIDAY_NAME = 'Asalha Puja'

const holidayProject: Project = {
  id: 'p-holiday',
  project_no: 'HOL001',
  project_name: 'Holiday',
  is_active: true,
  inserted_at: '2026-01-01T00:00:00Z',
}
const otherProject: Project = { ...holidayProject, id: 'p-1', project_no: 'PRJ001', project_name: 'Website' }

// Only Date is faked — real setTimeout/setInterval keep waitFor and the page's
// timers behaving normally.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 6, 27, 10, 0, 0)) // Mon 27 Jul 2026, local time
  vi.resetModules() // Home.tsx caches the holidays fetch at module level

  m.fetchTimesheets.mockResolvedValue({ data: [], error: null })
  m.fetchArchivedTimesheetsInRange.mockResolvedValue({ data: [], error: null })
  m.fetchDaySlots.mockResolvedValue({ data: [], error: null })
  m.createTimesheet.mockResolvedValue({ data: null, error: null })
  m.fetchActiveProjects.mockResolvedValue({ data: [otherProject, holidayProject], error: null })
  m.fetchHolidays.mockResolvedValue({ data: [{ date: HOLIDAY_DATE, name: HOLIDAY_NAME }], error: null })
})

afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
})

describe('Home holiday banner', () => {
  it('offers the holiday and creates a full-day entry on the Holiday project', async () => {
    const { Home } = await import('./Home')
    render(<Home />)

    expect(await screen.findByText(`Tomorrow is ${HOLIDAY_NAME}`)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /add to timesheet/i }))

    await waitFor(() => expect(m.createTimesheet).toHaveBeenCalledTimes(1))
    expect(m.createTimesheet).toHaveBeenCalledWith({
      date_memo: HOLIDAY_DATE,
      description: HOLIDAY_NAME,
      project_id: 'p-holiday',
      is_complete: true,
      start_time: '09:00',
      end_time: '18:00',
    }, { summarize: false }) // the holiday name must not go through the AI editor
  })

  it('offers both days of a back-to-back holiday and adds the one clicked', async () => {
    // Tue 28 Jul and Wed 29 Jul are both holidays, neither booked yet.
    vi.setSystemTime(new Date(2026, 6, 28, 10, 0, 0))
    m.fetchHolidays.mockResolvedValue({
      data: [{ date: HOLIDAY_DATE, name: HOLIDAY_NAME }, { date: '2026-07-29', name: 'Day After' }],
      error: null,
    })

    const { Home } = await import('./Home')
    render(<Home />)

    expect(await screen.findByText(`Today is ${HOLIDAY_NAME}`)).toBeTruthy()
    expect(screen.getByText('Tomorrow is Day After')).toBeTruthy()
    const buttons = screen.getAllByRole('button', { name: /add to timesheet/i })
    expect(buttons).toHaveLength(2)

    fireEvent.click(buttons[1])

    await waitFor(() => expect(m.createTimesheet).toHaveBeenCalledTimes(1))
    expect(m.createTimesheet).toHaveBeenCalledWith({
      date_memo: '2026-07-29',
      description: 'Day After',
      project_id: 'p-holiday',
      is_complete: true,
      start_time: '09:00',
      end_time: '18:00',
    }, { summarize: false })
  })

  it('offers the whole long weekend on the Monday before it', async () => {
    // Mon 27 Jul: Tue 28 + Wed 29 are a consecutive run, so both must be offered now.
    m.fetchHolidays.mockResolvedValue({
      data: [{ date: HOLIDAY_DATE, name: HOLIDAY_NAME }, { date: '2026-07-29', name: 'Day After' }],
      error: null,
    })

    const { Home } = await import('./Home')
    render(<Home />)

    expect(await screen.findByText(`Tomorrow is ${HOLIDAY_NAME}`)).toBeTruthy()
    expect(screen.getByText('Wed 29 Jul is Day After')).toBeTruthy()
    const buttons = screen.getAllByRole('button', { name: /add to timesheet/i })
    expect(buttons).toHaveLength(2)

    fireEvent.click(buttons[1])
    await waitFor(() => expect(m.createTimesheet).toHaveBeenCalledTimes(1))
    expect(m.createTimesheet.mock.calls[0][0].date_memo).toBe('2026-07-29')

    fireEvent.click(screen.getAllByRole('button', { name: /add to timesheet/i })[0])
    await waitFor(() => expect(m.createTimesheet).toHaveBeenCalledTimes(2))
    expect(m.createTimesheet.mock.calls[1][0].date_memo).toBe(HOLIDAY_DATE)
  })

  it('stays hidden when the holiday already has a timesheet row', async () => {
    m.fetchDaySlots.mockResolvedValue({
      data: [{ id: 't1', start_time: '09:00:00', end_time: '18:00:00' }],
      error: null,
    })

    const { Home } = await import('./Home')
    render(<Home />)

    await waitFor(() => expect(m.fetchDaySlots).toHaveBeenCalledWith(HOLIDAY_DATE))
    expect(screen.queryByText(`Tomorrow is ${HOLIDAY_NAME}`)).toBeNull()
    expect(screen.queryByRole('button', { name: /add to timesheet/i })).toBeNull()
  })

  it('offers tomorrow when today is a holiday that is already booked', async () => {
    // Tue 28 Jul and Wed 29 Jul are back-to-back holidays; today already has a row.
    vi.setSystemTime(new Date(2026, 6, 28, 10, 0, 0))
    m.fetchHolidays.mockResolvedValue({
      data: [{ date: HOLIDAY_DATE, name: HOLIDAY_NAME }, { date: '2026-07-29', name: 'Day After' }],
      error: null,
    })
    m.fetchDaySlots.mockImplementation((date: string) =>
      Promise.resolve({
        data: date === HOLIDAY_DATE ? [{ id: 't1', start_time: '09:00:00', end_time: '18:00:00' }] : [],
        error: null,
      }),
    )

    const { Home } = await import('./Home')
    render(<Home />)

    expect(await screen.findByText('Tomorrow is Day After')).toBeTruthy()
  })

  it('errors without creating anything when no "Holiday" project exists', async () => {
    m.fetchActiveProjects.mockResolvedValue({ data: [otherProject], error: null })

    const { Home } = await import('./Home')
    render(<Home />)

    fireEvent.click(await screen.findByRole('button', { name: /add to timesheet/i }))

    expect(await screen.findByText(/No active project named "Holiday"/)).toBeTruthy()
    expect(m.createTimesheet).not.toHaveBeenCalled()
  })
})
