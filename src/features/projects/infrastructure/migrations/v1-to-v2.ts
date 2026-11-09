import type { ProjectRecord } from '../../domain/project.types'
import { CURRENT_PROJECT_SCHEMA_VERSION } from '../../domain/project.types'
import { spartaProjectFileV1Schema, type SpartaProjectFileV1 } from '../../domain/project.schema'

export function isV1Project(data: unknown): data is SpartaProjectFileV1 {
  return spartaProjectFileV1Schema.safeParse(data).success
}

/**
 * Migrates a V1 project payload into a canonical V2 ProjectRecord.
 */
export function migrateV1ToV2(raw: unknown, fallbackId: string = crypto.randomUUID()): ProjectRecord {
  const parsed = spartaProjectFileV1Schema.safeParse(raw)
  if (!parsed.success) {
    throw new Error(`Invalid V1 project schema: ${parsed.error.message}`)
  }

  const v1 = parsed.data
  const now = new Date().toISOString()

  return {
    id: fallbackId,
    schemaVersion: CURRENT_PROJECT_SCHEMA_VERSION,
    createdAt: v1.createdAt || now,
    updatedAt: now,
    origin: { kind: 'import' },
    state: {
      projectName: v1.project.name || 'Sin título',
      sequence: v1.project.sequence,
      tracks: v1.project.tracks,
      assets: v1.project.assets,
      markers: v1.project.markers ?? [],
      snapToFrames: v1.project.snapToFrames ?? true,
      mutedTracks: [],
      lockedTracks: [],
    },
    workspace: {
      playhead: 0,
      zoom: 1,
      selectedClipId: null,
    },
  }
}
