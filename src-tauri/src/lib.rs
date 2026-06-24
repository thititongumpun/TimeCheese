use std::io::{BufRead, BufReader, Read};
use tauri::Emitter;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

// Turn one stream-json line from `claude` into a short human progress label, or None.
fn progress_label(line: &str) -> Option<String> {
    let v: serde_json::Value = serde_json::from_str(line).ok()?;
    match v.get("type")?.as_str()? {
        "assistant" => {
            for item in v.get("message")?.get("content")?.as_array()? {
                match item.get("type").and_then(|t| t.as_str()) {
                    Some("tool_use") => {
                        let name = item.get("name").and_then(|n| n.as_str()).unwrap_or("tool");
                        // mcp__atlassian__transitionJiraIssue -> transitionJiraIssue
                        let short = name.rsplit("__").next().unwrap_or(name);
                        return Some(format!("Using {short}…"));
                    }
                    Some("text") => {
                        let t = item.get("text").and_then(|t| t.as_str()).unwrap_or("").trim();
                        if !t.is_empty() {
                            return Some(t.chars().take(120).collect());
                        }
                    }
                    _ => {}
                }
            }
            None
        }
        "user" => Some("Reading Jira response…".into()),
        _ => None,
    }
}

// Run the local `claude` CLI headlessly and return its final text. Streams step-by-step
// progress to the frontend via the "claude-progress" event as Claude works. The Atlassian
// (Jira) MCP is configured per-user in Claude Code itself, so no token lives in this app.
// Runs on a blocking thread so the webview stays responsive during the call.
#[tauri::command]
async fn ask_claude(app: tauri::AppHandle, prompt: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        // ponytail: bypassPermissions runs the Jira MCP tools without an interactive
        // prompt (impossible in headless mode). Blast radius = this user's own Atlassian
        // MCP. Upgrade path: --allowedTools "mcp__atlassian__*" to forbid any other tool.
        let mut child = std::process::Command::new("claude")
            .args([
                "-p",
                &prompt,
                // stream-json (+ --verbose, required with -p) emits one JSON event per step
                // so we can surface live progress instead of one opaque wait.
                "--output-format",
                "stream-json",
                "--verbose",
                "--permission-mode",
                "bypassPermissions",
                "--append-system-prompt",
                "You act on Jira via the Atlassian MCP only. Given a description or issue \
                 key, find the matching Jira issue and transition it to Done. The timesheet \
                 is handled by the TimeSh1t app — do not touch any database.",
            ])
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .spawn()
            .map_err(|e| {
                if e.kind() == std::io::ErrorKind::NotFound {
                    "CLAUDE_NOT_INSTALLED".to_string()
                } else {
                    format!("failed to run claude CLI: {e}")
                }
            })?;

        let stdout = child.stdout.take().expect("stdout piped");
        let mut stderr = child.stderr.take().expect("stderr piped");
        let mut result = String::new();

        for line in BufReader::new(stdout).lines() {
            let line = line.unwrap_or_default();
            if line.trim().is_empty() {
                continue;
            }
            if let Ok(v) = serde_json::from_str::<serde_json::Value>(&line) {
                if v.get("type").and_then(|t| t.as_str()) == Some("result") {
                    if let Some(r) = v.get("result").and_then(|r| r.as_str()) {
                        result = r.to_string();
                    }
                }
            }
            if let Some(label) = progress_label(&line) {
                let _ = app.emit("claude-progress", label);
            }
        }

        let status = child.wait().map_err(|e| e.to_string())?;
        if status.success() {
            Ok(result)
        } else {
            // ponytail: claude's stderr is small, so reading it after stdout EOF won't deadlock.
            let mut err = String::new();
            stderr.read_to_string(&mut err).ok();
            let err = err.trim();
            Err(if err.is_empty() {
                "claude exited with an error".to_string()
            } else {
                err.to_string()
            })
        }
    })
    .await
    .map_err(|e| e.to_string())?
}

// Report Claude Code setup so the UI can gate: no_cli / no_jira_mcp / ready.
#[tauri::command]
async fn claude_status() -> &'static str {
    tauri::async_runtime::spawn_blocking(|| {
        if std::process::Command::new("claude").arg("--version").output().is_err() {
            return "no_cli";
        }
        // `claude mcp list` prints one line per server, e.g.
        //   atlassian: https://… (HTTP) - ✔ Connected
        //   atlassian: https://… (HTTP) - ! Needs authentication
        // Require the atlassian line to actually be Connected — a configured-but-unauth'd
        // server can't transition issues, so it's not "ready".
        match std::process::Command::new("claude").args(["mcp", "list"]).output() {
            Ok(o) => {
                let text = String::from_utf8_lossy(&o.stdout).to_lowercase();
                let connected = text
                    .lines()
                    .any(|line| line.contains("atlassian") && line.contains("connected"));
                if connected { "ready" } else { "no_jira_mcp" }
            }
            Err(_) => "no_cli",
        }
    })
    .await
    .unwrap_or("no_cli")
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            #[cfg(desktop)]
            app.handle()
                .plugin(tauri_plugin_updater::Builder::new().build())?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![greet, ask_claude, claude_status])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
