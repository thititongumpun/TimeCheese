---
layout: ../../layouts/Doc.astro
title: Quickstart
description: Get TimeCheese installed and log your first entry.
---

# Quickstart

## 1. Download & install

**Windows:** download the `.msi` installer and run it.

**macOS:** open the `.dmg` and drag TimeCheese into Applications. The app is unsigned, so the
first time you open it you may need to right-click the app and choose **Open** instead of
double-clicking — macOS Gatekeeper otherwise blocks it.

## 2. Request access

First time? Click **New here? Request access** on the sign-in screen. Enter your email, then
the 6-digit code that arrives, then choose a password. You'll land on a **waiting for admin
approval** screen — ping your admin, and once they approve you, click **Check again** to get in.
After that, just sign in with your email and password. See [Getting access](../getting-access/)
for the full walkthrough.

## 3. Log an entry

Pick a project, a date, a description, and a start/end time. TimeCheese validates the entry
against a few rules:

- Times must fall within **09:00–18:00**.
- Entries on the same day can't overlap.
- A day is capped at **8 worked hours** — the 12:00–13:00 lunch hour doesn't count toward the
  total.

## 4. Optional — enable Pro (Jira Assistant + Ask)

The Jira Assistant runs an AI CLI that's already installed on your machine, on your own
subscription — either [Claude Code](https://claude.com/claude-code) or
[OpenAI Codex](https://developers.openai.com/codex/cli). Install one, then add the Atlassian MCP
server to it:

<div class="terminal text-xs sm:text-sm"><span class="prompt">$</span>claude mcp add --scope user --transport http atlassian https://mcp.atlassian.com/v1/mcp/authv2</div>

<div class="terminal text-xs sm:text-sm"><span class="prompt">$</span>codex mcp add atlassian --url https://mcp.atlassian.com/v1/mcp/authv2</div>

TimeCheese detects the CLI automatically — the Jira tab lights up once it's found. Pick which one
to use under **Settings → Jira agent**; the default, Auto, uses whichever is installed.

The Jira tab has its own **Model** dropdown: the CLI's own default, a preset, or `Custom…` for any
model name you type. It's remembered per CLI. Codex publishes no model list, so its presets are
empty — type the name under `Custom…`. After each run, a line under the answer shows the model,
tokens, cost and rate-limit reset, as far as that CLI reports them.

Ask needs no CLI — it answers from your own archived entries.
