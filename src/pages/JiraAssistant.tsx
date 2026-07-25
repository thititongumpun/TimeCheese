import { useEffect, useState } from 'preact/hooks'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { writeText } from '@tauri-apps/plugin-clipboard-manager'
import { agentProvider, type AgentStatus } from '../lib/agent'

// Per-CLI setup instructions. Claude's --scope user makes the server global (visible from
// any directory); without it the default `local` scope binds the MCP to one directory and
// the app's spawned `claude` can't see it.
const SETUP = {
  claude: {
    label: 'Claude Code',
    link: 'https://claude.com/claude-code',
    linkText: 'claude.com/claude-code',
    login: 'claude',
    mcpAdd: 'claude mcp add --scope user --transport http atlassian https://mcp.atlassian.com/v1/mcp/authv2',
    authHint: 'run `claude` in a terminal, type `/mcp`, pick atlassian → Authenticate',
    verify: 'claude mcp list',
  },
  codex: {
    label: 'Codex',
    link: 'https://developers.openai.com/codex/cli',
    linkText: 'npm i -g @openai/codex',
    login: 'codex login',
    mcpAdd: 'codex mcp add atlassian --url https://mcp.atlassian.com/v1/mcp/authv2',
    authHint: 'run `codex mcp login atlassian`',
    verify: 'codex mcp list',
  },
} as const

// Canned query for the "My open tasks" button: everything assigned to me that isn't finished.
const MY_TASKS_PROMPT =
  'List my unfinished Jira issues using JQL: assignee = currentUser() AND statusCategory != Done ORDER BY updated DESC. ' +
  'Show each on one line as "KEY — summary — status (priority)". If there are none, say so. No preamble.'

