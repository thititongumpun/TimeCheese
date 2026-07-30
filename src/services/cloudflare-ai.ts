type CloudflareAiResponse = {
  summary?: unknown
  output?: unknown
  response?: unknown
  embedding?: unknown
  text?: unknown
  error?: unknown
  result?: {
    summary?: unknown
    response?: unknown
  }
}

function getMessage(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

// Single Worker URL, behaviour selected by an optional `task` field on the body.
// No `task` => the original summarize behaviour, unchanged.
async function callWorker(body: Record<string, unknown>): Promise<CloudflareAiResponse> {
  const endpoint = import.meta.env.VITE_CLOUDFLARE_AI_URL?.trim()

  if (!endpoint) {
    throw new Error('Cloudflare AI endpoint is not configured.')
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  const parsed = await response.json().catch(() => ({})) as CloudflareAiResponse

  if (!response.ok) {
    throw new Error(getMessage(parsed.error) || `Cloudflare AI request failed (${response.status}).`)
  }

  return parsed
}

export async function summarizeDescription(description: string) {
  const body = await callWorker({ description })

  const summary = getMessage(body.summary)
    || getMessage(body.output)
    || getMessage(body.response)
    || getMessage(body.result?.summary)
    || getMessage(body.result?.response)

  if (!summary) {
    throw new Error('Cloudflare AI returned an empty summary.')
  }

  return summary
}

// Tag-grouped digest of one month's archived entries.
export async function summarizeMonth(text: string): Promise<string> {
  const body = await callWorker({ task: 'monthly', text })

  const summary = getMessage(body.summary)
    || getMessage(body.response)
    || getMessage(body.output)

  if (!summary) {
    throw new Error('Cloudflare AI returned an empty monthly summary.')
  }

  return summary
}

// bge-m3 embedding (1024-dim) for semantic search / autofill / RAG retrieval.
export async function embedText(text: string): Promise<number[]> {
  const body = await callWorker({ task: 'embed', text })
  const embedding = body.embedding

  if (!Array.isArray(embedding) || embedding.length === 0 || typeof embedding[0] !== 'number') {
    throw new Error('Cloudflare AI returned an empty embedding.')
  }

  return embedding as number[]
}

// Whisper transcription of a short dictation clip (webm/opus or wav).
export async function transcribeAudio(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000)) // chunked: avoids arg-length limits
  }
  const body = await callWorker({ task: 'transcribe', audio: btoa(binary) })
  const text = getMessage(body.text) || getMessage(body.response)

  if (!text) {
    throw new Error('Cloudflare AI returned an empty transcription.')
  }

  return text
}

// Convert a Thai/mixed description to the English "- " bullet timesheet style.
export async function translateToEnglish(text: string): Promise<string> {
  const body = await callWorker({ task: 'translate', text })
  const out = getMessage(body.response) || getMessage(body.summary) || getMessage(body.output)

  if (!out) {
    throw new Error('Cloudflare AI returned an empty translation.')
  }

  return out
}

// Answer a question from retrieved timesheet entries (the LLM half of RAG).
export async function chatOverContext(question: string, context: string): Promise<string> {
  const body = await callWorker({ task: 'chat', question, context })

  const answer = getMessage(body.response)
    || getMessage(body.result?.response)
    || getMessage(body.output)

  if (!answer) {
    throw new Error('Cloudflare AI returned an empty answer.')
  }

  return answer
}
