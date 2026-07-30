# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Frontend dev server (Vite only, no Tauri window)
npm run dev

# Desktop app (Tauri + Vite together)
npm run tauri dev

# Build
npm run build           # tsc + vite build
npm run tauri build     # full desktop bundle

# Tests (watch mode)
npm test

# Tests (single run, CI)
npm run test:run

# Run a single test file
npx vitest run src/services/timesheets.test.ts
```

## Environment

Copy `.env.local` with real values before running:
```
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
```

The file is gitignored (`*.local`). Users are provisioned via the Supabase dashboard — there is no sign-up flow in the UI.

## Architecture

CRUD/business logic lives in TypeScript under `src/`. The Rust layer (`src-tauri/src/lib.rs`) hosts the window **plus** the native-only features:

- **`ask_agent`** / **`agent_status`** (Jira Assistant page, plus Home's "mark done + close Jira"): spawns the user's locally-installed `claude` **or** `codex` CLI with the prompt and streams progress lines back via the `agent-progress` Tauri event. Which one runs comes from the Settings → Jira agent preference (`src/lib/agent.ts`, localStorage), passed in as a `provider` argument; `auto` picks the first installed, Claude before Codex. No API key is stored — it rides the local CLI install. The two CLIs need different flags (`claude -p --output-format stream-json` vs `codex exec --json --skip-git-repo-check`) and emit different event schemas, so each has its own parser (`claude_progress_label` / `codex_progress_label` + `codex_answer`), all pure and unit-tested.
- **`open_appsmith_filler`** (Home) / **`open_park_window`** (Park): open the Msync site in a second SSO-preserving webview and inject a pure-DOM fill script (`APPSMITH_FILL_SCRIPT` etc.) into all frames — Msync embeds the real Appsmith app in a cross-origin iframe, so the script relays rows via `postMessage`. Existing windows are reused (recreating forces the full Azure+Duo SSO login again); Rust `eval`s `__timesh1tSendRows(...)` into them. Completion is signalled back by polling the window title / URL hash, since the injected frames have no Tauri IPC.

- **Mic permission (Linux)**: WebKitGTK auto-denies `getUserMedia` unless the app handles the `permission-request` signal; `setup()` allows `UserMediaPermissionRequest` only (`#[cfg(target_os = "linux")]`, webkit2gtk pinned to Tauri's own version). macOS mic permission comes from `src-tauri/Info.plist`. The Web Speech API is unsupported in all Tauri webviews — hence recording + cloud Whisper instead.

These features are desktop-only by design: a browser cannot inject scripts cross-origin or spawn local processes, so they cannot move to a plain web deployment (a browser extension + server-side Claude endpoint would be required).

**Voice input / → EN (`TimesheetModal`):** the 🎤 button records via `src/lib/recorder.ts` — native MediaRecorder (webm/opus) where available, else a Web Audio → 16 kHz WAV fallback built on the pure, unit-tested `src/lib/wav.ts` (WebKitGTK ships no MediaRecorder). The blob goes to the Cloudflare Worker (`task: 'transcribe'`, whisper-large-v3-turbo, `language: 'th'`) and the transcript is appended to the description. The → EN button sends the description through `task: 'translate'` (llama): `[TAG]` lines are preserved verbatim, other lines become English "- " bullets; output passes the same `restoreBracketTags`/`dropInventedTags` guards as summaries. Both leave the description untouched on failure. Worker changes ship via `wrangler deploy` (manual).

**Auth gate in `App.tsx`:** `supabase.auth.onAuthStateChange` drives two Preact signals — `currentUser` and `authLoading` (from `src/store/auth.ts`). The app renders a spinner while `authLoading` is true, `<Login>` when `currentUser` is null, and the full routed app otherwise. This prevents login-screen flash on re-open because the callback fires synchronously with the cached session.

**Routing:** `preact-iso` (`LocationProvider` / `Router` / `Route`). Use `useLocation()` from preact-iso for active link detection in the sidebar. Use `<Route path="…" component={X} />` form — not `<X path="…" />` — to avoid TypeScript errors.

**State:** Preact Signals (`@preact/signals`) for global auth state. Page-level data (rows, filter values, modal open/close) uses `useState` / `useSignal` locally in components.

**Services (`src/services/`):** Pure async functions that return Supabase's `{ data, error }` shape. No UI imports. Components call services and check `error` to show DaisyUI `alert-error` banners.

**Query builder pattern:** In `timesheets.ts`, all filter methods (`.gte`, `.lte`, `.eq`) are applied before `.order()`. The `.order()` call must be last — it is the terminal method that returns a `Promise`.

**CSS:** DaisyUI v5 + Tailwind CSS v4. No `tailwind.config` / `postcss.config` — Tailwind runs via the `@tailwindcss/vite` plugin and everything is configured in `src/index.css` (`@import "tailwindcss"` + `@plugin "daisyui" { themes: light --default, dark --prefersdark; }`). v5 gotchas: inputs/selects/textareas are bordered by default (no `*-bordered` classes); `form-control`/`label-text` are gone (use `fieldset`/`label`); use `<span class="loading loading-spinner loading-xs" />` inside buttons for spinners.

**Preact JSX gotchas:** Use `class=` (not `className=`), `for=` on labels (not `htmlFor=`), and `onInput` for input handlers.

## Testing

Tests use Vitest + `@testing-library/preact` + jsdom. Config is in `vitest.config.ts` (separate from `vite.config.ts` to preserve the Tauri dev server config).

**Mocking Supabase in service tests:** Variables used inside `vi.mock()` factories must be declared with `vi.hoisted()`:

```ts
const mockFrom = vi.hoisted(() => vi.fn())
vi.mock('../lib/supabase', () => ({ supabase: { from: mockFrom } }))
```

Use a `makeChain(result)` builder that returns `mockReturnThis()` for all filter/mutation methods and `mockResolvedValue(result)` for terminal methods (`order`, `single`).

## Database

Two tables in Supabase Postgres. Both have RLS: `auth.uid() = user_id`.

`projects`: `id` (uuid PK), `user_id`, `project_no`, `project_name`, `is_active`, `inserted_at`

`timesheets`: `id` (uuid PK), `user_id`, `date_memo` (timestamptz), `description`, `project_id` (FK → projects), `inserted_at`, `is_complete`, `ai_summary` (Cloudflare-generated: written by `createTimesheet` on insert, refreshed by `updateTimesheet` only when the description text changes — a Cloudflare failure is swallowed on both paths: insert stores `null`, update leaves the previous value. `createTimesheet(data, { summarize: false })` skips the Worker entirely, used by the holiday quick-add so a holiday name is never rewritten by the editor prompt), `start_time`/`end_time` (time, nullable — null on pre-v4.1.0 rows)

**Working-time validation** (`src/lib/timeslot.ts`, run by `TimesheetModal` on both create and edit): times within 09:00–18:00, no overlap with the same day's other entries, max 8 *worked* hours per day (12:00–13:00 lunch excluded from the count). This is app-level only — the DB CHECK constraint (`supabase/migrations/20260707_timeslot_columns.sql`) enforces just the window and start < end, so direct DB writes can create overlaps. Null-time rows are ignored by the check. There is no DB exclusion constraint by design (single-user app); add `btree_gist` + `EXCLUDE USING gist` if that ever changes.
