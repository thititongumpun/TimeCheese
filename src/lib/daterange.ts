// Relative-date phrases in Ask questions ("last week", "yesterday"). Cosine similarity
// carries no date signal, so a phrase hit routes the query to a plain date-range read
// instead of vector search. Weeks start Monday. Returns inclusive 'YYYY-MM-DD' bounds.
export type DateRange = { from: string; to: string }

const fmt = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const shift = (d: Date, days: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + days)

const monday = (d: Date) => shift(d, -((d.getDay() + 6) % 7))

export function parseDateRange(question: string, now = new Date()): DateRange | null {
  const q = question.toLowerCase()

  if (/\blast week\b/.test(q)) {
    const start = shift(monday(now), -7)
    return { from: fmt(start), to: fmt(shift(start, 6)) }
  }
  if (/\b(this|current) week\b/.test(q)) return { from: fmt(monday(now)), to: fmt(now) }
  if (/\byesterday\b/.test(q)) {
    const y = shift(now, -1)
    return { from: fmt(y), to: fmt(y) }
  }
  if (/\btoday\b/.test(q)) return { from: fmt(now), to: fmt(now) }
  if (/\blast month\b/.test(q)) {
    return {
      from: fmt(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
      to: fmt(new Date(now.getFullYear(), now.getMonth(), 0)), // day 0 = last day of previous month
    }
  }
  if (/\b(this|current) month\b/.test(q)) {
    return { from: fmt(new Date(now.getFullYear(), now.getMonth(), 1)), to: fmt(now) }
  }

  const days = q.match(/\b(?:last|past) (\d+) days\b/)
  if (days) return { from: fmt(shift(now, -Number(days[1]) + 1)), to: fmt(now) }

  return null
}
