// Mirrors `themes: all` in index.css — the two custom ones plus every daisyUI v5 built-in.
export const THEMES = [
  'timecheese', 'timecheese-dark',
  'light', 'dark', 'cupcake', 'bumblebee', 'emerald', 'corporate', 'synthwave', 'retro',
  'cyberpunk', 'valentine', 'halloween', 'garden', 'forest', 'aqua', 'lofi', 'pastel',
  'fantasy', 'wireframe', 'black', 'luxury', 'dracula', 'cmyk', 'autumn', 'business',
  'acid', 'lemonade', 'night', 'coffee', 'winter', 'dim', 'nord', 'sunset', 'caramellatte',
  'abyss', 'silk',
] as const
export type ThemeMode = (typeof THEMES)[number]

const THEME_STORAGE_KEY = 'timesh1t-theme'

function defaultTheme(): ThemeMode {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'timecheese-dark' : 'timecheese'
}

export function getStoredTheme(): ThemeMode {
  const storedTheme = localStorage.getItem(THEME_STORAGE_KEY)
  if (THEMES.includes(storedTheme as ThemeMode)) return storedTheme as ThemeMode
  return defaultTheme()
}

export function applyTheme(theme: ThemeMode) {
  document.documentElement.dataset.theme = theme
  localStorage.setItem(THEME_STORAGE_KEY, theme)
}
