# Future: auto-create a Jira task when saving a timesheet entry

> Design note for a later plan. Not yet built. Builds on the v3.x Jira integration
> (`ask_claude` Rust command + Atlassian MCP via local Claude Code).

## Idea

In the new-entry modal, a **"Create Jira task" checkbox**. On a successful
`createTimesheet`, if checked → fire `ask_claude` with *"Create a Jira task: {description}"*
and show the returned issue key. ~20 lines, reuses the existing `ask_claude` command — no
new infrastructure.

## The one real decision (unresolved — pick when we build it)

**Which Jira project does the new task land in?** A timesheet's "project" is a *TimeSh1t*
project (`project_no` / `project_name`), not necessarily a Jira project key. Three lazy
options, simplest first:

- **Default project** — hardcode/configure one Jira project key. Simplest; fine if most
  work goes to one project.
- **Name it in the description** — e.g. `[PROJ] fixed SMTP` → Claude reads the key out of
  the text. Zero schema change.
- **Map TimeSh1t project → Jira project** — cleanest, needs a small mapping (a
  `jira_project_key` column on `projects`, or a config map).

## Second decision (only if round-trip matters)

Do we want to later **close that same issue** from the timesheet? If yes, store the
returned Jira key on the row (one new `jira_key` column on `timesheets`) so it's a reliable
create→close round-trip instead of re-searching by description each time. If we only ever
create, skip the column.

## When we build it
Say "add the create-Jira-on-save flag" and pick a project strategy above.
