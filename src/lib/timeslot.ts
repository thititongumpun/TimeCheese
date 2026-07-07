// Working-day rules: 09:00-18:00 window, 12:00-13:00 lunch not counted,
// max 8 worked hours per day, entries on the same day must not overlap.
export const DAY_START = '09:00'
export const DAY_END = '18:00'
const LUNCH_START = 12 * 60
const LUNCH_END = 13 * 60
const MAX_WORKED_MINUTES = 8 * 60

export type Slot = { start_time: string; end_time: string }

// "HH:MM" or "HH:MM:SS" (Postgres time comes back with seconds)
export function toMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

// Duration minus whatever falls inside the lunch hour.
export function workedMinutes(start: string, end: string): number {
  const s = toMinutes(start)
  const e = toMinutes(end)
  const lunch = Math.max(0, Math.min(e, LUNCH_END) - Math.max(s, LUNCH_START))
  return e - s - lunch
}

// Returns an error message, or null when the slot is valid against the
// day's other entries.
export function validateTimeslot(start: string, end: string, others: Slot[]): string | null {
  const s = toMinutes(start)
  const e = toMinutes(end)
  if (s < toMinutes(DAY_START) || e > toMinutes(DAY_END)) {
    return `Time must be within ${DAY_START}–${DAY_END}.`
  }
  if (s >= e) return 'End time must be after start time.'

  for (const o of others) {
    if (s < toMinutes(o.end_time) && e > toMinutes(o.start_time)) {
      return `Overlaps an existing entry (${o.start_time.slice(0, 5)}–${o.end_time.slice(0, 5)}).`
    }
  }

  const total = others.reduce(
    (sum, o) => sum + workedMinutes(o.start_time, o.end_time),
    workedMinutes(start, end),
  )
  if (total > MAX_WORKED_MINUTES) {
    return `Day exceeds 8 worked hours (lunch 12:00–13:00 excluded): ${(total / 60).toFixed(1)}h.`
  }
  return null
}
