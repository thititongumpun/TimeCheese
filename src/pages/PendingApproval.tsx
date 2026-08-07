import { useState } from 'preact/hooks'
import { getMyApproval, signOut } from '../services/auth'
import { approved } from '../store/auth'

export function PendingApproval() {
  const [checking, setChecking] = useState(false)
  const [stillPending, setStillPending] = useState(false)

  async function checkAgain() {
    setChecking(true)
    setStillPending(false)
    const { data, error } = await getMyApproval()
    const isApproved = !error && data?.approved === true
    approved.value = isApproved
    if (!isApproved) setStillPending(true)
    setChecking(false)
  }

  return (
    <div class="min-h-screen flex items-center justify-center bg-base-100">
      <div class="card w-96 bg-base-200 border-2 border-base-300">
        <div class="card-body">
          <h2 class="card-title font-display font-extrabold text-2xl mb-1">TimeCheese</h2>
          <p class="text-sm opacity-60 -mt-1 mb-4">Account created — waiting for admin approval</p>

          <div class="alert alert-info mb-4">
            <span>Your account is ready but needs an admin to approve access. Ping your admin, then check back here.</span>
          </div>

          {stillPending && (
            <div class="alert alert-warning mb-4">
              <span>Still pending — not approved yet.</span>
            </div>
          )}

          <button type="button" class="btn btn-primary w-full" onClick={checkAgain} disabled={checking}>
            {checking && <span class="loading loading-spinner loading-xs mr-2" />}
            Check again
          </button>
          <button
            type="button"
            class="btn btn-ghost btn-sm w-full mt-2 normal-case"
            onClick={() => signOut()}
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  )
}
