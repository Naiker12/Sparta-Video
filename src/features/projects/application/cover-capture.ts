import type { PersistedProjectState } from '../domain/project.types'
import { storeMediaPreview, loadMediaPreview, loadMediaBlob } from '../../editor/services/media-storage'
import { formatDurationCompact } from '../../../shared/lib/format-time'

async function captureVideoFrame(blob: Blob, seekSeconds = 0.5): Promise<HTMLCanvasElement | null> {
  return new Promise((resolve) => {
    const video = document.createElement('video')
    video.muted = true
    video.playsInline = true
    const url = URL.createObjectURL(blob)
    video.src = url
    let resolved = false
    const cleanup = () => {
      video.removeAttribute('src')
      video.load()
      URL.revokeObjectURL(url)
    }
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true
        cleanup()
        resolve(null)
      }
    }, 2500)

    video.onloadedmetadata = () => {
      const targetTime = Math.min(Math.max(0.1, seekSeconds), Math.max(0.1, video.duration - 0.1))
      video.currentTime = targetTime
    }
    video.onseeked = () => {
      if (resolved) return
      resolved = true
      clearTimeout(timeout)
      try {
        const c = document.createElement('canvas')
        c.width = video.videoWidth || 640
        c.height = video.videoHeight || 360
        const cCtx = c.getContext('2d')
        if (cCtx) {
          cCtx.drawImage(video, 0, 0, c.width, c.height)
          cleanup()
          resolve(c)
          return
        }
      } catch {
        /* ignore */
      }
      cleanup()
      resolve(null)
    }
    video.onerror = () => {
      if (resolved) return
      resolved = true
      clearTimeout(timeout)
      cleanup()
      resolve(null)
    }
  })
}

/**
 * Generates and stores a cover thumbnail for a project in IndexedDB.
 * Supports projects with visual media, video frame thumbnails, or visual timeline cards.
 */
