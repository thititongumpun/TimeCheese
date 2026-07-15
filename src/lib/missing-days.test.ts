import { describe, it, expect } from 'vitest'
import { periodStart, missingWorkdays, ymd } from './missing-days'

describe('periodStart', () => {
  it('on or before the 26th: previous month\'s 27th', () => {
    expect(ymd(periodStart(new Date(2026, 6, 15)))).toBe('2026-06-27')
  })

  it('after the 26th: this month\'s 27th', () => {
    expect(ymd(periodStart(new Date(2026, 6, 28)))).toBe('2026-07-27')
  })
})

describe('missingWorkdays', () => {
  it('skips weekends', () => {
    // Mon 6 Jul - Sun 12 Jul 2026, nothing recorded
    const missing = missingWorkdays(new Date(2026, 6, 6), new Date(2026, 6, 12), new Set(), new Set())
    expect(missing).toEqual(['2026-07-06', '2026-07-07', '2026-07-08', '2026-07-09', '2026-07-10'])
  })

  it('skips holidays', () => {
    const missing = missingWorkdays(
      new Date(2026, 6, 6), new Date(2026, 6, 8),
      new Set(), new Set(['2026-07-07']),
    )
    expect(missing).toEqual(['2026-07-06', '2026-07-08'])
  })

  it('excludes recorded days', () => {
    const missing = missingWorkdays(
      new Date(2026, 6, 6), new Date(2026, 6, 8),
      new Set(['2026-07-07']), new Set(),
    )
    expect(missing).toEqual(['2026-07-06', '2026-07-08'])
  })

  it('returns [] when from is after to', () => {
    expect(missingWorkdays(new Date(2026, 6, 10), new Date(2026, 6, 6), new Set(), new Set())).toEqual([])
  })
})
