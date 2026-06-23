import { useState } from 'preact/hooks'
import { searchArchived, type ArchivedMatch } from '../services/timesheets'
import { chatOverContext } from '../services/cloudflare-ai'
import { ExpandableText } from '../components/ExpandableText'

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
      const { data, error } = await searchArchived(q, 10)
      if (error) throw new Error(error.message)
      const rows = (data as ArchivedMatch[]) ?? []
      if (rows.length === 0) {
        setError('No archived entries found. Index your archive first (Archived → "Index archive").')
        return
      }
      const context = rows
        .map((r) => `- [${new Date(r.date_memo).toLocaleDateString()}] ${r.description}${r.ai_summary ? ` (${r.ai_summary})` : ''}`)
        .join('\n')
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
      <h1 class="text-2xl font-bold mb-4">Ask</h1>

      <form onSubmit={ask} class="mb-6 flex gap-2">
        <input
          type="text"
          class="input input-bordered flex-1"
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

      {answer && (
        <div class="card bg-base-200 mb-4">
          <div class="card-body p-4">
            <p class="whitespace-pre-wrap break-words">{answer}</p>
          </div>
        </div>
      )}

      {sources.length > 0 && (
        <div>
          <div class="text-sm font-medium opacity-60 mb-2">Based on these entries</div>
          <ul class="space-y-2">
            {sources.map((s) => (
              <li key={s.id} class="text-sm">
                <span class="opacity-50 mr-2">{new Date(s.date_memo).toLocaleDateString()}</span>
                <ExpandableText text={s.description} clampClass="line-clamp-2" />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
