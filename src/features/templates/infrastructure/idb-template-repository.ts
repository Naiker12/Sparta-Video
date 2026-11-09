import { BUILTIN_TEMPLATES } from '../catalog/builtin-templates'
import type { TemplateRepository } from '../application/template-repository'
import type { SpartaTemplate } from '../domain/template.types'

const DB_NAME = 'sparta-templates-db'
const DB_VERSION = 1
const STORE_TEMPLATES = 'user_templates'

export class IdbTemplateRepository implements TemplateRepository {
  dbName: string
  private dbPromise: Promise<IDBDatabase> | null = null

  constructor(dbName = DB_NAME) {
    this.dbName = dbName
  }

  private getDB(): Promise<IDBDatabase> {
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

    return this.dbPromise
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

