import { render, screen } from '@testing-library/preact'
import { describe, it, expect, vi } from 'vitest'
import { LocationProvider } from 'preact-iso'
import { Sidebar } from './Sidebar'

vi.mock('../services/auth', () => ({ signOut: vi.fn() }))

describe('Sidebar', () => {
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

  it('renders sign out button', () => {
    renderSidebar()
    expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument()
  })
})
