import { describe, it, expect } from 'vitest'
import { sortByDate } from './sortDate'

function row(date_memo: string, start_time: string | null = null) {
  return { date_memo, start_time }
}

describe('sortByDate', () => {
  const rows = [row('2026-01-15'), row('2026-01-10'), row('2026-01-20')]

  it('sorts ascending', () => {
    expect(sortByDate(rows, 'asc').map((r) => r.date_memo)).toEqual([
      '2026-01-10', '2026-01-15', '2026-01-20',
    ])
  })

  it('sorts descending', () => {
    expect(sortByDate(rows, 'desc').map((r) => r.date_memo)).toEqual([
      '2026-01-20', '2026-01-15', '2026-01-10',
    ])
  })

  it('tiebreaks same-day rows by start_time', () => {
    const sameDay = [row('2026-01-10', '14:00'), row('2026-01-10', '09:00'), row('2026-01-10', '11:00')]
    expect(sortByDate(sameDay, 'asc').map((r) => r.start_time)).toEqual(['09:00', '11:00', '14:00'])
  })

  it('treats null start_time as earliest', () => {
    const sameDay = [row('2026-01-10', '09:00'), row('2026-01-10', null)]
    expect(sortByDate(sameDay, 'asc').map((r) => r.start_time)).toEqual([null, '09:00'])
  })

  it('does not mutate the input array', () => {
    const original = [...rows]
    sortByDate(rows, 'asc')
    expect(rows).toEqual(original)
  })
})
