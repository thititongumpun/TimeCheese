// Holiday banner: is today (or tomorrow) a public holiday needing a "Holiday" timesheet row?

import type { Holiday } from '../types'
import { ymd } from './missing-days'

// The user's existing project for holiday entries.
export const HOLIDAY_PROJECT_NAME = 'Holiday'

// Today's holiday first, then tomorrow's — back-to-back holidays both need offering, so the
// caller can fall through to the next one when the first is already booked. Weekend candidates
// are skipped — no timesheet row is due, matching missingWorkdays' weekend skip.
export function upcomingHolidays(
  holidays: Holiday[],
  today: Date,
): { date: string; name: string; when: 'Today' | 'Tomorrow' }[] {
  const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)
  const found = []
  for (const [day, when] of [[today, 'Today'], [tomorrow, 'Tomorrow']] as const) {
    if (day.getDay() === 0 || day.getDay() === 6) continue
    const key = ymd(day)
    const hit = holidays.find((h) => h.date === key)
    if (hit) found.push({ date: hit.date, name: hit.name, when })
  }
  return found
}

export function isHolidayRow(t: { projects: { project_name: string } | null }): boolean {
  return t.projects?.project_name === HOLIDAY_PROJECT_NAME
}
