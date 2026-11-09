import type { SequenceSettings, Track } from '../../editor/model'
import type { ProjectRecord } from './project.types'

export type ProjectPresetFormat = '16:9' | '9:16' | '1:1' | '4:5' | '21:9'

export const FORMAT_RESOLUTIONS: Record<ProjectPresetFormat, { width: number; height: number }> = {
  '16:9': { width: 1920, height: 1080 },
  '9:16': { width: 1080, height: 1920 },
  '1:1': { width: 1080, height: 1080 },
  '4:5': { width: 1080, height: 1350 },
  '21:9': { width: 2560, height: 1080 },
}

export function createDefaultTracks(): Track[] {
  return [
    { id: 'v1', name: 'Video 01', kind: 'video', clips: [] },
    { id: 'a1', name: 'Audio 01', kind: 'audio', clips: [] },
  ]
}

export interface CreateProjectOptions {
  id?: string
  name?: string
  format?: ProjectPresetFormat
  customResolution?: { width: number; height: number }
  fps?: number
  origin?: ProjectRecord['origin']
}

export function createEmptyProject({
  id = crypto.randomUUID(),
  name = 'Sin título',
  format = '16:9',
  customResolution,
  fps = 24,
  origin = { kind: 'blank' },
}: CreateProjectOptions = {}): ProjectRecord {
  const resolution = customResolution ?? FORMAT_RESOLUTIONS[format]
  const now = new Date().toISOString()
  const sequence: SequenceSettings = {
    width: resolution.width,
    height: resolution.height,
    frameRate: fps,
  }

  return {
    id,
    schemaVersion: 2,
    createdAt: now,
    updatedAt: now,
    origin,
    state: {
      projectName: name,
      sequence,
      tracks: createDefaultTracks(),
      assets: [],
      markers: [],
      snapToFrames: true,
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

