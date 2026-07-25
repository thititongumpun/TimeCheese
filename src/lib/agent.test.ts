import { describe, it, expect, beforeEach } from 'vitest'
import { readStoredProvider, setAgentProvider, agentProvider } from './agent'

beforeEach(() => {
  localStorage.clear()
  agentProvider.value = 'auto'
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
