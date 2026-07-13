# Handoff: Park page → Msync autofill (remaining work)

**Date:** 2026-07-13 · **App version at handoff:** 4.4.0 (unreleased Park changes in working tree)

## What shipped this session (done, verified)

New **Park** sidebar page: webcam capture → tesseract.js OCR (digits-only) → editable numeric-only input → "Send to Msync" copies the card no. to clipboard and opens Msync in an in-app Tauri webview (SSO-preserving, open-or-focus).

Files (all in working tree, **not yet committed/released**):
- `src/pages/Park.tsx` — camera lifecycle (getUserMedia on mount, tracks stopped on unmount), Scan → canvas → lazy-imported tesseract worker with `tessedit_char_whitelist: '0123456789'`, digits-only input filter, Send handler (Tauri vs browser fallback)
- `src/lib/msync.ts` — `MSYNC_PARK_URL` placeholder const (**still `REPLACE_ME`**)
- `src/lib/cardno.ts` + `cardno.test.ts` — `extractCardNo()` picks longest digit run from OCR noise
- `src/App.tsx` — `/park` route; `src/components/Sidebar.tsx` — `park` icon + NAV entry
- `src-tauri/src/lib.rs` — `open_park_window(app, url)` command (below `open_appsmith_filler`), registered in `generate_handler!`
- `package.json` — added `tesseract.js`

Verified: 69/69 tests pass (`npm run test:run`), `npm run build` clean, `cargo check` clean. Not yet verified: camera on real Windows build (WSL has no webcam — "Invalid constraint" from getUserMedia is expected in dev; test in Windows browser via `npm run dev` or the built app).

## Remaining work (next session)

1. **Real Msync carpark URL** — user will provide it. Put it in `src/lib/msync.ts` (`MSYNC_PARK_URL`).
2. **Autofill injection** — replace the clipboard-paste flow with an injected script that fills the card-no field in the Msync page and (optionally) submits. **We will inspect the form elements on the real URL together with the user** — selectors are unknown until then.

### Template for the autofill

Copy the existing timesheet-filler pattern in `src-tauri/src/lib.rs`:
- `open_appsmith_filler` (~line 453): `WebviewWindowBuilder` + `.initialization_script_for_all_frames(script)`; window-reuse branch re-injects via `w.eval("window.__timesh1tSendRows(...)")`
- `APPSMITH_FILL_SCRIPT` (~lines 180–413): activates only in the target frame (hostname check), drives React-controlled inputs via native value setter + `dispatchEvent(new Event('input'))` (`setNativeValue`), targets widgets by CSS selectors (`SEL` object), floating "Fill" button, signals completion via `location.hash` polled by `spawn_done_poll` (sandboxed webview has no Tauri IPC)

For Park: extend `open_park_window` to accept the card no. and inject a much smaller script — likely just one input + one button selector. If the carpark page is also Appsmith, the same `.t--widget-<name>` selector convention and `setNativeValue` approach apply.

### Steps when URL arrives
1. Set `MSYNC_PARK_URL`.
2. Open the page, inspect the card-no input + submit button (user can share devtools HTML, or open the webview and inspect).
3. Add `PARK_FILL_SCRIPT` const + pass `card_no` into `open_park_window`, inject with placeholder replaced (mirror `__ROWS__` pattern).
4. Update `Park.tsx` `sendToMsync()` to pass `cardNo` to the invoke; keep clipboard copy as fallback.
5. Verify in built Windows app (SSO login → fill → submit), then version bump + CHANGELOG + tag (release flow precedent: v4.4.0 commit `761a97f`).

## Key decisions already made (don't re-litigate)
- tesseract.js local OCR, digits only; CDN-loaded wasm/traineddata is acceptable (app is online for Supabase)
- In-app webview (not default browser) to keep the Azure+Duo SSO session
- No settings UI for the URL — one-line const like `src/lib/appsmith.ts`
- No Park.tsx render test (jsdom lacks `mediaDevices`); the pure logic is tested in `cardno.test.ts`

## Suggested skills
- `superpowers:verification-before-completion` — before claiming the autofill works, run tests/build and exercise the real flow
- `commit-commands:commit` — the working tree still has the whole Park feature uncommitted; commit before starting autofill work
- `claude-mem:mem-search` — for prior Appsmith filler implementation details if the lib.rs comments aren't enough
