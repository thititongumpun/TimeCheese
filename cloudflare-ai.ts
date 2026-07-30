const MODEL = '@cf/meta/llama-3.1-8b-instruct-fp8'
const EMBED_MODEL = '@cf/baai/bge-m3' // 1024-dim, multilingual (Thai + English)
const WHISPER_MODEL = '@cf/openai/whisper-large-v3-turbo'

const CHAT_SYSTEM_PROMPT = `You answer questions about a user's past work using ONLY the timesheet entries provided.
If the entries do not contain the answer, say you do not have that information. Be concise.`

const MONTHLY_SYSTEM_PROMPT = `You write a concise monthly work digest from the timesheet entries provided for one month.
Rules:
- Group the digest by square-bracket project tag, e.g. [IMP], [INVX], [PersonnelCost]. Keep every tag exactly as-is; never invent, drop, merge, or alter a tag.
- Each tag sits alone on its own line, followed by a few "- " bullet lines summarising that tag's work for the month. Merge duplicates; keep it short.
- If an entry has no tag, group it under a "- " bullet beneath an "[Other]" heading.
- Return ONLY the digest. No preamble, no closing remarks.`

const SYSTEM_PROMPT = `You are a technical writing editor. Your job is to fix grammar, spelling, and technical terminology in the given text, then format it.
Rules:
- Do NOT modify any content inside square brackets, e.g. [IMP], [INVX], [PersonelCost]. Keep the tag exactly as-is if multiple tag keep the exactly as-is.
- A square-bracket tag must sit alone on its own line. Move any text that follows it on the same line down to the next line.
- Every line of body text (anything that is not a bracket tag) must start with "- ". Add the dash if it is missing; keep existing dashes.
- Fix typos, grammar, and unclear phrasing. Keep the original meaning and line breaks between separate items.
- NEVER add information that is not in the input. No invented dates, names, placeholders, or extra clauses. A one-word input stays one word, spelled correctly.
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

const TRANSLATE_SYSTEM_PROMPT = `You convert a Thai (or mixed Thai/English) timesheet entry into concise English.
Rules:
- Do NOT modify any content inside square brackets, e.g. [IMP], [PersonelCost]. Keep every tag exactly as-is, even if misspelled. A line of tags stays verbatim on its own line.
- Every non-tag line becomes one English bullet starting with "- ". Strip any leading numbering ("1", "2.", "-") first.
- Translate concisely in timesheet style: short imperative phrases. Keep acronyms, technical terms, and product names as-is (DDL, SIT, DB, API).
- NEVER add information that is not in the input. No invented dates, names, or details.
- If a line is already English, keep it (still as a "- " bullet).
- Return ONLY the converted text. No explanation, no preamble.

Example input (the usual case — task lines only, the user adds tags themselves):
1 ทำการทดสอบฐานข้อมูล
2 วางแผนทำ DDL
Example output:
- Test database
- Plan DDL

