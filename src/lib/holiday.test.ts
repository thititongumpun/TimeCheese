import { describe, it, expect } from 'vitest'
import { upcomingHolidays, isHolidayRow, HOLIDAY_PROJECT_NAME } from './holiday'
import { ymd } from './missing-days'

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

  it('returns the whole run when the long weekend starts tomorrow', () => {
    // Mon 27 Jul 2026 -> Tue 28 + Wed 29 are both holidays
    expect(upcomingHolidays(holidays, new Date(2026, 6, 27))).toEqual([
      { date: '2026-07-28', name: 'Kings Birthday', when: 'Tomorrow' },
      { date: '2026-07-29', name: 'Day After', when: 'Wed 29 Jul' },
    ])
  })

  it('stops the run at the first non-holiday', () => {
    // Thu 30 Jul is absent from the feed, so the run ends after Wed 29
    const feed = [...holidays, { date: '2026-07-31', name: 'Not Contiguous' }]
    expect(upcomingHolidays(feed, new Date(2026, 6, 28))).toEqual([
      { date: '2026-07-28', name: 'Kings Birthday', when: 'Today' },
      { date: '2026-07-29', name: 'Day After', when: 'Tomorrow' },
    ])
  })

  it('walks across a weekend day in the feed without returning it', () => {
    // Fri 31 Jul, Sat 1 Aug, Sun 2 Aug, Mon 3 Aug all in the feed
    const feed = [
      { date: '2026-07-31', name: 'Fri Holiday' },
      { date: '2026-08-01', name: 'Sat Holiday' },
      { date: '2026-08-02', name: 'Sun Holiday' },
      { date: '2026-08-03', name: 'Mon Holiday' },
    ]
    expect(upcomingHolidays(feed, new Date(2026, 6, 31))).toEqual([
      { date: '2026-07-31', name: 'Fri Holiday', when: 'Today' },
      { date: '2026-08-03', name: 'Mon Holiday', when: 'Mon 3 Aug' },
    ])
  })

  it('caps the walk at 10 days', () => {
    // Mon 27 Jul .. Mon 10 Aug all holidays; only the first 10 days are considered,
    // minus the Sat/Sun inside them.
    const feed = Array.from({ length: 15 }, (_, i) => ({ date: ymd(new Date(2026, 6, 27 + i)), name: `H${i}` }))
    const got = upcomingHolidays(feed, new Date(2026, 6, 27))
    expect(got).toHaveLength(8)
    expect(got[got.length - 1].date).toBe('2026-08-05')
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
