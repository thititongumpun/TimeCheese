import { describe, expect, it } from 'vitest'
import { extractCardNo } from './cardno'

describe('extractCardNo', () => {
  it('picks the longest digit run from noisy OCR text', () => {
    expect(extractCardNo('CARD\nNo. 0012345678\n13/07')).toBe('0012345678')
  })

  it('returns empty string when there are no digits', () => {
    expect(extractCardNo('no digits')).toBe('')
  })
})
