import { supabase } from '../lib/supabase'
import { getAuthenticatedUserId } from './auth-user'
import { summarizeDescription } from './cloudflare-ai'
import type { TimesheetFilters, TimesheetInput } from '../types'

export async function fetchTimesheets(filters: TimesheetFilters) {
  const userId = await getAuthenticatedUserId()
  let query = supabase
    .from('timesheets')
    .select('*, projects(project_name, project_no)')
    .eq('user_id', userId)

  if (filters.date_from) query = query.gte('date_memo', filters.date_from)
  if (filters.date_to) query = query.lte('date_memo', filters.date_to)
  if (filters.project_id) query = query.eq('project_id', filters.project_id)
  if (filters.status === 'complete') query = query.eq('is_complete', true)
  if (filters.status === 'incomplete') query = query.eq('is_complete', false)

  return query.order('date_memo', { ascending: false })
}

// from/to are 'YYYY-MM-DD', both inclusive. Returns every archived row in range (no pagination).
export async function fetchArchivedTimesheetsInRange(from: string, to: string) {
  const userId = await getAuthenticatedUserId()
  const [y, m, d] = to.split('-').map(Number)
  const end = new Date(y, m - 1, d + 1) // exclusive upper bound — covers the whole `to` day
  const endStr = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`
  return supabase
    .from('archived_timesheets')
    .select('*, projects(project_name, project_no)')
    .eq('user_id', userId)
    .gte('date_memo', from)
    .lt('date_memo', endStr)
    .order('date_memo', { ascending: true })
}

export async function createTimesheet(data: TimesheetInput) {
  const userId = await getAuthenticatedUserId()
  const aiSummary = await summarizeDescription(data.description)

  return supabase
    .from('timesheets')
    .insert({ ...data, ai_summary: aiSummary, user_id: userId })
    .select()
    .single()
}

export async function updateTimesheet(id: string, data: Partial<TimesheetInput>) {
  return supabase.from('timesheets').update(data).eq('id', id).select().single()
}

export async function deleteTimesheet(id: string) {
  return supabase.from('timesheets').delete().eq('id', id)
}

export async function updateTimesheets(ids: string[], data: Partial<TimesheetInput>) {
  return supabase.from('timesheets').update(data).in('id', ids).select()
}
