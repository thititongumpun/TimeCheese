import { invoke } from '@tauri-apps/api/core'

const isTauri = '__TAURI_INTERNALS__' in window

export interface GrammarLint {
  start: number
  end: number
  message: string
  replacement: string | null
}

// Harper lives in the Rust layer, so this is a no-op in the browser dev server.
// Grammar feedback is advisory — a failure here must never block typing or saving.
export async function checkGrammar(text: string): Promise<GrammarLint[]> {
  if (!isTauri) return []
  try {
    return await invoke<GrammarLint[]>('grammar_check', { text })
  } catch {
    return []
  }
}

// Rust spans are code-point indices and Array.from splits by code point too, so this
// stays correct for astral characters (emoji) where String.slice would cut a surrogate.
export function applyLint(text: string, lint: GrammarLint): string {
  const chars = Array.from(text)
  return [
    ...chars.slice(0, lint.start),
    ...(lint.replacement ?? ''),
    ...chars.slice(lint.end),
  ].join('')
}
