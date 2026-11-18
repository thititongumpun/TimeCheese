// Pure helpers for scripts/timesheet-cli.mjs (arg parsing + project resolution).
type Project = { id: string; project_no: string | null; project_name: string }

// "--key value" pairs only; first bare word is the command.
export function parseArgs(argv: string[]): { cmd: string; flags: Record<string, string> } {
  const [cmd = '', ...rest] = argv
  const flags: Record<string, string> = {}
  for (let i = 0; i < rest.length; i += 2) {
    const k = rest[i]
    const v = rest[i + 1]
    if (!k.startsWith('--') || v === undefined) throw new Error(`Bad argument: ${k}`)
    flags[k.slice(2)] = v
  }
  return { cmd, flags }
}

// Exact project_no (case-insensitive) wins; else substring of no/name. Throws listing candidates.
export function resolveProject<T extends Project>(projects: T[], query: string): T {
  const q = query.trim().toLowerCase()
  const exact = projects.filter((p) => (p.project_no ?? '').toLowerCase() === q)
  if (exact.length === 1) return exact[0]
  const hits = exact.length ? exact : projects.filter(
    (p) => (p.project_no ?? '').toLowerCase().includes(q) || p.project_name.toLowerCase().includes(q),
  )
  if (hits.length === 1) return hits[0]
  const list = (hits.length ? hits : projects).map((p) => `${p.project_no}\t${p.project_name}`).join('\n')
  throw new Error(`${hits.length ? 'Ambiguous' : 'No match for'} project "${query}". Candidates:\n${list}`)
}
