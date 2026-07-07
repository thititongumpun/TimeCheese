import { useEffect, useState } from 'preact/hooks'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { writeText } from '@tauri-apps/plugin-clipboard-manager'

// --scope user makes the server global (visible from any directory). Without it the default
// `local` scope binds the MCP to one directory, and the app's spawned `claude` can't see it.
const MCP_ADD_CMD = 'claude mcp add --scope user --transport http atlassian https://mcp.atlassian.com/v1/mcp'

// Canned query for the "My open tasks" button: everything assigned to me that isn't finished.
const MY_TASKS_PROMPT =
  'List my unfinished Jira issues using JQL: assignee = currentUser() AND statusCategory != Done ORDER BY updated DESC. ' +
  'Show each on one line as "KEY — summary — status (priority)". If there are none, say so. No preamble.'

// null = still checking; otherwise one of the Rust sentinels.
type Status = null | 'no_cli' | 'no_jira_mcp' | 'ready'

export function JiraAssistant() {
  const [status, setStatus] = useState<Status>(null)
  const [prompt, setPrompt] = useState('')
  const [output, setOutput] = useState('')
  const [progress, setProgress] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  async function checkStatus() {
    setStatus(null)
    try {
      setStatus(await invoke<Status>('claude_status'))
    } catch {
      // invoke throws outside the Tauri webview (plain `npm run dev`) — treat as no CLI.
      setStatus('no_cli')
    }
  }
  useEffect(() => { checkStatus() }, [])

  async function execute(p: string) {
    const trimmed = p.trim()
    if (!trimmed) return
    setLoading(true)
    setError(null)
    setOutput('')
    setProgress([])
    const unlisten = await listen<string>('claude-progress', (ev) => {
      setProgress((cur) => [...cur, ev.payload])
    })
    try {
      setOutput(await invoke<string>('ask_claude', { prompt: trimmed }))
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg === 'CLAUDE_NOT_INSTALLED' ? 'Claude Code is not installed on this PC.' : msg)
    } finally {
      unlisten()
      setLoading(false)
    }
  }

  function run(e: Event) {
    e.preventDefault()
    execute(prompt)
  }

  async function copyCmd() {
    try {
      await writeText(MCP_ADD_CMD)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard unavailable outside Tauri — ignore
    }
  }

  return (
    <div>
      <h1 class="text-2xl font-bold mb-4">Jira</h1>

      {status === null && (
        <div class="flex justify-center py-8">
          <span class="loading loading-spinner loading-md" />
        </div>
      )}

      {status === 'no_cli' && (
        <div class="card bg-base-200">
          <div class="card-body">
            <h2 class="card-title text-lg">Set up Claude Code first</h2>
            <p class="text-sm opacity-70">
              Jira actions run through your locally-installed Claude Code CLI. Install it,
              then log in.
            </p>
            <ol class="list-decimal pl-5 text-sm space-y-1">
              <li>
                Install from{' '}
                <a class="link link-primary" href="https://claude.com/claude-code" target="_blank" rel="noreferrer">
                  claude.com/claude-code
                </a>
              </li>
              <li>Run <code class="rounded bg-base-300 px-1">claude</code> in a terminal and log in</li>
            </ol>
            <button class="btn btn-primary btn-sm mt-2 w-fit" onClick={checkStatus}>Re-check</button>

            <details class="mt-2 text-sm">
              <summary class="cursor-pointer opacity-70">Already installed but this keeps showing?</summary>
              <div class="mt-2 space-y-2 opacity-70">
                <p>
                  Confirm it works — run <code class="rounded bg-base-300 px-1">claude --version</code> in
                  a terminal. If that prints a version, this app just can't see it on its PATH.
                </p>
                <p>Fix it (macOS/Linux) — link <code class="rounded bg-base-300 px-1">claude</code> onto the system PATH:</p>
                <code class="block overflow-x-auto rounded bg-base-300 px-3 py-2 text-xs">
                  sudo ln -sf "$(which claude)" /usr/local/bin/claude
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

      {status === 'no_jira_mcp' && (
        <div class="card bg-base-200">
          <div class="card-body">
            <h2 class="card-title text-lg">Connect Jira</h2>
            <p class="text-sm opacity-70">
              Claude Code is installed. Add the Atlassian MCP once and log into your Jira:
            </p>
            <div class="flex items-center gap-2">
              <code class="flex-1 overflow-x-auto rounded bg-base-300 px-3 py-2 text-xs">{MCP_ADD_CMD}</code>
              <button class="btn btn-sm" onClick={copyCmd}>{copied ? 'Copied' : 'Copy'}</button>
            </div>
            <p class="text-sm opacity-70">
              Then authenticate (the OAuth login can't run from this app): run{' '}
              <code class="rounded bg-base-300 px-1">claude</code> in a terminal, type{' '}
              <code class="rounded bg-base-300 px-1">/mcp</code>, pick{' '}
              <span class="font-medium">atlassian → Authenticate</span>, and finish the login in
              your browser. Verify with{' '}
              <code class="rounded bg-base-300 px-1">claude mcp list</code> showing
              <span class="font-medium"> atlassian — Connected</span>.
            </p>
            <button class="btn btn-primary btn-sm mt-2 w-fit" onClick={checkStatus}>Re-check</button>
          </div>
        </div>
      )}

      {status === 'ready' && (
        <>
          <div class="badge badge-success gap-1 mb-4">✓ Jira connected</div>

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
            <div class="mb-4 rounded-lg bg-base-200 p-3">
              <div class="flex items-center gap-2 text-sm font-medium">
                <span class="loading loading-spinner loading-xs" />
                Working…
              </div>
              {progress.length > 0 && (
                <ul class="mt-2 space-y-1 text-sm opacity-70">
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
            <pre class="max-h-96 overflow-auto whitespace-pre-wrap rounded-lg bg-base-200 p-3 text-sm font-sans">
              {output}
            </pre>
          )}
        </>
      )}
    </div>
  )
}
