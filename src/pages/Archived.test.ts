import { describe, it, expect } from 'vitest'
import { periodRange } from './Archived'

describe('periodRange (26th→25th cutoff)', () => {
  it('Jan–Mar 2026 spans 26 Dec 2025 to 25 Mar 2026', () => {
    expect(periodRange('2026-01', '2026-03')).toEqual({ from: '2025-12-26', to: '2026-03-25' })
  })

  it('single month covers prev-26th to this-25th', () => {
    expect(periodRange('2026-06', '2026-06')).toEqual({ from: '2026-05-26', to: '2026-06-25' })
  })

  it('handles year rollover for January start', () => {
    expect(periodRange('2026-01', '2026-01')).toEqual({ from: '2025-12-26', to: '2026-01-25' })
  })
})
