import { describe, expect, it } from 'vitest'
import { CURRENT_PROJECT_SCHEMA_VERSION } from '../../domain/project.types'
import { runProjectMigrations } from './runner'
import { SPARTA_PROJECT_FORMAT } from '../../domain/project.schema'

describe('Project Migrations Runner', () => {
  it('migrates a V1 project file cleanly to current V2 ProjectRecord', () => {
    const v1File = {
      format: SPARTA_PROJECT_FORMAT,
      version: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
      project: {
        name: 'Legacy V1 Film',
        sequence: { width: 1920, height: 1080, frameRate: 24 },
        tracks: [{ id: 'v1', name: 'Video', kind: 'video', clips: [] }],
        assets: [],
      },
    }

    const migrated = runProjectMigrations(v1File, 'target-test-id')
    expect(migrated.id).toBe('target-test-id')
    expect(migrated.schemaVersion).toBe(CURRENT_PROJECT_SCHEMA_VERSION)
    expect(migrated.state.projectName).toBe('Legacy V1 Film')
    expect(migrated.state.tracks).toHaveLength(1)
    expect(migrated.workspace?.playhead).toBe(0)
  })

  it('preserves an already valid V2 project file', () => {
    const v2File = {
      format: SPARTA_PROJECT_FORMAT,
      version: 2,
      id: 'existing-id-123',
      createdAt: '2026-03-01T00:00:00.000Z',
      updatedAt: '2026-03-01T01:00:00.000Z',
      project: {
        projectName: 'Direct V2',
        sequence: { width: 1080, height: 1920, frameRate: 30 },
        tracks: [],
        assets: [],
        markers: [],
        snapToFrames: true,
        mutedTracks: [],
        lockedTracks: [],
      },
      workspace: {
        playhead: 4.5,
        zoom: 2,
        selectedClipId: 'clip-1',
      },
    }

    const migrated = runProjectMigrations(v2File)
    expect(migrated.id).toBe('existing-id-123')
    expect(migrated.schemaVersion).toBe(CURRENT_PROJECT_SCHEMA_VERSION)
    expect(migrated.state.projectName).toBe('Direct V2')
    expect(migrated.workspace?.playhead).toBe(4.5)
  })

  it('migrates legacy raw localStorage state to V2 ProjectRecord', () => {
    const rawLegacy = {
      projectName: 'Local Storage Old Project',
      sequence: { width: 1920, height: 1080, frameRate: 24 },
      tracks: [],
      assets: [],
    }

    const migrated = runProjectMigrations(rawLegacy, 'local-storage-id')
    expect(migrated.id).toBe('local-storage-id')
    expect(migrated.schemaVersion).toBe(CURRENT_PROJECT_SCHEMA_VERSION)
    expect(migrated.state.projectName).toBe('Local Storage Old Project')
  })

  it('throws descriptive error on invalid corrupted input', () => {
    expect(() => runProjectMigrations({ random: 'garbage' })).toThrow(/no reconocido/i)
  })
})
