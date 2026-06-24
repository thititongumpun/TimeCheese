# Changelog

All notable changes to TimeSh1t are documented here. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/); versions are git tags.

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
