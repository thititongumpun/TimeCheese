# Changelog

All notable changes to TimeCheese are documented here. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/); versions are git tags.

## [4.12.0] - 2026-07-22

### Added

- **Non Project timesheets in the Msync filler**: entries whose project code is
  `MFE260055` now set Project Type to "Non Project" and pick the task whose name
  matches the project name exactly. Regular entries set Project Type back to
  "Project", so a batch can mix both. A task-name mismatch stops the run instead
  of filing to the wrong task.
- **Sortable Status column on Projects**: click the header to group Active or
  Inactive first; the initial view keeps the server order.

### Fixed

- **Project delete now reports why it failed**: a delete that removes no rows
  says so (RLS or an already-deleted row) instead of appearing to succeed, and
  the list reloads either way.
- **AI summaries no longer invent placeholder tags**: a tagless entry like
  `VACTION` was being expanded into a sentence with a made-up `[DATE]` tag. The
  prompt now forbids adding information, and any bracket tag absent from the
  input is unwrapped.

### Changed

- TypeScript upgraded to 7.0 — typecheck runs about 3× faster; no source changes
  were needed.
- Test setup restores `localStorage`/`sessionStorage`, which vitest 4's jsdom
  environment leaves undefined on `globalThis`. Fixes 4 failing tests.

## [4.11.4] - 2026-07-21

### Fixed

- **Copied AI summary no longer has blank lines**: copying a summary from Home
  or Archived now collapses the blank line between the `[TAG]` header and the
  bullet list, so the pasted text is tight.

## [4.11.3] - 2026-07-20

### Added

- **Archived rows show their time slot**: the Date cell now renders the
  `start–end` sub-line that Home already had. The archive table has carried
  `start_time`/`end_time` since v4.1.0 — they were fetched but never displayed.
  Pre-v4.1.0 rows have no times and still show the date alone.

## [4.11.2] - 2026-07-20

### Added

- **Sortable Date column**: click the Date header on Home and Archived to toggle
  oldest-first / newest-first. On Archived the sort applies across the whole
  filtered range, not just the visible page, and jumps back to page 1.

## [4.11.1] - 2026-07-20

### Fixed

- **Park sends no longer look finished early**: the Send button stayed enabled while the Msync job was still running, because it reset as soon as the window opened rather than when the fill completed. Clicking again mid-run could double-fill.
- **Duplicate fill-log rows on Park**: each send registered a new completion listener that was never released when a run was abandoned, so later completions wrote one row per abandoned run.
- **Modal keyboard access**: the timesheet and project modals are now real `showModal()` dialogs — Escape closes them, focus moves inside and is trapped, and the first editable field is focused on open.
- **Single update check per launch**: the update check ran twice from two components, showing two update prompts.

### Changed

- **Tables no longer blank on refresh**: marking done, deleting, changing filters, or closing the modal repainted the whole table through a spinner; the existing rows now stay on screen while data refreshes.
- **Buttons respond to being pressed**: added a press state (there was none anywhere in the app).
- **Faster startup**: the ~430 kB spreadsheet library used only by Archived's export now loads on demand instead of at launch, halving the main bundle.
- **One loading spinner at launch, not two**, and none at all for loads under 200 ms.
- **Vehicle selection on Park is instant** instead of waiting for the server round-trip.
- **Holiday calendar no longer shifts the page** as it loads.
- **Date filters fetch once per change** instead of once per typed segment.
- Cutoff countdown ticks per minute rather than per second.

## [4.11.0] - 2026-07-16

- **Project filter on Archived**: filter the archived table by project (or "No project") alongside the month-range controls — counts and pagination follow the filter.
- **Park page redesign**: compact Send-to-Msync card with a 3D-hover "parking ticket" showing the selected vehicle, sitting beside the vehicles list; fill log below.

## [4.10.0] - 2026-07-16

- **Self-signup with admin approval**: new users click "New here? Request access" on the sign-in screen, verify their email with a 6-digit code, set a password, and wait on an approval screen until the admin flips their `approved` flag in Supabase. Access is enforced by row-level security, not just the UI. The old "First time? Set up your password" flow is gone — the signup path covers provisioned accounts too. Requires the `20260716_profiles_approval.sql` migration and enabling email signups in Supabase.
- **Brand redesign**: new `timecheese` / `timecheese-dark` themes (warm paper, cheese-gold accent, 2px rules) are now the defaults — the stock themes remain in the switcher. Bricolage Grotesque display font on page titles and the wordmark, consistent page headers with mono meta lines, status badges instead of colored checkboxes, and proper empty states across every page.

