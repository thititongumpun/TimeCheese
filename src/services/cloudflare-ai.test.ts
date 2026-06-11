import { afterEach, describe, expect, it, vi } from 'vitest'
import { summarizeDescription } from './cloudflare-ai'

describe('summarizeDescription', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('returns the summary from the configured Cloudflare Worker', async () => {
    vi.stubEnv('VITE_CLOUDFLARE_AI_URL', 'https://example.workers.dev')
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(
      JSON.stringify({ summary: 'Prepared the weekly client report.' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ))

    await expect(summarizeDescription('Prepare client report')).resolves.toBe(
      'Prepared the weekly client report.',
    )
    expect(fetch).toHaveBeenCalledWith('https://example.workers.dev', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: 'Prepare client report' }),
    })
  })

  it('throws when the Worker request fails', async () => {
    vi.stubEnv('VITE_CLOUDFLARE_AI_URL', 'https://example.workers.dev')
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(
      JSON.stringify({ error: 'Workers AI unavailable' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } },
    ))

    await expect(summarizeDescription('Prepare client report')).rejects.toThrow(
      'Workers AI unavailable',
    )
  })
})
