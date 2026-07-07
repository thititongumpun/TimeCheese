import { useState } from 'preact/hooks'

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
      <h1 class="text-2xl font-bold mb-4">Notes</h1>

      <form onSubmit={add} class="mb-6 flex gap-2">
        <textarea
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
        <p class="text-base-content/50 py-8 text-center">No notes yet.</p>
      ) : (
        <ul class="space-y-2">
          {notes.map((n) => (
            <li key={n.id} class="card bg-base-200">
              <div class="card-body flex-row items-start justify-between gap-4 p-4">
                <div class="min-w-0">
                  <p class="whitespace-pre-wrap break-words">{n.text}</p>
                  <div class="text-xs opacity-50 mt-1">{new Date(n.ts).toLocaleString()}</div>
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
