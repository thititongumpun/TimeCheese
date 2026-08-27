import { describe, it, expect } from 'vitest'
import { validateTimeslot, workedMinutes, freeGaps, remainingWorkedMinutes } from './timeslot'

describe('timeslot rules', () => {
  it('excludes lunch from worked minutes', () => {
    expect(workedMinutes('09:00', '18:00')).toBe(8 * 60)
    expect(workedMinutes('09:00', '12:00')).toBe(3 * 60)
    expect(workedMinutes('12:00', '18:00')).toBe(5 * 60)
  })

  it('allows 09:00-12:00 then 12:00-18:00 (the full 8h day)', () => {
    expect(validateTimeslot('12:00', '18:00', [{ start_time: '09:00:00', end_time: '12:00:00' }])).toBeNull()
  })

  it('rejects times outside 09:00-18:00', () => {
    expect(validateTimeslot('08:00', '10:00', [])).toMatch(/09:00–18:00/)
    expect(validateTimeslot('17:00', '18:30', [])).toMatch(/09:00–18:00/)
  })

  it('rejects end before start', () => {
    expect(validateTimeslot('14:00', '13:00', [])).toMatch(/after start/)
  })

  it('rejects overlap with an existing entry', () => {
    expect(validateTimeslot('11:00', '13:00', [{ start_time: '09:00:00', end_time: '12:00:00' }]))
      .toMatch(/Overlaps/)
  })
})

describe('freeGaps / remainingWorkedMinutes', () => {
  it('returns the full day when there are no entries', () => {
    expect(freeGaps([])).toEqual([{ start_time: '09:00', end_time: '18:00' }])
  })

  it('handles Postgres "HH:MM:SS" input', () => {
    expect(freeGaps([{ start_time: '09:00:00', end_time: '10:00:00' }])).toEqual([
      { start_time: '10:00', end_time: '18:00' },
    ])
  })

  it('finds gaps between two entries', () => {
    const gaps = freeGaps([
      { start_time: '09:00', end_time: '10:00' },
      { start_time: '11:00', end_time: '12:00' },
    ])
    expect(gaps[0]).toEqual({ start_time: '10:00', end_time: '11:00' })
    expect(gaps).toContainEqual({ start_time: '12:00', end_time: '18:00' })
  })

  it('sorts unsorted input chronologically', () => {
    const gaps = freeGaps([
      { start_time: '13:00', end_time: '14:00' },
      { start_time: '09:00', end_time: '10:00' },
    ])
    expect(gaps).toEqual([
      { start_time: '10:00', end_time: '13:00' },
      { start_time: '14:00', end_time: '18:00' },
    ])
  })

  it('merges adjacent/overlapping entries', () => {
    expect(
      freeGaps([
        { start_time: '09:00', end_time: '10:00' },
        { start_time: '10:00', end_time: '11:00' },
      ]),
    ).toEqual([{ start_time: '11:00', end_time: '18:00' }])
  })

  it('returns no gaps for a fully booked day', () => {
    expect(freeGaps([{ start_time: '09:00', end_time: '18:00' }])).toEqual([])
  })

  it('computes remaining worked minutes against the 8h budget', () => {
    expect(remainingWorkedMinutes([])).toBe(480)
    expect(remainingWorkedMinutes([{ start_time: '11:00', end_time: '14:00' }])).toBe(360)
  })
})

