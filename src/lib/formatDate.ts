const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

// DD/MMMM/YYYY, e.g. "03/August/2026" — the single source of truth for how
// dates render across the app (tables, exports, chat citations).
export function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  const day = String(d.getDate()).padStart(2, '0')
  return `${day}/${MONTHS[d.getMonth()]}/${d.getFullYear()}`
}
