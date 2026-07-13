use std::io::{BufRead, BufReader, Read};
use tauri::{Emitter, Manager};

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
                 T1meSh1t app.",
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

// Injected into the Appsmith page. Plain DOM only — the remote webview gets no Tauri IPC.
// __ROWS__ is replaced with the selected rows' JSON before injection.
const APPSMITH_FILL_SCRIPT: &str = r#"
(() => {
  // Duo SSO interjects an "Update macOS" nag page — auto-click "Skip for now" when it shows.
  (function autoSkipDuo() {
    let tries = 60;
    const t = setInterval(() => {
      const el = [...document.querySelectorAll('a, button')]
        .find((n) => n.textContent.trim() === 'Skip for now');
      if (el) { el.click(); clearInterval(t); }
      else if (--tries <= 0) clearInterval(t);
    }, 500);
  })();

  // Reuse path: when the window already exists (user stays logged in), Rust evals this in
  // the top frame with fresh rows instead of rebuilding the window (which would force a
  // full SSO re-login). Relays the rows to every frame; the Appsmith one picks them up.
  window.__timesh1tSendRows = (rows) => {
    try { location.hash = ''; } catch (e) {} // clear a stale done-signal from the last run
    const msg = { type: 'TIMESH1T_ROWS', rows };
    window.postMessage(msg, '*'); // covers the no-iframe case (direct Appsmith URL)
    [...document.querySelectorAll('iframe')].forEach((f) => {
      try { f.contentWindow.postMessage(msg, '*'); } catch (e) {}
    });
  };

  // msync embeds the real Appsmith app in a cross-origin iframe; this script is injected
  // into every frame and only activates inside the Appsmith one. Non-appsmith frames just
  // relay the fill-done signal into the top frame's URL hash, which Rust polls (the webview
  // has no Tauri IPC on purpose, and document.title does not reach the native window title).
  if (!location.hostname.includes('appsmith')) {
    window.addEventListener('message', (e) => {
      if (typeof e.data === 'string' && e.data.indexOf('TIMESH1T_FILL_DONE:') === 0 && window.top === window) {
        try { location.hash = 'timesh1t_done_' + e.data.split(':')[1]; } catch (err) {}
      }
    });
    return;
  }
  const ROWS = __ROWS__;
  let fillBtn = null;

  // Fresh rows arriving from a reused window (see __timesh1tSendRows above).
  window.addEventListener('message', (e) => {
    if (e.data && e.data.type === 'TIMESH1T_ROWS' && Array.isArray(e.data.rows)) {
      ROWS.length = 0;
      ROWS.push(...e.data.rows);
      if (fillBtn) {
        fillBtn.textContent = 'Fill ' + ROWS.length + ' entries';
        fillBtn.disabled = false;
      }
    }
  });

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function waitFor(selector, timeoutMs = 10000) {
    return new Promise((resolve, reject) => {
      const t0 = Date.now();
      const tick = () => {
        const el = document.querySelector(selector);
        if (el) return resolve(el);
        if (Date.now() - t0 > timeoutMs) return reject(new Error('timeout waiting for ' + selector));
        setTimeout(tick, 200);
      };
      tick();
    });
  }

  // Appsmith inputs are React-controlled: assigning .value directly does not register.
  // Use the native setter, then fire an 'input' event so React sees the change.
  function setNativeValue(el, value) {
    const proto = el instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }

  // ===== SELECTORS — Appsmith widget names (t--widget-<name>), stable across builds =====
  const SEL = {
    createTimesheetBtn: '.t--widget-button32 button',                    // list page: "Create Timesheet"
    projectTable: '.t--widget-table_create',                             // "Select a Project below"
    projectSearch: '.t--widget-table_create input[type="search"]',
    projectRow: '.t--widget-table_create .tbody .tr',
    taskRow: '.t--widget-table_create_task .tbody .tr',                  // "Select a Task below"
    dateInput: '.t--widget-datepicker1_start_date input',
    startHour: '.t--widget-hour_start1copy',
    startMinute: '.t--widget-minute_start1copy',
    endHour: '.t--widget-hour_end1copy',
    endMinute: '.t--widget-minute_end1copy',
    // Appsmith select options render in a body-level portal, in a VIRTUALIZED list —
    // only visible rows exist in the DOM, so setSelect filters before matching.
    selectFilter: '.select-popover-wrapper input.bp3-input',
    selectOption: '.select-popover-wrapper .menu-item-text',
    memo: '.t--widget-memocopy textarea, .t--widget-memocopy input',
    // bottom-right "Create" — only match once enabled (it stays disabled until the form is valid)
    createBtn: '.t--widget-button6copy button:not([disabled]):not(.bp3-disabled)',
  };
  // Start/end hour selects default to 09:00/18:00 already — left untouched.
  // ======================================================================================

  // DD-MM-YYYY — matches what the picker displays; tune here if it expects another format.
  function formatDate(iso) {
    const d = new Date(iso);
    const p = (n) => String(n).padStart(2, '0');
    return p(d.getDate()) + '-' + p(d.getMonth() + 1) + '-' + d.getFullYear();
  }

  // Open an Appsmith select widget and click the option with the given text. The option
  // list is virtualized, so type into the popover's filter first to force the row to render.
  async function setSelect(widgetSel, value) {
    (await waitFor(widgetSel + ' .select-button')).click();
    await sleep(300);
    const filter = document.querySelector(SEL.selectFilter);
    if (filter) {
      setNativeValue(filter, value);
      await sleep(300);
    }
    const opt = [...document.querySelectorAll(SEL.selectOption)]
      .find((o) => o.textContent.trim() === value);
    if (!opt) throw new Error('option "' + value + '" not found for ' + widgetSel);
    (opt.closest('a') || opt).click();
    await sleep(300);
  }

  // Set the four hour/minute pickers from "HH:MM:SS" strings; null keeps the form defaults.
  async function setTimes(row) {
    if (row.startTime) {
      await setSelect(SEL.startHour, row.startTime.slice(0, 2));
      await setSelect(SEL.startMinute, row.startTime.slice(3, 5));
    }
    if (row.endTime) {
      await setSelect(SEL.endHour, row.endTime.slice(0, 2));
      await setSelect(SEL.endMinute, row.endTime.slice(3, 5));
    }
  }

  // Prefer the task whose name includes 'IMP'; fall back to the first row.
  // Click the cell, not the row wrapper — Appsmith only registers selection on the cell.
  // Clicking TOGGLES: a click on an already-selected row deselects it, so skip in that case
  // (happens when the task list has a single, auto-selected row).
  function clickTask() {
    const rows = [...document.querySelectorAll(SEL.taskRow)];
    const task = rows.find((r) => r.textContent.includes('IMP'))
      || rows.find((r) => r.textContent.includes('PRESALE'))
      || rows[0];
    if (!task) return;
    if (task.className.includes('selected')) return; // already selected — clicking would disable it
    (task.querySelector('.td') || task).click();
  }

  async function setDate(row) {
    const dateInput = await waitFor(SEL.dateInput);
    setNativeValue(dateInput, formatDate(row.date));
    dateInput.dispatchEvent(new Event('blur', { bubbles: true }));
    await sleep(600);
  }

  async function fillOne(row) {
    // After a Create the app may land back on the list page — reopen the form if so.
    if (!document.querySelector(SEL.projectTable)) {
      (await waitFor(SEL.createTimesheetBtn)).click();
      await waitFor(SEL.projectTable);
      await sleep(800);
    }
    const search = await waitFor(SEL.projectSearch);
    setNativeValue(search, row.projectNo);
    await sleep(1000); // let the table filter
    (await waitFor(SEL.projectRow)).click();
    await sleep(1000); // task query runs after project selection
    // Order (observed live): date, then times, then task LAST — earlier steps reset later ones.
    await setDate(row);
    await setTimes(row);
    setNativeValue(await waitFor(SEL.memo), row.description);
    await sleep(300);
    await waitFor(SEL.taskRow);
    clickTask();
    await sleep(400);
    // Create stays disabled if the task ended up deselected (toggle) — click it back on.
    let create = null;
    for (let attempt = 0; attempt < 3 && !create; attempt++) {
      create = await waitFor(SEL.createBtn, 5000).catch(() => null);
      if (!create) { clickTask(); await sleep(400); }
    }
    if (!create) throw new Error('Create never enabled — task selection not registering');
    create.click();
    await sleep(1500); // submit + page settle
  }

  function addButton() {
    const btn = document.createElement('button');
    fillBtn = btn;
    btn.textContent = 'Fill ' + ROWS.length + ' entries';
    Object.assign(btn.style, {
      position: 'fixed', bottom: '20px', left: '20px', zIndex: 999999,
      padding: '12px 18px', background: '#6419e6', color: '#fff', border: 'none',
      borderRadius: '8px', fontSize: '14px', cursor: 'pointer',
      boxShadow: '0 2px 8px rgba(0,0,0,.35)',
    });
    btn.onclick = async () => {
      btn.disabled = true;
      let filled = 0;
      try {
        for (let i = 0; i < ROWS.length; i++) {
          btn.textContent = 'Filling ' + (i + 1) + '/' + ROWS.length + '…';
          await fillOne(ROWS[i]);
          filled++;
          await sleep(400);
        }
        btn.textContent = 'Done — ' + ROWS.length + ' filled';
      } catch (e) {
        btn.textContent = 'Failed after ' + filled + ': ' + e.message;
        console.error('[timesh1t filler]', e);
      }
      // Signal T1meSh1t how many entries landed (URL-hash back-channel) — sent even on
      // partial failure so only the filled rows get marked done and logged.
      try { window.top.postMessage('TIMESH1T_FILL_DONE:' + filled, '*'); } catch (e) {}
      // If this frame IS the top (direct Appsmith URL, no msync wrapper), set the hash here.
      if (window.top === window) { try { location.hash = 'timesh1t_done_' + filled; } catch (e) {} }
      btn.disabled = false;
    };
    document.body.appendChild(btn);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addButton);
  } else {
    addButton();
  }
})();
"#;

