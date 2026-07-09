import { useLocation } from 'preact-iso'
import { useEffect, useState } from 'preact/hooks'
import { getVersion } from '@tauri-apps/api/app'
import { check, type Update } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'
import packageJson from '../../package.json'
import { changePassword, signOut, updateProfile } from '../services/auth'
import { currentUser } from '../store/auth'
import { onlineUsers, updatePresence } from '../store/presence'
import { applyTheme, getStoredTheme, type ThemeMode } from '../lib/theme'

// Lucide-style stroke icons, drawn with currentColor so they inherit the link's theme color.
const ICONS: Record<string, string[]> = {
  clock: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18', 'M12 7.5V12l3 2'],
  sun: ['M12 4V2M12 22v-2M4 12H2M22 12h-2M6 6 4.5 4.5M19.5 19.5 18 18M18 6l1.5-1.5M4.5 19.5 6 18', 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8'],
  moon: ['M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z'],
  home: ['M3 10.5 12 3l9 7.5', 'M5 9.5V20h14V9.5', 'M9.5 20v-5.5h5V20'],
  projects: ['M3 8h18v11H3z', 'M8 8V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2', 'M3 13h18'],
  archived: ['M3 4h18v4H3z', 'M5 8v11h14V8', 'M9.5 12h5'],
  holiday: ['M4 5h16v15H4z', 'M4 9h16', 'M8 3v4M16 3v4'],
  notes: ['M6 3h8l4 4v14H6z', 'M14 3v4h4', 'M9 12h6M9 16h4'],
  ask: ['M4 5h16v11H9l-4 4V5z', 'M12 8.5a1.6 1.6 0 0 1 1.6 1.6c0 1.2-1.6 1.2-1.6 2.4', 'M12 14.5h.01'],
  jira: ['M12 2 20 12l-8 10L4 12z', 'M12 8l4 4-4 4-4-4z'],
  timeline: ['M3 12h4l2.5-7 4 14 2.5-7H21'],
}

function Icon({ paths, class: cls = 'h-[18px] w-[18px]' }: { paths: string[]; class?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"
      stroke-linecap="round" stroke-linejoin="round" class={`${cls} shrink-0`}>
      {paths.map((d) => <path key={d} d={d} />)}
    </svg>
  )
}

const NAV = [
  { href: '/', label: 'Home', icon: 'home', exact: true },
  { href: '/projects', label: 'Projects', icon: 'projects' },
  { href: '/archived', label: 'Archived', icon: 'archived' },
  { href: '/holiday', label: 'Holiday', icon: 'holiday' },
  { href: '/notes', label: 'Notes', icon: 'notes' },
  { href: '/ask', label: 'Ask', icon: 'ask' },
  { href: '/jira', label: 'Jira', icon: 'jira' },
  { href: '/timeline', label: 'Timeline', icon: 'timeline' },
]

export function Sidebar() {
  const { url } = useLocation()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [theme, setTheme] = useState<ThemeMode>(getStoredTheme)
  const [version, setVersion] = useState(packageJson.version)
  const [update, setUpdate] = useState<Update | null>(null)
  const [updateStatus, setUpdateStatus] = useState('')
  const [checkingUpdate, setCheckingUpdate] = useState(false)
  const [installingUpdate, setInstallingUpdate] = useState(false)
  const [updateModalOpen, setUpdateModalOpen] = useState(false)
  const user = currentUser.value
  const online = onlineUsers.value
  const email = user?.email ?? 'Signed-in user'
  const displayName = user?.user_metadata?.full_name
    ?? user?.user_metadata?.name
    ?? email.split('@')[0]
  const avatarUrl = user?.user_metadata?.avatar_url
    ?? user?.user_metadata?.picture
  const [avatarInput, setAvatarInput] = useState(avatarUrl ?? '')
  const [savingAvatar, setSavingAvatar] = useState(false)
  const [avatarStatus, setAvatarStatus] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)
  const [passwordStatus, setPasswordStatus] = useState('')
  const initials = displayName
    .split(/\s+/)
    .map((part: string) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  useEffect(() => {
    getVersion().then(setVersion).catch(() => {
      setVersion(packageJson.version)
    })
  }, [])

  // Auto-check for an update once on app open. Silent: only surfaces the banner if one
  // exists. ponytail: no status/spinner noise on startup — fails quietly (e.g. no network).
  useEffect(() => {
    check().then(setUpdate).catch(() => {})
  }, [])

  // Signature: a live clock — this is a timesheet app, so the current time is the identity.
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  const clock = now.toLocaleTimeString([], { hour12: false })
  const today = now.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })

  async function saveAvatar() {
    setSavingAvatar(true)
    setAvatarStatus('')
    const { data, error } = await updateProfile({ avatar_url: avatarInput.trim() })
    // re-broadcast to presence so other online users see the new avatar
    if (!error && data.user) updatePresence({
      email: data.user.email ?? 'unknown',
      name: displayName,
      avatar: data.user.user_metadata?.avatar_url,
    })
    setAvatarStatus(error ? error.message : 'Saved.')
    setSavingAvatar(false)
  }

  async function savePassword() {
    // ponytail: 6 is Supabase's default minimum; raise here if you raise it in the dashboard
    if (newPassword.length < 6) {
      setPasswordStatus('Password must be at least 6 characters.')
      return
    }
    setSavingPassword(true)
    setPasswordStatus('')
    const { error } = await changePassword(email, currentPassword, newPassword)
    if (error) {
      setPasswordStatus(error.message)
    } else {
      setPasswordStatus('Password changed.')
      setCurrentPassword('')
      setNewPassword('')
    }
    setSavingPassword(false)
  }

  function changeTheme(nextTheme: ThemeMode) {
    setTheme(nextTheme)
    applyTheme(nextTheme)
  }

  async function checkForUpdate() {
    setCheckingUpdate(true)
    setUpdateStatus('')
    setUpdate(null)

    try {
      const availableUpdate = await check()
      setUpdate(availableUpdate)
      setUpdateStatus(
        availableUpdate
          ? `Version ${availableUpdate.version} is available.`
          : 'You are using the latest version.',
      )
    } catch (error) {
      setUpdateStatus(
        error instanceof Error
          ? `Could not check for updates: ${error.message}`
          : 'Could not check for updates.',
      )
    } finally {
      setCheckingUpdate(false)
    }
  }

  async function installUpdate() {
    if (!update) return

    setInstallingUpdate(true)
    setUpdateStatus(`Downloading version ${update.version}...`)

    try {
      await update.downloadAndInstall()
      setUpdateStatus('Update installed. Restarting...')
      await relaunch()
    } catch (error) {
      setUpdateStatus(
        error instanceof Error
          ? `Could not install update: ${error.message}`
          : 'Could not install update.',
      )
      setInstallingUpdate(false)
    }
  }

  return (
    <aside class="flex h-screen w-52 flex-col border-r border-base-300 bg-base-200">
      {/* Brand + live clock (signature) */}
      <div class="px-4 pt-4 pb-3">
        <div class="flex items-center gap-2">
          <span class="grid h-8 w-8 place-items-center rounded-lg bg-primary/15 text-primary">
            <Icon paths={ICONS.clock} />
          </span>
          <span class="text-lg font-bold tracking-tight">T1meSh1t</span>
        </div>
        <div class="mt-2 flex items-baseline gap-2 font-mono tabular-nums">
          <span class="text-2xl font-semibold leading-none">{clock}</span>
          <span class="text-[0.65rem] uppercase tracking-widest opacity-50">{today}</span>
        </div>
      </div>

      <nav class="flex-1 space-y-0.5 overflow-y-auto px-2 py-2">
        {NAV.map((item) => {
          const active = item.exact ? url === item.href : url.startsWith(item.href)
          return (
            <a
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              class={`flex items-center gap-3 rounded-lg py-2 pr-3 text-sm transition-colors ${
                active
                  ? 'bg-primary/10 font-medium text-primary'
                  : 'text-base-content/70 hover:bg-base-300/60 hover:text-base-content'
              }`}
            >
              <span class={`h-5 w-0.5 rounded-full ${active ? 'bg-primary' : 'bg-transparent'}`} />
              <Icon paths={ICONS[item.icon]} />
              <span>{item.label}</span>
            </a>
          )
        })}
      </nav>
      {new Date().getDate() === 25 && (
        <div class="px-3 pb-2">
          <div class="alert alert-warning px-3 py-2 text-xs" role="alert">
            <span>Timesheet cutoff is today — submit yours before end of day.</span>
          </div>
        </div>
      )}
      <div class="px-3 pb-1">
        <div class="flex items-center gap-2 px-2 py-1 text-sm opacity-80">
          <span class="inline-block h-2 w-2 rounded-full bg-success" />
          {online.length} online
        </div>
        <div class="mt-1 flex flex-wrap gap-1 px-2">
          {online.map((u) => (
            <div key={u.email} class="tooltip tooltip-right" data-tip={u.name}>
              <div class="avatar placeholder">
                <div class="h-7 w-7 rounded-full bg-neutral text-neutral-content">
                  {u.avatar
                    ? <img src={u.avatar} alt={u.name} referrerPolicy="no-referrer" />
                    : <span class="text-xs">{u.name.slice(0, 2).toUpperCase()}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick light/dark switch — the full theme row still lives in Settings */}
      <div class="px-3 pb-2">
        <div class="join w-full">
          <button
            class={`btn join-item btn-xs flex-1 gap-1 ${theme === 'light' ? 'btn-primary' : 'btn-ghost'}`}
            aria-pressed={theme === 'light'}
            onClick={() => changeTheme('light')}
          >
            <Icon paths={ICONS.sun} class="h-3.5 w-3.5" /> Light
          </button>
          <button
            class={`btn join-item btn-xs flex-1 gap-1 ${theme === 'dark' ? 'btn-primary' : 'btn-ghost'}`}
            aria-pressed={theme === 'dark'}
            onClick={() => changeTheme('dark')}
          >
            <Icon paths={ICONS.moon} class="h-3.5 w-3.5" /> Dark
          </button>
        </div>
      </div>

      {update && (
        <div class="px-3 pb-2">
          <button
            class="btn btn-primary btn-xs w-full justify-start gap-1 normal-case"
            onClick={() => setUpdateModalOpen(true)}
          >
            <span class="inline-block h-2 w-2 shrink-0 rounded-full bg-primary-content" />
            <span class="min-w-0 truncate">Update v{update.version}</span>
          </button>
        </div>
      )}
      <div class="p-3">
        <button
          class="btn btn-ghost h-auto min-h-0 w-full justify-start gap-3 px-2 py-2"
          aria-label="Open user settings"
          onClick={() => setSettingsOpen(true)}
        >
          <div class="avatar placeholder">
            <div class="w-9 rounded-full bg-primary text-primary-content">
              {avatarUrl
                ? <img src={avatarUrl} alt="" referrerPolicy="no-referrer" />
                : <span class="text-xs font-semibold">{initials}</span>}
            </div>
          </div>
          <div class="min-w-0 text-left">
            <div class="truncate text-sm font-medium">{displayName}</div>
            <div class="truncate text-xs opacity-60">Settings</div>
          </div>
        </button>
      </div>

      {settingsOpen && (
        <div class="modal modal-open" role="dialog" aria-modal="true" aria-labelledby="settings-title">
          <div class="modal-box max-w-md">
            <div class="flex items-center justify-between">
              <h2 id="settings-title" class="text-xl font-bold">Settings</h2>
              <button
                class="btn btn-circle btn-ghost btn-sm"
                aria-label="Close settings"
                onClick={() => setSettingsOpen(false)}
              >
                X
              </button>
            </div>

            <div class="mt-6 flex items-center gap-4">
              <div class="avatar placeholder">
                <div class="w-14 rounded-full bg-primary text-primary-content">
                  {avatarUrl
                    ? <img src={avatarUrl} alt={`${displayName} avatar`} referrerPolicy="no-referrer" />
                    : <span class="font-semibold">{initials}</span>}
                </div>
              </div>
              <div class="min-w-0">
                <div class="truncate font-semibold">{displayName}</div>
                <div class="truncate text-sm opacity-60">{email}</div>
              </div>
            </div>

            <div class="divider" />

            <div class="fieldset">
              <label class="label" for="avatar-url">
                <span class="label font-medium">Avatar URL</span>
              </label>
              <div class="flex gap-2">
                <input
                  id="avatar-url"
                  type="url"
                  placeholder="https://…"
                  class="input input-sm flex-1"
                  value={avatarInput}
                  onInput={(e) => setAvatarInput(e.currentTarget.value)}
                />
                <button class="btn btn-sm btn-primary" disabled={savingAvatar} onClick={saveAvatar}>
                  {savingAvatar && <span class="loading loading-spinner loading-xs" />}
                  Save
                </button>
              </div>
              {avatarStatus && <div class="mt-2 text-sm opacity-60" role="status">{avatarStatus}</div>}
            </div>

            <div class="divider" />

            <div class="fieldset">
              <label class="label" for="new-password">
                <span class="label font-medium">Change password</span>
              </label>
              <input
                id="current-password"
                type="password"
                autocomplete="current-password"
                placeholder="Current password"
                class="input input-sm w-full mb-2"
                value={currentPassword}
                onInput={(e) => setCurrentPassword(e.currentTarget.value)}
              />
              <div class="flex gap-2">
                <input
                  id="new-password"
                  type="password"
                  autocomplete="new-password"
                  placeholder="New password"
                  class="input input-sm flex-1"
                  value={newPassword}
                  onInput={(e) => setNewPassword(e.currentTarget.value)}
                />
                <button class="btn btn-sm btn-primary" disabled={savingPassword} onClick={savePassword}>
                  {savingPassword && <span class="loading loading-spinner loading-xs" />}
                  Save
                </button>
              </div>
              {passwordStatus && <div class="mt-2 text-sm opacity-60" role="status">{passwordStatus}</div>}
            </div>

            <div class="divider" />

            <div class="flex items-center justify-between">
              <div>
                <div class="font-medium">Theme</div>
                <div class="text-sm opacity-60">{theme === 'dark' ? 'Dark mode' : 'Light mode'}</div>
              </div>
              <label class="flex cursor-pointer items-center gap-2">
                <span class="text-sm">Light</span>
                <input
                  type="checkbox"
                  class="toggle toggle-primary"
                  aria-label="Use dark mode"
                  checked={theme === 'dark'}
                  onChange={(event) => {
                    changeTheme(event.currentTarget.checked ? 'dark' : 'light')
                  }}
                />
                <span class="text-sm">Dark</span>
              </label>
            </div>

            <div class="divider" />

            <div>
              <div class="flex items-center justify-between gap-4">
                <div>
                  <div class="font-medium">T1meSh1t</div>
                  <div class="text-sm opacity-60">Version {version}</div>
                </div>
                <button
                  class="btn btn-outline btn-sm"
                  disabled={checkingUpdate || installingUpdate}
                  onClick={checkForUpdate}
                >
                  {checkingUpdate && <span class="loading loading-spinner loading-xs" />}
                  Check for updates
                </button>
              </div>
              {updateStatus && (
                <div class="mt-3 rounded-lg bg-base-200 p-3 text-sm" role="status">
                  {updateStatus}
                </div>
              )}
              {update && (
                <button
                  class="btn btn-primary btn-sm mt-3 w-full"
                  disabled={installingUpdate}
                  onClick={installUpdate}
                >
                  {installingUpdate && <span class="loading loading-spinner loading-xs" />}
                  Download and install {update.version}
                </button>
              )}
            </div>

            <div class="modal-action">
              <button
                class="btn btn-error btn-outline btn-sm"
                onClick={async () => {
                  const { error } = await signOut()
                  if (error) alert(error.message)
                }}
              >
                Sign out
              </button>
            </div>
          </div>
          <button
            class="modal-backdrop"
            aria-label="Close settings"
            onClick={() => setSettingsOpen(false)}
          />
        </div>
      )}

      {update && updateModalOpen && (
        <div class="modal modal-open" role="dialog" aria-modal="true" aria-labelledby="update-title">
          <div class="modal-box max-w-md">
            <div class="flex items-center justify-between">
              <h2 id="update-title" class="text-xl font-bold">Update available</h2>
              <button
                class="btn btn-circle btn-ghost btn-sm"
                aria-label="Close update"
                onClick={() => setUpdateModalOpen(false)}
              >
                X
              </button>
            </div>

            <div class="mt-2 text-sm opacity-70">
              Version {update.version}
              {update.date && ` · ${update.date.split(' ')[0]}`}
            </div>

            <div class="divider my-3" />

            <div class="text-sm font-medium">What's new</div>
            <pre class="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-base-200 p-3 text-sm font-sans">
              {update.body?.trim() || 'No release notes provided.'}
            </pre>

            {updateStatus && (
              <div class="mt-3 rounded-lg bg-base-200 p-3 text-sm" role="status">
                {updateStatus}
              </div>
            )}

            <button
              class="btn btn-primary btn-sm mt-4 w-full"
              disabled={installingUpdate}
              onClick={installUpdate}
            >
              {installingUpdate && <span class="loading loading-spinner loading-xs" />}
              Download and install {update.version}
            </button>
          </div>
          <button
            class="modal-backdrop"
            aria-label="Close update"
            onClick={() => setUpdateModalOpen(false)}
          />
        </div>
      )}
    </aside>
  )
}
