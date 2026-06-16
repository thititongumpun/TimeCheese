const MODEL = '@cf/meta/llama-3.1-8b-instruct-fp8'

const SYSTEM_PROMPT = `You are a technical writing editor. Your job is to fix grammar, spelling, and technical terminology in the given text, then format it.
Rules:
- Do NOT modify any content inside square brackets, e.g. [IMP], [INVX], [PersonelCost]. Keep the tag exactly as-is.
- A square-bracket tag must sit alone on its own line. Move any text that follows it on the same line down to the next line.
- Every line of body text (anything that is not a bracket tag) must start with "- ". Add the dash if it is missing; keep existing dashes.
- Fix typos, grammar, and unclear phrasing. Keep the original meaning and line breaks between separate items.
- Return ONLY the corrected text. No explanation, no preamble.

Example input:
1. [INVX] update innovest x cluster
2. [IMP][PersonnelCost] 
- Conduct SIT tests with HISRCC/ cont.
- Capture Result HISRCC  SIT test cases.
- Produce SIT negative (FAIL) test cases HISCUH/HISRCC clients.
Example output:
1. [INVX]
- update innovest x cluster
2. [IMP][PersonnelCost]
- Conduct SIT tests with HISRCC/cont.
- Capture results of HISRCC SIT test cases.
- Produce SIT negative (FAIL) test cases for HISCUH/HISRCC clients.
`

interface AiBinding {
  run: (
    model: string,
    input: { messages: Array<{ role: 'system' | 'user'; content: string }> },
  ) => Promise<{ response?: string }>
}

interface Env {
  AI: AiBinding
}

const corsHeaders = {
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
}

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: corsHeaders,
  })
}

export default {
  async fetch(request: Request, env: Env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders })
    }

    if (request.method !== 'POST') {
      return json({ error: 'Method not allowed.' }, 405)
    }

    let description = ''

    try {
      const body = await request.json() as { description?: unknown }
      description = typeof body.description === 'string' ? body.description.trim() : ''
    } catch {
      return json({ error: 'Request body must be valid JSON.' }, 400)
    }

    if (!description) {
      return json({ error: 'Description is required.' }, 400)
    }

    try {
      const result = await env.AI.run(MODEL, {
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: description },
        ],
      })
      const summary = result.response?.trim()

      if (!summary) {
        return json({ error: 'Cloudflare AI returned an empty summary.' }, 502)
      }

      return json({ summary })
    } catch (err) {
      // ponytail: surface the real reason so the next failure isn't blind
      const reason = err instanceof Error ? err.message : 'unknown error'
      return json({ error: `Cloudflare AI request failed: ${reason}` }, 502)
    }
  },
}
