// "Missing days" reminder: past working days in the current cutoff period with no timesheet entry.

// Local YYYY-MM-DD — toISOString() would shift to UTC and roll the date back a day in +07.
export function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Start of the current cutoff period: the day after the previous 26th cutoff.
export function periodStart(today: Date): Date {
  const cutoffMonth = today.getDate() <= 26 ? today.getMonth() - 1 : today.getMonth()
  return new Date(today.getFullYear(), cutoffMonth, 27)
}

// Inclusive day range [from, to], skipping weekends and holidays, minus days already recorded.
export function missingWorkdays(from: Date, to: Date, recorded: Set<string>, holidays: Set<string>): string[] {
  const missing: string[] = []
  const cur = new Date(from.getFullYear(), from.getMonth(), from.getDate())
  const end = new Date(to.getFullYear(), to.getMonth(), to.getDate())
  while (cur <= end) {
    const day = cur.getDay()
    const key = ymd(cur)
    if (day !== 0 && day !== 6 && !holidays.has(key) && !recorded.has(key)) {
      missing.push(key)
    }
    cur.setDate(cur.getDate() + 1)
  }
  return missing
}
