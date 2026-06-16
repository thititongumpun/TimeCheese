# TimeSh1t

A desktop timesheet tracker built with Tauri 2.0, Preact, and Supabase. Log work entries against projects, mark them complete, browse archived entries, and view the company holiday calendar.

## Stack

- **Shell:** Tauri 2.0 (Rust hosts the window; all logic is TypeScript)
- **UI:** Preact + `preact-iso` routing, Preact Signals for auth state
- **Styling:** Tailwind CSS v3 + DaisyUI v4
- **Backend:** Supabase (Postgres + Auth, RLS scoped to `auth.uid()`)
- **AI:** Cloudflare Worker (`AI` binding) cleans up timesheet descriptions

## Features

- Timesheet entry with project assignment and complete/incomplete status
- Project management
- Archived timesheets view with pagination
- Holiday calendar — renders the newest PDF from a public Supabase Storage `holidays` bucket (swap it from the dashboard, no rebuild)
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
- **`timesheets`** — `id`, `user_id`, `date_memo`, `description`, `project_id` (FK → projects), `is_complete`, `inserted_at`, `ai_summary` (populated externally by the Worker, never written by the app)

Plus a public Storage bucket `holidays` for the holiday calendar PDF.

## Cloudflare AI

Deploy the included Worker, then set `VITE_CLOUDFLARE_AI_URL` to its URL:

```bash
npx wrangler deploy
```

The Worker uses the `AI` binding in `wrangler.toml` and returns the corrected timesheet description as `summary`. `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` are only needed by Wrangler during deployment; do not expose the API token through a `VITE_` environment variable.

## Releases

Bump the version in `package.json`, `src-tauri/tauri.conf.json`, and `src-tauri/Cargo.toml`, commit, then push a `v*` tag — `.github/workflows/publish.yml` builds and attaches the desktop bundles to the GitHub release.
