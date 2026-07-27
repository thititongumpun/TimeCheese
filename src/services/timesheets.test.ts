import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFrom = vi.hoisted(() => vi.fn())
const mockRpc = vi.hoisted(() => vi.fn())
const mockSummarizeDescription = vi.hoisted(() => vi.fn())
const mockEmbedText = vi.hoisted(() => vi.fn())
const mockSummarizeMonth = vi.hoisted(() => vi.fn())
const mockGetAuthenticatedUserId = vi.hoisted(() => vi.fn())
vi.mock('../lib/supabase', () => ({
  supabase: { from: mockFrom, rpc: mockRpc },
}))
vi.mock('./cloudflare-ai', () => ({
  summarizeDescription: mockSummarizeDescription,
  embedText: mockEmbedText,
  summarizeMonth: mockSummarizeMonth,
}))
vi.mock('./auth-user', () => ({
  getAuthenticatedUserId: mockGetAuthenticatedUserId,
}))

import {
  fetchTimesheets,
  createTimesheet,
  updateTimesheet,
  deleteTimesheet,
  searchArchived,
  getOrCreateMonthlySummary,
  fetchPreviousEntryText,
} from './timesheets'
import type { TimesheetFilters } from '../types'

function makeChain(result: any) {
  const chain: any = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(result),
    maybeSingle: vi.fn().mockResolvedValue(result),
    upsert: vi.fn().mockResolvedValue(result),
    // order() now chains (date_memo then start_time), so awaiting the chain
    // itself resolves the query result, like the real builder.
    then: (resolve: (v: any) => any) => Promise.resolve(result).then(resolve),
  }
  return chain
}

const emptyFilters: TimesheetFilters = {
  date_from: null,
  date_to: null,
  project_id: null,
  status: 'all',
}

