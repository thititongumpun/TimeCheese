import { useLocation } from 'preact-iso'
import { useEffect, useState } from 'preact/hooks'
import { getVersion } from '@tauri-apps/api/app'
import { check, type Update } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'
import packageJson from '../../package.json'
import { changePassword, signOut, updateProfile } from '../services/auth'
import { currentUser } from '../store/auth'
import { onlineUsers } from '../store/presence'
import { applyTheme, getStoredTheme, type ThemeMode } from '../lib/theme'

export function Sidebar() {
  const { url } = useLocation()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [theme, setTheme] = useState<ThemeMode>(getStoredTheme)
  const [version, setVersion] = useState(packageJson.version)
  const [update, setUpdate] = useState<Update | null>(null)
  const [updateStatus, setUpdateStatus] = useState('')
  const [checkingUpdate, setCheckingUpdate] = useState(false)
  const [installingUpdate, setInstallingUpdate] = useState(false)
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

  async function saveAvatar() {
    setSavingAvatar(true)
    setAvatarStatus('')
    const { error } = await updateProfile({ avatar_url: avatarInput.trim() })
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
    <aside class="w-48 h-screen bg-base-200 flex flex-col">
      <div class="p-4 font-bold text-xl text-primary">TimeSh1t</div>
      <nav class="flex-1 px-2">
        <ul class="menu menu-sm">
          <li>
            <a href="/" class={url === '/' ? 'active' : ''}>
              Home
            </a>
          </li>
          <li>
            <a href="/projects" class={url.startsWith('/projects') ? 'active' : ''}>
              Projects
            </a>
          </li>
          <li>
            <a href="/archived" class={url.startsWith('/archived') ? 'active' : ''}>
              Archived
            </a>
          </li>
          <li>
            <a href="/holiday" class={url.startsWith('/holiday') ? 'active' : ''}>
              Holiday
            </a>
          </li>
          <li>
            <a href="/notes" class={url.startsWith('/notes') ? 'active' : ''}>
              Notes
            </a>
          </li>
        </ul>
      </nav>
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

            <div class="form-control">
              <label class="label" for="avatar-url">
                <span class="label-text font-medium">Avatar URL</span>
              </label>
              <div class="flex gap-2">
                <input
                  id="avatar-url"
                  type="url"
                  placeholder="https://…"
                  class="input input-bordered input-sm flex-1"
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

            <div class="form-control">
              <label class="label" for="new-password">
                <span class="label-text font-medium">Change password</span>
              </label>
              <input
                id="current-password"
                type="password"
                autocomplete="current-password"
                placeholder="Current password"
                class="input input-bordered input-sm mb-2"
                value={currentPassword}
                onInput={(e) => setCurrentPassword(e.currentTarget.value)}
              />
              <div class="flex gap-2">
                <input
                  id="new-password"
                  type="password"
                  autocomplete="new-password"
                  placeholder="New password"
                  class="input input-bordered input-sm flex-1"
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
                  <div class="font-medium">TimeSh1t</div>
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
    </aside>
  )
}
