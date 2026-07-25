import { useState } from 'preact/hooks'
import { searchArchived, fetchEntriesInRange, type ArchivedMatch } from '../services/timesheets'
import { chatOverContext } from '../services/cloudflare-ai'
import { parseDateRange } from '../lib/daterange'
import { ExpandableText } from '../components/ExpandableText'

const EXAMPLE_QUESTION = 'What did I work on last week?'

export function Ask() {
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [sources, setSources] = useState<ArchivedMatch[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function ask(e: Event) {
    e.preventDefault()
    const q = question.trim()
    if (!q) return
    setLoading(true)
    setError(null)
    setAnswer('')
    setSources([])
    try {
      // A relative-date question is answered by reading that range, not by embedding it —
      // "last week" is invisible to cosine similarity.
      const period = parseDateRange(q)
      let rows: ArchivedMatch[]
      if (period) {
        rows = await fetchEntriesInRange(period.from, period.to)
      } else {
        const { data, error } = await searchArchived(q, 10)
        if (error) throw new Error(error.message)
        rows = (data as ArchivedMatch[]) ?? []
      }
      if (rows.length === 0) {
        setError(
          period
            ? `No entries between ${period.from} and ${period.to}.`
            : 'No archived entries found. Index your archive first (Archived → "Index archive").',
        )
        return
      }
      const context = [
        `Today is ${new Date().toLocaleDateString()}.`,
        ...rows.map(
          (r) => `- [${new Date(r.date_memo).toLocaleDateString()}] ${r.description}${r.ai_summary ? ` (${r.ai_summary})` : ''}`,
        ),
      ].join('\n')
      setSources(rows)
      setAnswer(await chatOverContext(q, context))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not answer the question.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <header class="flex items-end justify-between gap-4 mb-6">
        <div>
          <h1 class="font-display font-bold text-2xl">Ask</h1>
          <p class="text-sm opacity-60 font-mono">
            {sources.length > 0 ? `${sources.length} source${sources.length === 1 ? '' : 's'}` : 'search your archived work'}
          </p>
        </div>
      </header>

      <form onSubmit={ask} class="mb-8 flex gap-2">
        <input
          type="text"
          class="input flex-1"
          placeholder="Ask about your past work…"
          value={question}
          onInput={(e) => setQuestion(e.currentTarget.value)}
        />
        <button type="submit" class="btn btn-primary" disabled={loading || !question.trim()}>
          {loading ? <span class="loading loading-spinner loading-xs" /> : 'Ask'}
        </button>
      </form>

      {error && (
        <div class="alert alert-error mb-4">
          <span>{error}</span>
        </div>
      )}

      {!answer && !loading && !error && (
        <div class="py-12 text-center">
          <p class="font-mono text-sm opacity-60 mb-3">Ask a question to search your archived timesheets.</p>
          <button class="btn btn-ghost btn-sm" onClick={() => setQuestion(EXAMPLE_QUESTION)}>
            Try: “{EXAMPLE_QUESTION}”
          </button>
        </div>
      )}

      {answer && (
        <div class="card border-2 border-base-300 mb-6">
          <div class="card-body p-4">
            <p class="whitespace-pre-wrap break-words">{answer}</p>
          </div>
        </div>
      )}

      {sources.length > 0 && (
        <div>
          <div class="text-xs uppercase tracking-wide opacity-60 mb-3">Based on these entries</div>
          <ul class="space-y-3">
            {sources.map((s) => (
              <li key={s.id} class="text-sm">
                <span class="opacity-50 mr-2 font-mono">{new Date(s.date_memo).toLocaleDateString()}</span>
                <ExpandableText text={s.description} clampClass="line-clamp-2" />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
