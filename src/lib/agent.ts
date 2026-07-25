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
