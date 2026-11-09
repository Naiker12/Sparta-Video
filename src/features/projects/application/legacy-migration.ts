import type { ProjectRepository } from './project-repository'
import type { ProjectRecord } from '../domain/project.types'
import { defaultProjectRepository } from '../infrastructure/idb-project-repository'

export const LEGACY_STORAGE_KEY = 'sparta-video-project-v1'
export const LEGACY_BACKUP_KEY = 'sparta-video-legacy-backup-v1'

export interface MigrationResult {
  migrated: boolean
  projectId?: string
  error?: string
}

export async function migrateLegacyProject(
  repo: ProjectRepository = defaultProjectRepository,
  storage: Storage = typeof window !== 'undefined' ? window.localStorage : ({} as Storage),
): Promise<MigrationResult> {
  try {
    if (!storage || typeof storage.getItem !== 'function') {
      return { migrated: false }
    }

    const raw = storage.getItem(LEGACY_STORAGE_KEY)
    if (!raw) return { migrated: false }

    // If projects already exist in IndexedDB, do not overwrite or auto-import unless empty
    const existing = await repo.listSummaries({ includeDeleted: true })
    if (existing.length > 0) {
      return { migrated: false }
    }

    const parsed = JSON.parse(raw)
    const state = parsed.state ?? parsed
    if (!state || !state.projectName) {
      return { migrated: false }
    }

    const newId = crypto.randomUUID()
    const now = new Date().toISOString()

    const record: ProjectRecord = {
      id: newId,
      schemaVersion: 2,
      createdAt: now,
      updatedAt: now,
      origin: { kind: 'blank' },
      state: {
        projectName: state.projectName || 'Sin título',
        sequence: state.sequence ?? { width: 1920, height: 1080, frameRate: 24 },
        tracks: state.tracks ?? [],
        assets: state.assets ?? [],
        markers: state.markers ?? [],
        snapToFrames: state.snapToFrames ?? true,
        mutedTracks: state.mutedTracks ?? [],
        lockedTracks: state.lockedTracks ?? [],
      },
      workspace: {
        playhead: 0,
        zoom: 1,
        selectedClipId: null,
      },
    }

    // 1. Save to new IndexedDB repository
    await repo.saveProject(record)

    // 2. Verify: read back and verify
    const readBack = await repo.getProject(newId)
    if (!readBack || readBack.state.projectName !== record.state.projectName) {
      throw new Error('Verification failed: project could not be verified after write')
    }

    // 3. Make a safety backup in localStorage before clearing
    try {
      storage.setItem(LEGACY_BACKUP_KEY, raw)
    } catch {
      /* ignore quota errors on backup */
    }

    // 4. Only delete the old key after verification and backup
    storage.removeItem(LEGACY_STORAGE_KEY)

    return { migrated: true, projectId: newId }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { migrated: false, error: message }
  }
}

