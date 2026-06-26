use std::io::{BufRead, BufReader, Read};
use tauri::Emitter;

// A macOS .app launched from Finder/Dock inherits a bare PATH (/usr/bin:/bin:…) with no
// nvm/Homebrew/npm-global dirs, so `claude` installed there is invisible. Rebuild PATH with
// the common install locations (nvm is version-glob'd) so detection and spawns find it.
#[cfg(not(windows))]
fn augmented_path() -> std::ffi::OsString {
    use std::path::PathBuf;
    let home = std::env::var("HOME").unwrap_or_default();
    let mut dirs: Vec<PathBuf> = vec![
        "/usr/local/bin".into(),
        "/opt/homebrew/bin".into(),
        PathBuf::from(&home).join(".local/bin"),
    ];
    // nvm: ~/.nvm/versions/node/<version>/bin — add every installed version's bin.
    if let Ok(entries) = std::fs::read_dir(PathBuf::from(&home).join(".nvm/versions/node")) {
        dirs.extend(entries.flatten().map(|e| e.path().join("bin")));
    }
    let existing = std::env::var_os("PATH").unwrap_or_default();
    let mut paths: Vec<PathBuf> = std::env::split_paths(&existing).collect();
    paths.extend(dirs);
    std::env::join_paths(paths).unwrap_or(existing)
}

// Build a `claude` command. On Windows, suppress the console window that would otherwise
// flash on every spawn (CREATE_NO_WINDOW).
fn claude_command() -> std::process::Command {
    #[allow(unused_mut)]
    let mut cmd = std::process::Command::new("claude");
    #[cfg(not(windows))]
    cmd.env("PATH", augmented_path());
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x0800_0000); // CREATE_NO_WINDOW
    }
    cmd
}

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
        let mut child = claude_command()
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
                "You are a Jira assistant acting through the Atlassian MCP. Do whatever the \
                 user asks — create issues, edit summary/description/fields, add comments, \
                 assign, or transition status. Resolve issue keys or search by description \
                 as needed. Do not touch any database; the timesheet is handled by the \
                 TimeSh1t app.",
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
        if claude_command().arg("--version").output().is_err() {
            return "no_cli";
        }
        // `claude mcp list` prints one line per server, e.g.
        //   atlassian: https://… (HTTP) - ✔ Connected
        //   atlassian: https://… (HTTP) - ! Needs authentication
        // Require the atlassian line to actually be Connected — a configured-but-unauth'd
        // server can't transition issues, so it's not "ready".
        match claude_command().args(["mcp", "list"]).output() {
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
