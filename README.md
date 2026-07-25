# TimeCheese

A desktop timesheet tracker built with Tauri 2.0, Preact, and Supabase. Log work entries against projects, mark them complete, browse archived entries, and view the company holiday calendar.

## Stack

- **Shell:** Tauri 2.0 (Rust hosts the window; all logic is TypeScript)
- **UI:** Preact + `preact-iso` routing, Preact Signals for auth state
- **Styling:** Tailwind CSS v4 + DaisyUI v5
- **Backend:** Supabase (Postgres + Auth, RLS scoped to `auth.uid()`)
- **AI:** Cloudflare Worker (`AI` binding) cleans up timesheet descriptions

## Features

- Timesheet entry with project assignment, per-entry working hours (start/end times, validated 09:00–18:00 / max 8h/day), and complete/incomplete status
- Offline grammar check — spelling and grammar problems in the timesheet description appear as a clickable list while you type; click a suggestion to apply it. Powered by Harper compiled into the Rust binary — no API key, no config, no network, nothing typed leaves the machine. Runs before save, so the stored `description` is corrected too, not just the AI summary
- Project management
- Archived timesheets view with pagination
- Holiday calendar — interactive `vanilla-calendar-pro` view plus a table; click a table row to jump the calendar to that holiday. Dates load from a public `holidays.json` on Cloudflare R2 (edit the file and re-upload, no rebuild)
- Auto-update via Tauri updater; light/dark theme

## Setup

Copy `.env.local` with real values before running:

```
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
VITE_CLOUDFLARE_AI_URL=<deployed-worker-url>
```

Users are provisioned via the Supabase dashboard — there is no sign-up flow.

## Commands

```bash
npm run dev          # Vite only (browser, no Tauri window)
npm run tauri dev    # Desktop app (Tauri + Vite)
npm run build        # tsc + vite build
npm run tauri build  # Full desktop bundle
npm test             # Vitest (watch)
npm run test:run     # Vitest (single run, CI)
```

## Database

Two tables, both with RLS (`auth.uid() = user_id`):

- **`projects`** — `id`, `user_id`, `project_no`, `project_name`, `is_active`, `inserted_at`
- **`timesheets`** — `id`, `user_id`, `date_memo`, `description`, `project_id` (FK → projects), `is_complete`, `inserted_at`, `start_time`/`end_time` (nullable — null on pre-v4.1.0 rows), `ai_summary` (populated externally by the Worker, never written by the app)

Holiday dates are served as `holidays.json` from a public Cloudflare R2 bucket (not the database).

## Cloudflare AI

Deploy the included Worker, then set `VITE_CLOUDFLARE_AI_URL` to its URL:

```bash
npx wrangler deploy
```

The Worker uses the `AI` binding in `wrangler.toml` and returns the corrected timesheet description as `summary`. `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` are only needed by Wrangler during deployment; do not expose the API token through a `VITE_` environment variable.

## Jira integration (optional, per user)

The **Jira** tab and the per-row "Mark done + close Jira" action drive Jira through each
user's locally-installed Claude Code CLI — no Jira token is stored in TimeCheese. The timesheet
`is_complete` flip happens in-app (RLS-safe); only the Jira transition goes through Claude +
the Atlassian MCP. Each user sets this up once:

```bash
# 1. Install Claude Code (https://claude.com/claude-code), then log in:
claude
# 2. Add the official Atlassian MCP at USER scope (global — the app spawns claude from its
#    own directory, so a default local-scoped server would be invisible to it).
#    The SSE endpoint is deprecated; use the streamable-HTTP endpoint:
claude mcp add --scope user --transport http atlassian https://mcp.atlassian.com/v1/mcp/authv2
# 3. Authenticate (headless runs can't log in interactively): run `claude`, type `/mcp`,
#    pick atlassian → Authenticate, finish the browser login. Confirm with:
claude mcp list   # atlassian should show "Connected"
```

The Jira tab detects whether the CLI and MCP are present and shows setup steps until ready.
Without this setup, the timesheet still marks done — only the Jira step is skipped.

## Releases

Bump the version in `package.json`, `src-tauri/tauri.conf.json`, and `src-tauri/Cargo.toml`, commit, then push a `v*` tag — `.github/workflows/publish.yml` builds and attaches the desktop bundles to the GitHub release.