describe('timesheets service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFrom.mockReset() // clearAllMocks leaves mockReturnValueOnce queues behind
    mockSummarizeDescription.mockResolvedValue('AI-generated summary')
    mockEmbedText.mockResolvedValue([0.1, 0.2, 0.3])
    mockSummarizeMonth.mockResolvedValue('Monthly digest')
    mockGetAuthenticatedUserId.mockResolvedValue('user-1')
  })

  it('searchArchived embeds the query and calls the match RPC', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null })

    await searchArchived('database tuning', 5)

    expect(mockEmbedText).toHaveBeenCalledWith('database tuning')
    expect(mockRpc).toHaveBeenCalledWith('match_archived_timesheets', {
      query_embedding: [0.1, 0.2, 0.3],
      match_count: 5,
    })
  })

  it('fetchTimesheets selects with project join ordered by date_memo desc', async () => {
    const chain = makeChain({ data: [], error: null })
    mockFrom.mockReturnValue(chain)

    await fetchTimesheets(emptyFilters)

    expect(mockFrom).toHaveBeenCalledWith('timesheets')
    expect(chain.select).toHaveBeenCalledWith('*, projects(project_name, project_no)')
    expect(chain.order).toHaveBeenCalledWith('date_memo', { ascending: false })
  })

  it('fetchTimesheets applies date_from filter when set', async () => {
    const chain = makeChain({ data: [], error: null })
    mockFrom.mockReturnValue(chain)

    await fetchTimesheets({ ...emptyFilters, date_from: '2026-06-01' })

    expect(chain.gte).toHaveBeenCalledWith('date_memo', '2026-06-01')
  })

  it('fetchTimesheets applies date_to filter when set', async () => {
    const chain = makeChain({ data: [], error: null })
    mockFrom.mockReturnValue(chain)

    await fetchTimesheets({ ...emptyFilters, date_to: '2026-06-30' })

    expect(chain.lte).toHaveBeenCalledWith('date_memo', '2026-06-30')
  })

  it('fetchTimesheets applies project_id filter when set', async () => {
    const chain = makeChain({ data: [], error: null })
    mockFrom.mockReturnValue(chain)

    await fetchTimesheets({ ...emptyFilters, project_id: 'p1' })

    expect(chain.eq).toHaveBeenCalledWith('project_id', 'p1')
  })

  it('fetchTimesheets applies is_complete=true when status is complete', async () => {
    const chain = makeChain({ data: [], error: null })
    mockFrom.mockReturnValue(chain)

    await fetchTimesheets({ ...emptyFilters, status: 'complete' })

    expect(chain.eq).toHaveBeenCalledWith('is_complete', true)
  })

  it('fetchTimesheets applies is_complete=false when status is incomplete', async () => {
    const chain = makeChain({ data: [], error: null })
    mockFrom.mockReturnValue(chain)

    await fetchTimesheets({ ...emptyFilters, status: 'incomplete' })

    expect(chain.eq).toHaveBeenCalledWith('is_complete', false)
  })

  it('createTimesheet summarizes the description before inserting', async () => {
    const chain = makeChain({ data: { id: '1' }, error: null })
    mockFrom.mockReturnValue(chain)

    const input = {
      date_memo: '2026-06-11',
      description: 'Did stuff',
      project_id: null,
      is_complete: false,
      start_time: null,
      end_time: null,
    }
    await createTimesheet(input)

    expect(mockSummarizeDescription).toHaveBeenCalledWith('Did stuff')
    expect(chain.insert).toHaveBeenCalledWith({
      ...input,
      ai_summary: 'AI-generated summary',
      user_id: 'user-1',
    })
    expect(chain.single).toHaveBeenCalled()
  })

  it('createTimesheet with summarize:false skips the worker and inserts a null ai_summary', async () => {
    const chain = makeChain({ data: { id: '1' }, error: null })
    mockFrom.mockReturnValue(chain)

    const input = {
      date_memo: '2026-07-28',
      description: 'วันเฉลิมพระชนมพรรษาพระบาทสมเด็จพระเจ้าอยู่หัว',
      project_id: 'p-holiday',
      is_complete: true,
      start_time: '09:00',
      end_time: '18:00',
    }
    await createTimesheet(input, { summarize: false })

    expect(mockSummarizeDescription).not.toHaveBeenCalled()
    expect(chain.insert).toHaveBeenCalledWith({
      ...input,
      ai_summary: null,
      user_id: 'user-1',
    })
  })

  it('still inserts with a null ai_summary when Cloudflare AI fails', async () => {
    const chain = makeChain({ data: { id: '1' }, error: null })
    mockFrom.mockReturnValue(chain)
    mockSummarizeDescription.mockRejectedValue(new Error('Cloudflare AI request failed.'))

    const input = {
      date_memo: '2026-06-11',
      description: 'Did stuff',
      project_id: null,
      is_complete: false,
      start_time: null,
      end_time: null,
    }
    const { error } = await createTimesheet(input)

    expect(error).toBeNull()
    expect(chain.insert).toHaveBeenCalledWith({
      ...input,
      ai_summary: null,
      user_id: 'user-1',
    })
  })

  it('does not call Cloudflare AI or insert when there is no authenticated user', async () => {
    const chain = makeChain({ data: null, error: null })
    mockFrom.mockReturnValue(chain)
    mockGetAuthenticatedUserId.mockRejectedValue(
      new Error('You must be signed in to save data.'),
    )

    await expect(createTimesheet({
      date_memo: '2026-06-11',
      description: 'Did stuff',
      project_id: null,
      is_complete: false,
      start_time: null,
      end_time: null,
    })).rejects.toThrow('You must be signed in to save data.')

    expect(mockSummarizeDescription).not.toHaveBeenCalled()
    expect(chain.insert).not.toHaveBeenCalled()
  })

  const monthEntries = [
    { description: 'a', ai_summary: 'sum a' },
    { description: 'b', ai_summary: null },
  ]

  it('getOrCreateMonthlySummary returns cached summary without calling the worker when count matches', async () => {
    const chain = makeChain({ data: { summary: 'cached digest', entry_count: 2 }, error: null })
    mockFrom.mockReturnValue(chain)

    const result = await getOrCreateMonthlySummary(2026, 3, monthEntries)

    expect(result).toBe('cached digest')
    expect(mockSummarizeMonth).not.toHaveBeenCalled()
    expect(chain.upsert).not.toHaveBeenCalled()
  })

  it('getOrCreateMonthlySummary regenerates and upserts when cached count is stale', async () => {
    const chain = makeChain({ error: null })
    chain.maybeSingle.mockResolvedValue({ data: { summary: 'old', entry_count: 1 }, error: null })
    mockFrom.mockReturnValue(chain)

    const result = await getOrCreateMonthlySummary(2026, 3, monthEntries)

    expect(result).toBe('Monthly digest')
    expect(mockSummarizeMonth).toHaveBeenCalledWith('sum a\n\nb')
    expect(chain.upsert).toHaveBeenCalled()
  })

  it('getOrCreateMonthlySummary with force skips the cache lookup and regenerates', async () => {
    const chain = makeChain({ error: null })
    mockFrom.mockReturnValue(chain)

    const result = await getOrCreateMonthlySummary(2026, 3, monthEntries, { force: true })

    expect(result).toBe('Monthly digest')
    expect(chain.maybeSingle).not.toHaveBeenCalled()
    expect(mockSummarizeMonth).toHaveBeenCalled()
    expect(chain.upsert).toHaveBeenCalled()
  })

  it('fetchPreviousEntryText prefers the latest entry ai_summary', async () => {
    const chain = makeChain({ data: { description: 'raw text', ai_summary: '[IMP] tidy text' }, error: null })
    mockFrom.mockReturnValue(chain)

    expect(await fetchPreviousEntryText()).toBe('[IMP] tidy text')
    // Newest *created*, not newest work date — backfilling an old day must not change this.
    expect(chain.order).toHaveBeenCalledWith('inserted_at', { ascending: false })
    expect(mockFrom).toHaveBeenCalledWith('timesheets')
    expect(mockFrom).toHaveBeenCalledTimes(1) // no archive lookup when a live row exists
  })

  it('fetchPreviousEntryText falls back to the description when there is no summary', async () => {
    mockFrom.mockReturnValue(makeChain({ data: { description: 'raw text', ai_summary: '   ' }, error: null }))

    expect(await fetchPreviousEntryText()).toBe('raw text')
  })

  it('fetchPreviousEntryText falls back to the archive when no live entries exist', async () => {
    const live = makeChain({ data: null, error: null })
    const archived = makeChain({ data: { description: 'old raw', ai_summary: 'old summary' }, error: null })
    mockFrom.mockReturnValueOnce(live).mockReturnValueOnce(archived)

    expect(await fetchPreviousEntryText()).toBe('old summary')
    expect(mockFrom).toHaveBeenNthCalledWith(2, 'archived_timesheets')
    // Archived rows carry no meaningful creation order, so they sort by work date.
    expect(archived.order).toHaveBeenCalledWith('date_memo', { ascending: false })
  })

  it('fetchPreviousEntryText returns null when both tables are empty', async () => {
    mockFrom.mockReturnValue(makeChain({ data: null, error: null }))

    expect(await fetchPreviousEntryText()).toBeNull()
  })

  it('updateTimesheet applies update by id', async () => {
    const chain = makeChain({ data: { id: '1' }, error: null })
    mockFrom.mockReturnValue(chain)

    await updateTimesheet('1', { is_complete: true })

    expect(chain.update).toHaveBeenCalledWith({ is_complete: true })
    expect(chain.eq).toHaveBeenCalledWith('id', '1')
    expect(mockFrom).toHaveBeenCalledTimes(1)
  })

  it('updateTimesheet skips the worker when the description is unchanged', async () => {
    // Two from() calls: the pre-read, then the write — distinct chains so their
    // shared single() mocks resolve to different values.
    const readChain = makeChain({ data: { description: 'Same text' }, error: null })
    const writeChain = makeChain({ data: { id: '1' }, error: null })
    mockFrom.mockReturnValueOnce(readChain).mockReturnValueOnce(writeChain)

    await updateTimesheet('1', { description: 'Same text', is_complete: true })

    expect(mockSummarizeDescription).not.toHaveBeenCalled()
    expect(writeChain.update).toHaveBeenCalledWith({ description: 'Same text', is_complete: true })
  })

  it('updateTimesheet re-summarizes and writes ai_summary when the description changed', async () => {
    const readChain = makeChain({ data: { description: 'Old text' }, error: null })
    const writeChain = makeChain({ data: { id: '1' }, error: null })
    mockFrom.mockReturnValueOnce(readChain).mockReturnValueOnce(writeChain)

    await updateTimesheet('1', { description: 'New text' })

    expect(mockSummarizeDescription).toHaveBeenCalledWith('New text')
    expect(writeChain.update).toHaveBeenCalledWith({
      description: 'New text',
      ai_summary: 'AI-generated summary',
    })
  })

  it('updateTimesheet still saves the edit without ai_summary when Cloudflare AI fails', async () => {
    const readChain = makeChain({ data: { description: 'Old text' }, error: null })
    const writeChain = makeChain({ data: { id: '1' }, error: null })
    mockFrom.mockReturnValueOnce(readChain).mockReturnValueOnce(writeChain)
    mockSummarizeDescription.mockRejectedValue(
      new Error('Cloudflare AI endpoint is not configured.'),
    )

    await expect(updateTimesheet('1', { description: 'New text' })).resolves.toBeDefined()

    expect(writeChain.update).toHaveBeenCalledWith({ description: 'New text' })
  })

  it('deleteTimesheet deletes by id', async () => {
    const chain = makeChain({ data: null, error: null })
    mockFrom.mockReturnValue(chain)

    await deleteTimesheet('1')

    expect(chain.delete).toHaveBeenCalled()
    expect(chain.eq).toHaveBeenCalledWith('id', '1')
  })
})
