import { describe, it, expect } from 'vitest'
import { restoreBracketTags, dropInventedTags, mergeTagGroups } from './cloudflare-ai'

describe('restoreBracketTags', () => {
  it('restores a truncated multi-tag run', () => {
    const original = '[IMP][PersonnelCost]\n- conduct SIT tests'
    const summary = '[IMP]\n- Conduct SIT tests.'
    expect(restoreBracketTags(original, summary)).toBe('[IMP][PersonnelCost]\n- Conduct SIT tests.')
  })

  it('leaves an intact run untouched', () => {
    const original = '[INVX][CICD] deploy'
    const summary = '[INVX][CICD]\n- Deploy.'
    expect(restoreBracketTags(original, summary)).toBe('[INVX][CICD]\n- Deploy.')
  })

  it('does not touch body text or single tags that survived', () => {
    const original = '[INVX] update cluster'
    const summary = '[INVX]\n- Update innovest x cluster.'
    expect(restoreBracketTags(original, summary)).toBe('[INVX]\n- Update innovest x cluster.')
  })

  it('handles multiple runs independently', () => {
    const original = '[INVX]\n[IMP][PersonnelCost]'
    const summary = '[INVX]\n[IMP]'
    expect(restoreBracketTags(original, summary)).toBe('[INVX]\n[IMP][PersonnelCost]')
  })
})

describe('mergeTagGroups', () => {
  it('folds a heading the model reprinted per entry into one group', () => {
    const summary = '[IMP]\n- Prepare the script.\n\n[IMP]\n- Redeploy the connector.\n\n[IMP]\n- Test bind mount.'
    expect(mergeTagGroups(summary)).toBe(
      '[IMP]\n- Prepare the script.\n- Redeploy the connector.\n- Test bind mount.'
    )
  })

  it('keeps a different tag run separate and preserves first-appearance order', () => {
    const summary = '[IMP][PersonnelCost]\n- Recheck upload data.\n\n[IMP]\n- Draft a plan.\n\n[IMP][PersonnelCost]\n- Sync NBC DB.'
    expect(mergeTagGroups(summary)).toBe(
      '[IMP][PersonnelCost]\n- Recheck upload data.\n- Sync NBC DB.\n\n[IMP]\n- Draft a plan.'
    )
  })

  it('drops a bullet repeated verbatim under the same tag', () => {
    expect(mergeTagGroups('[IMP]\n- Fix SFTP.\n\n[IMP]\n- Fix SFTP.')).toBe('[IMP]\n- Fix SFTP.')
  })

  it('returns untagged text unchanged', () => {
    expect(mergeTagGroups('- Just a bullet.\n- Another.')).toBe('- Just a bullet.\n- Another.')
  })
})

describe('dropInventedTags', () => {
  it('unwraps a tag the model invented', () => {
    expect(dropInventedTags('VACTION', '- Vacation from [DATE] to [DATE].'))
      .toBe('- Vacation from DATE to DATE.')
  })

  it('keeps tags that were in the original', () => {
    expect(dropInventedTags('[IMP] fix', '[IMP]\n- Fix.')).toBe('[IMP]\n- Fix.')
  })
})