Example input (tags present — keep them):
[IMP][PersonelCost]
1 ทำการทดสอบฐานข้อมูล
Example output:
[IMP][PersonelCost]
- Test database
`

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Deterministic guard: the model sometimes truncates a back-to-back tag run like
// [IMP][PersonnelCost] down to a prefix ([IMP]). Restore every original run verbatim
// so bracket tags are never altered, regardless of what the model returned.
// ponytail: only repairs truncated multi-tag runs; a fully-dropped single tag isn't
// re-inserted (no anchor to know where) — fix in prompt if that ever shows up.
export function restoreBracketTags(original: string, summary: string): string {
  const runs = original.match(/(?:\[[^\]]+\])+/g) ?? []
  let out = summary
  for (const run of runs) {
    if (out.includes(run)) continue // run survived intact
    const tags = run.match(/\[[^\]]+\]/g)! // e.g. ["[IMP]", "[PersonnelCost]"]
    // Find the longest surviving prefix of the run and expand it back to the full run.
    for (let n = tags.length - 1; n >= 1; n--) {
      const prefix = tags.slice(0, n).join('')
      const re = new RegExp(escapeRegExp(prefix) + '(?!\\s*\\[)') // not already followed by another tag
      if (re.test(out)) {
        out = out.replace(re, run)
        break
      }
    }
  }
  return out
}

// The model sometimes invents placeholder tags ("VACTION" -> "Vacation from [DATE] to [DATE]").
// Any bracket tag that wasn't in the original is not ours — unwrap it, keeping the inner text.
// Only acts when the input had NO tags at all — then every bracket in the output is the
// model's invention. Once the input has tags we keep hands off: matching output tags back to
// input ones is guesswork (the model may have respelled them) and restoreBracketTags owns
// that case. ponytail: an invented tag alongside real ones survives; hasn't come up.
export function dropInventedTags(original: string, summary: string): string {
  if (/\[[^\]]+\]/.test(original)) return summary
  return summary.replace(/\[([^\]]+)\]/g, '$1')
}

// The monthly digest is supposed to print each tag heading once, but llama walks the
// entries in order and reprints the heading per entry (four "[IMP]" blocks for one
// month). Fold repeats back together, keeping first-appearance order and dropping
// bullets that are duplicated verbatim. Distinct runs stay distinct — "[IMP]" and
// "[IMP][PersonnelCost]" are different tags, not the same one twice.
export function mergeTagGroups(summary: string): string {
  const order: string[] = []
  const groups = new Map<string, Set<string>>()
  const preamble: string[] = []
  let current: Set<string> | null = null

  for (const raw of summary.split('\n')) {
    const line = raw.trim()
    if (/^(?:\[[^\]]+\])+$/.test(line)) {
      if (!groups.has(line)) {
        groups.set(line, new Set())
        order.push(line)
      }
      current = groups.get(line)!
      continue
    }
    if (!line) continue
    if (current) current.add(line)
    else preamble.push(line) // text before any heading — leave it alone
  }

  if (!order.length) return summary // no headings to merge
  const sections = order.map((tag) => [tag, ...groups.get(tag)!].join('\n'))
  return (preamble.length ? [preamble.join('\n'), ...sections] : sections).join('\n\n')
}

interface AiBinding {
  run(
    model: string,
    input: { messages: Array<{ role: 'system' | 'user'; content: string }> },
  ): Promise<{ response?: string }>
  run(model: string, input: { text: string[] }): Promise<{ data: number[][] }>
  run(
    model: string,
    input: { audio: string; task?: string; language?: string },
  ): Promise<{ text?: string }>
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

    let body: {
      task?: unknown
      description?: unknown
      text?: unknown
      question?: unknown
      context?: unknown
      audio?: unknown
      language?: unknown
    }

    try {
      body = await request.json()
    } catch {
      return json({ error: 'Request body must be valid JSON.' }, 400)
    }

    const task = typeof body.task === 'string' ? body.task : ''

    // --- embeddings: { task: 'embed', text } -> { embedding: number[1024] } ---
    if (task === 'embed') {
      const text = typeof body.text === 'string' ? body.text.trim() : ''
      if (!text) return json({ error: 'Text is required.' }, 400)
      try {
        const result = await env.AI.run(EMBED_MODEL, { text: [text] })
        const embedding = result.data?.[0]
        if (!embedding?.length) return json({ error: 'Cloudflare AI returned an empty embedding.' }, 502)
        return json({ embedding })
      } catch (err) {
        const reason = err instanceof Error ? err.message : 'unknown error'
        return json({ error: `Cloudflare AI request failed: ${reason}` }, 502)
      }
    }

    // --- transcribe: { task: 'transcribe', audio, language? } -> { text } ---
    if (task === 'transcribe') {
      const audio = typeof body.audio === 'string' ? body.audio : ''
      const language = typeof body.language === 'string' ? body.language : 'th'
      if (!audio) return json({ error: 'Audio is required.' }, 400)
      try {
        const result = await env.AI.run(WHISPER_MODEL, { audio, task: 'transcribe', language })
        const text = result.text?.trim()
        if (!text) return json({ error: 'Cloudflare AI returned an empty transcription.' }, 502)
        return json({ text })
      } catch (err) {
        const reason = err instanceof Error ? err.message : 'unknown error'
        return json({ error: `Cloudflare AI request failed: ${reason}` }, 502)
      }
    }

    // --- translate: { task: 'translate', text } -> { response } (Thai -> English) ---
    if (task === 'translate') {
      const text = typeof body.text === 'string' ? body.text.trim() : ''
      if (!text) return json({ error: 'Text is required.' }, 400)
      try {
        const result = await env.AI.run(MODEL, {
          messages: [
            { role: 'system', content: TRANSLATE_SYSTEM_PROMPT },
            { role: 'user', content: text },
          ],
        })
        const out = result.response?.trim()
        if (!out) return json({ error: 'Cloudflare AI returned an empty translation.' }, 502)
        return json({ response: dropInventedTags(text, restoreBracketTags(text, out)) })
      } catch (err) {
        const reason = err instanceof Error ? err.message : 'unknown error'
        return json({ error: `Cloudflare AI request failed: ${reason}` }, 502)
      }
    }

    // --- chat: { task: 'chat', question, context } -> { response } ---
    if (task === 'chat') {
      const question = typeof body.question === 'string' ? body.question.trim() : ''
      const context = typeof body.context === 'string' ? body.context : '(none)'
      if (!question) return json({ error: 'Question is required.' }, 400)
      try {
        const result = await env.AI.run(MODEL, {
          messages: [
            { role: 'system', content: CHAT_SYSTEM_PROMPT },
            { role: 'user', content: `Entries:\n${context}\n\nQuestion: ${question}` },
          ],
        })
        const answer = result.response?.trim()
        if (!answer) return json({ error: 'Cloudflare AI returned an empty answer.' }, 502)
        return json({ response: answer })
      } catch (err) {
        const reason = err instanceof Error ? err.message : 'unknown error'
        return json({ error: `Cloudflare AI request failed: ${reason}` }, 502)
      }
    }

    // --- monthly: { task: 'monthly', text } -> { summary } (tag-grouped digest of one month) ---
    if (task === 'monthly') {
      const text = typeof body.text === 'string' ? body.text.trim() : ''
      if (!text) return json({ error: 'Text is required.' }, 400)
      try {
        const result = await env.AI.run(MODEL, {
          messages: [
            { role: 'system', content: MONTHLY_SYSTEM_PROMPT },
            { role: 'user', content: text },
          ],
        })
        const summary = result.response?.trim()
        if (!summary) return json({ error: 'Cloudflare AI returned an empty monthly summary.' }, 502)
        return json({ summary: mergeTagGroups(restoreBracketTags(text, summary)) })
      } catch (err) {
        const reason = err instanceof Error ? err.message : 'unknown error'
        return json({ error: `Cloudflare AI request failed: ${reason}` }, 502)
      }
    }

    // --- default (no task): summarize a description ---
    const description = typeof body.description === 'string' ? body.description.trim() : ''

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

      return json({ summary: dropInventedTags(description, restoreBracketTags(description, summary)) })
    } catch (err) {
      // ponytail: surface the real reason so the next failure isn't blind
      const reason = err instanceof Error ? err.message : 'unknown error'
      return json({ error: `Cloudflare AI request failed: ${reason}` }, 502)
    }
  },
}
