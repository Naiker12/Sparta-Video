import type { Clip, MediaItem, Track } from '../model'
import type { ExportBenchmarkReport, ExportPresetId, ExportSettings, RenderProgress, RenderResult } from './contracts'
import { loadMediaBlob, loadMediaSource } from './media-storage'
import { getInterpolatedOpacity, getInterpolatedTransform } from './keyframe-interpolation'
import { drawAnimatedTextClipToCanvas } from './text-presets'
import { computeFitRect } from './media-fit'
import { computeTransitionInState } from '../effects/transition-math'
import { applyMaskToCanvas } from './mask-service'
import {
  applyChromaKey,
  applyChromaticAberration,
  applyFilmGrain,
  applyPixelate,
  applyVignette,
  getEffectsCSSFilter,
} from '../effects/pixel-effects'
import { Muxer as Mp4Muxer, ArrayBufferTarget as Mp4ArrayBufferTarget } from 'mp4-muxer'
import { Muxer as WebmMuxer, ArrayBufferTarget as WebmArrayBufferTarget } from 'webm-muxer'
import { ALL_FORMATS, BlobSource, Input, VideoSample, VideoSampleSink } from 'mediabunny'

export const EXPORT_PRESETS: Record<ExportPresetId, {
  label: string
  description: string
  width: number
  height: number
  frameRate: number
  bitrateMbps: number
  format: 'webm' | 'mp4' | 'wav'
}> = {
  'web-1080p': {
    label: '1080p Full HD (MP4 / Web)',
    description: '1920 × 1080 · 30 fps · 8 Mbps',
    width: 1920,
    height: 1080,
    frameRate: 30,
    bitrateMbps: 8,
    format: 'mp4',
  },
  'social-vertical': {
    label: '1080p Vertical (TikTok / Reels / Shorts)',
    description: '1080 × 1920 · 30 fps · 8 Mbps',
    width: 1080,
    height: 1920,
    frameRate: 30,
    bitrateMbps: 8,
    format: 'mp4',
  },
  'uhd-4k': {
    label: '4K Ultra HD (Master)',
    description: '3840 × 2160 · 30 fps · 25 Mbps',
    width: 3840,
    height: 2160,
    frameRate: 30,
    bitrateMbps: 25,
    format: 'mp4',
  },
  'fast-720p': {
    label: '720p HD Rápido (Borrador)',
    description: '1280 × 720 · 30 fps · 4 Mbps',
    width: 1280,
    height: 720,
    frameRate: 30,
    bitrateMbps: 4,
    format: 'mp4',
  },
  'audio-only': {
    label: 'Audio Master (Mixdown estéreo)',
    description: 'WAV · PCM 48 kHz · 24/16-bit · Estéreo',
    width: 1920,
    height: 1080,
    frameRate: 30,
    bitrateMbps: 1.5,
    format: 'wav',
  },
}

export function getDefaultExportSettings(projectName: string, preset: ExportPresetId = 'web-1080p'): ExportSettings {
  const p = EXPORT_PRESETS[preset]
  const safeName = projectName.trim().replace(/[^\p{L}\p{N}_-]+/gu, '_').replace(/^_+|_+$/g, '') || 'video_export'
  return {
    preset,
    format: p.format,
    width: p.width,
    height: p.height,
    frameRate: p.frameRate,
    bitrateMbps: p.bitrateMbps,
    fileName: `${safeName}.${p.format}`,
    range: 'entire',
  }
}

/**
 * Encodes an AudioBuffer to a standard 16-bit PCM WAV Blob.
 */
export function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels
  const sampleRate = buffer.sampleRate
  const length = buffer.length * numChannels * 2
  const arrayBuffer = new ArrayBuffer(44 + length)
  const view = new DataView(arrayBuffer)

  // Write WAV header
  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i))
  }

  writeString(0, 'RIFF')
  view.setUint32(4, 36 + length, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true) // PCM chunk size
  view.setUint16(20, 1, true) // Audio format: PCM
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * numChannels * 2, true) // Byte rate
  view.setUint16(32, numChannels * 2, true) // Block align
  view.setUint16(34, 16, true) // Bits per sample
  writeString(36, 'data')
  view.setUint32(40, length, true)

  // Interleave channels
  const channels: Float32Array[] = []
  for (let c = 0; c < numChannels; c++) channels.push(buffer.getChannelData(c))

  let offset = 44
  for (let i = 0; i < buffer.length; i++) {
    for (let c = 0; c < numChannels; c++) {
      const sample = Math.max(-1, Math.min(1, channels[c][i]))
      const int16 = sample < 0 ? sample * 0x8000 : sample * 0x7FFF
      view.setInt16(offset, int16, true)
      offset += 2
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' })
}

function resolveClipAssetId(clip: Clip, assets: MediaItem[]): string | undefined {
  if (clip.sourceAssetId) return clip.sourceAssetId
  const match = assets.find((a) => a.id === clip.sourceAssetId || a.title === clip.title)
  return match?.id
}

/**
 * Mixes all active audio clips on the timeline into a single AudioBuffer using OfflineAudioContext.
 */
export async function renderAudioMixdown(
  tracks: Track[],
  assets: MediaItem[] = [],
  duration: number,
  mutedTracks: string[] = [],
  sampleRate = 48000,
): Promise<AudioBuffer | null> {
  const unmutedTracks = tracks.filter((t) => !mutedTracks.includes(t.id))
  const audioClips = unmutedTracks.flatMap((t) =>
    t.clips.filter((c) => {
      if (c.duration <= 0) return false
      if (c.text !== undefined || c.thumbnail === 'text-overlay' || c.thumbnail === 'image-catalog') return false
      const assetId = resolveClipAssetId(c, assets)
      if (!assetId) return false
      const asset = assets.find((a) => a.id === assetId)
      if (asset?.type === 'image') return false
      return true
    }),
  )
  if (audioClips.length === 0 || duration <= 0) return null

  const lengthSamples = Math.max(1, Math.ceil(duration * sampleRate))
  const OfflineCtx = window.OfflineAudioContext || (window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext }).webkitOfflineAudioContext
  if (!OfflineCtx) return null

  const offlineContext = new OfflineCtx(2, lengthSamples, sampleRate)

  // Load and decode unique audio assets
  const assetBuffers = new Map<string, AudioBuffer>()
  for (const clip of audioClips) {
    const assetId = resolveClipAssetId(clip, assets)
    if (!assetId || assetBuffers.has(assetId)) continue

    const blobUrl = await loadMediaSource(assetId)
    if (!blobUrl) continue

    try {
      const response = await fetch(blobUrl)
      const arrayBuffer = await response.arrayBuffer()
      const decoded = await new Promise<AudioBuffer>((res, rej) => {
        const promise = offlineContext.decodeAudioData(arrayBuffer, res, rej)
        if (promise && typeof promise.then === 'function') {
          promise.then(res).catch(rej)
        }
      })
      assetBuffers.set(assetId, decoded)
    } catch {
      // Asset failed decoding, skip gracefully
    } finally {
      URL.revokeObjectURL(blobUrl)
    }
  }

  // Schedule clips into the offline context
  for (const clip of audioClips) {
    const assetId = resolveClipAssetId(clip, assets)
    const buffer = assetId ? assetBuffers.get(assetId) : null
    if (!buffer) continue

    const source = offlineContext.createBufferSource()
    source.buffer = buffer

    const gain = offlineContext.createGain()
    const baseVolume = (clip.volume ?? 100) / 100
    gain.gain.setValueAtTime(baseVolume, clip.start)

    // Handle fade in
    if (clip.fadeIn && clip.fadeIn > 0) {
      gain.gain.setValueAtTime(0, clip.start)
      gain.gain.linearRampToValueAtTime(baseVolume, clip.start + clip.fadeIn)
    }

    // Handle fade out
    if (clip.fadeOut && clip.fadeOut > 0) {
      const fadeStart = Math.max(clip.start, clip.start + clip.duration - clip.fadeOut)
      gain.gain.setValueAtTime(baseVolume, fadeStart)
      gain.gain.linearRampToValueAtTime(0, clip.start + clip.duration)
    }

    source.connect(gain)
    gain.connect(offlineContext.destination)
    source.start(clip.start, 0, clip.duration)
  }

  return offlineContext.startRendering()
}

export interface RenderSequenceParams {
  tracks: Track[]
  assets: MediaItem[]
  sequenceDuration: number
  sequenceSize?: { width: number; height: number; frameRate?: number }
  settings: ExportSettings
  mutedTracks?: string[]
  onProgress?: (progress: RenderProgress) => void
  signal?: AbortSignal
}

/**
 * Returns the "ghost" clips that should be rendered at their held last frame
 * when an incoming transitionIn is active on the next clip in the same track.
 * This prevents the black background from showing through during transitions.
 */
function collectTransitionGhostClips(
  tracks: import('../model').Track[],
  time: number,
  frameInterval: number,
): Array<{ clip: import('../model').Clip; drawTime: number }> {
  const result: Array<{ clip: import('../model').Clip; drawTime: number }> = []
  for (const track of tracks) {
    for (const clip of track.clips) {
      if (!clip.transitionIn || clip.transitionIn.duration <= 0) continue
      const elapsed = time - clip.start
      if (elapsed < 0 || elapsed >= clip.transitionIn.duration) continue
      // Find the clip that ended just before this one on the same track
      const prev = track.clips
        .filter((c) => c.id !== clip.id && c.start + c.duration <= clip.start + 0.001)
        .sort((a, b) => (b.start + b.duration) - (a.start + a.duration))[0]
      if (!prev) continue
      // Hold the previous clip at its last frame (2 frames before end to avoid edge effects)
      const holdTime = Math.max(prev.start, prev.start + prev.duration - frameInterval * 2)
      // Draw with fadeIn/fadeOut zeroed so it appears at full opacity during the transition
      result.push({ clip: { ...prev, fadeOut: 0, fadeIn: 0 }, drawTime: holdTime })
    }
  }
  return result
}

/**
 * Diagnoses hardware acceleration capabilities via WebCodecs isConfigSupported.
 * Probes prefer-hardware, prefer-software, and no-preference modes.
 */
