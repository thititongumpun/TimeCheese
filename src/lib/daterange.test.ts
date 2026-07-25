import { describe, it, expect } from 'vitest'
import { parseDateRange } from './daterange'

const SAT = new Date(2026, 6, 25) // Sat 25 Jul 2026

describe('parseDateRange', () => {
  it('resolves last week to the previous Monday–Sunday', () => {
    expect(parseDateRange('What did I work on last week?', SAT)).toEqual({
      from: '2026-07-13',
      to: '2026-07-19',
    })
  })

  it('resolves this week from Monday to today', () => {
    expect(parseDateRange('this week summary', SAT)).toEqual({ from: '2026-07-20', to: '2026-07-25' })
  })

  it('resolves yesterday to a single day', () => {
    expect(parseDateRange('what about yesterday', SAT)).toEqual({ from: '2026-07-24', to: '2026-07-24' })
  })

  it('resolves last month to whole previous month', () => {
    expect(parseDateRange('last month recap', SAT)).toEqual({ from: '2026-06-01', to: '2026-06-30' })
  })

  it('resolves last N days inclusive of today', () => {
    expect(parseDateRange('past 7 days', SAT)).toEqual({ from: '2026-07-19', to: '2026-07-25' })
  })

  it('returns null for topical questions', () => {
    expect(parseDateRange('what did I do on the SIT migration?', SAT)).toBeNull()
  })
})
