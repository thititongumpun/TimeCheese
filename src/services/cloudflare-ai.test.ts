import { afterEach, describe, expect, it, vi } from 'vitest'
import { summarizeDescription, embedText, chatOverContext } from './cloudflare-ai'

function mockJson(body: unknown, status = 200) {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(
    JSON.stringify(body),
    { status, headers: { 'Content-Type': 'application/json' } },
  ))
}

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

describe('embedText', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('returns the embedding array and sends task:embed', async () => {
    vi.stubEnv('VITE_CLOUDFLARE_AI_URL', 'https://example.workers.dev')
    mockJson({ embedding: [0.1, 0.2, 0.3] })

    await expect(embedText('database tuning')).resolves.toEqual([0.1, 0.2, 0.3])
    expect(fetch).toHaveBeenCalledWith('https://example.workers.dev', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task: 'embed', text: 'database tuning' }),
    })
  })

  it('throws when the embedding is empty', async () => {
    vi.stubEnv('VITE_CLOUDFLARE_AI_URL', 'https://example.workers.dev')
    mockJson({ embedding: [] })

    await expect(embedText('x')).rejects.toThrow('empty embedding')
  })
})

describe('chatOverContext', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('returns the answer and sends task:chat with question + context', async () => {
    vi.stubEnv('VITE_CLOUDFLARE_AI_URL', 'https://example.workers.dev')
    mockJson({ response: 'You worked on the billing module.' })

    await expect(chatOverContext('what did I do?', '- entry')).resolves.toBe(
      'You worked on the billing module.',
    )
    expect(fetch).toHaveBeenCalledWith('https://example.workers.dev', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task: 'chat', question: 'what did I do?', context: '- entry' }),
    })
  })
})
