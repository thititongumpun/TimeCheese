import { supabase } from '../lib/supabase'
import { currentUser } from '../store/auth'

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (!error && data.user) currentUser.value = data.user
  return { data, error }
}

// First-time setup: email a 6-digit code to an already-provisioned user.
// shouldCreateUser:false so only dashboard-created accounts can request one.
export async function sendSetupCode(email: string) {
  return supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } })
}

// Verify the emailed code (signs them in), then set their chosen password.
export async function verifyCodeAndSetPassword(email: string, token: string, password: string) {
  const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' })
  if (error) return { error }
  const { data, error: pwError } = await supabase.auth.updateUser({ password })
  if (!pwError && data.user) currentUser.value = data.user
  return { error: pwError }
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (!error) currentUser.value = null
  return { error }
}

export async function updateProfile(data: { avatar_url?: string; full_name?: string }) {
  const { data: result, error } = await supabase.auth.updateUser({ data })
  if (!error && result.user) currentUser.value = result.user
  return { data: result, error }
}

export async function changePassword(email: string, currentPassword: string, newPassword: string) {
  // Supabase has no verify-password call; re-auth to prove the current password.
  const { error: authError } = await supabase.auth.signInWithPassword({ email, password: currentPassword })
  if (authError) return { data: null, error: authError }
  const { data, error } = await supabase.auth.updateUser({ password: newPassword })
  if (!error && data.user) currentUser.value = data.user
  return { data, error }
}

export async function getSession() {
  const { data, error } = await supabase.auth.getSession()
  if (!error && data.session) currentUser.value = data.session.user
  return { data, error }
}
