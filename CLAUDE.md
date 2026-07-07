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

The Rust layer (`src-tauri/`) is window-hosting only. All business logic lives in TypeScript under `src/`.

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

`timesheets`: `id` (uuid PK), `user_id`, `date_memo` (timestamptz), `description`, `project_id` (FK → projects), `inserted_at`, `is_complete`, `ai_summary` (read-only, populated externally via Cloudflare — never written by this app)
