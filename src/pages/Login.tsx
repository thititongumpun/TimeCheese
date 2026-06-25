import { useState } from 'preact/hooks'
import { signIn, sendSetupCode, verifyCodeAndSetPassword } from '../services/auth'

export function Login() {
  const [mode, setMode] = useState<'signin' | 'setup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [codeSent, setCodeSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSignIn(e: Event) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await signIn(email, password)
    if (error) setError(error.message)
    setLoading(false)
  }

  async function handleSendCode(e: Event) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await sendSetupCode(email)
    if (error) setError(error.message)
    else {
      setCodeSent(true)
      setInfo('Check your email for a 6-digit code.')
    }
    setLoading(false)
  }

  async function handleSetPassword(e: Event) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await verifyCodeAndSetPassword(email, code.trim(), password)
    if (error) setError(error.message)
    // success: onAuthStateChange swaps to the app automatically
    setLoading(false)
  }

  function switchMode(next: 'signin' | 'setup') {
    setMode(next)
    setError(null)
    setInfo(null)
    setCodeSent(false)
    setPassword('')
    setCode('')
  }

  return (
    <div class="min-h-screen flex items-center justify-center bg-base-100">
      <div class="card w-96 bg-base-200 shadow-xl">
        <div class="card-body">
          <h2 class="card-title text-2xl mb-2">TimeSh1t</h2>

          {error && (
            <div class="alert alert-error mb-4">
              <span>{error}</span>
            </div>
          )}
          {info && !error && (
            <div class="alert alert-info mb-4">
              <span>{info}</span>
            </div>
          )}

          {mode === 'signin' && (
            <form onSubmit={handleSignIn}>
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
              <button type="submit" class="btn btn-primary w-full" disabled={loading}>
                {loading && <span class="loading loading-spinner loading-xs mr-2" />}
                Sign in
              </button>
              <button
                type="button"
                class="btn btn-ghost btn-sm w-full mt-2 normal-case"
                onClick={() => switchMode('setup')}
              >
                First time? Set up your password
              </button>
            </form>
          )}

          {mode === 'setup' && (
            <form onSubmit={codeSent ? handleSetPassword : handleSendCode}>
              <div class="form-control mb-4">
                <label class="label" for="setup-email">
                  <span class="label-text">Email</span>
                </label>
                <input
                  id="setup-email"
                  type="email"
                  class="input input-bordered"
                  value={email}
                  onInput={(e) => setEmail(e.currentTarget.value)}
                  disabled={codeSent}
                  required
                />
              </div>

              {codeSent && (
                <>
                  <div class="form-control mb-4">
                    <label class="label" for="code">
                      <span class="label-text">6-digit code</span>
                    </label>
                    <input
                      id="code"
                      type="text"
                      inputMode="numeric"
                      autocomplete="one-time-code"
                      class="input input-bordered tracking-widest"
                      value={code}
                      onInput={(e) => setCode(e.currentTarget.value)}
                      required
                    />
                  </div>
                  <div class="form-control mb-6">
                    <label class="label" for="new-password">
                      <span class="label-text">New password</span>
                    </label>
                    <input
                      id="new-password"
                      type="password"
                      class="input input-bordered"
                      value={password}
                      onInput={(e) => setPassword(e.currentTarget.value)}
                      minLength={6}
                      required
                    />
                  </div>
                </>
              )}

              <button type="submit" class="btn btn-primary w-full" disabled={loading}>
                {loading && <span class="loading loading-spinner loading-xs mr-2" />}
                {codeSent ? 'Set password & sign in' : 'Email me a code'}
              </button>
              <button
                type="button"
                class="btn btn-ghost btn-sm w-full mt-2 normal-case"
                onClick={() => switchMode('signin')}
              >
                Back to sign in
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