export async function probeWebCodecsAcceleration(
  codec: string,
  width: number,
  height: number,
  bitrateMbps: number,
  frameRate: number,
): Promise<{
  preferHardwareSupported: boolean
  preferSoftwareSupported: boolean
  noPreferenceSupported: boolean
  supportedConfig?: VideoEncoderConfig
}> {
  if (typeof VideoEncoder === 'undefined' || typeof VideoEncoder.isConfigSupported !== 'function') {
    return {
      preferHardwareSupported: false,
      preferSoftwareSupported: false,
      noPreferenceSupported: false,
    }
  }

  const baseConfig: VideoEncoderConfig = {
    codec,
    width,
    height,
    bitrate: bitrateMbps * 1_000_000,
    framerate: frameRate,
  }

  const [hwRes, swRes, noPrefRes] = await Promise.all([
    VideoEncoder.isConfigSupported({ ...baseConfig, hardwareAcceleration: 'prefer-hardware' }).catch(() => null),
    VideoEncoder.isConfigSupported({ ...baseConfig, hardwareAcceleration: 'prefer-software' }).catch(() => null),
    VideoEncoder.isConfigSupported({ ...baseConfig, hardwareAcceleration: 'no-preference' }).catch(() => null),
  ])

  return {
    preferHardwareSupported: Boolean(hwRes?.supported),
    preferSoftwareSupported: Boolean(swRes?.supported),
    noPreferenceSupported: Boolean(noPrefRes?.supported),
    supportedConfig: hwRes?.config || noPrefRes?.config || swRes?.config,
  }
}

/**
 * Formats and logs the export benchmark report into the browser/Tauri console
 * and assigns it to window.__LAST_SPARTA_EXPORT_BENCHMARK__.
 */
export function logBenchmarkReport(report: ExportBenchmarkReport): void {
  const wallSec = (report.wallClockTimeMs / 1000).toFixed(2)
  const fps = report.effectiveFps.toFixed(1)
  const frames = report.totalFrames

  console.group(`[SPARTA EXPORT BENCHMARK] Total: ${wallSec}s · ${fps} fps · ${frames} frames (${report.engine.toUpperCase()})`)

  const stagesData = [
    { 'Macro Etapa': '1. Audio Mixdown', 'Tiempo (ms)': Math.round(report.stages.audioMixdownMs), '% Pared': ((report.stages.audioMixdownMs / Math.max(1, report.wallClockTimeMs)) * 100).toFixed(1) + '%' },
    { 'Macro Etapa': '2. Asset Preload (DOM/WebCodecs)', 'Tiempo (ms)': Math.round(report.stages.assetPreloadMs), '% Pared': ((report.stages.assetPreloadMs / Math.max(1, report.wallClockTimeMs)) * 100).toFixed(1) + '%' },
    { 'Macro Etapa': '3. Audio Encoding', 'Tiempo (ms)': Math.round(report.stages.audioEncodeMs), '% Pared': ((report.stages.audioEncodeMs / Math.max(1, report.wallClockTimeMs)) * 100).toFixed(1) + '%' },
    { 'Macro Etapa': '4. Video Frame Loop', 'Tiempo (ms)': Math.round(report.stages.frameLoopMs), '% Pared': ((report.stages.frameLoopMs / Math.max(1, report.wallClockTimeMs)) * 100).toFixed(1) + '%' },
    { 'Macro Etapa': '5. Video Flush & Close', 'Tiempo (ms)': Math.round(report.stages.videoFlushMs), '% Pared': ((report.stages.videoFlushMs / Math.max(1, report.wallClockTimeMs)) * 100).toFixed(1) + '%' },
    { 'Macro Etapa': '6. Muxing & Blob Creation', 'Tiempo (ms)': Math.round(report.stages.muxingAndBlobMs), '% Pared': ((report.stages.muxingAndBlobMs / Math.max(1, report.wallClockTimeMs)) * 100).toFixed(1) + '%' },
  ]
  console.table(stagesData)

  const loopTotal = Math.max(1, report.stages.frameLoopMs)
  const breakdownData = [
    { 'Operación en Bucle': 'A. Decodificación Mediabunny (WebCodecs)', 'Total (ms)': Math.round(report.frameLoopBreakdown.totalMediabunnyDecodeMs), 'Prom/Frame (ms)': report.frameAverages.avgMediabunnyDecodeMs.toFixed(2), '% Bucle': ((report.frameLoopBreakdown.totalMediabunnyDecodeMs / loopTotal) * 100).toFixed(1) + '%' },
    { 'Operación en Bucle': 'B. Espera seeked en <video> (Fallback DOM)', 'Total (ms)': Math.round(report.frameLoopBreakdown.totalHtmlVideoSeekWaitMs), 'Prom/Frame (ms)': report.frameAverages.avgHtmlVideoSeekWaitMs.toFixed(2), '% Bucle': ((report.frameLoopBreakdown.totalHtmlVideoSeekWaitMs / loopTotal) * 100).toFixed(1) + '%' },
    { 'Operación en Bucle': 'C. Contrapresión VideoEncoder (Espera ondequeue)', 'Total (ms)': Math.round(report.frameLoopBreakdown.totalBackpressureWaitMs), 'Prom/Frame (ms)': report.frameAverages.avgBackpressureWaitMs.toFixed(2), '% Bucle': ((report.frameLoopBreakdown.totalBackpressureWaitMs / loopTotal) * 100).toFixed(1) + '%' },
    { 'Operación en Bucle': 'D. Dibujo Canvas 2D (Base/Texto)', 'Total (ms)': Math.round(report.frameLoopBreakdown.totalCanvasDrawMs), 'Prom/Frame (ms)': report.frameAverages.avgCanvasDrawMs.toFixed(2), '% Bucle': ((report.frameLoopBreakdown.totalCanvasDrawMs / loopTotal) * 100).toFixed(1) + '%' },
    { 'Operación en Bucle': 'E. Efectos (CPU/ImageData/Canvas)', 'Total (ms)': Math.round(report.frameLoopBreakdown.totalEffectsMs), 'Prom/Frame (ms)': report.frameAverages.avgEffectsMs.toFixed(2), '% Bucle': ((report.frameLoopBreakdown.totalEffectsMs / loopTotal) * 100).toFixed(1) + '%' },
    { 'Operación en Bucle': 'F. Captura VideoFrame y encode', 'Total (ms)': Math.round(report.frameLoopBreakdown.totalFrameCaptureAndEncodeMs), 'Prom/Frame (ms)': report.frameAverages.avgFrameCaptureAndEncodeMs.toFixed(2), '% Bucle': ((report.frameLoopBreakdown.totalFrameCaptureAndEncodeMs / loopTotal) * 100).toFixed(1) + '%' },
    { 'Operación en Bucle': 'G. Yield UI Event Loop (setTimeout)', 'Total (ms)': Math.round(report.frameLoopBreakdown.totalYieldMs), 'Prom/Frame (ms)': (report.frameLoopBreakdown.totalYieldMs / Math.max(1, frames)).toFixed(2), '% Bucle': ((report.frameLoopBreakdown.totalYieldMs / loopTotal) * 100).toFixed(1) + '%' },
    { 'Operación en Bucle': 'H. Overhead bucle/timestamps', 'Total (ms)': Math.round(report.frameLoopBreakdown.otherLoopOverheadMs), 'Prom/Frame (ms)': (report.frameLoopBreakdown.otherLoopOverheadMs / Math.max(1, frames)).toFixed(2), '% Bucle': ((report.frameLoopBreakdown.otherLoopOverheadMs / loopTotal) * 100).toFixed(1) + '%' },
  ]
  console.table(breakdownData)

  const wcAssets = report.encoderStats.webcodecsDecodedAssetsCount ?? 0
  const fbAssets = report.encoderStats.fallbackHtmlAssetsCount ?? 0
  console.info(`[Encoder Telemetry] Códec: ${report.encoderStats.codec} | HW Solicitado: ${report.encoderStats.requestedHardwareAcceleration} | Max Queue: ${report.encoderStats.maxEncodeQueueSize} | Avg Queue: ${report.encoderStats.avgEncodeQueueSize.toFixed(2)} | Assets WebCodecs: ${wcAssets} | Assets Fallback: ${fbAssets}`)
  if (report.encoderStats.supportProbe) {
    console.info(`[HW Acceleration Probe] prefer-hardware soportado: ${report.encoderStats.supportProbe.preferHardwareSupported} | prefer-software soportado: ${report.encoderStats.supportProbe.preferSoftwareSupported} | no-preference soportado: ${report.encoderStats.supportProbe.noPreferenceSupported}`)
  }
  console.info('El objeto completo con todas las métricas está disponible en: window.__LAST_SPARTA_EXPORT_BENCHMARK__')
  console.groupEnd()

  if (typeof window !== 'undefined') {
    (window as unknown as { __LAST_SPARTA_EXPORT_BENCHMARK__?: ExportBenchmarkReport }).__LAST_SPARTA_EXPORT_BENCHMARK__ = report
  }
}

/**
 * Single-reader sequential decoder for an asset with Mediabunny.
 * Maintains at most one active decoder iterator and at most one decoded sample in memory.
 * Completely eliminates the massive RAM leak caused by per-frame decoder recreation.
 */
class MediabunnyAssetReader {
  readonly assetId: string
  private sink: VideoSampleSink
  private iterator: AsyncIterator<VideoSample> | null = null
  private currentSample: VideoSample | null = null
  private isDisposed = false

  constructor(assetId: string, sink: VideoSampleSink) {
    this.assetId = assetId
    this.sink = sink
  }

