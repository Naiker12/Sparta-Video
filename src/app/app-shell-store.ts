import { create } from 'zustand'

export type AppView = 'home' | 'editor'
export type OpenBehavior = 'home' | 'last-project'

interface AppShellState {
  view: AppView
  currentProjectId: string | null
  openBehavior: OpenBehavior
  newProjectDialogOpen: boolean
  setView: (view: AppView) => void
  setCurrentProjectId: (id: string | null) => void
  setOpenBehavior: (behavior: OpenBehavior) => void
  setNewProjectDialogOpen: (open: boolean) => void
  openProject: (id: string) => void
  goHome: () => void
}

const STORAGE_KEY_OPEN_BEHAVIOR = 'sparta-open-behavior'
const STORAGE_KEY_LAST_PROJECT = 'sparta-last-project-id'

export function readStoredOpenBehavior(): OpenBehavior {
  try {
    const val = localStorage.getItem(STORAGE_KEY_OPEN_BEHAVIOR)
    return val === 'last-project' ? 'last-project' : 'home'
  } catch {
    return 'home'
  }
}

export function readStoredLastProjectId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY_LAST_PROJECT)
  } catch {
    return null
  }
}

export function persistOpenBehavior(behavior: OpenBehavior): void {
  try {
    localStorage.setItem(STORAGE_KEY_OPEN_BEHAVIOR, behavior)
  } catch {
    /* ignore */
  }
}

export function persistLastProjectId(id: string | null): void {
  try {
    if (id) {
      localStorage.setItem(STORAGE_KEY_LAST_PROJECT, id)
    } else {
      localStorage.removeItem(STORAGE_KEY_LAST_PROJECT)
    }
  } catch {
    /* ignore */
  }
}

export const useAppShellStore = create<AppShellState>((set) => ({
  view: 'home',
  currentProjectId: null,
  openBehavior: readStoredOpenBehavior(),
  newProjectDialogOpen: false,
  setView: (view) => set({ view }),
  setCurrentProjectId: (currentProjectId) => {
    persistLastProjectId(currentProjectId)
    set({ currentProjectId })
  },
  setOpenBehavior: (openBehavior) => {
    persistOpenBehavior(openBehavior)
    set({ openBehavior })
  },
  setNewProjectDialogOpen: (newProjectDialogOpen) => set({ newProjectDialogOpen }),
  openProject: (id) => {
    persistLastProjectId(id)
    set({ currentProjectId: id, view: 'editor' })
  },
  goHome: () => set({ view: 'home' }),
}))

