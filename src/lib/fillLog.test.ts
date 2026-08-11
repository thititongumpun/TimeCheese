import { describe, it, expect } from 'vitest'
import { prunedRuns, FILL_LOG_MAX_AGE_MS } from './fillLog'

const NOW = new Date('2026-08-11T00:00:00.000Z').getTime()
const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

const at = (msAgo: number) => new Date(NOW - msAgo).toISOString()

describe('prunedRuns', () => {
  it('keeps a run 1 day old and a run 6 days 23 hours old', () => {
    const runs = [{ at: at(DAY) }, { at: at(6 * DAY + 23 * HOUR) }]
    expect(prunedRuns(runs, NOW)).toEqual(runs)
  })

  it('drops a run 8 days old', () => {
    expect(prunedRuns([{ at: at(8 * DAY) }], NOW)).toEqual([])
  })

  it('drops a run exactly 7 days old (boundary is exclusive)', () => {
    expect(prunedRuns([{ at: at(FILL_LOG_MAX_AGE_MS) }], NOW)).toEqual([])
  })

  it('drops a run with an unparseable timestamp', () => {
    expect(prunedRuns([{ at: 'not-a-date' }], NOW)).toEqual([])
  })

  it('preserves input order and other fields on kept runs', () => {
    const runs = [
      { at: at(HOUR), cardNo: '123' },
      { at: at(9 * DAY), cardNo: '456' },
      { at: at(2 * DAY), cardNo: '789' },
    ]
    expect(prunedRuns(runs, NOW)).toEqual([
      { at: at(HOUR), cardNo: '123' },
      { at: at(2 * DAY), cardNo: '789' },
    ])
  })

  it('returns [] for []', () => {
    expect(prunedRuns([], NOW)).toEqual([])
  })
})
