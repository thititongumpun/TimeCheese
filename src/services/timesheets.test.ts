import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFrom = vi.hoisted(() => vi.fn())
const mockSummarizeDescription = vi.hoisted(() => vi.fn())
vi.mock('../lib/supabase', () => ({
  supabase: { from: mockFrom },
}))
vi.mock('./cloudflare-ai', () => ({
  summarizeDescription: mockSummarizeDescription,
}))

import {
  fetchTimesheets,
  createTimesheet,
  updateTimesheet,
  deleteTimesheet,
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
    order: vi.fn().mockResolvedValue(result),
    single: vi.fn().mockResolvedValue(result),
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
    mockSummarizeDescription.mockResolvedValue('AI-generated summary')
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
    }
    await createTimesheet(input)

    expect(mockSummarizeDescription).toHaveBeenCalledWith('Did stuff')
    expect(chain.insert).toHaveBeenCalledWith({
      ...input,
      ai_summary: 'AI-generated summary',
    })
    expect(chain.single).toHaveBeenCalled()
  })

  it('does not insert when Cloudflare AI fails', async () => {
    const chain = makeChain({ data: null, error: null })
    mockFrom.mockReturnValue(chain)
    mockSummarizeDescription.mockRejectedValue(new Error('Cloudflare AI request failed.'))

    await expect(createTimesheet({
      date_memo: '2026-06-11',
      description: 'Did stuff',
      project_id: null,
      is_complete: false,
    })).rejects.toThrow('Cloudflare AI request failed.')

    expect(chain.insert).not.toHaveBeenCalled()
  })

  it('updateTimesheet applies update by id', async () => {
    const chain = makeChain({ data: { id: '1' }, error: null })
    mockFrom.mockReturnValue(chain)

    await updateTimesheet('1', { is_complete: true })

    expect(chain.update).toHaveBeenCalledWith({ is_complete: true })
    expect(chain.eq).toHaveBeenCalledWith('id', '1')
  })

  it('deleteTimesheet deletes by id', async () => {
    const chain = makeChain({ data: null, error: null })
    mockFrom.mockReturnValue(chain)

    await deleteTimesheet('1')

    expect(chain.delete).toHaveBeenCalled()
    expect(chain.eq).toHaveBeenCalledWith('id', '1')
  })
})
