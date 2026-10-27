import { useSyncExternalStore } from 'react'

export type Language = 'es' | 'en'
const STORAGE_KEY = 'sparta-video-language'
const read = (): Language => {
  try {
    const proc = (globalThis as unknown as { process?: { env?: { NODE_ENV?: string } } }).process
    const meta = import.meta as unknown as { env?: { MODE?: string } }
    const isTest = proc?.env?.NODE_ENV === 'test' || meta?.env?.MODE === 'test'
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored === 'en' || stored === 'es') return stored
    return isTest ? 'en' : 'es'
  } catch { return 'es' }
}
let language: Language = read()
function applyDocumentLanguage() {
  if (typeof document !== 'undefined') document.documentElement.lang = language
}
const listeners = new Set<() => void>()
const subscribe = (listener: () => void) => {
  listeners.add(listener)
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY || event.key === null) {
      language = read()
      applyDocumentLanguage()
      listener()
    }
  }
  window.addEventListener('storage', onStorage)
  return () => { listeners.delete(listener); window.removeEventListener('storage', onStorage) }
}

export function setLanguage(next: Language) {
  if (language === next) return
  language = next
  applyDocumentLanguage()
  try { window.localStorage.setItem(STORAGE_KEY, next) } catch { /* keep this session's language */ }
  listeners.forEach((listener) => listener())
}

applyDocumentLanguage()

export function useLanguage() {
  return useSyncExternalStore(subscribe, () => language, () => 'es')
}

export function t(spanish: string, english: string) {
  return language === 'en' ? english : spanish
}
