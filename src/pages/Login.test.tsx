import { render, screen, fireEvent, waitFor } from '@testing-library/preact'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Login } from './Login'

vi.mock('../services/auth', () => ({
  signIn: vi.fn(),
}))

import { signIn } from '../services/auth'

describe('Login', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders email and password inputs', () => {
    render(<Login />)
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })

  it('calls signIn with entered credentials on submit', async () => {
    vi.mocked(signIn).mockResolvedValue({ data: { user: { id: '1' }, session: {} }, error: null } as any)
    render(<Login />)

    fireEvent.input(screen.getByLabelText(/email/i), { target: { value: 'user@example.com' } })
    fireEvent.input(screen.getByLabelText(/password/i), { target: { value: 'secret' } })
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => expect(signIn).toHaveBeenCalledWith('user@example.com', 'secret'))
  })

  it('shows error alert when signIn returns an error', async () => {
    vi.mocked(signIn).mockResolvedValue({ data: null, error: { message: 'Invalid credentials' } } as any)
    render(<Login />)

    fireEvent.input(screen.getByLabelText(/email/i), { target: { value: 'bad@example.com' } })
    fireEvent.input(screen.getByLabelText(/password/i), { target: { value: 'wrong' } })
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => expect(screen.getByText('Invalid credentials')).toBeInTheDocument())
  })
})
