// ai_summary often comes back with a blank line between the [TAG] header and
// the bullet list — collapse blank lines so pasted text is tight.
export function tidySummary(text: string) {
  return text.replace(/\n[ \t]*\n+/g, '\n').trim()
}
