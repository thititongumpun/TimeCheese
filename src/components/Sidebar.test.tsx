import { render, screen, fireEvent } from '@testing-library/preact'
import { beforeEach, describe, it, expect, vi } from 'vitest'
import { LocationProvider } from 'preact-iso'
import { Sidebar } from './Sidebar'
import { currentUser } from '../store/auth'

vi.mock('../services/auth', () => ({ signOut: vi.fn() }))
vi.mock('@tauri-apps/api/app', () => ({ getVersion: vi.fn().mockResolvedValue('1.2.3') }))
vi.mock('@tauri-apps/plugin-updater', () => ({ check: vi.fn().mockResolvedValue(null) }))
vi.mock('@tauri-apps/plugin-process', () => ({ relaunch: vi.fn() }))

describe('Sidebar', () => {
  beforeEach(() => {
    localStorage.clear()
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
    expect(screen.getByText('TimeSh1t')).toBeInTheDocument()
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

    const themeToggle = screen.getByRole('checkbox', { name: /use dark mode/i })
    expect(themeToggle).toBeChecked()
    fireEvent.click(themeToggle)

    expect(document.documentElement.dataset.theme).toBe('light')
    expect(localStorage.getItem('timesh1t-theme')).toBe('light')
  })
})
