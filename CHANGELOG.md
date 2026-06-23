# Changelog

All notable changes to TimeSh1t are documented here. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/); versions are git tags.

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