  /**
   * Retrieves the VideoSample for the given timestamp.
   * - If current sample covers targetTime (freeze frame, slow-mo, or identical timestamp), returns it immediately.
   * - If targetTime advances forward, advances the sequential iterator without recreating the decoder.
   * - If targetTime is backward or has a large gap (>2s), closes previous iterator and starts a new sequential stream.
   */
  async getSample(targetTime: number): Promise<VideoSample | null> {
    if (this.isDisposed) return null

    // 1. Frame reuse check (freeze frame, zero velocity, or identical source timestamp)
    if (this.currentSample) {
      const start = this.currentSample.timestamp
      const duration = this.currentSample.duration > 0 ? this.currentSample.duration : 0.033
      const end = start + duration
      if (targetTime >= start - 0.001 && targetTime < end - 0.001) {
        return this.currentSample
      }
    }

    // 2. Check if we need to restart the sequential iterator (seek backwards or jump forward > 2.0s)
    const needsRestart =
      !this.iterator ||
      !this.currentSample ||
      targetTime < this.currentSample.timestamp - 0.001 ||
      targetTime - (this.currentSample.timestamp + (this.currentSample.duration || 0.033)) > 2.0

    if (needsRestart) {
      await this.closeIterator()
      try {
        this.iterator = this.sink.samples(targetTime)[Symbol.asyncIterator]()
      } catch (err) {
        console.warn(`[Mediabunny] Falló al abrir flujo secuencial en ${targetTime}s para el asset ${this.assetId}:`, err)
        return null
      }
    }

    // 3. Advance iterator sequentially
    while (this.iterator && !this.isDisposed) {
      let nextResult: IteratorResult<VideoSample>
      try {
        nextResult = await this.iterator.next()
      } catch (err) {
        console.warn(`[Mediabunny] Error al leer muestra secuencial para el asset ${this.assetId}:`, err)
        break
      }

      if (nextResult.done || !nextResult.value) {
        // Do not reuse a previous clip's frame when this iterator reaches the end.
        break
      }

      // Close previous sample immediately to release GPU/VRAM texture
      if (this.currentSample) {
        try { this.currentSample.close() } catch { /* ignore */ }
      }
      this.currentSample = nextResult.value

      const start = this.currentSample.timestamp
      const duration = this.currentSample.duration > 0 ? this.currentSample.duration : 0.033
      const end = start + duration

      if (targetTime < end + 0.001) {
        return this.currentSample
      }
    }

    return this.currentSample && targetTime >= this.currentSample.timestamp - 0.001 &&
      targetTime < this.currentSample.timestamp + Math.max(this.currentSample.duration, 0.033) + 0.001
      ? this.currentSample
      : null
  }

  async closeIterator(): Promise<void> {
    if (this.iterator) {
      const it = this.iterator
      this.iterator = null
      try {
        if (typeof it.return === 'function') {
          await it.return()
        }
      } catch {
        /* ignore */
      }
    }
  }

  async dispose(): Promise<void> {
    this.isDisposed = true
    await this.closeIterator()
    if (this.currentSample) {
      try { this.currentSample.close() } catch { /* ignore */ }
      this.currentSample = null
    }
  }
}

/**
 * Asynchronously waits for VideoEncoder to drain its encodeQueueSize below maxQueueSize.
 * Uses WebCodecs ondequeue callback with AbortSignal check and a safety timeout.
 */
function waitForEncoderQueue(
  encoder: VideoEncoder,
  maxQueueSize: number,
  signal?: AbortSignal,
  timeoutMs = 5000,
): Promise<void> {
  if (encoder.encodeQueueSize < maxQueueSize) return Promise.resolve()
  if (signal?.aborted) return Promise.reject(new Error('Exportación cancelada.'))

  return new Promise<void>((resolve, reject) => {
    let settled = false
    let timer: ReturnType<typeof setTimeout> | null = null

    const cleanup = () => {
      settled = true
      if (timer) clearTimeout(timer)
      encoder.ondequeue = null
      signal?.removeEventListener('abort', onAbort)
    }

    const onAbort = () => {
      cleanup()
      reject(new Error('Exportación cancelada.'))
    }

    const onCheck = () => {
      if (settled) return
      if (encoder.state === 'closed') {
        cleanup()
        reject(new Error('El codificador de vídeo se cerró inesperadamente.'))
        return
      }
      if (encoder.encodeQueueSize < maxQueueSize) {
        cleanup()
        resolve()
      }
    }

    encoder.ondequeue = onCheck
    signal?.addEventListener('abort', onAbort, { once: true })

    timer = setTimeout(() => {
      if (settled) return
      cleanup()
      resolve() // Safety fallback: resume if timeout expires to avoid permanent hang
    }, timeoutMs)

    onCheck()
  })
}