## [4.9.0] - 2026-07-16

- GitHub and website links in Settings — opens `github.com/thititongumpun/TimeCheese` and the docs site in your default browser.

## [4.8.0] - 2026-07-16

- **Missing-day reminders**: the Home page now warns about past working days in the current cutoff period (27th → 26th) with no timesheet entry. Weekends and company holidays are skipped, entries already swept to the archive still count, and the banner clears itself when you add the entry.
- New cheese app icon, matching the docs website.
- Docs & download website: https://thititongumpun.github.io/TimeCheese/ — features, changelog, quickstart, and always-current download links.

## [4.7.0] - 2026-07-15

- Renamed the app: TimeSh1t is now **TimeCheese** (say it fast). New app name, window title, login screen, sidebar, and footer branding.
- Repo moved to `github.com/thititongumpun/TimeCheese`; the old URL redirects, so existing installs pick up this update normally and become TimeCheese in place. No re-login needed.

## [4.6.0] - 2026-07-14

- Timesheets: countdown to the monthly cutoff (the 26th, midnight local time) at the top of the page — DaisyUI boxed countdown with days/hours/min/sec, rolling over to next month once the 26th passes.
- Park: card no. is now a 3-digit OTP-style input (DaisyUI `otp`) instead of a plain text field; digits only.

## [4.5.1] - 2026-07-14

