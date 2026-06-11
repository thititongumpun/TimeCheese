import { supabase } from '../lib/supabase'
import { summarizeDescription } from './cloudflare-ai'
import type { TimesheetFilters, TimesheetInput } from '../types'

export async function fetchTimesheets(filters: TimesheetFilters) {
  let query = supabase
    .from('timesheets')
    .select('*, projects(project_name, project_no)')

  if (filters.date_from) query = query.gte('date_memo', filters.date_from)
  if (filters.date_to) query = query.lte('date_memo', filters.date_to)
  if (filters.project_id) query = query.eq('project_id', filters.project_id)
  if (filters.status === 'complete') query = query.eq('is_complete', true)
  if (filters.status === 'incomplete') query = query.eq('is_complete', false)

  return query.order('date_memo', { ascending: false })
}

export async function createTimesheet(data: TimesheetInput) {
  const aiSummary = await summarizeDescription(data.description)

  return supabase
    .from('timesheets')
    .insert({ ...data, ai_summary: aiSummary })
    .select()
    .single()
}

export async function updateTimesheet(id: string, data: Partial<TimesheetInput>) {
  return supabase.from('timesheets').update(data).eq('id', id).select().single()
}

export async function deleteTimesheet(id: string) {
  return supabase.from('timesheets').delete().eq('id', id)
}
