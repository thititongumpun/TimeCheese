import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/preact'
import type { AgentStatus, AgentUsage } from '../lib/agent'
import { agentProvider, agentModel } from '../lib/agent'

const { mockInvoke, mockListen, mockUnlisten } = vi.hoisted(() => ({
  mockInvoke: vi.fn(),
  mockListen: vi.fn(),
  mockUnlisten: vi.fn(),
}))

vi.mock('@tauri-apps/api/core', () => ({ invoke: mockInvoke }))
vi.mock('@tauri-apps/api/event', () => ({ listen: mockListen }))
vi.mock('@tauri-apps/plugin-clipboard-manager', () => ({ writeText: vi.fn().mockResolvedValue(undefined) }))

const ZERO_USAGE: AgentUsage = {
  model: null,
  inputTokens: 0,
  outputTokens: 0,
  costUsd: null,
  limitWindow: null,
  resetsAt: null,
  limited: false,
}

// Route by command name so one mock serves both agent_status and ask_agent.
function wire(status: AgentStatus, answer = 'done') {
  mockInvoke.mockImplementation((cmd: string) =>
    Promise.resolve(cmd === 'agent_status' ? status : { answer, usage: ZERO_USAGE })
  )
}

beforeEach(() => {
  localStorage.clear()
  agentProvider.value = 'auto'
  agentModel.value = {}
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
    expect(mockInvoke).toHaveBeenCalledWith('ask_agent', { prompt: 'do it', provider: 'auto', model: undefined })
    await waitFor(() => expect(mockUnlisten).toHaveBeenCalledTimes(1))
  })

  it('renders the full usage line for Claude-shaped usage', async () => {
    const usage: AgentUsage = {
      model: 'claude-opus-5',
      inputTokens: 37500,
      outputTokens: 4,
      costUsd: 0.229911,
      limitWindow: 'five_hour',
      resetsAt: 1784999400,
      limited: false,
    }
    mockInvoke.mockImplementation((cmd: string) =>
      Promise.resolve(cmd === 'agent_status' ? { provider: 'claude', state: 'ready' } : { answer: 'pong', usage })
    )

    const { JiraAssistant } = await import('./JiraAssistant')
    render(<JiraAssistant />)

    await screen.findByText(/jira connected via claude code/i)
    fireEvent.input(screen.getByRole('textbox'), { target: { value: 'do it' } })
    fireEvent.click(screen.getByRole('button', { name: /^run$/i }))

    const usageP = await screen.findByText(/claude-opus-5/)
    expect(usageP.textContent).toContain('37.5k in / 4 out')
    expect(usageP.textContent).toContain('$0.23')
    expect(usageP.textContent).toContain('5h limit resets')
  })

  it('renders tokens-only usage for Codex-shaped usage without malformed separators', async () => {
    const usage: AgentUsage = {
      model: null,
      inputTokens: 16162,
      outputTokens: 5,
      costUsd: null,
      limitWindow: null,
      resetsAt: null,
      limited: false,
    }
    mockInvoke.mockImplementation((cmd: string) =>
      Promise.resolve(cmd === 'agent_status' ? { provider: 'codex', state: 'ready' } : { answer: 'pong', usage })
    )

    const { JiraAssistant } = await import('./JiraAssistant')
    render(<JiraAssistant />)

    await screen.findByText(/jira connected via codex/i)
    fireEvent.input(screen.getByRole('textbox'), { target: { value: 'do it' } })
    fireEvent.click(screen.getByRole('button', { name: /^run$/i }))

    const usageP = await screen.findByText(/16\.2k in \/ 5 out/)
    const text = usageP.textContent ?? ''
    expect(text).not.toContain('$')
    expect(text).not.toContain('resets')
    expect(text.startsWith('·')).toBe(false)
    expect(text.endsWith('·')).toBe(false)
    expect(text).not.toContain('· ·')
  })

  it('prefills the custom box with the stored model when switching to Custom…', async () => {
    agentModel.value = { claude: 'opus' }
    wire({ provider: 'claude', state: 'ready' }, 'ok')

    const { JiraAssistant } = await import('./JiraAssistant')
    render(<JiraAssistant />)

    await screen.findByText(/jira connected via claude code/i)
    // Let the model-choice derivation effect commit (see the test below).
    await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)))
    fireEvent.input(screen.getByLabelText(/model/i), { target: { value: 'custom' } })

    const box = await screen.findByPlaceholderText<HTMLInputElement>(/model name/i)
    expect(box.value).toBe('opus')
  })

  it('persists a custom model and sends it on the next ask_agent call', async () => {
    wire({ provider: 'claude', state: 'ready' }, 'ok')

    const { JiraAssistant } = await import('./JiraAssistant')
    render(<JiraAssistant />)

    await screen.findByText(/jira connected via claude code/i)
    // The model-choice derivation effect (keyed on status.provider) is a useEffect that
    // commits asynchronously, after the "ready" text is already on screen — give it a tick
    // to run, or it fires after our selection below and clobbers it back to ''.
    await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)))
    fireEvent.input(screen.getByLabelText(/model/i), { target: { value: 'custom' } })
    fireEvent.input(await screen.findByPlaceholderText(/model name/i), { target: { value: 'my-custom-model' } })

    expect(agentModel.value.claude).toBe('my-custom-model')
    expect(localStorage.getItem('timecheese-agent-model')).toBe(
      JSON.stringify({ claude: 'my-custom-model' })
    )

    fireEvent.input(screen.getByPlaceholderText(/anything jira/i), { target: { value: 'do it' } })
    fireEvent.click(screen.getByRole('button', { name: /^run$/i }))

    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith('ask_agent', expect.objectContaining({ model: 'my-custom-model' }))
    )
  })
})
