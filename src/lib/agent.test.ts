import { describe, it, expect, beforeEach } from 'vitest'
import {
  readStoredProvider,
  setAgentProvider,
  agentProvider,
  formatTokens,
  formatWindow,
  setAgentModel,
  modelFor,
  agentModel,
} from './agent'

beforeEach(() => {
  localStorage.clear()
  agentProvider.value = 'auto'
  agentModel.value = {}
})

describe('agent provider preference', () => {
  it('defaults to auto when nothing is stored', () => {
    expect(readStoredProvider()).toBe('auto')
  })

  it('falls back to auto for an unknown stored value', () => {
    localStorage.setItem('timecheese-agent-provider', 'gpt5')
    expect(readStoredProvider()).toBe('auto')
  })

  it('persists to both the signal and localStorage', () => {
    setAgentProvider('codex')
    expect(agentProvider.value).toBe('codex')
    expect(localStorage.getItem('timecheese-agent-provider')).toBe('codex')
    expect(readStoredProvider()).toBe('codex')
  })
})

describe('formatTokens', () => {
  it('returns the plain number under 1000', () => {
    expect(formatTokens(4)).toBe('4')
    expect(formatTokens(999)).toBe('999')
  })

  it('formats thousands with one decimal and a k suffix', () => {
    expect(formatTokens(37500)).toBe('37.5k')
    expect(formatTokens(16162)).toBe('16.2k')
  })
})

describe('formatWindow', () => {
  it('maps known windows to a short label', () => {
    expect(formatWindow('five_hour')).toBe('5h')
  })

  it('passes unknown values through verbatim', () => {
    expect(formatWindow('weekly')).toBe('weekly')
  })
})

describe('agent model preference', () => {
  it('persists per provider without clobbering the other provider', () => {
    setAgentModel('claude', 'opus')
    setAgentModel('codex', 'gpt-5-codex')
    expect(agentModel.value).toEqual({ claude: 'opus', codex: 'gpt-5-codex' })
  })

  it('modelFor returns undefined for auto', () => {
    setAgentModel('claude', 'opus')
    expect(modelFor('auto')).toBeUndefined()
  })
})
