import { describe, it, expect } from 'vitest'
import { upcomingHolidays, isHolidayRow, HOLIDAY_PROJECT_NAME } from './holiday'

const holidays = [
  { date: '2026-07-28', name: 'Kings Birthday' },
  { date: '2026-07-29', name: 'Day After' },
]

describe('upcomingHolidays', () => {
  it('matches today', () => {
    // Tue 28 Jul 2026
    expect(upcomingHolidays([holidays[0]], new Date(2026, 6, 28))).toEqual([
      { date: '2026-07-28', name: 'Kings Birthday', when: 'Today' },
    ])
  })

  it('matches tomorrow', () => {
    expect(upcomingHolidays([holidays[0]], new Date(2026, 6, 27))).toEqual([
      { date: '2026-07-28', name: 'Kings Birthday', when: 'Tomorrow' },
    ])
  })

  it('returns today then tomorrow when both are holidays', () => {
    expect(upcomingHolidays(holidays, new Date(2026, 6, 28))).toEqual([
      { date: '2026-07-28', name: 'Kings Birthday', when: 'Today' },
      { date: '2026-07-29', name: 'Day After', when: 'Tomorrow' },
    ])
  })

  it('returns empty when neither day is a holiday', () => {
    expect(upcomingHolidays(holidays, new Date(2026, 6, 20))).toEqual([])
  })

  it('skips a holiday falling on a weekend', () => {
    // Sat 1 Aug 2026, Sun 2 Aug 2026
    const weekend = [{ date: '2026-08-01', name: 'Sat Holiday' }, { date: '2026-08-02', name: 'Sun Holiday' }]
    expect(upcomingHolidays(weekend, new Date(2026, 7, 1))).toEqual([])
  })

  it('rolls over from Dec 31 to Jan 1', () => {
    // Thu 31 Dec 2026 -> Fri 1 Jan 2027
    expect(upcomingHolidays([{ date: '2027-01-01', name: 'New Year' }], new Date(2026, 11, 31))).toEqual([
      { date: '2027-01-01', name: 'New Year', when: 'Tomorrow' },
    ])
  })
})

describe('isHolidayRow', () => {
  it('true for the Holiday project', () => {
    expect(isHolidayRow({ projects: { project_name: HOLIDAY_PROJECT_NAME } })).toBe(true)
  })

  it('false for another project', () => {
    expect(isHolidayRow({ projects: { project_name: 'Internal' } })).toBe(false)
  })

  it('false when projects is null', () => {
    expect(isHolidayRow({ projects: null })).toBe(false)
  })
})
