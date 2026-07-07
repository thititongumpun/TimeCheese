import { supabase } from '../lib/supabase'
import { getAuthenticatedUserId } from './auth-user'
import { summarizeDescription, embedText, summarizeMonth } from './cloudflare-ai'
import type { TimesheetFilters, TimesheetInput } from '../types'

// Row shape returned by the match_archived_timesheets RPC (subset of columns + similarity score).
export type ArchivedMatch = {
  id: number
  description: string
  ai_summary: string | null
  date_memo: string
  similarity: number | null // null for keyword (ILIKE) hits — there's no cosine score
}

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

  return query
    .order('date_memo', { ascending: false })
    .order('start_time', { ascending: true, nullsFirst: true })
}

// Same-day slots for overlap/8h validation, excluding the entry being edited.
export async function fetchDaySlots(date: string, excludeId?: string) {
  const userId = await getAuthenticatedUserId()
  let query = supabase
    .from('timesheets')
    .select('id, start_time, end_time')
    .eq('user_id', userId)
    .gte('date_memo', date)
    .lte('date_memo', date)
  if (excludeId) query = query.neq('id', excludeId)
  return query.order('start_time', { ascending: true })
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

// Semantic search over archived rows: embed the query, return nearest neighbours.
// The RPC runs with security invoker, so RLS scopes results to the caller's own rows.
export async function searchArchived(query: string, matchCount = 20) {
  const embedding = await embedText(query)
  return supabase.rpc('match_archived_timesheets', {
    query_embedding: embedding,
    match_count: matchCount,
  })
}

// Keyword search over archived rows for short/acronym queries (e.g. "SIT"), where
// dense embeddings are noise. Plain ILIKE on description + summary, newest first.
// ponytail: term goes raw into the .or filter — a literal comma/paren would break it;
// fine for single-token codes, escape if free-text keyword search is ever added.
export async function keywordSearchArchived(term: string, matchCount = 20) {
  const userId = await getAuthenticatedUserId()
  const like = `%${term}%`
  return supabase
    .from('archived_timesheets')
    .select('id, description, ai_summary, date_memo')
    .eq('user_id', userId)
    .or(`description.ilike.${like},ai_summary.ilike.${like}`)
    .order('date_memo', { ascending: false })
    .limit(matchCount)
}

// One-time / re-runnable backfill: embed every archived row that has no embedding yet.
// Each batch is embedded + written concurrently; onProgress reports the running total. Safe to re-run.
// ponytail: batchSize=20 concurrent worker calls; lower it if Workers AI starts rate-limiting (429s).
export async function indexMissingEmbeddings(
  onProgress?: (indexed: number) => void,
  batchSize = 20,
): Promise<{ indexed: number }> {
  const userId = await getAuthenticatedUserId()
  let indexed = 0

  for (;;) {
    const { data, error } = await supabase
      .from('archived_timesheets')
      .select('id, description, ai_summary')
      .eq('user_id', userId)
      .is('embedding', null)
      .limit(batchSize)
    if (error) throw new Error(error.message)
    if (!data || data.length === 0) break

    await Promise.all(data.map(async (row) => {
      const text = [row.description, row.ai_summary].filter(Boolean).join('\n')
      const embedding = await embedText(text)
      const { error: updateError } = await supabase
        .from('archived_timesheets')
        .update({ embedding })
        .eq('id', row.id)
      if (updateError) throw new Error(updateError.message)
    }))

    indexed += data.length
    onProgress?.(indexed)
  }

  return { indexed }
}

// Cached per-month AI digest. Archived months are immutable, so a digest is generated
// once on first view and reused; entry_count guards a still-filling month. `force` regenerates.
// Returns the summary text; throws if the worker fails and there's no usable cache.
export async function getOrCreateMonthlySummary(
  year: number,
  month: number, // 1-12
  entries: { description: string; ai_summary: string | null }[],
  { force = false }: { force?: boolean } = {},
): Promise<string> {
  const userId = await getAuthenticatedUserId()

  if (!force) {
    const { data: cached } = await supabase
      .from('monthly_summaries')
      .select('summary, entry_count')
      .eq('user_id', userId)
      .eq('year', year)
      .eq('month', month)
      .maybeSingle()
    if (cached && cached.entry_count === entries.length) return cached.summary
  }

  const text = entries.map((e) => e.ai_summary || e.description).filter(Boolean).join('\n\n')
  const summary = await summarizeMonth(text)

  const { error } = await supabase
    .from('monthly_summaries')
    .upsert(
      { user_id: userId, year, month, summary, entry_count: entries.length, generated_at: new Date().toISOString() },
      { onConflict: 'user_id,year,month' },
    )
  if (error) throw new Error(error.message)

  return summary
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
