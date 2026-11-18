import { describe, it, expect } from 'vitest'
import { parseArgs, resolveProject } from './timesheet-cli'

const P = [
  { id: '1', project_no: 'BAY', project_name: 'Bank of Ayudhya' },
  { id: '2', project_no: 'BAY2', project_name: 'Other' },
  { id: '3', project_no: 'KBK', project_name: 'Kafka Lab' },
]

describe('resolveProject', () => {
  it('prefers exact project_no case-insensitively', () => expect(resolveProject(P, 'bay').id).toBe('1'))
  it('falls back to substring on name', () => expect(resolveProject(P, 'kafka').id).toBe('3'))
  it('throws with candidates when ambiguous', () => expect(() => resolveProject(P, 'ba')).toThrow(/Ambiguous[\s\S]*BAY2/))
  it('throws when nothing matches', () => expect(() => resolveProject(P, 'zzz')).toThrow(/No match/))
})

describe('parseArgs', () => {
  it('parses command and flags', () =>
    expect(parseArgs(['add', '--date', '2026-01-02', '--start', '09:00'])).toEqual({
      cmd: 'add', flags: { date: '2026-01-02', start: '09:00' },
    }))
  it('rejects dangling flag', () => expect(() => parseArgs(['add', '--date'])).toThrow())
})
