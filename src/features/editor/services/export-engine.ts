import type { Clip, MediaItem, Track } from '../model'
import type { ExportPresetId, ExportSettings, RenderProgress, RenderResult } from './contracts'
import { loadMediaSource } from './media-storage'
import { getInterpolatedOpacity, getInterpolatedTransform } from './keyframe-interpolation'
import { drawAnimatedTextClipToCanvas } from './text-presets'

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
    label: '1080p Full HD (Web / YouTube)',
    description: '1920 × 1080 · 30 fps · 8 Mbps',
    width: 1920,
    height: 1080,
    frameRate: 30,
    bitrateMbps: 8,
    format: 'webm',
  },
  'social-vertical': {
    label: '1080p Vertical (TikTok / Reels / Shorts)',
    description: '1080 × 1920 · 30 fps · 8 Mbps',
    width: 1080,
    height: 1920,
    frameRate: 30,
    bitrateMbps: 8,
    format: 'webm',
  },
  'uhd-4k': {
    label: '4K Ultra HD (Master)',
    description: '3840 × 2160 · 30 fps · 25 Mbps',
    width: 3840,
    height: 2160,
    frameRate: 30,
    bitrateMbps: 25,
    format: 'webm',
  },
  'fast-720p': {
    label: '720p HD Rápido (Borrador)',
    description: '1280 × 720 · 30 fps · 4 Mbps',
    width: 1280,
    height: 720,
    frameRate: 30,
    bitrateMbps: 4,
    format: 'webm',
  },
  'audio-only': {
    label: 'Audio Master (Mixdown estéreo)',
    description: 'WAV PCM 48 kHz 24/16-bit estéreo',
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
      if (c.duration <= 0 || !c.sourceAssetId) return false
      if (c.text !== undefined || c.thumbnail === 'text-overlay' || c.thumbnail === 'image-catalog') return false
      const asset = assets.find((a) => a.id === c.sourceAssetId)
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
    const assetId = clip.sourceAssetId
    if (!assetId || assetBuffers.has(assetId)) continue

    const blobUrl = await loadMediaSource(assetId)
    if (!blobUrl) continue

    try {
      const response = await fetch(blobUrl)
      const arrayBuffer = await response.arrayBuffer()
      const decoded = await offlineContext.decodeAudioData(arrayBuffer)
      assetBuffers.set(assetId, decoded)
    } catch {
      // Asset failed decoding, skip gracefully
    } finally {
      URL.revokeObjectURL(blobUrl)
    }
  }

  // Schedule clips into the offline context
  for (const clip of audioClips) {
    const buffer = clip.sourceAssetId ? assetBuffers.get(clip.sourceAssetId) : null
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
  settings: ExportSettings
  mutedTracks?: string[]
  onProgress?: (progress: RenderProgress) => void
  signal?: AbortSignal
}

/**
 * Main export rendering pipeline. Renders timeline tracks to a video (WebM/MP4) or audio (WAV) file.
 */