export function JiraAssistant() {
  // null = still checking.
  const [status, setStatus] = useState<AgentStatus | null>(null)
  const [prompt, setPrompt] = useState('')
  const [output, setOutput] = useState('')
  const [progress, setProgress] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  async function checkStatus() {
    setStatus(null)
    try {
      setStatus(await invoke<AgentStatus>('agent_status', { provider: agentProvider.value }))
    } catch {
      // invoke throws outside the Tauri webview (plain `npm run dev`) — treat as no CLI.
      setStatus({ provider: 'none', state: 'no_cli' })
    }
  }
  // Re-check when the Settings dropdown changes, so the badge can't describe a CLI
  // we're no longer using.
  useEffect(() => { checkStatus() }, [agentProvider.value])

  async function execute(p: string) {
    const trimmed = p.trim()
    if (!trimmed) return
    setLoading(true)
    setError(null)
    setOutput('')
    setProgress([])
    const unlisten = await listen<string>('agent-progress', (ev) => {
      setProgress((cur) => [...cur, ev.payload])
    })
    try {
      // Send the stored preference, not status.provider — Rust resolves 'auto' by the same
      // deterministic rule, and 'none' isn't a valid provider on that side.
      setOutput(await invoke<string>('ask_agent', { prompt: trimmed, provider: agentProvider.value }))
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      const label = status && status.provider !== 'none' ? SETUP[status.provider].label : 'An AI CLI'
      setError(msg === 'AGENT_NOT_INSTALLED' ? `${label} is not installed on this PC.` : msg)
    } finally {
      unlisten()
      setLoading(false)
    }
  }

  function run(e: Event) {
    e.preventDefault()
    execute(prompt)
  }

  // Setup copy for the CLI that will actually run. null while checking, and when auto
  // found neither installed — those branches render their own content.
  const setup = status && status.provider !== 'none' ? SETUP[status.provider] : null

  async function copyCmd() {
    if (!setup) return
    try {
      await writeText(setup.mcpAdd)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard unavailable outside Tauri — ignore
    }
  }

  const statusMeta =
    status === null ? 'checking…' : status.state === 'ready' ? 'connected' : 'not connected'

  return (
    <div>
      <header class="flex items-end justify-between gap-4 mb-6">
        <div>
          <h1 class="font-display font-bold text-2xl">Jira</h1>
          <p class="text-sm opacity-60 font-mono">{statusMeta}</p>
        </div>
      </header>

      {status === null && (
        <div class="flex justify-center py-8">
          <span class="loading loading-spinner loading-md" />
        </div>
      )}

      {status?.state === 'no_cli' && !setup && (
        <div class="card bg-base-200 border-2 border-base-300">
          <div class="card-body">
            <h2 class="card-title text-lg">Install Claude Code or Codex</h2>
            <p class="text-sm opacity-70">
              Jira actions run through an AI CLI on this PC. Install either one — whichever
              you already pay for — then log in.
            </p>
            <ul class="list-disc pl-5 text-sm space-y-1">
              <li>
                <span class="font-medium">Claude Code</span> —{' '}
                <a class="link link-primary" href={SETUP.claude.link} target="_blank" rel="noreferrer">
                  {SETUP.claude.linkText}
                </a>, then run <code class="rounded bg-base-300 px-1">{SETUP.claude.login}</code>
              </li>
              <li>
                <span class="font-medium">Codex</span> (ChatGPT plan) —{' '}
                <code class="rounded bg-base-300 px-1">{SETUP.codex.linkText}</code>, then run{' '}
                <code class="rounded bg-base-300 px-1">{SETUP.codex.login}</code>
              </li>
            </ul>
            <p class="text-sm opacity-70">
              Already have one? Pick it under <span class="font-medium">Settings → Jira agent</span>.
            </p>
            <button class="btn btn-primary btn-sm mt-2 w-fit" onClick={checkStatus}>Re-check</button>
          </div>
        </div>
      )}

      {status?.state === 'no_cli' && setup && (
        <div class="card bg-base-200 border-2 border-base-300">
          <div class="card-body">
            <h2 class="card-title text-lg">Set up {setup.label} first</h2>
            <p class="text-sm opacity-70">
              Jira actions run through your locally-installed {setup.label} CLI. Install it,
              then log in.
            </p>
            <ol class="list-decimal pl-5 text-sm space-y-1">
              <li>
                Install from{' '}
                <a class="link link-primary" href={setup.link} target="_blank" rel="noreferrer">
                  {setup.linkText}
                </a>
              </li>
              <li>Run <code class="rounded bg-base-300 px-1">{setup.login}</code> in a terminal and log in</li>
            </ol>
            <button class="btn btn-primary btn-sm mt-2 w-fit" onClick={checkStatus}>Re-check</button>

            <details class="mt-2 text-sm">
              <summary class="cursor-pointer opacity-70">Already installed but this keeps showing?</summary>
              <div class="mt-2 space-y-2 opacity-70">
                <p>
                  Confirm it works — run{' '}
                  <code class="rounded bg-base-300 px-1">{status.provider} --version</code> in
                  a terminal. If that prints a version, this app just can't see it on its PATH.
                </p>
                <p>
                  Fix it (macOS/Linux) — link{' '}
                  <code class="rounded bg-base-300 px-1">{status.provider}</code> onto the system PATH:
                </p>
                <code class="block overflow-x-auto rounded bg-base-300 px-3 py-2 text-xs">
                  sudo ln -sf "$(which {status.provider})" /usr/local/bin/{status.provider}
                </code>
                <p>
                  On Windows, make sure the install folder is in your <span class="font-medium">System</span> PATH.
                  Then fully quit and reopen this app and click Re-check.
                </p>
              </div>
            </details>
          </div>
        </div>
      )}

      {status?.state === 'no_jira_mcp' && setup && (
        <div class="card bg-base-200 border-2 border-base-300">
          <div class="card-body">
            <h2 class="card-title text-lg">Connect Jira</h2>
            <p class="text-sm opacity-70">
              {setup.label} is installed. Add the Atlassian MCP once and log into your Jira:
            </p>
            <div class="flex items-center gap-2">
              <code class="flex-1 overflow-x-auto rounded bg-base-300 px-3 py-2 text-xs">{setup.mcpAdd}</code>
              <button class="btn btn-sm" onClick={copyCmd}>{copied ? 'Copied' : 'Copy'}</button>
            </div>
            <p class="text-sm opacity-70">
              Then authenticate (the OAuth login can't run from this app): {setup.authHint}, and
              finish the login in your browser. Verify with{' '}
              <code class="rounded bg-base-300 px-1">{setup.verify}</code> showing
              <span class="font-medium"> atlassian — Connected</span>.
            </p>
            {agentProvider.value === 'auto' && (
              <p class="text-sm opacity-70">
                Auto-detected {setup.label}. Using the other CLI? Choose it in{' '}
                <span class="font-medium">Settings → Jira agent</span>.
              </p>
            )}
            <button class="btn btn-primary btn-sm mt-2 w-fit" onClick={checkStatus}>Re-check</button>
          </div>
        </div>
      )}

      {status?.state === 'ready' && (
        <>
          <div class="badge badge-success gap-1 mb-4">✓ Jira connected via {setup?.label}</div>

          <form onSubmit={run} class="mb-4 flex flex-col gap-2">
            <textarea
              class="textarea w-full"
              rows={3}
              placeholder='Anything Jira: "Create a task in PROJ: Fix SMTP timeout" · "Add a comment to TPDP-100" · "Update PROJ-12 description" · "Transition PROJ-123 to Done"'
              value={prompt}
              onInput={(e) => setPrompt(e.currentTarget.value)}
            />
            <div class="flex gap-2">
              <button type="submit" class="btn btn-primary w-fit" disabled={loading || !prompt.trim()}>
                {loading ? <span class="loading loading-spinner loading-xs" /> : 'Run'}
              </button>
              <button
                type="button"
                class="btn btn-outline w-fit"
                disabled={loading}
                onClick={() => execute(MY_TASKS_PROMPT)}
              >
                My open tasks
              </button>
            </div>
          </form>

          {loading && (
            <div class="mb-4 rounded-lg bg-base-200 border-2 border-base-300 p-3">
              <div class="flex items-center gap-2 text-sm font-medium">
                <span class="loading loading-spinner loading-xs" />
                Working…
              </div>
              {progress.length > 0 && (
                <ul class="mt-2 space-y-1 text-sm opacity-70 font-mono">
                  {progress.map((p, i) => <li key={i}>• {p}</li>)}
                </ul>
              )}
            </div>
          )}

          {error && (
            <div class="alert alert-error mb-4">
              <span>{error}</span>
            </div>
          )}

          {output && (
            <pre class="max-h-96 overflow-auto whitespace-pre-wrap rounded-lg bg-base-200 border-2 border-base-300 p-3 text-sm font-sans">
              {output}
            </pre>
          )}
        </>
      )}
    </div>
  )
}