// ponytail: URL-hash polling is the IPC-free back-channel from the sandboxed webview.
// The fill script sets the top frame's hash to #timesh1t_done_<n> where n = rows filled
// (emitted even on partial failure, so only landed entries get marked done). The AtomicBool
// keeps re-sends from stacking multiple polls (each would emit its own event).
static DONE_POLL_ACTIVE: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);

fn spawn_done_poll(handle: tauri::AppHandle) {
    use std::sync::atomic::Ordering;
    if DONE_POLL_ACTIVE.swap(true, Ordering::SeqCst) {
        return;
    }
    tauri::async_runtime::spawn_blocking(move || {
        loop {
            std::thread::sleep(std::time::Duration::from_secs(1));
            match handle.get_webview_window("appsmith") {
                Some(w) => {
                    let filled = w.url().ok().and_then(|u| {
                        let s = u.as_str();
                        let rest = &s[s.find("timesh1t_done_")? + "timesh1t_done_".len()..];
                        let digits: String =
                            rest.chars().take_while(|c| c.is_ascii_digit()).collect();
                        digits.parse::<u32>().ok()
                    });
                    if let Some(n) = filled {
                        let _ = handle.emit("appsmith-filled", n);
                        break;
                    }
                }
                None => break, // window closed without finishing
            }
        }
        DONE_POLL_ACTIVE.store(false, Ordering::SeqCst);
    });
}

