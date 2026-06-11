# Tauri + Preact + Typescript

This template should help get you started developing with Tauri, Preact and Typescript in Vite.

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
## Cloudflare AI

Deploy the included Worker, then set `VITE_CLOUDFLARE_AI_URL` to its URL:

```bash
npx wrangler deploy
```

The Worker uses the `AI` binding in `wrangler.toml` and returns the corrected
timesheet description as `summary`. `CLOUDFLARE_ACCOUNT_ID` and
`CLOUDFLARE_API_TOKEN` are only needed by Wrangler during deployment; do not
expose the API token through a `VITE_` environment variable.
