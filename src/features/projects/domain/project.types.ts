import type { MediaItem, SequenceSettings, SilenceSuggestion, TimelineMarker, Track, TranscriptCue } from '../../editor/model'
import type { ProjectPresetFormat } from './project-factory'

export type { ProjectPresetFormat }

export type ProjectId = string

export const CURRENT_PROJECT_SCHEMA_VERSION = 2 as const
export type CurrentProjectSchemaVersion = typeof CURRENT_PROJECT_SCHEMA_VERSION

export type PersistedProjectState = {
  projectName: string
  sequence: SequenceSettings
  tracks: Track[]
  assets: MediaItem[]
  markers: TimelineMarker[]
  snapToFrames: boolean
  mutedTracks: string[]
  lockedTracks: string[]
  transcript?: TranscriptCue[]
  silenceSuggestions?: SilenceSuggestion[]
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
  schemaVersion: CurrentProjectSchemaVersion
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

