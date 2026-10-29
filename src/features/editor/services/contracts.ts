import { z } from 'zod'

export const MediaMetadataSchema = z.object({
  name: z.string().min(1),
  mimeType: z.string(),
  sizeBytes: z.number().nonnegative(),
  durationSeconds: z.number().nonnegative().optional(),
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
  status: z.enum(['catalog-only', 'ready', 'missing', 'processing', 'error']),
})
export type MediaMetadata = z.infer<typeof MediaMetadataSchema>

export const ExportPresetIdSchema = z.enum([
  'web-1080p',
  'social-vertical',
  'uhd-4k',
  'fast-720p',
  'audio-only',
])
export type ExportPresetId = z.infer<typeof ExportPresetIdSchema>

export const ExportSettingsSchema = z.object({
  preset: ExportPresetIdSchema,
  format: z.enum(['webm', 'mp4', 'wav']),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  frameRate: z.number().positive(),
  bitrateMbps: z.number().positive(),
  fileName: z.string().min(1),
  range: z.enum(['entire', 'selection']),
})
export type ExportSettings = z.infer<typeof ExportSettingsSchema>

export type RenderStage = 'idle' | 'preparing' | 'rendering' | 'encoding' | 'completed' | 'cancelled' | 'error'

export interface RenderProgress {
  stage: RenderStage
  percent: number
  currentFrame: number
  totalFrames: number
  fps?: number
  message?: string
}

export interface RenderResult {
  blob: Blob
  fileName: string
  durationSeconds: number
  sizeBytes: number
}

export type PlaybackStatus = 'unavailable' | 'idle' | 'playing' | 'buffering' | 'ended'

