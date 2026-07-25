import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/preact'
import type { AgentStatus } from '../lib/agent'
import { agentProvider } from '../lib/agent'

const { mockInvoke, mockListen, mockUnlisten } = vi.hoisted(() => ({
  mockInvoke: vi.fn(),
  mockListen: vi.fn(),
  mockUnlisten: vi.fn(),
}))

vi.mock('@tauri-apps/api/core', () => ({ invoke: mockInvoke }))
vi.mock('@tauri-apps/api/event', () => ({ listen: mockListen }))
vi.mock('@tauri-apps/plugin-clipboard-manager', () => ({ writeText: vi.fn().mockResolvedValue(undefined) }))

// Route by command name so one mock serves both agent_status and ask_agent.
function wire(status: AgentStatus, answer = 'done') {
  mockInvoke.mockImplementation((cmd: string) =>
    Promise.resolve(cmd === 'agent_status' ? status : answer)
  )
}

beforeEach(() => {
  localStorage.clear()
  agentProvider.value = 'auto'
  mockInvoke.mockReset()
  mockListen.mockReset()
  mockListen.mockResolvedValue(mockUnlisten)
  mockUnlisten.mockReset()
})

describe('JiraAssistant provider setup cards', () => {
  it('offers both CLIs when neither is installed', async () => {
    // invoke throws outside the Tauri webview — the plain `npm run dev` path.
    mockInvoke.mockRejectedValue(new Error('no ipc'))

    const { JiraAssistant } = await import('./JiraAssistant')
    render(<JiraAssistant />)

    await screen.findByRole('heading', { name: /install claude code or codex/i })
    expect(screen.getByText(/claude\.com\/claude-code/)).toBeInTheDocument()
    expect(screen.getByText(/@openai\/codex/)).toBeInTheDocument()
  })

  it('shows Codex install steps when Codex is forced but missing', async () => {
    wire({ provider: 'codex', state: 'no_cli' })

    const { JiraAssistant } = await import('./JiraAssistant')
    render(<JiraAssistant />)

    await screen.findByRole('heading', { name: /set up codex first/i })
    expect(screen.getByText(/@openai\/codex/)).toBeInTheDocument()
    // The Claude card must not leak into the Codex branch.
    expect(screen.queryByText(/claude\.com/)).toBeNull()
  })

  it('shows the Codex MCP command when Jira is not connected', async () => {
    wire({ provider: 'codex', state: 'no_jira_mcp' })

    const { JiraAssistant } = await import('./JiraAssistant')
    render(<JiraAssistant />)

    await screen.findByRole('heading', { name: /connect jira/i })
    expect(
      screen.getByText('codex mcp add atlassian --url https://mcp.atlassian.com/v1/mcp/authv2')
    ).toBeInTheDocument()
    expect(screen.getByText(/codex mcp login atlassian/)).toBeInTheDocument()
  })

  it('shows the Claude MCP command for the Claude provider', async () => {
    wire({ provider: 'claude', state: 'no_jira_mcp' })

    const { JiraAssistant } = await import('./JiraAssistant')
    render(<JiraAssistant />)

    await screen.findByRole('heading', { name: /connect jira/i })
    expect(
      screen.getByText(/claude mcp add --scope user --transport http atlassian/)
    ).toBeInTheDocument()
  })

  it('runs a prompt through ask_agent with the stored provider', async () => {
    wire({ provider: 'claude', state: 'ready' }, 'PROJ-1 moved to Done')

    const { JiraAssistant } = await import('./JiraAssistant')
    render(<JiraAssistant />)

    await screen.findByText(/jira connected via claude code/i)
    fireEvent.input(screen.getByRole('textbox'), { target: { value: 'do it' } })
    fireEvent.click(screen.getByRole('button', { name: /^run$/i }))

    await screen.findByText('PROJ-1 moved to Done')
    expect(mockListen).toHaveBeenCalledWith('agent-progress', expect.any(Function))
    expect(mockInvoke).toHaveBeenCalledWith('ask_agent', { prompt: 'do it', provider: 'auto' })
    await waitFor(() => expect(mockUnlisten).toHaveBeenCalledTimes(1))
  })
})
