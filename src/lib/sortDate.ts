export type SortDir = 'asc' | 'desc'

export function sortByDate<T extends { date_memo: string; start_time?: string | null }>(
  rows: T[], dir: SortDir): T[] {
  const sign = dir === 'asc' ? 1 : -1
  return [...rows].sort((a, b) =>
    sign * (a.date_memo.localeCompare(b.date_memo) ||
            (a.start_time ?? '').localeCompare(b.start_time ?? '')))
}
