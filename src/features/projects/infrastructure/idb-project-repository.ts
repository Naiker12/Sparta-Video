import type { ProjectRepository, ListSummariesOptions } from '../application/project-repository'
import type { ProjectId, ProjectRecord, ProjectSummary } from '../domain/project.types'
import type { ProjectSnapshot } from '../domain/snapshot.types'
import { createProjectSummary } from '../domain/project-summary'

const DEFAULT_DB_NAME = 'sparta-video-projects-v1'
const DB_VERSION = 1

const STORE_PROJECTS = 'projects'
const STORE_SUMMARIES = 'summaries'
const STORE_TEMPLATES = 'templates'
const STORE_SNAPSHOTS = 'snapshots'
const STORE_META = 'meta'

function getIDBFactory(): IDBFactory | null {
  if (typeof indexedDB !== 'undefined') return indexedDB
  if (typeof window !== 'undefined' && window.indexedDB) return window.indexedDB
  return null
}

export class IdbProjectRepository implements ProjectRepository {
  private dbPromise: Promise<IDBDatabase> | null = null
  private dbName: string

  constructor(dbName: string = DEFAULT_DB_NAME) {
    this.dbName = dbName
  }

  async close(): Promise<void> {
    if (this.dbPromise) {
      const db = await this.dbPromise
      db.close()
      this.dbPromise = null
    }
  }

  private openDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise

    const idb = getIDBFactory()
    if (!idb) {
      return Promise.reject(new Error('IndexedDB is not available in this environment'))
    }

    this.dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = idb.open(this.dbName, DB_VERSION)