async function renderWithWebCodecs({
  canvas,
  ctx,
  visualAssets,
  videoSampleSinks,
  audioBuffer,
  tracks,
  assets,
  duration,
  totalFrames,
  sequenceSize,
  settings,
  mutedTracks,
  onProgress,
  signal,
  overallStartTime,
  audioMixdownMs,
  assetPreloadMs,
}: {
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
  visualAssets: Map<string, HTMLImageElement | HTMLVideoElement>
  videoSampleSinks?: Map<string, VideoSampleSink>
  audioBuffer: AudioBuffer | null
  tracks: Track[]
  assets: MediaItem[]
  duration: number
  totalFrames: number
  sequenceSize?: { width: number; height: number; frameRate?: number }
  settings: ExportSettings
  mutedTracks: string[]
  onProgress?: (progress: RenderProgress) => void
  signal?: AbortSignal
  overallStartTime?: number
  audioMixdownMs?: number
  assetPreloadMs?: number
}): Promise<RenderResult> {
  const isMp4 = settings.format === 'mp4'

  // Determinar códec de vídeo óptimo con aceleración por hardware
  let videoCodec = isMp4 ? 'avc1.4d002a' : 'vp09.00.10.08'
  if (isMp4) {
    const isSupported = await VideoEncoder.isConfigSupported({
      codec: 'avc1.4d002a',
      width: settings.width,
      height: settings.height,
      bitrate: settings.bitrateMbps * 1_000_000,
      framerate: settings.frameRate,
    }).catch(() => null)
    if (!isSupported?.supported) {
      const isBaselineSupported = await VideoEncoder.isConfigSupported({
        codec: 'avc1.42001e',
        width: settings.width,
        height: settings.height,
        bitrate: settings.bitrateMbps * 1_000_000,
        framerate: settings.frameRate,
      }).catch(() => null)
      videoCodec = isBaselineSupported?.supported ? 'avc1.42001e' : 'avc1.640028'
    }
  } else {
    const isVp9Supported = await VideoEncoder.isConfigSupported({
      codec: 'vp09.00.10.08',
      width: settings.width,
      height: settings.height,
      bitrate: settings.bitrateMbps * 1_000_000,
      framerate: settings.frameRate,
    }).catch(() => null)
    if (!isVp9Supported?.supported) {
      videoCodec = 'vp8'
    }
  }

  // Sondeo diagnóstico de aceleración por hardware WebCodecs
  const supportProbe = await probeWebCodecsAcceleration(
    videoCodec,
    settings.width,
    settings.height,
    settings.bitrateMbps,
    settings.frameRate,
  ).catch(() => undefined)

  // Verificar soporte de códec de audio
  let canEncodeAudio = false
  let audioCodec = isMp4 ? 'mp4a.40.2' : 'opus'
  if (audioBuffer && typeof AudioEncoder !== 'undefined') {
    const isAudioSupported = await AudioEncoder.isConfigSupported({
      codec: audioCodec,
      sampleRate: audioBuffer.sampleRate,
      numberOfChannels: Math.min(2, audioBuffer.numberOfChannels),
      bitrate: 192_000,
    }).catch(() => null)
    canEncodeAudio = !!isAudioSupported?.supported
    if (!canEncodeAudio && isMp4) {
      const isAacSupported = await AudioEncoder.isConfigSupported({
        codec: 'aac',
        sampleRate: audioBuffer.sampleRate,
        numberOfChannels: Math.min(2, audioBuffer.numberOfChannels),
        bitrate: 192_000,
      }).catch(() => null)
      if (isAacSupported?.supported) {
        audioCodec = 'aac'
        canEncodeAudio = true
      }
    }
  }

  const mp4Target = isMp4 ? new Mp4ArrayBufferTarget() : null
  const webmTarget = !isMp4 ? new WebmArrayBufferTarget() : null

  // fastStart: false garantiza escritura incremental directa al ArrayBufferTarget y liberación
  // inmediata del array de datos del fotograma codificado (sample.data = null), previniendo la retención
  // duplicada de megabytes en memoria durante toda la exportación.
  const mp4Muxer = isMp4
    ? new Mp4Muxer({
      target: mp4Target!,
      video: {
        codec: 'avc',
        width: settings.width,
        height: settings.height,
      },
      audio: canEncodeAudio && audioBuffer
        ? {
          codec: 'aac',
          numberOfChannels: Math.min(2, audioBuffer.numberOfChannels),
          sampleRate: audioBuffer.sampleRate,
        }
        : undefined,
      fastStart: false,
    })
    : null

  const webmMuxer = !isMp4
    ? new WebmMuxer({
      target: webmTarget!,
      video: {
        codec: videoCodec.startsWith('vp09') ? 'V_VP9' : 'V_VP8',
        width: settings.width,
        height: settings.height,
        frameRate: settings.frameRate,
      },
      audio: canEncodeAudio && audioBuffer
        ? {
          codec: 'A_OPUS',
          numberOfChannels: Math.min(2, audioBuffer.numberOfChannels),
          sampleRate: audioBuffer.sampleRate,
        }
        : undefined,
    })
    : null

  let encodingError: Error | null = null

  const videoEncoder = new VideoEncoder({
    output: (chunk, meta) => {
      try {
        if (mp4Muxer) {
          const data = new Uint8Array(chunk.byteLength)
          chunk.copyTo(data)
          let duration = chunk.duration
          if (typeof duration !== 'number' || !Number.isFinite(duration) || duration <= 0) {
            const frameIndex = Math.round((chunk.timestamp * settings.frameRate) / 1_000_000)
            const nextTimestamp = Math.round(((frameIndex + 1) * 1_000_000) / settings.frameRate)
            duration = Math.max(1, nextTimestamp - chunk.timestamp)
          }
          mp4Muxer.addVideoChunkRaw(data, chunk.type, chunk.timestamp, duration, meta)
        } else if (webmMuxer) {
          webmMuxer.addVideoChunk(chunk, meta)
        }
      } catch (err) {
        console.error('Error al empaquetar fragmento de vídeo:', err)
        encodingError = err instanceof Error ? err : new Error(String(err))
      }
    },
    error: (err) => {
      console.error('WebCodecs VideoEncoder Error:', err)
      encodingError = err instanceof Error ? err : new Error(String(err))
    },
  })

  videoEncoder.configure({
    codec: videoCodec,
    width: settings.width,
    height: settings.height,
    bitrate: settings.bitrateMbps * 1_000_000,
    framerate: settings.frameRate,
    hardwareAcceleration: 'prefer-hardware',
  })

  // Gestión de lectores secuenciales por clip con ciclo de vida estricto
  const clipReaders = new Map<string, MediabunnyAssetReader>()
  const usedWebCodecsAssets = new Set<string>()
  const usedFallbackAssets = new Set<string>()

  try {
    // Codificación de audio mixdown con liberación garantizada
    let audioEncodeMs = 0
    if (canEncodeAudio && audioBuffer) {
      onProgress?.({
        stage: 'preparing',
        percent: 12,
        currentFrame: 0,
        totalFrames,
        fps: 0,
        message: 'Codificando mezcla de audio estéreo...',
      })

      const tAudioEncStart = performance.now()
      let audioEncodingError: Error | null = null
      let audioEncoder: AudioEncoder | null = null

      try {
        audioEncoder = new AudioEncoder({
          output: (chunk, meta) => {
            try {
              if (mp4Muxer) {
                const data = new Uint8Array(chunk.byteLength)
                chunk.copyTo(data)
                let duration = chunk.duration
                if (typeof duration !== 'number' || !Number.isFinite(duration) || duration <= 0) {
                  duration = Math.round((1024 / audioBuffer.sampleRate) * 1_000_000)
                }
                mp4Muxer.addAudioChunkRaw(data, chunk.type, chunk.timestamp, duration, meta)
              } else if (webmMuxer) {
                webmMuxer.addAudioChunk(chunk, meta)
              }
            } catch (err) {
              console.error('Error al empaquetar fragmento de audio:', err)
              audioEncodingError = err instanceof Error ? err : new Error(String(err))
            }
          },
          error: (err) => {
            console.error('WebCodecs AudioEncoder Error:', err)
            audioEncodingError = err instanceof Error ? err : new Error(String(err))
          },
        })

        audioEncoder.configure({
          codec: audioCodec,
          sampleRate: audioBuffer.sampleRate,
          numberOfChannels: Math.min(2, audioBuffer.numberOfChannels),
          bitrate: 192_000,
        })

        const sampleRate = audioBuffer.sampleRate
        const numChannels = Math.min(2, audioBuffer.numberOfChannels)
        const totalSamples = audioBuffer.length
        const chunkSize = 2048
        const planar = new Float32Array(chunkSize * numChannels)

        for (let offset = 0; offset < totalSamples; offset += chunkSize) {
          if (signal?.aborted) throw new Error('Exportación cancelada.')
          if (audioEncodingError) throw audioEncodingError

          const curSize = Math.min(chunkSize, totalSamples - offset)
          for (let ch = 0; ch < numChannels; ch++) {
            const chData = audioBuffer.getChannelData(ch)
            const chOffset = ch * curSize
            for (let i = 0; i < curSize; i++) {
              planar[chOffset + i] = chData[offset + i]
            }
          }

          let audioData: AudioData | null = null
          try {
            audioData = new AudioData({
              format: 'f32-planar',
              sampleRate,
              numberOfChannels: numChannels,
              numberOfFrames: curSize,
              timestamp: Math.round((offset / sampleRate) * 1_000_000),
              data: planar.subarray(0, curSize * numChannels),
            })
            audioEncoder.encode(audioData)
          } finally {
            if (audioData) {
              try { audioData.close() } catch { /* ignore */ }
            }
          }
        }

        await audioEncoder.flush()
        if (audioEncodingError) throw audioEncodingError
      } finally {
        if (audioEncoder && audioEncoder.state !== 'closed') {
          try { audioEncoder.close() } catch { /* ignore */ }
        }
      }
      audioEncodeMs = performance.now() - tAudioEncStart
    }

    const activeVideoTracks = tracks.filter((t) => t.kind === 'video' && !mutedTracks.includes(t.id))
    const frameInterval = 1 / settings.frameRate
    const renderStartTime = performance.now()
    let lastFpsSampleTime = renderStartTime
    let framesSinceLastSample = 0
    let measuredFps = settings.frameRate
    let lastYieldTime = renderStartTime

    // Métricas separadas de rendimiento por fotograma
    let totalMediabunnyDecodeMs = 0
    let totalHtmlVideoSeekWaitMs = 0
    let totalCanvasDrawMs = 0
    let totalEffectsMs = 0
    let totalBackpressureWaitMs = 0
    let totalFrameCaptureAndEncodeMs = 0
    let totalYieldMs = 0
    let maxEncodeQueueSize = 0
    let sumEncodeQueueSize = 0
    let queueSamplesCount = 0

    // Límite de contrapresión conservador: máximo 4 fotogramas en cola de codificación
    // (~33 MB en 1080p, evita saturar memoria sin desaprovechar la paralelización de GPU)
    const MAX_ENCODE_QUEUE_SIZE = 4

    const tFrameLoopStart = performance.now()

    for (let frame = 0; frame < totalFrames; frame++) {
      if (signal?.aborted) throw new Error('Exportación cancelada.')
      if (encodingError) throw encodingError

      const time = frame * frameInterval

      const activeClips = activeVideoTracks.flatMap((track) =>
        track.clips.filter((clip) => time >= clip.start && time < clip.start + clip.duration),
      )
      const mediaClips = activeClips.filter((clip) => clip.text === undefined && clip.thumbnail !== 'text-overlay')

      // 1. Limpieza de lectores secuenciales de clips que ya terminaron su rango temporal
      for (const [clipId, reader] of clipReaders) {
        const isStillActive = activeClips.some((c) => c.id === clipId)
        if (!isStillActive) {
          void reader.dispose()
          clipReaders.delete(clipId)
        }
      }

      // 2. Sincronización para assets que utilizan fallback por HTMLVideoElement (seek selectivo)
      const tSeekStart = performance.now()
      for (const [assetId, element] of visualAssets) {
        if (element instanceof HTMLVideoElement) {
          // Si el asset dispone de VideoSampleSink de Mediabunny, se decodifica por WebCodecs
          if (videoSampleSinks?.has(assetId)) continue

          const activeClip = mediaClips.find((c) => resolveClipAssetId(c, assets) === assetId)
          if (activeClip) {
            usedFallbackAssets.add(assetId)
            const expectedSourceTime = activeClip.freezeTime !== undefined
              ? activeClip.freezeTime
              : Math.max(0, (time - activeClip.start) * (activeClip.speed ?? 1.0))

            const diff = Math.abs(element.currentTime - expectedSourceTime)
            const threshold = activeClip.freezeTime !== undefined ? 0.005 : (0.5 / settings.frameRate)
            if (diff >= threshold) {
              await new Promise<void>((r) => {
                let settled = false
                const onDone = () => {
                  if (settled) return
                  settled = true
                  element.removeEventListener('seeked', onDone)
                  r()
                }
                element.addEventListener('seeked', onDone, { once: true })
                setTimeout(onDone, 300)
                try {
                  element.currentTime = expectedSourceTime
                } catch {
                  onDone()
                }
              })
            }
          }
        }
      }
      totalHtmlVideoSeekWaitMs += performance.now() - tSeekStart

      // 3. Preparación y ordenamiento de clips (Capas visuales base -> Ajuste -> Subtítulos y texto)
      const activeClipsWithTrack = activeVideoTracks.flatMap((track) =>
        track.clips
          .filter((clip) => time >= clip.start && time < clip.start + clip.duration)
          .map((clip) => ({ clip, track })),
      )

      const baseVisualClips = activeClipsWithTrack.filter(
        ({ clip }) => clip.kind !== 'adjustment' && clip.text === undefined && clip.thumbnail !== 'text-overlay',
      )
      const adjustmentClips = activeClipsWithTrack.filter(
        ({ clip }) => clip.kind === 'adjustment',
      )
      const textAndSubtitleClips = activeClipsWithTrack.filter(
        ({ clip }) => clip.text !== undefined || clip.thumbnail === 'text-overlay',
      )

      const orderedClips = [
        ...baseVisualClips.map((c) => c.clip),
        ...adjustmentClips.map((c) => c.clip),
        ...textAndSubtitleClips.map((c) => c.clip),
      ]

      // 4. Obtención de fotogramas decodificados vía MediabunnyAssetReader con medición exacta y reutilización
      const getDrawableForClip = async (
        clip: Clip,
        clipTime: number,
      ): Promise<CanvasImageSource | HTMLImageElement | HTMLVideoElement | undefined> => {
        const aId = resolveClipAssetId(clip, assets)
        if (!aId) return undefined

        const sink = videoSampleSinks?.get(aId)
        if (sink) {
          let reader = clipReaders.get(clip.id)
          if (!reader) {
            reader = new MediabunnyAssetReader(aId, sink)
            clipReaders.set(clip.id, reader)
          }

          const tDecStart = performance.now()
          try {
            const expectedSourceTime = clip.freezeTime !== undefined
              ? clip.freezeTime
              : Math.max(0, (clipTime - clip.start) * (clip.speed ?? 1.0))
            const sample = await Promise.race([
              reader.getSample(expectedSourceTime),
              new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
            ])
            totalMediabunnyDecodeMs += performance.now() - tDecStart
            if (sample) {
              usedWebCodecsAssets.add(aId)
              return sample.toCanvasImageSource()
            }
          } catch (e) {
            totalMediabunnyDecodeMs += performance.now() - tDecStart
            console.warn(`[WebCodecs] Falló decodificación de muestra para clip ${clip.id} en ${clipTime}s:`, e)
          }
        }

        usedFallbackAssets.add(aId)
        return visualAssets.get(aId)
      }

      // 5. Dibujo en Canvas 2D
      const tDrawStart = performance.now()
      const drawMetrics = { effectsTimeMs: 0 }

      ctx.fillStyle = '#000000'
      ctx.fillRect(0, 0, settings.width, settings.height)

      // Dibujar ghost clips de transiciones (retenidos en su último fotograma durante transitionIn)
      for (const { clip: ghostClip, drawTime } of collectTransitionGhostClips(activeVideoTracks, time, frameInterval)) {
        const drawable = await getDrawableForClip(ghostClip, drawTime)
        drawClipToCanvas(ctx, ghostClip, drawable, drawTime, settings.width, settings.height, sequenceSize, drawMetrics)
      }

      for (const clip of orderedClips) {
        const drawable = await getDrawableForClip(clip, time)
        drawClipToCanvas(ctx, clip, drawable, time, settings.width, settings.height, sequenceSize, drawMetrics)
      }

      const drawDuration = performance.now() - tDrawStart
      totalEffectsMs += drawMetrics.effectsTimeMs
      totalCanvasDrawMs += Math.max(0, drawDuration - drawMetrics.effectsTimeMs)

      // 6. Contrapresión en VideoEncoder: si la cola alcanza el límite, pausar hasta que ondequeue la reduzca
      if (videoEncoder.encodeQueueSize >= MAX_ENCODE_QUEUE_SIZE) {
        const tWaitStart = performance.now()
        await waitForEncoderQueue(videoEncoder, MAX_ENCODE_QUEUE_SIZE, signal)
        totalBackpressureWaitMs += performance.now() - tWaitStart
      }

      // 7. Captura de Canvas a VideoFrame y codificación con cierre garantizado
      const tCaptureStart = performance.now()
      const timestampMicros = Math.round((frame * 1_000_000) / settings.frameRate)
      const nextTimestampMicros = Math.round(((frame + 1) * 1_000_000) / settings.frameRate)
      const frameDurationMicros = Math.max(1, nextTimestampMicros - timestampMicros)

      let videoFrame: VideoFrame | null = null
      try {
        videoFrame = new VideoFrame(canvas, {
          timestamp: timestampMicros,
          duration: frameDurationMicros,
        })
        const isKeyFrame = frame % (settings.frameRate * 2) === 0
        videoEncoder.encode(videoFrame, { keyFrame: isKeyFrame })
      } finally {
        if (videoFrame) {
          try { videoFrame.close() } catch { /* ignore */ }
        }
      }
      totalFrameCaptureAndEncodeMs += performance.now() - tCaptureStart

      const qSize = videoEncoder.encodeQueueSize
      if (qSize > maxEncodeQueueSize) maxEncodeQueueSize = qSize
      sumEncodeQueueSize += qSize
      queueSamplesCount++

      framesSinceLastSample++
      const now = performance.now()
      if (now - lastFpsSampleTime >= 400 && framesSinceLastSample > 0) {
        measuredFps = Math.round((framesSinceLastSample / ((now - lastFpsSampleTime) / 1000)) * 10) / 10
        lastFpsSampleTime = now
        framesSinceLastSample = 0
      }

      if (now - lastYieldTime >= 100 || frame === totalFrames - 1) {
        lastYieldTime = now
        const percent = Math.min(98, Math.round((frame / totalFrames) * 85) + 12)
        onProgress?.({
          stage: 'rendering',
          percent,
          currentFrame: frame + 1,
          totalFrames,
          fps: measuredFps,
          message: `Renderizado acelerado (${measuredFps} fps) · Cuadro ${frame + 1} de ${totalFrames}`,
        })
        const tYieldStart = performance.now()
        await new Promise((r) => setTimeout(r, 0))
        totalYieldMs += performance.now() - tYieldStart
      }
    }

    const frameLoopMs = performance.now() - tFrameLoopStart
    const totalAccountedMs =
      totalMediabunnyDecodeMs +
      totalHtmlVideoSeekWaitMs +
      totalCanvasDrawMs +
      totalEffectsMs +
      totalBackpressureWaitMs +
      totalFrameCaptureAndEncodeMs +
      totalYieldMs
    const otherLoopOverheadMs = Math.max(0, frameLoopMs - totalAccountedMs)

    onProgress?.({
      stage: 'encoding',
      percent: 99,
      currentFrame: totalFrames,
      totalFrames,
      fps: measuredFps,
      message: 'Finalizando empaquetado de vídeo acelerado...',
    })

    if (encodingError) throw encodingError

    const tFlushStart = performance.now()
    await videoEncoder.flush()
    if (encodingError) throw encodingError
    const videoFlushMs = performance.now() - tFlushStart

    const tMuxStart = performance.now()
    if (mp4Muxer) {
      mp4Muxer.finalize()
    } else if (webmMuxer) {
      webmMuxer.finalize()
    }

    const rawBuffer = isMp4 ? mp4Target!.buffer : webmTarget!.buffer
    const finalBlob = new Blob([rawBuffer], {
      type: isMp4 ? 'video/mp4' : 'video/webm',
    })
    const muxingAndBlobMs = performance.now() - tMuxStart

    const totalWallClockMs = performance.now() - (overallStartTime ?? (renderStartTime - (audioMixdownMs ?? 0) - (assetPreloadMs ?? 0)))
    const effectiveFps = totalWallClockMs > 0 ? (totalFrames / (totalWallClockMs / 1000)) : 0

    const benchmark: ExportBenchmarkReport = {
      wallClockTimeMs: totalWallClockMs,
      totalFrames,
      effectiveFps,
      engine: 'webcodecs',
      stages: {
        audioMixdownMs: audioMixdownMs ?? 0,
        audioEncodeMs,
        assetPreloadMs: assetPreloadMs ?? 0,
        frameLoopMs,
        videoFlushMs,
        muxingAndBlobMs,
      },
      frameLoopBreakdown: {
        totalMediabunnyDecodeMs,
        totalHtmlVideoSeekWaitMs,
        totalCanvasDrawMs,
        totalEffectsMs,
        totalBackpressureWaitMs,
        totalFrameCaptureAndEncodeMs,
        totalYieldMs,
        otherLoopOverheadMs,
        totalSeekWaitMs: totalHtmlVideoSeekWaitMs,
      },
      frameAverages: {
        avgFrameTotalMs: totalFrames > 0 ? frameLoopMs / totalFrames : 0,
        avgMediabunnyDecodeMs: totalFrames > 0 ? totalMediabunnyDecodeMs / totalFrames : 0,
        avgHtmlVideoSeekWaitMs: totalFrames > 0 ? totalHtmlVideoSeekWaitMs / totalFrames : 0,
        avgCanvasDrawMs: totalFrames > 0 ? totalCanvasDrawMs / totalFrames : 0,
        avgEffectsMs: totalFrames > 0 ? totalEffectsMs / totalFrames : 0,
        avgBackpressureWaitMs: totalFrames > 0 ? totalBackpressureWaitMs / totalFrames : 0,
        avgFrameCaptureAndEncodeMs: totalFrames > 0 ? totalFrameCaptureAndEncodeMs / totalFrames : 0,
        avgSeekWaitMs: totalFrames > 0 ? totalHtmlVideoSeekWaitMs / totalFrames : 0,
      },
      encoderStats: {
        maxEncodeQueueSize,
        avgEncodeQueueSize: queueSamplesCount > 0 ? sumEncodeQueueSize / queueSamplesCount : 0,
        samplesCount: queueSamplesCount,
        codec: videoCodec,
        requestedHardwareAcceleration: 'prefer-hardware',
        webcodecsDecodedAssetsCount: usedWebCodecsAssets.size,
        fallbackHtmlAssetsCount: usedFallbackAssets.size,
        supportProbe,
      },
    }

    logBenchmarkReport(benchmark)

    onProgress?.({
      stage: 'completed',
      percent: 100,
      currentFrame: totalFrames,
      totalFrames,
      fps: measuredFps,
      message: 'Exportación completada a máxima velocidad.',
    })

    return {
      blob: finalBlob,
      fileName: settings.fileName,
      durationSeconds: duration,
      sizeBytes: finalBlob.size,
      benchmark,
    }
  } finally {
    // Liberación estricta de todos los lectores secuenciales y decodificadores activos
    for (const reader of clipReaders.values()) {
      try { await reader.dispose() } catch { /* ignore */ }
    }
    clipReaders.clear()

    if (videoEncoder.state !== 'closed') {
      try { videoEncoder.close() } catch { /* ignore */ }
    }
  }
}

