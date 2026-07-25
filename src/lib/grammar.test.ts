import { describe, it, expect } from 'vitest'
import { applyLint } from './grammar'

describe('applyLint', () => {
  it('replaces the spanned text', () => {
    // "teh" occupies chars 6..9 of "Fixed teh login bug"
    expect(applyLint('Fixed teh login bug', { start: 6, end: 9, message: '', replacement: 'the' }))
      .toBe('Fixed the login bug')
  })

  it('deletes the span when there is no replacement', () => {
    // the duplicated "the " at chars 6..10
    expect(applyLint('Fixed the the bug', { start: 6, end: 10, message: '', replacement: null }))
      .toBe('Fixed the bug')
  })

  it('counts code points, not UTF-16 units, past an emoji', () => {
    // "🎉" is one char to Rust but two to String.slice — "teh" starts at code point 2.
    expect(applyLint('🎉 teh bug', { start: 2, end: 5, message: '', replacement: 'the' }))
      .toBe('🎉 the bug')
  })
})
