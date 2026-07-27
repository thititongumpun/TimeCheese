import type { Holiday } from '../types'

// ponytail: hardcoded R2 URL; move to VITE_HOLIDAYS_URL only if it must differ per env.
// Update holidays = re-upload holidays.json (array of { date, name }) to the R2 bucket. No rebuild.
const HOLIDAYS_URL =
  'https://pub-5c0c8cf0929a4656bf8c7b2ac4279feb.r2.dev/holidays.json'

// ponytail: the cache never expires — offline reads can be arbitrarily stale.
// Store the fetch date next to the array and re-fetch past a TTL if that ever matters.
const CACHE_KEY = 'holidays_cache'

// Offline fallback: the last successful fetch, or `error` unchanged when there is nothing cached.
function cachedOr(error: Error): { data: Holiday[] | null; error: Error | null } {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (raw) return { data: JSON.parse(raw), error: null }
  } catch { /* unreadable cache — fall through to the error */ }
  return { data: null, error }
}

export async function fetchHolidays(): Promise<{ data: Holiday[] | null; error: Error | null }> {
  try {
    const res = await fetch(HOLIDAYS_URL)
    if (!res.ok) return cachedOr(new Error(`HTTP ${res.status}`))
    const data: Holiday[] = await res.json()
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)) } catch { /* quota/private mode — cache is best-effort */ }
    return { data, error: null }
  } catch (error) {
    return cachedOr(error as Error)
  }
}
