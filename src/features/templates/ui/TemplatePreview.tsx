import { useEffect, useRef, useState } from 'react'
import type { SpartaTemplate } from '../domain/template.types'
import { formatTime } from '../../../shared/lib/format-time'

interface TemplatePreviewProps {
  template: SpartaTemplate
  isHovered: boolean
  scrubProgress?: number
}

/**
 * 60fps Broadcast-grade animated interactive preview for templates.
 * Provides a dynamic, living cinematic preview when hovered (or scrubbed),
 * featuring real-time scene progressions, kinetic typography, character animations,
 * rhythm-synced audio equalizers, and glowing timeline scrubbers.
 */
export function TemplatePreview({ template, isHovered, scrubProgress = 0 }: TemplatePreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [internalProgress, setInternalProgress] = useState(0)

  // Continuously loop animation while hovered at 60fps
  useEffect(() => {
    if (!isHovered) return

    let animId: number
    const start = performance.now()
    const loopDurationMs = 5000 // 5 seconds per full preview loop

    const tick = (now: number) => {
      const elapsed = (now - start) % loopDurationMs
      setInternalProgress(elapsed / loopDurationMs)
      animId = requestAnimationFrame(tick)
    }

    animId = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(animId)
    }
  }, [isHovered])

  // Active progress: user scrub overrides if scrubbing, otherwise auto-play
  const effectiveProgress = isHovered
    ? scrubProgress > 0
      ? scrubProgress
      : internalProgress
    : scrubProgress || 0
  const currentTimeSec = effectiveProgress * template.durationSeconds

  // Determine active clip / scene
  const allClips = template.state.tracks.flatMap((t) => t.clips)
  const textClips = allClips.filter((c) => Boolean(c.text || c.title))
  const activeClipIndex = textClips.findIndex(
    (c) => currentTimeSec >= c.start && currentTimeSec < c.start + c.duration,
  )
  const activeClip = activeClipIndex >= 0 ? textClips[activeClipIndex] : textClips[0] || allClips[0]
  const currentSceneNumber = Math.max(1, activeClipIndex + 1)
  const totalScenes = Math.max(1, textClips.length)

  const activeText = activeClip?.text || activeClip?.title || template.name
  const isVertical = template.format === '9:16'
  const isSquare = template.format === '1:1'

  // Canvas 60fps Render Loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const w = canvas.width
    const h = canvas.height
    ctx.clearRect(0, 0, w, h)

    const t = effectiveProgress
    const timeMs = t * 5000

    // 1. Dynamic Atmosphere & Category Gradient
    const category = template.category
    const bgGrad = ctx.createRadialGradient(
      w / 2 + Math.sin(t * Math.PI * 2) * 20,
      h / 2 + Math.cos(t * Math.PI * 2) * 15,
      15,
      w / 2,
      h / 2,
      Math.max(w, h) * 0.9,
    )

    if (category === 'stickman') {
      bgGrad.addColorStop(0, '#1c2847')
      bgGrad.addColorStop(0.5, '#0e1728')
      bgGrad.addColorStop(1, '#070b14')
    } else if (category === 'social-media' || template.id.includes('hormozi')) {
      bgGrad.addColorStop(0, '#381647')
      bgGrad.addColorStop(0.5, '#1b0924')
      bgGrad.addColorStop(1, '#0b040f')
    } else if (category === 'youtube') {
      bgGrad.addColorStop(0, '#381318')
      bgGrad.addColorStop(0.5, '#1c080b')
      bgGrad.addColorStop(1, '#0a0304')
    } else if (category === 'business') {
      bgGrad.addColorStop(0, '#123328')
      bgGrad.addColorStop(0.5, '#081c15')
      bgGrad.addColorStop(1, '#040d0a')
    } else if (category === 'education') {
      bgGrad.addColorStop(0, '#132840')
      bgGrad.addColorStop(0.5, '#091624')
      bgGrad.addColorStop(1, '#040b12')
    } else if (category === 'cinematic') {
      bgGrad.addColorStop(0, '#2b1b38')
      bgGrad.addColorStop(0.5, '#150d1c')
      bgGrad.addColorStop(1, '#08050a')
    } else {
      bgGrad.addColorStop(0, '#202533')
      bgGrad.addColorStop(0.5, '#11141c')
      bgGrad.addColorStop(1, '#08090d')
    }

    ctx.fillStyle = bgGrad
    ctx.fillRect(0, 0, w, h)

    // Subtle ambient animated particles (sparks / dust)
    if (isHovered) {
      ctx.save()
      for (let i = 0; i < 7; i++) {
        const px = ((i * 47 + timeMs * 0.035) % w)
        const py = ((i * 31 + Math.sin(timeMs * 0.003 + i) * 25 + h) % h)
        const pSize = 1 + (i % 2) * 1.2
        ctx.fillStyle = `rgba(255, 255, 255, ${0.12 + (i % 3) * 0.08})`
        ctx.beginPath()
        ctx.arc(px, py, pSize, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.restore()
    }

    // Grid lines for high-tech aesthetic
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)'
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

    // 2. Aspect Ratio Framing (Mockup phone / widescreen)
    let frameW: number
    let frameH: number

    if (isVertical) {
      frameH = h * 0.88
      frameW = frameH * (9 / 16)
    } else if (isSquare) {
      frameH = h * 0.85
      frameW = frameH
    } else {
      frameW = w * 0.86
      frameH = frameW * (9 / 16)
    }

    const frameX = (w - frameW) / 2
    const frameY = (h - frameH) / 2

    // Device / Stage Frame container
    ctx.save()
    ctx.fillStyle = 'rgba(5, 7, 12, 0.65)'
    ctx.beginPath()
    ctx.roundRect(frameX, frameY, frameW, frameH, 8)
    ctx.fill()

    // Glowing animated border on hover
    if (isHovered) {
      const glowGrad = ctx.createLinearGradient(frameX, frameY, frameX + frameW, frameY + frameH)
      glowGrad.addColorStop(0, 'rgba(59, 130, 246, 0.8)')
      glowGrad.addColorStop(0.5, 'rgba(168, 85, 247, 0.8)')
      glowGrad.addColorStop(1, 'rgba(59, 130, 246, 0.8)')
      ctx.strokeStyle = glowGrad
      ctx.lineWidth = 1.6
      ctx.shadowColor = 'rgba(59, 130, 246, 0.45)'
      ctx.shadowBlur = 10
    } else {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)'
      ctx.lineWidth = 1.2
    }
    ctx.stroke()
    ctx.restore()

    // 3. Dynamic Category-Specific Animations
    ctx.save()
    ctx.beginPath()
    ctx.roundRect(frameX, frameY, frameW, frameH, 8)
    ctx.clip() // Keep animations strictly inside the aspect-ratio frame

    if (category === 'stickman') {
      // --- STICKMAN ANIMATION ---
      const cx = frameX + frameW / 2
      const cy = frameY + frameH * 0.42
      const scale = isVertical ? 0.9 : 0.78

      // Determine emotion / pose by scene progress
      const isHook = t < 0.25
      const isConflict = t >= 0.25 && t < 0.55
      const isClimax = t >= 0.55 && t < 0.85

      // Running / walking bounce
      const runBounce = isHovered ? Math.abs(Math.sin(t * Math.PI * 14)) * 5 : 0
      const legCycle = isHovered ? Math.sin(t * Math.PI * 14) : 0

      ctx.save()
      ctx.strokeStyle = '#ffffff'
      ctx.fillStyle = '#ffffff'
      ctx.lineWidth = 2.4 * scale
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'

      // Head
      const headY = cy - 28 * scale - runBounce
      ctx.beginPath()
      ctx.arc(cx, headY, 9 * scale, 0, Math.PI * 2)
      ctx.stroke()

      // Face expression (eyes)
      ctx.fillStyle = '#ffffff'
      if (isConflict) {
        // Worried eyes
        ctx.fillRect(cx - 4 * scale, headY - 1 * scale, 2 * scale, 2 * scale)
        ctx.fillRect(cx + 2 * scale, headY - 1 * scale, 2 * scale, 2 * scale)
      } else {
        // Happy / focused eyes
        ctx.fillRect(cx - 3.5 * scale, headY - 2 * scale, 2 * scale, 2 * scale)
        ctx.fillRect(cx + 2.5 * scale, headY - 2 * scale, 2 * scale, 2 * scale)
      }

      // Torso
      ctx.beginPath()
      ctx.moveTo(cx, headY + 9 * scale)
      ctx.lineTo(cx, cy + 12 * scale - runBounce)
      ctx.stroke()

      // Arms depending on scene
      if (isHook) {
        // Pointing up with lightbulb
        ctx.beginPath()
        ctx.moveTo(cx, headY + 14 * scale)
        ctx.lineTo(cx + 14 * scale, headY - 4 * scale)
        ctx.moveTo(cx, headY + 14 * scale)
        ctx.lineTo(cx - 10 * scale, cy + 4 * scale)
        ctx.stroke()

        // Glowing lightbulb
        const bulbX = cx + 18 * scale
        const bulbY = headY - 14 * scale
        ctx.fillStyle = '#facc15'
        ctx.beginPath()
        ctx.arc(bulbX, bulbY, 5 * scale, 0, Math.PI * 2)
        ctx.fill()
        // Rays
        ctx.strokeStyle = '#facc15'
        ctx.lineWidth = 1.2
        for (let r = 0; r < 5; r++) {
          const ang = (r * Math.PI) / 4 - Math.PI / 2
          ctx.beginPath()
          ctx.moveTo(bulbX + Math.cos(ang) * 7 * scale, bulbY + Math.sin(ang) * 7 * scale)
          ctx.lineTo(bulbX + Math.cos(ang) * 11 * scale, bulbY + Math.sin(ang) * 11 * scale)
          ctx.stroke()
        }
      } else if (isConflict) {
        // Scratching head
        ctx.beginPath()
        ctx.moveTo(cx, headY + 14 * scale)
        ctx.lineTo(cx - 12 * scale, headY - 2 * scale)
        ctx.lineTo(cx - 6 * scale, headY - 6 * scale)
        ctx.moveTo(cx, headY + 14 * scale)
        ctx.lineTo(cx + 12 * scale, cy + 4 * scale)
        ctx.stroke()

        // Question mark
        ctx.fillStyle = '#ef4444'
        ctx.font = `bold ${14 * scale}px system-ui`
        ctx.textAlign = 'center'
        ctx.fillText('?', cx + 16 * scale, headY - 4 * scale)
      } else if (isClimax) {
        // Both hands up celebration
        ctx.beginPath()
        ctx.moveTo(cx, headY + 14 * scale)
        ctx.lineTo(cx - 14 * scale, headY - 12 * scale)
        ctx.moveTo(cx, headY + 14 * scale)
        ctx.lineTo(cx + 14 * scale, headY - 12 * scale)
        ctx.stroke()

        // Sparkle stars
        ctx.fillStyle = '#38bdf8'
        ctx.font = `${10 * scale}px system-ui`
        ctx.fillText('✦', cx - 20 * scale, headY - 16 * scale)
        ctx.fillText('✦', cx + 20 * scale, headY - 16 * scale)
      } else {
        // CTA wave
        const waveAngle = Math.sin(t * Math.PI * 18) * 0.4
        ctx.beginPath()
        ctx.moveTo(cx, headY + 14 * scale)
        ctx.lineTo(cx + 14 * scale, headY - 6 * scale + waveAngle * 8)
        ctx.moveTo(cx, headY + 14 * scale)
        ctx.lineTo(cx - 10 * scale, cy + 8 * scale)
        ctx.stroke()
      }

      // Legs (running / stepping motion)
      ctx.beginPath()
      ctx.moveTo(cx, cy + 12 * scale - runBounce)
      ctx.lineTo(cx - 11 * scale + legCycle * 8, cy + 32 * scale)
      ctx.moveTo(cx, cy + 12 * scale - runBounce)
      ctx.lineTo(cx + 11 * scale - legCycle * 8, cy + 32 * scale)
      ctx.stroke()

      ctx.restore()
    } else if (template.id.includes('ranking') || template.id.includes('top-5')) {
      // --- TOP 5 RANKING ANIMATION ---
      const totalSteps = 5
      const currentStep = Math.min(5, Math.max(1, 5 - Math.floor(t * totalSteps)))
      const stepProgress = (t * totalSteps) % 1
      const popScale = 1 + Math.max(0, (1 - stepProgress * 2.5)) * 0.35

      const rx = frameX + frameW / 2
      const ry = frameY + frameH * 0.4

      ctx.save()
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'

      // Impact shockwave ring when number changes
      if (stepProgress < 0.35) {
        ctx.strokeStyle = `rgba(245, 158, 11, ${0.8 - stepProgress * 2})`
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.arc(rx, ry, 30 + stepProgress * 70, 0, Math.PI * 2)
        ctx.stroke()
      }

      // Number badge
      ctx.save()
      ctx.translate(rx, ry)
      ctx.scale(popScale, popScale)
      ctx.font = '900 52px system-ui, sans-serif'
      ctx.fillStyle = '#f59e0b'
      ctx.shadowColor = 'rgba(245, 158, 11, 0.75)'
      ctx.shadowBlur = 18
      ctx.fillText(`#${currentStep}`, 0, 0)
      ctx.restore()

      // Star rating badge underneath
      const stars = '★'.repeat(6 - currentStep) + '☆'.repeat(currentStep - 1)
      ctx.font = 'bold 12px system-ui'
      ctx.fillStyle = '#fbbf24'
      ctx.fillText(stars, rx, ry + 36)

      ctx.restore()
    } else if (category === 'social-media' || template.id.includes('hormozi')) {
      // --- HORMOZI KARAOKE WORD-BY-WORD ANIMATION ---
      ctx.save()
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'

      const words = ['SI', 'QUIERES', 'CRECER', 'EN', 'REDES']
      const activeWordIndex = Math.floor(t * words.length) % words.length

      // Kinetic words container
      const hy = frameY + frameH * 0.38
      ctx.font = '900 13px system-ui, sans-serif'

      const totalWordsW = frameW * 0.88
      const wordSlot = totalWordsW / words.length

      words.forEach((word, idx) => {
        const wx = frameX + (frameW - totalWordsW) / 2 + (idx + 0.5) * wordSlot
        const isActive = idx === activeWordIndex

        if (isActive) {
          // Alex Hormozi signature neon pill
          const pillW = Math.max(34, ctx.measureText(word).width + 12)
          const pillH = 22
          ctx.save()
          ctx.fillStyle = idx % 2 === 0 ? '#facc15' : '#4ade80' // Yellow & Green karaoke
          ctx.shadowColor = idx % 2 === 0 ? 'rgba(250, 204, 21, 0.8)' : 'rgba(74, 222, 128, 0.8)'
          ctx.shadowBlur = 12
          ctx.beginPath()
          ctx.roundRect(wx - pillW / 2, hy - pillH / 2, pillW, pillH, 5)
          ctx.fill()

          // Popping bold black text
          ctx.fillStyle = '#000000'
          ctx.font = '900 13px system-ui, sans-serif'
          ctx.fillText(word, wx, hy)

          // Bouncing flame emoji / icon on top
          ctx.font = '12px system-ui'
          ctx.fillText('🔥', wx, hy - 17)
          ctx.restore()
        } else {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.55)'
          ctx.font = 'bold 11px system-ui, sans-serif'
          ctx.fillText(word, wx, hy)
        }
      })
      ctx.restore()
    } else if (category === 'youtube') {
      // --- YOUTUBE INTRO & LOWER THIRD ---
      ctx.save()
      const ltW = frameW * 0.88
      const ltH = 26
      const lx = frameX + (frameW - ltW) / 2
      const ly = frameY + frameH * 0.44

      // Lower third bar with red accent
      ctx.fillStyle = 'rgba(15, 17, 23, 0.9)'
      ctx.beginPath()
      ctx.roundRect(lx, ly, ltW, ltH, 6)
      ctx.fill()
      ctx.strokeStyle = '#ef4444'
      ctx.lineWidth = 1.5
      ctx.stroke()

      // Avatar circle
      ctx.fillStyle = '#3b82f6'
      ctx.beginPath()
      ctx.arc(lx + 14, ly + ltH / 2, 8, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 9px system-ui'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('S', lx + 14, ly + ltH / 2)

      // Channel name
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 9px system-ui'
      ctx.textAlign = 'left'
      ctx.fillText('Tu Canal Aquí', lx + 27, ly + ltH / 2)

      // Animated Subscribe button with ringing bell
      const subX = lx + ltW - 48
      const subY = ly + 4
      ctx.fillStyle = '#ef4444'
      ctx.beginPath()
      ctx.roundRect(subX, subY, 44, 18, 4)
      ctx.fill()

      // Wobbling bell animation
      const bellWobble = Math.sin(t * Math.PI * 16) * 0.3
      ctx.save()
      ctx.translate(subX + 8, subY + 9)
      ctx.rotate(bellWobble)
      ctx.font = '9px system-ui'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('🔔', 0, 0)
      ctx.restore()

      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 7.5px system-ui'
      ctx.textAlign = 'left'
      ctx.fillText('SUSCRIBIR', subX + 15, subY + 9)

      ctx.restore()
    } else if (category === 'business') {
      // --- BUSINESS / PRODUCT PROMO ---
      ctx.save()
      const cx = frameX + frameW / 2
      const cy = frameY + frameH * 0.38

      // 3D-angled floating card
      ctx.fillStyle = 'rgba(16, 185, 129, 0.15)'
      ctx.strokeStyle = '#10b981'
      ctx.lineWidth = 1.2
      ctx.beginPath()
      ctx.roundRect(cx - 40, cy - 24, 80, 48, 8)
      ctx.fill()
      ctx.stroke()

      // Rotating discount badge
      const badgeAngle = Math.sin(t * Math.PI * 4) * 0.08
      ctx.save()
      ctx.translate(cx, cy - 6)
      ctx.rotate(badgeAngle)
      ctx.fillStyle = '#10b981'
      ctx.beginPath()
      ctx.roundRect(-30, -12, 60, 20, 5)
      ctx.fill()
      ctx.fillStyle = '#ffffff'
      ctx.font = '900 11px system-ui, monospace'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('50% OFF', 0, 0)
      ctx.restore()

      // Price Slash: $120 -> $49
      ctx.font = 'bold 9px system-ui'
      ctx.textAlign = 'center'
      ctx.fillStyle = 'rgba(255, 255, 255, 0.45)'
      ctx.fillText('$120', cx - 16, cy + 16)
      ctx.strokeStyle = '#ef4444'
      ctx.lineWidth = 1.2
      ctx.beginPath()
      ctx.moveTo(cx - 24, cy + 16)
      ctx.lineTo(cx - 8, cy + 16)
      ctx.stroke()

      ctx.fillStyle = '#4ade80'
      ctx.font = '900 11px system-ui'
      ctx.fillText('$49.99', cx + 16, cy + 16)

      ctx.restore()
    } else if (category === 'education') {
      // --- STEP-BY-STEP LESSON CHECKLIST ---
      ctx.save()
      const stepBoxW = frameW * 0.88
      const stepBoxH = 18
      const sx = frameX + (frameW - stepBoxW) / 2
      const sy = frameY + frameH * 0.28

      const steps = [
        { label: '1: Introducción', done: t > 0.2 },
        { label: '2: Demostración', done: t > 0.6 },
        { label: '3: Conclusión', done: t > 0.9 },
      ]

      steps.forEach((st, idx) => {
        const itemY = sy + idx * (stepBoxH + 5)
        ctx.fillStyle = st.done ? 'rgba(16, 185, 129, 0.18)' : 'rgba(255, 255, 255, 0.06)'
        ctx.beginPath()
        ctx.roundRect(sx, itemY, stepBoxW, stepBoxH, 4)
        ctx.fill()

        // Checkmark or dot
        ctx.fillStyle = st.done ? '#10b981' : '#64748b'
        ctx.font = 'bold 10px system-ui'
        ctx.textAlign = 'left'
        ctx.textBaseline = 'middle'
        ctx.fillText(st.done ? '✓' : '○', sx + 8, itemY + stepBoxH / 2)

        ctx.fillStyle = st.done ? '#ffffff' : '#94a3b8'
        ctx.font = 'bold 9px system-ui'
        ctx.fillText(st.label, sx + 22, itemY + stepBoxH / 2)
      })
      ctx.restore()
    } else {
      // --- GENERAL / STARTER / B-ROLL HUD ---
      ctx.save()
      const cx = frameX + frameW / 2
      const cy = frameY + frameH * 0.4

      // Camera Viewfinder Reticle & HUD
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)'
      ctx.lineWidth = 1
      ctx.strokeRect(frameX + 12, frameY + 12, frameW - 24, frameH - 24)

      // Center crosshairs
      ctx.beginPath()
      ctx.moveTo(cx - 10, cy)
      ctx.lineTo(cx + 10, cy)
      ctx.moveTo(cx, cy - 10)
      ctx.lineTo(cx, cy + 10)
      ctx.stroke()

      // Blinking REC dot
      if (Math.floor(timeMs / 400) % 2 === 0) {
        ctx.fillStyle = '#ef4444'
        ctx.beginPath()
        ctx.arc(frameX + 22, frameY + 22, 3.5, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#ffffff'
        ctx.font = 'bold 8px monospace'
        ctx.fillText('REC', frameX + 29, frameY + 25)
      }
      ctx.restore()
    }

    // 4. Kinetic Caption / Active Subtitle Pill (Bottom of Frame)
    const textY = frameY + frameH * 0.78
    ctx.save()
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = 'bold 10.5px system-ui, sans-serif'

    let displayText = activeText
    if (displayText.length > 28) displayText = displayText.slice(0, 26) + '…'

    const metrics = ctx.measureText(displayText)
    const pillW = Math.min(frameW * 0.94, metrics.width + 16)
    const pillH = 20

    // Backdrop pill
    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)'
    ctx.beginPath()
    ctx.roundRect(frameX + (frameW - pillW) / 2, textY - pillH / 2, pillW, pillH, 5)
    ctx.fill()
    ctx.strokeStyle = isHovered ? 'rgba(96, 165, 250, 0.5)' : 'rgba(255, 255, 255, 0.15)'
    ctx.lineWidth = 1
    ctx.stroke()

    ctx.fillStyle = isHovered ? '#60a5fa' : '#ffffff'
    ctx.fillText(displayText, frameX + frameW / 2, textY)
    ctx.restore()

    ctx.restore() // End frame clip

    // 5. Ambient Equalizer Bars & Live Playback Scrubber on Hover
    if (isHovered) {
      // Audio Equalizer bars in top-right corner
      ctx.save()
      const eqX = frameX + frameW - 24
      const eqY = frameY + 8
      ctx.fillStyle = '#60a5fa'
      for (let i = 0; i < 4; i++) {
        const barH = 3 + Math.abs(Math.sin(timeMs * 0.015 + i * 1.4)) * 7
        ctx.fillRect(eqX + i * 3.5, eqY + (10 - barH), 2.2, barH)
      }
      ctx.restore()

      // Scrubber Track at absolute bottom edge of card
      const barY = h - 4
      ctx.fillStyle = 'rgba(255, 255, 255, 0.12)'
      ctx.fillRect(0, barY, w, 4)

      // Glowing Neon Scrubber Fill
      const glowBar = ctx.createLinearGradient(0, barY, w * t, barY)
      glowBar.addColorStop(0, '#3b82f6')
      glowBar.addColorStop(1, '#a855f7')
      ctx.fillStyle = glowBar
      ctx.fillRect(0, barY, w * t, 4)

      // Glowing Playhead Circle
      ctx.fillStyle = '#ffffff'
      ctx.shadowColor = '#a855f7'
      ctx.shadowBlur = 6
      ctx.beginPath()
      ctx.arc(w * t, barY + 2, 3.5, 0, Math.PI * 2)
      ctx.fill()
    }
  }, [template, isHovered, effectiveProgress, activeText, isVertical, isSquare])

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
        <div className="absolute top-2 right-2 flex items-center gap-1.5 rounded-md bg-black/90 px-2 py-0.5 text-[9px] font-mono font-semibold text-primary border border-primary/40 backdrop-blur-xs shadow-md animate-in fade-in duration-150">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          <span>
            {formatTime(currentTimeSec)} / {formatTime(template.durationSeconds)}
          </span>
        </div>
      )}

      {/* Active Scene Chip on Hover */}
      {isHovered && activeClip && (
        <div className="absolute top-2 left-2 flex items-center gap-1 rounded-md bg-black/85 px-2 py-0.5 text-[9px] font-medium text-white/95 border border-white/15 backdrop-blur-xs shadow-md">
          <span className="text-primary font-semibold">{`${currentSceneNumber}/${totalScenes}`}</span>
          <span className="max-w-[100px] truncate">{activeClip.title}</span>
        </div>
      )}
    </div>
  )
}
