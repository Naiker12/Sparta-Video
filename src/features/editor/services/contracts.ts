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

export interface ExportBenchmarkReport {
  wallClockTimeMs: number
  totalFrames: number
  effectiveFps: number
  engine: 'webcodecs' | 'mediarecorder' | 'audio-only'
  stages: {
    audioMixdownMs: number
    audioEncodeMs: number
    assetPreloadMs: number
    frameLoopMs: number
    videoFlushMs: number
    muxingAndBlobMs: number
  }
  frameLoopBreakdown: {
    totalMediabunnyDecodeMs: number
    totalHtmlVideoSeekWaitMs: number
    totalCanvasDrawMs: number
    totalEffectsMs: number
    totalBackpressureWaitMs: number
    totalFrameCaptureAndEncodeMs: number
    totalYieldMs: number
    otherLoopOverheadMs: number
    /** @deprecated Compatibility alias */
    totalSeekWaitMs?: number
  }
  frameAverages: {
    avgFrameTotalMs: number
    avgMediabunnyDecodeMs: number
    avgHtmlVideoSeekWaitMs: number
    avgCanvasDrawMs: number
    avgEffectsMs: number
    avgBackpressureWaitMs: number
    avgFrameCaptureAndEncodeMs: number
    /** @deprecated Compatibility alias */
    avgSeekWaitMs?: number
  }
  encoderStats: {
    maxEncodeQueueSize: number
    avgEncodeQueueSize: number
    samplesCount: number
    codec: string
    requestedHardwareAcceleration: string
    webcodecsDecodedAssetsCount?: number
    fallbackHtmlAssetsCount?: number
    supportProbe?: {
      preferHardwareSupported: boolean
      preferSoftwareSupported: boolean
      noPreferenceSupported: boolean
    }
  }
}

export interface RenderResult {
  blob: Blob
  fileName: string
  durationSeconds: number
  sizeBytes: number
  benchmark?: ExportBenchmarkReport
}

export type PlaybackStatus = 'unavailable' | 'idle' | 'playing' | 'buffering' | 'ended'

