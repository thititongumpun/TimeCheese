const KEY = 'timecheese-skipped-version'

export function formatReleaseDate(date?: string): string {
  if (!date) return ''
  // Tauri emits "2026-07-25 06:56:56.126 +00:00:00" — the 3rd offset segment breaks Date parsing.
  const d = new Date(date.replace(/([+-]\d{2}:\d{2}):\d{2}$/, '$1'))
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })
}

export function isVersionSkipped(version: string): boolean {
  return localStorage.getItem(KEY) === version
}

export function skipVersion(version: string) {
  localStorage.setItem(KEY, version)
}
