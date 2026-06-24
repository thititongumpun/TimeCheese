# Jira Integration via Local Claude Code (MCP)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** From inside TimeSh1t, let a user mark a timesheet entry done and close its Jira issue — without building an MCP client or managing an API key in the app. Reuse each user's locally-installed `claude` CLI (Claude Code) as the engine; the Jira (Atlassian) MCP is configured once per user in *their* Claude Code config.

**Context / why:** TimeSh1t is multi-user. The app already has each user's RLS-safe Supabase session, so the timesheet `is_complete` flip stays in-app (no shared token, no Supabase MCP). The one thing the app can't do is talk to Jira — so *only* the Jira transition goes through Claude + the Atlassian MCP, which each user OAuths into their own Jira. Installing Claude Code + adding the Atlassian MCP is an accepted per-user prerequisite; the app detects when it's missing and shows setup instructions.

**Architecture:** TimeSh1t is Tauri v2. A Rust `#[tauri::command]` spawns the local `claude` CLI in headless mode (`claude -p … --output-format text`) and returns stdout. A second command reports setup status so the UI can gate. No Anthropic SDK, no MCP client, no secrets in the app. ~40 lines Rust + UI.

**Tech facts (verified):** Tauri v2 (`src-tauri/Cargo.toml` `tauri = "2"`); only existing command is `greet` in `src-tauri/src/lib.rs:2-5`, registered at `lib.rs:21` via `tauri::generate_handler![greet]`. Frontend has no `invoke()` use yet (only `getVersion` in `Sidebar.tsx`); `@tauri-apps/api ^2`, `invoke` from `@tauri-apps/api/core`. Raw `std::process::Command` in a Rust command needs no Tauri capability grant. Insert/update services live in `src/services/timesheets.ts`; routes/nav added like Notes/Ask in `App.tsx` + `src/components/Sidebar.tsx`.

---

## Per-user prerequisite (documented, not code)

Each user runs once; verify before using the feature. No Jira token ever touches TimeSh1t.

```bash
# 1. Install Claude Code (https://claude.com/claude-code), then log in:
claude
# 2. Add the official Atlassian remote MCP at USER scope (global). Default `local` scope
#    binds it to one directory; the app spawns claude elsewhere, so it MUST be user scope:
claude mcp add --scope user --transport sse atlassian https://mcp.atlassian.com/v1/sse
# 3. Authenticate interactively once — the remote MCP uses OAuth and headless `claude -p`
#    cannot log in. Run `claude`, type `/mcp`, pick atlassian → Authenticate, finish the
#    browser login, then:
claude mcp list   # atlassian should show "Connected"
# Sanity:
claude -p "list my Jira projects" --output-format text
```

---

## File Map

| Path | Action | Purpose |
|---|---|---|
| `src-tauri/src/lib.rs` | Modify | Add `ask_claude` + `claude_status` commands; register both in `generate_handler!` |
| `src/pages/JiraAssistant.tsx` | Create | New "Jira" tab: 3-way gate (install / setup / usage) |
| `src/App.tsx` | Modify | Add `<Route>` for the Jira tab (mirror Notes/Ask) |
| `src/components/Sidebar.tsx` | Modify | Add "Jira" nav link |
| `src/pages/Home.tsx` (+ timesheet table component) | Modify | "Mark done + close Jira" per-row button |
| `src/services/timesheets.ts` | Reuse | Existing update/toggle for the `is_complete` flip |
| `README.md` | Modify | "Jira integration (optional, per user)" setup steps |

---

## Tasks