- Msync fillers (timesheet + park) now tolerate slow loading: dropdown options are polled until they actually render (they're query-backed), and page transitions that trigger backend queries get a 4s settle wait plus longer element timeouts.

## [4.5.0] - 2026-07-14

- Park: full Msync carpark autofill — opens the parking app in an SSO-preserving webview, auto-clicks "Refresh Login", picks the vehicle type, fills the card no., selects the license plate, and submits. Submission is confirmed back to the app via the URL-hash back-channel and recorded in a "Park fill log" (with Clear).
- Park: vehicle management — add/remove cars and motorcycles with license plates, one default vehicle (radio-selected) used for the send.
- Park: redesigned page — card-based layout (carpark card, vehicles, fill log) consistent with the rest of the app.
- Park: removed the camera/OCR scan (tesseract.js) — it could not read handwritten card numbers reliably; the card no. is typed instead.

## [4.4.0] - 2026-07-13

- Collapsible sidebar: toggle it down to an icon-only rail (DaisyUI drawer with `is-drawer-close` variants), with hover tooltips on nav icons and a smooth width animation. On narrow windows it becomes an overlay drawer with a hamburger button.
- Theme picker: nine DaisyUI themes (light, dark, retro, nord, abyss, aqua, lofi, acid, dracula) selectable from a sidebar dropdown or the Settings modal.
- Page footer with copyright and the running app version.
- Fixed the sidebar date wrapping under the clock.
- Fixed the Settings modal rendering trapped inside the sidebar rail (drawer transform made it the containing block for `position: fixed`).

## [4.3.2] - 2026-07-09

- Redesigned sidebar: live clock, icon navigation with an active-route accent, and a one-click light/dark toggle in the footer.
- Archived Excel export now includes **Start** and **End** time columns.

## [4.3.1] - 2026-07-09

- Jira setup now uses Atlassian's streamable-HTTP MCP endpoint (`/v1/mcp/authv2`); the SSE endpoint is deprecated (EOL 30 Jun 2026).
- Add `start_time`/`end_time` to `archived_timesheets` so working hours survive archiving (migration `20260709_archived_timeslot_columns.sql`).

## [4.3.0] - 2026-07-09

- Holiday dates now load from a public `holidays.json` on Cloudflare R2 (edit + re-upload, no rebuild) — replaces the Supabase Storage PDF.
- Holiday page: click a table row to jump the calendar to that holiday's month and select the date.

## [4.2.1] - 2026-07-08

- Msync's Memo field now gets the **AI summary** of the entry (falls back to the raw description when no summary exists yet). The fill log records whichever text was pasted.

## [4.2.0] - 2026-07-08

- Send to Msync now fills each entry's **actual start/end times** into the hour/minute pickers (the v4.1.0 columns). Entries without stored times keep the form's 09:00–18:00 defaults. The dropdowns are virtualized, so values are picked via the popover's filter box.
- **No more re-login on every send:** the Msync window is reused when still open — fresh rows are handed to the running fill script instead of rebuilding the window (which forced the Azure+Duo SSO flow each time). Tip: answer "Yes" to Microsoft's "Stay signed in?" and check Duo's remember-me to also skip login after closing the window.
- Fill order tuned to the form's reset chain (project → date → times → memo → task last), and the task click is toggle-aware: a single auto-selected task no longer gets deselected; if Create stays disabled the task is re-clicked automatically.
- Task preference is now "IMP", then "PRESALE", then the first task.

## [4.1.0] - 2026-07-07

- New: **working hours on timesheets** — entries have start/end times (defaults 09:00–18:00). Validated on save: times must stay within 09:00–18:00, entries on the same day cannot overlap, and a day is capped at 8 worked hours (12:00–13:00 lunch excluded). The table shows the time range under the date and orders same-day entries by start time. Requires the `supabase/migrations/20260707_timeslot_columns.sql` migration.
- Upgraded to **DaisyUI 5.6 + Tailwind CSS 4** (from DaisyUI 4 / Tailwind 3). Tailwind now runs via the `@tailwindcss/vite` plugin; `tailwind.config.cjs`/`postcss.config.cjs` are gone and theming lives in `src/index.css`. Forms migrated to the v5 classes.
- UI: "Send to Msync" button gets DaisyUI 5.6's aura glow; "+" new-entry button gets a tooltip; the holiday list is now a full-width table under the calendar.

## [4.0.0] - 2026-07-07

- New: **Send to Msync** — select timesheet rows on Home and auto-fill them into the Msync (Appsmith) timesheet app. Opens Msync in a desktop webview with an injected filler: per entry it searches the project by code, sets the date, picks the task (prefers names containing "IMP"), fills the memo, and clicks Create. Hours stay at the form's 09:00–18:00 defaults.
- Entries actually created in Msync are automatically marked done in T1meSh1t (partial-failure aware: if a batch stops midway, only the entries that landed are marked).
- New: **Msync fill log** on Home — a collapsible history of the last 50 fill runs (timestamp, created count, and each entry's date/project/description), stored locally.
- Duo SSO's "Update macOS" nag page is skipped automatically when the Msync window opens.
- Desktop-only feature; the button is hidden in the web build.

## [3.1.20] - 2026-07-02

- Fixed Windows auto-update looping after 3.1.19: reverted the installer `productName` back to `TimeSh1t`. NSIS keys the install location and product identity off `productName`, so the 3.1.19 rename made updates install into a new folder while the old version kept launching. The window title/UI branding stays **T1meSh1t**.

## [3.1.19] - 2026-07-02

- Online-users list now shows the updated avatar: presence is re-broadcast after the server refresh on load and after you save a new avatar (previously it stayed on the cached avatar from sign-in).
- Renamed the app's display name to **T1meSh1t** (UI, window title, product name, README). Bundle identifier, auto-updater channel, and stored theme are unchanged.

## [3.1.18] - 2026-07-02

- Sidebar avatar now refreshes from the server on load, so avatar/profile edits made in the Supabase dashboard show up (previously only the cached session's stale metadata was read).
- Holiday page now lists all holidays (date + name) below the calendar for easier scanning.

## [3.1.17] - 2026-06-30

- Jira tab: updated the MCP setup command to the new Streamable HTTP endpoint (`--transport http` / `.../v1/mcp`), since Atlassian deprecated the HTTP+SSE endpoint after 30 June 2026.

## [3.1.16] - 2026-06-30

- Fixed the Holiday page showing a blank/white screen: the calendar mount node is now always rendered, so it exists when the holiday data finishes loading and the calendar initializes.

## [3.1.15] - 2026-06-30

- Holiday calendar now highlights every holiday date from the gist and shows the holiday name when you click/hover the date. Removed the separate holiday list.

## [3.1.14] - 2026-06-30

- Holiday page now lists all holidays next to the calendar (date + name), so the dates are clearly visible regardless of the month shown; the calendar still marks each holiday day.

## [3.1.13] - 2026-06-30

- Fixed the Holiday calendar rendering blank: bundled the calendar library's own stylesheet (DaisyUI v4 does not auto-style it).

## [3.1.12] - 2026-06-30

- Fixed the Holiday calendar failing to load in the desktop app: the holiday data URL now points directly at the raw gist host (no cross-origin redirect, which the webview rejected).

## [3.1.11] - 2026-06-30

- Holiday page is now an interactive **calendar** (DaisyUI-styled Vanilla Calendar Pro) that highlights holiday dates with name tooltips, replacing the embedded PDF viewer. Dates are loaded at runtime from a remote JSON file, so the list can be updated without rebuilding the app.

## [3.1.10] - 2026-06-29

- Added a **Timeline** sidebar tab: archived timesheets laid out as a vertical, side-alternating timeline by month, each month showing an AI digest grouped by project tag. Digests are cached per month in a new `monthly_summaries` table (generated once on first view, with a per-month "Regenerate" button).
- Jira page: added a **My open tasks** button next to Run that lists your unfinished issues (assignee = currentUser, status not Done).

## [3.1.9] - 2026-06-29

- Jira setup now detects a Claude CLI installed via nvm/Homebrew when launched from the GUI app (PATH no longer needs manual linking in common cases).

## [3.1.8] - 2026-06-25

- Archived search is now hybrid: short/acronym queries (e.g. "SIT") use keyword matching, while multi-word phrases use semantic vector search — fixing irrelevant results like "SICK leave" matching "SIT".
- Friendlier login error when a non-provisioned email requests a setup code ("No account found for this email. Ask your admin to add you first.").

## [3.1.7] - 2026-06-25

- Added a first-time account setup flow on the login screen: provisioned users can email themselves a 6-digit code and choose their own password (no web build or deep linking required).

## [3.1.6] - 2026-06-25

- Added a monthly timesheet-cutoff warning in the sidebar (above the online list) that appears on the 25th of each month.

## [3.1.5] - 2026-06-25

- Copy-success feedback now shows as a non-intrusive bottom-right toast on the timesheets and archived pages, instead of an inline banner that shifted the table layout.

## [3.1.4] - 2026-06-25

- Added a quick-copy AI summary button next to the row actions in the timesheets table.
- Temporarily hid the "Mark done + close Jira" action while the Jira close flow is being finalized.

## [3.1.3] - 2026-06-25

- Removed the "developed by thiti_t and claude" page footer.

## [3.1.2] - 2026-06-25

- **Update banner fit:** the sidebar "Update" banner no longer overflows the 192px sidebar — shorter label plus truncation.
- **Real release notes:** the update dialog (and GitHub release) now show the actual changelog for the version instead of the generic "See the assets…" placeholder. The release workflow pulls notes straight from CHANGELOG.md.
- **Footer:** "developed by thiti_t and claude" on every page.

## [3.1.1] - 2026-06-25

- **Windows:** no more `cmd` console windows flashing when the app calls `claude` (status checks and Jira actions now spawn with `CREATE_NO_WINDOW`).

## [3.1.0] - 2026-06-25

- **General Jira assistant:** the Jira tab now does anything the Atlassian MCP supports — create issues, edit summary/description, add comments, assign, query ("what's assigned to me?"), as well as transition status. (Previously limited to "transition to Done".)
- **Searchable project picker:** the new-entry modal's project field is now a type-to-search combobox (native datalist) instead of a long scroll-only select.

## [3.0.0] - 2026-06-25

Jira integration and in-app update notifications.

- **Jira tab:** mark work done in Jira from inside TimeSh1t, driven by your local Claude Code CLI + the Atlassian MCP — no Jira token is stored in the app. The tab gates on setup (install Claude Code → add the Atlassian MCP at user scope → authenticate) and only shows the usage panel once `atlassian` reports **Connected**.
- **"Mark done + close Jira"** per-row action: flips the timesheet `is_complete` in-app (RLS-safe) and asks Claude to transition the matching Jira issue to Done. The two steps are independent — the timesheet still completes if Jira isn't set up.
- **Live progress:** Claude's steps (which tool it's calling, its reasoning) stream into the UI instead of one opaque spinner.
- **Update banner:** on launch, the sidebar shows an "Update available" banner under the online-users list; clicking it opens the release notes with one-click download-and-install.

## [2.0.0] - 2026-06-23

Semantic search, autofill, and AI Q&A over your archived timesheets, powered by
Supabase pgvector + Cloudflare Workers AI embeddings (bge-m3, multilingual).

- **Archived → Search:** find past entries by meaning, not keywords (Thai + English).
- **Autofill:** new entries suggest similar past descriptions as you type.
- **Ask tab:** ask natural-language questions about your history; answers cite the entries they used.
- Archived entries are embedded automatically on page open; an "Index archive" button backfills the initial bulk.

Requires a one-time Supabase migration (pgvector + `match_archived_timesheets`) and the
updated Cloudflare Worker (`embed` + `chat` routes).

## [1.5.1] - 2026-06-23

- Projects are now shared across all users — creating a project no longer ties it to one account.

## [1.5.0] - 2026-06-23

- Online users now show as a row of avatars; hover any avatar to see the person's name.

## [1.4.1] - 2026-06-19

- Moved the scroll-to-top button up so it no longer covers the pagination controls.

## [1.4.0] - 2026-06-19

- Copy AI summary action button per row on the Archived page.

## [1.3.0] - 2026-06-18

- Notes tab in the sidebar — jot quick notes, delete them; stored locally on the device.

## [1.2.0] - 2026-06-18

- Change your password in user settings (re-authenticates with the current password first).

## [1.1.0] - 2026-06-17

- Bulk-select timesheets on the Home page with a "Mark done" action for all selected rows.
- Export archived timesheets to XLSX, filtered by a 26th→25th cutoff billing period (start/end month).
- Click-to-expand (accordion) for long description / AI summary text, replacing the hover behavior.

## [1.0.0] - 2026-06-17

- Online presence in the sidebar (Supabase Realtime) — live count and names of who's online.
- Numbered pagination on the Archived page (`1 … n` with current highlighted).
- Floating scroll-to-top button when scrolled down.

## [0.0.11] - 2026-06-17

- Hover-to-expand for long description / AI summary text in timesheet tables.

## [0.0.10] - 2026-06-17

- Editable avatar URL in user settings.
- Copy banner auto-dismisses after 5s.
- Rewrote README.

## [0.0.9] - 2026-06-16

- Holiday calendar view.

## [0.0.8] - 2026-06-16

- Fixed archived table name to `archived_timesheets`.

## [0.0.7] - 2026-06-16

- Archived timesheets view.
- Auto-update badge for the desktop app.

## [0.0.6] - 2026-06-16

- Maintenance release.

## [0.0.5] - 2026-06-16

- AI summaries use the `llama-3.1-8b-fp8` model; surface AI errors in the UI.

## [0.0.4] - 2026-06-11

- Maintenance release.

## [0.0.3] - 2026-06-11

- Fixed updater manifest input.

## [0.0.2] - 2026-06-11

- Maintenance release.

## [0.0.1] - 2026-06-11

- Initial release: auth gate, Login, Home/Timesheets, Projects, Layout/Sidebar.
- Supabase services (auth, projects, timesheets) with filtering and tests.
- Tailwind CSS v3 + DaisyUI v4, Vitest test setup, Tauri desktop packaging.

[1.0.0]: https://github.com/thititongumpun/TimeSh1t/releases/tag/v1.0.0
[0.0.11]: https://github.com/thititongumpun/TimeSh1t/releases/tag/v0.0.11
[0.0.10]: https://github.com/thititongumpun/TimeSh1t/releases/tag/v0.0.10
[0.0.9]: https://github.com/thititongumpun/TimeSh1t/releases/tag/v0.0.9
[0.0.8]: https://github.com/thititongumpun/TimeSh1t/releases/tag/v0.0.8
[0.0.7]: https://github.com/thititongumpun/TimeSh1t/releases/tag/v0.0.7
[0.0.6]: https://github.com/thititongumpun/TimeSh1t/releases/tag/v0.0.6
[0.0.5]: https://github.com/thititongumpun/TimeSh1t/releases/tag/v0.0.5
[0.0.4]: https://github.com/thititongumpun/TimeSh1t/releases/tag/v0.0.4
[0.0.3]: https://github.com/thititongumpun/TimeSh1t/releases/tag/v0.0.3
[0.0.2]: https://github.com/thititongumpun/TimeSh1t/releases/tag/v0.0.2
[0.0.1]: https://github.com/thititongumpun/TimeSh1t/releases/tag/v0.0.1
