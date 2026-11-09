import type { ProjectId, ProjectRecord, PersistedProjectState, ProjectWorkspace } from '../domain/project.types'
import type { ProjectRepository } from './project-repository'
import { defaultProjectRepository } from '../infrastructure/idb-project-repository'

export type AutosaveStatus = 'saved' | 'saving' | 'unsaved' | 'error'

export interface AutosaveOptions {
  projectId: ProjectId
  getState: () => PersistedProjectState
  getWorkspace?: () => ProjectWorkspace
  repo?: ProjectRepository
  debounceMs?: number
  onStatusChange?: (status: AutosaveStatus) => void
}

export class ProjectAutosave {
  private projectId: ProjectId
  private getState: () => PersistedProjectState
  private getWorkspace?: () => ProjectWorkspace
  private repo: ProjectRepository
  private debounceMs: number
  private onStatusChange?: (status: AutosaveStatus) => void

  private status: AutosaveStatus = 'saved'
  private debounceTimer: ReturnType<typeof setTimeout> | null = null
  private pendingPromise: Promise<void> | null = null
  private isDestroyed = false
  private lastSavedJson = ''

  constructor(options: AutosaveOptions) {
    this.projectId = options.projectId
    this.getState = options.getState
    this.getWorkspace = options.getWorkspace
    this.repo = options.repo ?? defaultProjectRepository
    this.debounceMs = options.debounceMs ?? 600
    this.onStatusChange = options.onStatusChange

    try {
      this.lastSavedJson = JSON.stringify(this.getState())
    } catch {
      this.lastSavedJson = ''
    }
  }

  getStatus(): AutosaveStatus {
    return this.status
  }

  private setStatus(status: AutosaveStatus) {
    if (this.status === status) return
    this.status = status
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent<AutosaveStatus>('sparta-project-save-status', { detail: status }),
      )
    }
    this.onStatusChange?.(status)
  }

  scheduleSave(): void {
    if (this.isDestroyed) return
    this.setStatus('unsaved')

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
    }

    this.debounceTimer = setTimeout(() => {
      void this.performSave()
    }, this.debounceMs)
  }

  async performSave(): Promise<void> {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }

    if (this.isDestroyed) return

    const currentState = this.getState()
    const currentJson = JSON.stringify(currentState)

    // Skip redundant save if content hasn't changed
    if (currentJson === this.lastSavedJson && this.status === 'saved') {
      return
    }

    this.setStatus('saving')

    const saveExecution = async () => {
      try {
        const existing = await this.repo.getProject(this.projectId)
        const now = new Date().toISOString()

        const record: ProjectRecord = {
          id: this.projectId,
          schemaVersion: 2,
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
          origin: existing?.origin ?? { kind: 'blank' },
          state: currentState,
          workspace: this.getWorkspace ? this.getWorkspace() : existing?.workspace,
        }

        await this.repo.saveProject(record)
        this.lastSavedJson = currentJson
        this.setStatus('saved')
      } catch (err) {
        console.error('Autosave error:', err)
        this.setStatus('error')
        throw err
      } finally {
        this.pendingPromise = null
      }
    }

    this.pendingPromise = saveExecution()
    return this.pendingPromise
  }

  async flush(): Promise<void> {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
      await this.performSave()
    } else if (this.pendingPromise) {
      await this.pendingPromise
    }
  }

  async stop(): Promise<void> {
    this.isDestroyed = true
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }
    if (this.pendingPromise) {
      await this.pendingPromise
    }
  }
}

