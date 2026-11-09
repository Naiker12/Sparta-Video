import { BUILTIN_TEMPLATES } from '../catalog/builtin-templates'
import type { TemplateRepository } from '../application/template-repository'
import type { SpartaTemplate } from '../domain/template.types'

const DB_NAME = 'sparta-video-projects-v1'
const DB_VERSION = 1
const STORE_TEMPLATES = 'templates'
const LEGACY_DB_NAME = 'sparta-templates-db'

export class IdbTemplateRepository implements TemplateRepository {
  dbName: string
  private dbPromise: Promise<IDBDatabase> | null = null
  private migrationAttempted = false

  constructor(dbName = DB_NAME) {
    this.dbName = dbName
  }

  private async getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise

    this.dbPromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('IndexedDB no está disponible en este entorno'))
        return
      }

      const request = indexedDB.open(this.dbName, DB_VERSION)

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        if (!db.objectStoreNames.contains(STORE_TEMPLATES)) {
          db.createObjectStore(STORE_TEMPLATES, { keyPath: 'id' })
        }
      }

      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })

    const db = await this.dbPromise

    // Migrate templates from legacy DB if present
    if (!this.migrationAttempted && typeof indexedDB !== 'undefined') {
      this.migrationAttempted = true
      void this.migrateFromLegacyDb(db).catch(() => {})
    }

    return db
  }

  private async migrateFromLegacyDb(targetDb: IDBDatabase): Promise<void> {
    try {
      const legacyOpen = indexedDB.open(LEGACY_DB_NAME, 1)
      const legacyDb = await new Promise<IDBDatabase>((res, rej) => {
        legacyOpen.onsuccess = () => res(legacyOpen.result)
        legacyOpen.onerror = () => rej(legacyOpen.error)
      })

      if (legacyDb.objectStoreNames.contains('user_templates')) {
        const legacyTx = legacyDb.transaction('user_templates', 'readonly')
        const legacyStore = legacyTx.objectStore('user_templates')
        const items = await new Promise<SpartaTemplate[]>((res, rej) => {
          const req = legacyStore.getAll()
          req.onsuccess = () => res(req.result as SpartaTemplate[])
          req.onerror = () => rej(req.error)
        })

        if (items.length > 0) {
          const targetTx = targetDb.transaction(STORE_TEMPLATES, 'readwrite')
          const targetStore = targetTx.objectStore(STORE_TEMPLATES)
          for (const item of items) {
            targetStore.put(item)
          }
          await new Promise<void>((res, rej) => {
            targetTx.oncomplete = () => res()
            targetTx.onerror = () => rej(targetTx.error)
          })
        }
      }
      legacyDb.close()
    } catch {
      // Legacy DB does not exist or already migrated
    }
  }

  async close(): Promise<void> {
    if (this.dbPromise) {
      try {
        const db = await this.dbPromise
        db.close()
      } catch {
        /* ignore */
      } finally {
        this.dbPromise = null
      }
    }
  }

  async listTemplates(): Promise<SpartaTemplate[]> {
    const userTemplates = await this.getUserTemplates()
    return [...BUILTIN_TEMPLATES, ...userTemplates]
  }

  private async getUserTemplates(): Promise<SpartaTemplate[]> {
    try {
      const db = await this.getDB()
      return new Promise<SpartaTemplate[]>((resolve, reject) => {
        const tx = db.transaction(STORE_TEMPLATES, 'readonly')
        const store = tx.objectStore(STORE_TEMPLATES)
        const req = store.getAll()
        req.onsuccess = () => resolve(req.result as SpartaTemplate[])
        req.onerror = () => reject(req.error)
      })
    } catch {
      return []
    }
  }

  async getTemplate(id: string): Promise<SpartaTemplate | null> {
    const builtin = BUILTIN_TEMPLATES.find((t) => t.id === id)
    if (builtin) return builtin

    try {
      const db = await this.getDB()
      return new Promise<SpartaTemplate | null>((resolve, reject) => {
        const tx = db.transaction(STORE_TEMPLATES, 'readonly')
        const store = tx.objectStore(STORE_TEMPLATES)
        const req = store.get(id)
        req.onsuccess = () => resolve(req.result ? (req.result as SpartaTemplate) : null)
        req.onerror = () => reject(req.error)
      })
    } catch {
      return null
    }
  }

  async saveTemplate(template: SpartaTemplate): Promise<void> {
    const db = await this.getDB()
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_TEMPLATES, 'readwrite')
      const store = tx.objectStore(STORE_TEMPLATES)
      const req = store.put({ ...template, isBuiltIn: false })
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
  }

  async deleteTemplate(id: string): Promise<void> {
    // Builtin templates cannot be deleted
    if (BUILTIN_TEMPLATES.some((t) => t.id === id)) {
      return
    }

    const db = await this.getDB()
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_TEMPLATES, 'readwrite')
      const store = tx.objectStore(STORE_TEMPLATES)
      const req = store.delete(id)
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
  }
}

export const defaultTemplateRepository = new IdbTemplateRepository()


