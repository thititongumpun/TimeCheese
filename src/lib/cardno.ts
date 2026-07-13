// Pick the longest digit run from noisy OCR text — the card number is the biggest number on the ticket.
export function extractCardNo(text: string): string {
  const runs = text.match(/\d+/g) ?? []
  return runs.reduce((a, b) => (b.length > a.length ? b : a), '')
}