export async function generateProjectCover(
  projectId: string,
  state: PersistedProjectState,
): Promise<string | null> {
  if (typeof document === 'undefined') return null

  try {
    const isVertical = state.sequence.width < state.sequence.height
    const canvasWidth = isVertical ? 240 : 400
    const canvasHeight = isVertical ? 400 : 225

    const canvas = document.createElement('canvas')
    canvas.width = canvasWidth
    canvas.height = canvasHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    // 1. Try to find a visual clip with image/video media (limit search to first 3 to prevent stalls)
    const visualClips = state.tracks
      .flatMap((t) => t.clips)
      .filter((c) => Boolean(c.sourceAssetId))
      .slice(0, 3)

    let drawnMedia = false

    for (const clip of visualClips) {
      if (!clip.sourceAssetId) continue

      try {
        // Try loadMediaPreview first (handles both stored image and cached video frames)
        const previewUrl = await loadMediaPreview(clip.sourceAssetId)
        if (previewUrl) {
          const img = new Image()
          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve()
            img.onerror = reject
            img.src = previewUrl
          })

          const imgW = img.naturalWidth || img.width || canvasWidth
          const imgH = img.naturalHeight || img.height || canvasHeight
          const scale = Math.max(canvasWidth / imgW, canvasHeight / imgH)
          const ox = (canvasWidth - imgW * scale) / 2
          const oy = (canvasHeight - imgH * scale) / 2

          ctx.drawImage(img, ox, oy, imgW * scale, imgH * scale)

          // Subtle bottom gradient for readability
          const scrim = ctx.createLinearGradient(0, canvasHeight * 0.5, 0, canvasHeight)
          scrim.addColorStop(0, 'rgba(0, 0, 0, 0)')
          scrim.addColorStop(1, 'rgba(0, 0, 0, 0.75)')
          ctx.fillStyle = scrim
          ctx.fillRect(0, 0, canvasWidth, canvasHeight)

          drawnMedia = true
          break
        }

        // Try raw image blob fallback
        const blob = await loadMediaBlob(clip.sourceAssetId)
        if (blob && blob.type.startsWith('image/')) {
          const img = new Image()
          const url = URL.createObjectURL(blob)
          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve()
            img.onerror = reject
            img.src = url
          })
          const imgW = img.naturalWidth || img.width || canvasWidth
          const imgH = img.naturalHeight || img.height || canvasHeight
          const scale = Math.max(canvasWidth / imgW, canvasHeight / imgH)
          const ox = (canvasWidth - imgW * scale) / 2
          const oy = (canvasHeight - imgH * scale) / 2
          ctx.drawImage(img, ox, oy, imgW * scale, imgH * scale)
          URL.revokeObjectURL(url)
          drawnMedia = true
          break
        }

        // Try raw video blob fallback -> extract video frame
        if (blob && blob.type.startsWith('video/')) {
          const frameCanvas = await captureVideoFrame(blob, 0.5)
          if (frameCanvas) {
            const vW = frameCanvas.width || canvasWidth
            const vH = frameCanvas.height || canvasHeight
            const scale = Math.max(canvasWidth / vW, canvasHeight / vH)
            const ox = (canvasWidth - vW * scale) / 2
            const oy = (canvasHeight - vH * scale) / 2
            ctx.drawImage(frameCanvas, ox, oy, vW * scale, vH * scale)

            // Subtle bottom gradient for readability
            const scrim = ctx.createLinearGradient(0, canvasHeight * 0.5, 0, canvasHeight)
            scrim.addColorStop(0, 'rgba(0, 0, 0, 0)')
            scrim.addColorStop(1, 'rgba(0, 0, 0, 0.75)')
            ctx.fillStyle = scrim
            ctx.fillRect(0, 0, canvasWidth, canvasHeight)

            drawnMedia = true
            break
          }
        }
      } catch {
        /* continue to next clip */
      }
    }

    if (!drawnMedia) {
      // 2. Render rich cinematic timeline card visualizing tracks and clips
      const grad = ctx.createLinearGradient(0, 0, canvasWidth, canvasHeight)
      grad.addColorStop(0, '#131620')
      grad.addColorStop(0.5, '#1b202c')
      grad.addColorStop(1, '#0e1017')
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, canvasWidth, canvasHeight)

      // Accent border at top
      const topBar = ctx.createLinearGradient(0, 0, canvasWidth, 0)
      topBar.addColorStop(0, '#3b82f6')
      topBar.addColorStop(0.5, '#8b5cf6')
      topBar.addColorStop(1, '#ec4899')
      ctx.fillStyle = topBar
      ctx.fillRect(0, 0, canvasWidth, 4)

      // Background timeline lanes preview
      const totalDuration = Math.max(
        1,
        ...state.tracks.flatMap((t) => t.clips.map((c) => c.start + c.duration)),
      )

      const laneStartY = canvasHeight * 0.42
      const laneH = 12
      const laneGap = 5
      const previewTracks = state.tracks.slice(0, 4)

      previewTracks.forEach((track, tIdx) => {
        const y = laneStartY + tIdx * (laneH + laneGap)
        if (y + laneH > canvasHeight - 20) return

        // Lane background
        ctx.fillStyle = 'rgba(255, 255, 255, 0.04)'
        ctx.fillRect(16, y, canvasWidth - 32, laneH)

        // Track clips
        track.clips.forEach((clip) => {
          const clipX = 16 + (clip.start / totalDuration) * (canvasWidth - 32)
          const clipW = Math.max(4, (clip.duration / totalDuration) * (canvasWidth - 32))

          if (track.kind === 'audio') {
            ctx.fillStyle = '#10b981'
          } else if (clip.text !== undefined || clip.thumbnail === 'text-overlay') {
            ctx.fillStyle = '#a855f7'
          } else if (clip.kind === 'adjustment') {
            ctx.fillStyle = '#8b5cf6'
          } else {
            ctx.fillStyle = '#3b82f6'
          }

          ctx.beginPath()
          ctx.roundRect(clipX, y + 1, Math.min(clipW, canvasWidth - 16 - clipX), laneH - 2, 2)
          ctx.fill()
        })
      })

      // Title
      const title = state.projectName || 'Sin título'
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 16px system-ui, -apple-system, sans-serif'
      ctx.textAlign = 'left'
      ctx.textBaseline = 'top'
      ctx.fillText(title.length > 26 ? title.slice(0, 24) + '…' : title, 20, 24)

      // Subtitle with clip count and duration
      const clipCount = state.tracks.reduce((s, t) => s + t.clips.length, 0)
      ctx.fillStyle = 'rgba(255, 255, 255, 0.65)'
      ctx.font = '11px monospace, system-ui'
      ctx.fillText(
        `${clipCount} clips · ${formatDurationCompact(totalDuration)}`,
        20,
        48,
      )

      // Format Pill badge in bottom right
      const fmt = isVertical ? '9:16' : '16:9'
      ctx.fillStyle = 'rgba(255, 255, 255, 0.12)'
      ctx.beginPath()
      ctx.roundRect(canvasWidth - 56, canvasHeight - 26, 42, 16, 6)
      ctx.fill()
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
      ctx.font = 'bold 9px monospace'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(fmt, canvasWidth - 35, canvasHeight - 18)
    }

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/webp', 0.88),
    )

    if (blob) {
      await storeMediaPreview(`cover-${projectId}`, blob)
      return URL.createObjectURL(blob)
    }
  } catch (err) {
    console.error('Error generating project cover:', err)
  }

  return null
}
