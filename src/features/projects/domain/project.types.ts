import type { MediaItem, SequenceSettings, TimelineMarker, Track } from '../../editor/model'
import type { ProjectPresetFormat } from './project-factory'

export type { ProjectPresetFormat }

export type ProjectId = string

export type PersistedProjectState = {
  projectName: string
  sequence: SequenceSettings
  tracks: Track[]
  assets: MediaItem[]
  markers: TimelineMarker[]
  snapToFrames: boolean
  mutedTracks: string[]
  lockedTracks: string[]
}

export type ProjectWorkspace = {
  playhead: number
  zoom: number
  selectedClipId: string | null
}

export type ProjectOrigin = {
  kind: 'blank' | 'template' | 'import'
  templateId?: string
}

export type ProjectRecord = {
  id: ProjectId
  schemaVersion: 2
  createdAt: string
  updatedAt: string
  origin?: ProjectOrigin
  state: PersistedProjectState
  workspace?: ProjectWorkspace
}

export type ProjectSummary = {
  id: ProjectId
  name: string
  createdAt: string
  updatedAt: string
  durationSeconds: number
  clipCount: number
  sequence: { width: number; height: number; frameRate: number }
  coverBlobKey?: string
  coverAssetId?: string
  hasMissingMedia: boolean
  deletedAt?: string
}

