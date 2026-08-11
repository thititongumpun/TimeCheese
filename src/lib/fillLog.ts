// Msync / Park fill logs are a "what did I just send" scratchpad, not history:
// runs older than a week are dropped whenever the log is read.
export const FILL_LOG_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

// Keeps runs whose `at` ISO timestamp is within the last week. Entries with an
// unparseable `at` are dropped (they can never be shown sensibly anyway).
export function prunedRuns<T extends { at: string }>(runs: T[], now: number = Date.now()): T[] {
  return runs.filter((r) => {
    const t = new Date(r.at).getTime()
    return Number.isFinite(t) && now - t < FILL_LOG_MAX_AGE_MS
  })
}
