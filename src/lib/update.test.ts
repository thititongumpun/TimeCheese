import { describe, it, expect, beforeEach } from 'vitest'
import { formatReleaseDate, isVersionSkipped, skipVersion } from './update'

beforeEach(() => localStorage.clear())

describe('formatReleaseDate', () => {
  // Timezone-stable assertions only — the runner's locale/TZ are not pinned.
  it('formats plain ISO', () => {
    const out = formatReleaseDate('2026-07-25T06:56:56.126Z')
    expect(out).not.toContain('T')
    expect(out).not.toContain('06:56')
    expect(out).toContain('2026')
  })

  it("formats Tauri's 3-part offset", () => {
    const out = formatReleaseDate('2026-07-25 06:56:56.126 +00:00:00')
    expect(out).not.toContain('T')
    expect(out).not.toContain('06:56')
    expect(out).toContain('2026')
  })

  it('returns empty string for missing or junk input', () => {
    expect(formatReleaseDate(undefined)).toBe('')
    expect(formatReleaseDate('not a date')).toBe('')
  })
})

describe('skipped version', () => {
  it('round-trips a single version', () => {
    expect(isVersionSkipped('4.14.0')).toBe(false)
    skipVersion('4.14.0')
    expect(isVersionSkipped('4.14.0')).toBe(true)
    expect(isVersionSkipped('4.15.0')).toBe(false)
  })
})
