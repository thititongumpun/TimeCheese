// Holiday banner: which upcoming days are public holidays needing a "Holiday" timesheet row?

import type { Holiday } from '../types'
import { ymd } from './missing-days'

// The user's existing project for holiday entries.
export const HOLIDAY_PROJECT_NAME = 'Holiday'

// Today, then tomorrow, then the rest of the consecutive run — a Tue+Wed long weekend must be
// fully offerable on the Monday, not one day at a time. The walk stops at the first date absent
// from the feed; a weekend day that IS in the feed keeps the run alive but is never returned
// itself (no timesheet row is due, matching missingWorkdays' weekend skip).
export function upcomingHolidays(
  holidays: Holiday[],
  today: Date,
): { date: string; name: string; when: string }[] {
  const found: { date: string; name: string; when: string }[] = []
  let day = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  // ponytail: 10-day ceiling on the walk so a malformed feed can't loop forever — raise it only
  // if a real run of holidays ever exceeds that.
  for (let i = 0; i < 10; i++) {
    const key = ymd(day)
    const hit = holidays.find((h) => h.date === key)
    if (!hit) {
      // Today being an ordinary day still lets tomorrow start a run; a gap after that ends it.
      if (i > 0) break
    } else if (day.getDay() !== 0 && day.getDay() !== 6) {
      const when = i === 0 ? 'Today'
        : i === 1 ? 'Tomorrow'
        : day.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
      found.push({ date: hit.date, name: hit.name, when })
    }
    day = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1)
  }
  return found
}

export function isHolidayRow(t: { projects: { project_name: string } | null }): boolean {
  return t.projects?.project_name === HOLIDAY_PROJECT_NAME
}
