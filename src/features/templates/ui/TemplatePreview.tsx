import { useEffect, useRef, useState } from 'react'
import type { SpartaTemplate } from '../domain/template.types'
import { formatTime } from '../../../shared/lib/format-time'

interface TemplatePreviewProps {
  template: SpartaTemplate
  isHovered: boolean
  scrubProgress?: number // 0 to 1 when mouse scrubs horizontally
}

/**
 * High-performance animated preview for templates.
 * Provides a rich poster in resting state and a real-time 60fps kinetic hover scrub
 * showing text animations, scene progressions, countdowns, and audio waveforms.
 */
export function TemplatePreview({ template, isHovered, scrubProgress = 0 }: TemplatePreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const animFrameRef = useRef<number | null>(null)
  const [internalProgress, setInternalProgress] = useState(0)

  // When hovered without moving mouse, smoothly auto-cycle progress (0 -> 1)
  useEffect(() => {
    if (!isHovered) return

    const start = performance.now()
    const loopDuration = 6000 // 6 seconds for full preview cycle

    const tick = (now: number) => {
      const elapsed = (now - start) % loopDuration
      setInternalProgress(elapsed / loopDuration)
      animFrameRef.current = requestAnimationFrame(tick)
    }

    animFrameRef.current = requestAnimationFrame(tick)

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
      setInternalProgress(0)
    }
  }, [isHovered])

  // Active progress is either mouse scrub position or auto-cycle
  const effectiveProgress = scrubProgress > 0 ? scrubProgress : internalProgress
  const currentTimeSec = effectiveProgress * template.durationSeconds

  // Determine active clip and text at current time
  const allClips = template.state.tracks.flatMap((t) => t.clips)
  const activeClip =
    allClips.find(
      (c) =>
        currentTimeSec >= c.start &&
        currentTimeSec < c.start + c.duration &&
        Boolean(c.text || c.title),
    ) || allClips[0]

  const activeText = activeClip?.text || activeClip?.title || template.name
  const isVertical = template.format === '9:16'

  // Render on canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const w = canvas.width
    const h = canvas.height
    ctx.clearRect(0, 0, w, h)

    // 1. Theme-specific backgrounds
    const category = template.category
    const grad = ctx.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, Math.max(w, h))

    if (category === 'stickman') {
      grad.addColorStop(0, '#1a2236')
      grad.addColorStop(0.6, '#0f1422')
      grad.addColorStop(1, '#080a12')
    } else if (category === 'social-media') {
      grad.addColorStop(0, '#2d1b38')
      grad.addColorStop(0.6, '#190e22')
      grad.addColorStop(1, '#09050d')
    } else if (category === 'youtube') {
      grad.addColorStop(0, '#2b1619')
      grad.addColorStop(0.6, '#1a0d0f')
      grad.addColorStop(1, '#0a0506')
    } else if (category === 'business') {
      grad.addColorStop(0, '#15252d')
      grad.addColorStop(0.6, '#0d181d')
      grad.addColorStop(1, '#060a0d')
    } else {
      grad.addColorStop(0, '#1c212d')
      grad.addColorStop(0.6, '#12151e')
      grad.addColorStop(1, '#0b0c11')
    }

    ctx.fillStyle = grad
    ctx.fillRect(0, 0, w, h)

    // Subtle background grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.035)'
    ctx.lineWidth = 1
    const gridSize = 24
    for (let x = 0; x < w; x += gridSize) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, h)
      ctx.stroke()
    }
    for (let y = 0; y < h; y += gridSize) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(w, y)
      ctx.stroke()
    }

    // 2. Aspect Ratio framing guideline
    const frameW = isVertical ? h * (9 / 16) : w * 0.86
    const frameH = isVertical ? h * 0.9 : frameW * (9 / 16)
    const frameX = (w - frameW) / 2
    const frameY = (h - frameH) / 2

    // Frame backdrop
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)'
    ctx.beginPath()
    ctx.roundRect(frameX, frameY, frameW, frameH, 8)
    ctx.fill()
    ctx.strokeStyle = isHovered ? 'rgba(77, 163, 255, 0.35)' : 'rgba(255, 255, 255, 0.1)'
    ctx.lineWidth = 1.2
    ctx.stroke()

    // 3. Category Specific Dynamic Visual Elements
    if (category === 'stickman') {
      // Draw minimalist stickman figure
      const cx = frameX + frameW / 2
      const cy = frameY + frameH * 0.44
      const scale = isVertical ? 0.85 : 0.75
      const bounce = isHovered ? Math.sin(effectiveProgress * Math.PI * 8) * 3 : 0

      ctx.save()
      ctx.strokeStyle = '#ffffff'
      ctx.fillStyle = '#ffffff'
      ctx.lineWidth = 2.2 * scale
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'

      // Head
      ctx.beginPath()
      ctx.arc(cx, cy - 26 * scale + bounce, 9 * scale, 0, Math.PI * 2)
      ctx.stroke()

      // Body
      ctx.beginPath()
      ctx.moveTo(cx, cy - 17 * scale + bounce)
      ctx.lineTo(cx, cy + 14 * scale + bounce)
      ctx.stroke()

      // Arms (dynamic wave on hover)
      const armAngle = isHovered ? Math.sin(effectiveProgress * Math.PI * 10) * 0.35 : 0.2
      ctx.beginPath()
      ctx.moveTo(cx - 16 * scale, cy - 4 * scale + bounce - armAngle * 10)
      ctx.lineTo(cx, cy - 8 * scale + bounce)
      ctx.lineTo(cx + 16 * scale, cy - 4 * scale + bounce + armAngle * 10)
      ctx.stroke()

      // Legs
      ctx.beginPath()
      ctx.moveTo(cx - 12 * scale, cy + 34 * scale)
      ctx.lineTo(cx, cy + 14 * scale + bounce)
      ctx.lineTo(cx + 12 * scale, cy + 34 * scale)
      ctx.stroke()

      ctx.restore()
    } else if (template.id.includes('ranking') || template.id.includes('top-5')) {
      // Countdown ranking digit
      const digit = Math.max(1, 5 - Math.floor(effectiveProgress * 5))
      ctx.save()
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.font = '900 48px system-ui, sans-serif'
      ctx.fillStyle = '#f59e0b'
      ctx.shadowColor = 'rgba(245, 158, 11, 0.6)'
      ctx.shadowBlur = 16
      ctx.fillText(`#${digit}`, frameX + frameW / 2, frameY + frameH * 0.42)
      ctx.restore()
    } else if (category === 'social-media' || template.id.includes('hormozi')) {
      // Hormozi kinetic typography badge
      ctx.save()
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      const badgeW = frameW * 0.8
      const badgeH = 26
      const bx = frameX + (frameW - badgeW) / 2
      const by = frameY + frameH * 0.36
      ctx.fillStyle = '#facc15'
      ctx.beginPath()
      ctx.roundRect(bx, by, badgeW, badgeH, 6)
      ctx.fill()
      ctx.fillStyle = '#000000'
      ctx.font = '900 11px system-ui, sans-serif'
      ctx.fillText('SUBTÍTULOS HORMOZI', bx + badgeW / 2, by + badgeH / 2)
      ctx.restore()
    } else if (category === 'youtube') {
      // Lower third banner preview
      ctx.save()
      const ltW = frameW * 0.88
      const ltH = 24
      const lx = frameX + (frameW - ltW) / 2
      const ly = frameY + frameH * 0.55
      ctx.fillStyle = 'rgba(20, 20, 25, 0.85)'
      ctx.beginPath()
      ctx.roundRect(lx, ly, ltW, ltH, 6)
      ctx.fill()
      ctx.strokeStyle = '#ef4444'
      ctx.lineWidth = 1.5
      ctx.stroke()

      // Red subscribe button
      ctx.fillStyle = '#ef4444'
      ctx.beginPath()
      ctx.roundRect(lx + ltW - 46, ly + 4, 40, 16, 4)
      ctx.fill()
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 8px system-ui'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('SUSCRIBIR', lx + ltW - 26, ly + 12)
      ctx.restore()
    } else if (category === 'business') {
      // E-commerce promo ribbon
      ctx.save()
      const cx = frameX + frameW / 2
      const cy = frameY + frameH * 0.4
      ctx.fillStyle = '#10b981'
      ctx.beginPath()
      ctx.roundRect(cx - 36, cy - 14, 72, 24, 6)
      ctx.fill()
      ctx.fillStyle = '#ffffff'
      ctx.font = '900 12px monospace'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('50% OFF', cx, cy - 2)
      ctx.restore()
    }

    // 4. Kinetic Scene Caption / Hook Text
    const textY = frameY + frameH * 0.76
    ctx.save()
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = 'bold 10.5px system-ui, sans-serif'
    ctx.fillStyle = '#ffffff'
    ctx.shadowColor = 'rgba(0, 0, 0, 0.9)'
    ctx.shadowBlur = 6

    // Truncate text nicely
    let displayText = activeText
    if (displayText.length > 30) displayText = displayText.slice(0, 28) + '…'

    // Text bounding pill
    const metrics = ctx.measureText(displayText)
    const pillW = Math.min(frameW * 0.92, metrics.width + 16)
    const pillH = 18
    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)'
    ctx.beginPath()
    ctx.roundRect(frameX + (frameW - pillW) / 2, textY - pillH / 2, pillW, pillH, 4)
    ctx.fill()

    ctx.fillStyle = isHovered ? '#60a5fa' : '#ffffff'
    ctx.fillText(displayText, frameX + frameW / 2, textY)
    ctx.restore()

    // 5. When Hovered: Animated Scrubber & Audio Equalizer
    if (isHovered) {
      // Audio Equalizer bars in top-right of frame
      ctx.save()
      const eqX = frameX + frameW - 26
      const eqY = frameY + 8
      ctx.fillStyle = '#60a5fa'
      for (let i = 0; i < 4; i++) {
        const hVal = 4 + Math.sin(effectiveProgress * Math.PI * 12 + i * 1.5) * 5
        ctx.fillRect(eqX + i * 4, eqY + (10 - hVal), 2.5, hVal)
      }
      ctx.restore()

      // Scrubber Track at bottom of card
      const barY = h - 5
      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)'
      ctx.fillRect(0, barY, w, 5)

      // Scrubber fill
      ctx.fillStyle = '#3b82f6'
      ctx.fillRect(0, barY, w * effectiveProgress, 5)

      // Glowing Playhead
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.arc(w * effectiveProgress, barY + 2.5, 3.5, 0, Math.PI * 2)
      ctx.fill()
    }
  }, [template, isHovered, effectiveProgress, activeText, isVertical])

  return (
    <div className="relative w-full h-full flex items-center justify-center select-none overflow-hidden">
      {/* 60fps dynamic canvas */}
      <canvas
        ref={canvasRef}
        width={320}
        height={180}
        className="w-full h-full object-cover rounded-xl"
      />

      {/* Floating Scrub Timecode badge on Hover */}
      {isHovered && (
        <div className="absolute top-2 right-2 flex items-center gap-1 rounded bg-black/85 px-1.5 py-0.5 text-[9px] font-mono font-semibold text-primary border border-primary/30 backdrop-blur-xs animate-in fade-in duration-150">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          <span>
            {formatTime(currentTimeSec)} / {formatTime(template.durationSeconds)}
          </span>
        </div>
      )}

      {/* Active Scene Chip on Hover */}
      {isHovered && activeClip && (
        <div className="absolute top-2 left-2 max-w-[130px] truncate rounded bg-black/80 px-2 py-0.5 text-[9px] font-medium text-white/90 border border-white/10 backdrop-blur-xs">
          {activeClip.title}
        </div>
      )}
    </div>
  )
}