export async function renderSequence({
  tracks,
  assets,
  sequenceDuration,
  settings,
  mutedTracks = [],
  onProgress,
  signal,
}: RenderSequenceParams): Promise<RenderResult> {
  const duration = Math.max(0.1, sequenceDuration)
  const totalFrames = Math.max(1, Math.ceil(duration * settings.frameRate))

  onProgress?.({ stage: 'preparing', percent: 0, currentFrame: 0, totalFrames, message: 'Preparando medios y motor de render...' })

  if (signal?.aborted) throw new Error('Exportación cancelada.')

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

    onProgress?.({ stage: 'completed', percent: 100, currentFrame: totalFrames, totalFrames, message: 'Mezcla completada con éxito.' })
    return {
      blob,
      fileName: settings.fileName.endsWith('.wav') ? settings.fileName : `${settings.fileName}.wav`,
      durationSeconds: duration,
      sizeBytes: blob.size,
    }
  }

  // Video compositing branch
  const canvas = document.createElement('canvas')
  canvas.width = settings.width
  canvas.height = settings.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('No se pudo inicializar el contexto 2D para renderizar la secuencia.')

  // Check MediaRecorder support
  if (typeof MediaRecorder === 'undefined') {
    throw new Error('MediaRecorder no está disponible en este entorno.')
  }

  let mimeType = 'video/webm;codecs=vp9'
  if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/webm'
  if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = ''

  // Pre-render audio track if present
  onProgress?.({ stage: 'preparing', percent: 5, currentFrame: 0, totalFrames, message: 'Procesando mezcla de audio del proyecto...' })
  const audioBuffer = await renderAudioMixdown(tracks, assets, duration, mutedTracks)
  if (signal?.aborted) throw new Error('Exportación cancelada.')

  // Pre-load visual assets into DOM-attached elements for reliable hardware decoding
  onProgress?.({ stage: 'preparing', percent: 10, currentFrame: 0, totalFrames, message: 'Preparando medios de vídeo e imagen...' })
  const hiddenContainer = typeof document !== 'undefined' ? document.createElement('div') : null
  if (hiddenContainer) {
    hiddenContainer.setAttribute('aria-hidden', 'true')
    // Real dimensions, in-viewport and tiny opacity so Chrome keeps GPU video decoding active
    hiddenContainer.style.cssText =
      'position:fixed;bottom:8px;right:8px;width:320px;height:180px;opacity:0.01;pointer-events:none;z-index:999999;overflow:hidden;'
    document.body.appendChild(hiddenContainer)
  }

  const visualAssets = new Map<string, HTMLImageElement | HTMLVideoElement>()
  const videoClips = tracks.filter((t) => t.kind === 'video').flatMap((t) => t.clips)
  for (const clip of videoClips) {
    const assetId = clip.sourceAssetId
    if (!assetId || visualAssets.has(assetId)) continue
    const asset = assets.find((a) => a.id === assetId)
    const url = await loadMediaSource(assetId)
    if (!url) continue

    if (asset?.type === 'image' || clip.thumbnail === 'image-catalog') {
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

  // Pre-render frame 0 onto canvas so captureStream has pixels ready
  ctx.fillStyle = '#000000'
  ctx.fillRect(0, 0, settings.width, settings.height)
  const activeVideoTracks = tracks.filter((t) => t.kind === 'video' && !mutedTracks.includes(t.id))
  const initialClips = activeVideoTracks.flatMap((track) =>
    track.clips.filter((clip) => 0 >= clip.start && 0 < clip.start + clip.duration),
  )
  const initialMedia = initialClips.filter((c) => c.text === undefined && c.thumbnail !== 'text-overlay')
  const initialText = initialClips.filter((c) => c.text !== undefined || c.thumbnail === 'text-overlay')
  for (const clip of [...initialMedia, ...initialText]) {
    drawClipToCanvas(ctx, clip, visualAssets.get(clip.sourceAssetId ?? ''), 0, settings.width, settings.height)
  }

  // Start initial media videos playing
  for (const clip of initialMedia) {
    const vid = visualAssets.get(clip.sourceAssetId ?? '')
    if (vid instanceof HTMLVideoElement) {
      try { vid.currentTime = 0 } catch { /* ignore */ }
      void vid.play().catch(() => {})
    }
  }

  // Create stream from canvas
  const canvasStream = canvas.captureStream(settings.frameRate)
  let combinedStream = canvasStream

  let audioCtx: AudioContext | undefined
  let sourceNode: AudioBufferSourceNode | undefined

  // Add audio track to stream if available
  if (audioBuffer && typeof AudioContext !== 'undefined') {
    try {
      audioCtx = new AudioContext()
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

  const canvasTrack = canvasStream.getVideoTracks()[0] as unknown as { requestFrame?: () => void }

  try {
    for (let frame = 0; frame < totalFrames; frame++) {
      if (signal?.aborted) {
        try { recorder.stop() } catch { /* ignore */ }
        throw new Error('Exportación cancelada.')
      }

      const frameStartTime = performance.now()
      const time = frame * frameInterval

      // Background fill (black for seamless presentation)
      ctx.fillStyle = '#000000'
      ctx.fillRect(0, 0, settings.width, settings.height)

      // Active clips for this frame
      const activeClips = activeVideoTracks.flatMap((track) =>
        track.clips.filter((clip) => time >= clip.start && time < clip.start + clip.duration),
      )
      const mediaClips = activeClips.filter((clip) => clip.text === undefined && clip.thumbnail !== 'text-overlay')
      const textClips = activeClips.filter((clip) => clip.text !== undefined || clip.thumbnail === 'text-overlay')

      // Synchronize video element playback/position for media clips
      for (const [assetId, element] of visualAssets) {
        if (element instanceof HTMLVideoElement) {
          const activeClip = mediaClips.find((c) => c.sourceAssetId === assetId)
          if (activeClip) {
            const expectedSourceTime = Math.max(0, time - activeClip.start)
            if (!element.paused) {
              if (Math.abs(element.currentTime - expectedSourceTime) > 0.6) {
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

      for (const clip of [...mediaClips, ...textClips]) {
        drawClipToCanvas(ctx, clip, visualAssets.get(clip.sourceAssetId ?? ''), time, settings.width, settings.height)
      }

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

      // Dynamic pacing: ensure event loop yields without unnecessary delay
      const computeTime = performance.now() - frameStartTime
      const sleepMs = Math.max(1, Math.min(20, Math.round(targetFrameIntervalMs - computeTime)))
      await new Promise((r) => setTimeout(r, sleepMs))
    }

    onProgress?.({ stage: 'encoding', percent: 99, currentFrame: totalFrames, totalFrames, message: 'Finalizando codificación de vídeo...' })
    try {
      recorder.stop()
    } catch { /* ignore */ }

    const finalBlob = await completionPromise
    onProgress?.({ stage: 'completed', percent: 100, currentFrame: totalFrames, totalFrames, message: 'Exportación completada con éxito.' })

    return {
      blob: finalBlob,
      fileName: settings.fileName,
      durationSeconds: duration,
      sizeBytes: finalBlob.size,
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
      if (audioCtx && audioCtx.state !== 'closed') {
        void audioCtx.close().catch(() => {})
      }
    } catch { /* ignore */ }
  }
}

function drawClipToCanvas(
  ctx: CanvasRenderingContext2D,
  clip: Clip,
  element: HTMLImageElement | HTMLVideoElement | undefined,
  time: number,
  canvasWidth: number,
  canvasHeight: number,
) {
  if (clip.text !== undefined || clip.thumbnail === 'text-overlay') {
    drawAnimatedTextClipToCanvas(ctx, clip, time, canvasWidth, canvasHeight)
    return
  }

  ctx.save()

  const opacity = getInterpolatedOpacity(clip, time) / 100
  ctx.globalAlpha = Math.max(0, Math.min(1, opacity))

  const transform = getInterpolatedTransform(clip, time, { width: canvasWidth, height: canvasHeight })
  const scaleX = (transform.scaleX ?? 100) / 100
  const scaleY = (transform.scaleY ?? 100) / 100

  ctx.translate(transform.x, transform.y)
  if (transform.rotation) ctx.rotate((transform.rotation * Math.PI) / 180)
  ctx.scale(scaleX, scaleY)

  let rendered = false

  if (element instanceof HTMLImageElement && element.complete && element.naturalWidth > 0) {
    try {
      ctx.drawImage(element, -canvasWidth / 2, -canvasHeight / 2, canvasWidth, canvasHeight)
      rendered = true
    } catch {
      // Image draw failed
    }
  } else if (element instanceof HTMLVideoElement) {
    try {
      ctx.drawImage(element, -canvasWidth / 2, -canvasHeight / 2, canvasWidth, canvasHeight)
      rendered = true
    } catch {
      // Video frame draw failed
    }
  }

  if (!rendered) {
    // Fallback: visual placeholder card only when no media asset is available
    ctx.fillStyle = clip.color === 'olive' ? '#2f4236' : clip.color === 'sand' ? '#443c2c' : '#22384a'
    ctx.fillRect(-canvasWidth / 2, -canvasHeight / 2, canvasWidth, canvasHeight)
    ctx.fillStyle = '#ffffff'
    ctx.font = '28px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(clip.title, 0, 0)
  }

  ctx.restore()
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
