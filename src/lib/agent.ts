import { signal } from '@preact/signals'

// Which CLI drives the Jira assistant. 'auto' = first installed, Claude before Codex
// (the same rule Rust applies, so the status shown always names the CLI that runs).
export const AGENT_PROVIDERS = ['auto', 'claude', 'codex'] as const
export type AgentProvider = (typeof AGENT_PROVIDERS)[number]

export const PROVIDER_LABELS: Record<AgentProvider, string> = {
  auto: 'Auto-detect',
  claude: 'Claude Code',
  codex: 'Codex',
}

const AGENT_STORAGE_KEY = 'timecheese-agent-provider'

export function readStoredProvider(): AgentProvider {
  const stored = localStorage.getItem(AGENT_STORAGE_KEY)
  if (AGENT_PROVIDERS.includes(stored as AgentProvider)) return stored as AgentProvider
  return 'auto'
}

// A signal, not plain state: the Jira page re-checks on change, so flipping the setting
// can't leave it showing a "ready" badge for a CLI it's no longer using.
export const agentProvider = signal<AgentProvider>(readStoredProvider())

export function setAgentProvider(provider: AgentProvider) {
  agentProvider.value = provider
  localStorage.setItem(AGENT_STORAGE_KEY, provider)
}

// Shape returned by the Rust `agent_status` command. `provider` is the CLI that will
// actually run — 'none' only when auto found neither installed.
export type AgentStatus = {
  provider: 'claude' | 'codex' | 'none'
  state: 'no_cli' | 'no_jira_mcp' | 'ready'
}

// Mirrors the Rust AgentUsage/AgentReply structs (#[serde(rename_all = "camelCase")]).
export type AgentUsage = {
  model: string | null
  inputTokens: number
  outputTokens: number
  costUsd: number | null
  limitWindow: string | null
  resetsAt: number | null // epoch seconds
  limited: boolean
}
export type AgentReply = { answer: string; usage: AgentUsage }

// Claude's list is exactly the aliases `claude --help` documents. Codex's is deliberately
// empty: it publishes no model list, and shipping guessed names would just produce CLI
// errors — Codex users reach models through a "Custom…" option in the UI instead.
export const MODEL_PRESETS: Record<'claude' | 'codex', string[]> = {
  claude: ['fable', 'opus', 'sonnet'],
  codex: [],
}

const AGENT_MODEL_STORAGE_KEY = 'timecheese-agent-model'

type AgentModelRecord = { claude?: string; codex?: string }

function readStoredModel(): AgentModelRecord {
  const stored = localStorage.getItem(AGENT_MODEL_STORAGE_KEY)
  if (!stored) return {}
  try {
    const parsed = JSON.parse(stored)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

// One key holding both providers' entries — switching the CLI can't carry an invalid
// model across, since each provider reads only its own slot.
export const agentModel = signal<AgentModelRecord>(readStoredModel())

export function setAgentModel(provider: 'claude' | 'codex', model: string) {
  const next = { ...agentModel.value }
  if (model) next[provider] = model
  else delete next[provider] // empty string = CLI default
  agentModel.value = next
  localStorage.setItem(AGENT_MODEL_STORAGE_KEY, JSON.stringify(next))
}

export function modelFor(provider: string): string | undefined {
  if (provider === 'claude' || provider === 'codex') return agentModel.value[provider]
  return undefined
}

export function formatTokens(n: number): string {
  if (n < 1000) return String(n)
  return `${(n / 1000).toFixed(1)}k`
}

const WINDOW_LABELS: Record<string, string> = {
  five_hour: '5h',
}

export function formatWindow(w: string): string {
  return WINDOW_LABELS[w] ?? w
}
