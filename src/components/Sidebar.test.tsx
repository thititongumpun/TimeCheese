import { render, screen, fireEvent, waitFor } from '@testing-library/preact'
import { beforeEach, describe, it, expect, vi } from 'vitest'
import { LocationProvider } from 'preact-iso'
import { Sidebar } from './Sidebar'
import { currentUser } from '../store/auth'

const { check } = vi.hoisted(() => ({ check: vi.fn() }))

vi.mock('../services/auth', () => ({ signOut: vi.fn() }))
vi.mock('@tauri-apps/api/app', () => ({ getVersion: vi.fn().mockResolvedValue('1.2.3') }))
vi.mock('@tauri-apps/plugin-updater', () => ({ check }))
vi.mock('@tauri-apps/plugin-process', () => ({ relaunch: vi.fn() }))

describe('Sidebar', () => {
  const fakeUpdate = {
    version: '4.14.0',
    date: '2026-07-25T06:56:56.126Z',
    body: 'Fixed things',
    downloadAndInstall: vi.fn(),
  } as any

  beforeEach(() => {
    localStorage.clear()
    check.mockReset()
    check.mockResolvedValue(null)
    currentUser.value = {
      id: 'user-1',
      email: 'user@example.com',
      user_metadata: { full_name: 'Example User' },
    } as any
  })

  function renderSidebar() {
    return render(
      <LocationProvider>
        <Sidebar />
      </LocationProvider>
    )
  }

  it('renders app title and nav links', () => {
    renderSidebar()
    expect(screen.getByText('TimeCheese')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Home' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Projects' })).toBeInTheDocument()
  })

  it('opens user settings from the avatar button', async () => {
    renderSidebar()

    fireEvent.click(screen.getByRole('button', { name: /open user settings/i }))

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getAllByText('Example User')).toHaveLength(2)
    expect(screen.getByText('user@example.com')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument()
    expect(await screen.findByText('Version 1.2.3')).toBeInTheDocument()
  })

  it('switches and persists the theme', () => {
    renderSidebar()
    fireEvent.click(screen.getByRole('button', { name: /open user settings/i }))

    const themeSelect = screen.getByRole('combobox', { name: /theme/i })
    expect(themeSelect).toHaveValue('timecheese')
    fireEvent.change(themeSelect, { target: { value: 'retro' } })

    expect(document.documentElement.dataset.theme).toBe('retro')
    expect(localStorage.getItem('timesh1t-theme')).toBe('retro')
  })

  it('switches and persists the Jira agent', () => {
    renderSidebar()
    fireEvent.click(screen.getByRole('button', { name: /open user settings/i }))

    const agentSelect = screen.getByRole('combobox', { name: /jira agent/i })
    expect(agentSelect).toHaveValue('auto')
    fireEvent.change(agentSelect, { target: { value: 'codex' } })

    expect(localStorage.getItem('timecheese-agent-provider')).toBe('codex')
  })

  it('auto-opens the update modal on launch', async () => {
    check.mockResolvedValue(fakeUpdate)
    renderSidebar()

    expect(await screen.findByRole('heading', { name: 'Update available' })).toBeInTheDocument()
  })

  it('formats the release date instead of showing the raw timestamp', async () => {
    check.mockResolvedValue(fakeUpdate)
    renderSidebar()
    await screen.findByRole('heading', { name: 'Update available' })

    // regex: the div's textContent is one string ("Version 4.14.0 · <date>")
    const line = screen.getByText(/Version 4\.14\.0 ·/)
    // No exact date assertion — the runner's timezone is not pinned and 06:56Z lands
    // on the previous day west of UTC.
    expect(line.textContent).not.toContain('T06:56')
    expect(line.textContent).not.toContain('Invalid Date')
  })

  it('does not auto-open for a skipped version but keeps the sidebar button', async () => {
    localStorage.setItem('timecheese-skipped-version', '4.14.0')
    check.mockResolvedValue(fakeUpdate)
    renderSidebar()

    // positive control: proves check() resolved and the update was processed
    await screen.findByRole('button', { name: /Update v4\.14\.0/ })
    expect(screen.queryByRole('heading', { name: 'Update available' })).not.toBeInTheDocument()
  })

  it('persists the skip across a remount', async () => {
    check.mockResolvedValue(fakeUpdate)
    const { unmount } = renderSidebar()
    await screen.findByRole('heading', { name: 'Update available' })

    fireEvent.click(screen.getByRole('button', { name: /Skip version 4\.14\.0/ }))
    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: 'Update available' })).not.toBeInTheDocument()
    )

    // auto-cleanup runs between tests, not within one
    unmount()
    renderSidebar()

    await screen.findByRole('button', { name: /Update v4\.14\.0/ })
    expect(screen.queryByRole('heading', { name: 'Update available' })).not.toBeInTheDocument()
  })

  it('still pops up for a newer version after a skip', async () => {
    localStorage.setItem('timecheese-skipped-version', '4.14.0')
    check.mockResolvedValue({ ...fakeUpdate, version: '4.15.0' })
    renderSidebar()

    expect(await screen.findByRole('heading', { name: 'Update available' })).toBeInTheDocument()
  })
})
