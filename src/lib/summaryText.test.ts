import { describe, it, expect } from 'vitest'
import { tidySummary } from './summaryText'

describe('tidySummary', () => {
  it('drops the blank line after the header', () => {
    expect(tidySummary('[IMP][PersonnelCost]\n\n- a\n- b\n')).toBe('[IMP][PersonnelCost]\n- a\n- b')
  })

  it('leaves already-tight text alone', () => {
    expect(tidySummary('[IMP]\n- a')).toBe('[IMP]\n- a')
  })
})