/**
 * Main export rendering pipeline. Renders timeline tracks to a video (WebM/MP4) or audio (WAV) file.
 */
export async function renderSequence({
  tracks,
  assets,
  sequenceDuration,
  sequenceSize,
  settings,
  mutedTracks = [],
  onProgress,
  signal,
}: RenderSequenceParams): Promise<RenderResult> {
  const overallStartTime = performance.now()
  const duration = Math.max(0.1, sequenceDuration)
  const totalFrames = Math.max(1, Math.ceil(duration * settings.frameRate))

  onProgress?.({ stage: 'preparing', percent: 0, currentFrame: 0, totalFrames, message: 'Preparando medios y motor de render...' })

  if (signal?.aborted) throw new Error('Exportación cancelada.')

  if (settings.format !== 'wav' && settings.preset !== 'audio-only') {
    const hasRenderableContent = tracks.some((track) =>
      !mutedTracks.includes(track.id) && track.clips.some((clip) =>
        track.kind === 'video'
          ? clip.kind !== 'adjustment' || clip.text !== undefined || clip.thumbnail === 'text-overlay'
          : clip.kind === 'audio',
      ),
    )
    if (!hasRenderableContent) {
      throw new Error('No hay clips de vídeo, imagen, texto o audio en la línea de tiempo para exportar.')
    }
  }

  // Audio-only export branch
  if (settings.format === 'wav' || settings.preset === 'audio-only') {
    onProgress?.({ stage: 'rendering', percent: 25, currentFrame: 0, totalFrames, message: 'Mezclando pistas de audio en alta fidelidad...' })
    const audioBuffer = await renderAudioMixdown(tracks, assets, duration, mutedTracks)
    if (signal?.aborted) throw new Error('Exportación cancelada.')

    let blob: Blob
    if (audioBuffer) {
      blob = audioBufferToWavBlob(audioBuffer)
    } else {
      const OfflineCtx = window.OfflineAudioContext || (window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext }).webkitOfflineAudioContext
      if (OfflineCtx) {
        const ctx = new OfflineCtx(2, 48000, 48000)
        const silentBuffer = ctx.createBuffer(2, 48000, 48000)
        blob = audioBufferToWavBlob(silentBuffer)
      } else {
        const emptySamples = Math.max(1, Math.ceil(duration * 48000))
        const dummyBuffer = {
          numberOfChannels: 2,
          sampleRate: 48000,
          length: emptySamples,
          duration,
          getChannelData: () => new Float32Array(emptySamples),
        } as unknown as AudioBuffer
        blob = audioBufferToWavBlob(dummyBuffer)
      }
    }

    const totalWallClockMs = performance.now() - overallStartTime
    const benchmark: ExportBenchmarkReport = {
      wallClockTimeMs: totalWallClockMs,
      totalFrames: 0,
      effectiveFps: 0,
      engine: 'audio-only',
      stages: {
        audioMixdownMs: totalWallClockMs,
        audioEncodeMs: 0,
        assetPreloadMs: 0,
        frameLoopMs: 0,
        videoFlushMs: 0,
        muxingAndBlobMs: 0,
      },
      frameLoopBreakdown: {
        totalMediabunnyDecodeMs: 0,
        totalHtmlVideoSeekWaitMs: 0,
        totalCanvasDrawMs: 0,
        totalEffectsMs: 0,
        totalBackpressureWaitMs: 0,
        totalFrameCaptureAndEncodeMs: 0,
        totalYieldMs: 0,
        otherLoopOverheadMs: 0,
        totalSeekWaitMs: 0,
      },
      frameAverages: {
        avgFrameTotalMs: 0,
        avgMediabunnyDecodeMs: 0,
        avgHtmlVideoSeekWaitMs: 0,
        avgCanvasDrawMs: 0,
        avgEffectsMs: 0,
        avgBackpressureWaitMs: 0,
        avgFrameCaptureAndEncodeMs: 0,
        avgSeekWaitMs: 0,
      },
      encoderStats: {
        maxEncodeQueueSize: 0,
        avgEncodeQueueSize: 0,
        samplesCount: 0,
        codec: 'pcm-16bit-wav',
        requestedHardwareAcceleration: 'none',
      },
    }
    logBenchmarkReport(benchmark)

    onProgress?.({ stage: 'completed', percent: 100, currentFrame: totalFrames, totalFrames, message: 'Mezcla completada con éxito.' })
    return {
      blob,
      fileName: settings.fileName.endsWith('.wav') ? settings.fileName : `${settings.fileName}.wav`,
      durationSeconds: duration,
      sizeBytes: blob.size,
      benchmark,
    }
  }

  // Video compositing branch
  const canvas = document.createElement('canvas')
  canvas.width = settings.width
  canvas.height = settings.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('No se pudo inicializar el contexto 2D para renderizar la secuencia.')

  // Pre-render audio track if present
  onProgress?.({ stage: 'preparing', percent: 5, currentFrame: 0, totalFrames, message: 'Procesando mezcla de audio del proyecto...' })
  const tAudioMixStart = performance.now()
  const audioBuffer = await renderAudioMixdown(tracks, assets, duration, mutedTracks)
  const audioMixdownMs = performance.now() - tAudioMixStart
  if (signal?.aborted) throw new Error('Exportación cancelada.')

  // Pre-load visual assets into DOM-attached elements for reliable hardware decoding
  onProgress?.({ stage: 'preparing', percent: 10, currentFrame: 0, totalFrames, message: 'Preparando medios de vídeo e imagen...' })
  const tPreloadStart = performance.now()
  const hiddenContainer = typeof document !== 'undefined' ? document.createElement('div') : null
  if (hiddenContainer) {
    hiddenContainer.setAttribute('aria-hidden', 'true')
    // In-viewport tiny element with z-index behind everything so Chrome keeps GPU hardware video decoding active without blocking UI
    hiddenContainer.style.cssText =
      'position:fixed;left:0;top:0;width:2px;height:2px;opacity:0.01;pointer-events:none;z-index:-999;overflow:hidden;'
    document.body.appendChild(hiddenContainer)
  }

  const visualAssets = new Map<string, HTMLImageElement | HTMLVideoElement>()
  const videoSampleSinks = new Map<string, VideoSampleSink>()
  const videoInputs: Input[] = []
  let audioCtx: AudioContext | undefined

  try {
    const videoClips = tracks.filter((t) => t.kind === 'video').flatMap((t) => t.clips)
  for (const clip of videoClips) {
    if (clip.text !== undefined || clip.thumbnail === 'text-overlay') continue
    const assetId = resolveClipAssetId(clip, assets)
    if (!assetId || visualAssets.has(assetId) || videoSampleSinks.has(assetId)) continue
    const asset = assets.find((a) => a.id === assetId)

    if (asset?.type === 'image' || clip.thumbnail === 'image-catalog') {
      const url = await loadMediaSource(assetId)
      if (!url) continue
      const img = new Image()
      img.src = url
      await new Promise<void>((res) => {
        if (img.complete && img.naturalWidth > 0) { res(); return }
        img.onload = () => res()
        img.onerror = () => res()
        setTimeout(res, 2000)
      })
      visualAssets.set(assetId, img)
    } else {
      // 1. Intentar decodificación acelerada por hardware con WebCodecs vía mediabunny
      let webCodecsReady = false
      if (typeof VideoDecoder !== 'undefined') {
        try {
          const blob = await loadMediaBlob(assetId)
          if (blob) {
            const input = new Input({ source: new BlobSource(blob), formats: ALL_FORMATS })
            if (await input.canRead()) {
              const track = await input.getPrimaryVideoTrack()
              if (track && (await track.canDecode())) {
                const sink = new VideoSampleSink(track, { hardwareAcceleration: 'prefer-hardware' })
                videoSampleSinks.set(assetId, sink)
                videoInputs.push(input)
                webCodecsReady = true
              }
            }
          }
        } catch (e) {
          console.warn(`[WebCodecs Preload] Fallback a HTMLVideoElement para el asset ${assetId}:`, e)
        }
      }

      // 2. Si no es compatible o falló, crear HTMLVideoElement como fallback seguro
      if (!webCodecsReady) {
        const url = await loadMediaSource(assetId)
        if (!url) continue
        const vid = document.createElement('video')
        vid.preload = 'auto'
        vid.muted = true
        vid.playsInline = true
        vid.style.cssText = 'width:100%;height:100%;object-fit:contain;'
        vid.src = url
        if (hiddenContainer) hiddenContainer.appendChild(vid)
        await new Promise<void>((res) => {
          if (vid.readyState >= 2) { res(); return }
          const done = () => {
            vid.removeEventListener('loadeddata', done)
            vid.removeEventListener('canplay', done)
            vid.removeEventListener('error', done)
            res()
          }
          vid.addEventListener('loadeddata', done, { once: true })
          vid.addEventListener('canplay', done, { once: true })
          vid.addEventListener('error', done, { once: true })
          setTimeout(done, 3000)
          try { vid.load() } catch { /* ignore */ }
        })
        await new Promise<void>((res) => {
          const onSeeked = () => {
            vid.removeEventListener('seeked', onSeeked)
            res()
          }
          vid.addEventListener('seeked', onSeeked, { once: true })
          setTimeout(onSeeked, 300)
          try { vid.currentTime = 0 } catch { res() }
        })
        visualAssets.set(assetId, vid)
      }
    }
  }
  const assetPreloadMs = performance.now() - tPreloadStart

  // 1. Intentar renderizado acelerado por hardware con WebCodecs (ultrarrápido)
  const canUseWebCodecs =
    typeof VideoEncoder !== 'undefined' &&
    typeof AudioEncoder !== 'undefined' &&
    typeof VideoFrame !== 'undefined' &&
    typeof AudioData !== 'undefined'

  if (canUseWebCodecs) {
    try {
      return await renderWithWebCodecs({
        canvas,
        ctx,
        visualAssets,
        videoSampleSinks,
        audioBuffer,
        tracks,
        assets,
        duration,
        totalFrames,
        sequenceSize,
        settings,
        mutedTracks,
        onProgress,
        signal,
        overallStartTime,
        audioMixdownMs,
        assetPreloadMs,
      })
    } catch (err) {
      const isCancellation =
        signal?.aborted ||
        (err instanceof Error && /cancelada|aborted/i.test(err.message))
      if (isCancellation) throw err
      console.warn('WebCodecs rendering failed, falling back to MediaRecorder:', err)
      // Asegurar que visualAssets contenga elementos HTMLVideoElement para el fallback de MediaRecorder
      for (const clip of videoClips) {
        const assetId = resolveClipAssetId(clip, assets)
        if (assetId && !visualAssets.has(assetId)) {
          const url = await loadMediaSource(assetId)
          if (url) {
            const vid = document.createElement('video')
            vid.preload = 'auto'
            vid.muted = true
            vid.playsInline = true
            vid.src = url
            if (hiddenContainer) hiddenContainer.appendChild(vid)
            visualAssets.set(assetId, vid)
          }
        }
      }
    }
  }

  // 2. Fallback de compatibilidad: MediaRecorder
  if (typeof MediaRecorder === 'undefined') {
    throw new Error('MediaRecorder no está disponible en este entorno.')
  }

  let mimeType = settings.format === 'mp4' && MediaRecorder.isTypeSupported('video/mp4')
    ? 'video/mp4'
    : 'video/webm;codecs=vp9'
  if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/webm'
  if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = ''

  // Pre-render frame 0 onto canvas so captureStream has pixels ready
  ctx.fillStyle = '#000000'
  ctx.fillRect(0, 0, settings.width, settings.height)
  const activeVideoTracks = tracks.filter((t) => t.kind === 'video' && !mutedTracks.includes(t.id))
  const initialClips = activeVideoTracks.flatMap((track) =>
    track.clips.filter((clip) => 0 >= clip.start && 0 < clip.start + clip.duration),
  )
  const initialMedia = initialClips.filter((c) => c.text === undefined && c.thumbnail !== 'text-overlay')
  const initialAdjustmentLayers = initialClips.filter((clip) => clip.kind === 'adjustment')
  const initialRenderableClips = initialClips.filter((clip) => clip.kind !== 'adjustment')
  for (const clip of [...initialRenderableClips, ...initialAdjustmentLayers]) {
    const aId = resolveClipAssetId(clip, assets)
    drawClipToCanvas(
      ctx,
      clip,
      aId ? visualAssets.get(aId) : undefined,
      0,
      settings.width,
      settings.height,
      sequenceSize,
    )
  }

  // Start initial media videos playing
  for (const clip of initialMedia) {
    const aId = resolveClipAssetId(clip, assets)
    const vid = aId ? visualAssets.get(aId) : undefined
    if (vid instanceof HTMLVideoElement) {
      try { vid.currentTime = 0 } catch { /* ignore */ }
      void vid.play().catch(() => { })
    }
  }

  // Create stream from canvas
  const canvasStream = canvas.captureStream(settings.frameRate)
  let combinedStream = canvasStream

  let sourceNode: AudioBufferSourceNode | undefined

  // Add audio track to stream if available
  if (audioBuffer && typeof AudioContext !== 'undefined') {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      audioCtx = new AudioCtx()
      if (audioCtx.state === 'suspended') {
        void audioCtx.resume().catch(() => { })
      }
      const dest = audioCtx.createMediaStreamDestination()
      sourceNode = audioCtx.createBufferSource()
      sourceNode.buffer = audioBuffer
      sourceNode.connect(dest)

      const audioTrack = dest.stream.getAudioTracks()[0]
      if (audioTrack) {
        combinedStream = new MediaStream([...canvasStream.getVideoTracks(), audioTrack])
      }
    } catch {
      // Fallback to video-only stream if audio routing fails
    }
  }

  const chunks: Blob[] = []
  const recorder = new MediaRecorder(combinedStream, {
    mimeType: mimeType || undefined,
    videoBitsPerSecond: settings.bitrateMbps * 1_000_000,
  })

  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data)
  }

  const completionPromise = new Promise<Blob>((resolve, reject) => {
    recorder.onstop = () => {
      const finalBlob = new Blob(chunks, { type: mimeType || 'video/webm' })
      resolve(finalBlob)
    }
    recorder.onerror = (e) => reject(new Error(`Error en MediaRecorder: ${String(e)}`))
  })

  // Start synchronized recording and audio
  if (sourceNode) {
    try { sourceNode.start() } catch { /* ignore */ }
  }
  recorder.start()

  // Draw frame by frame
  const frameInterval = 1 / settings.frameRate
  const targetFrameIntervalMs = 1000 / settings.frameRate
  const renderStartTime = performance.now()
  let lastFpsSampleTime = renderStartTime
  let framesSinceLastSample = 0
  let measuredFps = settings.frameRate

  // Telemetría acumulada para MediaRecorder
  let totalSeekWaitMs = 0
  let totalCanvasDrawMs = 0
  let totalEffectsMs = 0
  let totalYieldMs = 0

  const canvasTrack = canvasStream.getVideoTracks()[0] as unknown as { requestFrame?: () => void }

  for (let frame = 0; frame < totalFrames; frame++) {
      if (signal?.aborted) {
        try { recorder.stop() } catch { /* ignore */ }
        throw new Error('Exportación cancelada.')
      }

      const time = frame * frameInterval

      // Background fill (black for seamless presentation)
      ctx.fillStyle = '#000000'
      ctx.fillRect(0, 0, settings.width, settings.height)

      // Active clips for this frame
      const activeClips = activeVideoTracks.flatMap((track) =>
        track.clips.filter((clip) => time >= clip.start && time < clip.start + clip.duration),
      )
      const mediaClips = activeClips.filter((clip) => clip.text === undefined && clip.thumbnail !== 'text-overlay')

      // Synchronize video element playback/position for media clips
      const tSeekStart = performance.now()
      for (const [assetId, element] of visualAssets) {
        if (element instanceof HTMLVideoElement) {
          const activeClip = mediaClips.find((c) => resolveClipAssetId(c, assets) === assetId)
          if (activeClip) {
            const expectedSourceTime = activeClip.freezeTime !== undefined
              ? activeClip.freezeTime
              : Math.max(0, (time - activeClip.start) * (activeClip.speed ?? 1.0))
            if (activeClip.freezeTime !== undefined) {
              if (!element.paused) element.pause()
              if (Math.abs(element.currentTime - expectedSourceTime) > 0.04) {
                try { element.currentTime = expectedSourceTime } catch { /* ignore */ }
              }
            } else if (!element.paused) {
              if (Math.abs(element.currentTime - expectedSourceTime) > 0.8) {
                try { element.currentTime = expectedSourceTime } catch { /* ignore */ }
              }
            } else {
              const playPromise = element.play()
              if (playPromise) {
                void playPromise.catch(async () => {
                  if (Math.abs(element.currentTime - expectedSourceTime) > 0.04) {
                    await new Promise<void>((r) => {
                      const onDone = () => {
                        element.removeEventListener('seeked', onDone)
                        r()
                      }
                      element.addEventListener('seeked', onDone, { once: true })
                      setTimeout(onDone, 60)
                      element.currentTime = expectedSourceTime
                    })
                  }
                })
              }
            }
          } else {
            if (!element.paused) {
              element.pause()
            }
          }
        }
      }
      totalSeekWaitMs += performance.now() - tSeekStart

      // Pipeline estándar NLE: Base visual -> Capas de ajuste -> Subtítulos y texto en la capa superior
      const activeClipsWithTrack = activeVideoTracks.flatMap((track) =>
        track.clips
          .filter((clip) => time >= clip.start && time < clip.start + clip.duration)
          .map((clip) => ({ clip, track })),
      )

      const baseVisualClips = activeClipsWithTrack.filter(
        ({ clip }) => clip.kind !== 'adjustment' && clip.text === undefined && clip.thumbnail !== 'text-overlay',
      )
      const adjustmentClips = activeClipsWithTrack.filter(
        ({ clip }) => clip.kind === 'adjustment',
      )
      const textAndSubtitleClips = activeClipsWithTrack.filter(
        ({ clip }) => clip.text !== undefined || clip.thumbnail === 'text-overlay',
      )

      const orderedClips = [
        ...baseVisualClips.map((c) => c.clip),
        ...adjustmentClips.map((c) => c.clip),
        ...textAndSubtitleClips.map((c) => c.clip),
      ]

      const tDrawStart = performance.now()
      const drawMetrics = { effectsTimeMs: 0 }

      // Draw ghost clips first (previous clips held at their last frame during transitionIn)
      for (const { clip: ghostClip, drawTime } of collectTransitionGhostClips(activeVideoTracks, time, frameInterval)) {
        const aId = resolveClipAssetId(ghostClip, assets)
        drawClipToCanvas(ctx, ghostClip, aId ? visualAssets.get(aId) : undefined, drawTime, settings.width, settings.height, sequenceSize, drawMetrics)
      }

      for (const clip of orderedClips) {
        const aId = resolveClipAssetId(clip, assets)
        drawClipToCanvas(
          ctx,
          clip,
          aId ? visualAssets.get(aId) : undefined,
          time,
          settings.width,
          settings.height,
          sequenceSize,
          drawMetrics,
        )
      }

      const drawTimeTotal = performance.now() - tDrawStart
      totalEffectsMs += drawMetrics.effectsTimeMs
      totalCanvasDrawMs += Math.max(0, drawTimeTotal - drawMetrics.effectsTimeMs)

      // Force canvas capture frame if API is available
      if (typeof canvasTrack?.requestFrame === 'function') {
        try {
          canvasTrack.requestFrame()
        } catch {
          /* fallback to stream automatic sampling */
        }
      }

      framesSinceLastSample++
      const now = performance.now()
      const elapsedSinceSample = now - lastFpsSampleTime
      if (elapsedSinceSample >= 400 && framesSinceLastSample > 0) {
        measuredFps = Math.round((framesSinceLastSample / (elapsedSinceSample / 1000)) * 10) / 10
        lastFpsSampleTime = now
        framesSinceLastSample = 0
      }

      const percent = Math.min(98, Math.round((frame / totalFrames) * 88) + 10)
      onProgress?.({
        stage: 'rendering',
        percent,
        currentFrame: frame + 1,
        totalFrames,
        fps: measuredFps,
        message: `Renderizando cuadro ${frame + 1} de ${totalFrames}...`,
      })

      // Drift-free real-time pacing synchronized with wall clock, video playback and audio stream
      const tYieldStart = performance.now()
      if (!audioBuffer) {
        await new Promise((r) => setTimeout(r, 0))
      } else {
        const targetWallClockTime = renderStartTime + (frame + 1) * targetFrameIntervalMs
        const remainingMs = targetWallClockTime - performance.now()
        if (remainingMs > 0) {
          await new Promise((r) => setTimeout(r, remainingMs))
        } else {
          await new Promise((r) => setTimeout(r, 0))
        }
      }
      totalYieldMs += performance.now() - tYieldStart
    }

    onProgress?.({ stage: 'encoding', percent: 99, currentFrame: totalFrames, totalFrames, message: 'Finalizando codificación de vídeo...' })
    try {
      recorder.stop()
    } catch { /* ignore */ }

    const finalBlob = await completionPromise
    onProgress?.({ stage: 'completed', percent: 100, currentFrame: totalFrames, totalFrames, message: 'Exportación completada con éxito.' })

    const totalWallClockMs = performance.now() - overallStartTime
    const effectiveFps = totalWallClockMs > 0 ? totalFrames / (totalWallClockMs / 1000) : 0
    const frameLoopMs = performance.now() - renderStartTime

    const benchmark: ExportBenchmarkReport = {
      wallClockTimeMs: totalWallClockMs,
      totalFrames,
      effectiveFps,
      engine: 'mediarecorder',
      stages: {
        audioMixdownMs,
        audioEncodeMs: 0,
        assetPreloadMs,
        frameLoopMs,
        videoFlushMs: 0,
        muxingAndBlobMs: 0,
      },
      frameLoopBreakdown: {
        totalMediabunnyDecodeMs: 0,
        totalHtmlVideoSeekWaitMs: totalSeekWaitMs,
        totalCanvasDrawMs,
        totalEffectsMs,
        totalBackpressureWaitMs: 0,
        totalFrameCaptureAndEncodeMs: 0,
        totalYieldMs,
        otherLoopOverheadMs: Math.max(0, frameLoopMs - (totalSeekWaitMs + totalCanvasDrawMs + totalEffectsMs + totalYieldMs)),
        totalSeekWaitMs,
      },
      frameAverages: {
        avgFrameTotalMs: totalFrames > 0 ? frameLoopMs / totalFrames : 0,
        avgMediabunnyDecodeMs: 0,
        avgHtmlVideoSeekWaitMs: totalFrames > 0 ? totalSeekWaitMs / totalFrames : 0,
        avgCanvasDrawMs: totalFrames > 0 ? totalCanvasDrawMs / totalFrames : 0,
        avgEffectsMs: totalFrames > 0 ? totalEffectsMs / totalFrames : 0,
        avgBackpressureWaitMs: 0,
        avgFrameCaptureAndEncodeMs: 0,
        avgSeekWaitMs: totalFrames > 0 ? totalSeekWaitMs / totalFrames : 0,
      },
      encoderStats: {
        maxEncodeQueueSize: 0,
        avgEncodeQueueSize: 0,
        samplesCount: 0,
        codec: mimeType || 'mediarecorder-default',
        requestedHardwareAcceleration: 'browser-controlled',
        webcodecsDecodedAssetsCount: 0,
        fallbackHtmlAssetsCount: visualAssets.size,
      },
    }
    logBenchmarkReport(benchmark)

    return {
      blob: finalBlob,
      fileName: settings.fileName,
      durationSeconds: duration,
      sizeBytes: finalBlob.size,
      benchmark,
    }
  } finally {
    try {
      for (const element of visualAssets.values()) {
        if (element instanceof HTMLVideoElement) {
          element.pause()
          element.src = ''
          try { element.load() } catch { /* ignore */ }
        }
      }
      if (hiddenContainer) hiddenContainer.remove()
      for (const input of videoInputs) {
        try { input.dispose() } catch { /* ignore */ }
      }
      if (audioCtx && audioCtx.state !== 'closed') {
        void audioCtx.close().catch(() => { })
      }
    } catch { /* ignore */ }
  }
}