// Open the Appsmith webview with the fill script injected. If the window is already open,
// reuse it — recreating forces the whole Azure+Duo SSO login again — and hand the fresh
// rows to the fill script via the __timesh1tSendRows relay instead.
#[tauri::command]
async fn open_appsmith_filler(app: tauri::AppHandle, url: String, rows_json: String) -> Result<(), String> {
    if let Some(w) = app.get_webview_window("appsmith") {
        w.eval(&format!("window.__timesh1tSendRows && window.__timesh1tSendRows({rows_json})"))
            .map_err(|e| e.to_string())?;
        let _ = w.set_focus();
        spawn_done_poll(app.clone());
        return Ok(());
    }
    let script = APPSMITH_FILL_SCRIPT.replace("__ROWS__", &rows_json);
    tauri::WebviewWindowBuilder::new(
        &app,
        "appsmith",
        tauri::WebviewUrl::External(url.parse().map_err(|e| format!("bad Appsmith URL: {e}"))?),
    )
    .title("Msync")
    .inner_size(1200.0, 850.0)
    .initialization_script_for_all_frames(&script)
    .build()
    .map_err(|e| e.to_string())?;
    spawn_done_poll(app.clone());
    Ok(())
}

// Open-or-focus the Msync park window. Reuse keeps the SSO session alive.
#[tauri::command]
async fn open_park_window(app: tauri::AppHandle, url: String) -> Result<(), String> {
    if let Some(w) = app.get_webview_window("park") {
        let _ = w.set_focus();
        return Ok(());
    }
    tauri::WebviewWindowBuilder::new(
        &app,
        "park",
        tauri::WebviewUrl::External(url.parse().map_err(|e| format!("bad Msync URL: {e}"))?),
    )
    .title("Msync Park")
    .inner_size(1200.0, 850.0)
    .build()
    .map_err(|e| e.to_string())?;
    Ok(())
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
        .invoke_handler(tauri::generate_handler![greet, ask_claude, claude_status, open_appsmith_filler, open_park_window])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
