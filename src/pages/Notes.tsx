import { useRef, useState } from 'preact/hooks'

type Note = { id: string; text: string; ts: number }

const KEY = 'notes'

function load(): Note[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]')
  } catch {
    return []
  }
}

function save(notes: Note[]) {
  localStorage.setItem(KEY, JSON.stringify(notes))
}

export function Notes() {
  const [notes, setNotes] = useState<Note[]>(load)
  const [text, setText] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  function update(next: Note[]) {
    setNotes(next)
    save(next)
  }

  function add(e: Event) {
    e.preventDefault()
    const trimmed = text.trim()
    if (!trimmed) return
    update([{ id: crypto.randomUUID(), text: trimmed, ts: Date.now() }, ...notes])
    setText('')
  }

  function remove(id: string) {
    update(notes.filter((n) => n.id !== id))
  }

  return (
    <div>
      <header class="flex items-end justify-between gap-4 mb-6">
        <div>
          <h1 class="font-display font-bold text-2xl">Notes</h1>
          <p class="text-sm opacity-60 font-mono">{notes.length} note{notes.length === 1 ? '' : 's'}</p>
        </div>
      </header>

      <form onSubmit={add} class="mb-8 flex gap-2">
        <textarea
          ref={textareaRef}
          class="textarea flex-1"
          rows={2}
          placeholder="Write a note…"
          value={text}
          onInput={(e) => setText(e.currentTarget.value)}
        />
        <button type="submit" class="btn btn-primary self-end" disabled={!text.trim()}>
          Add
        </button>
      </form>

      {notes.length === 0 ? (
        <div class="py-12 text-center">
          <p class="font-mono text-sm opacity-60 mb-3">No notes yet.</p>
          <button class="btn btn-ghost btn-sm" onClick={() => textareaRef.current?.focus()}>
            Write your first note
          </button>
        </div>
      ) : (
        <ul class="space-y-4">
          {notes.map((n) => (
            <li key={n.id} class="card border-2 border-base-300 hover:bg-base-200">
              <div class="card-body flex-row items-start justify-between gap-4 p-4">
                <div class="min-w-0">
                  <p class="whitespace-pre-wrap break-words">{n.text}</p>
                  <div class="text-xs opacity-50 mt-1 font-mono">{new Date(n.ts).toLocaleString()}</div>
                </div>
                <button
                  class="btn btn-ghost btn-sm btn-square text-error"
                  aria-label="Delete note"
                  onClick={() => remove(n.id)}
                >
                  ✕
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