      request.onupgradeneeded = () => {
        const db = request.result
        if (!db.objectStoreNames.contains(STORE_PROJECTS)) {
          db.createObjectStore(STORE_PROJECTS, { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains(STORE_SUMMARIES)) {
          db.createObjectStore(STORE_SUMMARIES, { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains(STORE_TEMPLATES)) {
          db.createObjectStore(STORE_TEMPLATES, { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains(STORE_SNAPSHOTS)) {
          db.createObjectStore(STORE_SNAPSHOTS, { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains(STORE_META)) {
          db.createObjectStore(STORE_META, { keyPath: 'key' })
        }
      }

      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })

    return this.dbPromise
  }

  private async getStore(storeName: string, mode: IDBTransactionMode): Promise<IDBObjectStore> {
    const db = await this.openDB()
    const tx = db.transaction(storeName, mode)
    return tx.objectStore(storeName)
  }

  async listSummaries(options: ListSummariesOptions = {}): Promise<ProjectSummary[]> {
    const store = await this.getStore(STORE_SUMMARIES, 'readonly')
    return new Promise<ProjectSummary[]>((resolve, reject) => {
      const request = store.getAll()
      request.onsuccess = () => {
        let results = (request.result as ProjectSummary[]) ?? []
        if (!options.includeDeleted) {
          results = results.filter((s) => !s.deletedAt)
        }
        // Order by updatedAt descending by default
        results.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        resolve(results)
      }
      request.onerror = () => reject(request.error)
    })
  }

  async getSummary(id: ProjectId): Promise<ProjectSummary | null> {
    const store = await this.getStore(STORE_SUMMARIES, 'readonly')
    return new Promise<ProjectSummary | null>((resolve, reject) => {
      const request = store.get(id)
      request.onsuccess = () => resolve((request.result as ProjectSummary) ?? null)
      request.onerror = () => reject(request.error)
    })
  }

  async getProject(id: ProjectId): Promise<ProjectRecord | null> {
    const store = await this.getStore(STORE_PROJECTS, 'readonly')
    return new Promise<ProjectRecord | null>((resolve, reject) => {
      const request = store.get(id)
      request.onsuccess = () => resolve((request.result as ProjectRecord) ?? null)
      request.onerror = () => reject(request.error)
    })
  }

  async saveProject(record: ProjectRecord): Promise<void> {
    const db = await this.openDB()
    const tx = db.transaction([STORE_PROJECTS, STORE_SUMMARIES], 'readwrite')
    const projectStore = tx.objectStore(STORE_PROJECTS)
    const summaryStore = tx.objectStore(STORE_SUMMARIES)

    const summary = createProjectSummary(record)

    await new Promise<void>((resolve, reject) => {
      projectStore.put(record)
      summaryStore.put(summary)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error)
    })
  }

  async saveSummary(summary: ProjectSummary): Promise<void> {
    const store = await this.getStore(STORE_SUMMARIES, 'readwrite')
    return new Promise<void>((resolve, reject) => {
      const req = store.put(summary)
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
  }

  async deleteProject(id: ProjectId, permanent = false): Promise<void> {
    if (permanent) {
      const db = await this.openDB()
      const tx = db.transaction([STORE_PROJECTS, STORE_SUMMARIES], 'readwrite')
      await new Promise<void>((resolve, reject) => {
        tx.objectStore(STORE_PROJECTS).delete(id)
        tx.objectStore(STORE_SUMMARIES).delete(id)
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
      })
    } else {
      const summary = await this.getSummary(id)
      if (summary) {
        summary.deletedAt = new Date().toISOString()
        await this.saveSummary(summary)
      }
    }
  }

  async restoreProject(id: ProjectId): Promise<void> {
    const summary = await this.getSummary(id)
    if (summary) {
      delete summary.deletedAt
      await this.saveSummary(summary)
    }
  }

  async emptyTrash(): Promise<void> {
    const summaries = await this.listSummaries({ includeDeleted: true })
    const deleted = summaries.filter((s) => !!s.deletedAt)
    if (deleted.length === 0) return

    const db = await this.openDB()
    const tx = db.transaction([STORE_PROJECTS, STORE_SUMMARIES], 'readwrite')
    const projectStore = tx.objectStore(STORE_PROJECTS)
    const summaryStore = tx.objectStore(STORE_SUMMARIES)

    for (const item of deleted) {
      projectStore.delete(item.id)
      summaryStore.delete(item.id)
    }

    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error)
    })
  }

  async getMeta<T>(key: string): Promise<T | null> {
    const store = await this.getStore(STORE_META, 'readonly')
    return new Promise<T | null>((resolve, reject) => {
      const req = store.get(key)
      req.onsuccess = () => {
        const item = req.result as { key: string; value: T } | undefined
        resolve(item ? item.value : null)
      }
      req.onerror = () => reject(req.error)
    })
  }

  async setMeta<T>(key: string, value: T): Promise<void> {
    const store = await this.getStore(STORE_META, 'readwrite')
    return new Promise<void>((resolve, reject) => {
      const req = store.put({ key, value })
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
  }

  async getAllProjectIds(): Promise<ProjectId[]> {
    const store = await this.getStore(STORE_PROJECTS, 'readonly')
    return new Promise<ProjectId[]>((resolve, reject) => {
      const req = store.getAllKeys()
      req.onsuccess = () => resolve((req.result as ProjectId[]) ?? [])
      req.onerror = () => reject(req.error)
    })
  }

  async getAllProjects(): Promise<ProjectRecord[]> {
    const store = await this.getStore(STORE_PROJECTS, 'readonly')
    return new Promise<ProjectRecord[]>((resolve, reject) => {
      const req = store.getAll()
      req.onsuccess = () => resolve((req.result as ProjectRecord[]) ?? [])
      req.onerror = () => reject(req.error)
    })
  }

  async listSnapshots(projectId: ProjectId): Promise<ProjectSnapshot[]> {
    const store = await this.getStore(STORE_SNAPSHOTS, 'readonly')
    return new Promise<ProjectSnapshot[]>((resolve, reject) => {
      const req = store.getAll()
      req.onsuccess = () => {
        const all = (req.result as ProjectSnapshot[]) ?? []
        const filtered = all
          .filter((s) => s.projectId === projectId)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        resolve(filtered)
      }
      req.onerror = () => reject(req.error)
    })
  }

  async getSnapshot(id: string): Promise<ProjectSnapshot | null> {
    const store = await this.getStore(STORE_SNAPSHOTS, 'readonly')
    return new Promise<ProjectSnapshot | null>((resolve, reject) => {
      const req = store.get(id)
      req.onsuccess = () => resolve((req.result as ProjectSnapshot) ?? null)
      req.onerror = () => reject(req.error)
    })
  }

  async saveSnapshot(snapshot: ProjectSnapshot): Promise<void> {
    const store = await this.getStore(STORE_SNAPSHOTS, 'readwrite')
    return new Promise<void>((resolve, reject) => {
      const req = store.put(snapshot)
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
  }

  async deleteSnapshot(id: string): Promise<void> {
    const store = await this.getStore(STORE_SNAPSHOTS, 'readwrite')
    return new Promise<void>((resolve, reject) => {
      const req = store.delete(id)
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
  }
}

export const defaultProjectRepository = new IdbProjectRepository()
