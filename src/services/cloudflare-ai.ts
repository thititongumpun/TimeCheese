type CloudflareAiResponse = {
  summary?: unknown
  output?: unknown
  response?: unknown
  error?: unknown
  result?: {
    summary?: unknown
    response?: unknown
  }
}

function getMessage(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

export async function summarizeDescription(description: string) {
  const endpoint = import.meta.env.VITE_CLOUDFLARE_AI_URL?.trim()

  if (!endpoint) {
    throw new Error('Cloudflare AI endpoint is not configured.')
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ description }),
  })

  const body = await response.json().catch(() => ({})) as CloudflareAiResponse

  if (!response.ok) {
    throw new Error(getMessage(body.error) || `Cloudflare AI request failed (${response.status}).`)
  }

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