### Phase 1 — Rust commands (`src-tauri/src/lib.rs`)
- [ ] Add `ask_claude(prompt: String) -> Result<String, String>`: spawn
      `claude -p <prompt> --output-format text --permission-mode bypassPermissions
      --append-system-prompt "<Jira-only instruction>"` via `std::process::Command`.
      Return stdout on success; stderr on failure. On `ErrorKind::NotFound` return the
      sentinel string `CLAUDE_NOT_INSTALLED`.
      - System prompt: *"You act on Jira via the Atlassian MCP only. Given a description or
        issue key, find the matching Jira issue and transition it to Done. The timesheet is
        handled by the TimeSh1t app — do not touch any database."*
      - `// ponytail:` comment naming the `bypassPermissions` ceiling (upgrade path:
        `--allowedTools "mcp__atlassian__*"`). Blast radius = that user's own Jira.
- [ ] Add `claude_status() -> &'static str` returning `no_cli` / `no_jira_mcp` / `ready`:
      `claude --version` (err → `no_cli`), then `claude mcp list` stdout contains
      `atlassian` → `ready`, else `no_jira_mcp`.
- [ ] Register: `tauri::generate_handler![greet, ask_claude, claude_status]`.

### Phase 2 — "Jira" tab with prerequisite gate
- [ ] Create `src/pages/JiraAssistant.tsx`. On mount call
      `invoke<string>('claude_status')` (import `invoke` from `@tauri-apps/api/core`).
- [ ] Branch on result:
      - `no_cli` → install instructions + link to https://claude.com/claude-code.
      - `no_jira_mcp` → show the `claude mcp add … atlassian …` command with a copy button
        (app already has `clipboard-manager:allow-write-text`) + a "Re-check" button.
      - `ready` → "✓ Jira connected" badge + textarea + submit calling `ask_claude`,
        output in a `<pre>`. Spinner while awaiting; errors in DaisyUI `alert-error`.
- [ ] Use Preact conventions per CLAUDE.md: `class=`, `onInput`, DaisyUI,
      `<span class="loading loading-spinner loading-xs" />` (not `btn loading`).
- [ ] Add route in `App.tsx` (`<Route path="/jira" component={JiraAssistant} />`) and a
      nav link in `src/components/Sidebar.tsx`, mirroring Notes/Ask.

### Phase 3 — Per-row "Mark done + close Jira" button
- [ ] In the timesheet table (`src/pages/Home.tsx` / table component) add the button. On
      click: (1) flip `is_complete = true` via the existing `src/services/timesheets.ts`
      update/toggle (RLS-safe, no MCP); (2) then
      `invoke<string>('ask_claude', { prompt: \`Find the Jira issue for this work and
      transition it to Done. Work: "${row.description}"\` })`.
- [ ] Row spinner while awaiting; on reject show DaisyUI `alert-error`. If
      `CLAUDE_NOT_INSTALLED`, point the user to the Jira tab. The two steps are independent:
      do NOT roll back the timesheet flip if the Jira step fails.

### Phase 4 — Docs
- [ ] `README.md`: add "Jira integration (optional, per user)" with the two prereq commands.

---

## Verification (end to end)
- [ ] **Gate: no CLI** — rename `claude` on PATH, open Jira tab → `no_cli` → install
      instructions (no hang, no raw stderr).
- [ ] **Gate: no MCP** — `claude` present, atlassian MCP absent → tab shows `mcp add`
      command + copy + Re-check.
- [ ] **Gate: ready** — after `claude mcp add atlassian …`, Re-check → usage panel + badge.
- [ ] **Action** — `npm run tauri dev`, click "Mark done + close Jira" on a real row →
      Supabase row `is_complete = true` AND the Jira issue is Done.
- [ ] **Independence** — remove atlassian MCP, click again → timesheet still flips, only the
      Jira step errors.
- [ ] `npm run test:run` stays green.

## Skipped (YAGNI — add when needed)
- Embedded Anthropic API + MCP client in the app → only for users who can't install Claude
  Code. Per-user prereq accepted; skip.
- Supabase MCP server → app flips `is_complete` itself with RLS. Add only for a pure-NL
  "Claude does everything" path.
- Streaming output / chat history → start one-shot request→response.
- Structured Jira-issue mapping (column/dropdown) → Claude resolves the issue from the
  description; add a mapping only if resolution proves flaky.
