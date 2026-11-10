/**
 * Filmstrip Service — Extracts and manages multi-frame video thumbnails for timeline clips.
 * Provides smooth, professional frame sequences along the clip's duration.
 */

export interface FilmstripFrame {
  time: number
  url: string
}

export interface FilmstripData {
  assetId: string
  duration: number
  frames: FilmstripFrame[]
}

const memoryCache = new Map<string, FilmstripData>()
const inFlightRequests = new Map<string, Promise<FilmstripData | null>>()

/**
 * Extracts a sequence of thumbnail frames across the duration of a video blob.
 */
export async function extractVideoFilmstrip(
  assetId: string,
  blob: Blob,
  frameCount = 8,
): Promise<FilmstripData | null> {
  const cached = memoryCache.get(assetId)
  if (cached && cached.frames.length > 0) return cached

  if (inFlightRequests.has(assetId)) {
    return inFlightRequests.get(assetId)!
  }

  // Graceful fallback for test/node environments without full media decoding
  if (
    typeof document === 'undefined' ||
    typeof window === 'undefined' ||
    typeof window.HTMLVideoElement === 'undefined'
  ) {
    return null
  }

  const promise = (async (): Promise<FilmstripData | null> => {
    let videoUrl = ''
    let video: HTMLVideoElement | null = null
    let container: HTMLDivElement | null = null

    try {
      videoUrl = URL.createObjectURL(blob)
      video = document.createElement('video')
      video.muted = true
      video.playsInline = true
      video.preload = 'auto'

      container = document.createElement('div')
      container.style.cssText = 'position:fixed;bottom:-9999px;right:-9999px;width:160px;height:90px;opacity:0.01;pointer-events:none;'
      container.appendChild(video)
      document.body.appendChild(container)

      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Timeout loading video metadata')), 10000)
        video!.onloadedmetadata = () => {
          clearTimeout(timer)
          resolve()
        }
        video!.onerror = () => {
          clearTimeout(timer)
          reject(new Error('Video decode error'))
        }
        video!.src = videoUrl
        video!.load()
      })

      const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 1
      const count = Math.max(3, Math.min(16, frameCount))
      const timestamps: number[] = []
      for (let i = 0; i < count; i++) {
        timestamps.push((i / Math.max(1, count - 1)) * duration)
      }

      const canvas = document.createElement('canvas')
      canvas.width = 80
      canvas.height = 45
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      if (!ctx) return null

      const frames: FilmstripFrame[] = []

      for (const t of timestamps) {
        await new Promise<void>((res) => {
          const seekTimer = setTimeout(res, 600)
          video!.onseeked = () => {
            clearTimeout(seekTimer)
            res()
          }
          video!.currentTime = t
        })

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        const frameUrl = canvas.toDataURL('image/jpeg', 0.72)
        frames.push({ time: t, url: frameUrl })
      }

      const result: FilmstripData = { assetId, duration, frames }
      memoryCache.set(assetId, result)
      return result
    } catch {
      return null
    } finally {
      if (video) {
        video.pause()
        video.removeAttribute('src')
        try { video.load() } catch { /* ignore */ }
      }
      if (container && container.parentNode) {
        container.remove()
      }
      if (videoUrl) {
        URL.revokeObjectURL(videoUrl)
      }
      inFlightRequests.delete(assetId)
    }
  })()

  inFlightRequests.set(assetId, promise)
  return promise
}

/**
 * Returns an array of image URLs representing the sequence of frames across a clip's length.
 * Each slot maps to its relative time inside the source media.
 */
export function getFilmstripFramesForClip(
  filmstrip: FilmstripData | undefined,
  clipOffset: number,
  clipDuration: number,
  slotCount: number,
  singlePreviewUrl?: string,
): string[] {
  const safeCount = Math.max(1, slotCount)
  if (!filmstrip || filmstrip.frames.length === 0) {
    return singlePreviewUrl ? Array(safeCount).fill(singlePreviewUrl) : []
  }

  const { frames } = filmstrip
  const result: string[] = []

  for (let i = 0; i < safeCount; i++) {
    const relativeT = safeCount === 1 ? 0.5 : i / (safeCount - 1)
    const targetTime = clipOffset + relativeT * clipDuration

    // Find closest frame
    let closest = frames[0]
    let minDiff = Math.abs(frames[0].time - targetTime)

    for (let j = 1; j < frames.length; j++) {
      const diff = Math.abs(frames[j].time - targetTime)
      if (diff < minDiff) {
        minDiff = diff
        closest = frames[j]
      }
    }

    result.push(closest.url)
  }

  return result
}

export function clearFilmstripCache(): void {
  memoryCache.clear()
  inFlightRequests.clear()
}
