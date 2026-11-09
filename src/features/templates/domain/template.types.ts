import type { PersistedProjectState, ProjectPresetFormat } from '../../projects/domain/project.types'

export type TemplateCategory =
  | 'stickman'
  | 'social-media'
  | 'youtube'
  | 'business'
  | 'education'
  | 'cinematic'
  | 'general'

export type SlotType = 'video' | 'audio' | 'image' | 'text' | 'color' | 'number'

export interface TemplateSlot {
  id: string
  label: string
  type: SlotType
  targetClipId: string
  targetProperty?: 'text' | 'color' | 'fillColor' | 'asset' | 'fontSize'
  description?: string
  defaultText?: string
  defaultValue?: string | number
  recommendedDuration?: number
  options?: { label: string; value: string }[]
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
  color?: string
  numberValue?: number
  sourcePath?: string
}

