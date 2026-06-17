import { signal } from '@preact/signals'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export interface OnlineUser {
  email: string
  name: string
}

export const onlineUsers = signal<OnlineUser[]>([])

let channel: RealtimeChannel | null = null

export function startPresence(user: OnlineUser) {
  if (channel) return
  channel = supabase.channel('online-users', { config: { presence: { key: user.email } } })
  channel
    .on('presence', { event: 'sync' }, () => {
      const state = channel!.presenceState<OnlineUser>()
      // one key per user; take the first metadata entry for each
      onlineUsers.value = Object.values(state).map((entries) => entries[0])
    })
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') channel!.track(user)
    })
}

export function stopPresence() {
  if (!channel) return
  supabase.removeChannel(channel)
  channel = null
  onlineUsers.value = []
}
