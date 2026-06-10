import { useState } from 'preact/hooks'
import { signIn } from '../services/auth'

export function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: Event) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await signIn(email, password)
    if (error) setError(error.message)
    setLoading(false)
  }

  return (
    <div class="min-h-screen flex items-center justify-center bg-base-100">
      <div class="card w-96 bg-base-200 shadow-xl">
        <div class="card-body">
          <h2 class="card-title text-2xl mb-2">TimeSh1t</h2>
          <form onSubmit={handleSubmit}>
            {error && (
              <div class="alert alert-error mb-4">
                <span>{error}</span>
              </div>
            )}
            <div class="form-control mb-4">
              <label class="label" for="email">
                <span class="label-text">Email</span>
              </label>
              <input
                id="email"
                type="email"
                class="input input-bordered"
                value={email}
                onInput={(e) => setEmail(e.currentTarget.value)}
                required
              />
            </div>
            <div class="form-control mb-6">
              <label class="label" for="password">
                <span class="label-text">Password</span>
              </label>
              <input
                id="password"
                type="password"
                class="input input-bordered"
                value={password}
                onInput={(e) => setPassword(e.currentTarget.value)}
                required
              />
            </div>
            <button
              type="submit"
              class={`btn btn-primary w-full ${loading ? 'loading' : ''}`}
              disabled={loading}
            >
              Sign in
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
