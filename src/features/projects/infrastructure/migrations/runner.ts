import type { ProjectRecord } from '../../domain/project.types'
import { CURRENT_PROJECT_SCHEMA_VERSION } from '../../domain/project.types'
import { spartaProjectFileV2Schema } from '../../domain/project.schema'
import { migrateV1ToV2, isV1Project } from './v1-to-v2'

/**
 * Executes schema migrations on arbitrary project JSON payloads to bring them up to
 * the latest canonical ProjectRecord format.
 */
export function runProjectMigrations(raw: unknown, targetId: string = crypto.randomUUID()): ProjectRecord {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Project payload is not a valid object')
  }

  // 1. Check if already a valid V2 ProjectRecord or V2 exported file
  const v2Parsed = spartaProjectFileV2Schema.safeParse(raw)
  if (v2Parsed.success) {
    const v2 = v2Parsed.data
    const now = new Date().toISOString()
    return {
      id: v2.id || targetId,
      schemaVersion: CURRENT_PROJECT_SCHEMA_VERSION,
      createdAt: v2.createdAt || now,
      updatedAt: now,
      origin: { kind: 'import' },
      state: v2.project,
      workspace: v2.workspace,
    }
  }

  // Check if raw is already an internal ProjectRecord (schemaVersion: 2)
  const candidate = raw as Record<string, unknown>
  if (candidate.schemaVersion === CURRENT_PROJECT_SCHEMA_VERSION && candidate.state && candidate.id) {
    return raw as ProjectRecord
  }

  // 2. Check if V1 project file and upgrade to V2
  if (isV1Project(raw)) {
    return migrateV1ToV2(raw, targetId)
  }

  // 3. Check if legacy localStorage shape: { projectName, tracks, ... } or { state: { ... } }
  const stateCandidate = (candidate.state ?? candidate) as Record<string, unknown>
  if (typeof stateCandidate === 'object' && stateCandidate !== null && 'projectName' in stateCandidate) {
    const now = new Date().toISOString()
    return {
      id: targetId,
      schemaVersion: CURRENT_PROJECT_SCHEMA_VERSION,
      createdAt: now,
      updatedAt: now,
      origin: { kind: 'blank' },
      state: {
        projectName: (stateCandidate.projectName as string) || 'Sin título',
        sequence: (stateCandidate.sequence as ProjectRecord['state']['sequence']) ?? {
          width: 1920,
          height: 1080,
          frameRate: 24,
        },
        tracks: (stateCandidate.tracks as ProjectRecord['state']['tracks']) ?? [],
        assets: (stateCandidate.assets as ProjectRecord['state']['assets']) ?? [],
        markers: (stateCandidate.markers as ProjectRecord['state']['markers']) ?? [],
        snapToFrames: (stateCandidate.snapToFrames as boolean) ?? true,
        mutedTracks: (stateCandidate.mutedTracks as string[]) ?? [],
        lockedTracks: (stateCandidate.lockedTracks as string[]) ?? [],
      },
      workspace: {
        playhead: 0,
        zoom: 1,
        selectedClipId: null,
      },
    }
  }

  throw new Error('Formato de proyecto no reconocido o datos corruptos')
}
