import type { PersistedProjectState, ProjectPresetFormat } from '../../projects/domain/project.types'

export type TemplateCategory =
  | 'stickman'
  | 'social-media'
  | 'youtube'
  | 'business'
  | 'education'
  | 'general'

export type SlotType = 'video' | 'audio' | 'image' | 'text'

export interface TemplateSlot {
  id: string
  label: string
  type: SlotType
  targetClipId: string
  description?: string
  defaultText?: string
  recommendedDuration?: number
}

export interface SlotGroup {
  id: string
  name: string
  slotIds: string[]
}

export interface SpartaTemplate {
  id: string
  name: string
  description: string
  category: TemplateCategory
  format: ProjectPresetFormat
  durationSeconds: number
  thumbnail?: string
  isBuiltIn: boolean
  createdAt: string
  updatedAt?: string
  slots: TemplateSlot[]
  slotGroups?: SlotGroup[]
  state: PersistedProjectState
}

export interface SlotFillValue {
  type: SlotType
  assetId?: string
  text?: string
  sourcePath?: string
}

