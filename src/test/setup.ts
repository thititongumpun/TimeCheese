import '@testing-library/jest-dom/vitest'

// vitest 4's jsdom environment copies jsdom's `localStorage`/`sessionStorage` *getters* onto
// globalThis, where their internal `this` no longer resolves — the property exists but reads
// as undefined. The backing Storage objects come across as `_localStorage` etc., so re-point
// the globals at those.
for (const key of ['localStorage', 'sessionStorage'] as const) {
  const g = globalThis as unknown as Record<string, unknown>
  if (g[key] === undefined && g['_' + key]) {
    Object.defineProperty(globalThis, key, { value: g['_' + key], configurable: true })
  }
}
