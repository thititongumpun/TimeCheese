import { describe, it, expect } from 'vitest'
import { formatDate } from './formatDate'

describe('formatDate', () => {
  it('formats as DD/MMMM/YYYY', () => {
    expect(formatDate('2026-08-03')).toBe('03/August/2026')
  })

  it('pads single-digit days', () => {
    expect(formatDate('2026-01-05')).toBe('05/January/2026')
  })

  it('handles a plain date string', () => {
    expect(formatDate('2026-12-25')).toBe('25/December/2026')
  })
})
