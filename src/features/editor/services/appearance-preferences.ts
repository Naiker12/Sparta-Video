import { useSyncExternalStore } from 'react'

export type AppearanceTheme = 'light' | 'dark' | 'system'
export type AppearancePalette = 'standard' | 'classic' | 'minimal'
export type AppearanceMode = 'light' | 'dark'
export type AppearanceColors = { accent: string | null; background: string | null; foreground: string | null }
export type AppearancePreferences = {
  theme: AppearanceTheme
  palette: AppearancePalette
  colors: Record<AppearanceMode, AppearanceColors>
}

const STORAGE_KEY = 'sparta-video-appearance'
const EMPTY_COLORS: AppearanceColors = { accent: null, background: null, foreground: null }
const DEFAULTS: AppearancePreferences = {
  theme: 'dark',
  palette: 'classic',
  colors: { light: { ...EMPTY_COLORS }, dark: { ...EMPTY_COLORS } },
}

const PALETTE_ACCENTS: Record<AppearancePalette, Record<AppearanceMode, string>> = {
  standard: { light: '#6d28d9', dark: '#a78bfa' },
  classic: { light: '#339cff', dark: '#4dabff' },
  minimal: { light: '#171717', dark: '#ededed' },
}
const PALETTE_HOVERS: Record<AppearancePalette, Record<AppearanceMode, string>> = {
  standard: { light: '#5b21b6', dark: '#8b5cf6' },
  classic: { light: '#0f6fd6', dark: '#1f7fe8' },
  minimal: { light: '#333333', dark: '#d4d4d4' },
}

function validHex(value: unknown): value is string {
  return typeof value === 'string' && /^#[\da-f]{6}$/i.test(value)
}

function foregroundFor(color: string) {
  const channels = [1, 3, 5].map((offset) => Number.parseInt(color.slice(offset, offset + 2), 16) / 255)
  const luminance = channels.map((value) => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4)
    .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0)
  return luminance > .42 ? '#171717' : '#ffffff'
}

function readStored(): AppearancePreferences {
  try {
    const value = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? 'null') as Partial<AppearancePreferences> | null
    if (!value) return DEFAULTS
    const theme = value.theme === 'light' || value.theme === 'dark' || value.theme === 'system' ? value.theme : DEFAULTS.theme
    const palette = value.palette === 'standard' || value.palette === 'classic' || value.palette === 'minimal' ? value.palette : DEFAULTS.palette
    const readMode = (mode: AppearanceMode): AppearanceColors => {
      const raw = value.colors?.[mode]
      return {
        accent: validHex(raw?.accent) ? raw.accent : null,
        background: validHex(raw?.background) ? raw.background : null,
        foreground: validHex(raw?.foreground) ? raw.foreground : null,
      }
    }
    return { theme, palette, colors: { light: readMode('light'), dark: readMode('dark') } }
  } catch {
    return DEFAULTS
  }
}

let preferences = readStored()
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((listener) => listener())
const subscribe = (listener: () => void) => {
  listeners.add(listener)
  const media = window.matchMedia?.('(prefers-color-scheme: dark)')
  const onSystemTheme = () => { if (preferences.theme === 'system') { apply(); notify() } }
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY || event.key === null) {
      preferences = readStored()
      apply()
      notify()
    }
  }
  media?.addEventListener('change', onSystemTheme)
  window.addEventListener('storage', onStorage)
  apply()
  return () => {
    listeners.delete(listener)
    media?.removeEventListener('change', onSystemTheme)
    window.removeEventListener('storage', onStorage)
  }
}

function resolvedTheme(): AppearanceMode {
  if (preferences.theme === 'system') return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  return preferences.theme
}

function apply() {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  const mode = resolvedTheme()
  const colors = preferences.colors[mode]
  const accent = colors.accent ?? PALETTE_ACCENTS[preferences.palette][mode]
  root.dataset.theme = mode
  root.dataset.palette = preferences.palette
  root.style.colorScheme = mode
  root.style.setProperty('--accent', accent)
  root.style.setProperty('--accent-hover', colors.accent ?? PALETTE_HOVERS[preferences.palette][mode])
  root.style.setProperty('--accent-subtle', `${accent}22`)
  root.style.setProperty('--control-accent', accent)
  root.style.setProperty('--accent-foreground', foregroundFor(accent))
  if (colors.background) root.style.setProperty('--bg', colors.background)
  else root.style.removeProperty('--bg')
  if (colors.foreground) root.style.setProperty('--text', colors.foreground)
  else root.style.removeProperty('--text')
}

function save(next: AppearancePreferences) {
  preferences = next
  apply()
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch { /* keep the change for this session */ }
  notify()
}

export function setAppearanceTheme(theme: AppearanceTheme) { save({ ...preferences, theme }) }
export function setAppearancePalette(palette: AppearancePalette) { save({ ...preferences, palette }) }
export function setAppearanceColor(mode: AppearanceMode, color: keyof AppearanceColors, value: string | null) {
  save({ ...preferences, colors: { ...preferences.colors, [mode]: { ...preferences.colors[mode], [color]: value } } })
}
export function resetAppearanceColors(mode: AppearanceMode) {
  save({ ...preferences, colors: { ...preferences.colors, [mode]: { ...EMPTY_COLORS } } })
}
export function resetAppearancePreferences() { save({ ...DEFAULTS, colors: { light: { ...EMPTY_COLORS }, dark: { ...EMPTY_COLORS } } }) }
export function useAppearancePreferences() {
  return useSyncExternalStore(subscribe, () => preferences, () => DEFAULTS)
}
export function getResolvedAppearanceTheme() { return resolvedTheme() }