export function drawClipToCanvas(
  ctx: CanvasRenderingContext2D,
  clip: Clip,
  element: HTMLImageElement | HTMLVideoElement | CanvasImageSource | undefined,
  time: number,
  canvasWidth: number,
  canvasHeight: number,
  sequenceSize?: { width: number; height: number } | number,
  metrics?: { effectsTimeMs: number },
) {
  const resolvedSeqW =
    typeof sequenceSize === 'number'
      ? sequenceSize
      : sequenceSize?.width || canvasWidth
  const resolvedSeqH =
    typeof sequenceSize === 'object' && sequenceSize?.height
      ? sequenceSize.height
      : typeof sequenceSize === 'number'
        ? Math.round(sequenceSize * (canvasHeight / canvasWidth))
        : canvasHeight

  if (clip.text !== undefined || clip.thumbnail === 'text-overlay') {
    drawAnimatedTextClipToCanvas(ctx, clip, time, canvasWidth, canvasHeight, { width: resolvedSeqW, height: resolvedSeqH })
    return
  }

  if (clip.kind === 'adjustment') {
    const tFxStart = performance.now()
    applyEffectsToCanvas(ctx, canvasWidth, canvasHeight, clip.effects)
    if (metrics) {
      metrics.effectsTimeMs += performance.now() - tFxStart
    }
    return
  }

  ctx.save()

  const opacity = getInterpolatedOpacity(clip, time) / 100
  ctx.globalAlpha = Math.max(0, Math.min(1, opacity))

  if (clip.blendMode && clip.blendMode !== 'normal') {
    ctx.globalCompositeOperation = clip.blendMode === 'add' ? 'lighter' : clip.blendMode
  }

  const transform = getInterpolatedTransform(clip, time, { width: resolvedSeqW, height: resolvedSeqH })
  const scaleX = (transform.scaleX ?? 100) / 100
  const scaleY = (transform.scaleY ?? 100) / 100

  // Rescale position from sequence coordinate space to canvas resolution
  const kx = canvasWidth / resolvedSeqW
  const ky = canvasHeight / resolvedSeqH
  const exportX = transform.x * kx
  const exportY = transform.y * ky

  ctx.translate(exportX, exportY)

  const trans = computeTransitionInState(clip.transitionIn, clip.start, time, resolvedSeqW, resolvedSeqH)
  if (trans) {
    ctx.globalAlpha *= trans.opacity
    ctx.translate(trans.offsetX * kx, trans.offsetY * ky)
    ctx.scale(trans.scale, trans.scale)
    if (trans.rotation) ctx.rotate((trans.rotation * Math.PI) / 180)
  }

  if (transform.rotation) ctx.rotate((transform.rotation * Math.PI) / 180)

  const flipX = clip.flipH ? -1 : 1
  const flipY = clip.flipV ? -1 : 1
  ctx.scale(scaleX * flipX, scaleY * flipY)

  const clipFilter = getEffectsCSSFilter(clip.effects)
  if (clipFilter) {
    try { ctx.filter = clipFilter } catch { /* ignore */ }
  }

  let rendered = false
  let srcW = 0
  let srcH = 0

  if (element instanceof HTMLImageElement && element.complete && element.naturalWidth > 0) {
    srcW = element.naturalWidth
    srcH = element.naturalHeight
  } else if (element instanceof HTMLVideoElement && element.readyState >= 1 && element.videoWidth > 0) {
    srcW = element.videoWidth
    srcH = element.videoHeight
  } else if (typeof VideoFrame !== 'undefined' && element instanceof VideoFrame) {
    srcW = element.displayWidth
    srcH = element.displayHeight
  } else if (typeof ImageBitmap !== 'undefined' && element instanceof ImageBitmap) {
    srcW = element.width
    srcH = element.height
  } else if (typeof OffscreenCanvas !== 'undefined' && element instanceof OffscreenCanvas) {
    srcW = element.width
    srcH = element.height
  }

  if (element && srcW > 0 && srcH > 0) {
    try {
      const fitRect = computeFitRect(srcW, srcH, canvasWidth, canvasHeight, clip.fit ?? 'fit')
      if (clip.mask && clip.mask.type !== 'none') {
        ctx.save()
        applyMaskToCanvas(ctx, clip.mask, fitRect)
        ctx.drawImage(element, -fitRect.w / 2, -fitRect.h / 2, fitRect.w, fitRect.h)
        ctx.restore()
      } else {
        ctx.drawImage(element, -fitRect.w / 2, -fitRect.h / 2, fitRect.w, fitRect.h)
      }
      rendered = true
    } catch {
      // Image/Video draw failed
    }
  }

  if (!rendered) {
    // Fallback: visual placeholder card only when no media asset is available
    ctx.fillStyle = clip.color === 'olive' ? '#2f4236' : clip.color === 'sand' ? '#443c2c' : '#22384a'
    ctx.fillRect(-canvasWidth / 2, -canvasHeight / 2, canvasWidth, canvasHeight)
    ctx.fillStyle = '#ffffff'
    const fontSize = Math.max(14, Math.round(28 * (canvasHeight / resolvedSeqH)))
    ctx.font = `${fontSize}px sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(clip.title, 0, 0)
  }

  try { ctx.filter = 'none' } catch { /* ignore */ }
  ctx.restore()
}

function applyEffectsToCanvas(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  effects?: Clip['effects'],
): void {
  if (!effects || effects.length === 0) return

  const cssFilter = getEffectsCSSFilter(effects)
  if (cssFilter) {
    try {
      const tempCanvas = document.createElement('canvas')
      tempCanvas.width = width
      tempCanvas.height = height
      const tempCtx = tempCanvas.getContext('2d')
      if (tempCtx) {
        tempCtx.drawImage(ctx.canvas, 0, 0)
        ctx.save()
        ctx.filter = cssFilter
        ctx.clearRect(0, 0, width, height)
        ctx.drawImage(tempCanvas, 0, 0)
        ctx.restore()
      }
    } catch {
      // Filter fallback
    }
  }

  for (const fx of effects) {
    if (!fx.enabled) continue
    const factor = (fx.intensity ?? 100) / 100

    if (fx.effectId === 'fx-vignette') {
      applyVignette(ctx, width, height, 0.75, 0.4, factor)
    } else if (fx.effectId === 'fx-pixelate') {
      const size = Math.max(2, Math.round((fx.params.size ?? 16) * factor))
      applyPixelate(ctx, width, height, size)
    } else if (
      fx.effectId === 'fx-film-grain' ||
      fx.effectId === 'fx-chromatic-aberration' ||
      fx.effectId === 'fx-chroma-key'
    ) {
      try {
        const imgData = ctx.getImageData(0, 0, width, height)
        if (fx.effectId === 'fx-film-grain') {
          applyFilmGrain(imgData, (fx.params.amount ?? 35) * factor, true)
        } else if (fx.effectId === 'fx-chromatic-aberration') {
          applyChromaticAberration(imgData, (fx.params.offset ?? 6) * factor)
        } else if (fx.effectId === 'fx-chroma-key') {
          const tol = (fx.params.tolerance ?? 40) * factor
          const smooth = (fx.params.smoothness ?? 20) * factor
          const kr = fx.params.keyR ?? 0
          const kg = fx.params.keyG ?? 255
          const kb = fx.params.keyB ?? 0
          applyChromaKey(imgData, [kr, kg, kb], tol, smooth)
        }
        ctx.putImageData(imgData, 0, 0)
      } catch {
        // Ignored in tainted / headless canvas
      }
    }
  }
}

/**
 * Triggers a browser download of the exported video or audio file.
 */
export function downloadRenderResult(result: RenderResult): void {
  const url = URL.createObjectURL(result.blob)
  const a = document.createElement('a')
  a.href = url
  a.download = result.fileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 15000)
}
